import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import test from 'node:test'
import {
  createAiClientToolContractOutputBinding,
  diagnoseAiClientToolPresentationCompatibility,
  defineAiClientToolContract,
  isAiClientToolContractMetadata,
  withAiClientToolContractEvidence,
} from '../src/layout/components/AiChat/clientToolContract'
import {
  createAiClientToolCatalogReport,
  createAiClientToolCatalogSnapshot,
} from '../src/layout/components/AiChat/clientToolCatalog'
import {
  toAiClientToolSessionDefinition,
  toAiClientToolSessionDefinitions,
  toAiClientToolBusinessArguments,
  validateAiClientToolResultBindings,
  validateAiClientToolRoutingCatalog,
  validateAiClientToolRoutingMetadata,
} from '../src/layout/components/AiChat/clientToolRouting'
import { resolveAiClientToolBindingPath } from '../src/layout/components/AiChat/clientToolBindingPath'
import {
  createAiClientToolArtifact,
  createAiClientToolArrayRecordSource,
  createAiClientToolRecordStream,
  deliverAiClientToolResult,
} from '../src/layout/components/AiChat/clientToolResultDelivery'
import { createAiClientToolRecordFactCollector } from '../src/layout/components/AiChat/clientToolRecordFacts'
import {
  AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
  normalizeAiClientToolOutputBindings,
  normalizeAiClientToolOutputFields,
  normalizeAiClientToolOrdering,
  resolveAiClientToolResultState,
  validateAiClientToolCanonicalFieldValues,
  withAiClientToolEvidence,
} from '../src/layout/components/AiChat/clientToolResult'
import {
  mergeAiClientToolParameterSchema,
} from '../src/layout/components/AiChat/clientToolParameterSchema'
import { resolveClientCapabilityLoaderToolId } from '../src/layout/components/AiChat/clientCapabilityLoader'
import {
  CLIENT_TOOL_DEFINITION_META_KEY,
  clientToolOutput,
  clientToolResult,
  defineClientToolAnalyticalProducer,
  defineClientToolBoundedAnalyticalProducer,
  defineClientToolPrimarySubjectArgumentBinding,
  defineClientToolScope,
  defineClientToolStringArgumentBinding,
  defineClientToolTemporalRange,
  defineClientTool,
  isCompiledClientToolDefinition,
  type ClientToolInput,
  type ClientToolInputAlternative,
  type ClientToolConsumedResource,
} from '../src/layout/components/AiChat/clientToolDefinition'
import { aiClientToolRegistry } from '../src/layout/components/AiChat/clientToolRegistry'
import { createClientToolSnapshotController } from '../src/layout/components/AiChat/clientToolSnapshot'
import { createDomainAgentScopeContract } from '../src/layout/components/AiChat/clientToolScope'

const createSeriesContract = () => defineAiClientToolContract({
  routingKind: 'aggregate',
  routing: {
    capabilities: ['test.series.aggregate'],
    evidencePolicy: 'required',
    validationHints: ['structured-output-exists'],
  },
  outputs: [{
    kind: 'aggregate-series',
    name: 'series',
    shape: 'time-series.aggregate',
    audience: 'reusable-source',
    path: '$.data',
    delivery: 'auto',
    fields: [{ name: 'time', semanticRole: 'timestamp' }],
    ordering: {
      keys: [{ field: 'time', direction: 'asc' }],
      producerGuaranteed: true,
    },
  }],
})

const anonymousBoundedDefinition = (
  producerKey: string,
  criterion: 'top_n' | 'bottom_n',
) => ({
  producerKey,
  factKey: `${producerKey}.values`,
  subjects: ['entity'] as const,
  measures: [{ name: 'semantic_score', aggregations: ['sum'], units: ['record'] }],
  dimensions: ['semantic_group'],
  filters: [],
  grains: [],
  criterion: {
    name: criterion,
    measure: 'semantic_score',
    direction: criterion === 'top_n' ? 'desc' as const : 'asc' as const,
    valueField: 'physical_score',
    coordinateField: 'physical_group',
    axis: 'semantic_group',
  },
  boundedBy: 'requestedCount' as const,
  output: 'ranked-records',
})

const anonymousEnumValueType = (values: readonly string[]) => ({
  type: 'enum',
  valueType: { type: 'string' },
  elements: values.map(value => ({ value, text: value })),
})

const anonymousTemporalContract = () => {
  const inputs: ClientToolInput[] = [
    {
      id: 'windowMode',
      valueType: anonymousEnumValueType(['rolling', 'bounded']),
      required: true,
    },
    { id: 'openedAt', valueType: { type: 'date' } },
    { id: 'closedAt', valueType: { type: 'date' } },
  ]
  const inputAlternatives: ClientToolInputAlternative[] = [{
    required: ['windowMode'],
    when: { input: 'windowMode', oneOf: ['rolling'] },
    forbidden: ['openedAt', 'closedAt'],
  }, {
    required: ['windowMode', 'openedAt', 'closedAt'],
    when: { input: 'windowMode', equals: 'bounded' },
  }]
  const temporal = defineClientToolTemporalRange<Record<string, unknown>>({
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  })
  return { inputs, inputAlternatives, temporal }
}

const anonymousScopeContract = (inputAlternatives?: readonly ClientToolInputAlternative[]) => (
  createDomainAgentScopeContract<Record<string, unknown>>({
    area: {
      argument: 'scopeAlpha',
      description: 'First authorized coordinate',
      sourcePort: {
        name: 'coordinate-alpha',
        type: 'structured-data',
        mediaType: 'application/json',
        shape: 'anonymous.coordinate-alpha-ids',
        required: false,
        sourcePolicy: 'EITHER',
      },
    },
    point: {
      argument: 'scopeBeta',
      description: 'Second authorized coordinate',
      sourcePort: {
        name: 'coordinate-beta',
        type: 'structured-data',
        mediaType: 'application/json',
        shape: 'anonymous.coordinate-beta-ids',
        required: false,
        sourcePolicy: 'EITHER',
      },
    },
    inputAlternatives,
  })
)

const createAnonymousBoundedTool = (
  source: number[],
  criterion: 'top_n' | 'bottom_n' = 'top_n',
  options: {
    valueField?: Record<string, unknown>
    resolveFields?: () => any[]
  } = {},
) => {
  type Args = { requestedCount?: number }
  const analytical = defineClientToolBoundedAnalyticalProducer<Args>(
    anonymousBoundedDefinition(`anonymous.${criterion}`, criterion),
  )
  const records = source.map((score, index) => ({ physical_group: `group-${index}`, physical_score: score }))
  const tool = defineClientTool<Args, Record<string, unknown>, typeof records>({
    id: `anonymous_${criterion}`,
    description: { text: 'Return a bounded ordered subset', capabilities: ['generic.rank'] },
    inputs: [{ id: 'requestedCount', valueType: { type: 'integer', min: 1, max: 5 }, defaultValue: 3 }],
    analytical,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet<typeof records>({
      name: 'ranked-records',
      shape: 'generic.ranked-records',
      recordPath: '$',
      fields: [
        { name: 'physical_group', type: 'string', role: 'dimension' },
        {
          name: 'physical_score', type: 'number', role: 'measure', measure: 'semantic_score',
          unit: 'record', aggregation: 'sum',
          ...(options.valueField || {}),
        },
      ] as any,
      ...(options.resolveFields ? { resolveFields: options.resolveFields } : {}),
    }),
    execute: ({ requestedCount = 3 }) => clientToolResult.success(
      [...records]
        .sort((left, right) => criterion === 'top_n'
          ? right.physical_score - left.physical_score
          : left.physical_score - right.physical_score)
        .slice(0, requestedCount),
    ),
  })
  return { tool, analytical }
}

test('stable client-tool facade compiles business facts without inferring resources from inputs', async () => {
  let selections = 0
  const tool = defineClientTool<Record<string, unknown>, Record<string, unknown>, { items: unknown[] }>({
    id: 'test_records_read',
    description: {
      text: 'Read records',
      capabilities: ['test.records.read'],
      intents: ['read test records'],
    },
    inputs: [{ id: 'deviceId', required: true, valueType: 'string' }],
    consumes: [{
      name: 'subject-property-id', type: 'structured-data', mediaType: 'text/plain',
      shape: 'subject.property-identifier', required: false, sourcePolicy: 'TOOL',
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet<{ items: unknown[] }>({
      name: 'test-records',
      shape: 'test.records',
      select: (result) => {
        selections += 1
        return result.items
      },
    }),
    execute: () => clientToolResult.success({ items: [{ id: 'one' }] }),
  })

  assert.deepEqual(tool.routing?.accepts, ['subject-property-id'])
  assert.deepEqual(tool.routing?.prerequisites, undefined)
  assert.equal(tool.routing?.accepts?.includes('device-id'), false)
  assert.equal(tool.routing?.dataAccessModes?.[0], 'records')
  assert.equal(tool.routing?.exposure, 'auto')
  assert.equal(tool.annotations?.readOnlyHint, true)
  assert.equal(isCompiledClientToolDefinition(tool._meta?.[CLIENT_TOOL_DEFINITION_META_KEY]), true)
  assert.equal(createAiClientToolCatalogReport([tool], {
    requireRouting: true,
    requireResultBindings: true,
  }).tools[0]?.authoringStatus, 'facade')

  const result = await tool.execute({}, {}, { id: 'call', toolName: tool.id }) as any
  assert.equal(selections, 1)
  assert.deepEqual(result.__clientToolOutputs.output0, [{ id: 'one' }])
  assert.equal(result.outputBindings[0].path, '$.__clientToolOutputs.output0')
})

test('compile-time preparation owns routing stage without creating a second role or analytical authority', () => {
  const preparation = defineClientTool({
    id: 'anonymous_scope_resolution',
    description: { text: 'Resolve one authorized scope', capabilities: ['anonymous.scope.resolve'] },
    preparation: true,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'authorized-scope-candidates',
      shape: 'anonymous.scope-candidates',
    }),
    execute: () => [],
  })

  assert.deepEqual(preparation.routing?.stages, ['preparation'])
  assert.deepEqual(preparation.routing?.dataAccessModes, ['records'])
  assert.equal(preparation.routing?.analyticalCapability, undefined)
  assert.equal(Object.hasOwn(
    preparation._meta?.[CLIENT_TOOL_DEFINITION_META_KEY] as Record<string, unknown>,
    'preparation',
  ), false)
  const session = toAiClientToolSessionDefinition(preparation) as any
  assert.deepEqual(session.expands['x-ai-routing'].stages, ['preparation'])
  assert.equal(session.expands['x-ai-routing'].analyticalCapability, undefined)
  assert.equal(Object.keys(session.expands).filter(key => key === 'x-ai-routing').length, 1)
  assert.equal(JSON.stringify(session).includes('workflowRole'), false)
  assert.equal(JSON.stringify(session).includes('"preparation":true'), false)

  const analytical = defineClientToolAnalyticalProducer({
    producerKey: 'anonymous.metric.read',
    factKey: 'anonymous.metric',
    subjects: ['anonymous-subject'],
    measures: [{ name: 'metric', aggregations: ['sum'], units: ['record'] }],
    criteria: ['summary'],
    coverage: 'complete',
    output: 'anonymous-metric',
  })
  assert.throws(() => defineClientTool({
    id: 'invalid_preparation_producer',
    description: { text: 'Invalid preparation producer', capabilities: ['anonymous.invalid'] },
    preparation: true,
    analytical,
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'anonymous-metric', shape: 'anonymous.metric' }),
    execute: () => ({ value: 1 }),
  }), /preparation cannot declare analytical producer authority/)

  assert.throws(() => defineClientTool({
    id: 'invalid_preparation_flag',
    description: { text: 'Reject an invalid preparation flag', capabilities: ['anonymous.invalid-flag'] },
    preparation: false as never,
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'invalid-flag-output', shape: 'anonymous.invalid-flag' }),
    execute: () => ({ value: 1 }),
  }), /preparation flag must be true/)

  const releasedDefault = defineClientTool({
    id: 'released_record_reader',
    description: { text: 'Read records', capabilities: ['anonymous.records.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'released-records', shape: 'anonymous.records' }),
    execute: () => [],
  })
  assert.deepEqual(releasedDefault.routing?.stages, ['execution'])
})

test('required EITHER consumers remain prerequisites while accepting explicit arguments', () => {
  const tool = defineClientTool({
    id: 'test_required_either_consumer',
    description: { text: 'Read one subject', capabilities: ['test.subject.read'] },
    inputs: [{ id: 'subjectId', required: true, valueType: 'string' }],
    consumes: [{
      name: 'subject-id',
      type: 'structured-data',
      mediaType: 'application/json',
      shape: 'subject.ids',
      required: true,
      sourcePolicy: 'EITHER',
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'subject-detail', shape: 'subject.detail' }),
    execute: ({ subjectId }) => ({ id: subjectId }),
  })

  assert.deepEqual(tool.routing?.accepts, ['subject-id'])
  assert.deepEqual(tool.routing?.prerequisites, ['subject-id'])
  assert.equal(tool.routing?.consumerPorts?.[0]?.sourcePolicy, 'EITHER')
  assert.equal(tool.routing?.consumerPorts?.[0]?.required, true)
})

test('aggregate facade exposes renderer-neutral data without deriving a browser presentation', async () => {
  let selections = 0
  const points = [
    { label: '13:00', value: 0, timestamp: 1_785_387_600_000 },
    { label: '14:00', value: 100, timestamp: 1_785_391_200_000 },
  ]
  const tool = defineClientTool<Record<string, unknown>, Record<string, unknown>, { points: typeof points }>({
    id: 'test_online_rate_trend',
    description: {
      text: 'Read an online-rate trend',
      capabilities: ['test.online-rate.aggregate'],
    },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries<{ points: typeof points }>({
      name: 'online-rate-series',
      label: 'Online rate',
      shape: 'metric.time-series',
      fields: [
        { name: 'timestamp', semanticRole: 'timestamp' },
        { name: 'label', semanticRole: 'label' },
        { name: 'value', semanticRole: 'number', format: 'percent' },
      ],
      ordering: {
        keys: [{ field: 'timestamp', direction: 'asc' }],
        producerGuaranteed: true,
      },
      select: (result) => {
        selections += 1
        return result.points
      },
    }),
    execute: () => clientToolResult.success({ points }, {
      requestedRange: { label: '24h' },
    }),
  })

  assert.deepEqual(tool.routing?.produces, ['online-rate-series'])
  assert.deepEqual(tool.routing?.outputShapes, ['metric.time-series'])

  const prepared = await tool.execute({}, {}, { id: 'trend', toolName: tool.id }) as any
  assert.equal(selections, 1)
  assert.deepEqual(prepared.__clientToolOutputs.output0, points)
  assert.equal(prepared.data, undefined)
  assert.deepEqual(prepared.outputBindings[0].requestedRange, { label: '24h' })
  assert.deepEqual(prepared.outputBindings[0].fields, [
    { name: 'timestamp', semanticRole: 'timestamp' },
    { name: 'label', semanticRole: 'label' },
    { name: 'value', semanticRole: 'number', format: 'percent' },
  ])
  assert.deepEqual(prepared.outputBindings[0].ordering, {
    keys: [{ field: 'timestamp', direction: 'asc' }],
    producerGuaranteed: true,
  })

  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'trend', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any
  assert.equal(delivered.data, undefined)
  assert.deepEqual(delivered.outputBindings.map((binding: any) => ({
    name: binding.name,
    label: binding.label,
    shape: binding.shape,
    mediaType: binding.mediaType,
  })), [
    {
      name: 'online-rate-series',
      label: 'Online rate',
      shape: 'metric.time-series',
      mediaType: 'application/json',
    },
  ])
})

test('aggregate facade lets producers override delivery without changing the structured carrier', () => {
  const aggregate = (id: string, delivery?: 'inline' | 'auto') => defineClientTool({
    id,
    description: { text: 'Read one aggregate series', capabilities: ['test.aggregate.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'aggregate-series',
      shape: 'time-series.aggregate',
      ...(delivery ? { delivery } : {}),
    }),
    execute: () => [{ timestamp: 1, value: 2 }],
  })
  const explicit = aggregate('test_explicit_auto_aggregate', 'auto')
  const inferred = aggregate('test_inferred_inline_aggregate')

  assert.deepEqual(explicit.routing.resultDeliveries, ['auto'])
  assert.deepEqual(inferred.routing.resultDeliveries, ['inline'])
  assert.equal(explicit._meta.clientToolContract.outputs[0].delivery, 'auto')
  assert.equal(inferred._meta.clientToolContract.outputs[0].delivery, 'inline')
  assert.deepEqual(explicit.routing.producerPorts, [{
    name: 'aggregate-series',
    type: 'structured-data',
    mediaType: 'application/json',
    shape: 'time-series.aggregate',
    audience: 'model-evidence',
  }])
  const session = toAiClientToolSessionDefinition(explicit)
  assert.deepEqual(session.expands['x-ai-routing'].resultDeliveries, ['auto'])
  assert.equal(JSON.stringify(session).includes('"delivery":'), false)
})

test('facade projects only explicitly authored record paths into contracts and runtime bindings', async () => {
  const chartable = defineClientTool({
    id: 'test_explicit_record_path',
    description: { text: 'Read canonical records', capabilities: ['test.records.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'canonical-records',
      shape: 'tabular.records',
      recordPath: '$',
      fields: [
        { name: 'category', type: 'string', role: 'dimension' },
        { name: 'value', type: 'number', role: 'measure', measure: 'count', unit: 'record', aggregation: 'sum' },
      ],
    }),
    execute: () => clientToolResult.success([{ category: 'A', value: 1 }]),
  })
  const summary = defineClientTool({
    id: 'test_omitted_record_path',
    description: { text: 'Read a non-chartable summary', capabilities: ['test.summary.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'summary', shape: 'test.summary' }),
    execute: () => clientToolResult.success({ total: 1 }),
  })

  assert.equal((chartable._meta?.clientToolContract as any).outputs[0].recordPath, '$')
  assert.equal((summary._meta?.clientToolContract as any).outputs[0].recordPath, undefined)

  const chartableResult = await chartable.execute({}, {}, { id: 'chartable', toolName: chartable.id }) as any
  const summaryResult = await summary.execute({}, {}, { id: 'summary', toolName: summary.id }) as any
  assert.equal(chartableResult.outputBindings[0].recordPath, '$')
  assert.equal(summaryResult.outputBindings[0].recordPath, undefined)
})

test('facade rejects canonical fields when the producer omits recordPath', () => {
  assert.throws(() => defineClientTool({
    id: 'test_missing_record_path',
    description: { text: 'Reject an incomplete canonical output', capabilities: ['test.records.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'canonical-records',
      shape: 'tabular.records',
      fields: [{ name: 'value', type: 'number', role: 'measure' }],
    }),
    execute: () => clientToolResult.success([{ value: 1 }]),
  }), /explicit recordPath/)
})

test('bounded analytical completeness is relative to the canonical requested scope', async () => {
  const cases = [
    { source: [2, 1], args: {}, expected: [2, 1] },
    { source: [3, 2, 1], args: { requestedCount: 3 }, expected: [3, 2, 1] },
    { source: [1, 5, 3, 4, 2], args: { requestedCount: 3 }, expected: [5, 4, 3] },
  ]
  for (const [index, item] of cases.entries()) {
    const { tool } = createAnonymousBoundedTool(item.source)
    const result = await tool.execute(item.args, {}, {
      id: `bounded-${index}`,
      toolName: tool.id,
    }) as any
    assert.equal(result.complete, true)
    assert.equal(result.truncated, false)
    assert.equal(result.evidence.complete, true)
    assert.equal(result.evidence.completeness, 'complete')
    assert.deepEqual(
      result.__clientToolOutputs.output0.map((record: Record<string, number>) => record.physical_score),
      item.expected,
    )
    assert.equal(result.outputBindings[0].recordCount, item.expected.length)
    assert.equal(result.outputBindings[0].totalCount, item.expected.length)
    assert.equal(result.outputBindings[0].complete, true)
    assert.equal(result.outputBindings[0].completeness, 'complete')
  }

  const { tool: siblingCriterion } = createAnonymousBoundedTool([3, 1, 2, 4], 'bottom_n')
  const siblingResult = await siblingCriterion.execute({ requestedCount: 2 }, {}, {
    id: 'bounded-sibling',
    toolName: siblingCriterion.id,
  }) as any
  assert.deepEqual(
    siblingResult.__clientToolOutputs.output0.map((record: Record<string, number>) => record.physical_score),
    [1, 2],
  )
  assert.equal(siblingResult.complete, true)
  assert.equal(siblingResult.outputBindings[0].totalCount, 2)

  const session = toAiClientToolSessionDefinition(siblingCriterion) as any
  const serialized = JSON.stringify(session)
  assert.equal((serialized.match(/"x-ai-routing"/g) || []).length, 1)
  assert.equal(serialized.includes('boundedScope'), false)
  assert.equal(serialized.includes('proveComplete'), false)
  assert.equal(serialized.includes('analyticalCompletion'), false)
  assert.equal(
    session.expands['x-ai-routing'].analyticalCapability.criteria.includes('bottom_n'),
    true,
  )
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.ordering, [{
    axis: 'semantic_score', direction: 'asc', producerGuaranteed: true,
  }])
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.completeness.boundedBy, {
    criterion: 'requested-record-window',
    limitArgument: 'requestedCount',
    completeRequired: true,
  })
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.filters, [])
  assert.equal(session.expands['x-ai-routing'].analyticalCapability.argumentBindings, undefined)
  assert.deepEqual(siblingResult.outputBindings[0].ordering, {
    keys: [{ field: 'physical_score', direction: 'asc' }],
    producerGuaranteed: true,
  })
  assert.equal(
    siblingResult.outputBindings[0].fields.find((field: Record<string, unknown>) => (
      field.name === 'physical_group'
    )).axis,
    'semantic_group',
  )
})

test('bounded analytical fields enforce physical type and display-format compatibility at compile and execution', async () => {
  const compatible = createAnonymousBoundedTool([3, 2, 1], 'top_n', {
    valueField: { type: 'integer', format: 'integer' },
  }).tool as any
  assert.ok(compatible.routing.analyticalCapability)
  const compatibleResult = await compatible.execute(
    { requestedCount: 2 },
    {},
    { id: 'bounded-compatible-format', toolName: compatible.id },
  )
  assert.equal(compatibleResult.complete, true)
  assert.deepEqual(
    compatibleResult.outputBindings[0].fields.find((field: any) => field.name === 'physical_score'),
    {
      name: 'physical_score', type: 'integer', role: 'measure', format: 'integer',
      measure: 'semantic_score', unit: 'record', aggregation: 'sum',
    },
  )

  const incompatible = createAnonymousBoundedTool([3, 2, 1], 'top_n', {
    valueField: { type: 'number', format: 'integer' },
  }).tool as any
  assert.equal(incompatible.routing?.analyticalCapability, undefined)

  const runtimeFields = [
    { name: 'physical_group', type: 'string', role: 'dimension' },
    {
      name: 'physical_score', type: 'number', role: 'measure', format: 'integer',
      measure: 'semantic_score', unit: 'record', aggregation: 'sum',
    },
  ]
  const runtimeIncompatible = createAnonymousBoundedTool([3, 2, 1], 'top_n', {
    valueField: { type: 'integer', format: 'integer' },
    resolveFields: () => runtimeFields,
  }).tool as any
  assert.ok(runtimeIncompatible.routing.analyticalCapability)
  const downgraded = await runtimeIncompatible.execute(
    { requestedCount: 2 },
    {},
    { id: 'bounded-runtime-incompatible-format', toolName: runtimeIncompatible.id },
  )
  assert.equal(downgraded.complete, false)
  assert.equal(downgraded.evidence.limitReason, 'analytical_scope_unproven')
  assert.deepEqual(
    downgraded.__clientToolOutputs.output0.map((record: any) => record.physical_score),
    [3, 2],
  )
})

test('bounded analytical axis binding is explicit for static and invocation-selected dimensions', async () => {
  type Args = { requestedCount?: number; coordinateAxis: 'semantic_group' | 'alternate_group' }
  const base = anonymousBoundedDefinition('anonymous.dynamic-axis', 'top_n')
  const analytical = defineClientToolBoundedAnalyticalProducer<Args>({
    ...base,
    dimensions: ['semantic_group', 'alternate_group'],
    criterion: {
      ...base.criterion,
      axis: undefined,
      axisFromInput: 'coordinateAxis',
    },
  })
  const tool = defineClientTool<Args, Record<string, unknown>, Array<Record<string, unknown>>>({
    id: 'anonymous_dynamic_axis',
    description: { text: 'Return records for an explicitly selected axis', capabilities: ['generic.rank'] },
    inputs: [
      { id: 'requestedCount', valueType: { type: 'integer', min: 1, max: 5 }, defaultValue: 2 },
      {
        id: 'coordinateAxis',
        valueType: anonymousEnumValueType(['semantic_group', 'alternate_group']),
        required: true,
      },
    ],
    analytical,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'ranked-records',
      shape: 'generic.ranked-records',
      recordPath: '$',
      fields: [
        { name: 'physical_group', type: 'string', role: 'dimension' },
        {
          name: 'physical_score', type: 'number', role: 'measure', measure: 'semantic_score',
          unit: 'record', aggregation: 'sum',
        },
      ],
    }),
    execute: () => clientToolResult.success([{ physical_group: 'a', physical_score: 9 }]),
  })

  assert.equal(
    tool._meta.clientToolContract.outputs[0].fields.find(
      (field: Record<string, unknown>) => field.name === 'physical_group',
    ).axis,
    undefined,
  )
  const session = toAiClientToolSessionDefinition(tool) as any
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.argumentBindings, [{
    semantic: 'dimension',
    argument: 'coordinateAxis',
  }])
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.completeness.boundedBy, {
    criterion: 'requested-record-window',
    limitArgument: 'requestedCount',
    completeRequired: true,
  })
  for (const coordinateAxis of ['semantic_group', 'alternate_group'] as const) {
    const result = await tool.execute({ coordinateAxis, requestedCount: 2 }, {}, {
      id: `dynamic-${coordinateAxis}`,
      toolName: tool.id,
    }) as any
    assert.equal(result.complete, true)
    assert.equal(
      result.outputBindings[0].fields.find(
        (field: Record<string, unknown>) => field.name === 'physical_group',
      ).axis,
      coordinateAxis,
    )
  }

  const invalid = await tool.execute({ coordinateAxis: 'unknown' as any, requestedCount: 2 }, {}, {
    id: 'dynamic-invalid',
    toolName: tool.id,
  }) as any
  assert.equal(invalid.complete, false)
  assert.equal(invalid.evidence.limitReason, 'analytical_scope_unproven')
})

test('typed temporal authoring projects one canonical custom date-time edge', () => {
  const time = anonymousTemporalContract()
  const analytical = defineClientToolAnalyticalProducer<Record<string, unknown>>({
    producerKey: 'anonymous.temporal.samples',
    factKey: 'anonymous.samples',
    subjects: ['entity'],
    measures: [{ name: 'sample_count', aggregations: ['count'], units: ['record'] }],
    dimensions: ['interval'],
    filters: [],
    grains: ['hour'],
    criteria: ['summary'],
    ordering: [],
    coverage: 'complete',
    output: 'samples',
  })
  const tool = defineClientTool({
    id: 'anonymous_temporal_samples',
    description: { text: 'Return samples in one declared range', capabilities: ['generic.samples'] },
    inputs: time.inputs,
    inputAlternatives: time.inputAlternatives,
    analytical,
    temporal: time.temporal,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'samples', shape: 'anonymous.samples', recordPath: '$' }),
    execute: () => clientToolResult.success([]),
  })

  const session = toAiClientToolSessionDefinition(tool) as any
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.argumentBindings, [{
    semantic: 'temporal',
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  }])
  assert.equal((JSON.stringify(session).match(/"x-ai-routing"/g) || []).length, 1)
  assert.equal(session.expands._schema.oneOf.length, 2)
  assert.deepEqual(session.expands._schema.oneOf[1].required, ['windowMode', 'openedAt', 'closedAt'])
  assert.equal(session.expands._schema.oneOf[1].properties.windowMode.const, 'bounded')
  assert.equal(validateAiClientToolRoutingMetadata(tool).status, 'valid')
  assert.equal(validateAiClientToolRoutingMetadata(session).status, 'valid')
})

test('standard trend authoring requires exact canonical time-axis and measure bindings', () => {
  const validFields = [
    {
      name: 'observed_at', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
      encoding: 'epoch-millis', label: 'Observed at',
    },
    {
      name: 'metricValue',
      type: 'number',
      role: 'measure',
      label: 'Sample rate',
      measure: 'sample_rate',
      aggregation: 'avg',
      unit: 'percent',
    },
  ]
  const createTrend = (
    id: string,
    fields: Array<Record<string, unknown>> = validFields,
    options: {
      output?: string
      ordering?: { keys: Array<{ field: string; direction: 'asc' | 'desc' }>; producerGuaranteed: boolean }
    } = {},
  ) => defineClientTool({
    id,
    description: { text: 'Read one typed metric trend', capabilities: ['anonymous.metric.trend'] },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `anonymous.metric.${id}`,
      factKey: 'anonymous.metric-samples',
      subjects: ['anonymous-subject'],
      measures: [{ name: 'sample_rate', aggregations: ['avg'], units: ['percent'] }],
      dimensions: ['time'],
      filters: [],
      grains: [],
      criteria: ['trend'],
      ordering: [{ axis: 'observed_at', direction: 'asc' }],
      coverage: 'complete',
      output: options.output || 'metric-series',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'metric-series',
      shape: 'anonymous.metric-series',
      recordPath: '$',
      fields: fields as any,
      ordering: options.ordering || {
        keys: [{ field: 'observed_at', direction: 'asc' }],
        producerGuaranteed: true,
      },
    }),
    execute: () => clientToolResult.success([]),
  })

  const valid = createTrend('valid_standard_trend') as any
  assert.ok(valid.routing.analyticalCapability)
  assert.equal(valid.routing.analyticalCapability.output.fieldSet, undefined)
  assert.equal(valid._meta.resultBindings[0].fields[0].axis, 'time')
  assert.deepEqual(
    toAiClientToolSessionDefinition(valid).expands['x-ai-routing'].analyticalCapability,
    valid.routing.analyticalCapability,
  )

  const malformedCases = [
    createTrend('unknown_axis', validFields.map(field => (
      field.name === 'observed_at' ? { ...field, axis: 'unknown-axis' } : field
    ))),
    createTrend('duplicate_axis', [
      ...validFields,
      { name: 'secondTime', type: 'timestamp', role: 'temporal_dimension', axis: 'time', encoding: 'epoch-millis' },
    ]),
    createTrend('legacy_implicit_axis', [
      { name: 'observed_at', semanticRole: 'timestamp' },
      {
        name: 'metricValue', semanticRole: 'number', measure: 'sample_rate',
        aggregation: 'avg', unit: 'percent',
      },
    ]),
    createTrend('missing_measure', [validFields[0]]),
    createTrend('duplicate_measure', [
      ...validFields,
      {
        name: 'duplicateValue', type: 'number', role: 'measure', measure: 'sample_rate',
        aggregation: 'avg', unit: 'percent',
      },
    ]),
    createTrend('unit_mismatch', validFields.map(field => (
      field.name === 'metricValue' ? { ...field, unit: 'count' } : field
    ))),
    createTrend('aggregation_mismatch', validFields.map(field => (
      field.name === 'metricValue' ? { ...field, aggregation: 'sum' } : field
    ))),
    createTrend('output_mismatch', validFields, { output: 'foreign-series' }),
    createTrend('ordering_mismatch', validFields, {
      ordering: {
        keys: [{ field: 'observed_at', direction: 'desc' }],
        producerGuaranteed: true,
      },
    }),
  ]
  for (const tool of malformedCases) {
    assert.equal(tool.routing?.analyticalCapability, undefined, tool.id)
  }
  assert.equal(valid.routing.analyticalCapability.semanticIntentBindings, undefined)
})

test('device dynamic measures compile one fieldSet policy and keep raw rows atomically', async () => {
  type DynamicResult = {
    summary: { status: string }
    series?: Array<{ observed_at: number; metricValue: number }>
    fields: any[]
    throwResolver?: boolean
  }
  const temporalField = {
    name: 'observed_at', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
    encoding: 'epoch-millis', label: 'Observed at',
  } as const
  const validMeasureField = {
    name: 'metricValue', type: 'number', role: 'measure', label: 'Temperature',
    measure: 'temperature', aggregation: 'avg', unit: 'celsius',
  } as const
  const createTool = (
    id: string,
    units: string[] = [],
  ) => defineClientTool<Record<string, unknown>, Record<string, unknown>, DynamicResult>({
    id,
    description: { text: 'Read one dynamic typed trend', capabilities: ['anonymous.dynamic.trend'] },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `anonymous.dynamic.${id}`,
      factKey: 'anonymous.dynamic-values',
      subjects: ['anonymous-subject'],
      measures: [{ name: 'device_metric', aggregations: ['avg', 'sum'], units }],
      dimensions: ['time'],
      filters: [],
      grains: [],
      criteria: ['trend'],
      ordering: [{ axis: 'observed_at', direction: 'asc' }],
      coverage: 'complete',
      output: 'dynamic-metric-series',
      outputFields: 'execution-authored',
    }),
    effect: { kind: 'READ' },
    output: [
      clientToolOutput.detail<DynamicResult>({
        name: 'ordinary-summary',
        shape: 'anonymous.dynamic-summary',
        select: result => result.summary,
      }),
      clientToolOutput.aggregateSeries<DynamicResult>({
        name: 'dynamic-metric-series',
        shape: 'anonymous.dynamic-series',
        recordPath: '$',
        fields: [temporalField],
        ordering: {
          keys: [{ field: 'observed_at', direction: 'asc' }],
          producerGuaranteed: true,
        },
        optional: true,
        select: result => result.series,
        resolveFields: result => {
          if (result.throwResolver) throw new Error('resolver failed')
          return result.fields
        },
      }),
    ],
    execute: args => args.result as DynamicResult,
  }) as any

  const tool = createTool('valid_execution_authored_trend')
  assert.ok(tool.routing.analyticalCapability)
  assert.deepEqual(tool.routing.analyticalCapability.output, {
    shape: 'anonymous.dynamic-series',
    fieldSet: { mode: 'execution-authored', measureCoordinates: 'execution-authored', maxFields: 33 },
  })
  assert.deepEqual(tool.routing.analyticalCapability.measures[0].units, [])
  const session = toAiClientToolSessionDefinition(tool) as any
  assert.equal((JSON.stringify(session).match(/"x-ai-routing"/g) || []).length, 1)
  assert.deepEqual(
    session.expands['x-ai-routing'].analyticalCapability,
    tool.routing.analyticalCapability,
  )

  const execute = async (fields: any[], includeSeries = true) => {
    const result: DynamicResult = {
      summary: { status: 'ok' },
      fields,
      ...(includeSeries ? {
        series: [{ observed_at: 1_785_387_600_000, metricValue: 12 }],
      } : {}),
    }
    return tool.execute(
      { result },
      {},
      { id: 'dynamic-execution', toolName: tool.id },
    )
  }
  const assertUnprovenDynamicOutput = (
    prepared: any,
    rows: Array<Record<string, unknown>> = [{ observed_at: 1_785_387_600_000, metricValue: 12 }],
  ) => {
    assert.equal(prepared.success, true)
    assert.equal(prepared.complete, true)
    assert.deepEqual(prepared.outputBindings.map((binding: any) => binding.name), [
      'ordinary-summary', 'dynamic-metric-series',
    ])
    assert.deepEqual(prepared.__clientToolOutputs.output0, { status: 'ok' })
    assert.deepEqual(prepared.__clientToolOutputs.output1, rows)
    const binding = prepared.outputBindings[1]
    assert.equal(binding.fields, undefined)
    assert.equal(binding.ordering, undefined)
    assert.equal(binding.path, '$.__clientToolOutputs.output1')
    assert.equal(binding.recordPath, '$')
    assert.equal(binding.shape, 'anonymous.dynamic-series')
    assert.equal(binding.recordCount, rows.length)
    assert.equal(binding.complete, true)
    assert.deepEqual(prepared.evidence.outputBindings, prepared.outputBindings)
  }

  const valid = await execute([temporalField, validMeasureField]) as any
  assert.deepEqual(valid.outputBindings.map((binding: any) => binding.name), [
    'ordinary-summary',
    'dynamic-metric-series',
  ])
  assert.deepEqual(valid.outputBindings[1].fields, [temporalField, validMeasureField])
  assert.deepEqual(valid.__clientToolOutputs.output1, [
    { observed_at: 1_785_387_600_000, metricValue: 12 },
  ])

  const compatibleIntegerField = {
    ...validMeasureField,
    type: 'integer',
    format: 'integer',
  } as const
  const compatibleInteger = await execute([temporalField, compatibleIntegerField]) as any
  assert.deepEqual(compatibleInteger.outputBindings[1].fields, [temporalField, compatibleIntegerField])
  assert.deepEqual(compatibleInteger.outputBindings[1].ordering, {
    keys: [{ field: 'observed_at', direction: 'asc' }],
    producerGuaranteed: true,
  })

  const invalidFields = [
    [{ name: 'observed_at', semanticRole: 'timestamp' }, validMeasureField],
    [{ name: 'category', type: 'string', role: 'dimension', axis: 'category', label: 'Category' }],
    [temporalField],
    [temporalField, validMeasureField, { ...validMeasureField, name: 'duplicateMeasure', label: 'Other' }],
    [temporalField, validMeasureField, { ...validMeasureField, name: 'duplicateValue', measure: 'humidity' }],
    [temporalField, validMeasureField, { ...validMeasureField, name: 'anotherValue', measure: 'humidity', label: 'Temperature' }],
    [temporalField, { ...validMeasureField, aggregation: 'max' }],
    [temporalField, { ...validMeasureField, aggregation: undefined }],
    [temporalField, { ...validMeasureField, unit: undefined }],
    [temporalField, { ...validMeasureField, label: undefined }],
    [temporalField, { ...validMeasureField, format: 'integer' }],
    [{ ...temporalField, axis: 'other_time' }, validMeasureField],
  ]
  for (const fields of invalidFields) {
    const downgraded = await execute(fields as any[]) as any
    assertUnprovenDynamicOutput(downgraded)
  }

  const missing = await execute([], false) as any
  assert.equal(missing.success, true)
  assert.equal(missing.complete, true)
  assert.deepEqual(missing.outputBindings.map((binding: any) => binding.name), ['ordinary-summary'])

  const resolverFailure = await tool.execute(
    {
      result: {
        summary: { status: 'ok' },
        series: [{ observed_at: 1_785_387_600_000, metricValue: 12 }],
        fields: [temporalField, validMeasureField],
        throwResolver: true,
      },
    },
    {},
    { id: 'resolver-failure', toolName: tool.id },
  ) as any
  assertUnprovenDynamicOutput(resolverFailure)

  const maxMembers = Array.from({ length: 32 }, (_, index) => ({
    ...validMeasureField,
    name: `metric${index}`,
    measure: `metric_${index}`,
    label: `Metric ${index}`,
  }))
  const maxRows = [{
    observed_at: 1_785_387_600_000,
    ...Object.fromEntries(maxMembers.map((field, index) => [field.name, index])),
  }]
  const maxFamilyResult = await tool.execute(
    { result: { summary: { status: 'ok' }, series: maxRows, fields: [temporalField, ...maxMembers] } },
    {},
    { id: 'max-family-members', toolName: tool.id },
  ) as any
  assert.equal(maxFamilyResult.outputBindings[1].fields.length, 33)
  assert.strictEqual(maxFamilyResult.__clientToolOutputs.output1, maxRows)

  const overflowMembers = Array.from({ length: 33 }, (_, index) => ({
    ...validMeasureField,
    name: `metric${index}`,
    measure: `metric_${index}`,
    label: `Metric ${index}`,
  }))
  const overflow = await execute([temporalField, ...overflowMembers]) as any
  assertUnprovenDynamicOutput(overflow)

  const fixedUnit = createTool('fixed_unit_execution_authored_trend', ['percent'])
  const fixedUnitResult = await fixedUnit.execute(
    {
      result: {
        summary: { status: 'ok' },
        series: [{ observed_at: 1_785_387_600_000, metricValue: 12 }],
        fields: [temporalField, validMeasureField],
      },
    },
    {},
    { id: 'fixed-unit', toolName: fixedUnit.id },
  ) as any
  assertUnprovenDynamicOutput(fixedUnitResult)

  const staticMeasureField = { ...validMeasureField, measure: 'device_metric' }
  const staticInvalidTool = defineClientTool<Record<string, unknown>, Record<string, unknown>, DynamicResult>({
    id: 'static_invalid_execution_fields',
    description: { text: 'Keep static analytical output fail-closed', capabilities: ['anonymous.static.trend'] },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: 'anonymous.static.invalid-fields',
      factKey: 'anonymous.static-values',
      subjects: ['anonymous-subject'],
      measures: [{ name: 'device_metric', aggregations: ['avg'], units: ['celsius'] }],
      dimensions: ['time'],
      filters: [],
      grains: [],
      criteria: ['trend'],
      ordering: [{ axis: 'observed_at', direction: 'asc' }],
      coverage: 'complete',
      output: 'static-metric-series',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries<DynamicResult>({
      name: 'static-metric-series',
      shape: 'anonymous.static-series',
      recordPath: '$',
      fields: [temporalField, staticMeasureField],
      ordering: {
        keys: [{ field: 'observed_at', direction: 'asc' }],
        producerGuaranteed: true,
      },
      select: result => result.series,
      resolveFields: () => [temporalField, { ...staticMeasureField, name: 'observed_at' }],
    }),
    execute: args => args.result as DynamicResult,
  }) as any
  await assert.rejects(
    staticInvalidTool.execute(
      {
        result: {
          summary: { status: 'ok' },
          series: [{ observed_at: 1_785_387_600_000, metricValue: 12 }],
          fields: [temporalField, staticMeasureField],
        },
      },
      {},
      { id: 'static-invalid-fields', toolName: staticInvalidTool.id },
    ),
    /output selection failed/,
  )

  const twoMeasures = [
    temporalField,
    validMeasureField,
    { ...validMeasureField, name: 'humidityValue', measure: 'humidity', label: 'Humidity' },
  ]
  const twoMeasureRows = [{ observed_at: 1_785_387_600_000, metricValue: 12, humidityValue: 70 }]
  const twoMeasureResult = await tool.execute(
    { result: { summary: { status: 'ok' }, series: twoMeasureRows, fields: twoMeasures } },
    {},
    { id: 'two-measures', toolName: tool.id },
  ) as any
  assert.deepEqual(twoMeasureResult.outputBindings.map((binding: any) => binding.name), [
    'ordinary-summary', 'dynamic-metric-series',
  ])
  assert.strictEqual(twoMeasureResult.__clientToolOutputs.output1, twoMeasureRows)

  const threeMeasures = [
    ...twoMeasures,
    { ...validMeasureField, name: 'pressureValue', measure: 'pressure', label: 'Pressure' },
  ]
  const threeMeasureRows = [{
    observed_at: 1_785_387_600_000, metricValue: 12, humidityValue: 70, pressureValue: 101.3,
  }]
  const threeMeasureResult = await tool.execute(
    { result: { summary: { status: 'ok' }, series: threeMeasureRows, fields: threeMeasures } },
    {},
    { id: 'three-measures', toolName: tool.id },
  ) as any
  assert.deepEqual(threeMeasureResult.outputBindings[1].fields, threeMeasures)
  assert.strictEqual(threeMeasureResult.__clientToolOutputs.output1, threeMeasureRows)
})

