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

const catalog = await registry.resolveCatalog({ scopeId: 'unit-test' })
assert.equal(catalog.sources.length, 1)
assert.equal(catalog.operations.length, 1)
assert.equal(catalog.sources[0].availability.executable, true)

const runtime = registry.createRuntime({ scopeId: 'unit-test', runtimeId: 'unit-test', parameters: { deviceId: 'd1' } })
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

const providerRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let loadCount = 0
providerRegistry.registerProvider({
  id: 'tenant-aware-provider',
  owner: { moduleId: 'test-ui', providerId: 'tenant-aware-provider' },
  load(context) {
    loadCount += 1
    return {
      sources: [{
        id: 'tenant-aware-source',
        kind: 'data-source',
        version: 1,
        name: `Tenant ${context.tenantId}`,
        owner: { moduleId: 'test-ui', providerId: 'tenant-aware-provider' },
        modes: ['snapshot'],
        create: () => ({ query: () => of({ data: context.tenantId }) as any }),
      }],
    }
  },
})
assert.equal((await providerRegistry.resolveCatalog({ scopeId: 'unit-test', tenantId: 'a' })).sources[0].definition.name, 'Tenant a')
assert.equal((await providerRegistry.resolveCatalog({ scopeId: 'unit-test', tenantId: 'b' })).sources[0].definition.name, 'Tenant b')
assert.equal(loadCount, 2)

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
  () => unavailableRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'unavailable' }).query({
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
const abortRuntime = abortRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'abort' })
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
const canonicalRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
canonicalRegistry.operations.register({
  ...operation,
  id: 'test.operation.canonical',
  create: () => ({
    execute(prepared) {
      executedInput = prepared.request.input
      return of({ type: 'completed' })
    },
  }),
})
const canonicalRuntime = canonicalRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'canonical' })
const canonicalPrepared = await canonicalRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: 'test.operation.canonical', version: 1 },
  input: { value: { kind: 'literal', value: 1 } },
})
canonicalPrepared.request.input = { value: 2 }
await firstValueFrom(canonicalRuntime.executeOperation(canonicalPrepared).events$)
assert.deepEqual(executedInput, { value: 1 })
await canonicalRuntime.dispose()

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
const groupRuntime = groupRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'group' })
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
const policyRuntime = policyRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'policy' })
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
const preview = await previewRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'preview' }).preview({
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
const replayRuntime = replayRegistry.createRuntime({ scopeId: 'unit-test', runtimeId: 'replay' })
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
assert.deepEqual((lateEvents.find(event => event.type === 'data') as any).result.data, [3])
await replayRuntime.dispose()

await assert.rejects(async () => {
  await registry.createRuntime({ scopeId: 'unit-test', runtimeId: 'expression-test' }).prepareOperation({
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
