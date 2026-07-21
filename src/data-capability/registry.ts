import { ReplaySubject, Subject, Subscription, timeout as rxTimeout } from 'rxjs'
import type {
  CapabilityAvailability,
  CapabilityDefinitionBase,
  CapabilityQuery,
  CapabilityRegisterOptions,
  CapabilityRegistry,
  DataCapabilityProvider,
  DataCapabilityProviderLoader,
  DataCapabilityProviderLoadedResult,
  DataCapabilityRegistry,
  DataCapabilityRuntime,
  ConfirmedOperation,
  OperationConfirmationProof,
  DataConnection,
  DataConnectionEvent,
  DataConnectionRequest,
  DataSource,
  DataSourceDefinition,
  DataSourceResult,
  OperationDefinition,
  OperationEvent,
  OperationExecution,
  OperationPolicy,
  PersistedDataBinding,
  PersistedOperationBinding,
  PreparedOperation,
  ResolvedCapability,
  ResolvedCapabilityCatalog,
  RuntimeCreateContext,
  RuntimeQueryOptions,
  CapabilityContext,
  CapabilityPreviewRequest,
  CapabilityPreviewResult,
  ContextValueDefinition,
  ValueEditorDefinition,
  OptionSourceDefinition,
  ResolvedDataSourceRequest,
  RuntimeContext,
} from './types'
import { BindingResolver } from './binding'
import { AVAILABLE_CAPABILITY, applyOutputMapping, createCapabilityError, matchesCapabilityQuery } from './utils'

type RegisteredDefinition<T> = {
  definition: T
  scope: string
}

type ProviderRegistrationStamp = {
  token: string
  generation: number
}

type ProviderEntry = {
  token: string
  scope: string
  registered: boolean
  generation: number
  loaded: boolean
  module: boolean
  provider?: DataCapabilityProvider
  loader?: DataCapabilityProviderLoader
  loadPromise?: Promise<void>
}

type PreparedOperationEntry = {
  definition: OperationDefinition
  registration?: ProviderRegistrationStamp
  operation: Awaited<ReturnType<OperationDefinition['create']>>
  prepared: PreparedOperation
}

type OperationExecutionEntry = {
  execution: OperationExecution
  subscription?: Subscription
}

type QueryResource = {
  abortController: AbortController
  dataSource?: DataSource
  subscription?: Subscription
}

type SharedConnection = {
  events$: Subject<DataConnectionEvent>
  refCount: number
  abortController: AbortController
  subscription?: Subscription
  dataSource?: DataSource
  disposed: boolean
  capabilityId: string
  registration?: ProviderRegistrationStamp
  lastStatus?: DataConnectionEvent
  lastData?: DataConnectionEvent
}

type ProviderDefinitionIds = {
  stamp: ProviderRegistrationStamp
  sources: Set<string>
  operations: Set<string>
  contexts: Set<string>
  valueEditors: Set<string>
  optionSources: Set<string>
}

const RISK_ORDER: OperationPolicy['risk'][] = ['low', 'medium', 'high', 'critical']
const CONFIRMATION_ORDER: OperationPolicy['confirmation'][] = ['none', 'destructive', 'provider', 'always']
const RETRY_ORDER: OperationPolicy['retry'][] = ['never', 'idempotent-only', 'provider']
const CANCELLATION_ORDER: OperationPolicy['cancellation'][] = ['unsupported', 'before-dispatch', 'best-effort', 'compensatable']
let providerRegistrationSequence = 0

class ScopedCapabilityRegistry<T extends CapabilityDefinitionBase> implements CapabilityRegistry<T> {
  private readonly definitions = new Map<string, RegisteredDefinition<T>[]>()

  constructor(private readonly notify: () => void) {}

  register(definition: T, options: CapabilityRegisterOptions = {}): () => void {
    const scope = options.scope || 'global'
    const exists = this.definitions.get(definition.id) || []
    if (!options.override && exists.some(item => item.scope === scope)) {
      throw new Error(`Capability ${definition.id} already registered in scope ${scope}`)
    }
    const next = options.override
      ? exists.filter(item => item.scope !== scope)
      : exists
    next.push({ definition, scope })
    this.definitions.set(definition.id, next)
    this.notify()

    return () => {
      const current = this.definitions.get(definition.id) || []
      const rest = current.filter(item => item.definition !== definition || item.scope !== scope)
      if (rest.length) {
        this.definitions.set(definition.id, rest)
      } else {
        this.definitions.delete(definition.id)
      }
      this.notify()
    }
  }

  get(id: string): T | undefined {
    return this.definitions.get(id)?.at(-1)?.definition
  }

  list(): T[] {
    return Array.from(this.definitions.values()).map(items => items[items.length - 1].definition)
  }