test('execution-authored analytical authoring rejects non-optional or structurally dynamic output contracts', () => {
  const temporalField = {
    name: 'observed_at', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
    encoding: 'epoch-millis', label: 'Observed at',
  } as const
  const createTool = (id: string, output: Record<string, unknown>, outputFields: unknown = 'execution-authored') => (
    defineClientTool({
      id,
      description: { text: 'Reject a malformed dynamic trend', capabilities: ['anonymous.dynamic.trend'] },
      analytical: defineClientToolAnalyticalProducer({
        producerKey: `anonymous.dynamic.invalid.${id}`,
        factKey: 'anonymous.dynamic-invalid-values',
        subjects: ['anonymous-subject'],
        measures: [{ name: 'dynamic_value', aggregations: ['avg'], units: [] }],
        dimensions: ['time'],
        filters: [],
        grains: [],
        criteria: ['trend'],
        ordering: [{ axis: 'observed_at', direction: 'asc' }],
        coverage: 'complete',
        output: 'dynamic-metric-series',
        outputFields,
      } as any),
      effect: { kind: 'READ' },
      output: clientToolOutput.aggregateSeries({
        name: 'dynamic-metric-series',
        shape: 'anonymous.dynamic-series',
        recordPath: '$',
        fields: [temporalField],
        ordering: {
          keys: [{ field: 'observed_at', direction: 'asc' }],
          producerGuaranteed: true,
        },
        optional: true,
        resolveFields: () => [temporalField],
        ...output,
      } as any),
      execute: () => [],
    }) as any
  )

  const malformed = [
    createTool('execution_fields_required_output', { optional: false }),
    createTool('execution_fields_missing_resolver', { resolveFields: undefined }),
    createTool('execution_fields_non_exact_record_path', { recordPath: '$.series[*]' }),
    createTool('execution_fields_dynamic_order', {
      ordering: { keys: [{ field: 'observed_at', direction: 'desc' }], producerGuaranteed: true },
    }),
    createTool('execution_fields_static_measure', {
      fields: [
        temporalField,
        {
          name: 'metricValue', type: 'number', role: 'measure', label: 'Value',
          measure: 'value', aggregation: 'avg', unit: 'count',
        },
      ],
    }),
    createTool('execution_fields_unknown_mode', {}, 'runtime-inferred'),
  ]
  malformed.forEach((tool) => assert.equal(tool.routing?.analyticalCapability, undefined, tool.id))
  assert.throws(
    () => createTool('execution_fields_missing_record_path', { recordPath: undefined }),
    /canonical client tool output fields require an explicit recordPath/i,
  )
})

test('execution-authored fieldSet rejects unknown policy keys and retired measure selection', () => {
  const routingBase = {
    capabilities: ['generic.policy'],
    stages: ['execution'],
  }
  const capability = {
    version: 'analytical-capability/v1',
    capabilityId: 'generic.policy',
    semanticKey: 'generic.policy',
    subjects: ['entity'],
    measures: [{ name: 'metric_family', aggregations: ['avg'], units: [] }],
    dimensions: ['time'], filters: [], grains: [], criteria: ['trend'],
    ordering: [{ axis: 'observed_at', direction: 'asc', producerGuaranteed: true }],
    completeness: { complete: true, partial: false, continuation: false },
    output: {
      shape: 'generic.policy-series',
      fieldSet: { mode: 'execution-authored', measureCoordinates: 'execution-authored', maxFields: 33 },
    },
    transformCost: 0,
  }
  const valid = toAiClientToolSessionDefinition({
    id: 'generic_policy_valid', description: 'Validate one dynamic policy',
    routing: { ...routingBase, analyticalCapability: capability } as any,
  }) as any
  assert.deepEqual(valid.expands['x-ai-routing'].analyticalCapability.output, capability.output)

  for (const [index, invalid] of [
    { ...capability, output: { ...capability.output, fieldSet: { ...capability.output.fieldSet, mode: 'runtime' } } },
    { ...capability, output: { ...capability.output, fieldSet: { ...capability.output.fieldSet, measureCoordinates: 'unknown' } } },
    { ...capability, output: { ...capability.output, fieldSet: { ...capability.output.fieldSet, maxFields: 34 } } },
    { ...capability, measures: [{ ...capability.measures[0], selection: 'execution-authored' }] },
  ].entries()) {
    const rejected = toAiClientToolSessionDefinition({
      id: `generic_policy_invalid_${index}`, description: 'Reject invalid dynamic policy',
      routing: { ...routingBase, analyticalCapability: invalid } as any,
    }) as any
    assert.equal(rejected.expands?.['x-ai-routing'], undefined)
  }
})

test('execution-authored coordinates remain generic for passenger, rank, temporal and portrait outputs', async () => {
  type GenericResult = { summary: { status: string }; rows?: Array<Record<string, unknown>>; fields: any[] }
  const time = {
    name: 'observed_at', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
    encoding: 'epoch-millis', label: 'Observed at',
  } as const
  const createTool = (options: {
    id: string
    measures: Array<{ name: string; aggregations: string[]; units: string[] }>
    dimensions: string[]
    criteria: string[]
    staticFields: any[]
    ordering?: { keys: Array<{ field: string; direction: 'asc' | 'desc' }>; producerGuaranteed: boolean }
  }) => defineClientTool<Record<string, unknown>, Record<string, unknown>, GenericResult>({
    id: options.id,
    description: { text: 'Read generic analytical coordinates', capabilities: ['generic.coordinates'] },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `generic.${options.id}`,
      factKey: 'generic.coordinates',
      subjects: ['entity'],
      measures: options.measures,
      dimensions: options.dimensions,
      filters: [], grains: [], criteria: options.criteria,
      ordering: options.ordering?.keys.map(key => ({ axis: key.field, direction: key.direction })) || [],
      coverage: 'complete', output: 'analytical-records', outputFields: 'execution-authored',
    }),
    effect: { kind: 'READ' },
    output: [
      clientToolOutput.detail<GenericResult>({
        name: 'ordinary-summary', shape: 'generic.summary', select: result => result.summary,
      }),
      clientToolOutput.recordSet<GenericResult>({
        name: 'analytical-records', shape: 'generic.records', recordPath: '$', fields: options.staticFields,
        ...(options.ordering ? { ordering: options.ordering } : {}),
        optional: true, select: result => result.rows, resolveFields: result => result.fields,
      }),
    ],
    execute: args => args.result as GenericResult,
  }) as any
 const execute = (tool: any, fields: any[], rows: Array<Record<string, unknown>>) => tool.execute(
   { result: { summary: { status: 'ok' }, rows, fields } },
   {},
   { id: `generic-${tool.id}`, toolName: tool.id },
 )
  const assertUnprovenFields = (result: any) => {
    assert.deepEqual(result.outputBindings.map((binding: any) => binding.name), [
      'ordinary-summary', 'analytical-records',
    ])
    assert.equal(result.outputBindings[1].fields, undefined)
  }

  const passenger = createTool({
    id: 'passenger_trend',
    measures: [
      { name: 'passenger_count', aggregations: ['sum'], units: ['person'] },
      { name: 'record_count', aggregations: ['count'], units: ['record'] },
    ],
    dimensions: ['time'], criteria: ['trend'], staticFields: [time],
    ordering: { keys: [{ field: 'observed_at', direction: 'asc' }], producerGuaranteed: true },
  })
  assert.deepEqual(passenger.routing.analyticalCapability.output.fieldSet, {
    mode: 'execution-authored', measureCoordinates: 'exact', maxFields: 33,
  })
  const passengerRows = [{ observed_at: 1_785_387_600_000, passengers: 42, recordCount: 7 }]
  const passengerFields = [time, {
    name: 'passengers', type: 'number', role: 'measure', label: 'Passengers',
    measure: 'passenger_count', aggregation: 'sum', unit: 'person',
  }]
  const passengerResult = await execute(passenger, passengerFields, passengerRows) as any
  assert.deepEqual(passengerResult.outputBindings[1].fields, passengerFields)
  assert.strictEqual(passengerResult.__clientToolOutputs.output1, passengerRows)
  const passengerWrongMeasure = await execute(passenger, [time, {
    ...passengerFields[1], measure: 'unrelated_count', label: 'Unrelated',
  }], passengerRows) as any
  assertUnprovenFields(passengerWrongMeasure)

  const rank = createTool({
    id: 'passenger_rank',
    measures: [
      { name: 'passenger_count', aggregations: ['sum'], units: ['person'] },
      { name: 'record_count', aggregations: ['count'], units: ['record'] },
    ],
    dimensions: ['station'], criteria: ['rank'], staticFields: [],
  })
  const rankFields = [
    { name: 'station', type: 'string', role: 'dimension', axis: 'station', label: 'Station' },
    { name: 'passengers', type: 'number', role: 'measure', label: 'Passengers',
      measure: 'passenger_count', aggregation: 'sum', unit: 'person' },
  ]
  const rankResult = await execute(rank, rankFields, [{ station: 'A', passengers: 42 }]) as any
  assert.deepEqual(rankResult.outputBindings[1].fields, rankFields)

  const temporal = createTool({
    id: 'temporal_weekday',
    measures: [
      { name: 'passenger_count', aggregations: ['sum'], units: ['person'] },
      { name: 'record_count', aggregations: ['count'], units: ['record'] },
    ],
    dimensions: ['time', 'weekday', 'hour'], criteria: ['trend'], staticFields: [time],
    ordering: { keys: [{ field: 'observed_at', direction: 'asc' }], producerGuaranteed: true },
  })
  const weekdayFields = [
    time,
    { name: 'weekday', type: 'string', role: 'dimension', axis: 'weekday', label: 'Weekday' },
    passengerFields[1],
  ]
  const weekdayResult = await execute(temporal, weekdayFields, [{
    observed_at: 1_785_387_600_000, weekday: 'monday', passengers: 42,
  }]) as any
  assert.equal(weekdayResult.outputBindings[1].fields[1].axis, 'weekday')
  const hourAxis = await execute(temporal, [
    ...weekdayFields,
    { name: 'hour', type: 'timestamp', role: 'temporal_dimension', axis: 'hour', encoding: 'epoch-millis' },
  ], [{ observed_at: 1_785_387_600_000, weekday: 'monday', hour: 1_785_387_600_000, passengers: 42 }]) as any
  assertUnprovenFields(hourAxis)

  const portrait = createTool({
    id: 'portrait_group_by',
    measures: [
      { name: 'portrait_count', aggregations: ['sum'], units: ['person'] },
      { name: 'record_count', aggregations: ['count'], units: ['record'] },
    ],
    dimensions: ['group-by'], criteria: ['comparison'], staticFields: [],
  })
  const portraitFields = [
    { name: 'group', type: 'string', role: 'dimension', axis: 'group-by', label: 'Group' },
    { name: 'people', type: 'number', role: 'measure', label: 'People',
      measure: 'portrait_count', aggregation: 'sum', unit: 'person' },
  ]
  const portraitResult = await execute(portrait, portraitFields, [{ group: 'adult', people: 9 }]) as any
  assert.equal(portraitResult.outputBindings[1].fields[0].axis, 'group-by')
  const portraitWrongAxis = await execute(portrait, [
    { ...portraitFields[0], axis: 'undeclared-group' }, portraitFields[1],
  ], [{ group: 'adult', people: 9 }]) as any
  assertUnprovenFields(portraitWrongAxis)
})

test('typed semantic intent bindings stay declaration-local and fail closed on coordinate drift', () => {
  const primaryIntent = 'inspect anonymous rate movement'
  const alternateIntent = 'review anonymous rate movement'
  const createTool = (
    id: string,
    bindings: unknown,
    intents: readonly string[] = [primaryIntent, alternateIntent],
  ) => defineClientTool({
    id,
    description: {
      text: 'Read one anonymous typed trend',
      capabilities: ['anonymous.intent-bound-trend'],
      intents,
    },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `anonymous.intent.${id}`,
      factKey: 'anonymous.intent-facts',
      subjects: ['anonymous-subject'],
      measures: [{ name: 'rate_value', aggregations: ['avg'], units: ['percent'] }],
      dimensions: ['time', 'segment'],
      filters: [],
      grains: [],
      criteria: ['trend', 'comparison'],
      ordering: [{ axis: 'observed_at', direction: 'asc' }],
      coverage: 'complete',
      output: 'anonymous-intent-series',
      ...(bindings === undefined ? {} : { semanticIntentBindings: bindings }),
    } as any),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'anonymous-intent-series',
      shape: 'anonymous.intent-series',
      recordPath: '$',
      fields: [
        {
          name: 'observed_at', type: 'timestamp', role: 'temporal_dimension', axis: 'time',
          encoding: 'epoch-millis', label: 'Observed at',
        },
        {
          name: 'rate', type: 'number', role: 'measure', label: 'Anonymous rate',
          measure: 'rate_value', aggregation: 'avg', unit: 'percent',
        },
      ],
      ordering: {
        keys: [{ field: 'observed_at', direction: 'asc' }],
        producerGuaranteed: true,
      },
    }),
    execute: () => clientToolResult.success([]),
  }) as any

  const coordinates = {
    criterion: 'trend',
    measures: ['rate_value'],
    dimensions: ['time'],
  }
  const valid = createTool('valid_semantic_intent', [
    { intent: primaryIntent, ...coordinates },
    { intent: alternateIntent, ...coordinates },
  ])
  const expectedBindings = [
    { intent: primaryIntent, ...coordinates },
    { intent: alternateIntent, ...coordinates },
  ]
  assert.deepEqual(valid.routing.analyticalCapability.semanticIntentBindings, expectedBindings)
  assert.deepEqual(valid.routing.intents, [primaryIntent, alternateIntent])
  const session = toAiClientToolSessionDefinition(valid) as any
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.semanticIntentBindings, expectedBindings)
  assert.equal((JSON.stringify(session).match(/"x-ai-routing"/g) || []).length, 1)

  const malformedBindings = [
    [{ intent: 'foreign sibling intent', ...coordinates }],
    [{ intent: primaryIntent, ...coordinates }, { intent: primaryIntent, ...coordinates }],
    [{ intent: primaryIntent, ...coordinates, criterion: 'distribution' }],
    [{ intent: primaryIntent, ...coordinates, measures: ['foreign_measure'] }],
    [{ intent: primaryIntent, ...coordinates, dimensions: ['foreign_dimension'] }],
    [{ intent: primaryIntent, ...coordinates, measures: [] }],
    [{ intent: primaryIntent, ...coordinates, dimensions: [] }],
    [{ intent: primaryIntent, ...coordinates, measures: ['rate_value', 'rate_value'] }],
    [{ intent: primaryIntent, ...coordinates, dimensions: ['time', 'time'] }],
    [{ intent: primaryIntent, criterion: 'trend', measures: ['rate_value'] }],
  ]
  for (const [index, bindings] of malformedBindings.entries()) {
    const malformed = createTool(`malformed_semantic_intent_${index}`, bindings)
    assert.equal(malformed.routing?.analyticalCapability, undefined, malformed.id)
  }

  const legacy = createTool('legacy_semantic_intent_absent', undefined)
  assert.equal(legacy.routing.analyticalCapability.semanticIntentBindings, undefined)

  const [crossSibling, validSibling] = toAiClientToolSessionDefinitions([{
    id: 'cross_sibling_semantic_intent',
    description: 'Do not borrow another declaration intent',
    routing: { ...valid.routing, intents: ['different declaration intent'] },
  }, legacy]) as any[]
  assert.equal(crossSibling.expands?.['x-ai-routing'], undefined)
  assert.ok(validSibling.expands['x-ai-routing'].analyticalCapability)
  assert.equal(validSibling.expands['x-ai-routing'].analyticalCapability.semanticIntentBindings, undefined)
})

test('typed measure selector compiles as optional closed enum and stays model-projected only', async () => {
  type Args = {
    selectedMetric: string
    status?: string
    groupAxis?: string
    measure?: string
  }
  const intent = 'summarize one selected public metric'
  const selectableMeasures = ['public_primary', 'public_secondary'] as const
  let observedArguments: Record<string, unknown> | undefined
  let observedCallArguments: Record<string, unknown> | undefined
  const tool = defineClientTool<Args>({
    id: 'anonymous_measure_selector',
    description: {
      text: 'Return one analytical summary with a typed measure selector',
      capabilities: ['anonymous.measure.summary'],
      intents: [intent],
    },
    inputs: [{
      id: 'selectedMetric', required: false, valueType: anonymousEnumValueType(selectableMeasures),
    }, {
      id: 'status', valueType: 'string',
    }, {
      id: 'measure', valueType: 'string',
    }],
    analytical: defineClientToolAnalyticalProducer<Args>({
      producerKey: 'anonymous.measure.selector',
      factKey: 'anonymous.measure-facts',
      subjects: ['anonymous-subject'],
      measures: [
        { name: 'public_primary', aggregations: ['sum'], units: ['record'] },
        { name: 'public_secondary', aggregations: ['sum'], units: ['record'] },
        { name: 'internal_record_count', aggregations: ['count'], units: ['record'] },
      ],
      dimensions: ['segment'],
      filters: ['status'],
      filterBindings: [{ axis: 'status', operator: 'eq', valueArgument: 'status' }],
      grains: [],
      criteria: ['summary'],
      semanticIntentBindings: [{
        intent,
        criterion: 'summary',
        measures: selectableMeasures,
        dimensions: ['segment'],
      }],
      measureSelector: 'selectedMetric',
      ordering: [],
      coverage: 'complete',
      output: 'measure-summary',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'measure-summary',
      shape: 'anonymous.measure-summary',
      recordPath: '$',
      fields: [
        { name: 'segment', type: 'string', role: 'dimension', axis: 'segment' },
        { name: 'primary', type: 'integer', role: 'measure', label: 'Primary', measure: 'public_primary', aggregation: 'sum', unit: 'record' },
        { name: 'secondary', type: 'integer', role: 'measure', label: 'Secondary', measure: 'public_secondary', aggregation: 'sum', unit: 'record' },
        { name: 'records', type: 'integer', role: 'measure', label: 'Records', measure: 'internal_record_count', aggregation: 'count', unit: 'record' },
      ],
    }),
    execute: (args, _context, call) => {
      observedArguments = { ...args }
      observedCallArguments = { ...call.arguments }
      return clientToolResult.success({ segment: 'all', primary: 1, secondary: 2, records: 3 })
    },
  }) as any

  const measureBinding = {
    semantic: 'measure',
    argument: 'selectedMetric',
    valueCardinality: 'exactly-one',
    encoding: 'single-string',
  }
  assert.deepEqual(tool.routing.analyticalCapability.argumentBindings, [
    measureBinding,
    {
      semantic: 'filter', axis: 'status', operator: 'eq', valueArgument: 'status',
      valueCardinality: 'exactly-one', encoding: 'scalar',
    },
  ])
  const selectorInput = tool.inputs.find((input: Record<string, unknown>) => input.id === 'selectedMetric')
  assert.equal(selectorInput.required, false)
  assert.equal(Object.hasOwn(selectorInput, 'defaultValue'), false)
  assert.deepEqual(selectorInput.valueType, anonymousEnumValueType(selectableMeasures))
  const session = toAiClientToolSessionDefinition(tool) as any
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.argumentBindings[0], measureBinding)
  assert.equal(validateAiClientToolRoutingMetadata(tool).status, 'valid')
  assert.equal(validateAiClientToolRoutingMetadata(session).status, 'valid')

  const executable = {
    ...tool,
    inputs: [...tool.inputs, { id: 'groupAxis', valueType: anonymousEnumValueType(['segment']) }],
    routing: {
      ...tool.routing,
      analyticalCapability: {
        ...tool.routing.analyticalCapability,
        argumentBindings: [
          { semantic: 'dimension', argument: 'groupAxis' },
          ...tool.routing.analyticalCapability.argumentBindings,
        ],
      },
    },
  }
  const businessArguments = toAiClientToolBusinessArguments(executable, {
    selectedMetric: 'public_primary',
    groupAxis: 'segment',
    status: 'open',
    measure: 'ordinary-business-value',
  })
  await tool.execute(businessArguments, {}, {
    id: 'measure-selector-execution',
    toolName: executable.id,
    arguments: businessArguments,
  })
  assert.deepEqual(observedArguments, {
    groupAxis: 'segment', status: 'open', measure: 'ordinary-business-value',
  })
  assert.deepEqual(observedCallArguments, observedArguments)
})

test('optional measure selector keeps its closed enum schema without suppressing a valid sibling', () => {
  const intent = 'summarize one selected public metric'
  const selectableMeasures = ['public_primary', 'public_secondary'] as const
  const tool = defineClientTool({
    id: 'measure_selector_wire',
    description: {
      text: 'Validate one measure selector wire',
      capabilities: ['anonymous.measure.summary'],
      intents: [intent],
    },
    inputs: [{
      id: 'selectedMetric', required: false, valueType: anonymousEnumValueType(selectableMeasures),
    }],
    analytical: defineClientToolAnalyticalProducer({
      producerKey: 'anonymous.measure.wire',
      factKey: 'anonymous.measure-facts',
      subjects: ['anonymous-subject'],
      measures: [
        { name: 'public_primary', aggregations: ['sum'], units: ['record'] },
        { name: 'public_secondary', aggregations: ['sum'], units: ['record'] },
        { name: 'internal_record_count', aggregations: ['count'], units: ['record'] },
      ],
      dimensions: ['segment'], filters: [], grains: [], criteria: ['summary'], ordering: [],
      semanticIntentBindings: [{
        intent, criterion: 'summary', measures: selectableMeasures, dimensions: ['segment'],
      }],
      measureSelector: 'selectedMetric',
      coverage: 'complete',
      output: 'measure-wire',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'measure-wire', shape: 'anonymous.measure-wire', recordPath: '$',
      fields: [
        { name: 'segment', type: 'string', role: 'dimension', axis: 'segment' },
        { name: 'primary', type: 'integer', role: 'measure', label: 'Primary', measure: 'public_primary', aggregation: 'sum', unit: 'record' },
        { name: 'secondary', type: 'integer', role: 'measure', label: 'Secondary', measure: 'public_secondary', aggregation: 'sum', unit: 'record' },
        { name: 'records', type: 'integer', role: 'measure', label: 'Records', measure: 'internal_record_count', aggregation: 'count', unit: 'record' },
      ],
    }),
    execute: () => clientToolResult.success({ segment: 'all', primary: 1, secondary: 2, records: 3 }),
  }) as any
  const capability = tool.routing.analyticalCapability
  const binding = capability.argumentBindings[0]
  assert.equal(tool.inputs[0].required, false)
  assert.equal(Object.hasOwn(tool.inputs[0], 'defaultValue'), false)
  const malformedCases = [{
    capability: { ...capability, argumentBindings: [{ ...binding, valueCardinality: 'zero-or-one' }] },
  }, {
    capability: { ...capability, argumentBindings: [{ ...binding, encoding: 'scalar' }] },
  }, {
    capability: { ...capability, argumentBindings: [{ ...binding, extra: true }] },
  }, {
    capability: { ...capability, argumentBindings: [binding, binding] },
  }, {
    inputs: [{ id: 'selectedMetric', required: false, defaultValue: 'public_primary', valueType: anonymousEnumValueType(selectableMeasures) }],
  }, {
    inputs: [{ id: 'selectedMetric', required: false, valueType: 'string' }],
  }, {
    inputs: [{ id: 'selectedMetric', required: false, valueType: anonymousEnumValueType(['public_primary']) }],
  }, {
    inputs: [{
      id: 'selectedMetric', required: false,
      valueType: anonymousEnumValueType([...selectableMeasures, 'internal_record_count']),
    }],
  }]
  for (const [index, malformedCase] of malformedCases.entries()) {
    const [malformed, sibling] = toAiClientToolSessionDefinitions([{
      ...tool,
      id: `measure_selector_malformed_${index}`,
      inputs: malformedCase.inputs || tool.inputs,
      routing: {
        ...tool.routing,
        analyticalCapability: malformedCase.capability || capability,
      },
    }, tool]) as any[]
    assert.equal(malformed.expands?.['x-ai-routing'], undefined, String(index))
    assert.ok(sibling.expands['x-ai-routing'].analyticalCapability, String(index))
  }
})

test('typed semantic intents reference one closed scope binding without granting scope to siblings', () => {
  const intent = 'inspect one scoped anonymous aggregate'
  const baseScope = anonymousScopeContract()
  const scopeSelection = {
    binding: 'scope',
    modes: ['project', 'explicit'],
  } as const
  const createTool = (
    id: string,
    selection: unknown,
    options: {
      includeScope?: boolean
      inputs?: ClientToolInput[]
      consumes?: ClientToolConsumedResource[]
      inputAlternatives?: ClientToolInputAlternative[]
      intents?: readonly string[]
    } = {},
  ) => defineClientTool({
    id,
    description: {
      text: 'Read one anonymous scoped aggregate',
      capabilities: ['anonymous.scope.aggregate'],
      intents: options.intents || [intent],
    },
    inputs: options.inputs || baseScope.inputs,
    inputAlternatives: options.inputAlternatives || baseScope.inputAlternatives,
    consumes: options.consumes || baseScope.consumes,
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `anonymous.scope-intent.${id}`,
      factKey: 'anonymous.scope-intent-facts',
      subjects: ['anonymous-subject'],
      measures: [{ name: 'event_count', aggregations: ['sum'], units: ['record'] }],
      dimensions: ['segment'],
      filters: [],
      grains: [],
      criteria: ['summary'],
      semanticIntentBindings: [{
        intent,
        criterion: 'summary',
        measures: ['event_count'],
        dimensions: ['segment'],
        ...(selection === undefined ? {} : { scopeSelection: selection }),
      }] as any,
      ordering: [],
      coverage: 'complete',
      output: 'scope-intent-records',
    }),
    ...(options.includeScope === false ? {} : { scope: baseScope.scope }),
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'scope-intent-records',
      shape: 'anonymous.scope-intent-records',
      recordPath: '$',
    }),
    execute: () => clientToolResult.success([]),
  }) as any

  const valid = createTool('valid_scope_selection', scopeSelection)
  const capability = valid.routing.analyticalCapability
  assert.deepEqual(capability.semanticIntentBindings, [{
    intent,
    criterion: 'summary',
    measures: ['event_count'],
    dimensions: ['segment'],
    scopeSelection,
  }])
  assert.equal(
    capability.argumentBindings.filter((binding: Record<string, unknown>) => binding.semantic === 'scope').length,
    1,
  )
  const session = toAiClientToolSessionDefinition(valid) as any
  assert.deepEqual(
    session.expands['x-ai-routing'].analyticalCapability,
    capability,
  )
  assert.deepEqual(
    session.expands['x-ai-routing'].analyticalCapability.argumentBindings.find(
      (binding: Record<string, unknown>) => binding.semantic === 'scope',
    ),
    {
      semantic: 'scope',
      modeArgument: 'scopeMode',
      valueCardinality: 'exactly-one',
      encoding: 'single-string',
      coordinates: [
        { type: 'project', arguments: [] },
        { type: 'area', sourcePort: 'coordinate-alpha', arguments: ['scopeAlpha'] },
        { type: 'point', sourcePort: 'coordinate-beta', arguments: ['scopeBeta'] },
      ],
    },
  )
  assert.equal(session.inputs.find((input: Record<string, unknown>) => input.id === 'scopeMode').required, true)
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      session.inputs.find((input: Record<string, unknown>) => input.id === 'scopeMode'),
      'defaultValue',
    ),
    false,
  )
  assert.deepEqual(session.expands._schema.oneOf.map((branch: Record<string, any>) => ({
    mode: branch.properties.scopeMode.const,
    required: branch.required.filter((argument: string) => ['scopeMode', 'scopeAlpha', 'scopeBeta'].includes(argument)),
    forbidden: branch.not.anyOf.map((entry: Record<string, string[]>) => entry.required[0]).sort(),
  })), [
    { mode: 'project', required: ['scopeMode'], forbidden: ['scopeAlpha', 'scopeBeta'] },
    { mode: 'explicit', required: ['scopeMode', 'scopeAlpha'], forbidden: ['scopeBeta'] },
    { mode: 'explicit', required: ['scopeMode', 'scopeBeta'], forbidden: ['scopeAlpha'] },
  ])

  const noBindingSibling = createTool('no_scope_selection_sibling', undefined, { includeScope: false })
  assert.ok(noBindingSibling.routing.analyticalCapability)
  assert.equal(
    noBindingSibling.routing.analyticalCapability.semanticIntentBindings[0].scopeSelection,
    undefined,
  )
  assert.equal(noBindingSibling.routing.analyticalCapability.argumentBindings, undefined)

  const malformedCases = [
    createTool('scope_selection_missing_binding', scopeSelection, { includeScope: false }),
    createTool('scope_selection_foreign_binding', { ...scopeSelection, binding: 'temporal' }),
    createTool('scope_selection_unknown_mode', { ...scopeSelection, modes: ['project', 'automatic'] }),
    createTool('scope_selection_duplicate_mode', { ...scopeSelection, modes: ['project', 'project'] }),
    createTool('scope_selection_reversed_modes', { ...scopeSelection, modes: ['explicit', 'project'] }),
    createTool('scope_selection_schema_drift', scopeSelection, {
      inputs: baseScope.inputs.map(input => input.id === 'scopeAlpha'
        ? { ...input, valueType: { type: 'integer' } }
        : input),
    }),
    createTool('scope_selection_cross_sibling_intent', scopeSelection, {
      intents: ['different declaration intent'],
    }),
  ]
  for (const tool of malformedCases) {
    assert.equal(tool.routing?.analyticalCapability, undefined, tool.id)
  }

  const duplicateScopeRouting = {
    ...valid.routing,
    analyticalCapability: {
      ...capability,
      argumentBindings: [
        ...capability.argumentBindings,
        capability.argumentBindings.find((binding: Record<string, unknown>) => binding.semantic === 'scope'),
      ],
    },
  }
  const duplicateScopeSession = toAiClientToolSessionDefinition({
    id: 'duplicate_scope_selection_wire',
    description: 'Reject duplicate scope semantics',
    routing: duplicateScopeRouting,
  }) as any
  assert.equal(duplicateScopeSession.expands?.['x-ai-routing'], undefined)
})

test('standard scalar summaries require exact canonical measure bindings and isolate malformed siblings', () => {
  const validFields = [
    {
      name: 'eventCount', type: 'integer', role: 'measure', label: 'Event count',
      measure: 'event_count', aggregation: 'sum', unit: 'record',
    },
    {
      name: 'eventRate', type: 'number', role: 'measure', label: 'Event rate',
      measure: 'event_rate', aggregation: 'avg', unit: 'percent',
    },
  ]
  const createSummary = (
    id: string,
    fields: Array<Record<string, unknown>> = validFields,
    output = 'metric-summary',
  ) => defineClientTool({
    id,
    description: { text: 'Read one typed metric summary', capabilities: ['anonymous.metric.summary'] },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `anonymous.summary.${id}`,
      factKey: 'anonymous.metric-summary',
      subjects: ['anonymous-subject'],
      measures: [
        { name: 'event_count', aggregations: ['sum'], units: ['record'] },
        { name: 'event_rate', aggregations: ['avg'], units: ['percent'] },
      ],
      dimensions: [],
      filters: [],
      grains: [],
      criteria: ['summary'],
      ordering: [],
      coverage: 'complete',
      output,
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'metric-summary',
      shape: 'anonymous.metric-summary',
      recordPath: '$',
      fields: fields as any,
    }),
    execute: () => clientToolResult.success({ eventCount: 4, eventRate: 50 }),
  })

  const valid = createSummary('valid_standard_summary') as any
  assert.ok(valid.routing.analyticalCapability)
  assert.deepEqual(valid._meta.resultBindings[0].fields, validFields)

  const malformedCases = [
    createSummary('summary_missing_measure', [validFields[0]]),
    createSummary('summary_without_measure_fields', [{
      name: 'summaryLabel', type: 'string', role: 'label', label: 'Summary',
    }]),
    createSummary('summary_wrong_measure_type', validFields.map(field => (
      field.name === 'eventCount' ? { ...field, type: 'string' } : field
    ))),
    createSummary('summary_duplicate_measure', [
      ...validFields,
      { ...validFields[0], name: 'duplicateCount' },
    ]),
    createSummary('summary_undeclared_measure', [
      ...validFields,
      {
        name: 'foreignCount', type: 'integer', role: 'measure', label: 'Foreign count',
        measure: 'foreign_count', aggregation: 'sum', unit: 'record',
      },
    ]),
    createSummary('summary_unlabelled_measure', validFields.map(field => (
      field.name === 'eventCount' ? { ...field, label: undefined } : field
    ))),
    createSummary('summary_unit_mismatch', validFields.map(field => (
      field.name === 'eventRate' ? { ...field, unit: 'record' } : field
    ))),
    createSummary('summary_output_mismatch', validFields, 'foreign-summary'),
  ]
  for (const tool of malformedCases) {
    assert.equal(tool.routing?.analyticalCapability, undefined, tool.id)
  }
  assert.ok(valid.routing.analyticalCapability)
})

