import assert from 'node:assert/strict'
import { of } from 'rxjs'

import {
  CapabilitySchemaValidator,
  DefaultDataCapabilityRegistry,
  type DataConnectionEvent,
  type DataSourceDefinition,
  type DataSourceRequest,
  type OperationDefinition,
} from '../../src/data-capability'

const wait = () => new Promise(resolve => setTimeout(resolve, 0))

const validator = new CapabilitySchemaValidator()
const validationValue = {
  choice: 'unknown',
  fixed: 'changed',
  values: [1, 1.5],
  secret: 'actual-secret',
  untouched: true,
}
const validationSnapshot = structuredClone(validationValue)
const validationIssues = validator.validate({
  type: 'object',
  required: ['missing'],
  properties: {
    choice: { type: 'string', enum: ['first', 'second'] },
    fixed: { type: 'string', const: 'fixed' },
    values: { type: 'array', items: { type: 'integer' } },
    secret: { type: 'string', const: 'expected-secret', sensitive: true },
  },
}, validationValue, 'input')
assert.deepEqual(validationIssues, [
  { phase: 'input', path: ['missing'], keyword: 'required', expected: 'missing' },
  { phase: 'input', path: ['choice'], keyword: 'enum', expected: ['first', 'second'] },
  { phase: 'input', path: ['fixed'], keyword: 'const', expected: 'fixed' },
  { phase: 'input', path: ['values', 1], keyword: 'type', expected: 'integer' },
  { phase: 'input', path: ['secret'], keyword: 'const', expected: '<redacted>' },
])
assert.deepEqual(validationValue, validationSnapshot)
assert.equal(JSON.stringify(validationIssues).includes('actual-secret'), false)
assert.equal(validator.validate(
  { type: 'array', items: { type: 'integer' } },
  Array.from({ length: 200 }, () => 'invalid'),
  'output',
).length, 100)

const sourceRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let sourceCreateCount = 0
let sourceQueryCount = 0
let receivedConfig: unknown
let receivedQuery: unknown
const schemaSource: DataSourceDefinition = {
  id: 'test.source.schema',
  kind: 'data-source',
  version: 1,
  name: 'Schema Source',
  owner: { moduleId: 'test-ui', providerId: 'schema-provider' },
  modes: ['snapshot'],
  configSchema: {
    type: 'object',
    required: ['token'],
    properties: {
      token: { type: 'string', const: 'provider-token', sensitive: true },
    },
  },
  querySchema: {
    type: 'object',
    required: ['count'],
    properties: {
      count: { type: 'integer' },
      mode: { type: 'string', enum: ['latest', 'history'] },
    },
  },
  create(config) {
    sourceCreateCount += 1
    receivedConfig = config
    return {
      query<T = unknown>(request: DataSourceRequest) {
        sourceQueryCount += 1
        receivedQuery = request.query
        return of({ data: { ok: true } as T })
      },
    }
  },
}
sourceRegistry.sources.register(schemaSource)
const sourceRuntime = sourceRegistry.createRuntime({ runtimeId: 'schema-source' })
let invalidConfigError: any
await assert.rejects(
  () => sourceRuntime.query({
    version: 1,
    source: { capabilityId: schemaSource.id, version: 1, config: { token: 'actual-token' } },
    query: { count: 1 },
  }),
  (error: any) => {
    invalidConfigError = error
    return error?.code === 'capability.validation_failed'
  },
)
assert.deepEqual(invalidConfigError.details, {
  phase: 'config',
  path: ['token'],
  keyword: 'const',
  expected: '<redacted>',
})
assert.equal(JSON.stringify(invalidConfigError).includes('actual-token'), false)
assert.equal(sourceCreateCount, 0)

await assert.rejects(
  () => sourceRuntime.query({
    version: 1,
    source: { capabilityId: schemaSource.id, version: 1, config: { token: 'provider-token' } },
    query: { count: '1', unknown: 'preserved' },
  }),
  (error: any) => error?.code === 'capability.validation_failed'
    && error?.details?.phase === 'query'
    && error?.details?.path?.[0] === 'count',
)
assert.equal(sourceCreateCount, 0)

await sourceRuntime.query({
  version: 1,
  source: {
    capabilityId: schemaSource.id,
    version: 1,
    config: { token: 'provider-token', untouched: true },
  },
  query: { count: 1, mode: 'latest', unknown: 'preserved' },
})
assert.deepEqual(receivedConfig, { token: 'provider-token', untouched: true })
assert.deepEqual(receivedQuery, { count: 1, mode: 'latest', unknown: 'preserved' })
assert.equal(sourceCreateCount, 1)
assert.equal(sourceQueryCount, 1)

