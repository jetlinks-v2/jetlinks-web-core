import assert from 'node:assert/strict'
import { of } from 'rxjs'

import type {
  DataCapabilityProvider,
  DataSourceDefinition,
  DataSourceResult,
} from '../../src/data-capability/types'

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })

const [{ DefaultDataCapabilityRegistry }, { moduleRegistry }] = await Promise.all([
  import('../../src/data-capability/registry'),
  import('../../src/utils/module-registry'),
])

const wait = () => new Promise(resolve => setTimeout(resolve, 0))
const moduleId = 'unit-data-capability-module'
const providerKey = 'unit-provider'
const disposedProviders: string[] = []

const createProvider = (providerId: string, sourceId: string): DataCapabilityProvider => {
  const source: DataSourceDefinition = {
    id: sourceId,
    kind: 'data-source',
    version: 1,
    name: sourceId,
    owner: { moduleId, providerId },
    modes: ['snapshot'],
    create: () => ({
      query<T = unknown>() {
        return of<DataSourceResult<T>>({ data: sourceId as unknown as T })
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
const registry = new DefaultDataCapabilityRegistry()

try {
  let releaseSlowLoader!: () => void
  const slowLoaderReady = new Promise<void>(resolve => { releaseSlowLoader = resolve })
  let slowLoaderCount = 0
  moduleRegistry.registerResource(moduleId, 'dataCapabilityProviders', {
    [providerKey]: async () => {
      slowLoaderCount += 1
      await slowLoaderReady
      return createProvider('module-provider-v1', 'test.source.module-v1')
    },
  })

  const directRuntime = registry.createRuntime({ runtimeId: 'module-direct-readiness' })
  const directQuery = directRuntime.query<string>({
    version: 1,
    source: { capabilityId: 'test.source.module-v1', version: 1 },
  })
  await wait()
  const firstCatalog = registry.resolveCatalog({})
  const concurrentCatalog = registry.resolveCatalog({})
  await wait()
  assert.equal(slowLoaderCount, 1)
  releaseSlowLoader()
  assert.deepEqual(
    (await Promise.all([firstCatalog, concurrentCatalog])).map(catalog => catalog.sources.map(source => source.definition.id)),
    [['test.source.module-v1'], ['test.source.module-v1']],
  )
  assert.equal((await directQuery).data, 'test.source.module-v1')
  await directRuntime.dispose()
  assert.equal(slowLoaderCount, 1)
  assert.deepEqual(disposedProviders, [])

  moduleRegistry.registerResource(moduleId, 'dataCapabilityProviders', {
    [providerKey]: async () => createProvider('module-provider-v2', 'test.source.module-v2'),
  }, { override: true })
  await registry.loadModuleProviders({})
  assert.deepEqual(
    (await registry.resolveCatalog({})).sources.map(source => source.definition.id),
    ['test.source.module-v2'],
  )
  assert.deepEqual(disposedProviders, ['module-provider-v1'])

  moduleRegistry.unregisterResource(moduleId, 'dataCapabilityProviders')
  await registry.loadModuleProviders({})
  assert.equal((await registry.resolveCatalog({})).sources.length, 0)
  assert.deepEqual(disposedProviders, ['module-provider-v1', 'module-provider-v2'])

  let releaseReplacedLoader!: () => void
  const replacedLoaderReady = new Promise<void>(resolve => { releaseReplacedLoader = resolve })
  let replacedLoaderCount = 0
  moduleRegistry.registerResource(moduleId, 'dataCapabilityProviders', {
    [providerKey]: async () => {
      replacedLoaderCount += 1
      await replacedLoaderReady
      return createProvider('module-provider-v3', 'test.source.module-v3')
    },
  })
  const catalogDuringReplacement = registry.resolveCatalog({})
  await wait()
  assert.equal(replacedLoaderCount, 1)
  moduleRegistry.registerResource(moduleId, 'dataCapabilityProviders', {
    [providerKey]: async () => createProvider('module-provider-v4', 'test.source.module-v4'),
  }, { override: true })
  releaseReplacedLoader()
  await registry.loadModuleProviders({})
  assert.deepEqual(
    (await catalogDuringReplacement).sources.map(source => source.definition.id),
    ['test.source.module-v4'],
  )
  assert.deepEqual(disposedProviders, ['module-provider-v1', 'module-provider-v2', 'module-provider-v3'])

  moduleRegistry.unregister(moduleId)
  await registry.loadModuleProviders({})
  assert.equal((await registry.resolveCatalog({})).sources.length, 0)
  assert.deepEqual(disposedProviders, [
    'module-provider-v1',
    'module-provider-v2',
    'module-provider-v3',
    'module-provider-v4',
  ])
} finally {
  moduleRegistry.clear()
  await registry.loadModuleProviders({})
}
