import {
  clientToolOutput,
  clientToolResult,
  defineClientToolAnalyticalProducer,
  defineClientToolBoundedAnalyticalProducer,
  defineClientToolScope,
  defineClientTool,
  defineClientTools,
  type ClientToolAnalyticalAuthoring,
  type ClientToolDefinition,
  type ClientToolScopeAuthoring,
} from '../src/layout/components/AiChat/clientToolApi'
import {
  defineClientToolPrimarySubjectArgumentBinding,
  defineClientToolStringArgumentBinding,
  defineClientToolTemporalRange,
  type ClientToolAnalyticalFilterBindingDefinition,
  type ClientToolStringArgumentAuthoring,
  type ClientToolTemporalAuthoring,
} from '../src/layout/components/AiChat/clientToolDefinition'

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
    bindArgument: defineClientToolStringArgumentBinding<{ deviceId: string }>('deviceId'),
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

clientToolOutput.recordSet({
  name: 'typed-timestamp-records',
  shape: 'fixture.timestamp-records',
  recordPath: '$',
  fields: [{
    name: 'capturedAt',
    type: 'timestamp',
    role: 'temporal_dimension',
    axis: 'time',
    encoding: 'epoch-millis',
  }],
})

clientToolOutput.recordSet({
  name: 'missing-timestamp-encoding',
  shape: 'fixture.timestamp-records',
  recordPath: '$',
  fields: [
    // @ts-expect-error Canonical timestamp fields require one explicit value encoding.
    {
      name: 'capturedAt',
      type: 'timestamp',
      role: 'temporal_dimension',
      axis: 'time',
      encoding: undefined,
    },
  ],
})

clientToolOutput.recordSet({
  name: 'non-timestamp-encoding',
  shape: 'fixture.timestamp-records',
  recordPath: '$',
  fields: [
    {
      name: 'label',
      type: 'string',
      role: 'label',
      // @ts-expect-error Non-timestamp fields cannot declare timestamp encoding.
      encoding: 'date-time',
    },
  ],
})

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

defineClientToolAnalyticalProducer({
  producerKey: 'type.intent.trend',
  factKey: 'type.intent.values',
  subjects: ['entity'],
  measures: [{ name: 'value_rate', aggregations: ['avg'], units: ['percent'] }],
  dimensions: ['time'],
  filters: [],
  grains: [],
  criteria: ['trend'],
  semanticIntentBindings: [{
    intent: 'inspect typed trend',
    criterion: 'trend',
    measures: ['value_rate'],
    dimensions: ['time'],
    scopeSelection: {
      binding: 'scope',
      modes: ['project', 'explicit'],
    },
  }],
  ordering: [{ axis: 'observed_at', direction: 'asc' }],
  coverage: 'complete',
  output: 'typed-intent-series',
})

defineClientToolAnalyticalProducer({
  producerKey: 'type.invalid-intent.trend',
  factKey: 'type.intent.values',
  subjects: ['entity'],
  measures: [{ name: 'value_rate', aggregations: ['avg'], units: ['percent'] }],
  dimensions: ['time'],
  filters: [],
  grains: [],
  criteria: ['trend'],
  semanticIntentBindings: [{
    intent: 'inspect invalid typed trend',
    criterion: 'trend',
    // @ts-expect-error Semantic intent bindings require at least one explicitly authored measure.
    measures: [],
    dimensions: ['time'],
  }],
  ordering: [{ axis: 'observed_at', direction: 'asc' }],
  coverage: 'complete',
  output: 'typed-invalid-intent-series',
})

defineClientToolAnalyticalProducer({
  producerKey: 'type.invalid-scope-selection.summary',
  factKey: 'type.intent.values',
  subjects: ['entity'],
  measures: [{ name: 'value_rate', aggregations: ['avg'], units: ['percent'] }],
  dimensions: ['segment'],
  filters: [],
  grains: [],
  criteria: ['summary'],
  semanticIntentBindings: [{
    intent: 'inspect invalid typed scope selection',
    criterion: 'summary',
    measures: ['value_rate'],
    dimensions: ['segment'],
    scopeSelection: {
      binding: 'scope',
      // @ts-expect-error Scope selection is a closed project/explicit choice.
      modes: ['project', 'automatic'],
    },
  }],
  ordering: [],
  coverage: 'complete',
  output: 'typed-invalid-scope-selection-summary',
})