  clear(scope?: string): void {
    if (!scope) {
      this.definitions.clear()
      this.notify()
      return
    }
    for (const [id, items] of this.definitions.entries()) {
      const rest = items.filter(item => item.scope !== scope)
      if (rest.length) {
        this.definitions.set(id, rest)
      } else {
        this.definitions.delete(id)
      }
    }
    this.notify()
  }
}

export class DefaultDataCapabilityRegistry implements DataCapabilityRegistry {
  constructor(private readonly options: { loadModuleProviders?: boolean } = {}) {}
  readonly sources = new ScopedCapabilityRegistry<DataSourceDefinition>(() => this.emitChange())
  readonly operations = new ScopedCapabilityRegistry<OperationDefinition>(() => this.emitChange())
  readonly contexts = new ScopedCapabilityRegistry<ContextValueDefinition>(() => this.emitChange())
  readonly valueEditors = new ScopedCapabilityRegistry<ValueEditorDefinition>(() => this.emitChange())
  readonly optionSources = new ScopedCapabilityRegistry<OptionSourceDefinition>(() => this.emitChange())

  private readonly listeners = new Set<() => void>()
  private readonly providerUnregisters = new Map<string, Array<() => void>>()
  private readonly providerDefinitionIds = new Map<string, ProviderDefinitionIds>()
  private readonly providerEntries = new Map<string, ProviderEntry>()
  private readonly moduleProviderTokens = new Set<string>()
  private readonly definitionOwners = new WeakMap<CapabilityDefinitionBase, ProviderRegistrationStamp>()
  private readonly runtimes = new Set<DefaultDataCapabilityRuntime>()

  registerProvider(provider: DataCapabilityProvider, options: CapabilityRegisterOptions = {}): () => void {
    const token = `manual:${provider.id}:${options.scope || 'default'}:${providerRegistrationSequence++}`
    const entry: ProviderEntry = {
      token,
      provider,
      scope: options.scope || `provider:${token}`,
      registered: true,
      generation: 0,
      loaded: false,
      module: false,
    }
    this.providerEntries.set(token, entry)
    this.emitChange()

    return () => {
      this.disposeProviderEntry(token, true)
      this.emitChange()
    }
  }

  async loadModuleProviders(_context: CapabilityContext = {}): Promise<void> {
    if (this.options.loadModuleProviders === false) return
    const { moduleRegistry } = await import('@jetlinks-web-core/utils/module-registry')
    const modules = moduleRegistry.getAllModules()
    const loaders: Array<{ key: string; loader: DataCapabilityProviderLoader }> = []
    modules.forEach((resource, moduleId) => {
      const providers = resource.dataCapabilityProviders
      if (providers && typeof providers === 'object') {
        Object.entries(providers as Record<string, DataCapabilityProviderLoader>).forEach(([key, loader]) => {
          if (typeof loader === 'function') {
            loaders.push({ key: `${moduleId}:${key}`, loader })
          }
        })
      }
    })

    const activeModuleTokens = new Set(loaders.map(item => item.key))
    for (const token of [...this.moduleProviderTokens]) {
      if (!activeModuleTokens.has(token)) {
        this.disposeProviderEntry(token, true)
      }
    }

    for (const item of loaders) {
      let entry = this.providerEntries.get(item.key)
      if (!entry) {
        entry = {
          token: item.key,
          loader: item.loader,
          scope: `provider:${item.key}`,
          registered: true,
          generation: 0,
          loaded: false,
          module: true,
        }
        this.providerEntries.set(item.key, entry)
        this.moduleProviderTokens.add(item.key)
      } else {
        entry.loader = item.loader
        entry.registered = true
      }
      try {
        await this.ensureProviderLoaded(entry)
      } catch (error) {
        console.warn(`[DataCapability] provider loader failed: ${item.key}`, error)
      }
    }
  }

  async resolveCatalog(context: CapabilityContext, query?: CapabilityQuery): Promise<ResolvedCapabilityCatalog> {
    await this.loadRegisteredProviders(context)
    await this.loadModuleProviders(context)
    return {
      sources: await this.resolveDefinitions(this.sources.list(), context, query, definition => (
        !query?.sourceModes?.length || query.sourceModes.some(mode => definition.modes.includes(mode))
      )),
      operations: await this.resolveDefinitions(this.operations.list(), context, query, definition => (
        !query?.operationActions?.length || query.operationActions.includes(definition.action)
      )),
      contexts: await this.resolveDefinitions(this.contexts.list(), context, query),
      valueEditors: await this.resolveDefinitions(this.valueEditors.list(), context, query),
      optionSources: await this.resolveDefinitions(this.optionSources.list(), context, query),
    }
  }

