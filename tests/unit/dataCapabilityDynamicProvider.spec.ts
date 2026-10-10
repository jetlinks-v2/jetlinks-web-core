import assert from 'node:assert/strict'
import { of } from 'rxjs'
import type { CapabilityContext, DataCapabilityProvider, DataCapabilityRequest, DataSourceDefinition } from '../../src/data-capability/types'

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
const { DefaultDataCapabilityRegistry } = await import('../../src/data-capability/registry')
const registry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const namespace = 'test.dynamic'
const id = `${namespace}.saved-query`
const createRequest = (): DataCapabilityRequest => ({
  async get() { throw new Error('No HTTP call expected') },
  async post() { throw new Error('No HTTP call expected') },
})
const requestA = createRequest(), requestB = createRequest()
const resolvedContexts: CapabilityContext[] = []
let discoveries = 0, created = 0, disposed = 0
const definition = (context: CapabilityContext, overrides: Partial<DataSourceDefinition> = {}): DataSourceDefinition => ({
  id, kind: 'data-source', version: 1, name: 'Saved query',
  owner: { moduleId: 'test-module', providerId: 'dynamic-provider' }, modes: ['snapshot'],
  create: () => {
    created++
    return { query<T>() { return of({ data: context.request as T }) }, dispose() { disposed++ } }
  },
  ...overrides,
})
const provider: DataCapabilityProvider = {
  id: 'dynamic-provider', owner: { moduleId: 'test-module', providerId: 'dynamic-provider' },
  load: () => ({}),
  dynamicSources: {
    namespace,
    discover: async context => { discoveries++; return { sources: [definition(context)] } },
    resolve: async (sourceId, context) => {
      resolvedContexts.push(context)
      return sourceId === id ? definition(context) : undefined
    },
  },
}
const unregister = registry.registerProvider(provider)
const first = registry.createRuntime({ runtimeId: 'first', request: requestA })
const second = registry.createRuntime({ runtimeId: 'second', request: requestB })
const binding = { version: 1 as const, source: { capabilityId: id, version: 1 } }

// Restore saved IDs directly, without management discovery or cross-caller definition caching.
const results = await Promise.all([first.query(binding), second.query(binding)])
assert.equal(results[0].data, requestA)
assert.equal(results[1].data, requestB)
assert.equal(discoveries, 0)
assert.deepEqual(resolvedContexts.map(context => context.request), [requestA, requestB])
assert.equal(registry.sources.get(id), undefined)
const catalog = await registry.resolveCapabilityChoices({ request: requestA }, { ids: [id] })
assert.equal(catalog.items.length, 1)
assert.equal(discoveries, 0)

// A retired saved ID is not replaced with a different query.
await assert.rejects(first.query({ ...binding, source: { ...binding.source, capabilityId: `${namespace}.removed` } }))

// Execution availability is checked before constructing any source instance.
const restricted = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
restricted.registerProvider({ ...provider, dynamicSources: {
  ...provider.dynamicSources!,
  resolve: async (_id, context) => definition(context, {
    availability: () => ({ discoverable: true, configurable: false, executable: false, reason: 'disabled' }),
  }),
} })
const restrictedRuntime = restricted.createRuntime({ runtimeId: 'restricted' })
const beforeCreated = created
await assert.rejects(restrictedRuntime.query(binding), { code: 'capability.unavailable' })
assert.equal(created, beforeCreated)
await restrictedRuntime.dispose()

// Namespace conflicts fail closed instead of selecting the last mounted provider.
const conflicting = registry.registerProvider({ ...provider, id: 'another-provider', owner: { moduleId: 'other', providerId: 'another-provider' } })
await assert.rejects(first.query(binding), { code: 'capability.id_conflict' })
conflicting()

// Unregistration invalidates in-flight dynamic metadata and releases existing instances.
let finishResolve: ((value: DataSourceDefinition) => void) | undefined
provider.dynamicSources!.resolve = async (_id, context) => new Promise(resolve => {
  finishResolve = () => resolve(definition(context))
})
const pending = registry.resolveCapabilityChoices({ request: requestA }, { ids: [id] })
while (!finishResolve) await new Promise(resolve => setTimeout(resolve, 0))
unregister()
finishResolve(definition({ request: requestA }))
const removedCatalog = await pending
assert.equal(removedCatalog.items.length, 0)
assert.ok(removedCatalog.diagnostics.length)
await first.dispose()
await second.dispose()
assert.equal(disposed, 2)
console.log('dataCapabilityDynamicProvider: identity, saved-ID restore, availability, conflict and disposal passed')