const executionAuthoredTrend = defineClientToolAnalyticalProducer({
  producerKey: 'type.execution-authored.trend',
  factKey: 'type.execution-authored.values',
  subjects: ['entity'],
  measures: [{ name: 'dynamic_value', aggregations: ['avg'], units: [] }],
  dimensions: ['time'],
  filters: [],
  grains: [],
  criteria: ['trend'],
  ordering: [{ axis: 'observedAt', direction: 'asc' }],
  coverage: 'complete',
  output: 'typed-execution-authored-series',
  outputFields: 'execution-authored',
})

defineClientTool<Record<string, unknown>, Record<string, unknown>, {
  points?: Array<{ observedAt: number; value: number }>
}>({
  id: 'typed_execution_authored_trend',
  description: { text: 'Read execution-authored fields', capabilities: ['type.dynamic.trend'] },
  analytical: executionAuthoredTrend,
  effect: { kind: 'READ' },
  output: clientToolOutput.aggregateSeries({
    name: 'typed-execution-authored-series',
    shape: 'type.execution-authored-series',
    recordPath: '$',
    fields: [{
      name: 'observedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
      encoding: 'epoch-millis',
    }],
    ordering: { keys: [{ field: 'observedAt', direction: 'asc' }], producerGuaranteed: true },
    optional: true,
    select: result => result.points,
    resolveFields: () => ([
      {
        name: 'observedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
        encoding: 'epoch-millis',
      },
      {
        name: 'value', type: 'number', role: 'measure', label: 'Dynamic value',
        measure: 'dynamic_value_member', aggregation: 'avg', unit: 'count',
      },
    ] as const),
  }),
  execute: () => ({ points: [] }),
})

defineClientToolAnalyticalProducer({
  producerKey: 'type.invalid-execution-authored.trend',
  factKey: 'type.execution-authored.values',
  subjects: ['entity'],
  measures: [{ name: 'dynamic_value', aggregations: ['avg'], units: [] }],
  dimensions: ['time'],
  filters: [],
  grains: [],
  criteria: ['trend'],
  ordering: [{ axis: 'observedAt', direction: 'asc' }],
  coverage: 'complete',
  output: 'typed-invalid-execution-authored-series',
  // @ts-expect-error Execution-authored fields use one closed authoring mode.
  outputFields: 'runtime-inferred',
})

clientToolResult.success([1], {
  // @ts-expect-error Business execution results never carry analytical proof tokens.
  analyticalCompletion: {},
})

// @ts-expect-error Analytical authoring handles are opaque and can only be created by Web Core helpers.
const rawAnalyticalAuthoring: ClientToolAnalyticalAuthoring<BoundedArgs> = {}
void rawAnalyticalAuthoring

type FilterArgs = {
  status?: string
  labels?: string[]
  operator?: 'eq' | 'in'
}
const fixedScalarFilter: ClientToolAnalyticalFilterBindingDefinition<FilterArgs> = {
  axis: 'status', operator: 'eq', valueArgument: 'status',
}
const fixedArrayFilter: ClientToolAnalyticalFilterBindingDefinition<FilterArgs> = {
  axis: 'labels', operator: 'contains_all', valueArgument: 'labels',
  valueCardinality: 'one-or-more', encoding: 'string-array',
}
const dynamicArrayFilter: ClientToolAnalyticalFilterBindingDefinition<FilterArgs> = {
  axis: 'labels', operators: ['eq', 'in'], operatorArgument: 'operator', valueArgument: 'labels',
}
void fixedScalarFilter
void fixedArrayFilter
void dynamicArrayFilter

const invalidFixedArrayEncoding: ClientToolAnalyticalFilterBindingDefinition<FilterArgs> = {
  axis: 'labels', operator: 'contains_all', valueArgument: 'labels',
  valueCardinality: 'one-or-more',
  // @ts-expect-error Fixed arrays require the coupled one-or-more/string-array representation.
  encoding: 'scalar',
}
void invalidFixedArrayEncoding

const invalidFilterTarget: ClientToolAnalyticalFilterBindingDefinition<FilterArgs> = {
  axis: 'labels', operator: 'contains_all',
  // @ts-expect-error Filter bindings may target only declared business arguments.
  valueArgument: 'unknownLabels',
  valueCardinality: 'one-or-more', encoding: 'string-array',
}
void invalidFilterTarget