  private async loadRegisteredProviders(_context: CapabilityContext): Promise<void> {
    for (const entry of this.providerEntries.values()) {
      if (entry.module || !entry.registered) continue
      await this.ensureProviderLoaded(entry)
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  createRuntime(context: RuntimeCreateContext): DataCapabilityRuntime {
    const runtime = new DefaultDataCapabilityRuntime(this, context, () => this.runtimes.delete(runtime))
    this.runtimes.add(runtime)
    return runtime
  }

  private async ensureProviderLoaded(entry: ProviderEntry): Promise<void> {
    if (!entry.registered || entry.loaded) return
    if (entry.loadPromise) return entry.loadPromise
    const generation = entry.generation
    entry.loadPromise = (async () => {
      let provider = entry.provider
      let providerCreatedAfterUnregister = false
      try {
        if (!provider && entry.loader) {
          const loaded = await entry.loader()
          provider = 'default' in loaded ? loaded.default : loaded
          providerCreatedAfterUnregister = !this.isProviderEntryCurrent(entry, generation)
          entry.provider = provider
        }
        if (!provider) return
        if (!this.isProviderEntryCurrent(entry, generation)) {
          if (providerCreatedAfterUnregister) await provider.dispose?.()
          this.assertProviderEntryCurrent(entry, generation)
        }
        const result = await provider.load?.()
        this.assertProviderEntryCurrent(entry, generation)
        const unregisters: Array<() => void> = []
        this.registerLoadedDefinitions(entry, result, unregisters)
        this.providerUnregisters.set(entry.token, unregisters)
        entry.loaded = true
      } finally {
        if (entry.generation === generation) {
          entry.loadPromise = undefined
        }
      }
    })().catch((error) => {
      if (entry.generation === generation) {
        entry.loaded = false
      }
      throw error
    })
    return entry.loadPromise
  }

  private isProviderEntryCurrent(entry: ProviderEntry, generation: number): boolean {
    return entry.registered && entry.generation === generation && this.providerEntries.get(entry.token) === entry
  }

  private assertProviderEntryCurrent(entry: ProviderEntry, generation: number): void {
    if (!this.isProviderEntryCurrent(entry, generation)) {
      throw createCapabilityError('provider.unregistered', 'Provider has been unregistered', {
        details: { token: entry.token },
      })
    }
  }

  private disposeProviderEntry(token: string, disposeProvider: boolean): void {
    const entry = this.providerEntries.get(token)
    if (!entry) return
    entry.registered = false
    entry.loaded = false
    entry.generation += 1
    entry.loadPromise = undefined
    this.providerEntries.delete(token)
    this.moduleProviderTokens.delete(token)
    const affected = this.providerDefinitionIds.get(token)
    const unregisters = this.providerUnregisters.get(token) || []
    unregisters.splice(0).forEach(unregister => unregister())
    this.providerUnregisters.delete(token)
    this.providerDefinitionIds.delete(token)
    if (affected) {
      this.runtimes.forEach(runtime => runtime.disposeProviderCapabilities(affected))
    }
    if (disposeProvider) {
      void entry.provider?.dispose?.()
    }
  }

  private registerLoadedDefinitions(
    entry: ProviderEntry,
    result: DataCapabilityProviderLoadedResult | undefined,
    unregisters: Array<() => void>,
  ) {
    const stamp: ProviderRegistrationStamp = { token: entry.token, generation: entry.generation }
    const ids: ProviderDefinitionIds = {
      stamp,
      sources: new Set(),
      operations: new Set(),
      contexts: new Set(),
      valueEditors: new Set(),
      optionSources: new Set(),
    }
    result?.sources?.forEach((definition) => {
      ids.sources.add(definition.id)
      this.definitionOwners.set(definition, stamp)
      unregisters.push(this.sources.register(definition, { scope: entry.scope, override: true }))
    })
    result?.operations?.forEach((definition) => {
      ids.operations.add(definition.id)
      this.definitionOwners.set(definition, stamp)
      unregisters.push(this.operations.register(definition, { scope: entry.scope, override: true }))
    })
    result?.contexts?.forEach((definition) => {
      ids.contexts.add(definition.id)
      this.definitionOwners.set(definition, stamp)
      unregisters.push(this.contexts.register(definition, { scope: entry.scope, override: true }))
    })
    result?.valueEditors?.forEach((definition) => {
      ids.valueEditors.add(definition.id)
      this.definitionOwners.set(definition, stamp)
      unregisters.push(this.valueEditors.register(definition, { scope: entry.scope, override: true }))
    })
    result?.optionSources?.forEach((definition) => {
      ids.optionSources.add(definition.id)
      this.definitionOwners.set(definition, stamp)
      unregisters.push(this.optionSources.register(definition, { scope: entry.scope, override: true }))
    })
    this.providerDefinitionIds.set(entry.token, ids)
  }

  getDefinitionRegistration(definition: CapabilityDefinitionBase): ProviderRegistrationStamp | undefined {
    const stamp = this.definitionOwners.get(definition)
    return stamp && { ...stamp }
  }

  private async resolveDefinitions<T extends CapabilityDefinitionBase>(
    definitions: T[],
    context: CapabilityContext,
    query?: CapabilityQuery,
    extra?: (definition: T) => boolean,
  ): Promise<Array<ResolvedCapability<T>>> {
    const result: Array<ResolvedCapability<T>> = []
    for (const definition of definitions) {
      if (!matchesCapabilityQuery(definition, query) || (extra && !extra(definition))) continue
      const availability = await resolveAvailability(definition, context, 'discover')
      if (!query?.includeUnavailable && !availability.discoverable) continue
      result.push({ definition, availability })
    }
    return result.sort((left, right) => (left.definition.order || 0) - (right.definition.order || 0))
  }

  private emitChange(): void {
    this.listeners.forEach(listener => listener())
  }
}

async function resolveAvailability(
  definition: CapabilityDefinitionBase,
  context: CapabilityContext,
  phase?: 'discover' | 'configure' | 'execute',
): Promise<CapabilityAvailability> {
  if (!definition.availability) return AVAILABLE_CAPABILITY
  return definition.availability(context, phase)
}

// Runtime entry points must re-check execute availability before creating Provider instances.
async function assertExecutable(
  definition: CapabilityDefinitionBase,
  context: CapabilityContext,
): Promise<void> {
  const availability = await resolveAvailability(definition, context, 'execute')
  if (!availability.executable) {
    throw createCapabilityError('capability.unavailable', availability.reason || 'Capability is unavailable', {
      capabilityId: definition.id,
      retryable: availability.retryable,
    })
  }
}

function resolveLimit(...values: Array<number | undefined>): number | undefined {
  const candidates = values.filter((value): value is number => (
    typeof value === 'number' && Number.isInteger(value) && value > 0
  ))
  if (!candidates.length) return undefined
  return Math.min(...candidates)
}

function limitDataSourceResult<T>(result: DataSourceResult<T>, limit?: number): DataSourceResult<T> {
  if (!limit) return result
  const data = limitData(result.data, limit) as T
  const next: DataSourceResult<T> = { ...result, data }
  if (Array.isArray(data)) {
    next.pageSize = typeof result.pageSize === 'number' ? Math.min(result.pageSize, limit) : data.length
  }
  return next
}

function limitData(data: unknown, limit?: number): unknown {
  if (!limit || !Array.isArray(data)) return data
  return data.slice(0, limit)
}

// Keep execute tied to the prepare-time snapshot; caller-owned objects may be mutated after confirmation.
function freezePreparedOperation(prepared: PreparedOperation): PreparedOperation {
  return deepFreeze(cloneCapabilityValue(prepared))
}

function cloneCapabilityValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  Object.freeze(value)
  Object.values(value as Record<string, unknown>).forEach(item => deepFreeze(item))
  return value
}

class DefaultDataCapabilityRuntime implements DataCapabilityRuntime {
  private disposed = false
  private readonly bindingResolver: BindingResolver
  private readonly parameters: Record<string, unknown>
  private readonly contexts = new Map<string, unknown>()
  private readonly disposers: Array<() => void> = []
  private readonly preparedOperations = new Map<string, PreparedOperationEntry>()
  private readonly confirmedOperations = new Map<string, ConfirmedOperation>()
  private readonly operationExecutions = new Map<string, OperationExecutionEntry>()
  private readonly sharedConnections = new Map<string, SharedConnection>()
  private readonly queryResources = new Set<QueryResource>()

