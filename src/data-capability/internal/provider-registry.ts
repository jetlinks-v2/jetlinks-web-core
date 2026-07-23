import type {
  CapabilityContext,
  CapabilityDefinitionBase,
  CapabilityQuery,
  CapabilityRegisterOptions,
  ContextValueDefinition,
  DataCapabilityProvider,
  DataCapabilityProviderLoadedResult,
  DataCapabilityProviderLoader,
  DataCapabilityRegistry,
  DataCapabilityRuntime,
  DataSourceDefinition,
  OperationDefinition,
  OptionSourceDefinition,
  ResolvedCapability,
  ResolvedCapabilityCatalog,
  RuntimeCreateContext,
  ValueEditorDefinition,
} from '../types'
import { createCapabilityError, matchesCapabilityQuery } from '../utils'
import { resolveAvailability } from './availability'
import type {
  CapabilityMountStamp,
  ProviderDefinitionIds,
  ProviderDefinitionKind,
} from './contracts'
import { sameMount } from './contracts'
import { safeDisposeAsync } from './resource-lifecycle'
import { DefaultDataCapabilityRuntime } from './runtime'
import { ScopedCapabilityRegistry } from './scoped-registry'

interface ProviderEntry {
  token: string
  scope: string
  registered: boolean
  generation: number
  loaded: boolean
  module: boolean
  provider?: DataCapabilityProvider
  loader?: DataCapabilityProviderLoader
  loadPromise?: Promise<void>
  disposePromise?: Promise<void>
  override: boolean
  reconcileVersion?: number
}

let providerRegistrationSequence = 0

export class DefaultDataCapabilityRegistry implements DataCapabilityRegistry {
  constructor(private readonly options: { loadModuleProviders?: boolean } = {}) {}
  readonly sources = new ScopedCapabilityRegistry<DataSourceDefinition>(
    () => this.emitChange(),
    (definition, scope) => this.registerDirectDefinition('sources', definition, scope),
    (definition, mount) => this.unregisterDefinition('sources', definition, mount),
  )
  readonly operations = new ScopedCapabilityRegistry<OperationDefinition>(
    () => this.emitChange(),
    (definition, scope) => this.registerDirectDefinition('operations', definition, scope),
    (definition, mount) => this.unregisterDefinition('operations', definition, mount),
  )
  readonly contexts = new ScopedCapabilityRegistry<ContextValueDefinition>(
    () => this.emitChange(),
    (definition, scope) => this.registerDirectDefinition('contexts', definition, scope),
    (definition, mount) => this.unregisterDefinition('contexts', definition, mount),
  )
  readonly valueEditors = new ScopedCapabilityRegistry<ValueEditorDefinition>(
    () => this.emitChange(),
    (definition, scope) => this.registerDirectDefinition('valueEditors', definition, scope),
    (definition, mount) => this.unregisterDefinition('valueEditors', definition, mount),
  )
  readonly optionSources = new ScopedCapabilityRegistry<OptionSourceDefinition>(
    () => this.emitChange(),
    (definition, scope) => this.registerDirectDefinition('optionSources', definition, scope),
    (definition, mount) => this.unregisterDefinition('optionSources', definition, mount),
  )

