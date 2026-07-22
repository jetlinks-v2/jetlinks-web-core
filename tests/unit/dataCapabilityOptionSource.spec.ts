import assert from 'node:assert/strict'
import { Observable, of } from 'rxjs'

import {
  DefaultDataCapabilityRegistry,
  type CapabilityAvailability,
  type CapabilityOption,
  type DataSource,
  type DataSourceDefinition,
  type OptionSourceDefinition,
} from '../../src/data-capability'

const available: CapabilityAvailability = {
  discoverable: true,
  configurable: true,
  executable: true,
}
const wait = () => new Promise(resolve => setTimeout(resolve, 0))
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const staticRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const staticRuntime = staticRegistry.createRuntime({ runtimeId: 'option-static' })
const staticOptions: CapabilityOption[] = [{
  label: 'Root',
  value: { id: 1 },
  metadata: { source: 'fixture' },
  children: [{ label: 'Child', value: 2 }],
}]
const staticResult = await staticRuntime.resolveOptions({ type: 'static', options: staticOptions })
staticResult.options[0].label = 'Changed'
;(staticResult.options[0].value as { id: number }).id = 2
staticResult.options[0].children![0].label = 'Changed child'
assert.deepEqual(staticOptions, [{
  label: 'Root',
  value: { id: 1 },
  metadata: { source: 'fixture' },
  children: [{ label: 'Child', value: 2 }],
}])
const prototypeValue = JSON.parse('{"__proto__":{"polluted":true}}')
const prototypeResult = await staticRuntime.resolveOptions({
  type: 'static',
  options: [{ label: 'Prototype', value: prototypeValue }],
})
const clonedPrototypeValue = prototypeResult.options[0].value as Record<string, unknown>
assert.equal(Object.getPrototypeOf(clonedPrototypeValue), Object.prototype)
assert.equal(Object.prototype.hasOwnProperty.call(clonedPrototypeValue, '__proto__'), true)
assert.equal(({} as any).polluted, undefined)
await assert.rejects(
  () => staticRuntime.resolveOptions({
    type: 'static',
    options: [{ label: 'Invalid', value: () => undefined }],
  }),
  (error: any) => error?.code === 'option_source.invalid_result'
    && error?.details?.reason === 'value_not_serializable'
    && !JSON.stringify(error).includes('Invalid'),
)
const preAborted = new AbortController()
preAborted.abort()
await assert.rejects(
  () => staticRuntime.resolveOptions({ type: 'static', options: [] }, { signal: preAborted.signal }),
  (error: any) => error?.code === 'runtime.aborted',
)
await staticRuntime.dispose()

const readinessRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let readinessLoadCount = 0
readinessRegistry.registerProvider({
  id: 'option-readiness-provider',
  owner: { moduleId: 'test-ui', providerId: 'option-readiness-provider' },
  async load() {
    readinessLoadCount += 1
    await wait()
    return {
      optionSources: [{
        id: 'test.option.readiness',
        kind: 'option-source',
        version: 1,
        name: 'Readiness Options',
        owner: { moduleId: 'test-ui', providerId: 'option-readiness-provider' },
        query: () => ({ options: [{ label: 'Ready', value: true }] }),
      }],
    }
  },
})
const readinessRuntime = readinessRegistry.createRuntime({ runtimeId: 'option-readiness' })
const [firstReadinessResult, secondReadinessResult] = await Promise.all([
  readinessRuntime.resolveOptions({
    type: 'provider',
    capability: { capabilityId: 'test.option.readiness', version: 1 },
  }),
  readinessRuntime.resolveOptions({
    type: 'provider',
    capability: { capabilityId: 'test.option.readiness', version: 1 },
  }),
])
assert.deepEqual(firstReadinessResult.options, [{ label: 'Ready', value: true }])
assert.deepEqual(secondReadinessResult.options, [{ label: 'Ready', value: true }])
assert.equal(readinessLoadCount, 1)
await readinessRuntime.dispose()

const providerRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let providerRequest: any
let providerContext: any
let providerQueryCount = 0
const providerDefinition: OptionSourceDefinition = {
  id: 'test.option.provider',
  kind: 'option-source',
  version: 2,
  name: 'Provider Options',
  owner: { moduleId: 'test-ui', providerId: 'option-provider' },
  availability: (_context, phase) => phase === 'configure' ? available : available,
  querySchema: {
    type: 'object',
    required: ['deviceId', 'upstream', 'search', 'pageIndex', 'pageSize'],
    properties: {
      deviceId: { type: 'string' },
      upstream: { type: 'string' },
      search: { type: 'string' },
      pageIndex: { type: 'integer' },
      pageSize: { type: 'integer' },
    },
  },
  optionSchema: {
    type: 'object',
    required: ['label'],
    properties: { label: { type: 'string' } },
  },
  async query(request, context) {
    providerQueryCount += 1
    providerRequest = request
    providerContext = context
    return { options: [{ label: 'Device', value: { id: request.query?.deviceId } }], total: 1 }
  },
}
providerRegistry.optionSources.register(providerDefinition)
const providerRuntime = providerRegistry.createRuntime({
  runtimeId: 'option-provider',
  parameters: { deviceId: 'device-1' },
})
providerRuntime.updateOutput({ nodeId: 'upstream', port: 'selected' }, { id: 'source-1' })
const providerResult = await providerRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: providerDefinition.id, version: 2 },
  query: {
    deviceId: { kind: 'parameter', parameterId: 'deviceId' },
    upstream: { kind: 'output', nodeId: 'upstream', port: 'selected', path: ['id'] },
  },
  keywordParam: 'search',
  pagination: true,
}, { keyword: 'sensor', pageIndex: 3, pageSize: 25 })
assert.deepEqual(providerResult, { options: [{ label: 'Device', value: { id: 'device-1' } }], total: 1, diagnostics: undefined })
assert.deepEqual(providerRequest.query, {
  deviceId: 'device-1',
  upstream: 'source-1',
  search: 'sensor',
  pageIndex: 3,
  pageSize: 25,
})
assert.equal(providerRequest.keyword, 'sensor')
assert.equal(providerRequest.pageIndex, 3)
assert.equal(providerRequest.pageSize, 25)
assert.equal(providerRequest.signal, providerContext.signal)
assert.equal(providerContext.runtimeId, 'option-provider')
assert.equal(providerQueryCount, 1)
await assert.rejects(
  () => providerRuntime.resolveOptions({
    type: 'provider',
    capability: { capabilityId: providerDefinition.id, version: 1 },
  }),
  (error: any) => error?.code === 'capability.version_mismatch',
)
await assert.rejects(
  () => providerRuntime.resolveOptions({
    type: 'provider',
    capability: { capabilityId: providerDefinition.id, version: 2 },
  }, { pageIndex: -1 }),
  (error: any) => error?.code === 'option_source.invalid_request'
    && error?.details?.field === 'pageIndex',
)
await providerRuntime.dispose()

const unavailableRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let unavailableQueryCount = 0
unavailableRegistry.optionSources.register({
  ...providerDefinition,
  id: 'test.option.unavailable',
  availability: async () => ({ ...available, configurable: false, reason: 'disabled' }),
  query: async () => {
    unavailableQueryCount += 1
    return { options: [] }
  },
})
const unavailableRuntime = unavailableRegistry.createRuntime({ runtimeId: 'option-unavailable' })
await assert.rejects(
  () => unavailableRuntime.resolveOptions({
    type: 'provider',
    capability: { capabilityId: 'test.option.unavailable', version: 2 },
  }),
  (error: any) => error?.code === 'capability.unavailable',
)
assert.equal(unavailableQueryCount, 0)
await unavailableRuntime.dispose()

const dataSourceRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const availabilityPhases: Array<string | undefined> = []
const sourceDiagnostics = { source: 'fixture' }
let dataSourceRequest: any
let dataSourceContext: any
const dataSourceDefinition: DataSourceDefinition = {
  id: 'test.source.options',
  kind: 'data-source',
  version: 4,
  name: 'DataSource Options',
  owner: { moduleId: 'test-ui', providerId: 'source-provider' },
  modes: ['page'],
  availability: (_context, phase) => {
    availabilityPhases.push(phase)
    return available
  },
  create: () => ({
    query(request, context) {
      dataSourceRequest = request
      dataSourceContext = context
      return of({
        data: [{
          info: { name: 'Root', id: 'root' },
          disabled: false,
          metadata: { level: 0 },
          nodes: [{ info: { name: 'Child', id: 'child' }, nodes: [] }],
        }],
        total: 30,
        diagnostics: sourceDiagnostics,
      }) as any
    },
  }),
}
dataSourceRegistry.sources.register(dataSourceDefinition)
const dataSourceRuntime = dataSourceRegistry.createRuntime({ runtimeId: 'option-data-source' })
const dataSourceResult = await dataSourceRuntime.resolveOptions({
  type: 'data-source',
  capability: { capabilityId: dataSourceDefinition.id, version: 4, config: { fixed: true } },
  query: { fixed: 'value' },
  labelPath: ['info', 'name'],
  valuePath: ['info', 'id'],
  childrenPath: ['nodes'],
  keywordParam: 'keyword',
  pagination: true,
}, { keyword: 'root', pageIndex: 1, pageSize: 10 })
assert.deepEqual(dataSourceResult, {
  options: [{
    label: 'Root',
    value: 'root',
    disabled: false,
    metadata: { level: 0 },
    children: [{ label: 'Child', value: 'child', children: [] }],
  }],
  total: 30,
  diagnostics: { source: 'fixture' },
})
assert.deepEqual(dataSourceRequest.config, { fixed: true })
assert.deepEqual(dataSourceRequest.query, { fixed: 'value', keyword: 'root', pageIndex: 1, pageSize: 10 })
assert.equal(dataSourceRequest.limit, 10)
assert.equal(dataSourceRequest.signal, dataSourceContext.signal)
assert.equal(availabilityPhases.includes('configure'), true)
assert.equal(availabilityPhases.includes('execute'), true)
;(dataSourceResult.diagnostics as Record<string, unknown>).source = 'changed'
assert.deepEqual(sourceDiagnostics, { source: 'fixture' })
await dataSourceRuntime.dispose()

const rawRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
rawRegistry.sources.register({
  ...dataSourceDefinition,
  id: 'test.source.raw-options',
  version: 1,
  create: () => ({ query: () => of({ data: [{ label: 'Raw', value: 1 }] }) as any }),
})
const rawRuntime = rawRegistry.createRuntime({ runtimeId: 'option-raw' })
assert.deepEqual(await rawRuntime.resolveOptions({
  type: 'data-source',
  capability: { capabilityId: 'test.source.raw-options', version: 1 },
}), { options: [{ label: 'Raw', value: 1 }], total: undefined, diagnostics: undefined })
await assert.rejects(
  () => rawRuntime.resolveOptions({
    type: 'data-source',
    capability: { capabilityId: 'test.source.raw-options', version: 1 },
    childrenPath: ['children'],
  }),
  (error: any) => error?.code === 'option_source.invalid_ref',
)
await rawRuntime.dispose()

const invalidResultRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
invalidResultRegistry.sources.register({
  ...dataSourceDefinition,
  id: 'test.source.invalid-options',
  version: 1,
  create: () => ({ query: () => of({ data: [{ label: 'secret-label', secret: 'do-not-leak' }] }) as any }),
})
let invalidResultError: any
const invalidResultRuntime = invalidResultRegistry.createRuntime({ runtimeId: 'option-invalid' })
await assert.rejects(
  () => invalidResultRuntime.resolveOptions({
    type: 'data-source',
    capability: { capabilityId: 'test.source.invalid-options', version: 1 },
  }),
  (error: any) => {
    invalidResultError = error
    return error?.code === 'option_source.invalid_result'
  },
)
assert.equal(JSON.stringify(invalidResultError).includes('secret-label'), false)
assert.equal(JSON.stringify(invalidResultError).includes('do-not-leak'), false)
await invalidResultRuntime.dispose()

const cancellationRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const pendingProviderQuery = deferred<{ options: CapabilityOption[] }>()
let pendingRequestSignal: AbortSignal | undefined
let pendingContextSignal: AbortSignal | undefined
let pendingQueryStarted = false
const pendingOption: OptionSourceDefinition = {
  ...providerDefinition,
  id: 'test.option.pending',
  version: 1,
  query(request, context) {
    pendingQueryStarted = true
    pendingRequestSignal = request.signal
    pendingContextSignal = context.signal
    return pendingProviderQuery.promise
  },
}
const unregisterPending = cancellationRegistry.optionSources.register(pendingOption)
const cancellationRuntime = cancellationRegistry.createRuntime({ runtimeId: 'option-cancel' })
const abortController = new AbortController()
const pending = cancellationRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: pendingOption.id, version: 1 },
  query: {
    deviceId: 'device-1',
    upstream: 'upstream-1',
    search: 'search',
    pageIndex: 0,
    pageSize: 10,
  },
}, { signal: abortController.signal })
while (!pendingQueryStarted) await wait()
abortController.abort()
await assert.rejects(() => pending, (error: any) => error?.code === 'runtime.aborted')
assert.equal(pendingRequestSignal, pendingContextSignal)
assert.equal(pendingRequestSignal?.aborted, true)
pendingProviderQuery.resolve({ options: [{ label: 'Late', value: 1 }] })
await wait()
unregisterPending()
await cancellationRuntime.dispose()

const disposeRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const pendingAvailability = deferred<CapabilityAvailability>()
disposeRegistry.optionSources.register({
  ...providerDefinition,
  id: 'test.option.dispose-pending',
  version: 1,
  availability: () => pendingAvailability.promise,
  query: async () => ({ options: [] }),
})
const disposeRuntime = disposeRegistry.createRuntime({ runtimeId: 'option-dispose' })
const disposePending = disposeRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: 'test.option.dispose-pending', version: 1 },
})
await wait()
await disposeRuntime.dispose()
await assert.rejects(() => disposePending, (error: any) => error?.code === 'runtime.disposed')
pendingAvailability.resolve(available)
await wait()

const unregisterRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const unregisterAvailability = deferred<CapabilityAvailability>()
const unregisterDefinition: OptionSourceDefinition = {
  ...providerDefinition,
  id: 'test.option.unregister-pending',
  version: 1,
  availability: () => unregisterAvailability.promise,
  query: async () => ({ options: [] }),
}
const unregister = unregisterRegistry.optionSources.register(unregisterDefinition)
const unregisterRuntime = unregisterRegistry.createRuntime({ runtimeId: 'option-unregister' })
const unregisterPendingRequest = unregisterRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: unregisterDefinition.id, version: 1 },
})
await wait()
unregister()
await assert.rejects(() => unregisterPendingRequest, (error: any) => error?.code === 'capability.unavailable')
unregisterAvailability.resolve(available)
await unregisterRuntime.dispose()

const remountRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const oldQuery = deferred<{ options: CapabilityOption[] }>()
let oldQueryStarted = false
const oldDefinition: OptionSourceDefinition = {
  ...providerDefinition,
  id: 'test.option.remount',
  version: 1,
  query: () => {
    oldQueryStarted = true
    return oldQuery.promise
  },
}
const newDefinition: OptionSourceDefinition = {
  ...oldDefinition,
  query: async () => ({ options: [{ label: 'New', value: 'new' }] }),
}
remountRegistry.optionSources.register(oldDefinition, { scope: 'old', override: true })
const remountRuntime = remountRegistry.createRuntime({ runtimeId: 'option-remount' })
const oldPending = remountRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: oldDefinition.id, version: 1 },
  query: {
    deviceId: 'device-1', upstream: 'source-1', search: 'x', pageIndex: 0, pageSize: 1,
  },
})
while (!oldQueryStarted) await wait()
const unregisterNew = remountRegistry.optionSources.register(newDefinition, { scope: 'new', override: true })
await assert.rejects(() => oldPending, (error: any) => error?.code === 'capability.unavailable')
assert.deepEqual((await remountRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: newDefinition.id, version: 1 },
  query: {
    deviceId: 'device-1', upstream: 'source-1', search: 'x', pageIndex: 0, pageSize: 1,
  },
})).options, [{ label: 'New', value: 'new' }])
unregisterNew()
oldQuery.resolve({ options: [{ label: 'Late old', value: 'old' }] })
await wait()
await remountRuntime.dispose()

const contextRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let contextTeardownCount = 0
contextRegistry.contexts.register({
  id: 'test.context.pending',
  kind: 'context-value',
  version: 1,
  name: 'Pending Context',
  owner: { moduleId: 'test-ui', providerId: 'context-provider' },
  outputSchema: { type: 'string' },
  resolve: () => new Observable(() => () => {
    contextTeardownCount += 1
  }),
})
contextRegistry.optionSources.register({
  ...providerDefinition,
  id: 'test.option.context-pending',
  version: 1,
  querySchema: undefined,
  query: async () => ({ options: [] }),
})
const contextRuntime = contextRegistry.createRuntime({ runtimeId: 'option-context-cancel' })
const contextAbort = new AbortController()
const contextPending = contextRuntime.resolveOptions({
  type: 'provider',
  capability: { capabilityId: 'test.option.context-pending', version: 1 },
  query: {
    value: {
      kind: 'context',
      providerId: 'test.context.pending',
      outputId: 'value',
    },
  },
}, { signal: contextAbort.signal })
await wait()
contextAbort.abort()
await assert.rejects(() => contextPending, (error: any) => error?.code === 'runtime.aborted')
await wait()
assert.equal(contextTeardownCount, 1)
await contextRuntime.dispose()

const lateSourceRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const lateDataSource = deferred<DataSource>()
let lateCreateStarted = false
let lateDisposeCount = 0
lateSourceRegistry.sources.register({
  ...dataSourceDefinition,
  id: 'test.source.option-late-create',
  version: 1,
  create: () => {
    lateCreateStarted = true
    return lateDataSource.promise
  },
})
const lateRuntime = lateSourceRegistry.createRuntime({ runtimeId: 'option-late-create' })
const lateAbort = new AbortController()
const latePending = lateRuntime.resolveOptions({
  type: 'data-source',
  capability: { capabilityId: 'test.source.option-late-create', version: 1 },
}, { signal: lateAbort.signal })
while (!lateCreateStarted) await wait()
lateAbort.abort()
await assert.rejects(() => latePending, (error: any) => error?.code === 'runtime.aborted')
lateDataSource.resolve({
  query: () => of({ data: [] }) as any,
  dispose: () => {
    lateDisposeCount += 1
  },
})
await wait()
assert.equal(lateDisposeCount, 1)
await lateRuntime.dispose()

const sourceUnregisterRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const unregisterLateDataSource = deferred<DataSource>()
let unregisterLateCreateStarted = false
let unregisterLateDisposeCount = 0
const unregisterLateSource: DataSourceDefinition = {
  ...dataSourceDefinition,
  id: 'test.source.option-unregister-create',
  version: 1,
  create: () => {
    unregisterLateCreateStarted = true
    return unregisterLateDataSource.promise
  },
}
const unregisterLateSourceDefinition = sourceUnregisterRegistry.sources.register(unregisterLateSource)
const unregisterLateRuntime = sourceUnregisterRegistry.createRuntime({ runtimeId: 'option-source-unregister' })
const unregisterLatePending = unregisterLateRuntime.resolveOptions({
  type: 'data-source',
  capability: { capabilityId: unregisterLateSource.id, version: 1 },
})
while (!unregisterLateCreateStarted) await wait()
unregisterLateSourceDefinition()
await assert.rejects(() => unregisterLatePending, (error: any) => error?.code === 'capability.unavailable')
unregisterLateDataSource.resolve({
  query: () => of({ data: [] }) as any,
  dispose: () => {
    unregisterLateDisposeCount += 1
  },
})
await wait()
assert.equal(unregisterLateDisposeCount, 1)
await unregisterLateRuntime.dispose()

const sourceDisposeRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const disposeLateDataSource = deferred<DataSource>()
let disposeLateCreateStarted = false
let disposeLateDisposeCount = 0
sourceDisposeRegistry.sources.register({
  ...dataSourceDefinition,
  id: 'test.source.option-runtime-dispose-create',
  version: 1,
  create: () => {
    disposeLateCreateStarted = true
    return disposeLateDataSource.promise
  },
})
const sourceDisposeRuntime = sourceDisposeRegistry.createRuntime({ runtimeId: 'option-source-runtime-dispose' })
const sourceDisposePending = sourceDisposeRuntime.resolveOptions({
  type: 'data-source',
  capability: { capabilityId: 'test.source.option-runtime-dispose-create', version: 1 },
})
while (!disposeLateCreateStarted) await wait()
await sourceDisposeRuntime.dispose()
await assert.rejects(() => sourceDisposePending, (error: any) => error?.code === 'runtime.disposed')
disposeLateDataSource.resolve({
  query: () => of({ data: [] }) as any,
  dispose: () => {
    disposeLateDisposeCount += 1
  },
})
await wait()
assert.equal(disposeLateDisposeCount, 1)

console.log('data capability option source tests passed')
