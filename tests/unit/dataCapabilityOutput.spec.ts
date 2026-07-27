import assert from 'node:assert/strict'
import { Subject, of } from 'rxjs'

import {
  createDataCapabilityClient,
  DefaultDataCapabilityRegistry,
  type CapabilitySchema,
  type DataConnectionEvent,
  type DataSourceDefinition,
  type OutputMapping,
  type PersistedDataBinding,
} from '../../src/data-capability'

const wait = () => new Promise(resolve => setTimeout(resolve, 0))

const registry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const stream = new Subject<{ data: unknown }>()
let queryCount = 0
const receivedQueries: Array<Record<string, unknown> | undefined> = []
const source: DataSourceDefinition = {
  id: 'test.source.output-binding',
  kind: 'data-source',
  version: 1,
  name: 'Output Binding Source',
  owner: { moduleId: 'test-ui', providerId: 'output-provider' },
  modes: ['snapshot', 'stream'],
  create: () => ({
    query(request) {
      queryCount += 1
      receivedQueries.push(request.query)
      return request.query?.stream ? stream as any : of({ data: request.query })
    },
  }),
}
registry.sources.register(source)
const runtime = registry.createRuntime({ runtimeId: 'output-binding' })

runtime.updateOutput({ nodeId: 'node-a' }, { payload: { value: 1 } })
runtime.updateOutput({ nodeId: 'node-a', port: 'success' }, { payload: { value: 2 } })
assert.deepEqual((await runtime.query({
  version: 1,
  source: { capabilityId: source.id, version: 1 },
  query: {
    value: { kind: 'output', nodeId: 'node-a', path: ['payload', 'value'] },
  },
})).data, { value: 1 })
assert.deepEqual((await runtime.query({
  version: 1,
  source: { capabilityId: source.id, version: 1 },
  query: {
    value: { kind: 'output', nodeId: 'node-a', port: 'success', path: ['payload', 'value'] },
  },
})).data, { value: 2 })

runtime.updateOutput({ nodeId: 'node-undefined' }, undefined)
assert.deepEqual((await runtime.query({
  version: 1,
  source: { capabilityId: source.id, version: 1 },
  query: { value: { kind: 'output', nodeId: 'node-undefined' } },
})).data, { value: undefined })

runtime.removeOutput({ nodeId: 'node-a' })
await assert.rejects(
  () => runtime.query({
    version: 1,
    source: { capabilityId: source.id, version: 1 },
    query: { value: { kind: 'output', nodeId: 'node-a' } },
  }),
  (error: any) => error?.code === 'binding.output_not_found'
    && error?.details?.nodeId === 'node-a'
    && !('port' in error.details),
)
assert.deepEqual((await runtime.query({
  version: 1,
  source: { capabilityId: source.id, version: 1 },
  query: { value: { kind: 'output', nodeId: 'node-a', port: 'success', path: ['payload', 'value'] } },
})).data, { value: 2 })

runtime.removeOutput({ nodeId: 'node-a', port: 'success' })
let missingPortError: any
await assert.rejects(
  () => runtime.query({
    version: 1,
    source: { capabilityId: source.id, version: 1 },
    query: { value: { kind: 'output', nodeId: 'node-a', port: 'success' } },
  }),
  (error: any) => {
    missingPortError = error
    return error?.code === 'binding.output_not_found'
  },
)
assert.deepEqual(missingPortError.details, { nodeId: 'node-a', port: 'success' })
assert.equal(JSON.stringify(missingPortError).includes('payload'), false)

runtime.updateOutput({ nodeId: 'stream-node' }, 'first')
const connectionEvents: DataConnectionEvent[] = []
const connection = runtime.connect({
  consumerId: 'output-no-auto-reconnect',
  binding: {
    version: 1,
    source: { capabilityId: source.id, version: 1 },
    query: {
      stream: true,
      value: { kind: 'output', nodeId: 'stream-node' },
    },
  },
})
connection.events$.subscribe(event => connectionEvents.push(event))
await wait()
const streamQueryCount = queryCount
assert.deepEqual(receivedQueries.at(-1), { stream: true, value: 'first' })
runtime.updateOutput({ nodeId: 'stream-node' }, 'second')
runtime.removeOutput({ nodeId: 'stream-node' })
await wait()
assert.equal(queryCount, streamQueryCount)
assert.equal(connectionEvents.some(event => event.type === 'status' && event.status === 'connected'), true)
connection.unsubscribe()

