import { ReplaySubject, Subject, Subscription, firstValueFrom, timeout as rxTimeout } from 'rxjs'
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

type ProviderRegistration = {
  provider: DataCapabilityProvider
  scope: string
}

type SharedConnection = {
  events$: ReplaySubject<DataConnectionEvent>
  refCount: number
  abortController: AbortController
  subscription?: Subscription
  dataSource?: DataSource
  disposed: boolean
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
  private readonly loadedProviders = new Set<string>()
  private readonly registeredProviders = new Map<string, ProviderRegistration>()

  registerProvider(provider: DataCapabilityProvider, options: CapabilityRegisterOptions = {}): () => void {
    const token = `manual:${provider.id}:${options.scope || 'default'}:${providerRegistrationSequence++}`
    this.registeredProviders.set(token, {
      provider,
      scope: options.scope || `provider:${token}`,
    })
    this.loadedProviders.delete(token)
    this.emitChange()

    return () => {
      this.registeredProviders.delete(token)
      this.loadedProviders.delete(token)
      const unregisters = this.providerUnregisters.get(token) || []
      unregisters.splice(0).forEach(unregister => unregister())
      this.providerUnregisters.delete(token)
      void provider.dispose?.()
      this.emitChange()
    }
  }

  async loadModuleProviders(context: CapabilityContext): Promise<void> {
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

    for (const item of loaders) {
      if (this.loadedProviders.has(item.key)) continue
      try {
        const loaded = await item.loader()
        const provider = 'default' in loaded ? loaded.default : loaded
        await this.loadProvider(item.key, provider, context, `provider:${item.key}`)
        this.loadedProviders.add(item.key)
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

  private async loadRegisteredProviders(context: CapabilityContext): Promise<void> {
    for (const [token, registration] of this.registeredProviders.entries()) {
      if (this.loadedProviders.has(token)) continue
      await this.loadProvider(token, registration.provider, context, registration.scope)
      this.loadedProviders.add(token)
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  createRuntime(context: RuntimeCreateContext): DataCapabilityRuntime {
    return new DefaultDataCapabilityRuntime(this, context)
  }

  private async loadProvider(
    token: string,
    provider: DataCapabilityProvider,
    context: CapabilityContext,
    scope: string,
  ): Promise<void> {
    const oldUnregisters = this.providerUnregisters.get(token) || []
    oldUnregisters.splice(0).forEach(unregister => unregister())
    const result = await provider.load?.(context)
    const unregisters: Array<() => void> = []
    this.registerLoadedDefinitions(result, scope, unregisters)
    this.providerUnregisters.set(token, unregisters)
  }

  private registerLoadedDefinitions(
    result: DataCapabilityProviderLoadedResult | undefined,
    scope: string,
    unregisters: Array<() => void>,
  ) {
    result?.sources?.forEach(definition => unregisters.push(this.sources.register(definition, { scope, override: true })))
    result?.operations?.forEach(definition => unregisters.push(this.operations.register(definition, { scope, override: true })))
    result?.contexts?.forEach(definition => unregisters.push(this.contexts.register(definition, { scope, override: true })))
    result?.valueEditors?.forEach(definition => unregisters.push(this.valueEditors.register(definition, { scope, override: true })))
    result?.optionSources?.forEach(definition => unregisters.push(this.optionSources.register(definition, { scope, override: true })))
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

class DefaultDataCapabilityRuntime implements DataCapabilityRuntime {
  private disposed = false
  private readonly bindingResolver: BindingResolver
  private readonly parameters: Record<string, unknown>
  private readonly contexts = new Map<string, unknown>()
  private readonly disposers: Array<() => void> = []
  private readonly preparedOperations = new Map<string, { definition: OperationDefinition; operation: Awaited<ReturnType<OperationDefinition['create']>> }>()
  private readonly operationExecutions = new Map<string, OperationExecution>()
  private readonly sharedConnections = new Map<string, SharedConnection>()

  constructor(
    private readonly registry: DefaultDataCapabilityRegistry,
    private readonly runtimeContext: RuntimeCreateContext,
  ) {
    this.parameters = { ...(runtimeContext.parameters || {}) }
    this.bindingResolver = new BindingResolver(registry.contexts)
  }

  connect<T = unknown>(request: DataConnectionRequest): DataConnection<T> {
    const id = request.id || `${request.consumerId}:${Date.now()}`
    const events$ = new Subject<DataConnectionEvent<T>>()
    let stopped = false
    let sharedKey: string | undefined
    let sharedSubscription: Subscription | undefined

    const forwardShared = (shared: SharedConnection) => {
      shared.refCount += 1
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
        const signal = request.options?.signal
        const runtimeContext = this.toRuntimeContext(signal)
        const query = await this.resolveRecord(binding.query, signal)
        const resolvedRequest = normalizeDataSourceRequest(definition, {
          capabilityId: binding.source.capabilityId,
          version: binding.source.version,
          config: binding.source.config,
          query,
          signal,
        }, runtimeContext)
        sharedKey = getExecutionKey(definition, resolvedRequest, runtimeContext, binding)
        const shared = this.sharedConnections.get(sharedKey)
        if (shared && !shared.disposed) {
          forwardShared(shared)
          return
        }
        const created = await this.createSharedConnection(definition, resolvedRequest, binding, sharedKey)
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
      sharedSubscription?.unsubscribe()
      events$.complete()
      if (sharedKey) this.releaseSharedConnection(sharedKey)
    }
    this.disposers.push(unsubscribe)

    return { id, events$: events$.asObservable(), unsubscribe }
  }

  async query<T = unknown>(binding: PersistedDataBinding, options: RuntimeQueryOptions = {}): Promise<DataSourceResult<T>> {
    const definition = this.requireSource(binding.source.capabilityId)
    const signal = options.signal
    const runtimeContext = this.toRuntimeContext(signal)
    const query = await this.resolveRecord(binding.query, signal)
    const resolvedRequest = normalizeDataSourceRequest(definition, {
      capabilityId: binding.source.capabilityId,
      version: binding.source.version,
      config: binding.source.config,
      query,
      signal,
    }, runtimeContext)
    const dataSource = await definition.create(resolvedRequest.config, this.runtimeContext)
    try {
      const result = await firstValueFrom(
        dataSource.query<T>(resolvedRequest, runtimeContext)
          .pipe(options.timeout ? rxTimeout({ first: options.timeout }) : source => source),
      )
      return { ...result, data: applyOutputMapping(result.data, binding.mapping) as T }
    } finally {
      await dataSource.dispose?.()
    }
  }

  async preview<T = unknown>(request: CapabilityPreviewRequest): Promise<CapabilityPreviewResult<T>> {
    const result = await this.query<T>(request.binding, { timeout: request.timeout, limit: request.limit })
    return {
      data: result.data,
      outputSchema: result.outputSchema,
      diagnostics: result.diagnostics,
    }
  }

  async prepareOperation(binding: PersistedOperationBinding): Promise<PreparedOperation> {
    const definition = this.requireOperation(binding.operation.capabilityId)
    const operation = await definition.create(binding.operation.config, this.runtimeContext)
    const input = await this.resolveRecord(binding.input)
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
    this.preparedOperations.set(prepared.id, { definition, operation })
    return { ...prepared, policy: mergeOperationPolicy(policy, prepared.policy) }
  }

  executeOperation(prepared: PreparedOperation): OperationExecution {
    const existed = this.operationExecutions.get(prepared.id)
    if (existed) return existed

    const cached = this.preparedOperations.get(prepared.id)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared', {
        capabilityId: prepared.capabilityId,
      })
    }

    const events$ = new ReplaySubject<OperationEvent>(100)
    const execution: OperationExecution = {
      id: prepared.id,
      events$: events$.asObservable(),
    }
    this.operationExecutions.set(prepared.id, execution)

    void (async () => {
      try {
        const availability = await resolveAvailability(cached.definition, this.toRuntimeContext(), 'execute')
        if (!availability.executable) {
          throw createCapabilityError('operation.unavailable', availability.reason || 'Operation is unavailable', {
            capabilityId: prepared.capabilityId,
            retryable: availability.retryable,
          })
        }
        const subscription = cached.operation.execute(prepared, this.toRuntimeContext()).subscribe({
          next: event => events$.next(event),
          error: error => events$.error(error),
          complete: () => events$.complete(),
        })
        this.disposers.push(() => subscription.unsubscribe())
      } catch (error) {
        events$.error(error)
      }
    })()

    return execution
  }

  updateParameters(values: Record<string, unknown>): void {
    Object.assign(this.parameters, values)
  }

  updateContext(providerId: string, instanceId: string, value: unknown): void {
    this.contexts.set(`${providerId}:${instanceId}`, value)
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.disposers.splice(0).forEach(disposer => disposer())
    for (const key of [...this.sharedConnections.keys()]) {
      this.disposeSharedConnection(key)
    }
  }

  private async createSharedConnection<T>(
    definition: DataSourceDefinition,
    request: ResolvedDataSourceRequest,
    binding: PersistedDataBinding,
    key: string,
  ): Promise<SharedConnection> {
    const abortController = new AbortController()
    const shared: SharedConnection = {
      events$: new ReplaySubject<DataConnectionEvent>(100),
      refCount: 0,
      abortController,
      disposed: false,
    }
    this.sharedConnections.set(key, shared)

    try {
      const runtimeContext = this.toRuntimeContext(abortController.signal)
      const dataSource = await definition.create(request.config, this.runtimeContext)
      if (shared.disposed) {
        await dataSource.dispose?.()
        return shared
      }
      shared.dataSource = dataSource
      shared.subscription = dataSource.query<T>({ ...request, signal: abortController.signal }, runtimeContext)
        .subscribe({
          next: (result) => {
            const mapped = applyOutputMapping(result.data, binding.mapping)
            shared.events$.next({
              type: 'data',
              result: { ...result, data: mapped as T },
            })
          },
          error: (error) => {
            shared.events$.next({ type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
            shared.events$.complete()
            this.disposeSharedConnection(key)
          },
          complete: () => {
            shared.events$.next({ type: 'status', status: 'completed' })
            shared.events$.complete()
            this.disposeSharedConnection(key)
          },
        })
      shared.events$.next({ type: 'status', status: 'connected' })
    } catch (error) {
      shared.events$.next({ type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
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

  private disposeSharedConnection(key: string): void {
    const shared = this.sharedConnections.get(key)
    if (!shared || shared.disposed) return
    shared.disposed = true
    shared.abortController.abort()
    shared.subscription?.unsubscribe()
    void shared.dataSource?.dispose?.()
    this.sharedConnections.delete(key)
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

function getExecutionKey(
  definition: DataSourceDefinition,
  request: ResolvedDataSourceRequest,
  context: RuntimeContext,
  binding: PersistedDataBinding,
): string {
  const providerKey = definition.optimizer?.getGroupKey?.(request, context)
  if (providerKey) return `${definition.id}:${providerKey}`
  return stableStringify({ source: request, mapping: binding.mapping, plan: binding.plan })
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
    batch: base.batch || override.batch,
    audit: base.audit || override.audit,
  }
}

function maxByOrder<T extends string>(base: T, override: T | undefined, order: T[]): T {
  if (!override) return base
  return order.indexOf(override) > order.indexOf(base) ? override : base
}

function minByOrder<T extends string>(base: T, override: T | undefined, order: T[]): T {
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
