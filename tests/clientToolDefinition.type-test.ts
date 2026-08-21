import {
  clientToolOutput,
  clientToolResult,
  defineClientToolBoundedAnalyticalProducer,
  defineClientTool,
  defineClientTools,
  type ClientToolAnalyticalAuthoring,
  type ClientToolDefinition,
} from '../src/layout/components/AiChat/clientToolApi'

const validDefinition: ClientToolDefinition<
  { deviceId: string },
  { projectId: string },
  { records: Array<{ id: string }> }
> = {
  id: 'type_fixture_records',
  description: {
    text: 'Read bounded records',
    capabilities: ['fixture.records.read'],
  },
  inputs: [{ id: 'deviceId', required: true, valueType: 'string' }],
  consumes: [{
    name: 'device-id', type: 'structured-data', mediaType: 'text/plain',
    shape: 'device.identifier', sourcePolicy: 'EITHER', required: false,
  }],
  effect: { kind: 'READ' },
  output: clientToolOutput.recordSet({
    name: 'fixture-records',
    shape: 'fixture.records',
    recordPath: '$',
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    select: result => result.records,
  }),
  execute: ({ deviceId }) => clientToolResult.success({ records: [{ id: deviceId }] }, {
    cardinality: {
      kind: 'record-set',
      recordCount: 1,
      returnedCount: 1,
      totalCount: 1,
    },
    claims: [{
      id: 'record-count',
      label: 'Record count',
      value: 1,
      visibility: 'user',
    }],
    supportsAbsenceClaim: true,
  }),
}

defineClientTools([defineClientTool(validDefinition)])

type BoundedArgs = { limit?: number }
const boundedDefinition = {
  producerKey: 'type.bounded',
  factKey: 'type.bounded.values',
  subjects: ['entity'],
  measures: [{ name: 'semantic_score', aggregations: ['sum'], units: ['record'] }],
  dimensions: ['semantic_group'],
  filters: [],
  grains: [],
  criterion: {
    name: 'top_n',
    measure: 'semantic_score',
    direction: 'desc',
    valueField: 'physical_score',
    coordinateField: 'physical_group',
    axis: 'semantic_group',
  },
  boundedBy: 'limit',
  output: 'bounded-records',
} as const
const boundedScope = defineClientToolBoundedAnalyticalProducer<BoundedArgs>(boundedDefinition)

defineClientTool<BoundedArgs, Record<string, unknown>, number[]>({
  id: 'typed_bounded_scope',
  description: { text: 'Read a bounded scope', capabilities: ['type.bounded.read'] },
  inputs: [{ id: 'limit', valueType: 'number', defaultValue: 5 }],
  analytical: boundedScope,
  effect: { kind: 'READ' },
  output: clientToolOutput.recordSet({
    name: 'bounded-records',
    shape: 'type.bounded-records',
    recordPath: '$',
    fields: [
      { name: 'physical_group', type: 'string', role: 'dimension' },
      { name: 'physical_score', type: 'number', role: 'measure', measure: 'semantic_score' },
    ],
  }),
  execute: () => clientToolResult.success([1]),
})

defineClientToolBoundedAnalyticalProducer<BoundedArgs>({
  ...boundedDefinition,
  // @ts-expect-error Wire version is compiler-owned.
  version: 'analytical-capability/v1',
})

defineClientToolBoundedAnalyticalProducer<BoundedArgs>({
  ...boundedDefinition,
  // @ts-expect-error Wire transform cost is compiler-owned.
  transformCost: 0,
})

defineClientToolBoundedAnalyticalProducer<BoundedArgs>({
  ...boundedDefinition,
  // @ts-expect-error Output authoring binds a declared output by name, never by wire shape.
  output: { shape: 'type.bounded-records' },
})

defineClientToolBoundedAnalyticalProducer<BoundedArgs>({
  ...boundedDefinition,
  // @ts-expect-error Bounded scope must bind an input that exists in the business argument type.
  boundedBy: 'requestedCount',
})

defineClientToolBoundedAnalyticalProducer<BoundedArgs>({
  ...boundedDefinition,
  criterion: {
    ...boundedDefinition.criterion,
    axis: undefined,
    // @ts-expect-error Dynamic axes must bind an input that exists in the business argument type.
    axisFromInput: 'dimension',
  },
})

defineClientToolBoundedAnalyticalProducer<BoundedArgs>({
  ...boundedDefinition,
  // @ts-expect-error Bounded ordering is compiled from the single criterion binding.
  ordering: [{ axis: 'physical_score', direction: 'desc' }],
})

clientToolResult.success([1], {
  // @ts-expect-error Business execution results never carry analytical proof tokens.
  analyticalCompletion: {},
})

// @ts-expect-error Analytical authoring handles are opaque and can only be created by Web Core helpers.
const rawAnalyticalAuthoring: ClientToolAnalyticalAuthoring<BoundedArgs> = {}
void rawAnalyticalAuthoring

defineClientTool({
  ...validDefinition,
  // @ts-expect-error Routing is compiled from stable business facts and is not author-owned.
  routing: { stages: ['FETCH'] },
})

defineClientTool({
  ...validDefinition,
  // @ts-expect-error Preparation is a compile-time-only true flag, not a second routing enum.
  preparation: false,
})

defineClientTool({
  id: 'prepared_write_fixture',
  description: { text: 'Write one record', capabilities: ['fixture.records.write'] },
  effect: {
    kind: 'WRITE',
    idempotency: 'IDEMPOTENT',
    reversible: true,
    confirmation: {},
  },
  output: clientToolOutput.stateChange({
    name: 'write-receipt',
    shape: 'fixture.write-receipt',
    transition: 'MUTATION',
  }),
  prepare: args => ({ arguments: args }),
  execute: () => ({ updated: true }),
})

clientToolOutput.recordSet({
  name: 'invalid-records',
  shape: 'fixture.records',
  // @ts-expect-error JSONPath bindings are selected by the compiler-owned output slot.
  path: '$.records',
})

clientToolOutput.artifact({
  name: 'invalid-artifact',
  shape: 'fixture.document',
  mediaType: 'application/json',
  // @ts-expect-error Physical delivery policy is runtime-owned.
  delivery: 'file',
})

defineClientTool({
  ...validDefinition,
  consumes: [{
    name: 'legacy-consumer',
    optional: true,
    source: 'EITHER',
  }],
})

defineClientTool({
  ...validDefinition,
  // @ts-expect-error A canonical consumer must provide the complete descriptor and cannot mix legacy aliases.
  consumes: [{
    name: 'invalid-partial-canonical-consumer',
    type: 'structured-data',
    source: 'EITHER' as const,
  }],
})
