import {
  clientToolOutput,
  clientToolResult,
  defineClientTool,
  defineClientTools,
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

defineClientTool({
  ...validDefinition,
  // @ts-expect-error Routing is compiled from stable business facts and is not author-owned.
  routing: { stages: ['FETCH'] },
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