  constructor(
    private readonly registry: DefaultDataCapabilityRegistry,
    private readonly runtimeContext: RuntimeCreateContext,
    private readonly onDispose: () => void,
  ) {
    this.parameters = { ...(runtimeContext.parameters || {}) }
    this.bindingResolver = new BindingResolver(registry.contexts)
  }

  connect<T = unknown>(request: DataConnectionRequest): DataConnection<T> {
    this.assertActive()
    assertPlanSupported(request.binding)
    const id = request.id || `${request.consumerId}:${Date.now()}`
    const events$ = new ReplaySubject<DataConnectionEvent<T>>(1)
    let stopped = false
    let sharedKey: string | undefined
    let sharedSubscription: Subscription | undefined

    const forwardShared = (shared: SharedConnection) => {
      shared.refCount += 1
      if (shared.lastStatus?.type === 'status' && shared.lastStatus.status === 'completed') {
        shared.lastData && events$.next(shared.lastData as DataConnectionEvent<T>)
        events$.next(shared.lastStatus as DataConnectionEvent<T>)
      } else {
        shared.lastStatus && events$.next(shared.lastStatus as DataConnectionEvent<T>)
        shared.lastData && events$.next(shared.lastData as DataConnectionEvent<T>)
      }
      sharedSubscription = shared.events$.subscribe({
        next: event => events$.next(event as DataConnectionEvent<T>),
        error: error => events$.error(error),
        complete: () => events$.complete(),
      })
    }

    void (async () => {
      events$.next({ type: 'status', status: 'connecting' })
      try {
        const binding = request.binding
        const definition = this.requireSource(binding.source.capabilityId)
        const registration = this.registry.getDefinitionRegistration(definition)
        const signal = request.options?.signal
        const runtimeContext = this.toRuntimeContext(signal)
        await assertExecutable(definition, runtimeContext)
        this.assertActive()
        if (stopped || signal?.aborted) return
        const query = await this.resolveRecord(binding.query, signal)
        this.assertActive()
        if (stopped || signal?.aborted) return
        const resolvedRequest = normalizeDataSourceRequest(definition, {
          capabilityId: binding.source.capabilityId,
          version: binding.source.version,
          config: binding.source.config,
          query,
          signal,
          limit: resolveLimit(request.options?.limit, definition.defaults?.limit),
          timeout: request.options?.timeout || definition.defaults?.timeout,
        }, runtimeContext)
        sharedKey = getExecutionKey(resolvedRequest, binding, registration)
        if (stopped || signal?.aborted) return
        const shared = this.sharedConnections.get(sharedKey)
        if (shared && !shared.disposed) {
          forwardShared(shared)
          return
        }
        if (stopped || signal?.aborted) return
        const created = await this.createSharedConnection(definition, registration, resolvedRequest, binding, sharedKey)
        if (stopped || signal?.aborted) return
        forwardShared(created)
      } catch (error) {
        if (!stopped) {
          events$.next({ type: 'status', status: 'failed', error: toCapabilityError(error, request.binding.source.capabilityId) })
          events$.complete()
        }
      }
    })()

    const unsubscribe = () => {
      if (stopped) return
      stopped = true
      request.options?.signal?.removeEventListener('abort', unsubscribe)
      sharedSubscription?.unsubscribe()
      events$.complete()
      if (sharedKey) this.releaseSharedConnection(sharedKey)
    }
    if (request.options?.signal?.aborted) {
      unsubscribe()
    } else {
      request.options?.signal?.addEventListener('abort', unsubscribe, { once: true })
    }
    this.disposers.push(unsubscribe)

    return { id, events$: events$.asObservable(), unsubscribe }
  }