test('standard analytical scalar formats are type-compatible and malformed producers stay sibling-local', () => {
  const createSummary = (
    id: string,
    type: 'integer' | 'number',
    format: string,
    unit: string,
  ) => defineClientTool({
    id,
    description: { text: 'Read one formatted analytical scalar', capabilities: ['anonymous.formatted.summary'] },
    analytical: defineClientToolAnalyticalProducer({
      producerKey: `anonymous.formatted.${id}`,
      factKey: 'anonymous.formatted-summary',
      subjects: ['anonymous-subject'],
      measures: [{ name: 'metric_value', aggregations: ['sum'], units: [unit] }],
      dimensions: [], filters: [], grains: [], criteria: ['summary'], ordering: [],
      coverage: 'complete', output: 'metric-summary',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'metric-summary',
      shape: 'anonymous.formatted-summary',
      recordPath: '$',
      fields: [{
        name: 'metricValue', type, role: 'measure', label: 'Metric value', format,
        measure: 'metric_value', aggregation: 'sum', unit,
      }],
    }),
    execute: () => clientToolResult.success({ metricValue: 4 }),
  }) as any

  const validCases = [
    createSummary('integer_integer', 'integer', 'integer', 'count'),
    createSummary('integer_number', 'integer', 'number', 'count'),
    createSummary('integer_decimal', 'integer', 'decimal', 'count'),
    createSummary('number_number', 'number', 'number', 'count'),
    createSummary('number_decimal', 'number', 'decimal', 'count'),
    createSummary('number_percent', 'number', 'percent', 'percent'),
  ]
  validCases.forEach(tool => assert.ok(tool.routing.analyticalCapability, tool.id))

  const numberAsInteger = createSummary('number_integer', 'number', 'integer', 'count')
  const ratioAsPercent = createSummary('ratio_percent', 'number', 'percent', 'ratio')
  assert.equal(numberAsInteger.routing?.analyticalCapability, undefined)
  assert.equal(ratioAsPercent.routing?.analyticalCapability, undefined)

  const [, sibling] = toAiClientToolSessionDefinitions([numberAsInteger, validCases[0]]) as any[]
  assert.ok(sibling.expands['x-ai-routing'].analyticalCapability)
})

test('catalog consumer authoring and non-analytical temporal scope share one canonical routing owner', () => {
  type Args = {
    entityRef: string
    windowMode: string
    openedAt?: string
    closedAt?: string
  }
  const time = anonymousTemporalContract()
  const temporal = defineClientToolTemporalRange<Args>({
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  })
  const consumes: ClientToolConsumedResource<Args>[] = [{
    name: 'anonymous-catalog-value',
    type: 'structured-data',
    mediaType: 'application/json',
    shape: 'anonymous.catalog-values',
    required: true,
    sourcePolicy: 'CONTEXT',
    bindArgument: defineClientToolPrimarySubjectArgumentBinding<Args>('entityRef', 'anonymous-subject'),
  }, {
    name: 'anonymous-natural-language-request',
    type: 'structured-data',
    mediaType: 'text/plain',
    shape: 'anonymous.natural-language-request',
    required: false,
    sourcePolicy: 'EITHER',
  }]
  const tool = defineClientTool<Args>({
    id: 'anonymous_catalog_native_lookup',
    description: { text: 'Read one catalog-selected entity', capabilities: ['generic.catalog.read'] },
    inputs: [{ id: 'entityRef', valueType: 'string', required: true }, ...time.inputs],
    inputAlternatives: time.inputAlternatives,
    consumes,
    temporal,
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'entity-detail', shape: 'anonymous.entity-detail' }),
    execute: () => clientToolResult.success({}),
  })
  const temporalBinding = {
    semantic: 'temporal',
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  }
  assert.deepEqual(tool.routing?.consumerPorts?.[0]?.argumentBinding, {
    argument: 'entityRef',
    valueCardinality: 'exactly-one',
    encoding: 'single-string',
    contextSource: {
      kind: 'subject',
      selection: 'primary',
      subjectType: 'anonymous-subject',
      coordinate: 'id',
    },
  })
  assert.deepEqual(
    tool._meta?.clientToolContract.inputs[0]?.argumentBinding,
    tool.routing?.consumerPorts?.[0]?.argumentBinding,
  )
  assert.deepEqual(
    tool._meta?.clientToolContract.inputs[1],
    tool.routing?.consumerPorts?.[1],
  )
  assert.equal(tool._meta?.clientToolContract.inputs[1]?.argumentBinding, undefined)
  assert.deepEqual(tool.routing?.temporalArgumentBinding, temporalBinding)
  assert.equal(tool.routing?.analyticalCapability, undefined)

  const session = toAiClientToolSessionDefinition(tool) as any
  assert.deepEqual(session.expands['x-ai-routing'].consumerPorts, tool.routing?.consumerPorts)
  assert.deepEqual(session.expands['x-ai-routing'].temporalArgumentBinding, temporalBinding)
  assert.equal((JSON.stringify(session).match(/"x-ai-routing"/g) || []).length, 1)
  assert.equal(validateAiClientToolRoutingMetadata(tool).status, 'valid')
  assert.equal(validateAiClientToolRoutingMetadata(session).status, 'valid')
})

test('catalog argument and root temporal wire fail closed without suppressing valid siblings', () => {
  type Args = {
    entityRef: string
    windowMode: string
    openedAt?: string
    closedAt?: string
  }
  const time = anonymousTemporalContract()
  const temporal = defineClientToolTemporalRange<Args>({
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  })
  const compiled = defineClientTool<Args>({
    id: 'anonymous_catalog_wire_source',
    description: { text: 'Compile a canonical catalog binding', capabilities: ['generic.catalog.read'] },
    inputs: [{ id: 'entityRef', valueType: 'string', required: true }, ...time.inputs],
    inputAlternatives: time.inputAlternatives,
    consumes: [{
      name: 'anonymous-catalog-value',
      type: 'structured-data',
      mediaType: 'application/json',
      shape: 'anonymous.catalog-values',
      required: true,
      sourcePolicy: 'CONTEXT',
      bindArgument: defineClientToolPrimarySubjectArgumentBinding<Args>('entityRef', 'anonymous-subject'),
    }],
    temporal,
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'entity-detail', shape: 'anonymous.entity-detail' }),
    execute: () => clientToolResult.success({}),
  }) as any
  const basePort = compiled.routing.consumerPorts[0]
  const baseRouting = compiled.routing
  const analyticalTemporal = defineClientTool({
    id: 'anonymous_analytical_temporal_source',
    description: { text: 'Compile analytical temporal metadata', capabilities: ['generic.catalog.aggregate'] },
    inputs: time.inputs,
    inputAlternatives: time.inputAlternatives,
    analytical: defineClientToolAnalyticalProducer<Record<string, unknown>>({
      producerKey: 'anonymous.catalog.aggregate',
      factKey: 'anonymous.catalog-facts',
      subjects: ['entity'],
      measures: [],
      dimensions: [],
      filters: [],
      grains: [],
      criteria: ['lookup'],
      ordering: [],
      coverage: 'complete',
      output: 'records',
    }),
    temporal: defineClientToolTemporalRange<Record<string, unknown>>({
      rangeArgument: 'windowMode',
      startArgument: 'openedAt',
      endArgument: 'closedAt',
      customValue: 'bounded',
      encoding: 'date-time',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'records', shape: 'anonymous.catalog-records', recordPath: '$' }),
    execute: () => clientToolResult.success([]),
  }) as any
  const malformedCases = [{
    inputs: compiled.inputs.filter((input: Record<string, unknown>) => input.id !== 'entityRef'),
  }, {
    inputs: [...compiled.inputs, { id: 'entityRef', valueType: 'string' }],
  }, {
    inputs: compiled.inputs.map((input: Record<string, unknown>) => (
      input.id === 'entityRef' ? { ...input, valueType: { type: 'array', elementType: { type: 'string' } } } : input
    )),
  }, {
    routing: {
      ...baseRouting,
      consumerPorts: [
        basePort,
        { ...basePort, name: 'anonymous-catalog-sibling' },
      ],
    },
  }, {
    routing: {
      ...baseRouting,
      consumerPorts: [{
        ...basePort,
        argumentBinding: { ...basePort.argumentBinding, valueCardinality: 'zero-or-one' },
      }],
    },
  }, {
    routing: {
      ...baseRouting,
      consumerPorts: [{
        ...basePort,
        argumentBinding: {
          ...basePort.argumentBinding,
          contextSource: undefined,
        },
      }],
    },
  }, {
    routing: {
      ...baseRouting,
      consumerPorts: [{
        ...basePort,
        sourcePolicy: 'TOOL',
      }],
    },
  }, ...(['kind', 'selection', 'coordinate'] as const).map(field => ({
    routing: {
      ...baseRouting,
      consumerPorts: [{
        ...basePort,
        argumentBinding: {
          ...basePort.argumentBinding,
          contextSource: {
            ...basePort.argumentBinding.contextSource,
            [field]: 'unknown',
          },
        },
      }],
    },
  })), {
    routing: {
      ...baseRouting,
      consumerPorts: [{
        ...basePort,
        argumentBinding: {
          ...basePort.argumentBinding,
          contextSource: {
            ...basePort.argumentBinding.contextSource,
            subjectType: '   ',
          },
        },
      }],
    },
  }, {
    routing: {
      ...baseRouting,
      consumerPorts: [
        basePort,
        {
          ...basePort,
          name: 'anonymous-context-sibling',
          argumentBinding: {
            ...basePort.argumentBinding,
            contextSource: {
              ...basePort.argumentBinding.contextSource,
              subjectType: 'foreign-subject',
            },
          },
        },
      ],
    },
  }, {
    routing: {
      ...baseRouting,
      analyticalCapability: analyticalTemporal.routing.analyticalCapability,
    },
  }, {
    parameterSchema: {
      ...compiled.parameterSchema,
      oneOf: compiled.parameterSchema.oneOf.map((branch: Record<string, any>, index: number) => index === 1
        ? {
            ...branch,
            properties: { ...branch.properties, windowMode: { const: 'foreign' } },
          }
        : branch),
    },
  }, {
    inputs: compiled.inputs.map((input: Record<string, unknown>) => (
      input.id === 'openedAt' ? { ...input, valueType: { type: 'string' } } : input
    )),
  }, {
    routing: {
      ...baseRouting,
      consumerPorts: [{
        ...basePort,
        argumentBinding: { ...basePort.argumentBinding, argument: 'windowMode' },
      }],
    },
  }]
  const siblingRouting = createSeriesContract().routing
  for (const [index, item] of malformedCases.entries()) {
    const [malformed, sibling] = toAiClientToolSessionDefinitions([{
      id: `anonymous_catalog_wire_malformed_${index}`,
      description: 'Reject an ambiguous native input binding',
      inputs: item.inputs || compiled.inputs,
      parameterSchema: item.parameterSchema || compiled.parameterSchema,
      routing: item.routing || baseRouting,
    }, {
      id: `anonymous_catalog_wire_sibling_${index}`,
      description: 'Independent valid sibling',
      routing: siblingRouting,
    }]) as any[]
    assert.equal(malformed.expands?.['x-ai-routing'], undefined)
    assert.deepEqual(sibling.expands['x-ai-routing'], siblingRouting)
  }

  const invalidContextAuthoring = [{
    id: 'anonymous_context_source_missing',
    sourcePolicy: 'CONTEXT' as const,
    bindArgument: defineClientToolStringArgumentBinding<Args>('entityRef'),
  }, {
    id: 'anonymous_context_subject_empty',
    sourcePolicy: 'CONTEXT' as const,
    bindArgument: defineClientToolPrimarySubjectArgumentBinding<Args>('entityRef', '   '),
  }]
  for (const item of invalidContextAuthoring) {
    const tool = defineClientTool<Args>({
      id: item.id,
      description: { text: 'Reject invalid context authoring', capabilities: ['generic.catalog.read'] },
      inputs: [{ id: 'entityRef', valueType: 'string', required: true }],
      consumes: [{
        name: 'anonymous-catalog-value',
        type: 'structured-data',
        mediaType: 'application/json',
        shape: 'anonymous.catalog-values',
        required: true,
        sourcePolicy: item.sourcePolicy,
        bindArgument: item.bindArgument,
      }],
      effect: { kind: 'READ' },
      output: clientToolOutput.detail({ name: 'entity-detail', shape: 'anonymous.entity-detail' }),
      execute: () => clientToolResult.success({}),
    })
    assert.equal(tool.routing?.consumerPorts?.[0]?.argumentBinding, undefined)
    assert.equal(JSON.stringify(toAiClientToolSessionDefinition(tool)).includes('contextSource'), false)
  }

  const toolOnly = defineClientTool<Args>({
    id: 'anonymous_tool_context_forbidden',
    description: { text: 'Reject context provenance from a TOOL-only port', capabilities: ['generic.catalog.read'] },
    inputs: [{ id: 'entityRef', valueType: 'string', required: true }],
    consumes: [{
      name: 'anonymous-catalog-value',
      type: 'structured-data',
      mediaType: 'application/json',
      shape: 'anonymous.catalog-values',
      required: true,
      sourcePolicy: 'TOOL',
      bindArgument: defineClientToolPrimarySubjectArgumentBinding<Args>('entityRef', 'anonymous-subject'),
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'entity-detail', shape: 'anonymous.entity-detail' }),
    execute: () => clientToolResult.success({}),
  })
  assert.equal(toolOnly.routing?.consumerPorts?.[0]?.argumentBinding, undefined)
  assert.equal(JSON.stringify(toAiClientToolSessionDefinition(toolOnly)).includes('contextSource'), false)
})

test('shared scope authoring projects one closed singleton-string edge beside temporal semantics', () => {
  const time = anonymousTemporalContract()
  const scope = anonymousScopeContract(time.inputAlternatives)
  const analytical = defineClientToolAnalyticalProducer<Record<string, unknown>>({
    producerKey: 'anonymous.scope.samples',
    factKey: 'anonymous.scope-facts',
    subjects: ['entity'],
    measures: [],
    dimensions: [],
    filters: [],
    grains: [],
    criteria: ['lookup'],
    ordering: [],
    coverage: 'complete',
    output: 'scope-records',
  })
  const tool = defineClientTool({
    id: 'anonymous_scope_samples',
    description: { text: 'Return records from one admitted coordinate', capabilities: ['generic.scope'] },
    inputs: [...scope.inputs, ...time.inputs],
    inputAlternatives: scope.inputAlternatives,
    consumes: scope.consumes,
    analytical,
    temporal: time.temporal,
    scope: scope.scope,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'scope-records',
      shape: 'anonymous.scope-records-v2',
      recordPath: '$',
    }),
    execute: () => clientToolResult.success([]),
  })

  const scopeBinding = {
    semantic: 'scope',
    modeArgument: 'scopeMode',
    valueCardinality: 'exactly-one',
    encoding: 'single-string',
    coordinates: [
      { type: 'project', arguments: [] },
      { type: 'area', sourcePort: 'coordinate-alpha', arguments: ['scopeAlpha'] },
      { type: 'point', sourcePort: 'coordinate-beta', arguments: ['scopeBeta'] },
    ],
  }
  const session = toAiClientToolSessionDefinition(tool) as any
  assert.deepEqual(session.expands['x-ai-routing'].analyticalCapability.argumentBindings, [{
    semantic: 'temporal',
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  }, scopeBinding])
  assert.equal(session.expands._schema.oneOf.length, 6)
  assert.equal((JSON.stringify(session).match(/"x-ai-routing"/g) || []).length, 1)
  assert.equal(validateAiClientToolRoutingMetadata(tool).status, 'valid')
  assert.equal(validateAiClientToolRoutingMetadata(session).status, 'valid')
})

test('scope authoring rejects missing provenance, malformed branches and target collisions without suppressing siblings', () => {
  const base = anonymousScopeContract()
  const analytical = defineClientToolAnalyticalProducer<Record<string, unknown>>({
    producerKey: 'anonymous.scope.fail-closed',
    factKey: 'anonymous.scope-facts',
    subjects: ['entity'],
    measures: [],
    dimensions: [],
    filters: [],
    grains: [],
    criteria: ['lookup'],
    ordering: [],
    coverage: 'complete',
    output: 'scope-records',
  })
  const createCase = (
    id: string,
    scope = base.scope,
    inputs: ClientToolInput[] = base.inputs,
    consumes = base.consumes,
    inputAlternatives: ClientToolInputAlternative[] = base.inputAlternatives,
  ) => defineClientTool({
    id,
    description: { text: 'Reject an unproven coordinate edge', capabilities: ['generic.scope'] },
    inputs,
    inputAlternatives,
    consumes,
    analytical,
    scope,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'scope-records', shape: 'anonymous.scope-facts', recordPath: '$' }),
    execute: () => clientToolResult.success([]),
  })
  const colliding = defineClientToolScope<Record<string, unknown>>({
    modeArgument: 'scopeMode',
    valueCardinality: 'exactly-one',
    encoding: 'single-string',
    coordinates: [
      { type: 'project', arguments: [] },
      { type: 'area', sourcePort: 'coordinate-alpha', arguments: ['scopeAlpha'] },
      { type: 'point', sourcePort: 'coordinate-beta', arguments: ['scopeAlpha'] },
    ],
  })
  const mismatchedBranch = base.inputAlternatives.map((branch, index) => index === 1
    ? { ...branch, forbidden: [] }
    : branch)
  const openModeBranch = base.inputAlternatives.map((branch, index) => index === 0
    ? { ...branch, alsoWhen: [] }
    : branch)
  const malformedCases = [
    createCase('scope_missing_source_port', base.scope, base.inputs, [base.consumes[0]]),
    createCase(
      'scope_non_string_argument',
      base.scope,
      base.inputs.map(input => input.id === 'scopeAlpha'
        ? { ...input, valueType: { type: 'integer' } }
        : input),
    ),
    createCase('scope_branch_mismatch', base.scope, base.inputs, base.consumes, mismatchedBranch),
    createCase('scope_open_mode_branch', base.scope, base.inputs, base.consumes, openModeBranch),
    createCase(
      'scope_mode_default',
      base.scope,
      base.inputs.map(input => input.id === 'scopeMode' ? { ...input, defaultValue: 'project' } : input),
    ),
    createCase(
      'scope_mode_open_value',
      base.scope,
      base.inputs.map(input => input.id === 'scopeMode' ? { ...input, valueType: { type: 'string' } } : input),
    ),
    createCase('scope_target_collision', colliding),
    createCase('scope_unregistered_authoring', Object.freeze({}) as any),
  ]
  for (const tool of malformedCases) {
    assert.equal(tool.routing?.analyticalCapability, undefined, tool.id)
  }

  const validSibling = createCase('scope_valid_sibling')
  assert.ok(validSibling.routing?.analyticalCapability)
})

test('temporal authoring fails closed for unresolved, ambiguous, incompatible and conflicting edges', () => {
  const baseTime = anonymousTemporalContract()
  const analytical = defineClientToolAnalyticalProducer<Record<string, unknown>>({
    producerKey: 'anonymous.temporal.fail-closed',
    factKey: 'anonymous.samples',
    subjects: ['entity'],
    measures: [],
    dimensions: [],
    filters: [],
    grains: [],
    criteria: ['lookup'],
    ordering: [],
    coverage: 'complete',
    output: 'samples',
  })
  const createCase = (
    id: string,
    temporal: ReturnType<typeof anonymousTemporalContract>['temporal'] | undefined,
    inputs: ClientToolInput[] = baseTime.inputs,
    inputAlternatives: ClientToolInputAlternative[] = baseTime.inputAlternatives,
  ) => defineClientTool({
    id,
    description: { text: 'Reject an unproven range edge', capabilities: ['generic.samples'] },
    inputs,
    inputAlternatives,
    analytical,
    ...(temporal ? { temporal } : {}),
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'samples', shape: 'anonymous.samples', recordPath: '$' }),
    execute: () => clientToolResult.success([]),
  })
  const temporal = (overrides: Record<string, unknown> = {}) => defineClientToolTemporalRange({
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
    ...overrides,
  } as any)
  const malformedCases = [
    createCase('temporal_missing_argument', temporal({ endArgument: 'absentAt' })),
    createCase('temporal_duplicate_argument', temporal({ endArgument: 'openedAt' })),
    createCase('temporal_custom_value_missing', temporal({ customValue: 'not-declared' })),
    createCase(
      'temporal_custom_required_incomplete',
      temporal(),
      baseTime.inputs,
      [baseTime.inputAlternatives[0], {
        required: ['windowMode', 'openedAt'],
        when: { input: 'windowMode', equals: 'bounded' },
      }],
    ),
    createCase(
      'temporal_non_date_endpoint',
      temporal(),
      baseTime.inputs.map(input => input.id === 'openedAt'
        ? { ...input, valueType: { type: 'string' } }
        : input),
    ),
    createCase(
      'temporal_ambiguous_base_custom_branch',
      temporal(),
      baseTime.inputs,
      [...baseTime.inputAlternatives, { ...baseTime.inputAlternatives[1], title: 'duplicate' }],
    ),
    createCase('temporal_unregistered_authoring', Object.freeze({}) as any),
  ]
  for (const tool of malformedCases) {
    assert.equal(tool.routing?.analyticalCapability, undefined, tool.id)
  }

  const boundedBase = anonymousBoundedDefinition('anonymous.temporal-conflict', 'top_n')
  const bounded = defineClientToolBoundedAnalyticalProducer<Record<string, unknown>>({
    ...boundedBase,
    boundedBy: 'windowMode',
  })
  const conflicting = defineClientTool({
    id: 'temporal_conflicting_limit_target',
    description: { text: 'Reject one input with two semantic owners', capabilities: ['generic.rank'] },
    inputs: baseTime.inputs,
    inputAlternatives: baseTime.inputAlternatives,
    analytical: bounded,
    temporal: baseTime.temporal,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'ranked-records',
      shape: 'anonymous.records',
      recordPath: '$',
      fields: [
        { name: 'physical_group', type: 'string', role: 'dimension' },
        {
          name: 'physical_score', type: 'number', role: 'measure', measure: 'semantic_score',
          unit: 'record', aggregation: 'sum',
        },
      ],
    }),
    execute: () => clientToolResult.success([]),
  })
  assert.equal(conflicting.routing?.analyticalCapability, undefined)

  const validSibling = createCase('temporal_valid_sibling', baseTime.temporal)
  assert.ok(validSibling.routing?.analyticalCapability)
})

test('bounded analytical results fail closed when scope cardinality is invalid, out of range or exceeded', async () => {
  type Args = { requestedCount: number }
  const primary = defineClientToolBoundedAnalyticalProducer<Args>(
    anonymousBoundedDefinition('anonymous.primary', 'top_n'),
  )
  const executeCase = async (
    id: string,
    execute: () => any,
    requestedCount: unknown = 2,
  ) => {
    const tool = defineClientTool<Args, Record<string, unknown>, Array<Record<string, unknown>>>({
      id,
      description: { text: 'Return a bounded subset', capabilities: ['generic.rank'] },
      inputs: [{ id: 'requestedCount', valueType: { type: 'integer', min: 1, max: 5 }, required: true }],
      analytical: primary,
      effect: { kind: 'READ' },
      output: clientToolOutput.recordSet<Array<Record<string, unknown>>>({
        name: 'ranked-records', shape: 'generic.ranked-records', recordPath: '$',
        fields: [
          { name: 'physical_group', type: 'string', role: 'dimension' },
          {
            name: 'physical_score', type: 'number', role: 'measure', measure: 'semantic_score',
            unit: 'record', aggregation: 'sum',
          },
        ],
      }),
      execute,
    })
    return tool.execute({ requestedCount } as Args, {}, { id, toolName: id }) as Promise<any>
  }

  const cases = [
    await executeCase('bounded_exceeded_scope', () => clientToolResult.success([
      { physical_group: 'a', physical_score: 3 },
      { physical_group: 'b', physical_score: 2 },
      { physical_group: 'c', physical_score: 1 },
    ])),
    await executeCase('bounded_zero_scope', () => clientToolResult.success([]), 0),
    await executeCase('bounded_fractional_scope', () => clientToolResult.success([
      { physical_group: 'a', physical_score: 2 },
    ]), 1.5),
    await executeCase('bounded_out_of_range_scope', () => clientToolResult.success([
      { physical_group: 'a', physical_score: 5 },
    ]), 6),
    await executeCase('bounded_malformed_scope', () => clientToolResult.success([
      { physical_group: 'a', physical_score: 2 },
    ]), '2'),
  ]
  for (const result of cases) {
    assert.equal(result.complete, false)
    assert.equal(result.truncated, false)
    assert.equal(result.evidence.displayTruncated, false)
    assert.equal(result.status, 'partial')
    assert.equal(result.evidence.complete, false)
    assert.equal(result.evidence.completeness, 'partial')
    assert.equal(result.evidence.limitReason, 'analytical_scope_unproven')
    assert.equal(result.outputBindings[0].complete, false)
    assert.equal(result.outputBindings[0].totalCount, undefined)
  }

  const paginated = await executeCase('bounded_paginated', () => clientToolResult.partial([{
    physical_group: 'a', physical_score: 2,
  }], {
    limitReason: 'pagination',
  }))
  assert.equal(paginated.complete, false)
  assert.equal(paginated.truncated, false)
  assert.equal(paginated.evidence.displayTruncated, false)
  assert.equal(paginated.evidence.limitReason, 'pagination')
  assert.equal(paginated.evidence.completeness, 'partial')
})

test('bounded authoring rejects ambiguous semantics and never guesses physical fields or output slots', async () => {
  type Args = {
    requestedCount?: number
    first?: number
    second?: number
    coordinateAxis?: string
  }
  const executeCase = async (
    id: string,
    definition: Record<string, unknown>,
    inputs: Array<ClientToolInput & { id: keyof Args & string }>,
    output: ReturnType<typeof clientToolOutput.recordSet<Array<Record<string, unknown>>>>
      | Array<ReturnType<typeof clientToolOutput.recordSet<Array<Record<string, unknown>>>>>,
    args: Args = { requestedCount: 2, first: 2, second: 2, coordinateAxis: 'semantic_group' },
  ) => {
    const analytical = defineClientToolBoundedAnalyticalProducer<Args>(definition as any)
    const tool = defineClientTool<Args, Record<string, unknown>, Array<Record<string, unknown>>>({
      id,
      description: { text: 'Return an explicitly bounded subset', capabilities: ['generic.rank'] },
      inputs,
      analytical,
      effect: { kind: 'READ' },
      output,
      execute: () => clientToolResult.success([{ physical_group: 'a', physical_score: 2 }]),
    })
    return tool.execute(args, {}, {
      id,
      toolName: id,
    }) as Promise<any>
  }
  const output = () => clientToolOutput.recordSet<Array<Record<string, unknown>>>({
    name: 'ranked-records',
    shape: 'generic.ranked-records',
    recordPath: '$',
    fields: [
      { name: 'physical_group', type: 'string', role: 'dimension' },
      {
        name: 'physical_score', type: 'number', role: 'measure', measure: 'semantic_score',
        unit: 'record', aggregation: 'sum',
      },
    ],
  })
  const cases = [
    await executeCase(
      'bounded_ambiguous_criteria',
      { ...anonymousBoundedDefinition('anonymous.ambiguous-criteria', 'top_n'), criterion: ['top_n', 'bottom_n'] },
      [{ id: 'requestedCount', valueType: 'number' }],
      output(),
    ),
    await executeCase(
      'bounded_missing_explicit_input',
      anonymousBoundedDefinition('anonymous.missing-input', 'top_n'),
      [{ id: 'first', valueType: 'number' }],
      output(),
    ),
    await executeCase(
      'bounded_unmapped_semantic_axis',
      {
        ...anonymousBoundedDefinition('anonymous.unmapped-axis', 'top_n'),
        criterion: {
          ...anonymousBoundedDefinition('anonymous.unmapped-axis', 'top_n').criterion,
          axis: undefined,
          axisFromInput: 'notDeclared',
        },
      },
      [{ id: 'first', valueType: 'number' }, { id: 'second', valueType: 'number' }],
      output(),
    ),
    await executeCase(
      'bounded_axis_without_typed_enum_schema',
      {
        ...anonymousBoundedDefinition('anonymous.untyped-axis', 'top_n'),
        criterion: {
          ...anonymousBoundedDefinition('anonymous.untyped-axis', 'top_n').criterion,
          axis: undefined,
          axisFromInput: 'coordinateAxis',
        },
      },
      [
        { id: 'requestedCount', valueType: 'number' },
        { id: 'coordinateAxis', valueType: 'string' },
      ],
      output(),
    ),
    await executeCase(
      'bounded_axis_schema_incompatible_with_dimensions',
      {
        ...anonymousBoundedDefinition('anonymous.incompatible-axis', 'top_n'),
        criterion: {
          ...anonymousBoundedDefinition('anonymous.incompatible-axis', 'top_n').criterion,
          axis: undefined,
          axisFromInput: 'coordinateAxis',
        },
      },
      [
        { id: 'requestedCount', valueType: 'number' },
        {
          id: 'coordinateAxis',
          valueType: anonymousEnumValueType(['semantic_group', 'foreign_group']),
        },
      ],
      output(),
    ),
    await executeCase(
      'bounded_physical_field_not_guessed_from_semantic_measure',
      {
        ...anonymousBoundedDefinition('anonymous.no-field-guess', 'top_n'),
        criterion: {
          ...anonymousBoundedDefinition('anonymous.no-field-guess', 'top_n').criterion,
          valueField: 'semantic_score',
        },
      },
      [{ id: 'requestedCount', valueType: 'number' }],
      output(),
    ),
    await executeCase(
      'bounded_missing_explicit_output',
      { ...anonymousBoundedDefinition('anonymous.missing-output', 'top_n'), output: 'not-declared' },
      [{ id: 'requestedCount', valueType: 'number' }],
      [
        output(),
        clientToolOutput.recordSet<Array<Record<string, unknown>>>({
          name: 'ranked-records-sibling',
          shape: 'generic.ranked-records',
          recordPath: '$',
        }),
      ],
    ),
  ]

  for (const result of cases) {
    assert.equal(result.complete, false)
    assert.equal(result.truncated, false)
    assert.equal(result.evidence.displayTruncated, false)
    assert.equal(result.evidence.limitReason, 'analytical_scope_unproven')
  }

  const unregistered = defineClientTool<Args, Record<string, unknown>, number[]>({
    id: 'bounded_unregistered_authoring',
    description: { text: 'Reject an unregistered authoring object', capabilities: ['generic.rank'] },
    inputs: [{ id: 'requestedCount', valueType: 'number', required: true }],
    analytical: Object.freeze({}) as any,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet<number[]>({
      name: 'ranked-records', shape: 'generic.ranked-records', recordPath: '$',
    }),
    execute: () => clientToolResult.success([2, 1]),
  })
  const unregisteredResult = await unregistered.execute({ requestedCount: 2 }, {}, {
    id: 'bounded-unregistered',
    toolName: unregistered.id,
  }) as any
  assert.equal(unregistered.routing?.analyticalCapability, undefined)
  assert.equal(unregisteredResult.complete, false)
  assert.equal(unregisteredResult.evidence.limitReason, 'analytical_scope_unproven')

  const explicitlyMapped = await executeCase(
    'bounded_explicit_physical_mapping',
    { ...anonymousBoundedDefinition('anonymous.explicit-mapping', 'top_n'), boundedBy: 'second' },
    [{ id: 'first', valueType: 'number' }, { id: 'second', valueType: 'number' }],
    output(),
    { first: 0, second: 2 },
  )
  assert.equal(explicitlyMapped.complete, true)
  assert.equal(explicitlyMapped.truncated, false)
})

test('binding normalization preserves display-only label semantics', () => {
  const [binding] = normalizeAiClientToolOutputBindings([{
    name: 'series',
    path: '$.series',
    shape: 'metric.time-series',
    complete: true,
    fields: [{ name: 'display', semanticRole: 'label' }],
  }])

  assert.deepEqual(binding.fields, [{ name: 'display', semanticRole: 'label' }])
})

test('binding normalization preserves only canonical source digests and isolates malformed siblings', () => {
  const digest = `sha256:${'ab'.repeat(32)}`
  const normalized = normalizeAiClientToolOutputBindings([{
    name: 'valid-source',
    ref: 'session://valid-source.json',
    shape: 'anonymous.records',
    complete: true,
    sourceDigest: digest.toUpperCase(),
  }, {
    name: 'malformed-source',
    ref: 'session://malformed-source.json',
    shape: 'anonymous.records',
    complete: true,
    sourceDigest: 'sha256:not-a-digest',
  }] as any)

  assert.deepEqual(normalized.map(binding => binding.name), ['valid-source'])
  assert.equal(normalized[0].sourceDigest, digest)
})

test('binding normalization preserves orthogonal physical types and analytical roles without inference', () => {
  const [binding] = normalizeAiClientToolOutputBindings([{
    name: 'series',
    path: '$.series',
    recordPath: '$',
    shape: 'metric.time-series',
    complete: true,
    fields: [
      { name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'event_time', encoding: 'epoch-millis' },
      { name: 'ordinal', type: 'integer', role: 'dimension', axis: 'semantic_position' },
      { name: 'value', type: 'number', role: 'measure', measure: 'energy', unit: 'kwh', aggregation: 'sum' },
      { name: 'looksNumeric', type: 'string', role: 'label', format: 'integer' },
    ] as any,
  }])

  assert.deepEqual(binding.fields, [
    { name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'event_time', encoding: 'epoch-millis' },
    { name: 'ordinal', type: 'integer', role: 'dimension', axis: 'semantic_position' },
    { name: 'value', type: 'number', role: 'measure', measure: 'energy', unit: 'kwh', aggregation: 'sum' },
    { name: 'looksNumeric', type: 'string', role: 'label', format: 'integer' },
  ])
  assert.equal(binding.recordPath, '$')
})

test('canonical timestamp encoding is closed, type-bound, and preserved without format inference', () => {
  const timestampFields = [{
    name: 'capturedAt',
    type: 'timestamp',
    role: 'temporal_dimension',
    axis: 'event_time',
    format: 'datetime',
    encoding: 'epoch-millis',
  }] as const
  assert.deepEqual(normalizeAiClientToolOutputFields(timestampFields), timestampFields)
  assert.equal(normalizeAiClientToolOutputFields([{
    name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'event_time', format: 'datetime',
  }] as any), undefined)
  assert.equal(normalizeAiClientToolOutputFields([{
    name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'event_time', encoding: 'seconds',
  }] as any), undefined)
  assert.equal(normalizeAiClientToolOutputFields([{
    name: 'count', type: 'integer', role: 'measure', encoding: 'epoch-millis',
  }] as any), undefined)
  assert.equal(normalizeAiClientToolOutputFields([{
    name: 'capturedAt', semanticRole: 'timestamp', encoding: 'date-time',
  }] as any), undefined)
  assert.equal(normalizeAiClientToolOutputFields([
    timestampFields[0],
    { ...timestampFields[0], encoding: 'date-time' },
  ] as any), undefined)
})

test('preserves bounded display-unit text without changing canonical unit identity', () => {
  const fields = [{
    name: 'passages', type: 'integer', role: 'measure', measure: 'passenger_total',
    unit: 'crossing-event', unitLabel: 'Passages', aggregation: 'sum',
  }] as const
  assert.deepEqual(normalizeAiClientToolOutputFields(fields), fields)
  assert.equal(normalizeAiClientToolOutputFields([{
    ...fields[0], unitLabel: 'x'.repeat(121),
  }] as any), undefined)
  assert.equal(normalizeAiClientToolOutputFields([{
    ...fields[0], unitLabel: 42,
  }] as any), undefined)
})

test('canonical timestamp values obey authored encoding without numeric or scale coercion', () => {
  const epochFields = [{
    name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'time', encoding: 'epoch-millis',
  }] as const
  const dateTimeFields = [{
    name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'time', encoding: 'date-time',
  }] as const

  for (const value of [
    1_700_000_000_000,
    1_700_000_000,
    0,
    -1,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
  ]) {
    assert.equal(validateAiClientToolCanonicalFieldValues([{ capturedAt: value }], '$', epochFields), true)
  }
  for (const value of [
    NaN,
    Infinity,
    -Infinity,
    1.5,
    '1700000000000',
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
  ]) {
    assert.equal(validateAiClientToolCanonicalFieldValues([{ capturedAt: value }], '$', epochFields), false)
  }
  for (const value of ['2026-08-22T01:02:03Z', '2026-08-22T09:02:03.123+08:00']) {
    assert.equal(validateAiClientToolCanonicalFieldValues([{ capturedAt: value }], '$', dateTimeFields), true)
  }
  for (const value of [
    '2026-08-22T01:02:03',
    '2026-02-30T01:02:03Z',
    '2026-08-22',
    1_700_000_000_000,
  ]) {
    assert.equal(validateAiClientToolCanonicalFieldValues([{ capturedAt: value }], '$', dateTimeFields), false)
  }
  assert.equal(validateAiClientToolCanonicalFieldValues([{}, { capturedAt: null }], '$', epochFields), true)
})

