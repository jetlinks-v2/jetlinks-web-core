import assert from 'node:assert/strict'
import { Observable, of } from 'rxjs'

import type {
  DataCapabilityProvider,
  DataConnectionEvent,
  DataSourceDefinition,
  DataSourceResult,
  OperationDefinition,
} from '../../src/data-capability/types'

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })

const [{ DefaultDataCapabilityRegistry }, { moduleRegistry }] = await Promise.all([
  import('../../src/data-capability/registry'),
  import('../../src/utils/module-registry'),
])

const wait = () => new Promise(resolve => setTimeout(resolve, 0))
const healthyModuleId = 'unit-data-capability-module'
const slowModuleId = 'unit-data-capability-slow-module'
const disposedProviders: string[] = []

const createProvider = (
  moduleId: string,
  providerId: string,
  sourceId: string,
  data: unknown = sourceId,
): DataCapabilityProvider => {
  const source: DataSourceDefinition = {
    id: sourceId,
    kind: 'data-source',
    version: 1,
    name: sourceId,
    owner: { moduleId, providerId },
    modes: ['snapshot'],
    create: () => ({
      query<T = unknown>() {
        return of<DataSourceResult<T>>({ data: data as T })
      },
    }),
  }
  return {
    id: providerId,
    owner: { moduleId, providerId },
    load: () => ({ sources: [source] }),
    dispose: () => { disposedProviders.push(providerId) },
  }
}

moduleRegistry.clear()
const registry = new DefaultDataCapabilityRegistry({ providerLoadTimeout: 20 })