await runtime.dispose()
assert.throws(
  () => runtime.updateOutput({ nodeId: 'disposed' }, 1),
  (error: any) => error?.code === 'runtime.disposed',
)

const mappingRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const mappingSourceId = 'test.source.mapping-engine'
mappingRegistry.sources.register({
  ...source,
  id: mappingSourceId,
  outputSchema: { type: 'object' },
  create: () => ({
    query<T = unknown>() {
      return of({
        data: {
          title: 'Projects',
          rows: [
            { id: 'a', metrics: { value: 1 } },
            { id: 'b' },
          ],
        } as unknown as T,
      })
    },
  }),
})
const targetSchema = {
  type: 'object',
  required: ['title', 'items'],
  properties: {
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'value', 'source'],
        properties: {
          key: { type: 'string' },
          value: { type: 'number' },
          source: { type: 'string' },
        },
      },
    },
  },
} satisfies CapabilitySchema
const mapping: OutputMapping = {
  version: 1,
  fields: {
    title: { kind: 'path', path: ['title'] },
    items: {
      kind: 'each',
      path: ['rows'],
      item: {
        kind: 'object',
        fields: {
          key: { kind: 'path', path: ['id'] },
          value: {
            kind: 'default',
            source: { kind: 'path', path: ['metrics', 'value'] },
            value: 0,
          },
          source: { kind: 'literal', value: 'project' },
        },
      },
    },
  },
}
const mappingBinding: PersistedDataBinding = {
  version: 1,
  source: { capabilityId: mappingSourceId, version: 1 },
  mapping,
}
const mappingRuntime = mappingRegistry.createRuntime({ runtimeId: 'mapping-engine' })
const mappedRuntimeResult = await mappingRuntime.query(mappingBinding, { targetSchema })
const mappedPreviewResult = await mappingRuntime.preview({ binding: mappingBinding, targetSchema })
const expectedMappedData = {
  title: 'Projects',
  items: [
    { key: 'a', value: 1, source: 'project' },
    { key: 'b', value: 0, source: 'project' },
  ],
}
assert.deepEqual(mappedRuntimeResult.data, expectedMappedData)
assert.deepEqual(mappedPreviewResult.data, expectedMappedData)
assert.deepEqual(mappedRuntimeResult.outputSchema, targetSchema)
assert.deepEqual(mappedPreviewResult.outputSchema, targetSchema)

await assert.rejects(
  () => mappingRuntime.query(mappingBinding, { targetSchema: { type: 'array' } }),
  (error: any) => error?.code === 'capability.validation_failed' && error?.details?.phase === 'output',
)
await assert.rejects(
  () => mappingRuntime.query({
    ...mappingBinding,
    mapping: { ...mapping, format: { title: { type: 'string' } } },
  }),
  (error: any) => error?.code === 'output_mapping.format_unsupported',
)
await assert.rejects(
  () => mappingRuntime.query({
    ...mappingBinding,
    mapping: { version: 1, fields: { value: { kind: 'expression' } as any } },
  }),
  (error: any) => error?.code === 'output_mapping.expression_unsupported',
)
await assert.rejects(
  () => mappingRuntime.query({
    ...mappingBinding,
    mapping: { version: 1, fields: { value: { kind: 'coerce' } as any } },
  }),
  (error: any) => error?.code === 'output_mapping.coerce_unsupported',
)
await assert.rejects(
  () => mappingRuntime.query({
    ...mappingBinding,
    mapping: { ...mapping, version: 2 } as any,
  }),
  (error: any) => error?.code === 'output_mapping.version_unsupported',
)
await assert.rejects(
  () => mappingRuntime.query({ ...mappingBinding, version: 2 } as any),
  (error: any) => error?.code === 'data_binding.version_unsupported',
)

const client = createDataCapabilityClient({ runtimeId: 'thin-client' }, registry)
assert.deepEqual((await client.query({
  capabilityId: source.id,
  params: { value: 3 },
  targetSchema: {
    type: 'object',
    required: ['value'],
    properties: { value: { type: 'number' } },
  },
})).data, { value: 3 })
await client.dispose()
await assert.rejects(
  () => client.query({ capabilityId: source.id }),
  (error: any) => error?.code === 'client.disposed',
)
await mappingRuntime.dispose()

console.log('data capability output tests passed')