const invalidConnectionEvents: DataConnectionEvent[] = []
sourceRuntime.connect({
  consumerId: 'schema-invalid-connect',
  binding: {
    version: 1,
    source: { capabilityId: schemaSource.id, version: 1, config: { token: 'invalid' } },
    query: { count: 1 },
  },
}).events$.subscribe(event => invalidConnectionEvents.push(event))
await wait()
assert.equal(sourceCreateCount, 1)
assert.equal(
  invalidConnectionEvents.some(event => event.type === 'status'
    && event.status === 'failed'
    && event.error?.code === 'capability.validation_failed'),
  true,
)
await sourceRuntime.dispose()

const operationRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
let operationCreateCount = 0
let operationPrepareCount = 0
const schemaOperation: OperationDefinition = {
  id: 'test.operation.schema',
  kind: 'operation',
  action: 'invoke',
  version: 1,
  name: 'Schema Operation',
  owner: { moduleId: 'test-ui', providerId: 'schema-provider' },
  configSchema: {
    type: 'object',
    required: ['enabled'],
    properties: { enabled: { type: 'boolean' } },
  },
  inputSchema: {
    type: 'object',
    required: ['action'],
    properties: { action: { type: 'string', const: 'execute' } },
  },
  policy: {
    risk: 'low',
    confirmation: 'none',
    idempotency: 'natural',
    cancellation: 'before-dispatch',
    retry: 'never',
    concurrency: 'parallel',
  },
  create() {
    operationCreateCount += 1
    return {
      prepare(request) {
        operationPrepareCount += 1
        return Promise.resolve({
          id: 'provider-prepare',
          capabilityId: schemaOperation.id,
          request,
          policy: schemaOperation.policy,
        })
      },
      execute: () => of({ type: 'completed' }),
    }
  },
}
operationRegistry.operations.register(schemaOperation)
const operationRuntime = operationRegistry.createRuntime({ runtimeId: 'schema-operation' })
await assert.rejects(
  () => operationRuntime.prepareOperation({
    version: 1,
    operation: { capabilityId: schemaOperation.id, version: 1, config: { enabled: 'yes' } },
    input: { action: 'execute' },
  }),
  (error: any) => error?.code === 'capability.validation_failed' && error?.details?.phase === 'config',
)
await assert.rejects(
  () => operationRuntime.prepareOperation({
    version: 1,
    operation: { capabilityId: schemaOperation.id, version: 1, config: { enabled: true } },
    input: { action: 'inspect' },
  }),
  (error: any) => error?.code === 'capability.validation_failed' && error?.details?.phase === 'input',
)
assert.equal(operationCreateCount, 0)
assert.equal(operationPrepareCount, 0)
await operationRuntime.prepareOperation({
  version: 1,
  operation: { capabilityId: schemaOperation.id, version: 1, config: { enabled: true } },
  input: { action: 'execute', unknown: 'preserved' },
})
assert.equal(operationCreateCount, 1)
assert.equal(operationPrepareCount, 1)
await operationRuntime.dispose()

const outputRegistry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
outputRegistry.sources.register({
  id: 'test.source.output-schema',
  kind: 'data-source',
  version: 1,
  name: 'Output Schema Source',
  owner: { moduleId: 'test-ui', providerId: 'schema-provider' },
  modes: ['snapshot'],
  outputSchema: {
    type: 'object',
    required: ['value'],
    properties: { value: { type: 'number' } },
  },
  create: () => ({
    query<T = unknown>() {
      return of({ data: { value: 'invalid-output' } as T })
    },
  }),
})
const outputRuntime = outputRegistry.createRuntime({ runtimeId: 'schema-output' })
const outputBinding = {
  version: 1,
  source: { capabilityId: 'test.source.output-schema', version: 1 },
} as const
assert.deepEqual((await outputRuntime.query(outputBinding)).data, { value: 'invalid-output' })
const outputPreview = await outputRuntime.preview({ binding: outputBinding })
assert.deepEqual(outputPreview.data, { value: 'invalid-output' })
assert.deepEqual(outputPreview.outputSchema, {
  type: 'object',
  required: ['value'],
  properties: { value: { type: 'number' } },
})
assert.deepEqual(outputPreview.warnings?.[0], {
  code: 'capability.validation_failed',
  message: 'Capability value does not match schema',
  capabilityId: 'test.source.output-schema',
  details: { phase: 'output', path: ['value'], keyword: 'type', expected: 'number' },
})
assert.equal(JSON.stringify(outputPreview.warnings).includes('invalid-output'), false)
await outputRuntime.dispose()