  async query<T = unknown>(binding: PersistedDataBinding, options: RuntimeQueryOptions = {}): Promise<DataSourceResult<T>> {
    this.assertActive()
    assertPlanSupported(binding)
    const definition = this.requireSource(binding.source.capabilityId)
    const externalSignal = options.signal
    const queryResource: QueryResource = { abortController: new AbortController() }
    const abortByExternal = () => queryResource.abortController.abort()
    externalSignal?.addEventListener('abort', abortByExternal, { once: true })
    this.queryResources.add(queryResource)
    const runtimeContext = this.toRuntimeContext(queryResource.abortController.signal)
    try {
      await assertExecutable(definition, runtimeContext)
      this.assertActive()
      const query = await this.resolveRecord(binding.query, queryResource.abortController.signal)
      this.assertActive()
      const resolvedRequest = normalizeDataSourceRequest(definition, {
        capabilityId: binding.source.capabilityId,
        version: binding.source.version,
        config: binding.source.config,
        query,
        signal: queryResource.abortController.signal,
        limit: resolveLimit(options.limit, definition.defaults?.limit),
        timeout: options.timeout || definition.defaults?.timeout,
      }, runtimeContext)
      const dataSource = await definition.create(resolvedRequest.config, this.runtimeContext)
      queryResource.dataSource = dataSource
      this.assertActive()
      const result = await firstDataSourceResult<T>(
        dataSource.query<T>(resolvedRequest, runtimeContext)
          .pipe(resolvedRequest.timeout ? rxTimeout({ first: resolvedRequest.timeout }) : source => source),
        queryResource,
      )
      this.assertActive()
      return limitDataSourceResult({ ...result, data: applyOutputMapping(result.data, binding.mapping) as T }, resolvedRequest.limit)
    } finally {
      externalSignal?.removeEventListener('abort', abortByExternal)
      this.queryResources.delete(queryResource)
      queryResource.abortController.abort()
      await queryResource.dataSource?.dispose?.()
    }
  }

  async preview<T = unknown>(request: CapabilityPreviewRequest): Promise<CapabilityPreviewResult<T>> {
    this.assertActive()
    assertPlanSupported(request.binding)
    const result = await this.query<T>(request.binding, { timeout: request.timeout, limit: request.limit })
    return {
      data: limitData(result.data, request.limit) as T,
      outputSchema: result.outputSchema,
      diagnostics: result.diagnostics,
    }
  }