test('canonical scalar measure values are present, exact and never coerced', () => {
  const fields = [
    {
      name: 'eventCount', type: 'integer', role: 'measure', label: 'Event count',
      measure: 'event_count', aggregation: 'sum', unit: 'record',
    },
    {
      name: 'eventRate', type: 'number', role: 'measure', label: 'Event rate',
      measure: 'event_rate', aggregation: 'avg', unit: 'percent',
    },
    { name: 'groupLabel', type: 'string', role: 'label', label: 'Group' },
  ] as const
  assert.equal(validateAiClientToolCanonicalFieldValues({
    eventCount: 4,
    eventRate: 50.5,
    groupLabel: 'A',
  }, '$', fields), true)
  for (const value of [
    { eventRate: 50.5 },
    { eventCount: null, eventRate: 50.5 },
    { eventCount: '4', eventRate: 50.5 },
    { eventCount: Number.MAX_SAFE_INTEGER + 1, eventRate: 50.5 },
    { eventCount: 4, eventRate: NaN },
    { eventCount: 4, eventRate: 50.5, groupLabel: 1 },
  ]) {
    assert.equal(validateAiClientToolCanonicalFieldValues(value, '$', fields), false)
  }
})

test('runtime timestamp validation fails one malformed producer without contaminating a valid sibling', async () => {
  const createTimestampTool = (
    id: string,
    encoding: 'epoch-millis' | 'date-time',
    value: unknown,
  ) => defineClientTool({
    id,
    description: { text: 'Read one timestamp record', capabilities: ['anonymous.timestamp.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: `${id}-records`,
      shape: 'anonymous.timestamp-records',
      recordPath: '$',
      fields: [{
        name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', axis: 'time', encoding,
      }],
    }),
    execute: () => clientToolResult.success([{ capturedAt: value }]),
  })
  const valid = createTimestampTool('valid_timestamp_sibling', 'epoch-millis', 1_700_000_000_000)
  const validDateTime = createTimestampTool(
    'valid_date_time_sibling',
    'date-time',
    '2026-08-22T09:02:03+08:00',
  )
  const malformed = createTimestampTool('malformed_timestamp_sibling', 'epoch-millis', '1700000000000')
  const scope = `timestamp-encoding-${Math.random().toString(36).slice(2)}`
  const dispose = aiClientToolRegistry.register(scope, [valid, validDateTime, malformed])
  try {
    const registered = aiClientToolRegistry.getTools(scope)
    const session = toAiClientToolSessionDefinitions(registered) as any[]
    assert.equal(session.length, 3)
    assert.equal(
      registered.find(tool => tool.id === validDateTime.id)!
        ._meta.clientToolContract.outputs[0].fields[0].encoding,
      'date-time',
    )
    assert.equal(
      registered.find(tool => tool.id === valid.id)!
        ._meta.clientToolContract.outputs[0].fields[0].encoding,
      'epoch-millis',
    )
    assert.deepEqual(session.map(tool => tool.id).sort(), [
      malformed.id, valid.id, validDateTime.id,
    ].sort())
    assert.equal(JSON.stringify(session).includes('clientToolContract'), false)
    await assert.rejects(
      malformed.execute({}, {}, { id: 'malformed-timestamp', toolName: malformed.id }),
      /output selection failed/,
    )
    const result = await valid.execute({}, {}, { id: 'valid-timestamp', toolName: valid.id }) as any
    assert.equal(result.success, true)
    assert.equal(result.outputBindings[0].fields[0].encoding, 'epoch-millis')
    const dateTimeResult = await validDateTime.execute(
      {},
      {},
      { id: 'valid-date-time', toolName: validDateTime.id },
    ) as any
    assert.equal(dateTimeResult.success, true)
    assert.equal(dateTimeResult.outputBindings[0].fields[0].encoding, 'date-time')
  } finally {
    dispose()
  }
})

test('malformed or oversized field collections reject the whole binding while preserving valid siblings', () => {
  const validSibling = {
    name: 'valid-sibling',
    path: '$.valid',
    recordPath: '$',
    shape: 'tabular.records',
    complete: true,
    completeness: 'complete',
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
  }
  const mixedInvalid = {
    name: 'mixed-invalid',
    path: '$.mixed',
    recordPath: '$',
    shape: 'tabular.records',
    complete: true,
    completeness: 'complete',
    fields: [
      { name: 'id', type: 'string', role: 'identifier' },
      { name: 'invalid', type: 'string', role: 'unknown' },
    ],
  }
  const oversized = {
    name: 'oversized',
    path: '$.oversized',
    recordPath: '$',
    shape: 'tabular.records',
    complete: true,
    completeness: 'complete',
    fields: Array.from({ length: 33 }, (_, index) => ({
      name: `field${index}`,
      type: 'string',
      role: 'dimension',
    })),
  }
  const invalidAxis = {
    name: 'invalid-axis',
    path: '$.invalidAxis',
    recordPath: '$',
    shape: 'tabular.records',
    complete: true,
    completeness: 'complete',
    fields: [{ name: 'group', type: 'string', role: 'dimension', axis: 'not an axis' }],
  }
  const measureAxis = {
    name: 'measure-axis',
    path: '$.measureAxis',
    recordPath: '$',
    shape: 'tabular.records',
    complete: true,
    completeness: 'complete',
    fields: [{ name: 'value', type: 'number', role: 'measure', measure: 'score', axis: 'group' }],
  }
  const legacyAxis = {
    name: 'legacy-axis',
    path: '$.legacyAxis',
    shape: 'tabular.records',
    complete: true,
    fields: [{ name: 'group', semanticRole: 'category', axis: 'group' }],
  }

  const normalized = normalizeAiClientToolOutputBindings([
    mixedInvalid,
    validSibling,
    oversized,
    invalidAxis,
    measureAxis,
    legacyAxis,
  ] as any)

  assert.deepEqual(normalized.map(binding => binding.name), ['valid-sibling'])
})

test('invalid completeness rejects the whole binding while preserving valid siblings', () => {
  const validSibling = {
    name: 'valid-sibling',
    path: '$.valid',
    recordPath: '$',
    shape: 'tabular.records',
    complete: false,
    completeness: 'truncated',
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
  }
  const invalidBindings = [
    { name: 'unknown-state', complete: false, completeness: 'bounded' },
    {
      name: 'partial-with-malformed-continuation',
      complete: false,
      completeness: 'partial',
      continuation: { producerId: 'producer-only' },
    },
    { name: 'complete-conflict', complete: true, completeness: 'truncated' },
  ].map(value => ({
    path: `$.${value.name}`,
    recordPath: '$',
    shape: 'tabular.records',
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    ...value,
  }))

  const normalized = normalizeAiClientToolOutputBindings([
    ...invalidBindings,
    validSibling,
  ] as any)

  assert.deepEqual(normalized.map(binding => binding.name), ['valid-sibling'])
})

test('typed continuation is retained only for a partial canonical binding', () => {
  const continuation = {
    producerId: 'station_scope_read',
    capabilityId: 'station.scope.list',
    scopeDigest: 'scope-current',
    remainingScopeDigest: 'scope-remaining',
    argument: 'pageIndex',
    value: 1,
  }
  const [partial, truncated] = normalizeAiClientToolOutputBindings([{
    name: 'partial-records',
    path: '$.partial',
    recordPath: '$',
    shape: 'tabular.records',
    complete: false,
    completeness: 'partial',
    continuation,
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
  }, {
    name: 'bounded-records',
    path: '$.bounded',
    recordPath: '$',
    shape: 'tabular.records',
    complete: false,
    completeness: 'truncated',
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
  }] as any)

  assert.equal(partial.completeness, 'partial')
  assert.deepEqual(partial.continuation, continuation)
  assert.equal(truncated.completeness, 'truncated')
  assert.equal(truncated.continuation, undefined)
})

test('C2 keeps request satisfaction, exhaustive coverage and display truncation independent', () => {
  const [binding] = normalizeAiClientToolOutputBindings([{
    name: 'bounded-complete-display',
    path: '$.data',
    recordPath: '$',
    shape: 'tabular.records',
    complete: true,
    truncated: false,
    requestSatisfied: true,
    exhaustive: false,
    displayTruncated: false,
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
  }])
  assert.deepEqual(binding && {
    complete: binding.complete,
    truncated: binding.truncated,
    requestSatisfied: binding.requestSatisfied,
    exhaustive: binding.exhaustive,
    displayTruncated: binding.displayTruncated,
  }, {
    complete: true,
    truncated: false,
    requestSatisfied: true,
    exhaustive: false,
    displayTruncated: false,
  })

  const evidence = withAiClientToolEvidence({ status: 'ok' }, {
    complete: true,
    truncated: false,
    requestSatisfied: true,
    exhaustive: false,
    displayTruncated: false,
  })
  assert.deepEqual({
    complete: evidence.complete,
    truncated: evidence.truncated,
    requestSatisfied: evidence.requestSatisfied,
    exhaustive: evidence.exhaustive,
    displayTruncated: evidence.displayTruncated,
  }, {
    complete: true,
    truncated: false,
    requestSatisfied: true,
    exhaustive: false,
    displayTruncated: false,
  })
  assert.equal(evidence.completeness, 'partial')

  const [partialWithoutDisplayTruncation] = normalizeAiClientToolOutputBindings([{
    name: 'partial-coverage',
    path: '$.data',
    recordPath: '$',
    shape: 'tabular.records',
    complete: false,
    truncated: false,
    requestSatisfied: false,
    exhaustive: false,
    displayTruncated: false,
    completeness: 'partial',
    fields: [{ name: 'id', type: 'string', role: 'identifier' }],
  }])
  assert.equal(partialWithoutDisplayTruncation?.completeness, 'partial')
  assert.equal(partialWithoutDisplayTruncation?.truncated, false)
})

test('tool-result state keeps execution terminal while canonical evidence remains partial', () => {
  const state = resolveAiClientToolResultState({
    toolCallId: 'anonymous-call',
    result: {
      success: true,
      status: 'partial',
      complete: false,
      truncated: true,
      completeness: 'truncated',
      evidence: {
        contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
        complete: false,
        truncated: true,
        completeness: 'truncated',
        evidenceCoverage: 'bounded-window',
        supportsAbsenceClaim: false,
      },
    },
  })

  assert.deepEqual(state, {
    executionStatus: 'completed',
    resultCompleteness: 'partial',
    evidenceCoverage: 'bounded-window',
    absenceAuthority: 'unsupported',
    source: 'canonical',
    conflicted: false,
  })
})

test('complete empty delivery keeps absence authority as an independent fact', () => {
  const createState = (supportsAbsenceClaim: boolean) => resolveAiClientToolResultState({
    success: true,
    status: 'empty',
    complete: true,
    truncated: false,
    completeness: 'empty',
    evidence: {
      contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
      complete: true,
      truncated: false,
      completeness: 'empty',
      supportsAbsenceClaim,
    },
  })

  const boundedEmpty = createState(false)
  const authoritativeEmpty = createState(true)
  assert.equal(boundedEmpty.resultCompleteness, 'complete')
  assert.equal(boundedEmpty.absenceAuthority, 'unsupported')
  assert.equal(authoritativeEmpty.resultCompleteness, 'complete')
  assert.equal(authoritativeEmpty.absenceAuthority, 'supported')
})

test('legacy result state remains callable without guessing missing completeness', () => {
  assert.deepEqual(resolveAiClientToolResultState({ success: true, status: 'ok' }), {
    executionStatus: 'completed',
    resultCompleteness: 'unknown',
    absenceAuthority: 'unknown',
    source: 'unknown',
    conflicted: false,
  })
  assert.equal(resolveAiClientToolResultState({
    success: true,
    status: 'partial',
    complete: false,
    truncated: true,
  }).resultCompleteness, 'partial')
  assert.equal(resolveAiClientToolResultState({
    success: false,
    status: 'failed',
  }).executionStatus, 'failed')
})

test('malformed and conflicting result evidence fails closed without affecting a valid sibling', () => {
  const malformed = resolveAiClientToolResultState({
    success: true,
    evidence: {
      contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
      complete: true,
      truncated: 'false',
      completeness: 'complete',
    },
  })
  const conflicting = resolveAiClientToolResultState({
    success: true,
    complete: true,
    truncated: false,
    completeness: 'complete',
    supportsAbsenceClaim: true,
    evidence: {
      contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
      complete: false,
      truncated: true,
      completeness: 'truncated',
      supportsAbsenceClaim: false,
    },
  })
  const validSibling = resolveAiClientToolResultState({
    success: true,
    complete: true,
    truncated: false,
  })

  assert.equal(malformed.resultCompleteness, 'unknown')
  assert.equal(malformed.conflicted, true)
  assert.equal(conflicting.resultCompleteness, 'partial')
  assert.equal(conflicting.absenceAuthority, 'unsupported')
  assert.equal(conflicting.conflicted, true)
  assert.equal(validSibling.resultCompleteness, 'complete')
  assert.equal(validSibling.conflicted, false)
})

test('typed aggregate execution facts survive standard adaptation and delivery', async () => {
  const points = [
    { time: 1_785_387_600_000, energy: 12 },
    { time: 1_785_391_200_000, energy: 18 },
  ]
  const tool = defineClientTool({
    id: 'test_facility_energy_aggregate',
    description: {
      text: 'Read a facility energy aggregate',
      capabilities: ['facility.energy.aggregate'],
    },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'facility-energy-series',
      shape: 'metric.time-series',
      fields: [
        { name: 'time', semanticRole: 'timestamp' },
        { name: 'energy', semanticRole: 'number', measure: 'energy', unit: 'kwh', aggregation: 'sum' },
      ],
      select: (result: { points: typeof points }) => result.points,
    }),
    execute: () => clientToolResult.success({ points }, {
      cardinality: {
        kind: 'aggregate-series',
        bucketCount: 24,
        populatedBucketCount: 2,
        measurementCount: 2,
      },
      claims: [{
        id: 'energy-total',
        label: 'Total energy',
        value: 30,
        measure: 'energy',
        statistic: 'sum',
        unit: 'kwh',
        visibility: 'user',
      }],
      supportsAbsenceClaim: false,
    }),
  })
  const prepared = await tool.execute(
    {},
    {},
    { id: 'facility-energy-call', toolName: tool.id },
  )
  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'facility-energy-call', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any

  assert.deepEqual(delivered.evidence.cardinality, {
    kind: 'aggregate-series',
    bucketCount: 24,
    populatedBucketCount: 2,
    measurementCount: 2,
  })
  assert.equal(delivered.evidence.claims[0].binding, 'facility-energy-series')
  assert.equal(delivered.evidence.claims[0].statistic, 'sum')
  assert.equal(delivered.evidence.supportsAbsenceClaim, false)
  assert.deepEqual(delivered.evidence.outputBindings.map((binding: any) => ({
    name: binding.name,
    shape: binding.shape,
    recordCount: binding.recordCount,
  })), [{
    name: 'facility-energy-series',
    shape: 'metric.time-series',
    recordCount: 2,
  }])
})

test('typed claims fail closed when multiple outputs do not identify a binding', async () => {
  const tool = defineClientTool({
    id: 'test_multi_output_claims',
    description: { text: 'Read two independent outputs', capabilities: ['test.multi.read'] },
    effect: { kind: 'READ' },
    output: [
      clientToolOutput.lookup({ name: 'first-output', shape: 'test.ids', select: (result: any) => result.first }),
      clientToolOutput.lookup({ name: 'second-output', shape: 'test.ids', select: (result: any) => result.second }),
    ],
    execute: () => clientToolResult.success({ first: ['one'], second: ['two'] }, {
      claims: [
        { id: 'ambiguous', label: 'Ambiguous', value: 2, visibility: 'user' },
        { id: 'bound', label: 'Bound', value: 1, binding: 'first-output', visibility: 'user' },
        { id: 'undeclared', label: 'Undeclared', value: 1, binding: 'missing-output', visibility: 'user' },
      ],
    }),
  })

  const prepared = await tool.execute({}, {}, { id: 'multi', toolName: tool.id }) as any
  assert.deepEqual(prepared.evidence.claims.map((claim: any) => claim.id), ['bound'])
  assert.equal(prepared.evidence.claims[0].binding, 'first-output')
})

test('typed partial results retain bounded evidence facts without becoming complete', async () => {
  const tool = defineClientTool({
    id: 'test_partial_aggregate_evidence',
    description: { text: 'Read a bounded partial aggregate', capabilities: ['test.partial.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'partial-series',
      shape: 'metric.time-series',
      select: (result: any) => result.points,
    }),
    execute: () => clientToolResult.partial({ points: [{ value: 1 }] }, {
      cardinality: {
        kind: 'aggregate-series',
        bucketCount: 4,
        populatedBucketCount: 1,
        measurementCount: 1,
      },
      claims: [{ id: 'observed', label: 'Observed', value: 1, visibility: 'user' }],
      supportsAbsenceClaim: false,
      limitReason: 'records',
    }),
  })

  const prepared = await tool.execute({}, {}, { id: 'partial', toolName: tool.id }) as any
  assert.equal(prepared.complete, false)
  assert.equal(prepared.truncated, false)
  assert.equal(prepared.evidence.displayTruncated, false)
  assert.equal(prepared.evidence.limitReason, 'records')
  assert.equal(prepared.evidence.claims[0].binding, 'partial-series')
  assert.equal(prepared.evidence.cardinality.measurementCount, 1)
})

test('record-set materialization preserves the owning output label', async () => {
  const records = Array.from({ length: 201 }, (_, index) => ({ index }))
  const tool = defineClientTool<Record<string, unknown>, Record<string, unknown>, { records: typeof records }>({
    id: 'test_labeled_records',
    description: {
      text: 'Read labeled records',
      capabilities: ['test.records.labeled'],
    },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet<{ records: typeof records }>({
      name: 'labeled-records',
      label: 'Labeled records',
      shape: 'test.labeled-records',
      select: result => result.records,
    }),
    execute: () => clientToolResult.success({ records }, {
      requestedRange: { start: 1_785_387_600_000, end: 1_785_473_999_999 },
      observedRange: { start: 1_785_391_200_000, end: 1_785_470_400_000 },
    }),
  })

  const prepared = await tool.execute({}, {}, { id: 'records', toolName: tool.id })
  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'records', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any

  assert.equal(delivered.outputBindings[0].name, 'labeled-records')
  assert.equal(delivered.outputBindings[0].label, 'Labeled records')
  assert.equal(delivered.outputBindings[0].path, '$.data.sample')
  assert.deepEqual(delivered.outputBindings[0].requestedRange, {
    start: 1_785_387_600_000,
    end: 1_785_473_999_999,
  })
  assert.deepEqual(delivered.outputBindings[0].observedRange, {
    start: 1_785_391_200_000,
    end: 1_785_470_400_000,
  })
})

test('aggregate facade preserves timestamp and dynamic measure contracts without presentation output', async () => {
  const timestampPoints = [
    { time: 1_785_387_600_000, value: 12 },
    { time: 1_785_391_200_000, value: 18 },
  ]
  const timestampTool = defineClientTool({
    id: 'test_timestamp_series',
    description: { text: 'Read a timestamp series', capabilities: ['test.timestamp.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'timestamp-series',
      shape: 'time-series.aggregate',
      fields: [
        { name: 'time', semanticRole: 'timestamp' },
        { name: 'value', semanticRole: 'number' },
      ],
      select: (result: any) => result.points,
    }),
    execute: () => ({ points: timestampPoints }),
  })
  const timestampPrepared = await timestampTool.execute(
    {},
    {},
    { id: 'timestamp', toolName: timestampTool.id },
  )
  assert.equal((timestampPrepared as any).data, undefined)
  assert.deepEqual((timestampPrepared as any).__clientToolOutputs.output0, timestampPoints)
  assert.deepEqual((timestampPrepared as any).outputBindings[0].fields, [
    { name: 'time', semanticRole: 'timestamp' },
    { name: 'value', semanticRole: 'number' },
  ])

  const dynamicMeasureTool = defineClientTool({
    id: 'test_dynamic_measure_series',
    description: { text: 'Read dynamic measures', capabilities: ['test.dynamic.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'dynamic-series',
      shape: 'time-series.summary',
      fields: [{ name: 'time', semanticRole: 'timestamp' }],
      select: (result: any) => result.points,
    }),
    execute: () => ({ points: [{ time: 1_785_387_600_000, values: { avg: 12 } }] }),
  })
  assert.deepEqual(dynamicMeasureTool.routing?.produces, ['dynamic-series'])
  const dynamicPrepared = await dynamicMeasureTool.execute(
    {},
    {},
    { id: 'dynamic', toolName: dynamicMeasureTool.id },
  ) as any
  assert.equal(dynamicPrepared.data, undefined)
  assert.deepEqual(dynamicPrepared.__clientToolOutputs.output0, [
    { time: 1_785_387_600_000, values: { avg: 12 } },
  ])
})

test('aggregate facade keeps contract-owned field semantics when a runtime resolver proposes alternatives', async () => {
  const points = [
    {
      time: 1_735_660_800_000,
      position_longitude: 120.1,
      position_latitude: 30.1,
    },
    {
      time: 1_735_664_400_000,
      position_longitude: 121.2,
      position_latitude: 31.2,
    },
  ]
  const fields = [
    { name: 'time', semanticRole: 'timestamp' as const },
    {
      name: 'position_longitude',
      semanticRole: 'longitude' as const,
      measure: 'position',
      aggregation: 'last',
    },
    {
      name: 'position_latitude',
      semanticRole: 'latitude' as const,
      measure: 'position',
      aggregation: 'last',
    },
  ]
  const tool = defineClientTool({
    id: 'test_dynamic_geo_series',
    description: { text: 'Read a dynamic location series', capabilities: ['test.location.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'location-series',
      shape: 'time-series.aggregate',
      fields: [{ name: 'time', semanticRole: 'timestamp' }],
      ordering: {
        keys: [{ field: 'time', direction: 'asc' }],
        producerGuaranteed: true,
      },
      select: (result: any) => result.points,
      resolveFields: () => fields,
    }),
    execute: () => ({ points }),
  })

  const prepared = await tool.execute({}, {}, { id: 'geo', toolName: tool.id }) as any
  assert.equal(prepared.data, undefined)
  assert.deepEqual(prepared.__clientToolOutputs.output0, points)
  assert.deepEqual(prepared.outputBindings[0].fields, [
    { name: 'time', semanticRole: 'timestamp' },
  ])
  assert.deepEqual(prepared.outputBindings[0].ordering, {
    keys: [{ field: 'time', direction: 'asc' }],
    producerGuaranteed: true,
  })
  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'geo', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any
  assert.equal(delivered.data, undefined)
  assert.equal(delivered.outputBindings.length, 1)
  assert.equal(delivered.outputBindings[0].shape, 'time-series.aggregate')
  assert.equal(delivered.outputBindings[0].mediaType, 'application/json')
  assert.deepEqual(delivered.outputBindings[0].ordering, {
    keys: [{ field: 'time', direction: 'asc' }],
    producerGuaranteed: true,
  })

  const unorderedTool = defineClientTool({
    id: 'test_dynamic_unordered_geo_series',
    description: { text: 'Read an unordered location set', capabilities: ['test.location.records'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'location-set',
      shape: 'time-series.aggregate',
      select: (result: any) => result.points,
      resolveFields: () => fields.map(field => ({ ...field, aggregation: undefined })),
    }),
    execute: () => ({ points }),
  })
  const unorderedPrepared = await unorderedTool.execute(
    {},
    {},
    { id: 'unordered-geo', toolName: unorderedTool.id },
  ) as any
  assert.equal(unorderedPrepared.data, undefined)
})

test('execution label resolver changes only the user-facing binding label', async () => {
  const fields = [
    { name: 'time', semanticRole: 'timestamp' as const },
    {
      name: 'value',
      semanticRole: 'number' as const,
      label: 'Temperature',
      measure: 'temperature',
      aggregation: 'avg',
    },
  ]
  const tool = defineClientTool({
    id: 'test_dynamic_output_label',
    description: { text: 'Read one typed value series', capabilities: ['test.value.aggregate'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'stable-value-series',
      label: 'Static aggregate result',
      shape: 'time-series.aggregate',
      fields: [{ name: 'time', semanticRole: 'timestamp' }],
      select: (result: any) => result.points,
      resolveFields: () => fields,
      resolveLabel: (_result, _value, resolvedFields) => (
        `${resolvedFields.find(field => field.semanticRole === 'number')?.label} · Average`
      ),
    }),
    execute: () => ({ points: [{ time: 1_785_387_600_000, value: 12 }] }),
  })

  assert.equal(tool.routing?.produces?.[0], 'stable-value-series')
  assert.equal(tool.routing?.outputShapes?.[0], 'time-series.aggregate')
  assert.equal(tool._meta?.resultBindings?.[0]?.label, 'Static aggregate result')

  const prepared = await tool.execute(
    {},
    {},
    { id: 'dynamic-label', toolName: tool.id },
  ) as any
  assert.equal(prepared.outputBindings[0].name, 'stable-value-series')
  assert.equal(prepared.outputBindings[0].shape, 'time-series.aggregate')
  assert.equal(prepared.outputBindings[0].label, 'Temperature · Average')
  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'dynamic-label', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any
  assert.equal(delivered.outputBindings[0].label, 'Temperature · Average')
})

test('facade compiles self-contained input alternatives and rejects undeclared references', () => {
  const tool = defineClientTool({
    id: 'test_time_scoped_read',
    description: {
      text: 'Read records in one time scope',
      capabilities: ['test.records.read'],
    },
    inputs: [
      { id: 'timeRange', description: 'Preset or custom range', required: true, valueType: 'string' },
      { id: 'startTime', description: 'Custom range start', valueType: 'string' },
      { id: 'endTime', description: 'Custom range end', valueType: 'string' },
    ],
    inputAlternatives: [{
      title: 'Custom time range',
      required: ['timeRange', 'startTime', 'endTime'],
      when: { input: 'timeRange', equals: 'custom' },
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'test-records',
      shape: 'test.records',
      select: result => result,
    }),
    execute: () => [],
  })

  assert.deepEqual(Object.keys(tool.parameterSchema!.oneOf![0].properties!), [
    'timeRange', 'startTime', 'endTime',
  ])
  assert.deepEqual(tool.parameterSchema!.oneOf![0].properties, {
    timeRange: { description: 'Preset or custom range', const: 'custom' },
    startTime: { description: 'Custom range start' },
    endTime: { description: 'Custom range end' },
  })
  assert.throws(
    () => defineClientTool({
      id: 'test_invalid_alternative',
      description: { text: 'Invalid alternative', capabilities: ['test.invalid'] },
      inputs: [{ id: 'known', valueType: 'string' }],
      inputAlternatives: [{ required: ['missing'] }],
      effect: { kind: 'READ' },
      output: clientToolOutput.detail({ name: 'detail', shape: 'test.detail', select: result => result }),
      execute: () => ({}),
    }),
    /input alternative references undeclared input: missing/,
  )
})

test('facade keeps materialized artifacts and inline follow-up selectors in one execution', async () => {
  const tool = defineClientTool<Record<string, unknown>, Record<string, unknown>, {
    artifact: ReturnType<typeof createAiClientToolArtifact>
    ids: string[]
  }>({
    id: 'test_artifact_with_ids',
    description: {
      text: 'Create a renderer-neutral result artifact',
      capabilities: ['test.artifact.create'],
      activation: 'ON_DEMAND',
    },
    effect: { kind: 'READ' },
    output: [
      clientToolOutput.artifact<any>({
        name: 'test-artifact',
        shape: 'test.result-set',
        mediaType: 'application/json',
        select: result => result.artifact,
      }),
      clientToolOutput.lookup<any>({
        name: 'test-result-id',
        shape: 'test.result-ids',
        select: result => result.ids,
      }),
    ],
    execute: () => ({
      ids: ['one'],
      artifact: createAiClientToolArtifact({
        content: JSON.stringify({ results: [{ id: 'one' }] }),
        mimeType: 'application/json',
        preview: { count: 1 },
      }),
    }),
  })

  const prepared = await tool.execute({}, {}, { id: 'artifact', toolName: tool.id })
  const delivered = await deliverAiClientToolResult(prepared, {
    call: {
      id: 'artifact',
      toolName: tool.id,
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    outputBindings: tool._meta?.resultBindings,
  }) as any

  assert.equal(delivered.producedFile, true)
  assert.deepEqual(delivered.__clientToolOutputs.output1, ['one'])
  assert.deepEqual(delivered.outputBindings.map((item: any) => item.name).sort(), [
    'test-artifact',
    'test-result-id',
  ])
})

test('registry revisions, scoped snapshots and stale disposers preserve the latest registration', () => {
  const scope = `test-scope-${Date.now()}`
  const changes: number[] = []
  const unsubscribe = aiClientToolRegistry.subscribe(scope, change => changes.push(change.revision))
  const first = aiClientToolRegistry.register(scope, {
    id: 'registry_first',
    execute: () => ({}),
  })
  const firstRevision = aiClientToolRegistry.revision
  const second = aiClientToolRegistry.register(scope, {
    id: 'registry_second',
    execute: () => ({}),
  })

  first()
  assert.deepEqual(aiClientToolRegistry.snapshot(scope).tools.map(tool => tool.id), ['registry_second'])
  assert.ok(aiClientToolRegistry.revision > firstRevision)
  second()
  assert.deepEqual(aiClientToolRegistry.snapshot(scope).tools, [])
  assert.equal(changes.length, 3)
  unsubscribe()
})

test('runtime refreshes handlers without changing the semantic wire version', async () => {
  let handlerVersion = 1
  const runtime = createClientToolSnapshotController(
    () => ({ signature: 'stable', execute: () => ({ handlerVersion }) }),
    snapshot => snapshot.signature,
  )
  const versions: number[] = []
  const unsubscribe = runtime.subscribe(version => versions.push(version))

  handlerVersion = 2
  runtime.refresh()

  assert.equal(runtime.version, 1)
  assert.deepEqual(versions, [])
  assert.equal(runtime.snapshot.execute().handlerVersion, 2)

  unsubscribe()
  runtime.dispose()
})

test('runtime publishes semantic schema changes only after active execution completes', async () => {
  let schemaVersion = 1
  const runtime = createClientToolSnapshotController(
    () => ({ signature: `Schema version ${schemaVersion}`, schemaVersion }),
    snapshot => snapshot.signature,
  )
  const versions: number[] = []
  runtime.subscribe(version => versions.push(version))
  const execution = runtime.beginExecution()

  schemaVersion = 2
  runtime.refresh()
  assert.equal(runtime.version, 1)
  assert.equal(runtime.snapshot.signature, 'Schema version 1')
  assert.deepEqual(versions, [])

  assert.equal(execution.snapshot.schemaVersion, 1)
  execution.complete()
  assert.equal(runtime.version, 2)
  assert.equal(runtime.snapshot.signature, 'Schema version 2')
  assert.deepEqual(versions, [2])
  runtime.dispose()
})

test('a reconstructed runtime always reads the latest authorized registry snapshot', () => {
  const scope = `runtime-reconnect-${Date.now()}`
  let disposeRegistration = aiClientToolRegistry.register(scope, {
    id: 'runtime_before_reconnect',
    description: 'Before reconnect',
    execute: () => ({}),
  })
  const createRuntime = () => createClientToolSnapshotController(
    () => aiClientToolRegistry.snapshot(scope),
    snapshot => String(snapshot.revision),
  )
  const firstRuntime = createRuntime()
  assert.deepEqual(firstRuntime.snapshot.tools.map(tool => tool.id), ['runtime_before_reconnect'])
  firstRuntime.dispose()

  disposeRegistration()
  disposeRegistration = aiClientToolRegistry.register(scope, {
    id: 'runtime_after_reconnect',
    description: 'After reconnect',
    execute: () => ({}),
  })
  const restoredRuntime = createRuntime()
  assert.deepEqual(restoredRuntime.snapshot.tools.map(tool => tool.id), ['runtime_after_reconnect'])

  restoredRuntime.dispose()
  disposeRegistration()
})

test('migrated business authoring uses the stable facade and internal imports stay allowlisted', () => {
  const workspaceRoot = path.resolve(process.cwd(), '..')
  const migratedFiles = [
    'jetlinks-web-core/src/layout/components/AiChat/homeAgentBaseTools.ts',
    'jetlinks-web-core/src/layout/components/AiChat/routeCapabilityLoader.ts',
    'modules/alarm-ui/agentCapabilities/alarmAnalysis/tools.ts',
    'modules/jetlinks-ai-ui/agentCapabilities/aiSearch/tools.ts',
    'modules/device-manager-ui/agentCapabilities/deviceAnalysis/tools.ts',
  ]
  migratedFiles.filter(relativePath => existsSync(path.join(workspaceRoot, relativePath))).forEach((relativePath) => {
    const source = readFileSync(path.join(workspaceRoot, relativePath), 'utf8')
    assert.match(source, /clientToolApi/)
    assert.doesNotMatch(source, /AiChat\/clientTools['"]/)
    assert.doesNotMatch(source, /clientTool(?:Routing|Contract|ResultDelivery|BindingPath)['"]/)
  })

  const retainedLegacyImports = new Set([
    'modules/device-manager-ui/agentCapabilities/deviceAnalysis/deviceProperty.service.ts',
  ])
  const collectSourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      if (['node_modules', 'dist', 'coverage'].includes(entry.name) || entry.isSymbolicLink()) return []
      const absolutePath = path.join(directory, entry.name)
      if (entry.isDirectory()) return collectSourceFiles(absolutePath)
      return /\.(?:ts|tsx|vue)$/.test(entry.name) ? [absolutePath] : []
    })
  const candidateFiles = collectSourceFiles(path.join(workspaceRoot, 'modules'))
    .map(absolutePath => path.relative(workspaceRoot, absolutePath))
  const violations = candidateFiles.filter((relativePath) => {
    const source = readFileSync(path.join(workspaceRoot, relativePath), 'utf8')
    return /AiChat\/clientTool(?:Routing|Contract|ResultDelivery|BindingPath)['"]/.test(source)
      && !retainedLegacyImports.has(relativePath)
  })
  assert.deepEqual(violations, [])
})

test('capability loading prompts resolve the loader from the actual serialized catalog', () => {
  const loaderContract = defineAiClientToolContract({
    routingKind: 'discovery',
    routing: {
      capabilities: ['client-capability.load'],
      evidencePolicy: 'none',
    },
  })
  const homeLoader = toAiClientToolSessionDefinition({
    id: 'home_agent_load_route_capabilities',
    ...loaderContract,
  }) as Record<string, any>
  const generalLoader = toAiClientToolSessionDefinition({
    id: 'general_agent_load_route_capabilities',
    ...loaderContract,
  }) as Record<string, any>

  assert.equal(resolveClientCapabilityLoaderToolId([homeLoader]), 'home_agent_load_route_capabilities')
  assert.equal(resolveClientCapabilityLoaderToolId([generalLoader]), 'general_agent_load_route_capabilities')
  assert.equal(resolveClientCapabilityLoaderToolId([]), '')
})

test('ordinary record queries stay auto-exposed while discovery helpers opt into deferred', () => {
  const records = defineAiClientToolContract({
    routingKind: 'records',
    routing: {
      capabilities: ['test.records.read'],
    },
  })
  const discovery = defineAiClientToolContract({
    routingKind: 'discovery',
    routing: {
      capabilities: ['test.capability.search'],
      exposure: 'deferred',
    },
  })

  assert.equal(records.routing.exposure, 'auto')
  assert.equal(discovery.routing.exposure, 'deferred')
})

test('typed contract generates routing, binding and evidence from one output declaration', () => {
  const contract = createSeriesContract()
  assert.equal(contract.routing.portVersion, 'ai-tool-port/v1')
  assert.deepEqual(contract.routing.producerPorts, [{
    name: 'series',
    type: 'structured-data',
    mediaType: 'application/json',
    shape: 'time-series.aggregate',
    audience: 'reusable-source',
  }])
  assert.deepEqual(contract.routing.produces, ['series'])
  assert.deepEqual(contract.routing.outputShapes, ['time-series.aggregate'])
  assert.deepEqual(contract.routing.resultDeliveries, ['auto'])
  assert.deepEqual(contract._meta.resultBindings, [{
    name: 'series',
    type: 'structured-data',
    audience: 'reusable-source',
    path: '$.data',
    shape: 'time-series.aggregate',
    mediaType: 'application/json',
    fields: [{ name: 'time', semanticRole: 'timestamp' }],
    ordering: {
      keys: [{ field: 'time', direction: 'asc' }],
      producerGuaranteed: true,
    },
  }])

  const result = withAiClientToolContractEvidence({ data: [{ time: 1 }] }, contract, {
    complete: true,
    truncated: false,
    outputs: [{ name: 'series', complete: true, path: '$.data' }],
  })
  assert.equal(result.evidence.outputBindings?.[0]?.name, 'series')
  assert.equal(result.evidence.outputBindings?.[0]?.shape, 'time-series.aggregate')
  assert.equal(result.evidence.outputBindings?.[0]?.audience, 'reusable-source')
  assert.deepEqual(result.evidence.outputBindings?.[0]?.ordering, {
    keys: [{ field: 'time', direction: 'asc' }],
    producerGuaranteed: true,
  })
})

test('consumer descriptors compile canonical ports and legacy discovery projections from one source', () => {
  const tool = defineClientTool({
    id: 'test_consumer_port',
    description: { text: 'Consume records', capabilities: ['test.records.consume'] },
    inputs: [],
    consumes: [{
      name: 'source',
      type: 'structured-data',
      mediaType: 'application/json',
      shape: 'tabular.records',
      required: true,
      sourcePolicy: 'EITHER',
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'summary', shape: 'tabular.summary' }),
    execute: () => clientToolResult.success({ total: 1 }),
  })

  assert.deepEqual(tool.routing?.consumerPorts, [{
    name: 'source',
    type: 'structured-data',
    mediaType: 'application/json',
    shape: 'tabular.records',
    required: true,
    sourcePolicy: 'EITHER',
  }])
  assert.deepEqual(tool.routing?.accepts, ['source'])
  assert.deepEqual(tool.routing?.prerequisites, ['source'])
  assert.equal(createAiClientToolCatalogReport([tool], {
    requireRouting: true,
    requireResultBindings: true,
  }).tools[0]?.contractStatus, 'typed')
})

test('legacy name-only consumers remain a bounded flat projection beside canonical outputs', () => {
  const tool = defineClientTool({
    id: 'test_legacy_consumer_port',
    description: { text: 'Consume a released legacy selector', capabilities: ['test.legacy.consume'] },
    inputs: [],
    consumes: [{ name: 'legacy-source', source: 'EITHER' }],
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'summary', shape: 'tabular.summary' }),
    execute: () => clientToolResult.success({ total: 1 }),
  })

  assert.equal(tool.routing?.portVersion, 'ai-tool-port/v1')
  assert.deepEqual(tool.routing?.consumerPorts, undefined)
  assert.deepEqual(tool.routing?.accepts, ['legacy-source'])
  assert.deepEqual(tool.routing?.prerequisites, ['legacy-source'])
  assert.deepEqual(tool.routing?.producerPorts, [{
    name: 'summary',
    type: 'structured-data',
    mediaType: 'application/json',
    shape: 'tabular.summary',
    audience: 'model-evidence',
  }])
})

test('partially migrated consumer descriptors fail instead of silently losing typed fields', () => {
  assert.throws(() => defineClientTool({
    id: 'test_partial_consumer_port',
    description: { text: 'Reject a partial descriptor', capabilities: ['test.partial.consume'] },
    inputs: [],
    consumes: [{
      name: 'partial-source',
      type: 'structured-data',
      source: 'EITHER',
    } as any],
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'summary', shape: 'tabular.summary' }),
    execute: () => clientToolResult.success({ total: 1 }),
  }), /either canonical descriptors or legacy name-only declarations/)
})