  private readonly listeners = new Set<() => void>()
  private readonly providerUnregisters = new Map<string, Array<() => void>>()
  private readonly providerDefinitionIds = new Map<string, ProviderDefinitionIds>()
  private readonly providerEntries = new Map<string, ProviderEntry>()
  private readonly moduleProviderTokens = new Set<string>()
  private readonly definitionOwners = new WeakMap<CapabilityDefinitionBase, CapabilityMountStamp>()
  private readonly runtimes = new Set<DefaultDataCapabilityRuntime>()
  private readonly activeMounts = new Set<string>()
  private readonly moduleProviderGenerations = new Map<string, number>()
  private moduleRegistryUnsubscribe?: () => void
  private moduleProviderReconcilePromise?: Promise<void>
  private moduleProviderReconcileDirty = false
  private moduleProviderReconcileVersion = 0
  private readinessDirty = false
  private readinessPromise?: Promise<void>

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
      override: options.override ?? true,
    }
    this.providerEntries.set(token, entry)
    this.readinessDirty = true
    this.emitChange()

    return () => {
      this.disposeProviderEntry(token, true)
      this.emitChange()
    }
  }

  async loadModuleProviders(context: CapabilityContext = {}): Promise<void> {
    if (this.options.loadModuleProviders === false) return
    return this.requestModuleProviderReconcile(context, false)
  }

  async ensureReady(context: CapabilityContext = {}): Promise<void> {
    // Readiness is Registry-owned and shared by all consumers. Individual Runtime cancellation
    // races this promise locally instead of aborting Provider loading for other consumers.
    do {
      let readiness = this.readinessPromise
      if (!readiness) {
        readiness = this.runReadinessLoop(context)
        this.readinessPromise = readiness
        try {
          await readiness
        } finally {
          if (this.readinessPromise === readiness) this.readinessPromise = undefined
        }
      } else {
        await readiness
      }
    } while (this.readinessDirty)
  }

  private async runReadinessLoop(context: CapabilityContext): Promise<void> {
    do {
      this.readinessDirty = false
      // The latest module snapshot must be mounted before manual Providers are loaded.
      await this.loadModuleProviders(context)
      await this.loadRegisteredProviders(context)
    } while (this.readinessDirty)
  }

  private async requestModuleProviderReconcile(
    context: CapabilityContext = {},
    snapshotChanged = false,
  ): Promise<void> {
    if (this.options.loadModuleProviders === false) return
    await this.ensureModuleRegistrySubscription()
    // Catalog readers only ensure that the current snapshot has been reconciled. Only a
    // moduleRegistry change invalidates an in-flight snapshot and requires another round.
    if (snapshotChanged) this.moduleProviderReconcileDirty = true
    if (this.moduleProviderReconcilePromise) return this.moduleProviderReconcilePromise
    this.moduleProviderReconcilePromise = this.runModuleProviderReconcileLoop(context)
      .finally(() => {
        this.moduleProviderReconcilePromise = undefined
        this.emitChange()
      })
    return this.moduleProviderReconcilePromise
  }

  private async ensureModuleRegistrySubscription(): Promise<void> {
    if (this.moduleRegistryUnsubscribe) return
    const { moduleRegistry } = await import('@jetlinks-web-core/utils/module-registry')
    if (this.moduleRegistryUnsubscribe) return
    this.moduleRegistryUnsubscribe = moduleRegistry.onChange(() => {
      this.readinessDirty = true
      this.requestModuleProviderReconcile({}, true).catch((error) => {
        console.warn('[DataCapability] module provider refresh failed', error)
      })
    })
  }

  private async runModuleProviderReconcileLoop(context: CapabilityContext): Promise<void> {
    const { moduleRegistry } = await import('@jetlinks-web-core/utils/module-registry')
    do {
      this.moduleProviderReconcileDirty = false
      const reconcileVersion = ++this.moduleProviderReconcileVersion
      await this.reconcileModuleProviderSnapshot(moduleRegistry.getAllModules(), context, reconcileVersion)
    } while (this.moduleProviderReconcileDirty)
  }

  private async reconcileModuleProviderSnapshot(
    modules: Map<string, { dataCapabilityProviders?: unknown }>,
    _context: CapabilityContext,
    reconcileVersion: number,
  ): Promise<void> {
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
      if (!entry || entry.loader !== item.loader) {
        if (entry) this.disposeProviderEntry(item.key, true)
        entry = {
          token: item.key,
          loader: item.loader,
          scope: `provider:${item.key}`,
          registered: true,
          generation: this.nextModuleProviderGeneration(item.key),
          loaded: false,
          module: true,
          override: true,
          reconcileVersion,
        }
        this.providerEntries.set(item.key, entry)
        this.moduleProviderTokens.add(item.key)
      } else {
        entry.registered = true
        entry.reconcileVersion = reconcileVersion
      }
      try {
        await this.ensureProviderLoaded(entry, () => (
          this.moduleProviderReconcileDirty || entry?.reconcileVersion !== this.moduleProviderReconcileVersion
        ))
      } catch (error) {
        console.warn(`[DataCapability] provider loader failed: ${item.key}`, error)
      }
    }
  }

  private nextModuleProviderGeneration(token: string): number {
    const next = (this.moduleProviderGenerations.get(token) || 0) + 1
    this.moduleProviderGenerations.set(token, next)
    return next
  }

  async resolveCatalog(context: CapabilityContext, query?: CapabilityQuery): Promise<ResolvedCapabilityCatalog> {
    await this.ensureReady(context)
    return {
      sources: await this.resolveDefinitions('sources', this.sources.list(), context, query, definition => (
        !query?.sourceModes?.length || query.sourceModes.some(mode => definition.modes.includes(mode))
      )),
      operations: await this.resolveDefinitions('operations', this.operations.list(), context, query, definition => (
        !query?.operationActions?.length || query.operationActions.includes(definition.action)
      )),
      contexts: await this.resolveDefinitions('contexts', this.contexts.list(), context, query),
      valueEditors: await this.resolveDefinitions('valueEditors', this.valueEditors.list(), context, query),
      optionSources: await this.resolveDefinitions('optionSources', this.optionSources.list(), context, query),
    }
  }

  private async loadRegisteredProviders(_context: CapabilityContext): Promise<void> {
    for (const entry of this.providerEntries.values()) {
      if (entry.module || !entry.registered) continue
      try {
        await this.ensureProviderLoaded(entry)
      } catch (error) {
        console.warn(`[DataCapability] provider loader failed: ${entry.token}`, error)
      }
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

  private async ensureProviderLoaded(entry: ProviderEntry, isStale?: () => boolean): Promise<void> {
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
          if (providerCreatedAfterUnregister) await this.disposeProvider(entry, `provider:${entry.token}:late`)
          this.assertProviderEntryCurrent(entry, generation)
        }
        if (isStale?.()) {
          this.disposeProviderEntry(entry.token, true)
          throw createCapabilityError('provider.unregistered', 'Provider snapshot is stale', {
            details: { token: entry.token },
          })
        }
        let result: DataCapabilityProviderLoadedResult | undefined
        try {
          result = await provider.load?.()
        } catch (error) {
          if (!this.isProviderEntryCurrent(entry, generation)) {
            await this.disposeProvider(entry, `provider:${entry.token}:late-load`)
          }
          throw error
        }
        if (isStale?.()) {
          if (this.providerEntries.get(entry.token) === entry) {
            this.disposeProviderEntry(entry.token, true)
          } else {
            await this.disposeProvider(entry, `provider:${entry.token}:late-load`)
          }
          throw createCapabilityError('provider.unregistered', 'Provider snapshot is stale', {
            details: { token: entry.token },
          })
        }
        if (!this.isProviderEntryCurrent(entry, generation)) {
          // unregister() may have disposed the Provider before load() created its final resources.
          await this.disposeProvider(entry, `provider:${entry.token}:late-load`)
        }
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
    this.readinessDirty = true
    this.moduleProviderTokens.delete(token)
    const unregisters = this.providerUnregisters.get(token) || []
    unregisters.splice(0).forEach(unregister => unregister())
    this.providerUnregisters.delete(token)
    this.providerDefinitionIds.delete(token)
    if (disposeProvider) {
      void this.disposeProvider(entry, `provider:${token}`)
    }
  }

  private disposeProvider(entry: ProviderEntry, label: string): Promise<void> {
    const dispose = () => safeDisposeAsync(entry.provider, label)
    // A late load pass must run after an in-flight unregister disposal, never concurrently with it.
    const current = entry.disposePromise ? entry.disposePromise.then(dispose) : dispose()
    entry.disposePromise = current
    return current
  }

  private registerLoadedDefinitions(
    entry: ProviderEntry,
    result: DataCapabilityProviderLoadedResult | undefined,
    unregisters: Array<() => void>,
  ) {
    const mount: CapabilityMountStamp = {
      token: entry.token,
      generation: entry.generation,
      mountId: `${entry.token}:${entry.generation}:${providerRegistrationSequence++}`,
    }
    const ids: ProviderDefinitionIds = {
      mount,
      sources: new Set(),
      operations: new Set(),
      contexts: new Set(),
      valueEditors: new Set(),
      optionSources: new Set(),
    }
    const ownedDefinitions: CapabilityDefinitionBase[] = []
    try {
      result?.sources?.forEach((definition) => {
        ids.sources.add(definition.id)
        this.definitionOwners.set(definition, mount)
        ownedDefinitions.push(definition)
        unregisters.push(this.sources.register(definition, { scope: entry.scope, override: entry.override }))
      })
      result?.operations?.forEach((definition) => {
        ids.operations.add(definition.id)
        this.definitionOwners.set(definition, mount)
        ownedDefinitions.push(definition)
        unregisters.push(this.operations.register(definition, { scope: entry.scope, override: entry.override }))
      })
      result?.contexts?.forEach((definition) => {
        ids.contexts.add(definition.id)
        this.definitionOwners.set(definition, mount)
        ownedDefinitions.push(definition)
        unregisters.push(this.contexts.register(definition, { scope: entry.scope, override: entry.override }))
      })
      result?.valueEditors?.forEach((definition) => {
        ids.valueEditors.add(definition.id)
        this.definitionOwners.set(definition, mount)
        ownedDefinitions.push(definition)
        unregisters.push(this.valueEditors.register(definition, { scope: entry.scope, override: entry.override }))
      })
      result?.optionSources?.forEach((definition) => {
        ids.optionSources.add(definition.id)
        this.definitionOwners.set(definition, mount)
        ownedDefinitions.push(definition)
        unregisters.push(this.optionSources.register(definition, { scope: entry.scope, override: entry.override }))
      })
      this.providerDefinitionIds.set(entry.token, ids)
    } catch (error) {
      unregisters.splice(0).reverse().forEach(unregister => unregister())
      ownedDefinitions.forEach(definition => this.definitionOwners.delete(definition))
      this.providerDefinitionIds.delete(entry.token)
      throw error
    }
  }


  private registerDirectDefinition<T extends CapabilityDefinitionBase>(
    kind: ProviderDefinitionKind,
    definition: T,
    scope: string,
  ): CapabilityMountStamp | undefined {
    const existed = this.definitionOwners.get(definition)
    const token = existed?.token || `direct:${kind}:${definition.id}:${scope}:${providerRegistrationSequence++}`
    const mount: CapabilityMountStamp = {
      token,
      generation: existed?.generation || 0,
      mountId: `${token}:${providerRegistrationSequence++}`,
    }
    if (!existed) {
      const ids: ProviderDefinitionIds = {
        mount,
        sources: new Set(),
        operations: new Set(),
        contexts: new Set(),
        valueEditors: new Set(),
        optionSources: new Set(),
      }
      ids[kind].add(definition.id)
      this.providerDefinitionIds.set(token, ids)
    } else {
      const ids = this.providerDefinitionIds.get(token)
      if (ids) ids.mount = mount
    }
    this.definitionOwners.set(definition, mount)
    this.activeMounts.add(this.getActiveMountKey(mount, kind, definition.id))
    return mount
  }

  private unregisterDefinition(kind: ProviderDefinitionKind, definition: CapabilityDefinitionBase, mount?: CapabilityMountStamp): void {
    if (!mount) return
    this.activeMounts.delete(this.getActiveMountKey(mount, kind, definition.id))
    const affected: ProviderDefinitionIds = {
      mount,
      sources: new Set(),
      operations: new Set(),
      contexts: new Set(),
      valueEditors: new Set(),
      optionSources: new Set(),
    }
    affected[kind].add(definition.id)
    this.runtimes.forEach(runtime => runtime.disposeProviderCapabilities(affected))
  }

  isMountActive(mount: CapabilityMountStamp | undefined, kind?: ProviderDefinitionKind, capabilityId?: string): boolean {
    if (!mount) return true
    if (kind && capabilityId) return this.activeMounts.has(this.getActiveMountKey(mount, kind, capabilityId))
    return [...this.activeMounts].some(key => key.startsWith(`${mount.mountId}:`))
  }

  private getActiveMountKey(mount: CapabilityMountStamp, kind: ProviderDefinitionKind, capabilityId: string): string {
    return `${mount.mountId}:${kind}:${capabilityId}`
  }

  getDefinitionRegistration(definition: CapabilityDefinitionBase): CapabilityMountStamp | undefined {
    const mount = this.definitionOwners.get(definition)
    return mount && { ...mount }
  }

  private async resolveDefinitions<T extends CapabilityDefinitionBase>(
    kind: ProviderDefinitionKind,
    definitions: T[],
    context: CapabilityContext,
    query?: CapabilityQuery,
    extra?: (definition: T) => boolean,
  ): Promise<Array<ResolvedCapability<T>>> {
    const result: Array<ResolvedCapability<T>> = []
    for (const definition of definitions) {
      if (!matchesCapabilityQuery(definition, query) || (extra && !extra(definition))) continue
      const registration = this.definitionOwners.get(definition)
      const availability = await resolveAvailability(definition, context, 'discover')
      const latestRegistration = this.definitionOwners.get(definition)
      if (registration && (!sameMount(registration, latestRegistration) || !this.isMountActive(registration, kind, definition.id))) continue
      if (!query?.includeUnavailable && !availability.discoverable) continue
      result.push({ definition, availability })
    }
    return result.sort((left, right) => (left.definition.order || 0) - (right.definition.order || 0))
  }

  private emitChange(): void {
    this.listeners.forEach(listener => listener())
  }
}