try {
  let slowLoaderCount = 0
  moduleRegistry.registerResource(slowModuleId, 'dataCapabilityProviders', {
    slow: {
      capabilityIds: ['test.source.module-slow'],
      loader: async () => {
        slowLoaderCount += 1
        await new Promise(() => undefined)
        return createProvider(slowModuleId, 'module-provider-slow', 'test.source.module-slow')
      },
    },
  })

  let healthyLoaderCount = 0
  moduleRegistry.registerResource(healthyModuleId, 'dataCapabilityProviders', {
    projectList: {
      capabilityIds: ['test.source.module-v1'],
      loader: async () => {
        healthyLoaderCount += 1
        await wait()
        return createProvider(healthyModuleId, 'module-provider-v1', 'test.source.module-v1')
      },
    },
  })

  const runtime = registry.createRuntime({ runtimeId: 'module-precise-readiness' })
  const healthyQueries = [
    runtime.query<string>({
      version: 1,
      source: { capabilityId: 'test.source.module-v1', version: 1 },
    }),
    runtime.query<string>({
      version: 1,
      source: { capabilityId: 'test.source.module-v1', version: 1 },
    }),
  ]
  assert.deepEqual((await Promise.all(healthyQueries)).map(result => result.data), [
    'test.source.module-v1',
    'test.source.module-v1',
  ])
  assert.equal(healthyLoaderCount, 1)
  assert.equal(slowLoaderCount, 0)

  await assert.rejects(
    () => runtime.query({
      version: 1,
      source: { capabilityId: 'test.source.module-slow', version: 1 },
    }),
    (error: any) => error?.code === 'provider.load_timeout',
  )
  assert.equal(slowLoaderCount, 1)
  await runtime.dispose()

  const partialChoices = await registry.resolveCapabilityChoices({})
  assert.equal(partialChoices.partial, true)
  assert.equal(partialChoices.items.some(item => item.value === 'test.source.module-v1'), true)
  assert.deepEqual(
    partialChoices.diagnostics.map(item => ({ code: item.code, capabilityIds: item.capabilityIds })),
    [{ code: 'provider.load_timeout', capabilityIds: ['test.source.module-slow'] }],
  )
  assert.equal(JSON.stringify(partialChoices).includes('unit-data-capability-slow-module:slow'), false)
  assert.equal(JSON.stringify(partialChoices).includes('"loader"'), false)
  assert.equal(slowLoaderCount, 2)

  moduleRegistry.unregister(slowModuleId)
  moduleRegistry.register(healthyModuleId, {
    dataCapabilityProviders: {
      projectList: {
        capabilityIds: ['test.source.module-v2'],
        loader: async () => createProvider(
          healthyModuleId,
          'module-provider-v2',
          'test.source.module-v2',
        ),
      },
    },
  }, { override: true })
  await registry.loadModuleProviders({})
  await wait()
  assert.deepEqual(
    (await registry.resolveCatalog({})).sources.map(source => source.definition.id),
    ['test.source.module-v2'],
  )
  assert.deepEqual(disposedProviders, ['module-provider-v1'])

  const mismatchModuleId = 'unit-data-capability-manifest-mismatch'
  moduleRegistry.registerResource(mismatchModuleId, 'dataCapabilityProviders', {
    mismatch: {
      capabilityIds: ['test.source.manifest-declared'],
      loader: async () => createProvider(
        mismatchModuleId,
        'module-provider-mismatch',
        'test.source.manifest-loaded',
      ),
    },
  })
  await assert.rejects(
    () => registry.loadCapability('test.source.manifest-declared'),
    (error: any) => error?.code === 'provider.manifest_mismatch',
  )
  moduleRegistry.unregister(mismatchModuleId)

  const ownerModuleId = 'unit-data-capability-owner'
  moduleRegistry.registerResource(ownerModuleId, 'dataCapabilityProviders', {
    ownerMismatch: {
      capabilityIds: ['test.source.owner-mismatch'],
      loader: async () => createProvider(
        'another-module',
        'module-provider-owner-mismatch',
        'test.source.owner-mismatch',
      ),
    },
  })
  await assert.rejects(
    () => registry.loadCapability('test.source.owner-mismatch'),
    (error: any) => error?.code === 'provider.owner_mismatch',
  )
  moduleRegistry.unregister(ownerModuleId)

  const conflictModuleId = 'unit-data-capability-conflict'
  let conflictLoaderCount = 0
  moduleRegistry.registerResource(conflictModuleId, 'dataCapabilityProviders', {
    first: {
      capabilityIds: ['test.source.module-conflict'],
      loader: async () => {
        conflictLoaderCount += 1
        return createProvider(conflictModuleId, 'module-provider-conflict-a', 'test.source.module-conflict')
      },
    },
    second: {
      capabilityIds: ['test.source.module-conflict'],
      loader: async () => {
        conflictLoaderCount += 1
        return createProvider(conflictModuleId, 'module-provider-conflict-b', 'test.source.module-conflict')
      },
    },
  })
  await assert.rejects(
    () => registry.loadCapability('test.source.module-conflict'),
    (error: any) => error?.code === 'capability.id_conflict',
  )
  assert.equal(conflictLoaderCount, 0)
  const conflictChoices = await registry.resolveCapabilityChoices({})
  assert.equal(conflictChoices.partial, true)
  assert.equal(conflictChoices.items.some(item => item.value === 'test.source.module-conflict'), false)
  assert.deepEqual(
    conflictChoices.diagnostics.filter(item => item.code === 'capability.id_conflict').map(item => item.capabilityIds),
    [['test.source.module-conflict']],
  )
  assert.equal(conflictLoaderCount, 0)
  moduleRegistry.unregister(conflictModuleId)

  const lifecycleModuleId = 'unit-data-capability-lifecycle'
  const lifecycleProviderId = 'module-provider-lifecycle'
  const lifecycleSourceId = 'test.source.module-lifecycle'
  const lifecycleOperationId = 'test.operation.module-lifecycle'
  let lifecycleProviderDispose = 0
  let lifecycleSourceDispose = 0
  const lifecycleSource: DataSourceDefinition = {
    id: lifecycleSourceId,
    kind: 'data-source',
    version: 1,
    name: lifecycleSourceId,
    owner: { moduleId: lifecycleModuleId, providerId: lifecycleProviderId },
    modes: ['stream'],
    create: () => ({
      query: () => new Observable(() => () => undefined),
      dispose() { lifecycleSourceDispose += 1 },
    }),
  }
  const lifecycleOperation: OperationDefinition = {
    id: lifecycleOperationId,
    kind: 'operation',
    version: 1,
    name: lifecycleOperationId,
    owner: { moduleId: lifecycleModuleId, providerId: lifecycleProviderId },
    action: 'invoke',
    policy: {
      risk: 'low',
      confirmation: 'none',
      idempotency: 'none',
      cancellation: 'before-dispatch',
      retry: 'never',
      concurrency: 'serial',
    },
    create: () => ({ execute: () => of({ type: 'completed' }) }),
  }
  const lifecycleProvider: DataCapabilityProvider = {
    id: lifecycleProviderId,
    owner: { moduleId: lifecycleModuleId, providerId: lifecycleProviderId },
    load: () => ({ sources: [lifecycleSource], operations: [lifecycleOperation] }),
    dispose() { lifecycleProviderDispose += 1 },
  }
  moduleRegistry.registerResource(lifecycleModuleId, 'dataCapabilityProviders', {
    lifecycle: {
      capabilityIds: [lifecycleSourceId, lifecycleOperationId],
      loader: async () => lifecycleProvider,
    },
  })
  const lifecycleRuntime = registry.createRuntime({ runtimeId: 'module-unload-lifecycle' })
  const lifecycleEvents: DataConnectionEvent[] = []
  lifecycleRuntime.connect({
    consumerId: 'module-unload-lifecycle',
    binding: { version: 1, source: { capabilityId: lifecycleSourceId, version: 1 } },
  }).events$.subscribe(event => lifecycleEvents.push(event))
  const prepared = await lifecycleRuntime.prepareOperation({
    version: 1,
    operation: { capabilityId: lifecycleOperationId, version: 1 },
  })
  assert.deepEqual(
    (await registry.resolveCapabilityChoices({})).items
      .filter(item => item.value === lifecycleSourceId || item.value === lifecycleOperationId)
      .map(item => item.value),
    [lifecycleSourceId, lifecycleOperationId],
  )
  await wait()
  moduleRegistry.handleModuleUnload(lifecycleModuleId)
  await registry.loadModuleProviders({})
  await wait()
  assert.equal(lifecycleEvents.some(event => event.type === 'status' && event.status === 'unavailable'), true)
  assert.throws(
    () => lifecycleRuntime.executeOperation(prepared),
    (error: any) => error?.code === 'operation.not_prepared',
  )
  assert.equal(lifecycleSourceDispose, 1)
  assert.equal(lifecycleProviderDispose, 1)
  assert.equal((await registry.resolveCatalog({})).sources.some(item => item.definition.id === lifecycleSourceId), false)
  assert.equal(
    (await registry.resolveCapabilityChoices({})).items.some(item => item.value === lifecycleSourceId),
    false,
  )
  await lifecycleRuntime.dispose()
} finally {
  moduleRegistry.clear()
  await registry.loadModuleProviders({})
}

console.log('data capability module registry tests passed')
