import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  createAiClientToolContractOutputBinding,
  defineAiClientToolContract,
  isAiClientToolContractMetadata,
  withAiClientToolContractEvidence,
} from '../src/layout/components/AiChat/clientToolContract'
import { createAiClientToolCatalogReport } from '../src/layout/components/AiChat/clientToolCatalog'
import {
  toAiClientToolSessionDefinition,
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
import { withAiClientToolEvidence } from '../src/layout/components/AiChat/clientToolResult'
import {
  mergeAiClientToolParameterSchema,
} from '../src/layout/components/AiChat/clientToolParameterSchema'
import { resolveClientCapabilityLoaderToolId } from '../src/layout/components/AiChat/clientCapabilityLoader'
import {
  CLIENT_TOOL_DEFINITION_META_KEY,
  clientToolOutput,
  clientToolResult,
  defineClientTool,
  isCompiledClientToolDefinition,
} from '../src/layout/components/AiChat/clientToolDefinition'
import { aiClientToolRegistry } from '../src/layout/components/AiChat/clientToolRegistry'
import { createClientToolSnapshotController } from '../src/layout/components/AiChat/clientToolSnapshot'

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
    path: '$.data',
    delivery: 'auto',
    fields: [{ name: 'time', semanticRole: 'timestamp' }],
  }],
})

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
    consumes: [{ name: 'subject-property-id', optional: true, source: 'TOOL' }],
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

test('aggregate facade derives one renderer-ready source without rewriting category time labels', async () => {
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
        { name: 'label', semanticRole: 'category' },
        { name: 'value', semanticRole: 'number', format: 'percent' },
      ],
      select: (result) => {
        selections += 1
        return result.points
      },
    }),
    execute: () => clientToolResult.success({ points }, {
      requestedRange: { label: '24h' },
    }),
  })

  assert.deepEqual(tool.routing?.produces, [
    'online-rate-series',
    'online-rate-series-echarts-source',
  ])
  assert.deepEqual(tool.routing?.outputShapes, [
    'metric.time-series',
    'presentation.echarts-option',
  ])

  const prepared = await tool.execute({}, {}, { id: 'trend', toolName: tool.id }) as any
  assert.equal(selections, 1)
  assert.deepEqual(prepared.__clientToolOutputs.output0, points)
  assert.equal(prepared.data.kind, 'ai-client-tool-artifact/v1')

  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'trend', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any
  const option = delivered.data.presentationSource
  assert.equal(option.xAxis.type, 'category')
  assert.equal(option.yAxis.axisLabel.formatter, '{value}%')
  assert.deepEqual(option.dataset.source, [
    ['13:00', 0],
    ['14:00', 100],
  ])
  assert.equal(option.dataset.source[0][0], points[0].label)
  assert.equal(option.dataset.source[1][0], points[1].label)
  assert.deepEqual(delivered.outputBindings.map((binding: any) => ({
    name: binding.name,
    label: binding.label,
    mediaType: binding.mediaType,
  })), [
    {
      name: 'online-rate-series-echarts-source',
      label: 'Online rate',
      mediaType: 'application/vnd.echarts+json',
    },
    {
      name: 'online-rate-series',
      label: 'Online rate',
      mediaType: undefined,
    },
  ])
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
    execute: () => clientToolResult.success({ records }),
  })

  const prepared = await tool.execute({}, {}, { id: 'records', toolName: tool.id })
  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'records', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any

  assert.equal(delivered.outputBindings[0].name, 'labeled-records')
  assert.equal(delivered.outputBindings[0].label, 'Labeled records')
  assert.equal(delivered.outputBindings[0].path, '$.data.sample')
})