  async prepareOperation(binding: PersistedOperationBinding): Promise<PreparedOperation> {
    this.assertActive()
    const definition = this.requireOperation(binding.operation.capabilityId)
    const registration = this.registry.getDefinitionRegistration(definition)
    const operation = await definition.create(binding.operation.config, this.runtimeContext)
    try {
      this.assertActive()
      const input = await this.resolveRecord(binding.input)
      this.assertActive()
      const policy = mergeOperationPolicy(definition.policy, binding.policyOverride)
      const request = { config: binding.operation.config, input }
      const prepared = operation.prepare
        ? await operation.prepare(request, this.toRuntimeContext())
        : {
            id: `${definition.id}:${Date.now()}`,
            capabilityId: definition.id,
            request,
            policy,
          }
      this.assertActive()
      const canonicalPrepared = freezePreparedOperation({ ...prepared, policy: mergeOperationPolicy(policy, prepared.policy) })
      this.preparedOperations.set(canonicalPrepared.id, { definition, registration, operation, prepared: canonicalPrepared })
      return cloneCapabilityValue(canonicalPrepared)
    } catch (error) {
      await operation.dispose?.()
      throw error
    }
  }

  confirmOperation(preparedId: string, proof: OperationConfirmationProof): ConfirmedOperation {
    this.assertActive()
    const cached = this.preparedOperations.get(preparedId)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared')
    }
    const confirmed = deepFreeze({
      id: `${preparedId}:confirmed:${Date.now()}`,
      preparedId,
      capabilityId: cached.prepared.capabilityId,
      proof: {
        ...proof,
        confirmedAt: proof.confirmedAt || Date.now(),
      },
    })
    this.confirmedOperations.set(confirmed.id, confirmed)
    return cloneCapabilityValue(confirmed)
  }