test('canonical and legacy consumer descriptors cannot be mixed in one declaration', () => {
  assert.throws(() => defineClientTool({
    id: 'test_mixed_consumer_ports',
    description: { text: 'Reject mixed migration states', capabilities: ['test.mixed.consume'] },
    inputs: [],
    consumes: [{
      name: 'canonical-source',
      type: 'structured-data',
      mediaType: 'application/json',
      shape: 'tabular.records',
      required: true,
      sourcePolicy: 'EITHER',
    }, {
      name: 'legacy-source',
      source: 'EITHER',
    }],
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'summary', shape: 'tabular.summary' }),
    execute: () => clientToolResult.success({ total: 1 }),
  }), /either canonical descriptors or legacy name-only declarations/)
})

test('ordering is bounded to declared fields and invalid declarations fail closed', () => {
  const fields = [
    { name: 'capturedAt', semanticRole: 'timestamp' as const },
    { name: 'value', semanticRole: 'number' as const },
  ]
  assert.deepEqual(normalizeAiClientToolOrdering({
    keys: [{ field: 'capturedAt', direction: 'ASC' }],
    producerGuaranteed: false,
  }, fields), {
    keys: [{ field: 'capturedAt', direction: 'asc' }],
    producerGuaranteed: false,
  })
  const invalid = [
    { keys: [{ field: 'missing', direction: 'asc' }], producerGuaranteed: true },
    { keys: [{ field: 'value', direction: 'asc' }, { field: 'value', direction: 'desc' }], producerGuaranteed: true },
    { keys: [{ field: 'value', direction: 'sideways' }], producerGuaranteed: true },
    { keys: [{ field: 'value', direction: 'asc' }] },
    {
      keys: Array.from({ length: 9 }, (_, index) => ({ field: index ? `field-${index}` : 'value', direction: 'asc' })),
      producerGuaranteed: true,
    },
  ]
  invalid.forEach(value => assert.equal(normalizeAiClientToolOrdering(value, fields), undefined))
})

test('canonical output fields require an explicit bounded record path', () => {
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.records.read'] },
    outputs: [{
      kind: 'record-set',
      name: 'records',
      shape: 'tabular.records',
      audience: 'model-evidence',
      path: '$.data',
      fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    }],
  }), /explicit recordPath/)
})

test('execution state cannot override contract-owned record path, fields, or ordering', () => {
  const contract = defineAiClientToolContract({
    routingKind: 'aggregate',
    routing: { capabilities: ['test.series.aggregate'] },
    outputs: [{
      kind: 'aggregate-series',
      name: 'series',
      shape: 'time-series.aggregate',
      audience: 'model-evidence',
      path: '$.data',
      recordPath: '$.records[*]',
      fields: [
        { name: 'capturedAt', type: 'timestamp', role: 'temporal_dimension', encoding: 'epoch-millis' },
        { name: 'value', type: 'number', role: 'measure', measure: 'energy', unit: 'kwh', aggregation: 'sum' },
      ],
      ordering: {
        keys: [{ field: 'capturedAt', direction: 'asc' }],
        producerGuaranteed: true,
      },
    }],
  })

  const binding = createAiClientToolContractOutputBinding(contract, {
    name: 'series',
    path: '$.runtime',
    complete: true,
    completeness: 'complete',
    recordPath: '$.overridden[*]',
    fields: [{ name: 'other', type: 'string', role: 'label' }],
    ordering: {
      keys: [{ field: 'other', direction: 'desc' }],
      producerGuaranteed: false,
    },
  } as any)

  assert.equal(binding.path, '$.runtime')
  assert.equal(binding.recordPath, '$.records[*]')
  assert.deepEqual(binding.fields, contract._meta.clientToolContract.outputs[0].fields)
  assert.deepEqual(binding.ordering, contract._meta.clientToolContract.outputs[0].ordering)
})

test('closed analytical selector projects ordering only onto its owning materialized binding', async () => {
  const mediaType = 'application/vnd.anonymous.invocation-records+json'
  const fields = [
    { name: 'eventTime', type: 'timestamp' as const, role: 'temporal_dimension' as const, axis: 'time', encoding: 'epoch-millis' as const },
    { name: 'id', type: 'string' as const, role: 'identifier' as const },
  ]
  const tool = defineClientTool<Record<string, unknown>, Record<string, unknown>, any>({
    id: 'anonymous_invocation_ordering',
    description: { text: 'Return anonymous records', capabilities: ['anonymous.records.read'] },
    inputs: [
      { id: 'topK', valueType: { type: 'integer', min: 1, max: 10 } },
            { id: 'order', valueType: { type: 'enum', valueType: { type: 'string' }, elements: [{ value: 'earliest' }, { value: 'latest' }] } },
    ],
    analytical: defineClientToolAnalyticalProducer({
      producerKey: 'anonymous.invocation.ordering',
      factKey: 'anonymous-invocation-records',
      subjects: ['record'],
      measures: [{ name: 'retrieved_record', aggregations: ['retrieve'], units: ['record'] }],
      dimensions: ['time'], filters: [], grains: [], criteria: ['retrieval', 'argmin', 'argmax'],
      ordering: [{ axis: 'event_time', direction: 'asc' }, { axis: 'event_time', direction: 'desc' }],
      coverage: 'complete-or-partial',
      closedEnumSelector: {
        argument: 'order', limitArgument: 'topK', cases: [
          { value: 'earliest', criterion: 'argmin', measures: ['retrieved_record'], dimensions: ['time'], ordering: { axis: 'event_time', direction: 'asc' }, requestedLimit: 1 },
          { value: 'latest', criterion: 'argmax', measures: ['retrieved_record'], dimensions: ['time'], ordering: { axis: 'event_time', direction: 'desc' }, requestedLimit: 1 },
        ],
      },
      output: 'records',
    }),
    effect: { kind: 'READ' },
    output: [
      clientToolOutput.artifact({
        name: 'records', shape: 'anonymous.invocation-records', mediaType,
        audience: 'reusable-source', recordPath: '$.records', fields,
        select: result => result.artifact,
      }),
      clientToolOutput.lookup({
        name: 'summary', shape: 'anonymous.invocation-summary', audience: 'model-evidence',
        select: result => result.summary,
      }),
    ],
    execute: () => clientToolResult.success({
      artifact: createAiClientToolArtifact({
        content: JSON.stringify({ records: [{ eventTime: 1, id: 'record-1' }] }),
        modelSafeInline: { records: [{ eventTime: 1, id: 'record-1' }] },
        mimeType: mediaType,
        preview: { records: 1 },
        recordPath: '$.records',
      }),
      summary: { count: 1 },
    }),
  })
  assert.equal(tool._meta?.resultBindings.find(binding => binding.name === 'records')?.ordering, undefined)

  const deliver = async (order: string) => {
    const prepared = await tool.execute({ topK: 1, order }, {}, { id: `ordering-${order}`, toolName: tool.id })
    return deliverAiClientToolResult(prepared, {
      call: {
        id: `delivery-${order}`,
        toolName: tool.id,
        presentationCapabilities: [{ name: 'anonymous', supportsSessionFile: false }],
        sessionFiles: {
          toUri: path => `fs://${path}`,
          upload: async path => ({ ok: true, path }),
          remove: async path => ({ ok: true, path }),
        },
      },
      resultDelivery: 'auto',
      outputs: tool._meta!.clientToolContract.outputs.map(output => ({
        name: output.name, type: output.type, shape: output.shape, mediaType: output.mediaType,
        audience: output.audience, delivery: output.delivery,
      })),
      outputBindings: tool._meta!.resultBindings,
    }) as any
  }
  const earliest = await deliver('earliest')
  const latest = await deliver('latest')
  const ordinary = await deliver('similar')
  const records = (result: any) => result.outputBindings.find((binding: any) => binding.name === 'records')
  assert.deepEqual(records(earliest).ordering, { keys: [{ field: 'eventTime', direction: 'asc' }], producerGuaranteed: true })
  assert.deepEqual(records(latest).ordering, { keys: [{ field: 'eventTime', direction: 'desc' }], producerGuaranteed: true })
  assert.equal(records(ordinary).ordering, undefined)
  assert.deepEqual(records(earliest).fields, fields)
  assert.equal(records(earliest).recordPath, '$.records')
  assert.equal(records(earliest).audience, 'reusable-source')
  assert.deepEqual(earliest.outputBindings.map((binding: any) => binding.name).sort(), ['records', 'summary'])
})

test('materialized references keep contract-owned record paths and never reuse a physical file path as JSONPath', () => {
  const contract = defineAiClientToolContract({
    routingKind: 'aggregate',
    routing: { capabilities: ['test.series.aggregate'] },
    outputs: [{
      kind: 'aggregate-series',
      name: 'series',
      shape: 'time-series.aggregate',
      audience: 'model-evidence',
      path: '$.data',
      recordPath: '$.results',
      fields: [{ name: 'time', semanticRole: 'timestamp' }],
    }],
  })
  const binding = createAiClientToolContractOutputBinding(contract, {
    name: 'series',
    ref: 'fs://generated/series.ndjson',
    path: 'generated/series.ndjson',
    complete: true,
  })
  assert.equal(binding.ref, 'fs://generated/series.ndjson')
  assert.equal(binding.path, undefined)
  assert.equal(binding.recordPath, '$.results')
  assert.throws(() => createAiClientToolContractOutputBinding(contract, {
    name: 'series',
    path: '$..data',
    complete: true,
  }), /Unsupported client tool execution binding path/)
  const ignoredOverride = createAiClientToolContractOutputBinding(contract, {
    name: 'series',
    ref: 'fs://generated/series.json',
    recordPath: '$.*',
    complete: true,
  } as any)
  assert.equal(ignoredOverride.recordPath, '$.results')
})

test('binding paths support only the bounded property, wildcard and equality grammar', () => {
  const root = {
    groups: [{ items: [{ state: 'ok', id: 1 }, { state: 'failed', id: 2 }] }],
  }
  assert.deepEqual(resolveAiClientToolBindingPath(root, '$'), { resolved: true, values: [root] })
  assert.deepEqual(
    resolveAiClientToolBindingPath(root, '$.groups[*].items[?(@.state=="ok")]'),
    { resolved: true, values: [{ state: 'ok', id: 1 }] },
  )
  assert.deepEqual(resolveAiClientToolBindingPath(root, 'groups'), { resolved: false, values: [] })
  assert.deepEqual(resolveAiClientToolBindingPath(root, '$[0]'), { resolved: false, values: [] })
  assert.deepEqual(resolveAiClientToolBindingPath(root, '$.missing[*]'), { resolved: false, values: [] })
})

test('contract validation rejects duplicate outputs and unsafe delivery declarations', () => {
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.records.read'] },
    outputs: [
      { kind: 'record-set', name: 'records', shape: 'records', audience: 'model-evidence', path: '$.data' },
      { kind: 'record-set', name: 'records', shape: 'records', audience: 'model-evidence', path: '$.other' },
    ],
  }), /Duplicate client tool output binding/)
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.records.read'] },
    outputs: [{
      kind: 'record-set',
      name: 'records',
      shape: 'records',
      audience: 'reusable-source',
      path: '$.data',
      delivery: 'file',
    }],
  }), /must not declare an inline binding path/)
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'artifact',
    routing: { capabilities: ['test.artifact.create'] },
    outputs: [{
      kind: 'artifact', name: 'artifact', shape: 'document', audience: 'reusable-source', mediaType: '',
    }],
  }), /requires a media type/)
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'artifact',
    routing: { capabilities: ['test.artifact.create'] },
    outputs: [{
      kind: 'artifact', name: 'artifact', type: 'structured-data', shape: 'document',
      audience: 'reusable-source', mediaType: 'application/octet-stream', delivery: 'auto',
    }],
  }), /must use artifact type and file delivery/)
})

test('runtime evidence rejects duplicate bindings', () => {
  const contract = createSeriesContract()
  assert.throws(() => withAiClientToolContractEvidence({}, contract, {
    complete: true,
    truncated: false,
    outputs: [
      { name: 'series', complete: true, path: '$.data' },
      { name: 'series', complete: true, path: '$.data' },
    ],
  }), /Duplicate client tool execution binding/)
})

test('serialized contract metadata is validated without trusting its TypeScript origin', () => {
  const metadata = createSeriesContract()._meta.clientToolContract
  assert.equal(isAiClientToolContractMetadata(metadata), true)
  assert.equal(isAiClientToolContractMetadata({ ...metadata, version: 'unknown' }), false)
  assert.equal(isAiClientToolContractMetadata({
    ...metadata,
    outputs: [...metadata.outputs, metadata.outputs[0]],
  }), false)
  assert.equal(isAiClientToolContractMetadata({
    ...metadata,
    outputs: [{ kind: 'artifact', name: 'file', shape: 'document' }],
  }), false)
})

test('artifact outputs default to file delivery and cannot create inline bindings', () => {
  const contract = defineAiClientToolContract({
    routingKind: 'artifact',
    routing: { capabilities: ['test.document.create'] },
    outputs: [{
      kind: 'artifact',
      name: 'document',
      shape: 'document.pdf',
      audience: 'reusable-source',
      mediaType: 'application/pdf',
    }],
  })
  assert.deepEqual(contract.routing.resultDeliveries, ['file'])
  assert.deepEqual(contract._meta.resultBindings, [])
  assert.equal(isAiClientToolContractMetadata(contract._meta.clientToolContract), true)
  assert.throws(() => createAiClientToolContractOutputBinding(contract, {
    name: 'unknown', complete: true, ref: 'fs://generated/report.pdf',
  }), /Undeclared client tool output binding/)
  assert.throws(() => createAiClientToolContractOutputBinding(contract, {
    name: 'document', complete: true, ref: '$.data',
  }), /must not be a JSONPath/)
  assert.throws(() => createAiClientToolContractOutputBinding(contract, {
    name: 'document', complete: true,
  }), /has no inline path or materialized reference/)
})

test('required presentation diagnostics use canonical resource, media, shape and delivery axes', () => {
  const presentation = {
    type: 'anonymous-grid',
    contentType: 'json' as const,
    mediaType: 'application/vnd.example.records+json',
    supportsSessionFile: true,
    maxInlineBytes: 4096,
    defaultMode: 'preview' as const,
    purpose: 'conversation-preview' as const,
    preferredInputShapes: ['example.records'],
    deliveryPolicy: 'required' as const,
  }
  const compatible = defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['example.records.read'] },
    outputs: [{
      kind: 'record-set',
      name: 'records',
      type: 'structured-data',
      mediaType: presentation.mediaType,
      shape: 'example.records',
      audience: 'client-presentation',
      path: '$.data',
      delivery: 'auto',
    }],
  })
  assert.deepEqual(
    diagnoseAiClientToolPresentationCompatibility(compatible._meta.clientToolContract, presentation),
    { status: 'compatible', compatibleOutputs: ['records'], issues: [] },
  )

  const artifact = defineAiClientToolContract({
    routingKind: 'artifact',
    routing: { capabilities: ['example.file.create'] },
    outputs: [{
      kind: 'artifact',
      name: 'file',
      type: 'artifact',
      mediaType: presentation.mediaType,
      shape: 'example.records',
      audience: 'reusable-source',
      delivery: 'file',
    }],
  })
  const artifactDiagnostic = diagnoseAiClientToolPresentationCompatibility(
    artifact._meta.clientToolContract,
    presentation,
  )
  assert.equal(artifactDiagnostic.status, 'incompatible')
  assert.deepEqual(artifactDiagnostic.compatibleOutputs, [])
  assert.ok(artifactDiagnostic.issues.some(issue => issue.code === 'resource_type_mismatch'))

  const incompatible = [
    defineAiClientToolContract({
      routingKind: 'records',
      routing: { capabilities: ['example.other-media.read'] },
      outputs: [{
        kind: 'record-set', name: 'other-media', shape: 'example.records', path: '$.data',
        audience: 'client-presentation', mediaType: 'application/vnd.example.other+json', delivery: 'auto',
      }],
    }),
    defineAiClientToolContract({
      routingKind: 'records',
      routing: { capabilities: ['example.other-shape.read'] },
      outputs: [{
        kind: 'record-set', name: 'other-shape', shape: 'example.other', path: '$.data',
        audience: 'client-presentation', mediaType: presentation.mediaType, delivery: 'auto',
      }],
    }),
    artifact,
  ].map(contract => diagnoseAiClientToolPresentationCompatibility(
    contract._meta.clientToolContract,
    presentation,
  ))
  assert.deepEqual(incompatible.map(item => item.status), [
    'incompatible', 'incompatible', 'incompatible',
  ])
  assert.ok(incompatible[0].issues.some(issue => issue.code === 'media_type_mismatch'))
  assert.ok(incompatible[1].issues.some(issue => issue.code === 'shape_mismatch'))

  const ambiguous = defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['example.ambiguous.read'] },
    outputs: ['left', 'right'].map((name, index) => ({
      kind: 'record-set' as const,
      name,
      shape: 'example.records',
      mediaType: presentation.mediaType,
      audience: 'client-presentation' as const,
      path: `$.__clientToolOutputs.output${index}`,
      delivery: 'auto' as const,
    })),
  })
  assert.deepEqual(
    diagnoseAiClientToolPresentationCompatibility(ambiguous._meta.clientToolContract, presentation),
    { status: 'ambiguous', compatibleOutputs: ['left', 'right'], issues: [] },
  )
  assert.equal(diagnoseAiClientToolPresentationCompatibility({
    ...compatible._meta.clientToolContract,
    version: 'unknown',
  }, presentation).status, 'malformed')
  assert.equal(diagnoseAiClientToolPresentationCompatibility(
    compatible._meta.clientToolContract,
    { ...presentation, preferredInputShapes: [] },
  ).status, 'malformed')

  const wildcardDiagnostic = diagnoseAiClientToolPresentationCompatibility(
    compatible._meta.clientToolContract,
    { ...presentation, preferredInputShapes: ['example.*'] },
  )
  assert.equal(wildcardDiagnostic.status, 'compatible')
})

const artifactReplyBudgetFixture = (text: string, envelopeText: string) => {
  const source = { records: [{ id: 'one', text }] }
  const mediaType = 'application/vnd.example.reply-budget+json'
  const shape = 'example.reply-budget'
  const artifact = createAiClientToolArtifact({
    content: JSON.stringify(source), modelSafeInline: source, mimeType: mediaType, fileExtension: 'json',
    preview: { count: 1 }, bindingName: 'presentation', outputShape: shape,
    recordPath: '$.records', fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    complete: true, truncated: false, exhaustive: false,
  })
  return {
    source, artifact,
    result: { success: true, complete: true, status: 'ok', explanation: envelopeText, data: artifact },
    output: { name: 'presentation', type: 'presentation' as const, shape, mediaType,
      audience: 'client-presentation' as const, delivery: 'auto' as const },
    capability: { type: 'anonymous-budget-view', contentType: 'json' as const, mediaType,
      supportsSessionFile: true, maxInlineBytes: 64 * 1024, defaultMode: 'preview' as const,
      purpose: 'conversation-preview' as const, preferredInputShapes: [shape], deliveryPolicy: 'required' as const },
  }
}

test('artifact auto delivery uses merged reply characters independently from renderer source bytes', async () => {
  for (const mode of ['envelope', 'within', 'utf8', 'guard-disabled'] as const) {
    const fixture = artifactReplyBudgetFixture(
      mode === 'utf8' ? '画'.repeat(24 * 1024) : 'x'.repeat(mode === 'within' ? 1024 : 38 * 1024),
      'e'.repeat(mode === 'envelope' || mode === 'guard-disabled' ? 38 * 1024 : 1024),
    )
    const content = JSON.stringify(fixture.source)
    const rawBytes = Buffer.byteLength(content, 'utf8')
    let uploads = 0
    let uploaded = ''
    const options = {
      outputs: [fixture.output], replyMaxJsonLength: mode === 'guard-disabled' ? undefined : 64 * 1024,
      call: { id: mode, toolName: 'anonymous_budget', presentationCapabilities: [fixture.capability], sessionFiles: {
        toUri: (path: string) => `fs://${path}`,
        upload: async (path: string, value: unknown) => {
          uploads += 1
          uploaded = String(value)
          return { ok: true, path }
        },
        remove: async (path: string) => ({ ok: true, path }),
      } },
    }
    const delivered = await deliverAiClientToolResult(fixture.result, options) as any
    if (mode === 'envelope' || mode === 'utf8') {
      assert.equal(uploads, 1, mode)
      assert.equal(delivered.summary.delivery, 'session-file')
      assert.equal(uploaded, content)
      assert.match(delivered.outputBindings[0].ref, /^fs:\/\//)
      assert.equal(delivered.outputBindings[0].type, 'presentation')
      assert.equal(delivered.outputBindings[0].sourceDigest,
        `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`)
      assert.equal(delivered.outputBindings[0].sourceDigestProfile, 'bytes-v1')
      assert.equal(delivered.outputBindings[0].complete, true)
      assert.equal(delivered.outputBindings[0].exhaustive, false)
      assert.equal(delivered.data.presentationSource, undefined)
      assert.ok(JSON.stringify(delivered).length < 64 * 1024)
      if (mode === 'envelope') assert.ok(rawBytes < 64 * 1024)
      else {
        assert.ok(rawBytes > 64 * 1024)
        assert.ok(content.length < 64 * 1024)
      }
    } else {
      assert.equal(uploads, 0, mode)
      assert.deepEqual(delivered.data.presentationSource, fixture.source)
      assert.equal(delivered.outputBindings[0].ref, undefined)
      assert.equal(delivered.summary.delivery, 'inline')
      if (mode === 'within') assert.ok(JSON.stringify(delivered).length < 64 * 1024)
      else assert.ok(JSON.stringify(delivered).length > 64 * 1024)
    }
  }
})

test('artifact reply promotion cannot override inline declarations or renderer file capability', async () => {
  for (const mode of ['inline', 'no-file-capability', 'unknown-renderer'] as const) {
    const fixture = artifactReplyBudgetFixture('x'.repeat(38 * 1024), 'e'.repeat(38 * 1024))
    let uploads = 0
    const delivered = await deliverAiClientToolResult(fixture.result, {
      outputs: [{ ...fixture.output, delivery: mode === 'inline' ? 'inline' : 'auto' }],
      replyMaxJsonLength: 64 * 1024,
      call: { id: mode, toolName: 'anonymous_budget',
        presentationCapabilities: mode === 'unknown-renderer' ? [] : [{
          ...fixture.capability, supportsSessionFile: mode !== 'no-file-capability',
        }],
        sessionFiles: {
          toUri: path => `fs://${path}`,
          upload: async path => { uploads += 1; return { ok: true, path } },
          remove: async path => ({ ok: true, path }),
        },
      },
    }) as any
    assert.equal(uploads, 0, mode)
    assert.equal(delivered.producedFile, false)
    assert.ok(!delivered.outputBindings?.some((binding: any) => binding.ref), mode)
    if (mode !== 'unknown-renderer') assert.deepEqual(delivered.data.presentationSource, fixture.source)
  }
})

test('artifact reply promotion preserves upload failure and cancellation without a second attempt', async () => {
  for (const mode of ['unavailable', 'rejected', 'error', 'cancel', 'original-file-failure'] as const) {
    const fixture = artifactReplyBudgetFixture('x'.repeat(38 * 1024), 'e'.repeat(38 * 1024))
    const controller = new AbortController()
    let uploads = 0
    let removals = 0
    const operation = deliverAiClientToolResult(fixture.result, {
      outputs: [{ ...fixture.output, delivery: mode === 'original-file-failure' ? 'file' : 'auto' }],
      replyMaxJsonLength: 64 * 1024,
      call: { id: mode, toolName: 'anonymous_budget', signal: controller.signal,
        presentationCapabilities: [fixture.capability], sessionFiles: {
          capabilities: () => ({ available: mode !== 'unavailable' }),
          toUri: path => `fs://${path}`,
          upload: async path => {
            uploads += 1
            if (mode === 'cancel') controller.abort()
            if (mode === 'error' || mode === 'original-file-failure') throw new Error('upload failed')
            return { ok: mode !== 'rejected', path }
          },
          remove: async path => { removals += 1; return { ok: true, path } },
        },
      },
    })
    if (mode === 'cancel') {
      await assert.rejects(operation, { name: 'AbortError' })
    } else {
      const delivered = await operation as any
      assert.equal(delivered.producedFile, false)
      assert.deepEqual(delivered.data.presentationSource, fixture.source)
      assert.ok(!delivered.outputBindings?.some((binding: any) => binding.ref))
      assert.ok(JSON.stringify(delivered).length > 64 * 1024)
      assert.ok(delivered.evidence.warnings.includes(
        mode === 'unavailable' ? 'CLIENT_TOOL_FILE_UNAVAILABLE' : 'CLIENT_TOOL_FILE_WRITE_FAILED',
      ))
    }
    assert.equal(uploads, mode === 'unavailable' ? 0 : 1, mode)
    assert.equal(removals, mode === 'unavailable' ? 0 : 1, mode)
  }
})

test('structured producer keeps one canonical binding through artifact materialization', async () => {
  let producerCalls = 0
  let incompatibleCalls = 0
  const mediaType = 'application/vnd.example.materialized-records+json'
  const shape = 'example.materialized-records'
  const presentation = {
    type: 'anonymous-table',
    contentType: 'json' as const,
    mediaType,
    supportsSessionFile: true,
    maxInlineBytes: 4096,
    defaultMode: 'preview' as const,
    purpose: 'conversation-preview' as const,
    preferredInputShapes: [shape],
    deliveryPolicy: 'required' as const,
  }
  const createCarrier = (modelSafeInline: boolean) => createAiClientToolArtifact({
    content: JSON.stringify({ records: [{ id: 'one' }, { id: 'two' }] }),
    mimeType: mediaType,
    fileExtension: 'json',
    bindingName: 'records',
    outputShape: shape,
    recordPath: '$.records',
    cardinality: {
      kind: 'record-set',
      recordCount: 2,
      returnedCount: 2,
      totalCount: 2,
    },
    complete: true,
    truncated: false,
    preview: { records: [{ id: 'one' }] },
    ...(modelSafeInline ? { modelSafeInline: { records: [{ id: 'one' }, { id: 'two' }] } } : {}),
  })
  const producer = defineClientTool<Record<string, unknown>, Record<string, unknown>, ReturnType<typeof createCarrier>>({
    id: 'anonymous_structured_producer',
    description: { text: 'Produce anonymous structured records', capabilities: ['example.records.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'records',
      shape,
      mediaType,
      audience: 'client-presentation',
      recordPath: '$.records',
      fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    }),
    execute: () => {
      producerCalls += 1
      return createCarrier(true)
    },
  })
  const incompatibleProducer = defineClientTool<Record<string, unknown>, Record<string, unknown>, ReturnType<typeof createCarrier>>({
    id: 'anonymous_file_producer',
    description: { text: 'Produce anonymous file', capabilities: ['example.file.create'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.artifact({ name: 'records', shape, mediaType }),
    execute: () => {
      incompatibleCalls += 1
      return createCarrier(true)
    },
  })
  const diagnostic = diagnoseAiClientToolPresentationCompatibility(
    producer._meta?.clientToolContract,
    presentation,
  )
  const incompatibleDiagnostic = diagnoseAiClientToolPresentationCompatibility(
    incompatibleProducer._meta?.clientToolContract,
    presentation,
  )
  assert.equal(diagnostic.status, 'compatible')
  assert.equal(incompatibleDiagnostic.status, 'incompatible')
  assert.equal(producerCalls, 0)
  assert.equal(incompatibleCalls, 0)

  const prepared = await producer.execute({}, {}, { id: 'one-call', toolName: producer.id })
  // Browser presentation stays in the complete typed contract, but is deliberately absent
  // from model-facing routing.
  const port = producer._meta?.clientToolContract.outputs[0]
  assert.ok(port)
  const deliveryOptions = {
    bindingName: port.name,
    outputShape: port.shape,
    outputType: port.type,
    outputs: producer._meta!.clientToolContract.outputs.map((output: any) => ({
      name: output.name,
      type: output.type,
      shape: output.shape,
      mediaType: output.mediaType,
      audience: output.audience,
      delivery: output.delivery,
    })),
  }
  const inline = await deliverAiClientToolResult(prepared, {
    call: {
      id: 'inline',
      toolName: producer.id,
      presentationCapabilities: [{ ...presentation, supportsSessionFile: false }],
    },
    resultDelivery: 'auto',
    ...deliveryOptions,
  }) as any
  const file = await deliverAiClientToolResult(prepared, {
    call: {
      id: 'file',
      toolName: producer.id,
      presentationCapabilities: [{ ...presentation, maxInlineBytes: 0 }],
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
    ...deliveryOptions,
  }) as any
  assert.equal(producerCalls, 1)
  assert.equal(incompatibleCalls, 0)
  const logicalBinding = (value: any) => ({
    name: value.name,
    type: value.type,
    audience: value.audience,
    sourceDigest: value.sourceDigest,
    shape: value.shape,
    mediaType: value.mediaType,
    recordPath: value.recordPath,
    complete: value.complete,
    truncated: value.truncated,
  })
  assert.deepEqual(logicalBinding(inline.outputBindings[0]), logicalBinding(file.outputBindings[0]))
  assert.match(inline.outputBindings[0].sourceDigest, /^sha256:[a-f0-9]{64}$/)
  assert.equal(file.outputBindings[0].sourceDigest, inline.outputBindings[0].sourceDigest)
  assert.deepEqual(logicalBinding(file.outputBindings[0]), {
    name: 'records',
    type: 'structured-data',
    audience: 'client-presentation',
    sourceDigest: inline.outputBindings[0].sourceDigest,
    shape,
    mediaType,
    recordPath: '$.records',
    complete: true,
    truncated: false,
  })
  assert.equal(inline.outputBindings[0].path, '$.data.presentationSource')
  assert.ok(file.outputBindings[0].ref.startsWith('fs://'))

  const boundedPreview = await deliverAiClientToolResult({ data: createCarrier(false) }, {
    call: {
      id: 'preview',
      toolName: producer.id,
      presentationCapabilities: [presentation],
    },
    resultDelivery: 'auto',
    ...deliveryOptions,
  }) as any
  assert.equal(boundedPreview.status, 'partial')
  assert.equal(boundedPreview.complete, false)
  assert.equal(boundedPreview.truncated, false)
  assert.equal(boundedPreview.evidence.displayTruncated, false)
  assert.equal(boundedPreview.outputBindings, undefined)
  assert.equal(boundedPreview.evidence?.outputBindings?.[0]?.sourceDigest, undefined)
  assert.equal(boundedPreview.data.presentationSource, undefined)
})

test('materialized artifact validation targets the exact logical source and isolates malformed carriers', async () => {
  const semanticToken = crypto.randomUUID().replaceAll('-', '')
  const mediaType = `application/vnd.${semanticToken}+json`
  const shape = `anonymous.${semanticToken}.records`
  const fields = [{ name: 'id', type: 'string' as const, role: 'identifier' as const }]
  type ArtifactContent = string | Blob | ArrayBuffer
  let artifactContent: ArtifactContent = JSON.stringify({ records: [{ id: 'valid' }] })
  let artifactMediaType = mediaType
  let artifactRecordPath: string | undefined
  const artifactProducer = defineClientTool<Record<string, unknown>, Record<string, unknown>, any>({
    id: `anonymous_materialized_${semanticToken}`,
    description: { text: 'Produce anonymous materialized records', capabilities: [`${semanticToken}.read`] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'records',
      shape,
      mediaType,
      audience: 'client-presentation',
      recordPath: '$.records',
      fields,
    }),
    execute: () => createAiClientToolArtifact({
      content: artifactContent,
      mimeType: artifactMediaType,
      bindingName: 'records',
      outputShape: shape,
      ...(artifactRecordPath ? { recordPath: artifactRecordPath } : {}),
      preview: { count: 1 },
    }),
  })

  for (const content of [
    JSON.stringify({ records: [{ id: 'string-source' }] }),
    new Blob([JSON.stringify({ records: [{ id: 'blob-source' }] })], { type: mediaType }),
    new TextEncoder().encode(JSON.stringify({ records: [{ id: 'buffer-source' }] })).buffer,
  ]) {
    artifactContent = content
    artifactMediaType = mediaType
    artifactRecordPath = undefined
    const prepared = await artifactProducer.execute({}, {}, {
      id: `valid-${semanticToken}`,
      toolName: artifactProducer.id,
    }) as any
    assert.equal(prepared.data.recordPath, '$.records')
    assert.deepEqual(prepared.data.fields, fields)
  }

  const expectSelectionFailure = async () => assert.rejects(
    artifactProducer.execute({}, {}, {
      id: `invalid-${semanticToken}`,
      toolName: artifactProducer.id,
    }),
    (error: any) => error?.code === 'CLIENT_TOOL_OUTPUT_SELECTION_FAILED',
  )

  artifactContent = JSON.stringify({ sibling: [{ id: 'missing-path' }] })
  await expectSelectionFailure()
  artifactContent = JSON.stringify({ records: [{ id: 42 }] })
  await expectSelectionFailure()
  artifactContent = 'not-json'
  await expectSelectionFailure()
  artifactContent = JSON.stringify({ records: [{ id: 'wrong-media-type' }] })
  artifactMediaType = 'text/plain'
  await expectSelectionFailure()
  artifactMediaType = mediaType
  artifactContent = JSON.stringify({ records: [{ id: 'conflicting-path' }], sibling: [] })
  artifactRecordPath = '$.sibling'
  await expectSelectionFailure()
  artifactRecordPath = undefined

  let inlineId: unknown = 'valid-inline'
  const inlineSibling = defineClientTool<Record<string, unknown>, Record<string, unknown>, any>({
    id: `anonymous_inline_${semanticToken}`,
    description: { text: 'Produce anonymous inline records', capabilities: [`${semanticToken}.read`] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'records',
      shape,
      mediaType,
      recordPath: '$.records',
      fields,
    }),
    execute: () => ({ records: [{ id: inlineId }] }),
  })
  const inline = await inlineSibling.execute({}, {}, {
    id: `inline-valid-${semanticToken}`,
    toolName: inlineSibling.id,
  }) as any
  assert.equal(inline.__clientToolOutputs.output0.records[0].id, 'valid-inline')
  inlineId = 42
  await assert.rejects(
    inlineSibling.execute({}, {}, {
      id: `inline-invalid-${semanticToken}`,
      toolName: inlineSibling.id,
    }),
    (error: any) => error?.code === 'CLIENT_TOOL_OUTPUT_SELECTION_FAILED',
  )
  inlineId = 'valid-sibling'
  const recovered = await inlineSibling.execute({}, {}, {
    id: `inline-sibling-${semanticToken}`,
    toolName: inlineSibling.id,
  }) as any
  assert.equal(recovered.__clientToolOutputs.output0.records[0].id, 'valid-sibling')

  const untypedCarrierSibling = defineClientTool<Record<string, unknown>, Record<string, unknown>, any>({
    id: `anonymous_untyped_carrier_${semanticToken}`,
    description: { text: 'Produce an untyped carrier sibling', capabilities: [`${semanticToken}.read`] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'records', shape, mediaType }),
    execute: () => createAiClientToolArtifact({
      content: JSON.stringify({ records: [{ id: 'runtime-owned-path' }] }),
      mimeType: mediaType,
      bindingName: 'records',
      outputShape: shape,
      recordPath: '$.records',
      preview: { count: 1 },
    }),
  })
  const untyped = await untypedCarrierSibling.execute({}, {}, {
    id: `untyped-sibling-${semanticToken}`,
    toolName: untypedCarrierSibling.id,
  }) as any
  assert.equal(untyped.data.recordPath, '$.records')
})

test('artifact auto delivery applies audience and requiredness without changing canonical source semantics', async () => {
  const mediaType = 'application/vnd.example.audience-records+json'
  const shape = 'anonymous.audience-records'
  const artifact = createAiClientToolArtifact({
    content: JSON.stringify({ records: [{ id: 'complete-source' }] }),
    modelSafeInline: { records: [{ id: 'bounded-model-sample' }] },
    mimeType: mediaType,
    bindingName: 'records',
    outputShape: shape,
    recordPath: '$.records',
    cardinality: { kind: 'record-set', recordCount: 1, returnedCount: 1, totalCount: 1 },
    preview: { count: 1 },
  })
  let uploads = 0
  const modelEvidence = await deliverAiClientToolResult({ data: artifact }, {
    call: {
      id: 'model-evidence',
      toolName: 'anonymous_audience_producer',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => {
          uploads += 1
          return { ok: true, path }
        },
      },
    },
    outputs: [{
      name: 'records', type: 'structured-data', shape, mediaType,
      audience: 'model-evidence', delivery: 'inline',
    }],
  }) as any
  assert.equal(uploads, 0)
  assert.equal(modelEvidence.summary.delivery, 'inline')
  assert.equal(modelEvidence.complete, true)
  assert.deepEqual(modelEvidence.data.presentationSource, {
    records: [{ id: 'bounded-model-sample' }],
  })
  assert.equal(modelEvidence.outputBindings, undefined)

  const reusableWithoutExactRef = await deliverAiClientToolResult({ data: artifact }, {
    call: { id: 'reusable-source', toolName: 'anonymous_audience_producer' },
    outputs: [{
      name: 'records', type: 'structured-data', shape, mediaType,
      audience: 'reusable-source', delivery: 'auto',
    }],
  }) as any
  assert.equal(reusableWithoutExactRef.summary.delivery, 'bounded-preview')
  assert.equal(reusableWithoutExactRef.complete, false)
  assert.equal(reusableWithoutExactRef.truncated, false)
  assert.equal(reusableWithoutExactRef.evidence.displayTruncated, false)
  assert.equal(reusableWithoutExactRef.outputBindings, undefined)
  assert.equal(reusableWithoutExactRef.data.presentationSource, undefined)

  const optionalPresentation = await deliverAiClientToolResult({ data: artifact }, {
    call: {
      id: 'optional-presentation',
      toolName: 'anonymous_audience_producer',
      presentationCapabilities: [{
        type: 'anonymous-optional-view',
        contentType: 'json',
        mediaType,
        supportsSessionFile: false,
        maxInlineBytes: 1,
        defaultMode: 'preview',
        purpose: 'conversation-preview',
        preferredInputShapes: [shape],
        deliveryPolicy: 'optional',
      }],
    },
    outputs: [{
      name: 'records', type: 'structured-data', shape, mediaType,
      audience: 'client-presentation', delivery: 'auto',
    }],
  }) as any
  assert.equal(optionalPresentation.summary.delivery, 'bounded-preview')
  assert.equal(optionalPresentation.complete, true)
  assert.equal(optionalPresentation.outputBindings, undefined)
})

