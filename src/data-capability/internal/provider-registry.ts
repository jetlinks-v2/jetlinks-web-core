import type {
  CapabilityChoiceResult,
  CapabilityContext,
  CapabilityDefinitionBase,
  CapabilityDirectoryDiagnostic,
  CapabilityQuery,
  ContextValueDefinition,
  DataCapabilityProvider,
  DataCapabilityProviderLoadedResult,
  DataCapabilityProviderLoader,
  DataCapabilityProviderManifestEntry,
  DataCapabilityProviderRegisterOptions,
  DataCapabilityRegistry,
  DataCapabilityRegistryOptions,
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
import { projectCapabilityChoices } from './capability-choice'
import type {
  CapabilityMountStamp,
  ProviderDefinitionIds,
  ProviderDefinitionKind,
} from './contracts'
import { sameMount } from './contracts'
import { safeDisposeAsync } from './resource-lifecycle'
import { DefaultDataCapabilityRuntime } from './runtime'
import { ScopedCapabilityRegistry } from './scoped-registry'
import {
  ProviderCapabilityManifestIndex,
  assertCapabilityDefinition,
  assertCapabilityId,
  assertLoadedProviderContract,
  assertProviderIdentity,
  isCapabilityError,
  normalizeCapabilityIds,
  normalizeManifestEntry,
  resolveProviderLoadTimeout,
  sameStringSet,
} from './provider-manifest'

interface ProviderEntry {
  token: string
  sequence: number
  scope: string
  registered: boolean
  generation: number
  loaded: boolean
  module: boolean
  provider?: DataCapabilityProvider
  loader?: DataCapabilityProviderLoader
  moduleId?: string
  capabilityIds?: Set<string>
  loadTimeout: number
  loadPromise?: Promise<void>
  disposePromise?: Promise<void>
  override: boolean
}

let providerRegistrationSequence = 0

export class DefaultDataCapabilityRegistry implements DataCapabilityRegistry {
  constructor(private readonly options: DataCapabilityRegistryOptions = {}) {}
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
  private readonly providerManifestIndex = new ProviderCapabilityManifestIndex()
  private readonly effectiveCapabilityKinds = new Map<string, { kind: ProviderDefinitionKind; mountId: string }>()
  private readonly readinessPromises = new Map<string, Promise<CapabilityDirectoryDiagnostic[]>>()
  private moduleRegistryUnsubscribe?: () => void
  private moduleProviderReconcilePromise?: Promise<void>
  private moduleProviderReconcileDirty = false

  registerProvider(provider: DataCapabilityProvider, options: DataCapabilityProviderRegisterOptions = {}): () => void {
    assertProviderIdentity(provider)
    const capabilityIds = normalizeCapabilityIds(provider.capabilityIds)
    this.providerManifestIndex.assertAvailable(capabilityIds, options.override === true)
    const sequence = providerRegistrationSequence++
    const token = `manual:${provider.id}:${options.scope || 'default'}:${sequence}`
    const entry: ProviderEntry = {
      token,
      sequence,
      provider,
      scope: options.scope || `provider:${token}`,
      registered: true,
      generation: 0,
      loaded: false,
      module: false,
      override: options.override ?? false,
      capabilityIds,
      loadTimeout: resolveProviderLoadTimeout(options.timeout, this.options.providerLoadTimeout),
    }
    this.providerEntries.set(token, entry)
    this.rebuildCapabilityProviderIndex()
    this.emitChange()

    return () => {
      this.disposeProviderEntry(token, true)
      this.emitChange()
    }
  }

  async loadModuleProviders(_context: CapabilityContext = {}): Promise<void> {
    if (this.options.loadModuleProviders === false) return
    return this.requestModuleProviderReconcile(false)
  }

  async loadCapability(capabilityId: string, context: CapabilityContext = {}): Promise<void> {
    assertCapabilityId(capabilityId)
    await this.ensureReady(context, capabilityId)
  }

  async ensureReady(context: CapabilityContext = {}, capabilityId?: string): Promise<void> {
    await this.resolveReadiness(context, capabilityId)
  }

  private async resolveReadiness(
    context: CapabilityContext = {},
    capabilityId?: string,
  ): Promise<CapabilityDirectoryDiagnostic[]> {
    const key = capabilityId || '*'
    let readiness = this.readinessPromises.get(key)
    if (!readiness) {
      readiness = this.runReadiness(context, capabilityId)
        .finally(() => this.readinessPromises.delete(key))
      this.readinessPromises.set(key, readiness)
    }
    return readiness
  }

  private async runReadiness(
    context: CapabilityContext,
    capabilityId?: string,
  ): Promise<CapabilityDirectoryDiagnostic[]> {
    // Reconcile only builds the manifest index. Provider code is loaded below, per target ID.
    await this.loadModuleProviders(context)
    if (capabilityId) {
      const conflict = this.providerManifestIndex.getConflict(capabilityId)
      if (conflict) throw conflict
      const entries = this.getProviderEntries(capabilityId)
      if (!entries.length) return []
      const expectedEntry = entries[entries.length - 1]
      if (this.getRegisteredCapabilityToken(capabilityId) === expectedEntry.token) return []
      let firstError: unknown
      for (const entry of entries) {
        try {
          await this.ensureProviderLoadedWithinTimeout(entry)
        } catch (error) {
          firstError ||= error
        }
      }
      if (this.getRegisteredCapabilityToken(capabilityId) !== expectedEntry.token && firstError) throw firstError
      return []
    }

    const diagnostics: CapabilityDirectoryDiagnostic[] = this.providerManifestIndex
      .getConflictedCapabilityIds()
      .map(capabilityId => ({
        code: 'capability.id_conflict',
        message: 'Some data capabilities are unavailable because their IDs conflict',
        capabilityIds: [capabilityId],
        retryable: false,
      }))
    const conflictedTokens = this.providerManifestIndex.getConflictedTokens()
    const entries = [...this.providerEntries.values()]
      .filter(entry => entry.registered && !conflictedTokens.has(entry.token))
      .sort((left, right) => left.sequence - right.sequence)
    const baseEntries = entries.filter(entry => !entry.override)
    const results = await Promise.allSettled(baseEntries.map(entry => this.ensureProviderLoadedWithinTimeout(entry)))
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`[DataCapability] provider loader failed: ${baseEntries[index].token}`, result.reason)
        diagnostics.push(this.createProviderDiagnostic(baseEntries[index], result.reason))
      }
    })
    // Explicit overrides mount after every default entry so catalog loading cannot make stack order race-dependent.
    for (const entry of entries.filter(item => item.override)) {
      try {
        await this.ensureProviderLoadedWithinTimeout(entry)
      } catch (error) {
        console.warn(`[DataCapability] provider loader failed: ${entry.token}`, error)
        diagnostics.push(this.createProviderDiagnostic(entry, error))
      }
    }
    return diagnostics
  }

  private async requestModuleProviderReconcile(
    snapshotChanged = false,
  ): Promise<void> {
    if (this.options.loadModuleProviders === false) return
    await this.ensureModuleRegistrySubscription()
    // Catalog readers only ensure that the current snapshot has been reconciled. Only a
    // moduleRegistry change invalidates an in-flight snapshot and requires another round.
    if (snapshotChanged) this.moduleProviderReconcileDirty = true
    if (this.moduleProviderReconcilePromise) return this.moduleProviderReconcilePromise
    this.moduleProviderReconcilePromise = this.runModuleProviderReconcileLoop()
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
      this.requestModuleProviderReconcile(true).catch((error) => {
        console.warn('[DataCapability] module provider refresh failed', error)
      })
    })
  }

  private async runModuleProviderReconcileLoop(): Promise<void> {
    const { moduleRegistry } = await import('@jetlinks-web-core/utils/module-registry')
    do {
      this.moduleProviderReconcileDirty = false
      await this.reconcileModuleProviderSnapshot(moduleRegistry.getAllModules())
    } while (this.moduleProviderReconcileDirty)
  }

  private async reconcileModuleProviderSnapshot(
    modules: Map<string, { dataCapabilityProviders?: Record<string, DataCapabilityProviderManifestEntry> }>,
  ): Promise<void> {
    const manifests: Array<{
      token: string
      key: string
      moduleId: string
      entry: DataCapabilityProviderManifestEntry
      capabilityIds: Set<string>
    }> = []
    modules.forEach((resource, moduleId) => {
      const providers = resource.dataCapabilityProviders
      if (providers && typeof providers === 'object') {
        Object.entries(providers).forEach(([key, manifest]) => {
          try {
            const entry = normalizeManifestEntry(manifest, moduleId, key)
            manifests.push({
              token: `${moduleId}:${key}`,
              key,
              moduleId,
              entry,
              capabilityIds: normalizeCapabilityIds(entry.capabilityIds)!,
            })
          } catch (error) {
            console.warn(`[DataCapability] invalid provider manifest: ${moduleId}:${key}`, error)
          }
        })
      }
    })

    const activeModuleTokens = new Set(manifests.map(item => item.token))
    for (const token of [...this.moduleProviderTokens]) {
      if (!activeModuleTokens.has(token)) {
        this.disposeProviderEntry(token, true)
      }
    }

    for (const item of manifests) {
      let entry = this.providerEntries.get(item.token)
      const loadTimeout = resolveProviderLoadTimeout(item.entry.timeout, this.options.providerLoadTimeout)
      if (!entry
        || entry.loader !== item.entry.loader
        || entry.loadTimeout !== loadTimeout
        || !sameStringSet(entry.capabilityIds, item.capabilityIds)) {
        if (entry) this.disposeProviderEntry(item.token, true)
        entry = {
          token: item.token,
          sequence: providerRegistrationSequence++,
          loader: item.entry.loader,
          scope: `provider:${item.token}`,
          registered: true,
          generation: this.nextModuleProviderGeneration(item.token),
          loaded: false,
          module: true,
          moduleId: item.moduleId,
          capabilityIds: item.capabilityIds,
          loadTimeout,
          override: false,
        }
        this.providerEntries.set(item.token, entry)
        this.moduleProviderTokens.add(item.token)
      } else {
        entry.registered = true
      }
    }
    this.rebuildCapabilityProviderIndex()
  }

  private nextModuleProviderGeneration(token: string): number {
    const next = (this.moduleProviderGenerations.get(token) || 0) + 1
    this.moduleProviderGenerations.set(token, next)
    return next
  }

  async resolveCatalog(context: CapabilityContext, query?: CapabilityQuery): Promise<ResolvedCapabilityCatalog> {
    await this.resolveReadiness(context)
    return this.resolveLoadedCatalog(context, query)
  }

  async resolveCapabilityChoices(
    context: CapabilityContext,
    query?: CapabilityQuery,
  ): Promise<CapabilityChoiceResult> {
    const readinessDiagnostics = await this.resolveReadiness(context)
    const catalog = await this.resolveLoadedCatalog(context, query)
    const projected = await projectCapabilityChoices(catalog, context)
    const diagnostics = [...readinessDiagnostics, ...projected.diagnostics]
    return {
      items: projected.items,
      partial: diagnostics.length > 0,
      diagnostics,
    }
  }

  private async resolveLoadedCatalog(
    context: CapabilityContext,
    query?: CapabilityQuery,
  ): Promise<ResolvedCapabilityCatalog> {
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
          provider = typeof loaded === 'object' && loaded !== null && 'default' in loaded
            ? loaded.default
            : loaded as DataCapabilityProvider
          providerCreatedAfterUnregister = !this.isProviderEntryCurrent(entry, generation)
          entry.provider = provider
        }
        if (!provider) return
        assertProviderIdentity(provider, entry.moduleId)
        if (!this.isProviderEntryCurrent(entry, generation)) {
          if (providerCreatedAfterUnregister) await this.disposeProvider(entry, `provider:${entry.token}:late`)
          this.assertProviderEntryCurrent(entry, generation)
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
        if (!this.isProviderEntryCurrent(entry, generation)) {
          // unregister() may have disposed the Provider before load() created its final resources.
          await this.disposeProvider(entry, `provider:${entry.token}:late-load`)
        }
        this.assertProviderEntryCurrent(entry, generation)
        const unregisters: Array<() => void> = []
        this.registerLoadedDefinitions(entry, provider, result, unregisters)
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

  private async ensureProviderLoadedWithinTimeout(entry: ProviderEntry): Promise<void> {
    if (!entry.registered || entry.loaded) return
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        const error = createCapabilityError('provider.load_timeout', 'Provider loading timed out', {
          retryable: true,
          details: { token: entry.token, timeout: entry.loadTimeout },
        })
        if (this.providerEntries.get(entry.token) === entry) {
          this.disposeProviderEntry(entry.token, true)
        }
        reject(error)
      }, entry.loadTimeout)
    })
    try {
      await Promise.race([this.ensureProviderLoaded(entry), timeout])
    } catch (error) {
      if (this.providerEntries.get(entry.token) === entry) {
        this.invalidateFailedProviderEntry(entry)
      }
      if (isCapabilityError(error)) throw error
      throw createCapabilityError('provider.load_failed', 'Provider loading failed', {
        retryable: true,
        cause: error,
        details: { token: entry.token },
      })
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  private invalidateFailedProviderEntry(entry: ProviderEntry): void {
    if (entry.module && entry.loader) {
      entry.loaded = false
      entry.generation += 1
      entry.loadPromise = undefined
      void this.disposeProvider(entry, `provider:${entry.token}:failed`)
      entry.provider = undefined
      return
    }
    this.disposeProviderEntry(entry.token, true)
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
    const unregisters = this.providerUnregisters.get(token) || []
    unregisters.splice(0).forEach(unregister => unregister())
    this.providerUnregisters.delete(token)
    this.providerDefinitionIds.delete(token)
    if (disposeProvider) {
      void this.disposeProvider(entry, `provider:${token}`)
    }
    this.rebuildCapabilityProviderIndex()
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
    provider: DataCapabilityProvider,
    result: DataCapabilityProviderLoadedResult | undefined,
    unregisters: Array<() => void>,
  ) {
    assertLoadedProviderContract(entry, provider, result)
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
    assertCapabilityDefinition(definition)
    const effective = this.effectiveCapabilityKinds.get(definition.id)
    if (effective && effective.kind !== kind) {
      throw createCapabilityError('capability.id_conflict', 'Capability ID is already registered for another kind', {
        capabilityId: definition.id,
        details: { registeredKind: effective.kind, incomingKind: kind },
      })
    }
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
    this.effectiveCapabilityKinds.set(definition.id, { kind, mountId: mount.mountId })
    return mount
  }

  private unregisterDefinition(kind: ProviderDefinitionKind, definition: CapabilityDefinitionBase, mount?: CapabilityMountStamp): void {
    if (!mount) return
    this.activeMounts.delete(this.getActiveMountKey(mount, kind, definition.id))
    if (this.effectiveCapabilityKinds.get(definition.id)?.mountId === mount.mountId) {
      this.effectiveCapabilityKinds.delete(definition.id)
    }
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

  private getRegisteredCapabilityToken(capabilityId: string): string | undefined {
    const definition = this.sources.get(capabilityId)
      || this.operations.get(capabilityId)
      || this.contexts.get(capabilityId)
      || this.valueEditors.get(capabilityId)
      || this.optionSources.get(capabilityId)
    return definition ? this.definitionOwners.get(definition)?.token : undefined
  }

  private getProviderEntries(capabilityId: string): ProviderEntry[] {
    return this.providerManifestIndex.getTokens(capabilityId)
      .map(token => this.providerEntries.get(token))
      .filter((entry): entry is ProviderEntry => !!entry?.registered)
      .sort((left, right) => left.sequence - right.sequence)
  }

  private rebuildCapabilityProviderIndex(): void {
    this.providerManifestIndex.rebuild(this.providerEntries.values())
  }

  private createProviderDiagnostic(entry: ProviderEntry, error: unknown): CapabilityDirectoryDiagnostic {
    const capabilityError = isCapabilityError(error) ? error : undefined
    const timedOut = capabilityError?.code === 'provider.load_timeout'
    const ordinaryLoadFailure = capabilityError?.code === 'provider.load_failed'
    return {
      code: timedOut ? 'provider.load_timeout' : 'provider.load_failed',
      message: timedOut
        ? 'Some data capabilities could not be loaded before the Provider timeout'
        : 'Some data capabilities could not be loaded',
      capabilityIds: [...(entry.capabilityIds || [])].sort(),
      retryable: timedOut || ordinaryLoadFailure ? capabilityError?.retryable ?? true : false,
    }
  }
}