type TemporalArgs = { range: string; from: string; to: string }
const temporal = defineClientToolTemporalRange<TemporalArgs>({
  rangeArgument: 'range',
  startArgument: 'from',
  endArgument: 'to',
  customValue: 'custom',
  encoding: 'date-time',
})
void temporal

defineClientToolTemporalRange<TemporalArgs>({
  rangeArgument: 'range',
  startArgument: 'from',
  // @ts-expect-error Temporal targets must exist in the business argument type.
  endArgument: 'until',
  customValue: 'custom',
  encoding: 'date-time',
})

// @ts-expect-error Temporal authoring handles are opaque and created only by shared time-scope helpers.
const rawTemporalAuthoring: ClientToolTemporalAuthoring<TemporalArgs> = {}
void rawTemporalAuthoring

type CatalogArgs = { selectedId: string }
const catalogArgument = defineClientToolStringArgumentBinding<CatalogArgs>('selectedId')
void catalogArgument

const contextCatalogArgument = defineClientToolPrimarySubjectArgumentBinding<CatalogArgs>(
  'selectedId',
  'anonymous-subject',
)
void contextCatalogArgument

defineClientToolStringArgumentBinding<CatalogArgs>(
  // @ts-expect-error Catalog argument targets must exist in the business argument type.
  'missingId',
)

defineClientToolPrimarySubjectArgumentBinding<CatalogArgs>(
  // @ts-expect-error Context argument targets must exist in the business argument type.
  'missingId',
  'anonymous-subject',
)

// @ts-expect-error Catalog argument authoring is opaque and created only by the shared helper.
const rawCatalogArgument: ClientToolStringArgumentAuthoring<CatalogArgs> = {}
void rawCatalogArgument

const mismatchedCatalogDefinition: ClientToolDefinition<{ deviceId: string }> = {
  id: 'mismatched_catalog_argument',
  description: { text: 'Reject a foreign argument owner', capabilities: ['fixture.catalog.read'] },
  inputs: [{ id: 'deviceId', valueType: 'string' }],
  consumes: [{
    name: 'catalog-id',
    type: 'structured-data',
    mediaType: 'application/json',
    shape: 'fixture.catalog-ids',
    required: true,
    sourcePolicy: 'EITHER',
    // @ts-expect-error The opaque binding must belong to the same tool argument type.
    bindArgument: catalogArgument,
  }],
  effect: { kind: 'READ' },
  output: clientToolOutput.detail({ name: 'detail', shape: 'fixture.detail' }),
  execute: () => clientToolResult.success({}),
}
void mismatchedCatalogDefinition

type ScopeArgs = { scopeMode: 'project' | 'explicit'; primaryScope?: string; secondaryScope?: string }
const scope = defineClientToolScope<ScopeArgs>({
  modeArgument: 'scopeMode',
  valueCardinality: 'exactly-one',
  encoding: 'single-string',
  coordinates: [
    { type: 'project', arguments: [] },
    { type: 'area', sourcePort: 'primary-scope-id', arguments: ['primaryScope'] },
    { type: 'point', sourcePort: 'secondary-scope-id', arguments: ['secondaryScope'] },
  ],
})
void scope

defineClientToolScope<ScopeArgs>({
  modeArgument: 'scopeMode',
  valueCardinality: 'exactly-one',
  encoding: 'single-string',
  coordinates: [
    { type: 'project', arguments: [] },
    {
      type: 'area',
      sourcePort: 'primary-scope-id',
      // @ts-expect-error Scope targets must exist in the business argument type.
      arguments: ['missingScope'],
    },
  ],
})

defineClientToolScope<ScopeArgs>({
  // @ts-expect-error Scope mode must be a declared business argument.
  modeArgument: 'missingScopeMode',
  valueCardinality: 'exactly-one',
  encoding: 'single-string',
  coordinates: [
    { type: 'project', arguments: [] },
    { type: 'area', sourcePort: 'primary-scope-id', arguments: ['primaryScope'] },
    { type: 'point', sourcePort: 'secondary-scope-id', arguments: ['secondaryScope'] },
  ],
})

// @ts-expect-error Scope authoring handles are opaque and created only by shared scope helpers.
const rawScopeAuthoring: ClientToolScopeAuthoring<ScopeArgs> = {}
void rawScopeAuthoring

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