test('JSON artifacts publish only bounded logical record paths', async () => {
  const result = await deliverAiClientToolResult({
    data: createAiClientToolArtifact({
      executionId: 'records',
      content: JSON.stringify({ results: [{ id: 'one' }] }),
      mimeType: 'application/json',
      bindingName: 'records',
      outputShape: 'generic.result-set',
      recordPath: '$.results',
      cardinality: {
        kind: 'record-set',
        recordCount: 1,
        returnedCount: 1,
        totalCount: 1,
      },
      preview: { resultCount: 1 },
    }),
  }, {
    call: {
      id: 'records',
      toolName: 'generic_json_producer',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'file',
  }) as any

  assert.equal(result.data.recordPath, '$.results')
  assert.equal(result.outputBindings[0].recordPath, '$.results')
  assert.equal(createAiClientToolArtifact({
    content: '{}', mimeType: 'application/json', preview: {}, recordPath: '$.*',
  }).recordPath, undefined)
  assert.equal(createAiClientToolArtifact({
    content: '{}', mimeType: 'application/json', preview: {}, recordPath: '$.result-items',
  }).recordPath, undefined)
  assert.equal(createAiClientToolArtifact({
    content: '{}',
    mimeType: 'application/json',
    preview: {},
    recordPath: "$.results[?(@.type=='person')]",
  }).recordPath, undefined)
  assert.equal(createAiClientToolArtifact({
    content: '{}',
    mimeType: 'application/json',
    preview: {},
    recordPath: `$.${'segment.'.repeat(260)}records`,
  }).recordPath, undefined)
  assert.equal(createAiClientToolArtifact({
    content: '{}', mimeType: 'application/json', preview: {},
  }).recordPath, undefined)

  const inline = await deliverAiClientToolResult({
    data: createAiClientToolArtifact({
      content: JSON.stringify({ results: [{ id: 'inline' }] }),
      modelSafeInline: { results: [{ id: 'inline' }] },
      mimeType: 'application/json',
      bindingName: 'records',
      outputShape: 'generic.result-set',
      recordPath: '$.results',
      preview: {},
    }),
  }, {
    call: { id: 'inline-records', toolName: 'generic_json_producer' },
    resultDelivery: 'auto',
  }) as any
  assert.equal(inline.outputBindings[0].path, '$.data.presentationSource')
  assert.equal(inline.outputBindings[0].recordPath, '$.results')

  const mutated = createAiClientToolArtifact({
    content: JSON.stringify({ results: [] }),
    modelSafeInline: { results: [] },
    mimeType: 'application/json',
    preview: {},
  }) as any
  mutated.recordPath = '$.*'
  const sanitized = await deliverAiClientToolResult({ data: mutated }, {
    call: { id: 'mutated-records', toolName: 'generic_json_producer' },
    resultDelivery: 'auto',
  }) as any
  assert.equal(sanitized.data.recordPath, undefined)
  assert.equal(sanitized.outputBindings[0].recordPath, undefined)
})

test('session serialization sends canonical effect but keeps browser-only contract and bindings local', () => {
  const sessionDefinition = toAiClientToolSessionDefinition({
    id: 'series_read',
    description: 'read a bounded series',
    inputs: [],
    output: { type: 'object' },
    ...createSeriesContract(),
    _meta: {
      clientToolDefinition: {
        version: 'client-tool-definition/v1',
        effect: 'READ',
        outputCount: 1,
      },
    },
  })
  const serialized = JSON.stringify(sessionDefinition)
  assert.equal(serialized.includes('clientToolContract'), false)
  assert.equal(serialized.includes('resultBindings'), false)
  assert.equal(serialized.includes('x-ai-routing'), true)
  assert.equal((sessionDefinition as any).expands.effect, 'READ')
})

test('analytical capability survives canonical routing normalization and session serialization', () => {
  const analyticalCapability = {
    version: 'analytical-capability/v1',
    capabilityId: 'station.passenger.rank',
    semanticKey: 'line-crossing-events-by-station',
    subjects: ['station'],
    measures: [{
      name: 'passenger_total',
      aggregations: ['sum'],
      units: ['crossing-event'],
    }],
    dimensions: ['area'],
    filters: ['direction'],
    grains: ['day'],
    criteria: ['top_n'],
    ordering: [{ axis: 'rank', direction: 'asc', producerGuaranteed: true }],
    completeness: { complete: false, partial: true, continuation: false },
    output: { shape: 'tabular.records' },
    transformCost: 0,
  }
  const definition = toAiClientToolSessionDefinition({
    id: 'station_passenger_rank',
    description: 'rank station passenger totals',
    routing: {
      ...createSeriesContract().routing,
      analyticalCapability,
    } as any,
  }) as any

  assert.deepEqual(definition.expands['x-ai-routing'].analyticalCapability, analyticalCapability)

  const reordered = toAiClientToolSessionDefinition({
    id: 'station_passenger_rank_reordered',
    description: 'rank station passenger totals',
    routing: {
      analyticalCapability: {
        transformCost: 0,
        output: { shape: 'tabular.records' },
        completeness: { continuation: false, partial: true, complete: false },
        ordering: [{ producerGuaranteed: true, direction: 'asc', axis: 'rank' }],
        criteria: ['top_n'],
        grains: ['day'],
        filters: ['direction'],
        dimensions: ['area'],
        measures: [{ units: ['crossing-event'], aggregations: ['sum'], name: 'passenger_total' }],
        subjects: ['station'],
        semanticKey: 'line-crossing-events-by-station',
        capabilityId: 'station.passenger.rank',
        version: 'analytical-capability/v1',
      },
      ...createSeriesContract().routing,
    } as any,
  }) as any
  assert.deepEqual(
    reordered.expands['x-ai-routing'].analyticalCapability,
    definition.expands['x-ai-routing'].analyticalCapability,
  )
  assert.equal(definition.expands['x-ai-routing'].analyticalCapability.argumentBindings, undefined)
  assert.equal(definition.expands['x-ai-routing'].analyticalCapability.completeness.boundedBy, undefined)
})

test('typed analytical argument bindings preserve one owner and fail closed per malformed sibling', () => {
  const routing = createSeriesContract().routing
  const analyticalCapability = {
    version: 'analytical-capability/v1',
    capabilityId: 'anonymous.records.rank',
    semanticKey: 'anonymous.records',
    subjects: ['entity'],
    measures: [{ name: 'score', aggregations: ['sum'], units: ['record'] }],
    dimensions: ['group', 'category'],
    filters: [],
    grains: [],
    criteria: ['top_n'],
    ordering: [{ axis: 'score', direction: 'desc', producerGuaranteed: true }],
    completeness: {
      complete: true,
      partial: true,
      continuation: false,
      boundedBy: {
        criterion: 'requested-record-window',
        limitArgument: 'windowSize',
        completeRequired: true,
      },
    },
    argumentBindings: [{ semantic: 'dimension', argument: 'groupAxis' }],
    output: { shape: 'anonymous.records' },
    transformCost: 0,
  }
  const inputs = [
    { id: 'windowSize', valueType: { type: 'integer', min: 1, max: 20 } },
    { id: 'groupAxis', valueType: anonymousEnumValueType(['group', 'category']) },
  ]
  const definition = toAiClientToolSessionDefinition({
    id: 'anonymous_bounded_records',
    description: 'Return an explicitly bounded record window',
    inputs,
    routing: { ...routing, analyticalCapability } as any,
  }) as any
  assert.deepEqual(
    definition.expands['x-ai-routing'].analyticalCapability,
    analyticalCapability,
  )
  assert.equal((JSON.stringify(definition).match(/"x-ai-routing"/g) || []).length, 1)

  const malformedCapabilities = [
    {
      ...analyticalCapability,
      argumentBindings: [{ argument: 'groupAxis' }],
    },
    {
      ...analyticalCapability,
      argumentBindings: [
        { semantic: 'dimension', argument: 'groupAxis' },
        { semantic: 'dimension', argument: 'groupAxis' },
      ],
    },
    {
      ...analyticalCapability,
      argumentBindings: [{ semantic: 'measure', argument: 'groupAxis' }],
    },
    {
      ...analyticalCapability,
      argumentBindings: [{ semantic: 'dimension', argument: 'siblingAxis' }],
    },
    {
      ...analyticalCapability,
      completeness: {
        ...analyticalCapability.completeness,
        boundedBy: { criterion: 'requested-record-window', completeRequired: true },
      },
    },
  ]
  for (const [index, malformedCapability] of malformedCapabilities.entries()) {
    const [malformed, sibling] = toAiClientToolSessionDefinitions([{
      id: `anonymous_malformed_binding_${index}`,
      description: 'Malformed analytical argument binding',
      inputs,
      routing: { ...routing, analyticalCapability: malformedCapability } as any,
    }, {
      id: `anonymous_valid_sibling_${index}`,
      description: 'Independent valid sibling',
      inputs: [{ id: 'siblingAxis', valueType: 'string' }],
      routing,
    }]) as any[]
    assert.equal(malformed.expands?.['x-ai-routing'], undefined)
    assert.deepEqual(sibling.expands['x-ai-routing'], routing)
  }
})

test('filter bindings compile fixed scalar, fixed array and dynamic wire metadata without model leakage', () => {
  type Args = {
    status?: string
    categoryOperator?: string
    categories?: string[]
    labels?: string[]
  }
  const analytical = defineClientToolAnalyticalProducer<Args>({
    producerKey: 'anonymous.filter.records',
    factKey: 'anonymous.filter-records',
    subjects: ['entity'],
    measures: [{ name: 'count', aggregations: ['sum'], units: ['record'] }],
    dimensions: [],
    filters: ['status', 'category', 'label'],
    grains: [],
    criteria: ['records'],
    coverage: 'complete',
    output: 'filter-records',
    filterBindings: [{ axis: 'status', operator: 'eq', valueArgument: 'status' }, {
      axis: 'category', operators: ['eq', 'in'], operatorArgument: 'categoryOperator', valueArgument: 'categories',
    }, {
      axis: 'label', operator: 'contains_all', valueArgument: 'labels',
      valueCardinality: 'one-or-more', encoding: 'string-array',
    }],
  })
  const categoryInput = {
    id: 'categories',
    valueType: {
      type: 'array', elementType: { type: 'string' },
      expands: { maxItems: 4, uniqueItems: true },
    },
    expands: { validators: [{ type: 'Custom', mode: 'retain' }], retained: true },
  } as ClientToolInput
  const labelInput = {
    id: 'labels',
    valueType: {
      type: 'array', elementType: anonymousEnumValueType(['priority', 'reviewed']),
      expands: { maxItems: 2, uniqueItems: true },
    },
  } as ClientToolInput
  const tool = defineClientTool<Args, Record<string, unknown>, unknown[]>({
    id: 'anonymous_filter_records',
    description: { text: 'Return records for declared filters', capabilities: ['generic.records'] },
    inputs: [{ id: 'status', valueType: anonymousEnumValueType(['open', 'closed']) }, {
      id: 'categoryOperator', valueType: anonymousEnumValueType(['eq', 'in']),
    }, categoryInput, labelInput],
    analytical,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'filter-records', shape: 'anonymous.filter-records' }),
    execute: () => [],
  })
  const session = toAiClientToolSessionDefinition(tool) as any
  const capability = session.expands['x-ai-routing'].analyticalCapability
  assert.deepEqual(capability.argumentBindings, [{
    semantic: 'filter', axis: 'status', operator: 'eq', valueArgument: 'status',
    valueCardinality: 'exactly-one', encoding: 'scalar',
  }, {
    semantic: 'filter', axis: 'category', operators: ['eq', 'in'], operatorArgument: 'categoryOperator',
    valueArgument: 'categories', valueCardinality: 'one-or-more', encoding: 'string-array',
  }, {
    semantic: 'filter', axis: 'label', operator: 'contains_all', valueArgument: 'labels',
    valueCardinality: 'one-or-more', encoding: 'string-array',
  }])
  assert.equal(capability.filterBindings, undefined)
  assert.equal(session.expands._schema.type, 'object')
  assert.equal(session.expands._schema.required, undefined)
  const sessionInputs = Object.fromEntries(session.inputs.map((input: any) => [input.id, input]))
  assert.deepEqual(sessionInputs.categories.valueType.expands, { maxItems: 4, uniqueItems: true })
  assert.deepEqual(sessionInputs.categories.expands, {
    validators: [{ type: 'Custom', mode: 'retain' }, { type: 'Size', min: 1 }],
    retained: true,
  })
  assert.deepEqual(sessionInputs.labels.valueType.expands, { maxItems: 2, uniqueItems: true })
  assert.deepEqual(sessionInputs.labels.expands.validators, [{ type: 'Size', min: 1 }])
  assert.equal(sessionInputs.categories.expands.required, undefined)
  assert.equal(sessionInputs.labels.expands.required, undefined)
  assert.equal(sessionInputs.status.expands, undefined)
  assert.equal(sessionInputs.categoryOperator.expands, undefined)

  const prebounded = toAiClientToolSessionDefinition({
    ...tool,
    inputs: tool.inputs!.map((input: any) => input.id === 'labels'
      ? { ...input, expands: { validators: [{ type: 'Size', min: 2, max: 2 }, { type: 'Custom' }] } }
      : input),
  }) as any
  const preboundedLabels = prebounded.inputs.find((input: any) => input.id === 'labels')
  assert.deepEqual(preboundedLabels.expands.validators, [
    { type: 'Size', min: 2, max: 2 },
    { type: 'Custom' },
  ])
  assert.equal(preboundedLabels.expands.required, undefined)
  assert.equal(JSON.stringify(session.inputs).includes('filterBindings'), false)
  assert.equal(session.description.includes('filterBindings'), false)
  assert.deepEqual(
    toAiClientToolSessionDefinition({ ...tool, routing: { ...tool.routing } } as any),
    session,
  )
})

test('unbound filter authoring drops only analytical authority and keeps the direct tool', () => {
  const tool = defineClientTool({
    id: 'anonymous_unbound_filter',
    description: { text: 'Read records directly', capabilities: ['generic.records'] },
    inputs: [{ id: 'status', valueType: 'string' }],
    analytical: defineClientToolAnalyticalProducer({
      producerKey: 'anonymous.unbound-filter',
      factKey: 'anonymous.unbound-filter-records',
      subjects: ['entity'],
      measures: [],
      dimensions: [],
      filters: ['status'],
      grains: [],
      criteria: ['records'],
      ordering: [],
      coverage: 'complete',
      output: 'unbound-filter-records',
    }),
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'unbound-filter-records',
      shape: 'anonymous.unbound-filter-records',
    }),
    execute: () => clientToolResult.success([]),
  }) as any

  assert.equal(tool.id, 'anonymous_unbound_filter')
  assert.equal(tool.routing.analyticalCapability, undefined)
  const session = toAiClientToolSessionDefinition(tool) as any
  assert.equal(session.expands['x-ai-routing'].analyticalCapability, undefined)
  assert.equal(session.expands.effect, 'READ')
})

test('filter binding schema proof rejects coercion, duplicate pairs and target collisions per tool', () => {
  const routing = createSeriesContract().routing
  const capability = {
    version: 'analytical-capability/v1', capabilityId: 'anonymous.filter.validation', semanticKey: 'anonymous.filters',
    subjects: ['entity'], measures: [{ name: 'count', aggregations: ['sum'], units: ['record'] }],
    dimensions: [], filters: ['status', 'category'], grains: [], criteria: ['records'], ordering: [],
    completeness: { complete: true, partial: false, continuation: false }, output: { shape: 'anonymous.filter-records' },
    transformCost: 0,
  }
  const inputs = [{ id: 'status', valueType: 'string' }, {
    id: 'operator', valueType: anonymousEnumValueType(['eq', 'in']),
  }, {
    id: 'categories', valueType: { type: 'array', elementType: { type: 'string' } },
  }]
  const valid = {
    ...capability,
    argumentBindings: [{
      semantic: 'filter', axis: 'category', operators: ['eq', 'in'], operatorArgument: 'operator',
      valueArgument: 'categories', valueCardinality: 'one-or-more', encoding: 'string-array',
    }],
  }
  const schema = { type: 'object' as const }
  const definition = toAiClientToolSessionDefinition({
    id: 'anonymous_filter_validation', description: 'Validate exact filter schemas', inputs, parameterSchema: schema,
    routing: { ...routing, analyticalCapability: valid } as any,
  }) as any
  assert.deepEqual(definition.expands['x-ai-routing'].analyticalCapability.argumentBindings, valid.argumentBindings)
  assert.equal(definition.expands['x-ai-routing'].analyticalCapability.filterBindings, undefined)

  const malformed = [
    { ...valid, argumentBindings: [{ ...valid.argumentBindings[0], axis: 'unknown' }] },
    { ...valid, argumentBindings: [{ ...valid.argumentBindings[0], operators: ['eq', 'EQ'] }] },
    { ...valid, argumentBindings: [{ ...valid.argumentBindings[0], operators: ['eq', ' eq'] }] },
    { ...valid, argumentBindings: [{ ...valid.argumentBindings[0], valueCardinality: ' one-or-more' }] },
    { ...valid, argumentBindings: [{ ...valid.argumentBindings[0], encoding: ' STRING-array' }] },
    { ...valid, argumentBindings: [{
      semantic: 'filter', axis: 'status', operator: 'eq', valueArgument: 'status',
      valueCardinality: 'one-or-more', encoding: 'scalar',
    }] },
    { ...valid, argumentBindings: [{
      semantic: 'filter', axis: 'status', operator: 'eq', valueArgument: 'status',
      valueCardinality: 'exactly-one', encoding: 'string-array',
    }] },
    { ...valid, argumentBindings: [{
      semantic: 'filter', axis: 'status', operator: 'contains_all', valueArgument: 'status',
      valueCardinality: 'one-or-more', encoding: 'string-array',
    }] },
    { ...valid, argumentBindings: [{ ...valid.argumentBindings[0], operatorArgument: 'categories' }] },
    { ...valid, argumentBindings: [{
      semantic: 'filter', axis: 'status', operator: 'eq', valueArgument: 'status',
      valueCardinality: 'exactly-one', encoding: 'scalar',
    }, {
      semantic: 'filter', axis: 'status', operator: 'eq', valueArgument: 'categories',
      valueCardinality: 'exactly-one', encoding: 'scalar',
    }] },
  ]
  const malformedInputs = [
    inputs.map(input => input.id === 'categories'
      ? { ...input, valueType: { type: ' ARRAY ', elementType: { type: 'string' } } }
      : input),
    inputs.map(input => input.id === 'categories'
      ? { ...input, valueType: { type: 'array', elementType: 'string' } }
      : input),
    inputs.map(input => input.id === 'categories'
      ? { ...input, valueType: { type: 'array', elementType: { type: ' STRING ' } } }
      : input),
    inputs.map(input => input.id === 'categories'
      ? { ...input, valueType: { type: 'array', minItems: 1, items: { type: 'string' } } }
      : input),
    inputs.map(input => input.id === 'categories'
      ? { ...input, valueType: { type: 'array', elementType: { type: 'enum', elements: [{ value: 'a' }] } } }
      : input),
    inputs.map(input => input.id === 'operator'
      ? { ...input, valueType: anonymousEnumValueType(['eq', ' EQ']) }
      : input),
  ]
  for (const [index, malformedCapability] of malformed.entries()) {
    const [rejected, sibling] = toAiClientToolSessionDefinitions([{
      id: `anonymous_filter_malformed_${index}`, description: 'Malformed filter binding', inputs,
      parameterSchema: schema, routing: { ...routing, analyticalCapability: malformedCapability } as any,
    }, {
      id: `anonymous_filter_sibling_${index}`, description: 'Independent direct tool',
      inputs: [{ id: 'plain', valueType: 'string' }], routing,
    }]) as any[]
    assert.equal(rejected.expands?.['x-ai-routing'], undefined)
    assert.deepEqual(sibling.expands['x-ai-routing'], routing)
  }
  for (const [index, invalidInputs] of malformedInputs.entries()) {
    const rejected = toAiClientToolSessionDefinition({
      id: `anonymous_filter_schema_${index}`, description: 'Malformed filter schema', inputs: invalidInputs,
      parameterSchema: schema, routing: { ...routing, analyticalCapability: valid } as any,
    }) as any
    assert.equal(rejected.expands?.['x-ai-routing'], undefined)
  }
  const rejectedRoot = toAiClientToolSessionDefinition({
    id: 'anonymous_filter_root_space', description: 'Malformed root schema', inputs,
    parameterSchema: { type: ' OBJECT ' } as any, routing: { ...routing, analyticalCapability: valid } as any,
  }) as any
  assert.equal(rejectedRoot.expands?.['x-ai-routing'], undefined)
  const rejectedSplitWire = toAiClientToolSessionDefinition({
    id: 'anonymous_filter_split_wire', description: 'Unsupported split filter wire', inputs,
    parameterSchema: schema,
    routing: { ...routing, analyticalCapability: { ...capability, filterBindings: valid.argumentBindings } } as any,
  }) as any
  assert.equal(rejectedSplitWire.expands?.['x-ai-routing'], undefined)
})

test('temporal wire normalization validates the typed custom branch and isolates malformed siblings', () => {
  const routing = createSeriesContract().routing
  const time = anonymousTemporalContract()
  const parameterSchema = {
    type: 'object' as const,
    oneOf: time.inputAlternatives.map((alternative) => ({
      required: [...alternative.required],
      properties: Object.fromEntries(alternative.required.map((argument) => [argument,
        alternative.when?.input === argument
          ? ('equals' in alternative.when
              ? { const: alternative.when.equals }
              : { enum: [...alternative.when.oneOf] })
          : {},
      ])),
      ...(alternative.forbidden?.length ? {
        not: { anyOf: alternative.forbidden.map(argument => ({ required: [argument] })) },
      } : {}),
    })),
  }
  const temporalBinding = {
    semantic: 'temporal',
    rangeArgument: 'windowMode',
    startArgument: 'openedAt',
    endArgument: 'closedAt',
    customValue: 'bounded',
    encoding: 'date-time',
  }
  const analyticalCapability = {
    version: 'analytical-capability/v1',
    capabilityId: 'anonymous.temporal.records',
    semanticKey: 'anonymous.records',
    subjects: ['entity'],
    measures: [],
    dimensions: [],
    filters: [],
    grains: [],
    criteria: ['lookup'],
    ordering: [],
    completeness: { complete: true, partial: false, continuation: false },
    argumentBindings: [temporalBinding],
    output: { shape: 'anonymous.records' },
    transformCost: 0,
  }
  const valid = toAiClientToolSessionDefinition({
    id: 'anonymous_temporal_wire',
    description: 'Return records for one absolute range',
    inputs: time.inputs as Array<Record<string, unknown>>,
    parameterSchema,
    routing: { ...routing, analyticalCapability } as any,
  }) as any
  assert.deepEqual(
    valid.expands['x-ai-routing'].analyticalCapability.argumentBindings,
    [temporalBinding],
  )
  assert.equal(valid.expands._schema.oneOf[1].properties.windowMode.const, 'bounded')

  const malformedSources = [{
    capability: { ...analyticalCapability, argumentBindings: [temporalBinding, temporalBinding] },
  }, {
    capability: { ...analyticalCapability, argumentBindings: [{ ...temporalBinding, semantic: 'scope' }] },
  }, {
    capability: { ...analyticalCapability, argumentBindings: [{ ...temporalBinding, endArgument: 'missingAt' }] },
  }, {
    capability: { ...analyticalCapability, argumentBindings: [{ ...temporalBinding, encoding: 'epoch-millis' }] },
  }, {
    capability: analyticalCapability,
    schema: {
      ...parameterSchema,
      oneOf: parameterSchema.oneOf.map((branch, index) => index === 1
        ? {
            ...branch,
            properties: { ...branch.properties, windowMode: { const: 'foreign' } },
          }
        : branch),
    },
  }, {
    capability: {
      ...analyticalCapability,
      argumentBindings: [
        { semantic: 'dimension', argument: 'windowMode' },
        temporalBinding,
      ],
    },
  }]
  for (const [index, item] of malformedSources.entries()) {
    const [malformed, sibling] = toAiClientToolSessionDefinitions([{
      id: `anonymous_temporal_malformed_${index}`,
      description: 'Malformed temporal binding',
      inputs: time.inputs as Array<Record<string, unknown>>,
      parameterSchema: item.schema || parameterSchema,
      routing: { ...routing, analyticalCapability: item.capability } as any,
    }, {
      id: `anonymous_temporal_sibling_${index}`,
      description: 'Independent valid sibling',
      routing,
    }]) as any[]
    assert.equal(malformed.expands?.['x-ai-routing'], undefined)
    assert.deepEqual(sibling.expands['x-ai-routing'], routing)
  }
})

test('scope wire normalization rejects provenance, branch and semantic ambiguity per sibling', () => {
  const scope = anonymousScopeContract()
  const analytical = defineClientToolAnalyticalProducer<Record<string, unknown>>({
    producerKey: 'anonymous.scope.normalization',
    factKey: 'anonymous.scope-facts',
    subjects: ['entity'],
    measures: [],
    dimensions: [],
    filters: [],
    grains: [],
    criteria: ['lookup'],
    ordering: [],
    coverage: 'complete',
    output: 'scope-records',
  })
  const compiled = defineClientTool({
    id: 'anonymous_scope_normalization',
    description: { text: 'Normalize one scope wire', capabilities: ['generic.scope'] },
    inputs: scope.inputs,
    inputAlternatives: scope.inputAlternatives,
    consumes: scope.consumes,
    analytical,
    scope: scope.scope,
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({ name: 'scope-records', shape: 'anonymous.scope-normalization', recordPath: '$' }),
    execute: () => clientToolResult.success([]),
  }) as any
  const capability = compiled.routing.analyticalCapability as Record<string, any>
  const scopeBinding = capability.argumentBindings[0] as Record<string, any>
  const valid = toAiClientToolSessionDefinition(compiled) as any
  assert.deepEqual(valid.expands['x-ai-routing'].analyticalCapability.argumentBindings, [scopeBinding])
  assert.equal(validateAiClientToolRoutingMetadata(valid).status, 'valid')

  const malformedSources = [{
    routing: { ...compiled.routing, consumerPorts: [compiled.routing.consumerPorts[0]] },
  }, {
    capability: {
      ...capability,
      argumentBindings: [{
        ...scopeBinding,
        coordinates: scopeBinding.coordinates.map((coordinate: Record<string, unknown>) => (
          coordinate.type === 'area' ? { ...coordinate, sourcePort: 'missing-coordinate' } : coordinate
        )),
      }],
    },
  }, {
    capability: {
      ...capability,
      argumentBindings: [{ ...scopeBinding, valueCardinality: 'zero-or-one' }],
    },
  }, {
    capability: {
      ...capability,
      argumentBindings: [{
        ...scopeBinding,
        coordinates: [scopeBinding.coordinates[0], scopeBinding.coordinates[1], scopeBinding.coordinates[1]],
      }],
    },
  }, {
    capability: {
      ...capability,
      argumentBindings: [scopeBinding, { semantic: 'dimension', argument: 'scopeAlpha' }],
    },
  }, {
    schema: {
      ...compiled.parameterSchema,
      oneOf: compiled.parameterSchema.oneOf.filter((branch: Record<string, any>) => (
        !branch.required.includes('scopeBeta')
      )),
    },
  }, {
    routing: {
      ...compiled.routing,
      consumerPorts: [...compiled.routing.consumerPorts, compiled.routing.consumerPorts[0]],
    },
  }]
  const siblingRouting = createSeriesContract().routing
  for (const [index, item] of malformedSources.entries()) {
    const routing = item.routing || {
      ...compiled.routing,
      analyticalCapability: item.capability || capability,
    }
    const [malformed, sibling] = toAiClientToolSessionDefinitions([{
      id: `anonymous_scope_malformed_${index}`,
      description: 'Malformed scope binding',
      inputs: compiled.inputs,
      parameterSchema: item.schema || compiled.parameterSchema,
      routing,
    }, {
      id: `anonymous_scope_independent_${index}`,
      description: 'Independent valid sibling',
      routing: siblingRouting,
    }]) as any[]
    assert.equal(malformed.expands?.['x-ai-routing'], undefined)
    assert.deepEqual(sibling.expands['x-ai-routing'], siblingRouting)
  }
})

test('malformed analytical capability fails closed for one tool without suppressing its sibling', () => {
  const routing = createSeriesContract().routing
  const [malformed, sibling] = toAiClientToolSessionDefinitions([{
    id: 'malformed_analytical_tool',
    description: 'malformed analytical tool',
    routing: {
      ...routing,
      analyticalCapability: {
        version: 'analytical-capability/v1',
        capabilityId: 'station.passenger.rank',
        semanticKey: 'line-crossing-events-by-station',
        subjects: ['station'],
        measures: [{ name: 'passenger_total', aggregations: [], units: ['crossing-event'] }],
        dimensions: [], filters: [], grains: [], criteria: [], ordering: [],
        completeness: { complete: true, partial: false, continuation: false },
        output: { shape: 'tabular.records' },
        transformCost: 0,
      },
    } as any,
  }, {
    id: 'plain_sibling',
    description: 'plain sibling',
    routing,
  }]) as any[]

  assert.equal(malformed.id, 'malformed_analytical_tool')
  assert.equal(malformed.expands?.['x-ai-routing'], undefined)
  assert.deepEqual(sibling.expands['x-ai-routing'], routing)
  const validation = validateAiClientToolRoutingMetadata({
    id: 'malformed_analytical_tool',
    routing: {
      ...routing,
      analyticalCapability: {
        version: 'analytical-capability/v1',
        capabilityId: 'station.passenger.rank',
        semanticKey: 'line-crossing-events-by-station',
        subjects: ['station'],
        measures: [{ name: 'passenger_total', aggregations: [], units: ['crossing-event'] }],
        dimensions: [], filters: [], grains: [], criteria: [], ordering: [],
        completeness: { complete: true, partial: false, continuation: false },
        output: { shape: 'tabular.records' },
        transformCost: 0,
      },
    } as any,
  })
  assert.equal(validation.status, 'malformed')
  assert.ok(validation.issues.some(issue => issue.code === 'analytical_capability_malformed'))
})

test('typed compiler projects every canonical effect to the WebSocket session definition', () => {
  const definitions = (['READ', 'WRITE', 'EXTERNAL_ACTION'] as const).map((kind) => defineClientTool({
    id: `effect_${kind.toLowerCase()}`,
    description: { text: `Execute ${kind}`, capabilities: [`test.effect.${kind.toLowerCase()}`] },
    inputs: [],
    effect: kind === 'READ'
      ? { kind }
      : { kind, idempotency: 'IDEMPOTENT', reversible: true, confirmation: false },
    output: clientToolOutput.detail({ name: 'result', shape: 'test.result' }),
    execute: () => clientToolResult.success({ ok: true }),
  }))

  assert.deepEqual(
    definitions.map(tool => (toAiClientToolSessionDefinition(tool) as any).expands.effect),
    ['READ', 'WRITE', 'EXTERNAL_ACTION'],
  )
})

test('session serialization preserves explicit metadata and relocates required input flags', () => {
  const definition = toAiClientToolSessionDefinition({
    id: 'required_input_tool',
    description: 'read one resource',
    inputs: [
      { id: 'resourceId', name: 'resourceId', required: true, expands: { source: 'page' } },
      { id: 'optional', name: 'optional', required: false },
    ],
    output: { type: 'object' },
    annotations: { readOnlyHint: true },
    expands: { custom: 'retained' },
    routing: createSeriesContract().routing,
  }) as any
  assert.equal(definition.inputs[0].expands.required, true)
  assert.equal(definition.inputs[0].expands.source, 'page')
  assert.equal(definition.inputs[1].expands, undefined)
  assert.equal(definition.expands.custom, 'retained')
})

test('typed parameter schema is serialized through the canonical session expand', () => {
  const parameterSchema = {
    type: 'object' as const,
    oneOf: [{
      required: ['timeRange'],
      properties: { timeRange: { enum: ['today', '24h', '7d', '30d'] } },
    }, {
      required: ['timeRange', 'startTime', 'endTime'],
      properties: {
        timeRange: { const: 'custom' },
        startTime: { type: 'string' },
        endTime: { type: 'string' },
      },
    }],
  }
  const expands = mergeAiClientToolParameterSchema('history_read', parameterSchema, {
    custom: 'retained',
  }) as any
  assert.equal(expands._schema.type, 'object')
  assert.equal(expands._schema.oneOf.length, 2)
  assert.deepEqual(expands._schema.oneOf[0].properties.timeRange.enum, [
    'today', '24h', '7d', '30d',
  ])
  assert.deepEqual(expands._schema.oneOf[1].required, [
    'timeRange', 'startTime', 'endTime',
  ])
  assert.deepEqual(Object.keys(expands._schema.oneOf[1].properties), [
    'timeRange', 'startTime', 'endTime',
  ])
  assert.equal(expands.custom, 'retained')
  assert.deepEqual(mergeAiClientToolParameterSchema('empty'), {})
  assert.deepEqual(mergeAiClientToolParameterSchema('explicit_only', undefined, {
    custom: 'retained',
  }), { custom: 'retained' })
  assert.throws(
    () => mergeAiClientToolParameterSchema(
      'conflicting_schema',
      { type: 'object' },
      { _schema: { type: 'object' } },
    ),
    /declares parameterSchema and expands\._schema/,
  )
})

test('routing diagnostics cover conflicting sources and incomplete data contracts', () => {
  const incomplete = validateAiClientToolRoutingMetadata({
    id: 'incomplete_data_tool',
    routing: {
      aliases: ['same'],
      capabilities: ['test.records.read'],
      intents: ['inspect'],
      notFor: ['inspect'],
      stages: ['execution'],
      dataAccessModes: ['records'],
      produces: ['records'],
      evidencePolicy: 'required',
    },
  })
  assert.equal(incomplete.status, 'malformed')
  assert.ok(incomplete.issues.some(issue => issue.field === 'resultDeliveries'))
  assert.ok(incomplete.issues.some(issue => issue.field === 'outputShapes'))
  assert.ok(incomplete.issues.some(issue => issue.field === 'validationHints'))
  assert.ok(incomplete.issues.some(issue => issue.code === 'conflicting_signals'))

  const declared = createSeriesContract().routing
  const conflicting = validateAiClientToolRoutingMetadata({
    id: 'conflicting_sources',
    routing: declared,
    expands: {
      'x-ai-routing': {
        ...declared,
        capabilities: ['test.other.read'],
        help: {
          quickstartSection: 'quickstart',
          intentSections: [{ intent: 'inspect', section: 'details' }, null],
        },
      },
    },
  })
  assert.equal(conflicting.status, 'malformed')
  assert.ok(conflicting.issues.some(issue => issue.code === 'conflicting_sources'))

  const help = validateAiClientToolRoutingMetadata({
    id: 'help_metadata',
    routing: {
      ...declared,
      help: { intentSections: { inspect: 'details' } },
    },
  })
  assert.deepEqual(help.metadata?.help?.intentSections, { inspect: 'details' })
})

