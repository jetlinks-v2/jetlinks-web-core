import assert from 'node:assert/strict'
import { Observable, Subject, firstValueFrom, of } from 'rxjs'

import {
  DefaultDataCapabilityRegistry,
  type CapabilityAvailability,
  type DataConnectionEvent,
  type DataSourceDefinition,
  type OperationDefinition,
} from '../../src/data-capability'

const available: CapabilityAvailability = {
  discoverable: true,
  configurable: true,
  executable: true,
}

const wait = () => new Promise(resolve => setTimeout(resolve, 0))

const basePolicy: OperationDefinition['policy'] = {
  risk: 'low',
  confirmation: 'none',
  idempotency: 'natural',
  cancellation: 'before-dispatch',
  retry: 'never',
  concurrency: 'parallel',
}

const registry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const source: DataSourceDefinition = {
  id: 'test.source.echo',
  kind: 'data-source',
  version: 1,
  name: 'Echo Source',
  owner: { moduleId: 'test-ui', providerId: 'test-provider' },
  modes: ['snapshot'],
  create: () => ({
    query(request) {
      return of({ data: { config: request.config, query: request.query } }) as any
    },
  }),
}
const operation: OperationDefinition = {
  id: 'test.operation.echo',
  kind: 'operation',
  action: 'invoke',
  version: 1,
  name: 'Echo Operation',
  owner: { moduleId: 'test-ui', providerId: 'test-provider' },
  policy: basePolicy,
  create: () => ({
    execute(prepared) {
      return new Observable((subscriber) => {
        subscriber.next({ type: 'result', result: prepared.request.input })
        subscriber.next({ type: 'completed' })
        subscriber.complete()
      })
    },
  }),
}
registry.sources.register(source)
registry.operations.register(operation)

const catalog = await registry.resolveCatalog({})
assert.equal(catalog.sources.length, 1)
assert.equal(catalog.operations.length, 1)
assert.equal(catalog.sources[0].availability.executable, true)

const runtime = registry.createRuntime({ runtimeId: 'unit-test', parameters: { deviceId: 'd1' } })
const queryResult = await runtime.query({
  version: 1,
  source: { capabilityId: source.id, version: 1, config: { fixed: true } },
  query: { deviceId: { kind: 'parameter', parameterId: 'deviceId' } },
})
assert.deepEqual(queryResult.data, { config: { fixed: true }, query: { deviceId: 'd1' } })

const prepared = await runtime.prepareOperation({
  version: 1,
  operation: { capabilityId: operation.id, version: 1 },
  input: { value: { kind: 'literal', value: 42 } },
})
assert.equal(prepared.capabilityId, operation.id)
assert.deepEqual(prepared.request.input, { value: 42 })
await runtime.dispose()
await assert.rejects(
  () => runtime.query({ version: 1, source: { capabilityId: source.id, version: 1 } }),
  (error: any) => error?.code === 'runtime.disposed',
)

const providerRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let loadCount = 0
let loadArgCount = -1
providerRegistry.registerProvider({
  id: 'neutral-provider',
  owner: { moduleId: 'test-ui', providerId: 'neutral-provider' },
  load(...args: any[]) {
    loadCount += 1
    loadArgCount = args.length
    return {
      sources: [{
        id: 'neutral-source',
        kind: 'data-source',
        version: 1,
        name: 'Neutral Source',
        owner: { moduleId: 'test-ui', providerId: 'neutral-provider' },
        modes: ['snapshot'],
        create: () => ({ query: () => of({ data: 'neutral' }) as any }),
      }],
    }
  },
})
assert.equal((await providerRegistry.resolveCatalog({ parameters: { feature: 'a' } })).sources[0].definition.name, 'Neutral Source')
assert.equal((await providerRegistry.resolveCatalog({ parameters: { feature: 'b' } })).sources[0].definition.name, 'Neutral Source')
assert.equal(loadCount, 1)
assert.equal(loadArgCount, 0)

const unavailableRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let unavailableCreateCount = 0
unavailableRegistry.sources.register({
  ...source,
  id: 'test.source.unavailable',
  availability: (_context, phase) => ({ ...available, executable: phase !== 'execute', reason: 'source denied' }),
  create: () => {
    unavailableCreateCount += 1
    return { query: () => of({ data: 'denied' }) as any }
  },
})
await assert.rejects(
  () => unavailableRegistry.createRuntime({ runtimeId: 'unavailable' }).query({
    version: 1,
    source: { capabilityId: 'test.source.unavailable', version: 1 },
  }),
  (error: any) => error?.message === 'source denied',
)
assert.equal(unavailableCreateCount, 0)

const abortRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let abortCount = 0
let teardownCount = 0
let disposeCount = 0
abortRegistry.sources.register({
  ...source,
  id: 'test.source.abort',
  modes: ['stream'],
  create: () => ({
    query(request) {
      request.signal?.addEventListener('abort', () => { abortCount += 1 }, { once: true })
      return new Observable(() => () => { teardownCount += 1 })
    },
    dispose() { disposeCount += 1 },
  }),
})
const abortRuntime = abortRegistry.createRuntime({ runtimeId: 'abort' })
const abortController = new AbortController()
const abortConnection = abortRuntime.connect({
  consumerId: 'abort-consumer',
  binding: { version: 1, source: { capabilityId: 'test.source.abort', version: 1 } },
  options: { signal: abortController.signal },
})
abortConnection.events$.subscribe(() => undefined)
await wait()
abortController.abort()
await wait()
assert.equal(abortCount, 1)
assert.equal(teardownCount, 1)
assert.equal(disposeCount, 1)
await abortRuntime.dispose()

let executedInput: unknown
let operationDisposeCount = 0
const canonicalRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
canonicalRegistry.operations.register({
  ...operation,
  id: 'test.operation.canonical',
  create: () => ({
    execute(prepared) {
      executedInput = prepared.request.input
      return of({ type: 'completed' })
    },
    dispose() { operationDisposeCount += 1 },
  }),
})
const canonicalRuntime = canonicalRegistry.createRuntime({ runtimeId: 'canonical' })
const canonicalPrepared = await canonicalRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.canonical', version: 1 },
  input: { value: { kind: 'literal', value: 1 } },
})
canonicalPrepared.request.input = { value: 2 }
await firstValueFrom(canonicalRuntime.executeOperation(canonicalPrepared).events$)
assert.deepEqual(executedInput, { value: 1 })
await canonicalRuntime.dispose()
assert.equal(operationDisposeCount, 1)

const confirmRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
confirmRegistry.operations.register({
  ...operation,
  id: 'test.operation.confirm',
  policy: { ...basePolicy, risk: 'high', confirmation: 'always' },
})
const confirmRuntime = confirmRegistry.createRuntime({ runtimeId: 'confirm' })
const needConfirm = await confirmRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.confirm', version: 1 },
})
assert.equal(needConfirm.policy.confirmation, 'always')
assert.throws(
  () => confirmRuntime.executeOperation(needConfirm),
  (error: any) => error?.code === 'operation.confirmation_required',
)
const confirmed = confirmRuntime.confirmOperation(needConfirm.id, { method: 'ui', reason: 'unit-test' })
await firstValueFrom(confirmRuntime.executeOperation(confirmed).events$)
await confirmRuntime.dispose()

const groupRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let groupQueryCount = 0
groupRegistry.sources.register({
  ...source,
  id: 'test.source.group',
  optimizer: { getGroupKey: () => 'same-device' },
  create: () => ({
    query(request) {
      groupQueryCount += 1
      return of({ data: request.query }) as any
    },
  }),
})
const groupRuntime = groupRegistry.createRuntime({ runtimeId: 'group' })
const temperatureEvents: DataConnectionEvent[] = []
const humidityEvents: DataConnectionEvent[] = []
groupRuntime.connect({
  consumerId: 'temperature',
  binding: { version: 1, source: { capabilityId: 'test.source.group', version: 1 }, query: { property: 'temperature' } },
}).events$.subscribe(event => temperatureEvents.push(event))
groupRuntime.connect({
  consumerId: 'humidity',
  binding: { version: 1, source: { capabilityId: 'test.source.group', version: 1 }, query: { property: 'humidity' } },
}).events$.subscribe(event => humidityEvents.push(event))
await wait()
assert.equal(groupQueryCount, 2)
assert.deepEqual((temperatureEvents.find(event => event.type === 'data') as any).result.data, { property: 'temperature' })
assert.deepEqual((humidityEvents.find(event => event.type === 'data') as any).result.data, { property: 'humidity' })
await groupRuntime.dispose()

const policyRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
policyRegistry.operations.register({
  ...operation,
  id: 'test.operation.policy',
  policy: { ...basePolicy, batch: false },
})
const policyRuntime = policyRegistry.createRuntime({ runtimeId: 'policy' })
const policyPrepared = await policyRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.policy', version: 1 },
  policyOverride: { batch: true },
})
assert.equal(policyPrepared.policy.batch, false)
await assert.rejects(
  () => policyRuntime.prepareOperation({
    version: 1,
    operation: { capabilityId: 'test.operation.policy', version: 1 },
    policyOverride: { batch: 'yes' } as any,
  }),
  (error: any) => error?.code === 'operation.policy_invalid',
)
await policyRuntime.dispose()

const previewRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let passedLimit: number | undefined
previewRegistry.sources.register({
  ...source,
  id: 'test.source.preview-limit',
  create: () => ({
    query(request) {
      passedLimit = request.limit
      return of({ data: Array.from({ length: 100 }, (_, index) => index) }) as any
    },
  }),
})
const preview = await previewRegistry.createRuntime({ runtimeId: 'preview' }).preview({
  binding: { version: 1, source: { capabilityId: 'test.source.preview-limit', version: 1 } },
  limit: 1,
})
assert.equal(passedLimit, 1)
assert.deepEqual(preview.data, [0])

const replayRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const upstream = new Subject<{ data: number[] }>()
replayRegistry.sources.register({
  ...source,
  id: 'test.source.replay',
  modes: ['stream'],
  create: () => ({ query: () => upstream as any }),
})
const replayRuntime = replayRegistry.createRuntime({ runtimeId: 'replay' })
const replayBinding = { version: 1, source: { capabilityId: 'test.source.replay', version: 1 } }
replayRuntime.connect({ consumerId: 'first', binding: replayBinding }).events$.subscribe(() => undefined)
await wait()
upstream.next({ data: [1] })
upstream.next({ data: [2] })
upstream.next({ data: [3] })
const lateEvents: DataConnectionEvent[] = []
replayRuntime.connect({ consumerId: 'late', binding: replayBinding }).events$.subscribe(event => lateEvents.push(event))
await wait()
assert.equal(lateEvents.filter(event => event.type === 'data').length, 1)
assert.equal(lateEvents.some(event => event.type === 'status' && event.status === 'connected'), true)
assert.deepEqual((lateEvents.find(event => event.type === 'data') as any).result.data, [3])
await replayRuntime.dispose()

const finiteRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
finiteRegistry.sources.register({
  ...source,
  id: 'test.source.finite',
  create: () => ({ query: () => of({ data: [1] }) as any }),
})
const finiteEvents: DataConnectionEvent[] = []
finiteRegistry.createRuntime({ runtimeId: 'finite' }).connect({
  consumerId: 'finite',
  binding: { version: 1, source: { capabilityId: 'test.source.finite', version: 1 } },
}).events$.subscribe(event => finiteEvents.push(event))
await wait()
assert.equal(finiteEvents.some(event => event.type === 'data'), true)
assert.equal(finiteEvents.some(event => event.type === 'status' && event.status === 'completed'), true)

const unregisterRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let providerDisposeCount = 0
let upstreamDisposeCount = 0
let providerAbortCount = 0
const unregisterProvider = unregisterRegistry.registerProvider({
  id: 'unregister-provider',
  owner: { moduleId: 'test-ui', providerId: 'unregister-provider' },
  load: () => ({
    sources: [{
      ...source,
      id: 'test.source.unregister',
      modes: ['stream'],
      owner: { moduleId: 'test-ui', providerId: 'unregister-provider' },
      create: () => ({
        query(request) {
          request.signal?.addEventListener('abort', () => { providerAbortCount += 1 }, { once: true })
          return new Observable(() => () => { upstreamDisposeCount += 1 })
        },
        dispose() { providerDisposeCount += 1 },
      }),
    }],
  }),
})
await unregisterRegistry.resolveCatalog({})
const unregisterRuntime = unregisterRegistry.createRuntime({ runtimeId: 'unregister' })
const unregisterEvents: DataConnectionEvent[] = []
unregisterRuntime.connect({
  consumerId: 'unregister',
  binding: { version: 1, source: { capabilityId: 'test.source.unregister', version: 1 } },
}).events$.subscribe(event => unregisterEvents.push(event))
await wait()
unregisterProvider()
await wait()
assert.equal(unregisterEvents.some(event => event.type === 'status' && event.status === 'unavailable'), true)
assert.equal(providerAbortCount, 1)
assert.equal(upstreamDisposeCount, 1)
assert.equal(providerDisposeCount, 1)
await unregisterRuntime.dispose()

const singleFlightRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let singleFlightLoadCount = 0
let releaseSingleFlight!: () => void
const singleFlightReady = new Promise<void>(resolve => { releaseSingleFlight = resolve })
singleFlightRegistry.registerProvider({
  id: 'single-flight-provider',
  owner: { moduleId: 'test-ui', providerId: 'single-flight-provider' },
  async load() {
    singleFlightLoadCount += 1
    await singleFlightReady
    return { sources: [{ ...source, id: 'test.source.single-flight' }] }
  },
})
const singleFlightA = singleFlightRegistry.resolveCatalog({})
const singleFlightB = singleFlightRegistry.resolveCatalog({})
await wait()
assert.equal(singleFlightLoadCount, 1)
releaseSingleFlight()
assert.equal((await singleFlightA).sources.length, 1)
assert.equal((await singleFlightB).sources.length, 1)

const ghostRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseGhost!: () => void
const ghostReady = new Promise<void>(resolve => { releaseGhost = resolve })
const unregisterGhost = ghostRegistry.registerProvider({
  id: 'ghost-provider',
  owner: { moduleId: 'test-ui', providerId: 'ghost-provider' },
  async load() {
    await ghostReady
    return { sources: [{ ...source, id: 'test.source.ghost' }] }
  },
})
const ghostCatalog = ghostRegistry.resolveCatalog({})
await wait()
unregisterGhost()
releaseGhost()
assert.equal((await ghostCatalog).sources.length, 0)
assert.equal((await ghostRegistry.resolveCatalog({})).sources.length, 0)

const operationUnregisterRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let unregisteredOperationDisposeCount = 0
const unregisterOperationProvider = operationUnregisterRegistry.registerProvider({
  id: 'operation-unregister-provider',
  owner: { moduleId: 'test-ui', providerId: 'operation-unregister-provider' },
  load: () => ({
    operations: [{
      ...operation,
      id: 'test.operation.unregister',
      owner: { moduleId: 'test-ui', providerId: 'operation-unregister-provider' },
      create: () => ({
        execute: () => of({ type: 'completed' }),
        dispose() { unregisteredOperationDisposeCount += 1 },
      }),
    }],
  }),
})
await operationUnregisterRegistry.resolveCatalog({})
const operationUnregisterRuntime = operationUnregisterRegistry.createRuntime({ runtimeId: 'operation-unregister' })
const unregisterPrepared = await operationUnregisterRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.unregister', version: 1 },
})
unregisterOperationProvider()
assert.throws(
  () => operationUnregisterRuntime.executeOperation(unregisterPrepared),
  (error: any) => error?.code === 'operation.not_prepared',
)
assert.equal(unregisteredOperationDisposeCount, 1)
await operationUnregisterRuntime.dispose()

const sameIdRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let disposeA = 0
let disposeB = 0
const unregisterSameA = sameIdRegistry.registerProvider({
  id: 'same-a',
  owner: { moduleId: 'test-ui', providerId: 'same-a' },
  load: () => ({
    sources: [{
      ...source,
      id: 'test.source.same-id',
      owner: { moduleId: 'test-ui', providerId: 'same-a' },
      modes: ['stream'],
      create: () => ({ query: () => new Observable(() => () => undefined), dispose() { disposeA += 1 } }),
    }],
  }),
})
sameIdRegistry.registerProvider({
  id: 'same-b',
  owner: { moduleId: 'test-ui', providerId: 'same-b' },
  load: () => ({
    sources: [{
      ...source,
      id: 'test.source.same-id',
      owner: { moduleId: 'test-ui', providerId: 'same-b' },
      modes: ['stream'],
      create: () => ({ query: () => new Observable(() => () => undefined), dispose() { disposeB += 1 } }),
    }],
  }),
})
await sameIdRegistry.resolveCatalog({})
const sameRuntime = sameIdRegistry.createRuntime({ runtimeId: 'same-id' })
const sameEvents: DataConnectionEvent[] = []
sameRuntime.connect({
  consumerId: 'same-id',
  binding: { version: 1, source: { capabilityId: 'test.source.same-id', version: 1 } },
}).events$.subscribe(event => sameEvents.push(event))
await wait()
unregisterSameA()
await wait()
assert.equal(sameEvents.some(event => event.type === 'status' && event.status === 'unavailable'), false)
assert.equal(disposeA, 0)
assert.equal(disposeB, 0)
await sameRuntime.dispose()
assert.equal(disposeB, 1)

const pendingAvailabilityRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseAvailability!: () => void
const availabilityReady = new Promise<void>(resolve => { releaseAvailability = resolve })
let pendingCreateCount = 0
pendingAvailabilityRegistry.sources.register({
  ...source,
  id: 'test.source.pending-availability',
  availability: async () => {
    await availabilityReady
    return available
  },
  create: () => {
    pendingCreateCount += 1
    return { query: () => of({ data: 'late' }) as any }
  },
})
const pendingRuntime = pendingAvailabilityRegistry.createRuntime({ runtimeId: 'pending' })
const pendingQuery = pendingRuntime.query({ version: 1, source: { capabilityId: 'test.source.pending-availability', version: 1 } })
await wait()
await pendingRuntime.dispose()
releaseAvailability()
await assert.rejects(() => pendingQuery, (error: any) => error?.code === 'runtime.disposed')
assert.equal(pendingCreateCount, 0)

const pendingPrepareRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseOperationCreate!: () => void
const operationCreateReady = new Promise<void>(resolve => { releaseOperationCreate = resolve })
let pendingOperationDisposeCount = 0
pendingPrepareRegistry.operations.register({
  ...operation,
  id: 'test.operation.pending-create',
  create: async () => {
    await operationCreateReady
    return {
      execute: () => of({ type: 'completed' }),
      dispose() { pendingOperationDisposeCount += 1 },
    }
  },
})
const pendingPrepareRuntime = pendingPrepareRegistry.createRuntime({ runtimeId: 'pending-prepare' })
const pendingPrepare = pendingPrepareRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.pending-create', version: 1 },
})
await wait()
await pendingPrepareRuntime.dispose()
releaseOperationCreate()
await assert.rejects(() => pendingPrepare, (error: any) => error?.code === 'runtime.disposed')
assert.equal(pendingOperationDisposeCount, 1)

const connectingRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
connectingRegistry.sources.register({
  ...source,
  id: 'test.source.connecting-visible',
  modes: ['stream'],
  create: () => ({ query: () => new Observable(() => () => undefined) }),
})
const connectingEvents: DataConnectionEvent[] = []
connectingRegistry.createRuntime({ runtimeId: 'connecting' }).connect({
  consumerId: 'connecting',
  binding: { version: 1, source: { capabilityId: 'test.source.connecting-visible', version: 1 } },
}).events$.subscribe(event => connectingEvents.push(event))
await wait()
assert.equal(connectingEvents.some(event => event.type === 'status' && event.status === 'connecting'), true)

const queryCancelRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let queryCancelTeardown = 0
let queryCancelDispose = 0
queryCancelRegistry.sources.register({
  ...source,
  id: 'test.source.query-cancel',
  create: () => ({
    query: () => new Observable(() => () => { queryCancelTeardown += 1 }) as any,
    dispose() { queryCancelDispose += 1 },
  }),
})
const queryCancelRuntime = queryCancelRegistry.createRuntime({ runtimeId: 'query-cancel' })
const queryCancel = queryCancelRuntime.query({ version: 1, source: { capabilityId: 'test.source.query-cancel', version: 1 } })
await wait()
await queryCancelRuntime.dispose()
await assert.rejects(() => queryCancel, (error: any) => error?.code === 'runtime.disposed')
assert.equal(queryCancelTeardown, 1)
assert.equal(queryCancelDispose, 1)

const disposeErrorRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
disposeErrorRegistry.sources.register({
  ...source,
  id: 'test.source.dispose-error',
  create: () => ({
    query: () => new Observable(() => () => undefined) as any,
    dispose() { throw new Error('dispose failed') },
  }),
})
const originalWarn = console.warn
const disposeWarnings: unknown[] = []
console.warn = (...args: unknown[]) => { disposeWarnings.push(args) }
try {
  const disposeErrorRuntime = disposeErrorRegistry.createRuntime({ runtimeId: 'dispose-error' })
  const disposeErrorQuery = disposeErrorRuntime.query({ version: 1, source: { capabilityId: 'test.source.dispose-error', version: 1 } })
  await wait()
  await disposeErrorRuntime.dispose()
  await assert.rejects(() => disposeErrorQuery, (error: any) => error?.code === 'runtime.disposed')
} finally {
  console.warn = originalWarn
}
assert.equal(disposeWarnings.length, 1)

const queryLateCreateRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseQueryLateCreate!: () => void
const queryLateCreateReady = new Promise<void>(resolve => { releaseQueryLateCreate = resolve })
let queryLateCreateDispose = 0
queryLateCreateRegistry.sources.register({
  ...source,
  id: 'test.source.query-late-create',
  create: async () => {
    await queryLateCreateReady
    return {
      query: () => of({ data: 'late' }) as any,
      dispose() { queryLateCreateDispose += 1 },
    }
  },
})
const queryLateCreateRuntime = queryLateCreateRegistry.createRuntime({ runtimeId: 'query-late-create' })
const queryLateCreate = queryLateCreateRuntime.query({
  version: 1,
  source: { capabilityId: 'test.source.query-late-create', version: 1 },
})
await wait()
await queryLateCreateRuntime.dispose()
await assert.rejects(() => queryLateCreate, (error: any) => error?.code === 'runtime.disposed')
releaseQueryLateCreate()
await wait()
assert.equal(queryLateCreateDispose, 1)

const preAbortRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let preAbortCreateCount = 0
preAbortRegistry.sources.register({
  ...source,
  id: 'test.source.pre-abort',
  create: () => {
    preAbortCreateCount += 1
    return { query: () => of({ data: 'aborted' }) as any }
  },
})
const preAbort = new AbortController()
preAbort.abort()
await assert.rejects(
  () => preAbortRegistry.createRuntime({ runtimeId: 'pre-abort' }).query({
    version: 1,
    source: { capabilityId: 'test.source.pre-abort', version: 1 },
  }, { signal: preAbort.signal }),
  (error: any) => error?.code === 'runtime.aborted',
)
assert.equal(preAbortCreateCount, 0)

const providerGapRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseProviderAvailability!: () => void
const providerAvailabilityReady = new Promise<void>(resolve => { releaseProviderAvailability = resolve })
let providerGapCreateCount = 0
const unregisterProviderGap = providerGapRegistry.registerProvider({
  id: 'provider-gap',
  owner: { moduleId: 'test-ui', providerId: 'provider-gap' },
  load: () => ({
    sources: [{
      ...source,
      id: 'test.source.provider-gap',
      owner: { moduleId: 'test-ui', providerId: 'provider-gap' },
      availability: async (_context, phase) => {
        if (phase === 'execute') await providerAvailabilityReady
        return available
      },
      create: () => {
        providerGapCreateCount += 1
        return { query: () => of({ data: 'gap' }) as any }
      },
    }],
  }),
})
await providerGapRegistry.resolveCatalog({})
const providerGapQuery = providerGapRegistry.createRuntime({ runtimeId: 'provider-gap' }).query({
  version: 1,
  source: { capabilityId: 'test.source.provider-gap', version: 1 },
})
await wait()
unregisterProviderGap()
releaseProviderAvailability()
await assert.rejects(() => providerGapQuery, (error: any) => ['provider.unregistered', 'capability.unavailable'].includes(error?.code))
assert.equal(providerGapCreateCount, 0)

const executeGapRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseExecuteAvailability!: () => void
const executeAvailabilityReady = new Promise<void>(resolve => { releaseExecuteAvailability = resolve })
let executeGapDispose = 0
let executeGapDispatched = 0
const unregisterExecuteGap = executeGapRegistry.registerProvider({
  id: 'execute-gap',
  owner: { moduleId: 'test-ui', providerId: 'execute-gap' },
  load: () => ({
    operations: [{
      ...operation,
      id: 'test.operation.execute-gap',
      owner: { moduleId: 'test-ui', providerId: 'execute-gap' },
      availability: async (_context, phase) => {
        if (phase === 'execute') await executeAvailabilityReady
        return available
      },
      create: () => ({
        execute: () => {
          executeGapDispatched += 1
          return of({ type: 'completed' })
        },
        dispose() { executeGapDispose += 1 },
      }),
    }],
  }),
})
await executeGapRegistry.resolveCatalog({})
const executeGapRuntime = executeGapRegistry.createRuntime({ runtimeId: 'execute-gap' })
const executeGapPrepared = await executeGapRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.execute-gap', version: 1 },
})
const executeGapErrors: unknown[] = []
executeGapRuntime.executeOperation(executeGapPrepared).events$.subscribe({ error: error => executeGapErrors.push(error) })
await wait()
unregisterExecuteGap()
releaseExecuteAvailability()
await wait()
assert.equal(executeGapDispatched, 0)
assert.equal(executeGapDispose, 1)
assert.equal((executeGapErrors[0] as any)?.code, 'capability.unavailable')
await executeGapRuntime.dispose()

const operationRemountRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseOperationRemount!: () => void
const operationRemountReady = new Promise<void>(resolve => { releaseOperationRemount = resolve })
let operationRemountDispatched = 0
let operationRemountDisposed = 0
operationRemountRegistry.operations.register({
  ...operation,
  id: 'test.operation.remount',
  availability: async (_context, phase) => {
    if (phase === 'execute') await operationRemountReady
    return available
  },
  create: () => ({
    execute: () => {
      operationRemountDispatched += 1
      return of({ type: 'completed' })
    },
    dispose() { operationRemountDisposed += 1 },
  }),
})
const operationRemountRuntime = operationRemountRegistry.createRuntime({ runtimeId: 'operation-remount' })
const operationRemountPrepared = await operationRemountRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.remount', version: 1 },
})
const operationRemountErrors: unknown[] = []
operationRemountRuntime.executeOperation(operationRemountPrepared).events$.subscribe({ error: error => operationRemountErrors.push(error) })
await wait()
const unregisterOperationRemountOverride = operationRemountRegistry.operations.register({
  ...operation,
  id: 'test.operation.remount',
  create: () => ({ execute: () => of({ type: 'completed' }) }),
}, { override: true })
await wait()
unregisterOperationRemountOverride()
releaseOperationRemount()
await wait()
assert.equal(operationRemountDispatched, 0)
assert.equal(operationRemountDisposed, 1)
assert.equal((operationRemountErrors[0] as any)?.code, 'capability.unavailable')
await operationRemountRuntime.dispose()

const versionRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
versionRegistry.sources.register({ ...source, id: 'test.source.version', version: 2 })
versionRegistry.operations.register({ ...operation, id: 'test.operation.version', version: 2 })
await assert.rejects(
  () => versionRegistry.createRuntime({ runtimeId: 'version-source' }).query({
    version: 1,
    source: { capabilityId: 'test.source.version', version: 1 },
  }),
  (error: any) => error?.code === 'capability.version_mismatch',
)
await assert.rejects(
  () => versionRegistry.createRuntime({ runtimeId: 'version-operation' }).prepareOperation({
    version: 1,
    operation: { capabilityId: 'test.operation.version', version: 1 },
  }),
  (error: any) => error?.code === 'capability.version_mismatch',
)

const directRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let directDispose = 0
const unregisterDirect = directRegistry.sources.register({
  ...source,
  id: 'test.source.direct-unregister',
  modes: ['stream'],
  create: () => ({
    query: () => new Observable(() => () => undefined),
    dispose() { directDispose += 1 },
  }),
})
const directEvents: DataConnectionEvent[] = []
const directRuntime = directRegistry.createRuntime({ runtimeId: 'direct-unregister' })
directRuntime.connect({
  consumerId: 'direct-unregister',
  binding: { version: 1, source: { capabilityId: 'test.source.direct-unregister', version: 1 } },
}).events$.subscribe(event => directEvents.push(event))
await wait()
unregisterDirect()
await wait()
assert.equal(directEvents.some(event => event.type === 'status' && event.status === 'unavailable'), true)
assert.equal(directDispose, 1)
await directRuntime.dispose()

const directOverrideRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const directBase = { ...source, id: 'test.source.direct-override', name: 'Direct Base' }
const directOverride = { ...source, id: 'test.source.direct-override', name: 'Direct Override' }
directOverrideRegistry.sources.register(directBase)
const unregisterDirectOverride = directOverrideRegistry.sources.register(directOverride, { override: true })
assert.equal(directOverrideRegistry.sources.get('test.source.direct-override')?.name, 'Direct Override')
unregisterDirectOverride()
assert.equal(directOverrideRegistry.sources.get('test.source.direct-override')?.name, 'Direct Base')

const directStackRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const directStackA = { ...source, id: 'test.source.direct-stack', name: 'Direct Stack A' }
const directStackB = { ...source, id: 'test.source.direct-stack', name: 'Direct Stack B' }
const directStackC = { ...source, id: 'test.source.direct-stack', name: 'Direct Stack C' }
directStackRegistry.sources.register(directStackA)
const unregisterDirectStackB = directStackRegistry.sources.register(directStackB, { override: true })
directStackRegistry.sources.register(directStackC, { override: true })
unregisterDirectStackB()
assert.equal(directStackRegistry.sources.get('test.source.direct-stack')?.name, 'Direct Stack C')
directStackRegistry.sources.clear()
assert.equal(directStackRegistry.sources.get('test.source.direct-stack'), undefined)

const providerQueryRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let providerQueryDispose = 0
let providerQueryTeardown = 0
const unregisterProviderQuery = providerQueryRegistry.registerProvider({
  id: 'query-pending-provider',
  owner: { moduleId: 'test-ui', providerId: 'query-pending-provider' },
  load: () => ({
    sources: [{
      ...source,
      id: 'test.source.provider-query-pending',
      owner: { moduleId: 'test-ui', providerId: 'query-pending-provider' },
      create: () => ({
        query: () => new Observable(() => () => { providerQueryTeardown += 1 }) as any,
        dispose() { providerQueryDispose += 1 },
      }),
    }],
  }),
})
await providerQueryRegistry.resolveCatalog({})
const providerQuery = providerQueryRegistry.createRuntime({ runtimeId: 'provider-query-pending' }).query({
  version: 1,
  source: { capabilityId: 'test.source.provider-query-pending', version: 1 },
})
await wait()
unregisterProviderQuery()
await assert.rejects(() => providerQuery, (error: any) => error?.code === 'capability.unavailable')
assert.equal(providerQueryTeardown, 1)
assert.equal(providerQueryDispose, 1)

const catalogRaceRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseCatalogAvailability!: () => void
const catalogAvailabilityReady = new Promise<void>(resolve => { releaseCatalogAvailability = resolve })
const unregisterCatalogRace = catalogRaceRegistry.sources.register({
  ...source,
  id: 'test.source.catalog-race',
  availability: async () => {
    await catalogAvailabilityReady
    return available
  },
})
const catalogRace = catalogRaceRegistry.resolveCatalog({})
await wait()
unregisterCatalogRace()
releaseCatalogAvailability()
assert.equal((await catalogRace).sources.length, 0)

const connectLateRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseConnectCreate!: () => void
const connectCreateReady = new Promise<void>(resolve => { releaseConnectCreate = resolve })
let connectLateDispose = 0
connectLateRegistry.sources.register({
  ...source,
  id: 'test.source.connect-late-dispose',
  modes: ['stream'],
  create: async () => {
    await connectCreateReady
    return {
      query: () => new Observable(() => () => undefined),
      dispose() { connectLateDispose += 1 },
    }
  },
})
const connectLateConnection = connectLateRegistry.createRuntime({ runtimeId: 'connect-late-dispose' }).connect({
  consumerId: 'connect-late-dispose',
  binding: { version: 1, source: { capabilityId: 'test.source.connect-late-dispose', version: 1 } },
})
await wait()
connectLateConnection.unsubscribe()
releaseConnectCreate()
await wait()
assert.equal(connectLateDispose, 1)

const connectProviderDisposeRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let releaseProviderConnectCreate!: () => void
const providerConnectCreateReady = new Promise<void>(resolve => { releaseProviderConnectCreate = resolve })
let providerConnectDispose = 0
const unregisterConnectProviderDispose = connectProviderDisposeRegistry.registerProvider({
  id: 'connect-provider-dispose-once',
  owner: { moduleId: 'test-ui', providerId: 'connect-provider-dispose-once' },
  load: () => ({
    sources: [{
      ...source,
      id: 'test.source.connect-provider-dispose-once',
      modes: ['stream'],
      owner: { moduleId: 'test-ui', providerId: 'connect-provider-dispose-once' },
      create: async () => {
        await providerConnectCreateReady
        return {
          query: () => new Observable(() => () => undefined),
          dispose() { providerConnectDispose += 1 },
        }
      },
    }],
  }),
})
await connectProviderDisposeRegistry.resolveCatalog({})
connectProviderDisposeRegistry.createRuntime({ runtimeId: 'connect-provider-dispose-once' }).connect({
  consumerId: 'connect-provider-dispose-once',
  binding: { version: 1, source: { capabilityId: 'test.source.connect-provider-dispose-once', version: 1 } },
})
await wait()
unregisterConnectProviderDispose()
releaseProviderConnectCreate()
await wait()
assert.equal(providerConnectDispose, 1)

const providerFailureRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
providerFailureRegistry.registerProvider({
  id: 'failed-provider',
  owner: { moduleId: 'test-ui', providerId: 'failed-provider' },
  load: () => { throw new Error('provider failed') },
})
providerFailureRegistry.registerProvider({
  id: 'healthy-provider',
  owner: { moduleId: 'test-ui', providerId: 'healthy-provider' },
  load: () => ({ sources: [{ ...source, id: 'test.source.healthy-provider' }] }),
})
assert.equal((await providerFailureRegistry.resolveCatalog({})).sources.length, 1)

const rollbackRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
rollbackRegistry.registerProvider({
  id: 'rollback-provider',
  owner: { moduleId: 'test-ui', providerId: 'rollback-provider' },
  load: () => ({
    sources: [
      { ...source, id: 'test.source.rollback' },
      { ...source, id: 'test.source.rollback' },
    ],
  }),
}, { override: false })
assert.equal((await rollbackRegistry.resolveCatalog({})).sources.length, 0)
assert.equal(rollbackRegistry.sources.get('test.source.rollback'), undefined)

const kindKeyRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const sameId = 'test.capability.same-id'
const unregisterSameOperation = kindKeyRegistry.operations.register({ ...operation, id: sameId })
kindKeyRegistry.sources.register({ ...source, id: sameId })
unregisterSameOperation()
assert.equal(kindKeyRegistry.sources.get(sameId)?.id, sameId)

await assert.rejects(
  () => registry.createRuntime({ runtimeId: 'plan-test' }).query({
    version: 1,
    source: { capabilityId: source.id, version: 1 },
    plan: { version: 1, nodes: [{ id: 'node1', source: { capabilityId: source.id, version: 1 } }] },
  }),
  (error: any) => error?.code === 'data_source.plan.unsupported',
)

await assert.rejects(async () => {
  await registry.createRuntime({ runtimeId: 'expression-test' }).prepareOperation({
    version: 1,
    operation: { capabilityId: operation.id, version: 1 },
    input: {
      value: {
        kind: 'expression',
        language: 'cel',
        expression: 'a + b',
        inputs: {},
      },
    },
  })
}, (error: any) => error?.message === 'Expression binding is not supported yet')
