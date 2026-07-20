import { Observable, Subject, firstValueFrom, of, timeout as rxTimeout } from 'rxjs'
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
  DataSourceDefinition,
  DataSourceResult,
  OperationDefinition,
  OperationExecution,
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
} from './types'
import { BindingResolver } from './binding'
import { AVAILABLE_CAPABILITY, applyOutputMapping, createCapabilityError, matchesCapabilityQuery } from './utils'

type RegisteredDefinition<T> = {
  definition: T
  scope: string
}

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
  private readonly registeredProviders = new Map<string, DataCapabilityProvider>()

  registerProvider(provider: DataCapabilityProvider, options: CapabilityRegisterOptions = {}): () => void {
    const key = `manual:${options.scope || provider.id}`
    this.registeredProviders.set(key, provider)
    this.loadedProviders.delete(key)
    this.emitChange()

    return () => {
      this.registeredProviders.delete(key)
      this.loadedProviders.delete(key)
      const unregisters = this.providerUnregisters.get(provider.id) || []
      unregisters.splice(0).forEach(unregister => unregister())
      this.providerUnregisters.delete(provider.id)
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
        await this.loadProvider(provider, context)
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
    for (const [key, provider] of this.registeredProviders.entries()) {
      if (this.loadedProviders.has(key)) continue
      await this.loadProvider(provider, context)
      this.loadedProviders.add(key)
    }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  createRuntime(context: RuntimeCreateContext): DataCapabilityRuntime {
    return new DefaultDataCapabilityRuntime(this, context)
  }

  private async loadProvider(provider: DataCapabilityProvider, context: CapabilityContext): Promise<void> {
    const result = await provider.load?.(context)
    const unregisters: Array<() => void> = []
    const scope = `provider:${provider.id}`
    this.registerLoadedDefinitions(result, scope, unregisters)
    this.providerUnregisters.set(provider.id, unregisters)
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
      const availability = await resolveAvailability(definition, context)
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
): Promise<CapabilityAvailability> {
  if (!definition.availability) return AVAILABLE_CAPABILITY
  return definition.availability(context)
}

class DefaultDataCapabilityRuntime implements DataCapabilityRuntime {
  private disposed = false
  private readonly bindingResolver: BindingResolver
  private readonly parameters: Record<string, unknown>
  private readonly contexts = new Map<string, unknown>()
  private readonly disposers: Array<() => void> = []
  private readonly preparedOperations = new Map<string, { definition: OperationDefinition; operation: Awaited<ReturnType<OperationDefinition['create']>> }>()

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
    let abortController: AbortController | undefined

    void (async () => {
      events$.next({ type: 'status', status: 'connecting' })
      try {
        abortController = new AbortController()
        const binding = request.binding
        const definition = this.requireSource(binding.source.capabilityId)
        const query = await this.resolveRecord(binding.query, request.options?.signal || abortController.signal)
        const dataSource = await definition.create(binding.source.config, this.runtimeContext)
        const subscription = dataSource.query<T>({
          config: binding.source.config,
          query,
          signal: request.options?.signal || abortController.signal,
        }, this.toRuntimeContext(request.options?.signal || abortController.signal))
          .subscribe({
            next: (result) => {
              const mapped = applyOutputMapping(result.data, binding.mapping)
              events$.next({
                type: 'data',
                result: { ...result, data: mapped as T },
              })
            },
            error: (error) => {
              events$.next({ type: 'status', status: 'failed', error: toCapabilityError(error, binding.source.capabilityId) })
              events$.complete()
            },
            complete: () => {
              events$.next({ type: 'status', status: 'completed' })
              events$.complete()
            },
          })

        events$.next({ type: 'status', status: 'connected' })
        this.disposers.push(() => {
          subscription.unsubscribe()
          void dataSource.dispose?.()
        })
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
      abortController?.abort()
      events$.complete()
    }
    this.disposers.push(unsubscribe)

    return { id, events$: events$.asObservable(), unsubscribe }
  }

  async query<T = unknown>(binding: PersistedDataBinding, options: RuntimeQueryOptions = {}): Promise<DataSourceResult<T>> {
    const definition = this.requireSource(binding.source.capabilityId)
    const signal = options.signal
    const dataSource = await definition.create(binding.source.config, this.runtimeContext)
    const query = await this.resolveRecord(binding.query, signal)
    const result = await firstValueFrom(
      dataSource.query<T>({ config: binding.source.config, query, signal }, this.toRuntimeContext(signal))
        .pipe(options.timeout ? rxTimeout({ first: options.timeout }) : source => source),
    )
    await dataSource.dispose?.()
    return { ...result, data: applyOutputMapping(result.data, binding.mapping) as T }
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
    const policy = { ...definition.policy, ...binding.policyOverride }
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
    return { ...prepared, policy }
  }

  executeOperation(prepared: PreparedOperation): OperationExecution {
    const cached = this.preparedOperations.get(prepared.id)
    if (!cached) {
      throw createCapabilityError('operation.not_prepared', 'Operation has not been prepared', {
        capabilityId: prepared.capabilityId,
      })
    }
    return {
      id: prepared.id,
      events$: cached.operation.execute(prepared, this.toRuntimeContext()),
    }
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
  }

  private async resolveRecord(values: PersistedDataBinding['query'], signal?: AbortSignal) {
    return this.bindingResolver.resolveRecord(values, this.toRuntimeContext(signal))
  }

  private toRuntimeContext(signal?: AbortSignal) {
    return {
      ...this.runtimeContext,
      parameters: this.parameters,
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

function toCapabilityError(error: unknown, capabilityId?: string) {
  if (typeof error === 'object' && error !== null && 'code' in error && 'message' in error) {
    return error as ReturnType<typeof createCapabilityError>
  }
  const message = error instanceof Error ? error.message : String(error)
  return createCapabilityError('capability.runtime_error', message, { capabilityId, cause: error })
}

export const dataCapabilityRegistry = new DefaultDataCapabilityRegistry()