test('result-binding validation reports each structural contract failure independently', () => {
  const noOutput = validateAiClientToolResultBindings({
    id: 'no_output',
    routing: {
      capabilities: ['test.lookup.read'],
      stages: ['execution'],
      resultDeliveries: ['inline'],
      evidencePolicy: 'optional',
    },
    _meta: { resultBindings: [{ name: 'unexpected', path: '$.data', shape: 'lookup' }] },
  })
  assert.ok(noOutput.some(issue => issue.code === 'result_binding_unexpected'))

  const fileAmbiguous = validateAiClientToolResultBindings({
    id: 'file_ambiguous',
    routing: {
      capabilities: ['test.file.create'],
      stages: ['terminal'],
      resultDeliveries: ['file'],
      evidencePolicy: 'required',
      validationHints: ['artifact-exists'],
      produces: ['left', 'right'],
      outputShapes: ['document.pdf'],
    },
  })
  assert.ok(fileAmbiguous.some(issue => issue.code === 'file_binding_ambiguous'))

  const malformedBindings = validateAiClientToolResultBindings({
    id: 'malformed_bindings',
    routing: createSeriesContract().routing,
    _meta: { resultBindings: {} },
  })
  assert.ok(malformedBindings.some(issue => issue.code === 'result_binding_malformed'))

  const missingBindings = validateAiClientToolResultBindings({
    id: 'missing_bindings',
    routing: createSeriesContract().routing,
  })
  assert.ok(missingBindings.some(issue => issue.code === 'result_binding_missing'))

  const mixedBindings = validateAiClientToolResultBindings({
    id: 'mixed_bindings',
    routing: createSeriesContract().routing,
    _meta: {
      resultBindings: [
        null,
        { name: 'other', path: '$.other', shape: 'wrong' },
        { name: 'other', path: '$.other', shape: 'wrong' },
      ],
    },
  })
  const codes = new Set(mixedBindings.map(issue => issue.code))
  assert.ok(codes.has('result_binding_malformed'))
  assert.ok(codes.has('result_binding_name_invalid'))
  assert.ok(codes.has('result_binding_shape_invalid'))
  assert.ok(codes.has('result_binding_missing'))
  assert.ok(codes.has('result_binding_unexpected'))
})

test('explicit native ports survive session serialization without promoting sibling browser data', () => {
  for (const mixed of [false, true]) {
    const contract = defineAiClientToolContract({
      routingKind: 'records',
      routing: { capabilities: ['test.native.read'] },
      outputs: [
        ...(mixed ? [{
          kind: 'record-set' as const, name: 'data', type: 'structured-data' as const,
          mediaType: 'application/json', shape: 'test.records', audience: 'model-evidence' as const,
          path: '$.data.records',
        }, {
          kind: 'record-set' as const, name: 'browser-data', type: 'structured-data' as const,
          mediaType: 'application/json', shape: 'test.browser-records', audience: 'client-presentation' as const,
          path: '$.data.browser',
        }] : []),
        {
          kind: 'record-set', name: 'native', type: 'presentation',
          mediaType: 'application/vnd.example.native+json', shape: 'test.native',
          audience: 'client-presentation', path: '$.data.native', delivery: 'auto',
        },
      ],
    })
    const wire = toAiClientToolSessionDefinition({ id: 'native_port_test', ...contract }) as any
    const routing = wire.expands['x-ai-routing']
    assert.equal(routing.portVersion, 'ai-tool-port/v1')
    assert.deepEqual(routing.produces, mixed ? ['data', 'native'] : ['native'])
    assert.deepEqual(routing.outputShapes, mixed ? ['test.records', 'test.native'] : ['test.native'])
    assert.deepEqual(routing.producerPorts.map((port: any) => [port.name, port.type, port.audience]), mixed
      ? [['data', 'structured-data', 'model-evidence'], ['native', 'presentation', 'client-presentation']]
      : [['native', 'presentation', 'client-presentation']])
    assert.equal(routing.analyticalCapability, undefined)
    assert.deepEqual(validateAiClientToolResultBindings({ id: 'native_port_test', ...contract }), [])
    assert.deepEqual(createAiClientToolCatalogReport([{ id: 'native_port_test', ...contract }]).issues, [])
  }
})

test('portless contracts do not advertise a canonical port version', () => {
  for (const outputs of [[], [{
    kind: 'record-set' as const, name: 'browser-data', type: 'structured-data' as const,
    mediaType: 'application/json', shape: 'test.browser-records', audience: 'client-presentation' as const,
    path: '$.data.browser',
  }]]) {
    const contract = defineAiClientToolContract({
      routingKind: 'records', routing: { capabilities: ['test.portless.read'] }, outputs,
    })
    const wire = toAiClientToolSessionDefinition({ id: 'portless_test', ...contract }) as any
    assert.equal(wire.expands['x-ai-routing'].portVersion, undefined)
    assert.equal(wire.expands['x-ai-routing'].producerPorts, undefined)
    assert.equal(wire.expands['x-ai-routing'].consumerPorts, undefined)
  }
})

test('typed result bindings retain browser presentation delivery outside model routing', () => {
  const contract = defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.mixed-output.read'] },
    outputs: [
      {
        kind: 'record-set', name: 'evidence', type: 'structured-data',
        mediaType: 'application/json', shape: 'test.evidence-records',
        audience: 'model-evidence', path: '$.data.evidence',
      },
      {
        kind: 'record-set', name: 'presentation', type: 'structured-data',
        mediaType: 'application/vnd.example.presentation+json', shape: 'test.presentation-records',
        audience: 'client-presentation', path: '$.data.presentation', recordPath: '$.results', delivery: 'auto',
      },
      {
        kind: 'lookup', name: 'result-id', type: 'structured-data',
        mediaType: 'application/json', shape: 'test.result-id',
        audience: 'reusable-source', path: '$.data.resultId',
      },
    ],
  })
  const tool = { id: 'mixed_outputs', ...contract }
  assert.deepEqual(contract.routing.produces, ['evidence', 'result-id'])
  assert.deepEqual(contract.routing.outputShapes, ['test.evidence-records', 'test.result-id'])
  assert.deepEqual(contract.routing.producerPorts?.map(port => port.name), ['evidence', 'result-id'])
  assert.deepEqual(contract._meta.resultBindings.map(binding => binding.name), [
    'evidence', 'presentation', 'result-id',
  ])
  assert.equal(contract._meta.resultBindings.find(binding => binding.name === 'presentation')?.recordPath, '$.results')
  assert.deepEqual(validateAiClientToolResultBindings(tool), [])
  assert.deepEqual(validateAiClientToolResultBindings({
    ...tool,
    _meta: {
      ...tool._meta,
      resultBindings: [...tool._meta.resultBindings].reverse(),
    },
  }), [])

  const wrongPresentation = validateAiClientToolResultBindings({
    ...tool,
    _meta: {
      ...tool._meta,
      resultBindings: tool._meta.resultBindings.map(binding => binding.name === 'presentation'
        ? { ...binding, shape: 'test.wrong', audience: 'model-evidence' }
        : binding),
    },
  })
  assert.ok(wrongPresentation.some(issue => issue.field.endsWith('.shape')))
  assert.ok(wrongPresentation.some(issue => issue.field.endsWith('.audience')))

  const undeclared = validateAiClientToolResultBindings({
    ...tool,
    _meta: {
      ...tool._meta,
      resultBindings: [...tool._meta.resultBindings, {
        name: 'unknown', path: '$.data.unknown', shape: 'test.unknown',
      }],
    },
  })
  assert.ok(undeclared.some(issue => issue.code === 'result_binding_unexpected'))

  const legacy = validateAiClientToolResultBindings({
    id: 'legacy_port',
    routing: {
      capabilities: ['test.legacy.read'], stages: ['execution'], resultDeliveries: ['inline'],
      evidencePolicy: 'optional', produces: ['records'], outputShapes: ['test.fallback-shape'],
      producerPorts: [{
        name: 'records', type: 'structured-data', mediaType: 'application/json',
        shape: 'test.port-shape', audience: 'model-evidence',
      }],
    },
    _meta: { resultBindings: [{
      name: 'records', path: '$.data', shape: 'test.port-shape', type: 'structured-data',
      mediaType: 'application/json', audience: 'model-evidence',
    }] },
  })
  assert.deepEqual(legacy, [])
})

test('catalog diagnoses contract drift without rejecting repeated output shapes', () => {
  const repeatedShape = defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.records.read'] },
    outputs: [
      { kind: 'record-set', name: 'left', shape: 'tabular.records', audience: 'model-evidence', path: '$.left' },
      { kind: 'record-set', name: 'right', shape: 'tabular.records', audience: 'model-evidence', path: '$.right' },
    ],
  })
  const valid = createAiClientToolCatalogReport([{ id: 'records_read', ...repeatedShape }], {
    requireRouting: true,
    requireResultBindings: true,
  })
  assert.equal(valid.valid, true)
  assert.equal(valid.tools[0]?.contractStatus, 'typed')

  const drifted = createAiClientToolCatalogReport([{
    id: 'records_read',
    ...repeatedShape,
    routing: { ...repeatedShape.routing, produces: ['other'] },
  }], { requireRouting: true })
  assert.equal(drifted.tools[0]?.contractStatus, 'malformed')
  assert.ok(drifted.issues.some(issue => issue.code === 'typed_contract_routing_mismatch'))
})

test('catalog presentation preflight isolates an incompatible sibling and keeps a valid producer callable', async () => {
  let producerCalls = 0
  const mediaType = 'application/vnd.example.preflight-records+json'
  const shape = 'anonymous.preflight-records'
  const presentation = {
    type: 'anonymous-preflight-view',
    contentType: 'json' as const,
    mediaType,
    supportsSessionFile: true,
    maxInlineBytes: 4096,
    defaultMode: 'preview' as const,
    purpose: 'conversation-preview' as const,
    preferredInputShapes: [shape],
    deliveryPolicy: 'required' as const,
  }
  const validProducer = defineClientTool({
    id: 'anonymous_preflight_valid',
    description: { text: 'Produce compatible anonymous records', capabilities: ['anonymous.preflight.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'records', shape, mediaType, audience: 'client-presentation', recordPath: '$.records',
    }),
    execute: () => {
      producerCalls += 1
      return clientToolResult.success({ records: [{ id: 'one' }] })
    },
  })
  const incompatibleSibling = defineClientTool({
    id: 'anonymous_preflight_incompatible',
    description: { text: 'Produce incompatible anonymous records', capabilities: ['anonymous.preflight.other'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.recordSet({
      name: 'other-records', shape, mediaType: 'application/vnd.example.other+json',
      audience: 'client-presentation', recordPath: '$.records',
    }),
    execute: () => clientToolResult.success({ records: [] }),
  })
  const snapshot = createAiClientToolCatalogSnapshot(
    [incompatibleSibling, validProducer],
    { presentationCapabilities: [presentation] },
  )

  assert.equal(snapshot.report.valid, false)
  assert.deepEqual(
    snapshot.report.issues.filter(issue => issue.code === 'presentation_output_incompatible')
      .map(issue => issue.toolId),
    ['anonymous_preflight_incompatible'],
  )
  assert.deepEqual(snapshot.definitions.map(tool => tool.id), [
    'anonymous_preflight_incompatible', 'anonymous_preflight_valid',
  ])
  assert.equal(snapshot.wireDefinitions[1]?.expands?.['x-ai-routing']?.producerPorts, undefined)
  assert.equal(snapshot.definitions[1]?._meta?.resultBindings?.[0]?.audience, 'client-presentation')
  const callable = snapshot.definitions[1] as typeof validProducer
  await callable.execute({}, {}, { id: 'preflight-call', toolName: callable.id })
  assert.equal(producerCalls, 1)
})

test('catalog classifies typed, legacy, missing and malformed contracts independently', () => {
  const typed = createSeriesContract()
  const report = createAiClientToolCatalogReport([
    { id: 'typed_tool', ...typed },
    {
      id: 'legacy_tool',
      routing: {
        capabilities: ['legacy.records.read'],
        stages: ['execution'],
        dataAccessModes: ['records'],
        resultDeliveries: ['inline'],
        evidencePolicy: 'optional',
        produces: ['legacy-records'],
        outputShapes: ['tabular.records'],
      },
      _meta: {
        resultBindings: [{ name: 'legacy-records', path: '$.data', shape: 'tabular.records' }],
      },
    },
    { id: 'missing_tool' },
    {
      id: 'remote_tool',
      _meta: {
        clientToolAdapter: {
          version: 'remote-definition/v1',
          source: 'iframe',
          sourceRevision: '7',
        },
      },
    },
    {
      id: 'malformed_tool',
      ...typed,
      _meta: { ...typed._meta, clientToolContract: { version: 'bad', outputs: [] } },
    },
  ], { requireRouting: false, requireResultBindings: true })
  assert.equal(report.summary.total, 5)
  assert.equal(report.summary.typed, 1)
  assert.equal(report.summary.legacy, 3)
  assert.equal(report.summary.malformedContract, 1)
  assert.equal(report.tools.find(tool => tool.toolId === 'legacy_tool')?.contractStatus, 'legacy')
  assert.equal(report.tools.find(tool => tool.toolId === 'missing_tool')?.routingStatus, 'missing')
  assert.equal(report.tools.find(tool => tool.toolId === 'remote_tool')?.authoringStatus, 'remote-adapted')
  assert.equal(report.summary.remoteAdapted, 1)
  assert.ok(report.issues.some(issue => issue.code === 'typed_contract_malformed'))
})

test('canonical catalog snapshot admits five authoring classes through one wire projection', () => {
  const facade = defineClientTool({
    id: 'facade_reader',
    description: { text: 'facade read', capabilities: ['catalog.facade.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.detail({ name: 'facade-result', shape: 'catalog.facade' }),
    execute: () => clientToolResult.success({ ok: true }),
  })
  const typedLegacy = { id: 'typed_legacy', ...createSeriesContract(), expands: { effect: 'READ' } }
  const routedLegacy = {
    id: 'routed_legacy',
    routing: {
      capabilities: ['catalog.routed.read'],
      stages: ['execution'],
      resultDeliveries: ['inline'],
      evidencePolicy: 'optional',
    },
    expands: { effect: 'READ' },
  }
  const plainLegacy = { id: 'plain_legacy' }
  const remoteAdapted = {
    id: 'remote_adapted',
    expands: { effect: 'EXTERNAL_ACTION' },
    _meta: { clientToolAdapter: { version: 'remote-definition/v1', source: 'iframe' } },
  }
  const snapshot = createAiClientToolCatalogSnapshot([
    facade,
    typedLegacy,
    routedLegacy,
    plainLegacy,
    remoteAdapted,
  ])

  assert.deepEqual(snapshot.report.tools.map(tool => tool.authoringStatus), [
    'facade', 'typed-legacy', 'routed-legacy', 'plain-legacy', 'remote-adapted',
  ])
  assert.deepEqual(snapshot.definitions.map(tool => tool.id), [
    'facade_reader', 'typed_legacy', 'routed_legacy', 'plain_legacy', 'remote_adapted',
  ])
  assert.deepEqual(snapshot.wireDefinitions.map(tool => tool.expands?.effect), [
    'READ', 'READ', 'READ', undefined, 'EXTERNAL_ACTION',
  ])
  assert.equal(snapshot.semanticDigest.length, 16)
})

test('catalog isolates malformed effects while a valid analytical sibling remains callable', async () => {
  const { tool: analyticalSibling } = createAnonymousBoundedTool([9, 3, 6])
  const snapshot = createAiClientToolCatalogSnapshot([
    analyticalSibling,
    { id: 'valid_legacy_write', expands: { effect: 'WRITE' } },
    { id: 'missing_effect_write', annotations: { readOnlyHint: false } },
    { id: 'invalid_effect', expands: { effect: 'SIDE_EFFECT' } },
    {
      id: 'malformed_routing_read',
      expands: { effect: 'READ' },
      routing: { capabilities: ['not valid'] },
    },
    { id: 'plain_sibling' },
  ])

  assert.deepEqual(snapshot.definitions.map(tool => tool.id), [
    'anonymous_top_n', 'valid_legacy_write', 'malformed_routing_read', 'plain_sibling',
  ])
  assert.deepEqual(snapshot.wireDefinitions.map(tool => tool.id), [
    'anonymous_top_n', 'valid_legacy_write', 'malformed_routing_read', 'plain_sibling',
  ])
  assert.equal(
    snapshot.wireDefinitions[0]?.expands?.['x-ai-routing']?.analyticalCapability?.capabilityId,
    'anonymous.top_n',
  )
  assert.equal(snapshot.wireDefinitions[1]?.expands?.effect, 'WRITE')
  assert.equal(snapshot.wireDefinitions[2]?.expands?.['x-ai-routing'], undefined)
  const callable = snapshot.definitions.find(
    tool => tool.id === analyticalSibling.id,
  ) as typeof analyticalSibling | undefined
  assert.equal(typeof callable?.execute, 'function')
  const result = await callable?.execute?.({ requestedCount: 2 }, {}, {
    id: 'call-valid-analytical-sibling',
    toolName: analyticalSibling.id,
  }) as any
  assert.equal(result?.evidence?.complete, true)
  assert.deepEqual(
    result?.__clientToolOutputs?.output0.map((record: Record<string, number>) => record.physical_score),
    [9, 6],
  )
  assert.ok(snapshot.report.issues.some(issue => issue.code === 'effect_required_for_side_effect'))
  assert.ok(snapshot.report.issues.some(issue => issue.code === 'effect_legacy_malformed'))
})

test('catalog rejects canonical and legacy effect conflicts without losing valid siblings', () => {
  const facade = defineClientTool({
    id: 'conflicting_facade',
    description: { text: 'write', capabilities: ['catalog.conflict.write'] },
    effect: { kind: 'WRITE', idempotency: 'IDEMPOTENT', reversible: true, confirmation: false },
    output: clientToolOutput.stateChange({ name: 'state', shape: 'catalog.state', transition: 'MUTATION' }),
    execute: () => clientToolResult.success({ ok: true }),
  })
  const snapshot = createAiClientToolCatalogSnapshot([
    { ...facade, expands: { ...facade.expands, effect: 'READ' } },
    { id: 'duplicate_reader' },
    { id: 'duplicate_reader' },
    { id: 'valid_reader', expands: { effect: 'READ' } },
  ])

  assert.deepEqual(snapshot.definitions.map(tool => tool.id), ['valid_reader'])
  assert.ok(snapshot.report.issues.some(issue => issue.code === 'effect_conflict'))
  assert.ok(snapshot.report.issues.some(issue => issue.code === 'duplicate_tool_id'))
})

test('catalog snapshot has a stable semantic identity and freezes active execution refreshes', () => {
  let tools: Array<Record<string, unknown>> = [{ id: 'first_reader', expands: { effect: 'READ' } }]
  const build = () => createAiClientToolCatalogSnapshot(tools)
  const reordered = createAiClientToolCatalogSnapshot([{
    id: 'first_reader',
    expands: { effect: 'READ' },
    routing: {
      capabilities: ['catalog.first.read', 'catalog.first.detail'],
      stages: ['execution', 'preparation'],
      resultDeliveries: ['inline'],
      evidencePolicy: 'optional',
    },
  }])
  const equivalent = createAiClientToolCatalogSnapshot([{
    id: 'first_reader',
    expands: { effect: 'READ' },
    routing: {
      capabilities: ['catalog.first.detail', 'catalog.first.read'],
      stages: ['preparation', 'execution'],
      resultDeliveries: ['inline'],
      evidencePolicy: 'optional',
    },
  }])
  assert.equal(reordered.semanticFingerprint, equivalent.semanticFingerprint)
  assert.equal(reordered.semanticDigest, equivalent.semanticDigest)

  const runtime = createClientToolSnapshotController(build, snapshot => snapshot.semanticFingerprint)
  const active = runtime.beginExecution()
  tools = [{ id: 'second_reader', expands: { effect: 'READ' } }]
  runtime.refresh()
  assert.deepEqual(active.snapshot.wireDefinitions.map(tool => tool.id), ['first_reader'])
  assert.deepEqual(runtime.snapshot.wireDefinitions.map(tool => tool.id), ['first_reader'])
  active.complete()
  assert.deepEqual(runtime.snapshot.wireDefinitions.map(tool => tool.id), ['second_reader'])
  assert.equal(runtime.version, 2)
  runtime.dispose()
})

test('reconstructed catalog snapshots reconnect to the latest canonical registry state', () => {
  const scope = `catalog-reconnect-${Date.now()}`
  const disposeFirst = aiClientToolRegistry.register(scope, {
    id: 'registered_first',
    execute: () => ({ ok: true }),
  })
  const first = createAiClientToolCatalogSnapshot(aiClientToolRegistry.snapshot(scope).tools)
  const disposeSecond = aiClientToolRegistry.register(scope, {
    id: 'registered_second',
    execute: () => ({ ok: true }),
  })
  const reconnected = createAiClientToolCatalogSnapshot(aiClientToolRegistry.snapshot(scope).tools)

  assert.deepEqual(first.wireDefinitions.map(tool => tool.id), ['registered_first'])
  assert.deepEqual(reconnected.wireDefinitions.map(tool => tool.id), ['registered_second'])
  assert.notEqual(first.semanticFingerprint, reconnected.semanticFingerprint)
  disposeFirst()
  assert.deepEqual(aiClientToolRegistry.snapshot(scope).tools.map(tool => tool.id), ['registered_second'])
  disposeSecond()
})

test('catalog preserves runtime tolerance while reporting routing and binding failures', () => {
  const report = createAiClientToolCatalogReport([
    {
      id: 'invalid_tool',
      routing: {
        capabilities: ['invalid capability'],
        stages: ['unknown' as never],
        dataAccessModes: ['records'],
        resultDeliveries: ['inline'],
        evidencePolicy: 'required',
        produces: ['records'],
        outputShapes: ['tabular.records'],
      },
      _meta: { resultBindings: [{ name: 'records', path: '$..items', shape: 'wrong' }] },
    },
    { id: 'missing_tool' },
  ], { requireRouting: true, requireResultBindings: true })
  assert.equal(report.valid, false)
  assert.ok(report.issues.some(issue => issue.code === 'required' && issue.field === 'stages'))
  assert.ok(report.issues.some(issue => issue.code === 'invalid_identifier'))
  assert.ok(report.issues.some(issue => issue.code === 'result_binding_path_invalid'))
  assert.ok(report.issues.some(issue => issue.code === 'result_binding_shape_invalid'))
  assert.ok(report.issues.some(issue => issue.code === 'routing_missing' && issue.toolId === 'missing_tool'))
})

test('catalog marks typed binding drift as malformed without confusing catalog identity issues', () => {
  const typed = createSeriesContract()
  const bindingDrift = {
    id: 'binding_drift',
    ...typed,
    _meta: {
      ...typed._meta,
      resultBindings: [{ name: 'series', path: '$..data', shape: 'time-series.aggregate' }],
    },
  }
  const driftReport = createAiClientToolCatalogReport([bindingDrift], {
    requireResultBindings: true,
  })
  assert.equal(driftReport.tools[0]?.contractStatus, 'malformed')
  assert.equal(driftReport.summary.malformedContract, 1)
  assert.ok(driftReport.issues.some(issue => issue.code === 'result_binding_path_invalid'))

  const duplicateReport = createAiClientToolCatalogReport([
    { id: 'duplicate_typed', ...typed },
    { id: 'duplicate_typed', ...typed },
  ], { requireResultBindings: true })
  assert.deepEqual(duplicateReport.tools.map(tool => tool.contractStatus), ['typed', 'typed'])
  assert.ok(duplicateReport.issues.some(issue => issue.code === 'duplicate_tool_id'))
})

test('catalog diagnostics remain bounded for one hundred typed tools', () => {
  const tools = Array.from({ length: 100 }, (_, index) => ({
    id: `typed_tool_${index}`,
    ...createSeriesContract(),
  }))
  const startedAt = performance.now()
  const report = createAiClientToolCatalogReport(tools, {
    requireRouting: true,
    requireResultBindings: true,
  })
  const elapsedMs = performance.now() - startedAt
  assert.equal(report.valid, true)
  assert.equal(report.summary.typed, 100)
  assert.ok(elapsedMs < 20, `catalog validation took ${elapsedMs.toFixed(2)}ms`)
})

test('catalog graph diagnostics detect unsatisfied, ambiguous, cyclic, deep and eager declarations', () => {
  const routing = (
    capability: string,
    produces: string[] = [],
    prerequisites: string[] = [],
    extra: Record<string, unknown> = {},
  ) => ({
    capabilities: [capability],
    stages: ['execution'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'optional',
    ...(produces.length ? { produces, outputShapes: produces.map(() => 'tabular.records') } : {}),
    ...(prerequisites.length ? { prerequisites } : {}),
    ...extra,
  })
  const report = validateAiClientToolRoutingCatalog([
    { id: 'invalid-id', routing: routing('test.invalid.read') },
    { id: 'unsatisfied', routing: routing('test.consume.read', [], ['missing']) },
    { id: 'cycle_a', routing: routing('test.cycle.a', ['a'], ['b']) },
    { id: 'cycle_b', routing: routing('test.cycle.b', ['b'], ['a']) },
    { id: 'shared_a', routing: routing('test.shared.read', ['shared']) },
    { id: 'shared_b', routing: routing('test.shared.read', ['shared']) },
    { id: 'shared_consumer', routing: routing('test.shared.consume', [], ['shared']) },
    { id: 'depth_root', routing: routing('test.depth.root', ['depth-0']) },
    { id: 'depth_one', routing: routing('test.depth.one', ['depth-1'], ['depth-0']) },
    { id: 'depth_two', routing: routing('test.depth.two', ['depth-2'], ['depth-1']) },
    { id: 'eager_high', routing: routing('test.eager.read', [], [], { exposure: 'eager', cost: 'high' }) },
  ] as any, {
    maxDependencyDepth: 1,
    maxEagerTools: 0,
    maxEagerSchemaChars: 0,
  })
  const codes = new Set(report.map(issue => issue.code))
  assert.ok(codes.has('invalid_tool_id'))
  assert.ok(codes.has('prerequisite_unsatisfied'))
  assert.ok(codes.has('dependency_cycle'))
  assert.ok(codes.has('ambiguous_producer'))
  assert.ok(codes.has('dependency_depth_exceeded'))
  assert.ok(codes.has('eager_budget_exceeded'))
  assert.ok(codes.has('eager_cost_invalid'))
})

test('structured evidence metadata is JSON-safe and bounded at every nesting boundary', () => {
  const cyclic: Record<string, unknown> = { safe: true }
  cyclic.self = cyclic
  const manyKeys = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`key-${index}`, index]))
  const result = withAiClientToolEvidence({}, {
    complete: true,
    truncated: false,
    requestedRange: {
      start: 1,
      text: 'x'.repeat(1_000),
      items: Array.from({ length: 40 }, (_, index) => index),
      cyclic,
      nested: { second: { third: { fourth: { hidden: true } } } },
      invalid: Number.NaN,
    },
    observedRange: { start: 2, end: 3 },
    recordCount: 40,
    returnedCount: 32,
    limitReason: 'records',
    resultStatus: 'partial',
    evidenceCoverage: 'bounded-result',
    supportsAbsenceClaim: true,
    facts: manyKeys,
    claims: [
      { id: 'count', label: 'Count', value: 40, visibility: 'user' },
      { id: 'count', label: 'Duplicate', value: 41, visibility: 'user' },
      { id: '', label: 'Invalid', value: true, visibility: 'user' },
    ],
    warnings: ['bounded', 'bounded', 'partial'],
    artifacts: [{ uri: 'fs://report.pdf', mimeType: 'application/pdf' }],
    datasets: ['series', 'series', 'summary'],
    outputBindings: [{
      name: 'metric',
      label: 'Metric',
      path: '$.metric',
      shape: 'metric.scalar',
      mediaType: 'application/json',
      recordCount: 1,
      complete: true,
      truncated: false,
      fields: [
        {
          name: 'value',
          semanticRole: 'number',
          label: 'Value',
          format: 'decimal',
          measure: 'duration',
          unit: 'ms',
          aggregation: 'sum',
        },
      ],
      requestedRange: manyKeys,
      observedRange: { start: 2, end: 3 },
      coverage: JSON.parse('{"__proto__":{"polluted":true},"ratio":1}'),
      metric: {
        name: 'availability',
        measure: 'duration',
        unit: 'ms',
        aggregation: 'sum',
        value: { series: Array.from({ length: 40 }, (_, index) => index) },
        scope: { range: manyKeys },
        coverage: { complete: true },
        exact: true,
        provenance: { source: 'x'.repeat(1_000) },
      },
    }],
  }) as any

  assert.equal(result.evidence.requestedRange.text.length, 600)
  assert.equal(result.evidence.requestedRange.items.length, 32)
  assert.deepEqual(result.evidence.requestedRange.cyclic, { safe: true })
  assert.equal(result.evidence.requestedRange.nested.second.third.fourth, undefined)
  assert.equal(result.evidence.requestedRange.invalid, undefined)
  assert.equal(Object.keys(result.evidence.facts).length, 32)
  assert.equal(Object.keys(result.evidence.outputBindings[0].requestedRange).length, 32)
  assert.equal(result.evidence.outputBindings[0].coverage.__proto__.polluted, undefined)
  assert.equal(result.evidence.outputBindings[0].metric.value.series.length, 32)
  assert.equal(result.evidence.outputBindings[0].metric.provenance.source.length, 600)
  assert.equal(result.evidence.outputBindings[0].fields.length, 1)
  assert.deepEqual(result.evidence.claims.map((claim: any) => claim.id), ['count'])
  assert.deepEqual(result.evidence.warnings, ['bounded', 'partial'])
  assert.deepEqual(result.evidence.datasets, ['series', 'summary'])
  assert.equal(result.evidence.artifacts[0].uri, 'fs://report.pdf')
})

test('malformed metric records are omitted without suppressing the valid output binding', () => {
  const result = withAiClientToolEvidence({}, {
    complete: true,
    truncated: false,
    outputBindings: [{
      name: 'metric',
      path: '$.metric',
      shape: 'metric.scalar',
      complete: true,
      metric: {
        name: 'metric',
        measure: 'count',
        unit: 'count',
        aggregation: 'sum',
        scope: [] as unknown as Record<string, unknown>,
        coverage: {},
        exact: false,
        provenance: {},
      },
    }],
  })
  assert.equal(result.evidence.outputBindings?.length, 1)
  assert.equal(result.evidence.outputBindings?.[0]?.metric, undefined)
})

test('semantic fact collection is bounded and uses only declared roles', () => {
  const collector = createAiClientToolRecordFactCollector({
    type: 'object',
    properties: {
      time: { type: 'string', format: 'date-time' },
      value: { type: 'number', 'x-ai-role': 'number' },
      state: { type: 'string', 'x-ai-role': 'state' },
      location: { type: 'object', 'x-ai-role': 'geo_point' },
      ignored: { type: 'number' },
    },
  })
  collector.accept({ time: '2026-01-01T00:00:00Z', value: 1, state: 'online', location: { x: 1 }, ignored: 7 })
  collector.accept({ time: 'bad', value: 'bad', state: null, location: null, ignored: 8 })
  const snapshot = collector.snapshot()
  assert.deepEqual(snapshot.observedRange, {
    start: Date.parse('2026-01-01T00:00:00Z'),
    end: Date.parse('2026-01-01T00:00:00Z'),
  })
  assert.deepEqual(snapshot.facts?.fields.value, {
    role: 'number', count: 1, invalidCount: 1, min: 1, max: 1,
  })
  assert.deepEqual(snapshot.facts?.fields.state, {
    role: 'state', count: 2, nullCount: 1, values: ['online'], valuesTruncated: false,
  })
  assert.equal(snapshot.facts?.fields.ignored, undefined)
})

test('semantic fact profiles cap fields and category cardinality', () => {
  const properties = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [
    `field${index}`,
    { type: 'string', 'x-ai-role': index === 0 ? 'category' : 'identifier' },
  ]))
  const collector = createAiClientToolRecordFactCollector({ type: 'object', properties })
  Array.from({ length: 22 }, (_, index) => `value-${index}`)
    .forEach(value => collector.accept({ field0: value }))
  const fields = collector.snapshot().facts?.fields as Record<string, any>
  assert.equal(Object.keys(fields).length, 32)
  assert.equal(fields.field0.values.length, 20)
  assert.equal(fields.field0.valuesTruncated, true)

  const empty = createAiClientToolRecordFactCollector({ type: 'object' }).snapshot()
  assert.equal(empty.observedRange, undefined)
  assert.equal(empty.facts, undefined)
})

test('file failure degrades to the retained sample with truthful returnedCount', async () => {
  const records = Array.from({ length: 5 }, (_, index) => ({ index }))
  const removals: Array<{ path: string; ignoreMissing?: boolean }> = []
  const stream = createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource(records),
    schema: { type: 'object', properties: { index: { type: 'number', 'x-ai-role': 'number' } } },
    bindingName: 'records',
    outputShape: 'tabular.records',
    limits: { previewLimit: 0, fallbackSampleLimit: 2 },
  })
  const result = await deliverAiClientToolResult(stream, {
    call: {
      id: 'call-file-failure',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async () => { throw new Error('write failed') },
        remove: async (path, options) => {
          removals.push({ path, ignoreMissing: options?.ignoreMissing })
          return { ok: true, path }
        },
      },
    },
    resultDelivery: 'auto',
    bindingName: 'records',
    outputShape: 'tabular.records',
  }) as {
    data: { sample: unknown[] }
    evidence: {
      recordCount: number
      returnedCount: number
      complete: boolean
      truncated: boolean
      outputBindings: Array<{ path?: string }>
    }
  }
  assert.equal(result.data.sample.length, 2)
  assert.equal(result.evidence.recordCount, 5)
  assert.equal(result.evidence.returnedCount, 2)
  assert.equal(result.evidence.complete, false)
  assert.equal(result.evidence.truncated, true)
  assert.equal(result.evidence.outputBindings[0].path, '$.data.sample')
  assert.equal(removals.length, 1)
  assert.equal(removals[0]?.ignoreMissing, true)
})

test('file success and inline delivery expose equivalent logical bindings', async () => {
  const records = [{ index: 1 }, { index: 2 }]
  const createStream = () => createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource(records),
    schema: { type: 'object', properties: { index: { type: 'number', 'x-ai-role': 'number' } } },
    bindingName: 'records',
    outputShape: 'tabular.records',
  })
  const fileResult = await deliverAiClientToolResult(createStream(), {
    call: {
      id: 'call-file-success',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
    bindingName: 'records',
    outputShape: 'tabular.records',
  }) as { evidence: { outputBindings: Array<{ name: string; ref?: string; path?: string }> } }
  const inlineResult = await deliverAiClientToolResult(createStream(), {
    call: { id: 'call-inline', toolName: 'records_read' },
    resultDelivery: 'inline',
    bindingName: 'records',
    outputShape: 'tabular.records',
  }) as { evidence: { complete: boolean; outputBindings: Array<{ name: string; ref?: string; path?: string }> } }
  assert.equal(fileResult.evidence.outputBindings[0]?.name, 'records')
  assert.ok(fileResult.evidence.outputBindings[0]?.ref?.startsWith('fs://'))
  assert.equal(fileResult.evidence.outputBindings[0]?.path, undefined)
  assert.equal(inlineResult.evidence.outputBindings[0]?.name, 'records')
  assert.equal(inlineResult.evidence.outputBindings[0]?.path, '$.data.sample')
  assert.equal(inlineResult.evidence.complete, true)
})