  executeOperation(operation: ConfirmedOperation | PreparedOperation): OperationExecution {
    this.assertActive()
    const confirmed = this.resolveConfirmedOperation(operation)
    const existed = this.operationExecutions.get(confirmed.preparedId)
    if (existed) return existed.execution

    const cached = this.preparedOperations.get(confirmed.preparedId)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared', {
        capabilityId: confirmed.capabilityId,
      })
    }

    const events$ = new ReplaySubject<OperationEvent>(100)
    const execution: OperationExecution = {
      id: confirmed.preparedId,
      events$: events$.asObservable(),
    }
    const entry: OperationExecutionEntry = { execution }
    this.operationExecutions.set(confirmed.preparedId, entry)

    void (async () => {
      try {
        this.assertActive()
        const availability = await resolveAvailability(cached.definition, this.toRuntimeContext(), 'execute')
        this.assertActive()
        if (!availability.executable) {
          throw createCapabilityError('operation.unavailable', availability.reason || 'Operation is unavailable', {
            capabilityId: confirmed.capabilityId,
            retryable: availability.retryable,
          })
        }
        this.assertActive()
        const subscription = cached.operation.execute(cached.prepared, this.toRuntimeContext()).subscribe({
          next: event => events$.next(event),
          error: error => events$.error(error),
          complete: () => events$.complete(),
        })
        entry.subscription = subscription
      } catch (error) {
        events$.error(error)
      }
    })()

    return execution
  }

  private resolveConfirmedOperation(operation: ConfirmedOperation | PreparedOperation): ConfirmedOperation {
    if ('preparedId' in operation) {
      const cached = this.confirmedOperations.get(operation.id)
      if (!cached || cached.preparedId !== operation.preparedId) {
        throw createCapabilityError('operation.confirmation_invalid', 'Operation confirmation is invalid', {
          capabilityId: operation.capabilityId,
        })
      }
      return cached
    }
    const cached = this.preparedOperations.get(operation.id)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared', {
        capabilityId: operation.capabilityId,
      })
    }
    if (cached.prepared.policy.confirmation !== 'none') {
      throw createCapabilityError('operation.confirmation_required', 'Operation confirmation is required', {
        capabilityId: cached.prepared.capabilityId,
      })
    }
    return {
      id: `${operation.id}:implicit`,
      preparedId: operation.id,
      capabilityId: operation.capabilityId,
      proof: { method: 'policy', confirmedAt: Date.now() },
    }
  }

  updateParameters(values: Record<string, unknown>): void {
    this.assertActive()
    Object.assign(this.parameters, values)
  }

  updateContext(providerId: string, instanceId: string, value: unknown): void {
    this.assertActive()
    this.contexts.set(`${providerId}:${instanceId}`, value)
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.onDispose()
    this.disposers.splice(0).forEach(disposer => disposer())
    this.queryResources.forEach((resource) => {
      resource.abortController.abort()
      resource.subscription?.unsubscribe()
      void resource.dataSource?.dispose?.()
    })
    this.queryResources.clear()
    for (const key of [...this.sharedConnections.keys()]) {
      this.disposeSharedConnection(key)
    }
    this.operationExecutions.forEach(entry => entry.subscription?.unsubscribe())
    this.operationExecutions.clear()
    for (const entry of this.preparedOperations.values()) {
      await entry.operation.dispose?.()
    }
    this.preparedOperations.clear()
    this.confirmedOperations.clear()
    this.contexts.clear()
  }

  disposeProviderCapabilities(affected: ProviderDefinitionIds): void {
    if (this.disposed) return
    for (const [key, shared] of [...this.sharedConnections.entries()]) {
      if (affected.sources.has(shared.capabilityId) && sameRegistration(shared.registration, affected.stamp)) {
        this.disposeSharedConnection(key, createCapabilityError('capability.unavailable', 'Capability provider has been unregistered', {
          capabilityId: shared.capabilityId,
          retryable: true,
        }))
      }
    }
    for (const [preparedId, entry] of [...this.preparedOperations.entries()]) {
      if (!affected.operations.has(entry.definition.id) || !sameRegistration(entry.registration, affected.stamp)) continue
      if (this.operationExecutions.has(preparedId)) continue
      void entry.operation.dispose?.()
      this.preparedOperations.delete(preparedId)
      for (const [confirmedId, confirmed] of [...this.confirmedOperations.entries()]) {
        if (confirmed.preparedId === preparedId) this.confirmedOperations.delete(confirmedId)
      }
    }
  }

  private async createSharedConnection<T>(
    definition: DataSourceDefinition,
    registration: ProviderRegistrationStamp | undefined,
    request: ResolvedDataSourceRequest,
    binding: PersistedDataBinding,
    key: string,
  ): Promise<SharedConnection> {
    const abortController = new AbortController()
    const shared: SharedConnection = {
      events$: new Subject<DataConnectionEvent>(),
      refCount: 0,
      abortController,
      disposed: false,
      capabilityId: definition.id,
      registration,
    }
    this.sharedConnections.set(key, shared)

    try {
      const runtimeContext = this.toRuntimeContext(abortController.signal)
      await assertExecutable(definition, runtimeContext)
      this.assertActive()
      const dataSource = await definition.create(request.config, this.runtimeContext)
      this.assertActive()
      if (shared.disposed) {
        await dataSource.dispose?.()
        return shared
      }
      shared.dataSource = dataSource
      this.emitSharedConnection(shared, { type: 'status', status: 'connected' })
      shared.subscription = dataSource.query<T>({ ...request, signal: abortController.signal }, runtimeContext)
        .pipe(request.timeout ? rxTimeout({ first: request.timeout }) : source => source)
        .subscribe({
          next: (result) => {
            const mapped = applyOutputMapping(result.data, binding.mapping)
            this.emitSharedConnection(shared, {
              type: 'data',
              result: limitDataSourceResult({ ...result, data: mapped as T }, request.limit),
            })
          },
          error: (error) => {
            this.emitSharedConnection(shared, { type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
            shared.events$.complete()
            this.disposeSharedConnection(key)
          },
          complete: () => {
            this.emitSharedConnection(shared, { type: 'status', status: 'completed' })
            shared.events$.complete()
            this.disposeSharedConnection(key)
          },
        })
    } catch (error) {
      this.emitSharedConnection(shared, { type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
      shared.events$.complete()
      this.disposeSharedConnection(key)
    }
    return shared
  }

  private releaseSharedConnection(key: string): void {
    const shared = this.sharedConnections.get(key)
    if (!shared) return
    shared.refCount -= 1
    if (shared.refCount <= 0) {
      this.disposeSharedConnection(key)
    }
  }

  private emitSharedConnection(shared: SharedConnection, event: DataConnectionEvent): void {
    if (event.type === 'status') {
      shared.lastStatus = event
    } else if (event.type === 'data') {
      shared.lastData = event
    }
    shared.events$.next(event)
  }

  private disposeSharedConnection(key: string, unavailable?: ReturnType<typeof createCapabilityError>): void {
    const shared = this.sharedConnections.get(key)
    if (!shared || shared.disposed) return
    shared.disposed = true
    if (unavailable) {
      this.emitSharedConnection(shared, { type: 'status', status: 'unavailable', error: unavailable })
    }
    shared.abortController.abort()
    shared.subscription?.unsubscribe()
    void shared.dataSource?.dispose?.()
    shared.events$.complete()
    this.sharedConnections.delete(key)
  }

  private assertActive(): void {
    if (this.disposed) {
      throw createCapabilityError('runtime.disposed', 'Runtime has been disposed')
    }
  }

  private async resolveRecord(values: PersistedDataBinding['query'], signal?: AbortSignal) {
    return this.bindingResolver.resolveRecord(values, this.toRuntimeContext(signal))
  }

  private toRuntimeContext(signal?: AbortSignal) {
    return {
      ...this.runtimeContext,
      parameters: this.parameters,
      contexts: Object.fromEntries(this.contexts),
      signal,
    }
  }

  private requireSource(id: string): DataSourceDefinition {
    const definition = this.registry.sources.get(id)
    if (!definition) {
      throw createCapabilityError('source.not_found', `DataSource ${id} is not registered`, { capabilityId: id })
    }
    return definition
  }

  private requireOperation(id: string): OperationDefinition {
    const definition = this.registry.operations.get(id)
    if (!definition) {
      throw createCapabilityError('operation.not_found', `Operation ${id} is not registered`, { capabilityId: id })
    }
    return definition
  }
}

function normalizeDataSourceRequest(
  definition: DataSourceDefinition,
  request: ResolvedDataSourceRequest,
  context: RuntimeContext,
): ResolvedDataSourceRequest {
  return definition.optimizer?.normalize?.(request, context) || request
}

// Until merge/split is implemented, only fully identical normalized requests can share upstream.
function getExecutionKey(
  request: ResolvedDataSourceRequest,
  binding: PersistedDataBinding,
  registration?: ProviderRegistrationStamp,
): string {
  const { signal: _signal, ...stableRequest } = request
  return stableStringify({ source: stableRequest, mapping: binding.mapping, plan: binding.plan, registration })
}




function firstDataSourceResult<T>(source: ReturnType<DataSource['query']>, resource: QueryResource): Promise<DataSourceResult<T>> {
  return new Promise((resolve, reject) => {
    let settled = false
    let subscription: Subscription | undefined
    subscription = source.subscribe({
      next: (result) => {
        if (settled) return
        settled = true
        resolve(result as DataSourceResult<T>)
        queueMicrotask(() => subscription?.unsubscribe())
      },
      error: (error) => {
        if (settled) return
        settled = true
        reject(error)
      },
      complete: () => {
        if (settled) return
        settled = true
        reject(createCapabilityError('data_source.empty', 'Data source completed without data'))
      },
    })
    resource.subscription = subscription
  })
}

function sameRegistration(
  left: ProviderRegistrationStamp | undefined,
  right: ProviderRegistrationStamp | undefined,
): boolean {
  return !!left && !!right && left.token === right.token && left.generation === right.generation
}

function assertPlanSupported(binding: PersistedDataBinding): void {
  if (binding.plan?.nodes?.length) {
    throw createCapabilityError('data_source.plan.unsupported', 'Data source plan is not supported yet', {
      capabilityId: binding.source.capabilityId,
    })
  }
}

function mergeOperationPolicy(
  base: OperationPolicy,
  override?: Partial<OperationPolicy>,
): OperationPolicy {
  if (!override) return { ...base }
  return {
    ...base,
    risk: maxByOrder(base.risk, override.risk, RISK_ORDER),
    confirmation: maxByOrder(base.confirmation, override.confirmation, CONFIRMATION_ORDER),
    cancellation: minByOrder(base.cancellation, override.cancellation, CANCELLATION_ORDER),
    retry: minByOrder(base.retry, override.retry, RETRY_ORDER),
    batch: mergeBatchPolicy(base.batch, override.batch),
    audit: base.audit || override.audit,
  }
}


function mergeBatchPolicy(base: boolean | undefined, override: boolean | undefined): boolean | undefined {
  assertOptionalBoolean('batch', override)
  if (override === undefined) return base
  return Boolean(base && override)
}

function assertOptionalBoolean(name: string, value: unknown): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') {
    throw createCapabilityError('operation.policy_invalid', `Operation policy ${name} must be boolean`, {
      details: { name, value },
    })
  }
}

function assertPolicyValue<T extends string>(name: string, value: T | undefined, order: T[]): void {
  if (value !== undefined && !order.includes(value)) {
    throw createCapabilityError('operation.policy_invalid', `Operation policy ${name} is invalid`, {
      details: { name, value },
    })
  }
}

function maxByOrder<T extends string>(base: T, override: T | undefined, order: T[]): T {
  assertPolicyValue('enum', override, order)
  if (!override) return base
  return order.indexOf(override) > order.indexOf(base) ? override : base
}

function minByOrder<T extends string>(base: T, override: T | undefined, order: T[]): T {
  assertPolicyValue('enum', override, order)
  if (!override) return base
  return order.indexOf(override) < order.indexOf(base) ? override : base
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function toCapabilityError(error: unknown, capabilityId?: string) {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error as ReturnType<typeof createCapabilityError>
  }
  const message = error instanceof Error ? error.message : String(error)
  return createCapabilityError('capability.runtime_error', message, { capabilityId, cause: error })
}

export const dataCapabilityRegistry = new DefaultDataCapabilityRegistry()