test('aggregate presentation preserves timestamps and declines ambiguous dynamic measures', async () => {
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
  const timestampDelivered = await deliverAiClientToolResult(timestampPrepared, {
    call: { id: 'timestamp', toolName: timestampTool.id },
    outputBindings: timestampTool._meta?.resultBindings,
  }) as any
  assert.equal(timestampDelivered.data.presentationSource.xAxis.type, 'time')
  assert.deepEqual(timestampDelivered.data.presentationSource.dataset.source, [
    [1_785_387_600_000, 12],
    [1_785_391_200_000, 18],
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

test('aggregate facade derives an ordered path from execution-specific coordinate semantics', async () => {
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
      select: (result: any) => result.points,
      resolveFields: () => fields,
    }),
    execute: () => ({ points }),
  })

  const prepared = await tool.execute({}, {}, { id: 'geo', toolName: tool.id }) as any
  assert.equal(prepared.data.kind, 'ai-client-tool-artifact/v1')
  assert.deepEqual(prepared.__clientToolOutputs.output0, points)
  assert.deepEqual(prepared.outputBindings[0].fields, fields)
  const delivered = await deliverAiClientToolResult(prepared, {
    call: { id: 'geo', toolName: tool.id },
    outputBindings: tool._meta?.resultBindings,
  }) as any
  const option = delivered.data.presentationSource
  assert.equal(option.series[0].type, 'line')
  assert.equal(option.xAxis.scale, true)
  assert.equal(option.yAxis.scale, true)
  assert.deepEqual(option.dataZoom, [
    { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
    { type: 'inside', yAxisIndex: 0, filterMode: 'none' },
  ])
  assert.deepEqual(option.toolbox.feature, {
    dataZoom: { xAxisIndex: 0, yAxisIndex: 0 },
    restore: {},
  })
  assert.deepEqual(option.dataset.source, [
    [120.1, 30.1, 1_735_660_800_000],
    [121.2, 31.2, 1_735_664_400_000],
  ])
  assert.deepEqual(option.series[0].encode, {
    x: 'position_longitude',
    y: 'position_latitude',
    tooltip: ['time', 'position_longitude', 'position_latitude'],
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
    'modules/vision-ui/agentCapabilities/aiSearch/tools.ts',
    'modules/iot-ui/agentCapabilities/deviceAnalysis/tools.ts',
  ]
  migratedFiles.filter(relativePath => existsSync(path.join(workspaceRoot, relativePath))).forEach((relativePath) => {
    const source = readFileSync(path.join(workspaceRoot, relativePath), 'utf8')
    assert.match(source, /clientToolApi/)
    assert.doesNotMatch(source, /AiChat\/clientTools['"]/)
    assert.doesNotMatch(source, /clientTool(?:Routing|Contract|ResultDelivery|BindingPath)['"]/)
  })

  const retainedLegacyImports = new Set([
    'modules/iot-ui/agentCapabilities/deviceAnalysis/deviceProperty.service.ts',
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
  assert.deepEqual(contract.routing.produces, ['series'])
  assert.deepEqual(contract.routing.outputShapes, ['time-series.aggregate'])
  assert.deepEqual(contract.routing.resultDeliveries, ['auto'])
  assert.deepEqual(contract._meta.resultBindings, [{
    name: 'series',
    path: '$.data',
    shape: 'time-series.aggregate',
    fields: [{ name: 'time', semanticRole: 'timestamp' }],
  }])

  const result = withAiClientToolContractEvidence({ data: [{ time: 1 }] }, contract, {
    complete: true,
    truncated: false,
    outputs: [{ name: 'series', complete: true, path: '$.data' }],
  })
  assert.equal(result.evidence.outputBindings?.[0]?.name, 'series')
  assert.equal(result.evidence.outputBindings?.[0]?.shape, 'time-series.aggregate')
})

test('materialized references never reuse a physical file path as JSONPath', () => {
  const binding = createAiClientToolContractOutputBinding(createSeriesContract(), {
    name: 'series',
    ref: 'fs://generated/series.ndjson',
    path: 'generated/series.ndjson',
    recordPath: '$.results',
    complete: true,
  })
  assert.equal(binding.ref, 'fs://generated/series.ndjson')
  assert.equal(binding.path, undefined)
  assert.equal(binding.recordPath, '$.results')
  assert.throws(() => createAiClientToolContractOutputBinding(createSeriesContract(), {
    name: 'series',
    path: '$..data',
    complete: true,
  }), /Unsupported client tool execution binding path/)
  assert.throws(() => createAiClientToolContractOutputBinding(createSeriesContract(), {
    name: 'series',
    ref: 'fs://generated/series.json',
    recordPath: '$.*',
    complete: true,
  }), /Unsupported client tool record path/)
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
      { kind: 'record-set', name: 'records', shape: 'records', path: '$.data' },
      { kind: 'record-set', name: 'records', shape: 'records', path: '$.other' },
    ],
  }), /Duplicate client tool output binding/)
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.records.read'] },
    outputs: [{ kind: 'record-set', name: 'records', shape: 'records', path: '$.data', delivery: 'file' }],
  }), /must not declare an inline binding path/)
  assert.throws(() => defineAiClientToolContract({
    routingKind: 'artifact',
    routing: { capabilities: ['test.artifact.create'] },
    outputs: [{ kind: 'artifact', name: 'artifact', shape: 'document', mediaType: '' }],
  }), /requires a media type/)
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
    outputs: [{ kind: 'artifact', name: 'document', shape: 'document.pdf', mediaType: 'application/pdf' }],
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
      content: '{}',
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
    content: '{}',
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

test('browser-only contract and binding metadata never enters the session tool declaration', () => {
  const sessionDefinition = toAiClientToolSessionDefinition({
    id: 'series_read',
    description: 'read a bounded series',
    inputs: [],
    output: { type: 'object' },
    ...createSeriesContract(),
  })
  const serialized = JSON.stringify(sessionDefinition)
  assert.equal(serialized.includes('clientToolContract'), false)
  assert.equal(serialized.includes('resultBindings'), false)
  assert.equal(serialized.includes('x-ai-routing'), true)
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

test('catalog diagnoses contract drift without rejecting repeated output shapes', () => {
  const repeatedShape = defineAiClientToolContract({
    routingKind: 'records',
    routing: { capabilities: ['test.records.read'] },
    outputs: [
      { kind: 'record-set', name: 'left', shape: 'tabular.records', path: '$.left' },
      { kind: 'record-set', name: 'right', shape: 'tabular.records', path: '$.right' },
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
        { name: '', semanticRole: 'number' },
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
  assert.equal(result.data.delivery, 'empty')
  assert.equal(result.data.fileUnavailable, undefined)
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