test('record streams share one audience policy and exact NDJSON digest across inline and file carriers', async () => {
  const records = [{ id: 'alpha' }, { id: 'beta' }]
  const canonicalBytes = new TextEncoder().encode(
    records.map(record => `${JSON.stringify(record)}\n`).join(''),
  )
  const expectedDigestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', canonicalBytes))
  const expectedDigest = `sha256:${Array.from(
    expectedDigestBytes,
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')}`
  const shape = 'anonymous.stream-records'
  const mediaType = 'application/x-ndjson'
  const stream = () => createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource(records),
    schema: { type: 'object', properties: { id: { type: 'string', 'x-ai-role': 'identifier' } } },
    bindingName: 'records',
    outputShape: shape,
  })
  const output = (audience: 'model-evidence' | 'client-presentation' | 'reusable-source') => [{
    name: 'records', type: 'structured-data' as const, shape, mediaType, audience, delivery: 'auto' as const,
  }]
  const capability = (deliveryPolicy: 'required' | 'optional', maxInlineBytes: number) => ({
    type: 'anonymous-stream-view',
    contentType: 'json' as const,
    mediaType,
    supportsSessionFile: true,
    maxInlineBytes,
    defaultMode: 'preview' as const,
    purpose: 'conversation-preview' as const,
    preferredInputShapes: [shape],
    deliveryPolicy,
  })
  let modelUploads = 0
  const modelEvidence = await deliverAiClientToolResult(stream(), {
    call: {
      id: 'stream-model-evidence',
      toolName: 'anonymous_stream_producer',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => {
          modelUploads += 1
          return { ok: true, path }
        },
      },
    },
    outputs: output('model-evidence'),
  }) as any
  assert.equal(modelUploads, 0)
  assert.equal(modelEvidence.data.delivery, 'inline-sample')
  assert.equal(modelEvidence.complete, true)
  assert.equal(modelEvidence.evidence.complete, true)
  assert.equal(modelEvidence.outputBindings[0].audience, 'model-evidence')
  assert.equal(modelEvidence.outputBindings[0].sourceDigest, expectedDigest)

  const requiredInline = await deliverAiClientToolResult(stream(), {
    call: {
      id: 'stream-required-inline',
      toolName: 'anonymous_stream_producer',
      presentationCapabilities: [capability('required', 4096)],
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(requiredInline.data.delivery, 'inline-sample')
  assert.equal(requiredInline.evidence.complete, true)
  assert.equal(requiredInline.outputBindings[0].sourceDigest, expectedDigest)

  const uploadedChunks: string[] = []
  const requiredFile = await deliverAiClientToolResult(stream(), {
    call: {
      id: 'stream-required-file',
      toolName: 'anonymous_stream_producer',
      presentationCapabilities: [capability('required', 1)],
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async (path, body) => {
          uploadedChunks.push(body instanceof Blob ? await body.text() : String(body))
          return { ok: true, path }
        },
      },
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(uploadedChunks.join(''), new TextDecoder().decode(canonicalBytes))
  assert.equal(requiredFile.data.delivery, 'session-file')
  assert.equal(requiredFile.evidence.complete, true)
  assert.equal(requiredFile.outputBindings[0].sourceDigest, expectedDigest)
  assert.equal(requiredFile.outputBindings[0].sourceDigest, requiredInline.outputBindings[0].sourceDigest)

  const requiredUnavailable = await deliverAiClientToolResult(stream(), {
    call: {
      id: 'stream-required-unavailable',
      toolName: 'anonymous_stream_producer',
      presentationCapabilities: [capability('required', 1)],
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(requiredUnavailable.evidence.complete, false)
  assert.equal(requiredUnavailable.evidence.truncated, true)
  assert.equal(requiredUnavailable.outputBindings, undefined)
  assert.equal(requiredUnavailable.data.sourceDigest, undefined)

  const optionalUnavailable = await deliverAiClientToolResult(stream(), {
    call: {
      id: 'stream-optional-unavailable',
      toolName: 'anonymous_stream_producer',
      presentationCapabilities: [capability('optional', 1)],
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(optionalUnavailable.evidence.complete, true)
  assert.equal(optionalUnavailable.outputBindings, undefined)
  assert.equal(optionalUnavailable.data.sourceDigest, undefined)

  const reusableUnavailable = await deliverAiClientToolResult(stream(), {
    call: { id: 'stream-reusable-unavailable', toolName: 'anonymous_stream_producer' },
    outputs: output('reusable-source'),
  }) as any
  assert.equal(reusableUnavailable.evidence.complete, false)
  assert.equal(reusableUnavailable.outputBindings, undefined)
  assert.equal(reusableUnavailable.data.sourceDigest, undefined)

  const reusableFile = await deliverAiClientToolResult(stream(), {
    call: {
      id: 'stream-reusable-file',
      toolName: 'anonymous_stream_producer',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
      },
    },
    outputs: output('reusable-source'),
  }) as any
  assert.equal(reusableFile.data.delivery, 'session-file')
  assert.equal(reusableFile.evidence.complete, true)
  assert.equal(reusableFile.outputBindings[0].sourceDigest, expectedDigest)
})

test('empty record streams keep evidence separate from required carrier admission', async () => {
  const semanticToken = crypto.randomUUID().replaceAll('-', '')
  const shape = `anonymous.${semanticToken}.records`
  const mediaType = 'application/x-ndjson'
  const emptyDigestBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array()))
  const emptyDigest = `sha256:${Array.from(
    emptyDigestBytes,
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')}`
  const stream = () => createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([]),
    schema: { type: 'object', properties: { id: { type: 'string', 'x-ai-role': 'identifier' } } },
    bindingName: 'records',
    outputShape: shape,
  })
  const output = (
    audience: 'model-evidence' | 'client-presentation' | 'reusable-source',
    delivery: 'auto' | 'inline' = 'auto',
  ) => [{
    name: 'records', type: 'structured-data' as const, shape, mediaType, audience, delivery,
  }]
  const capability = (
    deliveryPolicy: 'required' | 'optional',
    supportsSessionFile: boolean,
    maxInlineBytes: number,
  ) => ({
    type: `anonymous-empty-view-${semanticToken}`,
    contentType: 'json' as const,
    mediaType,
    supportsSessionFile,
    maxInlineBytes,
    defaultMode: 'preview' as const,
    purpose: 'conversation-preview' as const,
    preferredInputShapes: [shape],
    deliveryPolicy,
  })

  let modelUploads = 0
  const modelEvidence = await deliverAiClientToolResult(stream(), {
    call: {
      id: `empty-model-${semanticToken}`,
      toolName: `anonymous_empty_${semanticToken}`,
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => {
          modelUploads += 1
          return { ok: true, path }
        },
      },
    },
    outputs: output('model-evidence'),
  }) as any
  assert.equal(modelUploads, 0)
  assert.equal(modelEvidence.status, 'empty')
  assert.equal(modelEvidence.evidence.complete, true)
  assert.equal(modelEvidence.outputBindings[0].path, '$.data.sample')
  assert.equal(modelEvidence.outputBindings[0].sourceDigest, emptyDigest)

  const missingPresentation = await deliverAiClientToolResult(stream(), {
    call: { id: `empty-missing-${semanticToken}`, toolName: `anonymous_empty_${semanticToken}` },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(missingPresentation.status, 'partial')
  assert.equal(missingPresentation.evidence.complete, false)
  assert.equal(missingPresentation.evidence.truncated, false)
  assert.equal(missingPresentation.evidence.displayTruncated, false)
  assert.equal(missingPresentation.outputBindings, undefined)
  assert.equal(missingPresentation.data.sourceDigest, undefined)

  const requiredInline = await deliverAiClientToolResult(stream(), {
    call: {
      id: `empty-inline-${semanticToken}`,
      toolName: `anonymous_empty_${semanticToken}`,
      presentationCapabilities: [capability('required', false, 4096)],
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(requiredInline.status, 'empty')
  assert.equal(requiredInline.evidence.complete, true)
  assert.equal(requiredInline.outputBindings[0].path, '$.data.sample')
  assert.equal(requiredInline.outputBindings[0].sourceDigest, emptyDigest)

  const requiredFileUnavailable = await deliverAiClientToolResult(stream(), {
    call: {
      id: `empty-file-unavailable-${semanticToken}`,
      toolName: `anonymous_empty_${semanticToken}`,
      presentationCapabilities: [capability('required', true, 0)],
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(requiredFileUnavailable.status, 'partial')
  assert.equal(requiredFileUnavailable.evidence.complete, false)
  assert.equal(requiredFileUnavailable.outputBindings, undefined)
  assert.equal(requiredFileUnavailable.data.sourceDigest, undefined)

  const uploadedEmptyBodies: Blob[] = []
  const requiredFile = await deliverAiClientToolResult(stream(), {
    call: {
      id: `empty-file-${semanticToken}`,
      toolName: `anonymous_empty_${semanticToken}`,
      presentationCapabilities: [capability('required', true, 0)],
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async (path, body) => {
          uploadedEmptyBodies.push(body as Blob)
          return { ok: true, path }
        },
      },
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(uploadedEmptyBodies.length, 1)
  assert.equal(await uploadedEmptyBodies[0]?.text(), '')
  assert.equal(requiredFile.status, 'empty')
  assert.equal(requiredFile.evidence.complete, true)
  assert.ok(requiredFile.outputBindings[0].ref.startsWith('fs://'))
  assert.equal(requiredFile.outputBindings[0].sourceDigest, emptyDigest)

  const optionalUnavailable = await deliverAiClientToolResult(stream(), {
    call: {
      id: `empty-optional-${semanticToken}`,
      toolName: `anonymous_empty_${semanticToken}`,
      presentationCapabilities: [capability('optional', true, 0)],
    },
    outputs: output('client-presentation'),
  }) as any
  assert.equal(optionalUnavailable.status, 'empty')
  assert.equal(optionalUnavailable.evidence.complete, true)
  assert.equal(optionalUnavailable.data.required, false)
  assert.equal(optionalUnavailable.data.satisfied, false)
  assert.equal(optionalUnavailable.outputBindings, undefined)
  assert.equal(optionalUnavailable.data.sourceDigest, undefined)

  const reusableUnavailable = await deliverAiClientToolResult(stream(), {
    call: { id: `empty-reuse-unavailable-${semanticToken}`, toolName: `anonymous_empty_${semanticToken}` },
    outputs: output('reusable-source'),
  }) as any
  assert.equal(reusableUnavailable.status, 'partial')
  assert.equal(reusableUnavailable.evidence.complete, false)
  assert.equal(reusableUnavailable.outputBindings, undefined)
  assert.equal(reusableUnavailable.data.sourceDigest, undefined)

  let reusableUploads = 0
  const reusableFile = await deliverAiClientToolResult(stream(), {
    call: {
      id: `empty-reuse-file-${semanticToken}`,
      toolName: `anonymous_empty_${semanticToken}`,
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => {
          reusableUploads += 1
          return { ok: true, path }
        },
      },
    },
    outputs: output('reusable-source'),
  }) as any
  assert.equal(reusableUploads, 1)
  assert.equal(reusableFile.status, 'empty')
  assert.equal(reusableFile.evidence.complete, true)
  assert.ok(reusableFile.outputBindings[0].ref.startsWith('fs://'))
  assert.equal(reusableFile.outputBindings[0].sourceDigest, emptyDigest)

  const reusableInline = await deliverAiClientToolResult(stream(), {
    call: { id: `empty-reuse-inline-${semanticToken}`, toolName: `anonymous_empty_${semanticToken}` },
    outputs: output('reusable-source', 'inline'),
  }) as any
  assert.equal(reusableInline.status, 'empty')
  assert.equal(reusableInline.evidence.complete, true)
  assert.equal(reusableInline.outputBindings[0].path, '$.data.sample')
  assert.equal(reusableInline.outputBindings[0].sourceDigest, emptyDigest)
})

test('empty artifact cardinality never substitutes for a required carrier', async () => {
  const semanticToken = crypto.randomUUID().replaceAll('-', '')
  const shape = `anonymous.${semanticToken}.artifact-records`
  const mediaType = `application/vnd.${semanticToken}+json`
  const artifact = createAiClientToolArtifact({
    content: JSON.stringify({ records: [] }),
    mimeType: mediaType,
    bindingName: 'records',
    outputShape: shape,
    recordPath: '$.records',
    cardinality: { kind: 'record-set', recordCount: 0, returnedCount: 0, totalCount: 0 },
    preview: { count: 0 },
  })
  const result = await deliverAiClientToolResult({ data: artifact }, {
    call: { id: `empty-artifact-${semanticToken}`, toolName: `anonymous_empty_${semanticToken}` },
    outputs: [{
      name: 'records', type: 'structured-data', shape, mediaType,
      audience: 'client-presentation', delivery: 'auto',
    }],
  }) as any
  assert.equal(result.status, 'partial')
  assert.equal(result.complete, false)
  assert.equal(result.truncated, false)
  assert.equal(result.evidence.displayTruncated, false)
  assert.equal(result.outputBindings, undefined)
  assert.equal(result.evidence.outputBindings, undefined)
})

test('record and cancellation limits stay partial or abort without unbounded consumption', async () => {
  const limited = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ index: 1 }, { index: 2 }, { index: 3 }]),
    schema: { type: 'object', properties: { index: { type: 'number', 'x-ai-role': 'number' } } },
    limits: { maxRecords: 2 },
  }), {
    call: {
      id: 'call-record-limit',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
  }) as { evidence: { recordCount: number; truncated: boolean; limitReason: string } }
  assert.equal(limited.evidence.recordCount, 2)
  assert.equal(limited.evidence.truncated, true)
  assert.equal(limited.evidence.limitReason, 'records')

  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ index: 1 }]),
    schema: { type: 'object' },
  }), {
    call: { id: 'call-aborted', toolName: 'records_read', signal: controller.signal },
    resultDelivery: 'inline',
  }), (error: unknown) => error instanceof Error && error.name === 'AbortError')
})

test('in-flight cancellation performs one idempotent compensation delete', async () => {
  const controller = new AbortController()
  const removals: Array<{ path: string; ignoreMissing?: boolean }> = []
  let uploadStarted!: () => void
  const started = new Promise<void>(resolve => { uploadStarted = resolve })
  const delivery = deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ index: 1 }]),
    schema: { type: 'object' },
  }), {
    call: {
      id: 'call-cancel-upload',
      toolName: 'records_read',
      signal: controller.signal,
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async (path, _body, options) => {
          uploadStarted()
          await new Promise<void>((_resolve, reject) => {
            const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
            if (options?.signal?.aborted) abort()
            else options?.signal?.addEventListener('abort', abort, { once: true })
          })
          return { ok: true, path }
        },
        remove: async (path, options) => {
          removals.push({ path, ignoreMissing: options?.ignoreMissing })
          return { ok: true, path }
        },
      },
    },
    resultDelivery: 'auto',
  })
  await started
  controller.abort()
  await assert.rejects(delivery, (error: unknown) => error instanceof Error && error.name === 'AbortError')
  assert.equal(removals.length, 1)
  assert.equal(removals[0]?.ignoreMissing, true)
})

test('inline binding attachment uses declared paths and ignores failures', async () => {
  const binding = [{ name: 'items', path: '$.data', shape: 'tabular.records' }]
  const success = await deliverAiClientToolResult({ data: [{ id: 1 }, { id: 2 }] }, {
    call: { id: 'call-inline-binding', toolName: 'records_read' },
    outputBindings: binding,
  }) as { outputBindings: Array<{ name: string; recordCount?: number; complete: boolean }> }
  assert.deepEqual(success.outputBindings, [{
    name: 'items', path: '$.data', shape: 'tabular.records', recordCount: 2, complete: true, truncated: false,
    requestSatisfied: true, exhaustive: true, displayTruncated: false,
  }])
  const failure = await deliverAiClientToolResult({ success: false, data: [{ id: 1 }] }, {
    call: { id: 'call-inline-failure', toolName: 'records_read' },
    outputBindings: binding,
  }) as { outputBindings?: unknown }
  assert.equal(failure.outputBindings, undefined)
})

test('record streams expose bounded sample and row-size failures structurally', async () => {
  const sample = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ id: 1 }, { id: 2 }, { id: 3 }]),
    schema: { type: 'object' },
    limits: { fallbackSampleLimit: 2 },
  }), {
    call: { id: 'call-sample-limit', toolName: 'records_read' },
    resultDelivery: 'inline',
  }) as { evidence: { recordCount: number; returnedCount: number; limitReason: string; truncated: boolean } }
  assert.equal(sample.evidence.recordCount, 2)
  assert.equal(sample.evidence.returnedCount, 2)
  assert.equal(sample.evidence.limitReason, 'sample')
  assert.equal(sample.evidence.truncated, true)

  const oversized = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ value: 'x'.repeat(2_000) }]),
    schema: { type: 'object' },
    limits: { maxRowBytes: 1_024 },
  }), {
    call: {
      id: 'call-row-limit',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
  }) as { evidence: { recordCount: number; limitReason: string; truncated: boolean } }
  assert.equal(oversized.evidence.recordCount, 0)
  assert.equal(oversized.evidence.limitReason, 'rowBytes')
  assert.equal(oversized.evidence.truncated, true)
})

test('record streams distinguish file unavailability and byte limits without losing their sample', async () => {
  const unavailable = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ id: 1 }]),
    schema: { type: 'object' },
  }), {
    call: { id: 'call-file-unavailable', toolName: 'records_read' },
    resultDelivery: 'auto',
  }) as any
  assert.equal(unavailable.data.fileUnavailable, true)
  assert.equal(unavailable.data.fileErrorCode, 'CLIENT_TOOL_FILE_UNAVAILABLE')
  assert.equal(unavailable.data.sample.length, 1)
  assert.equal(unavailable.evidence.complete, true)

  const payload = { value: 'x'.repeat(40_000) }
  const byteLimited = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([payload, payload]),
    schema: { type: 'object' },
    limits: { chunkBytes: 64 * 1024, maxBytes: 64 * 1024, maxRowBytes: 64 * 1024 },
  }), {
    call: {
      id: 'call-byte-limit',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
  }) as any
  assert.equal(byteLimited.evidence.recordCount, 1)
  assert.equal(byteLimited.evidence.limitReason, 'bytes')
  assert.equal(byteLimited.evidence.truncated, true)
  assert.ok(byteLimited.evidence.outputBindings[0].ref.startsWith('fs://'))
})

test('materialization URI failures degrade to a complete bounded inline result', async () => {
  const result = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([{ id: 1 }, { id: 2 }]),
    schema: { type: 'object' },
  }), {
    call: {
      id: 'call-uri-failure',
      toolName: 'records_read',
      sessionFiles: {
        toUri: () => { throw new Error('uri failed') },
        upload: async path => ({ ok: true, path }),
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
  }) as any
  assert.equal(result.data.fileErrorCode, 'CLIENT_TOOL_FILE_WRITE_FAILED')
  assert.equal(result.data.sample.length, 2)
  assert.equal(result.evidence.complete, true)
  assert.equal(result.evidence.outputBindings[0].path, '$.data.sample')
})

test('zero-record streams remain complete without creating or compensating a file', async () => {
  let uploads = 0
  let removals = 0
  let uriResolutions = 0
  const result = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource([]),
    schema: { type: 'object' },
  }), {
    call: {
      id: 'call-empty',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => {
          uriResolutions += 1
          return `fs://${path}`
        },
        upload: async path => {
          uploads += 1
          return { ok: true, path }
        },
        remove: async path => {
          removals += 1
          return { ok: true, path }
        },
      },
    },
    resultDelivery: 'file',
  }) as any
  assert.equal(result.status, 'empty')
  assert.equal(result.evidence.recordCount, 0)
  assert.equal(result.evidence.complete, true)
  assert.equal(result.data.delivery, 'inline-sample')
  assert.equal(result.data.fileUnavailable, false)
  assert.equal(result.data.fileErrorCode, undefined)
  assert.equal(result.producedFile, false)
  assert.deepEqual(result.data.sample, [])
  assert.equal(uploads, 0)
  assert.equal(removals, 0)
  assert.equal(uriResolutions, 0)
})

test('record source timeouts propagate cancellation and remain a partial result', async () => {
  let sourceCancelled = false
  const result = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: {
      consume: async (_consumer, context) => new Promise<void>((resolve, reject) => {
        const cancel = () => {
          sourceCancelled = true
          reject(new Error('source cancelled'))
        }
        if (context.signal.aborted) cancel()
        else context.signal.addEventListener('abort', cancel, { once: true })
      }),
    },
    schema: { type: 'object' },
    limits: { maxDurationMs: 1_000 },
  }), {
    call: { id: 'call-timeout', toolName: 'records_read' },
    resultDelivery: 'inline',
  }) as any
  assert.equal(sourceCancelled, true)
  assert.equal(result.evidence.limitReason, 'duration')
  assert.equal(result.evidence.complete, false)
  assert.equal(result.evidence.truncated, true)
})

test('10,000 records remain bounded and materialize within the performance gate', async () => {
  const records = Array.from({ length: 10_000 }, (_, index) => ({ index, value: `v-${index}` }))
  let uploadedBytes = 0
  const startedAt = performance.now()
  const result = await deliverAiClientToolResult(createAiClientToolRecordStream({
    source: createAiClientToolArrayRecordSource(records),
    schema: { type: 'object', properties: { index: { type: 'number', 'x-ai-role': 'number' } } },
    bindingName: 'records',
    outputShape: 'tabular.records',
  }), {
    call: {
      id: 'call-performance',
      toolName: 'records_read',
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async (path, body) => {
          uploadedBytes += body instanceof Blob ? body.size : new Blob([body]).size
          return { ok: true, path }
        },
        remove: async path => ({ ok: true, path }),
      },
    },
    resultDelivery: 'auto',
    bindingName: 'records',
    outputShape: 'tabular.records',
  }) as {
    evidence: { recordCount: number; returnedCount: number; complete: boolean }
  }
  const elapsedMs = performance.now() - startedAt
  assert.equal(result.evidence.recordCount, 10_000)
  assert.equal(result.evidence.returnedCount, 10_000)
  assert.equal(result.evidence.complete, true)
  assert.ok(uploadedBytes > 0 && uploadedBytes <= 8 * 1024 * 1024)
  assert.ok(elapsedMs < 2_000, `materialization took ${elapsedMs.toFixed(2)}ms`)
})

const declaredLargeSourceFixture = () => {
  const logicalSource = { records: Array.from({ length: 744 }, (_, index) => ({ id: `${index}-${'s'.repeat(100)}` })) }
  const binding = {
    name: 'rows', type: 'structured-data', audience: 'model-evidence' as const,
    path: '$.__clientToolOutputs.output0', recordPath: '$.records', shape: 'anonymous.rows',
    mediaType: 'application/json', fields: [{ name: 'id', type: 'string' as const, role: 'identifier' as const }],
    recordCount: 744, complete: true, truncated: false, completeness: 'complete' as const,
    exhaustive: true, requestSatisfied: true, displayTruncated: false,
    requestedRange: { start: 1, end: 745 }, observedRange: { start: 1, end: 744 },
    ordering: { keys: [{ field: 'id', direction: 'asc' as const }], producerGuaranteed: true },
  }
  const result = {
    success: true, complete: true, truncated: false,
    __clientToolOutputs: { output0: logicalSource, output1: { id: 'sibling' } },
    outputBindings: [binding],
    evidence: { outputBindings: [binding], cardinality: { kind: 'aggregate-series', bucketCount: 744, measurementCount: 9100, populatedBucketCount: 744 }, claims: [{ id: 'total', label: 'Total', value: 9100, visibility: 'user' }] },
  }
  const output = { name: binding.name, type: 'structured-data' as const, shape: binding.shape,
    mediaType: binding.mediaType, audience: binding.audience, delivery: 'auto' as const }
  return { logicalSource, binding, result, output }
}

test('declared JSON source backing replaces the exact carrier and preserves all source metadata', async () => {
  const { result, binding, logicalSource, output } = declaredLargeSourceFixture()
  let uploaded = ''
  const delivered = await deliverAiClientToolResult(result, {
    call: { id: 'nested-source', toolName: 'anonymous_nested_source', sessionFiles: {
      toUri: path => `fs://${path}`,
      upload: async (path, content) => { uploaded = String(content); return { ok: true, path } },
      remove: async path => ({ ok: true, path }),
    } },
    outputs: [output], replyMaxJsonLength: 64 * 1024,
  }) as any
  assert.deepEqual(JSON.parse(uploaded), logicalSource)
  assert.deepEqual(result.__clientToolOutputs.output0, logicalSource)
  assert.equal(delivered.__clientToolOutputs.output0, undefined)
  assert.deepEqual(delivered.__clientToolOutputs.output1, { id: 'sibling' })
  const { path: ignored, ...semanticBinding } = normalizeAiClientToolOutputBindings([binding])[0]
  const { ref, sourceDigest, sourceDigestProfile, ...deliveredSemantics } = delivered.outputBindings[0]
  assert.equal(sourceDigestProfile, 'bytes-v1')
  assert.deepEqual(deliveredSemantics, semanticBinding)
  assert.match(ref, /^fs:\/\//)
  const expectedDigest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(logicalSource)))
  assert.equal(sourceDigest, `sha256:${Array.from(new Uint8Array(expectedDigest), byte => byte.toString(16).padStart(2, '0')).join('')}`)
  assert.deepEqual(delivered.evidence.outputBindings, delivered.outputBindings)
  assert.deepEqual(delivered.evidence.cardinality, result.evidence.cardinality)
  assert.deepEqual(delivered.evidence.claims, result.evidence.claims)
  assert.equal(delivered.artifacts, undefined)
  assert.equal(delivered.producedFile, undefined)
})

test('explicit source backing preserves true truncated coverage and continuation without changing query facts', async () => {
  const { result, output } = declaredLargeSourceFixture()
  const continuation = { producerId: 'anonymous_source', capabilityId: 'anonymous.read', scopeDigest: 'scope', remainingScopeDigest: 'remaining', argument: 'cursor', value: 'next-page' }
  // Truncated results have no continuation; partial results retain the producer's declared continuation.
  for (const partial of [false, true]) {
    const binding = { ...result.outputBindings[0], complete: false, truncated: !partial,
      completeness: partial ? 'partial' : 'truncated', exhaustive: false, requestSatisfied: false,
      ...(partial ? { continuation } : {}) }
    const source = { ...result, complete: false, truncated: !partial,
      outputBindings: [binding], evidence: { ...result.evidence, outputBindings: [binding] } }
    const delivered = await deliverAiClientToolResult(source, {
      call: { id: 'partial-source', toolName: 'anonymous_source', sessionFiles: {
        toUri: path => `fs://${path}`, upload: async path => ({ ok: true, path }), remove: async path => ({ ok: true, path }),
      } }, outputs: [output], replyMaxJsonLength: 64 * 1024,
    }) as any
    assert.equal(delivered.complete, false)
    assert.equal(delivered.outputBindings[0].complete, false)
    assert.equal(delivered.outputBindings[0].exhaustive, false)
    assert.equal(delivered.outputBindings[0].completeness, partial ? 'partial' : 'truncated')
    assert.deepEqual(delivered.outputBindings[0].continuation, partial ? continuation : undefined)
    assert.match(delivered.outputBindings[0].ref, /^fs:\/\//)
  }
})

test('source backing remains unavailable for inline, ambiguous, untyped and guard-disabled outputs', async () => {
  const { result, binding, output } = declaredLargeSourceFixture()
  let uploads = 0
  const call = { id: 'no-file', toolName: 'anonymous_source', sessionFiles: {
    toUri: (path: string) => `fs://${path}`,
    upload: async (path: string) => { uploads += 1; return { ok: true, path } },
    remove: async (path: string) => ({ ok: true, path }),
  } }
  for (const overrides of [
    { outputs: [{ ...output, delivery: 'inline' as const }] },
    { outputs: undefined }, { outputs: [output, output] },
    { outputs: [{ ...output, shape: 'other.shape' }] },
    { replyMaxJsonLength: undefined }, { replyMaxJsonLength: 128 * 1024 },
  ]) {
    const delivered = await deliverAiClientToolResult(result, {
      call, outputs: [output], replyMaxJsonLength: 64 * 1024, ...overrides,
    }) as any
    assert.equal(delivered.outputBindings[0].ref, undefined)
  }
  for (const bindings of [
    [{ ...binding, fields: [] }], [{ ...binding, recordPath: '$.missing' }],
    [{ ...binding, path: '$' }], [binding, { ...binding, name: 'overlap' }],
    [{ ...binding, sourceDigest: `sha256:${'0'.repeat(64)}` }],
  ]) {
    await deliverAiClientToolResult({ ...result, outputBindings: bindings, evidence: {} }, {
      call, outputs: [output], replyMaxJsonLength: 64 * 1024,
    })
  }
  assert.equal(uploads, 0)
})

test('source backing failures and cancellation retain inline data and compensate partial uploads', async () => {
  const { result, output } = declaredLargeSourceFixture()
  for (const failure of ['unavailable', 'capability-error', 'rejected', 'error', 'wrong-ref', 'cancel'] as const) {
    const abort = new AbortController()
    let uploads = 0
    let removals = 0
    const operation = deliverAiClientToolResult(result, {
      call: { id: 'failure', toolName: 'anonymous_source', signal: abort.signal, sessionFiles: {
        capabilities: () => {
          if (failure === 'capability-error') throw new Error('unavailable')
          return { available: failure !== 'unavailable' }
        },
        toUri: path => `fs://${path}`,
        upload: async path => {
          uploads += 1
          if (failure === 'error') throw new Error('write failed')
          if (failure === 'cancel') abort.abort()
          return { ok: failure !== 'rejected', path, ...(failure === 'wrong-ref' ? { uri: 'fs://other/source.json' } : {}) }
        },
        remove: async path => { removals += 1; return { ok: true, path } },
      } }, outputs: [output], replyMaxJsonLength: 64 * 1024,
    })
    if (failure === 'cancel') {
      await assert.rejects(operation, { name: 'AbortError' })
    } else {
      const delivered = await operation as any
      assert.equal(delivered.outputBindings[0].ref, undefined)
      assert.deepEqual(delivered.__clientToolOutputs, result.__clientToolOutputs)
    }
    const attempted = failure !== 'unavailable' && failure !== 'capability-error'
    assert.equal(uploads, attempted ? 1 : 0)
    assert.equal(removals, attempted ? 1 : 0)
  }
})


test('declared source backing enforces source byte limits and does not grant unsupported presentation delivery', async () => {
  const { result, output, binding } = declaredLargeSourceFixture()
  let uploads = 0
  const call = { id: 'bounded-file', toolName: 'anonymous_source', sessionFiles: {
    toUri: (path: string) => `fs://${path}`,
    upload: async (path: string) => { uploads += 1; return { ok: true, path } },
    remove: async (path: string) => ({ ok: true, path }),
  } }
  const oversized = { ...result, __clientToolOutputs: { output0: { records: [{ id: 'x'.repeat(8 * 1024 * 1024) }] } } }
  const overflow = await deliverAiClientToolResult(oversized, { call, outputs: [output], replyMaxJsonLength: 65536 }) as any
  assert.equal(overflow.outputBindings[0].ref, undefined)
  const presentationBinding = { ...binding, audience: 'client-presentation' as const }
  await deliverAiClientToolResult({ ...result, outputBindings: [presentationBinding], evidence: {} }, {
    call, outputs: [{ ...output, audience: 'client-presentation' }], replyMaxJsonLength: 65536,
  })
  assert.equal(uploads, 0)
  const file = await deliverAiClientToolResult(result, {
    call, outputs: [{ ...output, delivery: 'file' }], replyMaxJsonLength: 65536,
  }) as any
  assert.equal(uploads, 1)
  assert.match(file.outputBindings[0].ref, /^fs:\/\//)
})


test('large declared source siblings use the same backing path beside a separately requested artifact', async () => {
  const { result, output, logicalSource } = declaredLargeSourceFixture()
  const uploads: string[] = []
  const delivered = await deliverAiClientToolResult({ ...result, data: createAiClientToolArtifact({
    content: 'document body', preview: { title: 'Document' }, mimeType: 'text/plain',
    bindingName: 'document', outputShape: 'anonymous.document',
  }) }, {
    call: { id: 'mixed-source', toolName: 'anonymous_source', sessionFiles: {
      toUri: path => `fs://${path}`,
      upload: async (path, content) => { uploads.push(String(content)); return { ok: true, path } },
      remove: async path => ({ ok: true, path }),
    } },
    outputs: [output, { name: 'document', type: 'artifact', shape: 'anonymous.document',
      mediaType: 'text/plain', audience: 'reusable-source', delivery: 'file' }],
    replyMaxJsonLength: 65536,
  }) as any
  assert.deepEqual(uploads, ['document body', JSON.stringify(logicalSource)])
  assert.equal(delivered.outputBindings.length, 2)
  assert.equal(delivered.outputBindings.filter((binding: any) => binding.name === 'rows').length, 1)
  assert.equal(delivered.outputBindings.find((binding: any) => binding.name === 'rows').path, undefined)
  assert.equal(delivered.evidence.artifacts.length, 1)
  assert.equal(delivered.__clientToolOutputs.output0, undefined)
})


test('external digest profiles survive normalization and unsupported or inline profiles fail closed', () => {
  const binding = { name: 'source', ref: 'fs://source.json', shape: 'anonymous.records', complete: true,
    sourceDigest: `sha256:${'a'.repeat(64)}`, sourceDigestProfile: 'bytes-v1' as const }
  assert.equal(normalizeAiClientToolOutputBindings([binding])[0]?.sourceDigestProfile, 'bytes-v1')
  const { sourceDigestProfile: ignored, ...legacy } = binding
  assert.equal(normalizeAiClientToolOutputBindings([legacy])[0]?.sourceDigestProfile, undefined)
  for (const profile of ['bytes-v2', '', null, undefined, {}, ' bytes-v1 ']) {
    assert.deepEqual(normalizeAiClientToolOutputBindings([{ ...binding, sourceDigestProfile: profile } as any]), [])
  }
  for (const source of [{ ref: '$.source' }, { ref: undefined, path: '$.source' }, { sourceDigest: undefined }]) {
    assert.deepEqual(normalizeAiClientToolOutputBindings([{ ...binding, ...source }]), [])
  }
})

test('a malformed explicit external profile cannot be replaced by a legacy static inline binding', async () => {
  for (const sourceDigestProfile of ['bytes-v2', null, undefined]) {
    const binding = { name: 'rows', ref: 'fs://source.json', shape: 'anonymous.records', complete: true,
      sourceDigest: `sha256:${'a'.repeat(64)}`, sourceDigestProfile }
    const delivered = await deliverAiClientToolResult({ data: [{ id: 1 }], outputBindings: [binding] }, {
      call: { id: 'unknown-profile', toolName: 'anonymous_bytes' },
      outputBindings: [{ name: 'rows', shape: 'anonymous.records', path: '$.data' }],
    }) as any
    assert.deepEqual(normalizeAiClientToolOutputBindings(delivered.outputBindings), [])
  }
})

test('real uploaded JSON and NDJSON bytes match the Java verifier fixture', async () => {
  const vectors: Array<Record<string, unknown>> = []
  const toText = async (body: ArrayBuffer | Blob | string) => typeof body === 'string'
    ? body : new TextDecoder().decode(body instanceof Blob ? await body.arrayBuffer() : body)
  const capture = (id: string) => {
    const chunks: string[] = []
    return {
      chunks,
      files: {
        toUri: (filePath: string) => `fs://${filePath}`,
        upload: async (filePath: string, body: ArrayBuffer | Blob | string) => {
          chunks.push(await toText(body))
          return { ok: true, path: filePath }
        },
        remove: async (filePath: string) => ({ ok: true, path: filePath }),
      },
      record: (result: any) => {
        const binding = normalizeAiClientToolOutputBindings(result.outputBindings)[0]
        assert.ok(binding?.ref?.startsWith('fs://'), id)
        assert.equal(binding.sourceDigestProfile, 'bytes-v1', id)
        const content = chunks.join('')
        assert.equal(binding.sourceDigest, `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`, id)
        const { path: ignoredPath, ref: ignoredRef, ...metadata } = binding
        vectors.push({ id, content, binding: { ...metadata, ref: `fs://source-digest/${id}` } })
      },
    }
  }
  const numericSource = { records: [{ value: 1e-7, large: 1e21, negative: -7, fraction: 0.01,
    negativeZero: -0, nested: { values: [1e-7, 1e21, -0], text: '中\\文\n"quoted"' } }] }
  const contents = [JSON.stringify(numericSource),
    '{\n  "records": [{"value": 1e-7, "large": 1e+21, "negativeZero": -0, "text": "\\u4e2d\\n\\\""}]\n}\n']
  for (const [index, content] of contents.entries()) {
    for (const carrier of ['string', 'blob', 'array-buffer'] as const) {
      const id = `artifact-${index}-${carrier}`
      const captured = capture(id)
      const artifact = createAiClientToolArtifact({
        content: carrier === 'string' ? content : carrier === 'blob'
          ? new Blob([content]) : new TextEncoder().encode(content).buffer,
        mimeType: 'application/json', preview: {}, outputShape: 'anonymous.records', bindingName: 'rows',
        modelSafeInline: JSON.parse(content), recordPath: '$.records',
        cardinality: { kind: 'record-set', returnedCount: 1, totalCount: 1, exhaustive: true },
      })
      const result = await deliverAiClientToolResult(artifact, {
        call: { id, toolName: 'anonymous_bytes', sessionFiles: captured.files },
        outputs: [{ name: 'rows', type: 'structured-data', shape: 'anonymous.records', mediaType: 'application/json',
          audience: 'reusable-source', delivery: 'file' }],
      })
      assert.equal(captured.chunks.join(''), content)
      captured.record(result)
      const fallback = await deliverAiClientToolResult(artifact, {
        call: { id: `${id}-inline`, toolName: 'anonymous_bytes' }, resultDelivery: 'inline',
      }) as any
      assert.equal(fallback.outputBindings?.[0]?.sourceDigestProfile, undefined)
    }
  }
  const fixture = declaredLargeSourceFixture()
  const rows = Array.from({ length: 744 }, (_, index) => ({ id: `${index}-${'s'.repeat(100)}`, value: 1e-7, large: 1e21 }))
  const source = { records: rows }
  const spilled = capture('structured-spill-744')
  const result = await deliverAiClientToolResult({ ...fixture.result, __clientToolOutputs: { output0: source } }, {
    call: { id: 'spill', toolName: 'anonymous_bytes', sessionFiles: spilled.files },
    outputs: [fixture.output], replyMaxJsonLength: 64 * 1024,
  })
  assert.ok(spilled.chunks.join('').length > 64 * 1024)
  assert.deepEqual(JSON.parse(spilled.chunks.join('')), source)
  spilled.record(result)
  for (const count of [0, 1, 3]) {
    const id = `ndjson-${count}`
    const captured = capture(id)
    const records = Array.from({ length: count }, (_, index) => ({ index, value: 1e-7, large: 1e21, negativeZero: -0 }))
    const result = await deliverAiClientToolResult(createAiClientToolRecordStream({
      source: createAiClientToolArrayRecordSource(records),
      schema: { type: 'object', properties: { value: { type: 'number', 'x-ai-role': 'number' } } },
      bindingName: 'rows', outputShape: 'anonymous.records',
    }), {
      call: { id, toolName: 'anonymous_bytes', sessionFiles: captured.files },
      outputs: [{ name: 'rows', type: 'structured-data', shape: 'anonymous.records', mediaType: 'application/x-ndjson',
        audience: 'reusable-source', delivery: 'file' }],
    })
    assert.equal(captured.chunks.join(''), records.map(record => `${JSON.stringify(record)}\n`).join(''))
    captured.record(result)
  }
  const packet = { contract: 'source-digest-profile-v2', vectors }
  const fixturePath = path.resolve(process.cwd(), '../../modules/jetlinks-ai-agent/ai-agent-general/src/test/resources/source-digest-bytes-v1.json')
  if (process.env.SOURCE_DIGEST_VECTOR_OUTPUT) {
    writeFileSync(process.env.SOURCE_DIGEST_VECTOR_OUTPUT, `${JSON.stringify(packet, null, 2)}\n`)
  }
  if (existsSync(fixturePath)) {
    assert.deepEqual(packet, JSON.parse(readFileSync(fixturePath, 'utf8')))
  } else {
    assert.ok(process.env.SOURCE_DIGEST_VECTOR_OUTPUT, 'Java verifier fixture must exist on normal test runs')
  }
})
