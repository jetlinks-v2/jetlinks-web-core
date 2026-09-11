import assert from 'node:assert/strict'
import test from 'node:test'
import { selectDomainAgentScopeCandidate } from '../src/layout/components/AiChat/clientToolScope'
import { createHash } from 'node:crypto'
import { createAiClientToolArtifact } from '../src/layout/components/AiChat/clientToolResultDelivery'
import {
  clientToolOutput,
  clientToolResult,
  defineClientTool,
} from '../src/layout/components/AiChat/clientToolDefinition'
import { generalAgentExtensionRegistry } from '../src/layout/components/AiChat/generalAgentExtensions'
import {
  loadGeneralAgentExtensions,
  unloadGeneralAgentExtensions,
} from '../src/layout/components/AiChat/routeCapabilityLoader'
import {
  createAiClientToolRuntime,
  defineAiClientToolFactory,
  defineAiClientToolResultBindings,
  guardAiClientToolResult,
} from '../src/layout/components/AiChat/clientTools'
import { normalizeClientSkillBindingContribution } from '../src/layout/components/AiChat/clientSkillBindings'
import { readHomeAgentProviderContribution } from '../src/layout/components/AiChat/homeAgentShared'
import { moduleRegistry } from '../src/utils/module-registry'

const collectObjectKeys = (value: unknown, result = new Set<string>()) => {
  if (!value || typeof value !== 'object') return result
  if (Array.isArray(value)) {
    value.forEach(item => collectObjectKeys(item, result))
    return result
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    result.add(key)
    collectObjectKeys(item, result)
  })
  return result
}

test('result bindings inherit canonical multi-output ports while legacy metadata keeps its authoring semantics', () => {
  const bindings = defineAiClientToolResultBindings({
    produces: ['resolved-identifiers', 'aggregate-summary'],
    outputShapes: ['legacy.identifiers', 'legacy.aggregate'],
    producerPorts: [
      {
        name: 'resolved-identifiers',
        type: 'structured-data',
        mediaType: 'application/vnd.example.identifiers+json',
        shape: 'example.identifier-set',
        audience: 'reusable-source',
      },
      {
        name: 'aggregate-summary',
        type: 'structured-data',
        mediaType: 'application/vnd.example.aggregate+json',
        shape: 'example.aggregate-summary',
      },
    ],
  }, {
    'resolved-identifiers': '$.data[*].id',
    'aggregate-summary': '$.aggregates.total',
  }, {
    'resolved-identifiers': {
      type: 'artifact',
      mediaType: 'text/plain',
      audience: 'client-presentation',
      label: 'Resolved identifiers',
      fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    },
    'aggregate-summary': {
      type: 'artifact',
      mediaType: 'text/plain',
      audience: 'client-presentation',
      label: 'Aggregate summary',
      ordering: { keys: [{ field: 'bucket', direction: 'asc' }], producerGuaranteed: true },
    },
  })

  assert.deepEqual(bindings, [
    {
      name: 'resolved-identifiers',
      type: 'structured-data',
      path: '$.data[*].id',
      shape: 'example.identifier-set',
      mediaType: 'application/vnd.example.identifiers+json',
      audience: 'reusable-source',
      label: 'Resolved identifiers',
      fields: [{ name: 'id', type: 'string', role: 'identifier' }],
    },
    {
      name: 'aggregate-summary',
      type: 'structured-data',
      path: '$.aggregates.total',
      shape: 'example.aggregate-summary',
      mediaType: 'application/vnd.example.aggregate+json',
      label: 'Aggregate summary',
      ordering: { keys: [{ field: 'bucket', direction: 'asc' }], producerGuaranteed: true },
    },
  ])

  assert.deepEqual(defineAiClientToolResultBindings({
    produces: ['legacy-summary'],
    outputShapes: ['legacy.summary'],
  }, {
    'legacy-summary': '$.summary',
  }, {
    'legacy-summary': {
      type: 'artifact',
      mediaType: 'text/plain',
      audience: 'client-presentation',
      label: 'Legacy summary',
    },
  }), [{
    name: 'legacy-summary',
    path: '$.summary',
    shape: 'legacy.summary',
    type: 'artifact',
    mediaType: 'text/plain',
    audience: 'client-presentation',
    label: 'Legacy summary',
  }])
})

test('64 KiB result guard fails closed without an exact ref and preserves exact materialized bindings', () => {
  const maxJsonLength = 64 * 1024
  const preview = 'x'.repeat(maxJsonLength + 1024)
  const inlineBinding = {
    name: 'bounded-records',
    path: '$.data',
    shape: 'generic.records',
    complete: true,
    completeness: 'complete',
  }
  const oversizedInline = guardAiClientToolResult({
    success: true,
    status: 'ok',
    complete: true,
    truncated: false,
    data: { preview },
    evidence: {
      complete: true,
      truncated: false,
      completeness: 'complete',
      outputBindings: [inlineBinding],
    },
    outputBindings: [inlineBinding],
  }, { maxJsonLength }, 'anonymous_inline') as any

  assert.equal(oversizedInline.complete, false)
  assert.equal(oversizedInline.truncated, true)
  assert.equal(oversizedInline.status, 'partial')
  assert.equal(oversizedInline.meta.reason, 'client_tool_result_too_large')
  assert.equal(oversizedInline.evidence.complete, false)
  assert.equal(oversizedInline.evidence.truncated, true)
  assert.equal(oversizedInline.evidence.limitReason, 'client_tool_result_too_large')
  assert.equal(oversizedInline.outputBindings[0].complete, false)
  assert.equal(oversizedInline.outputBindings[0].truncated, true)
  assert.equal(oversizedInline.outputBindings[0].ref, undefined)

  const exactBinding = {
    name: 'bounded-records',
    ref: 'materialized:anonymous:bounded-records:sha256',
    shape: 'generic.records',
    complete: true,
    completeness: 'complete',
  }
  const oversizedExact = guardAiClientToolResult({
    success: true,
    status: 'ok',
    complete: true,
    truncated: false,
    data: { preview },
    evidence: {
      complete: true,
      truncated: false,
      completeness: 'complete',
      outputBindings: [exactBinding],
    },
    outputBindings: [exactBinding],
  }, { maxJsonLength }, 'anonymous_materialized') as any

  assert.equal(oversizedExact.complete, true)
  assert.equal(oversizedExact.truncated, false)
  assert.equal(oversizedExact.status, 'ok')
  assert.equal(oversizedExact.meta.reason, 'client_tool_result_too_large')
  assert.equal(oversizedExact.evidence.complete, true)
  assert.equal(oversizedExact.evidence.truncated, false)
  assert.equal(oversizedExact.evidence.limitReason, undefined)
  assert.equal(oversizedExact.outputBindings[0].ref, exactBinding.ref)
  assert.equal(oversizedExact.outputBindings[0].complete, true)
  assert.equal(oversizedExact.outputBindings[0].truncated, undefined)
})

test('runtime backs a 744-row explicit-auto aggregate before the unchanged effective reply guard', async () => {
  const records = Array.from({ length: 744 }, (_, index) => ({
    id: `${index}-${'x'.repeat(100)}`,
    value: index,
  }))
  const cardinality = { kind: 'aggregate-series' as const, bucketCount: 744, populatedBucketCount: 744, measurementCount: 9123 }
  let producerCalls = 0
  let uploads = 0
  let source = ''
  const tool = defineClientTool({
    id: 'anonymous_complete_aggregate',
    description: { text: 'Read anonymous aggregate records', capabilities: ['anonymous.aggregate.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'series', shape: 'anonymous.aggregate', audience: 'model-evidence', delivery: 'auto',
      recordPath: '$', fields: [{ name: 'id', type: 'string', role: 'identifier' }],
      ordering: { keys: [{ field: 'id', direction: 'asc' }], producerGuaranteed: true },
    }),
    execute: () => {
      producerCalls += 1
      return clientToolResult.success(records, {
        cardinality, requestedRange: { start: 1, end: 745 }, observedRange: { start: 1, end: 744 },
      })
    },
  })
  const runtime = createAiClientToolRuntime([tool], {
    includeHelpTool: false,
    resultGuard: { maxJsonLength: 64 * 1024, maxArrayLength: 30, maxObjectKeys: 64 },
  })
  try {
    const reply = await runtime.handleClientToolCall({
      id: 'one-execution', toolName: tool.id,
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async (path, content) => {
          uploads += 1
          source = String(content)
          return { ok: true, path }
        },
        remove: async path => ({ ok: true, path }),
      },
    }) as any
    assert.equal(producerCalls, 1)
    assert.equal(uploads, 1)
    assert.ok(source.length > 64 * 1024)
    assert.deepEqual(JSON.parse(source), records)
    assert.ok(JSON.stringify(reply).length < 64 * 1024)
    assert.equal(reply.complete, true)
    assert.equal(reply.truncated, false)
    assert.equal(reply.meta, undefined)
    assert.equal(reply.outputBindings.length, 1)
    assert.equal(reply.outputBindings[0].recordCount, 744)
    assert.equal(reply.outputBindings[0].recordPath, '$')
    assert.equal(reply.outputBindings[0].audience, 'model-evidence')
    assert.match(reply.outputBindings[0].ref, /^fs:\/\//)
    assert.equal(reply.outputBindings[0].path, undefined)
    assert.deepEqual(reply.evidence.cardinality, cardinality)
    assert.deepEqual(reply.outputBindings[0].ordering, {
      keys: [{ field: 'id', direction: 'asc' }], producerGuaranteed: true,
    })
    assert.equal(reply.__clientToolOutputs.output0, undefined)
    assert.equal(reply.producedFile, undefined)
    assert.equal(reply.artifacts, undefined)
  } finally {
    runtime.dispose()
  }
})

test('runtime preserves promoted native proof while the reply guard still downgrades inline siblings', async () => {
  const source = { records: [{ id: 'one', description: 'x'.repeat(38 * 1024) }] }
  const content = JSON.stringify(source)
  const mediaType = 'application/vnd.example.budget-native+json'
  const shape = 'example.budget-native'
  let producerCalls = 0
  let uploads = 0
  const tool = defineClientTool({
    id: 'anonymous_budget_native',
    description: { text: 'Read anonymous bounded native data', capabilities: ['example.budget.read'] },
    effect: { kind: 'READ' },
    output: [
      clientToolOutput.recordSet({
        name: 'native', type: 'presentation', shape, mediaType, audience: 'client-presentation', delivery: 'auto',
        recordPath: '$.records', fields: [{ name: 'id', type: 'string', role: 'identifier' }],
        select: (result: any) => result.data,
      }),
      clientToolOutput.detail({
        name: 'model-info', shape: 'example.model-info', mediaType: 'application/json',
        audience: 'model-evidence', delivery: 'inline', select: (result: any) => result.smallEvidence,
      }),
    ],
    execute: () => {
      producerCalls += 1
      return clientToolResult.success({
        // Only declared output selections survive the authoring adapter. This sibling keeps
        // the actual runtime envelope over budget even after the native carrier is promoted.
        smallEvidence: { id: 'model-only', explanation: 'e'.repeat(70 * 1024) },
        data: createAiClientToolArtifact({
          content, modelSafeInline: source, mimeType: mediaType, fileExtension: 'json',
          bindingName: 'native', outputShape: shape, recordPath: '$.records',
          preview: { returnedCount: 1 }, complete: true, exhaustive: false,
        }),
      }, { requestSatisfied: true, exhaustive: false })
    },
  })
  const runtime = createAiClientToolRuntime([tool], {
    includeHelpTool: false, resultGuard: { maxJsonLength: 64 * 1024 },
  })
  try {
    const reply = await runtime.handleClientToolCall({
      id: 'one-call', toolName: tool.id,
      presentationCapabilities: [{ type: 'anonymous-view', contentType: 'json', mediaType,
        supportsSessionFile: true, maxInlineBytes: 64 * 1024, defaultMode: 'preview',
        purpose: 'conversation-preview', preferredInputShapes: [shape], deliveryPolicy: 'required' }],
      sessionFiles: {
        toUri: path => `fs://${path}`,
        upload: async (path, value) => {
          uploads += 1
          assert.equal(String(value), content)
          return { ok: true, path }
        },
        remove: async path => ({ ok: true, path }),
      },
    }) as any
    assert.equal(producerCalls, 1)
    assert.equal(uploads, 1)
    assert.equal(reply.meta.reason, 'client_tool_result_too_large')
    const native = reply.outputBindings.find((binding: any) => binding.name === 'native')
    const model = reply.outputBindings.find((binding: any) => binding.name === 'model-info')
    assert.ok(native)
    assert.equal(native.type, 'presentation')
    assert.equal(native.complete, true)
    assert.equal(native.truncated, false)
    assert.equal(native.exhaustive, false)
    assert.match(native.ref, /^fs:\/\//)
    assert.equal(native.sourceDigest, `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`)
    assert.equal(native.sourceDigestProfile, 'bytes-v1')
    assert.ok(model)
    assert.equal(model.audience, 'model-evidence')
    assert.equal(model.ref, undefined)
    assert.equal(model.complete, false)
    assert.equal(model.truncated, true)
    assert.equal(reply.complete, false)
    assert.equal(reply.truncated, true)
  } finally {
    runtime.dispose()
  }
})

test('route-specific extension loading consumes explicit activation manifests without path inference', async () => {
  const moduleId = `activation-contract-${Date.now()}`
  let malformedLoads = 0
  let legacyLoads = 0
  moduleRegistry.register(moduleId, {
    generalAgentExtensions: {
      'opaque-primary': {
        loader: async () => ({
          generalAgentExtension: { id: 'activation-contract-primary' },
        }),
        activation: {
          version: 'general-agent-provider-activation/v1',
          scopes: [{ kind: 'path', values: ['reports/overview'] }],
        },
      },
      'opaque-sibling': {
        loader: async () => ({
          generalAgentExtension: { id: 'activation-contract-sibling' },
        }),
        activation: {
          scopes: [{ values: ['inventory/assets'], kind: 'menuCode' }],
          version: 'general-agent-provider-activation/v1',
        },
      },
      'opaque-malformed': {
        loader: async () => {
          malformedLoads += 1
          return { generalAgentExtension: { id: 'activation-contract-malformed' } }
        },
        activation: {
          version: 'unknown-version',
          scopes: [{ kind: 'path', values: ['reports/overview'] }],
        },
      },
      // A legacy key that resembles the route is deliberately not an activation declaration.
      'reports/overview': async () => {
        legacyLoads += 1
        return { generalAgentExtension: { id: 'activation-contract-legacy' } }
      },
    },
  } as any)

  try {
    const primary = await loadGeneralAgentExtensions({ path: '#/reports/overview/' }) as any
    assert.equal(primary.matched, 1)
    assert.equal(primary.attempted, 1)
    assert.equal(primary.total, 1)
    assert.equal(primary.loaded.length, 1)
    assert.equal(primary.rejected.length, 1)
    assert.deepEqual(
      generalAgentExtensionRegistry.getExtensions('general').map(item => item.id),
      ['activation-contract-primary'],
    )

    const sibling = await loadGeneralAgentExtensions({ menuCode: '/inventory/assets' }) as any
    assert.equal(sibling.matched, 1)
    assert.equal(sibling.attempted, 1)
    assert.equal(sibling.loaded.length, 1)
    assert.deepEqual(
      generalAgentExtensionRegistry.getExtensions('general').map(item => item.id).sort(),
      ['activation-contract-primary', 'activation-contract-sibling'],
    )
    assert.equal(malformedLoads, 0)
    assert.equal(legacyLoads, 0)

    const noMatch = await loadGeneralAgentExtensions({ routeName: 'unrelated-route' }) as any
    assert.equal(noMatch.matched, 0)
    assert.equal(noMatch.attempted, 0)
    assert.equal(noMatch.total, 0)
    assert.deepEqual(noMatch.loaded, [])
    assert.deepEqual(noMatch.skipped, [])
  } finally {
    unloadGeneralAgentExtensions()
    moduleRegistry.unregister(moduleId)
  }
})

test('client tool help exposes a bounded catalog and continuable single-tool pages inline', async () => {
  const sourceTools = Array.from({ length: 40 }, (_, index) => defineClientTool({
    id: `bounded_help_tool_${String(index).padStart(2, '0')}`,
    description: {
      text: `Bounded help tool ${index}`,
      capabilities: [`bounded.help.${index}`],
      help: index === 0
        ? `## Overview\n${'A'.repeat(1400)}\n## Details\n${'B'.repeat(1400)}`
        : `Help ${index} ${'C'.repeat(240)}`,
    },
    inputs: [],
    effect: { kind: 'READ' },
    output: clientToolOutput.lookup({
      name: `bounded-help-${index}`,
      shape: 'bounded.help',
    }),
    execute: () => ({}),
  }))
  const runtime = createAiClientToolRuntime(sourceTools)
  let uploadCalls = 0
  const sessionFiles = {
    toUri: (path: string) => `session-file://${path}`,
    upload: async () => {
      uploadCalls += 1
      return {}
    },
    remove: async () => ({}),
  }

  try {
    const helpDefinition = runtime.clientTools.find(tool => tool.id === 'client_tool_help') as any
    assert.deepEqual(
      helpDefinition.inputs.map((input: Record<string, unknown>) => input.name),
      ['toolName', 'section', 'query', 'offset', 'limit'],
    )

    const catalog = await runtime.handleClientToolCall({
      id: 'bounded-help-catalog',
      toolName: 'client_tool_help',
      arguments: {},
      sessionFiles,
    }) as any
    assert.equal(catalog.mode, 'catalog')
    assert.ok(catalog.items.length <= 12)
    assert.equal(catalog.truncated, true)
    assert.equal(catalog.complete, false)
    assert.equal(catalog.nextOffset, catalog.items.length)
    assert.ok(catalog.help.length <= 4096)

    const first = await runtime.handleClientToolCall({
      id: 'bounded-help-first-page',
      toolName: 'client_tool_help',
      arguments: { toolName: 'bounded_help_tool_00', section: 'Overview', offset: 0, limit: 256 },
      sessionFiles,
    }) as any
    assert.equal(first.mode, 'tool')
    assert.equal(first.help.length, 256)
    assert.equal(first.offset, 0)
    assert.equal(first.nextOffset, 256)
    assert.equal(first.truncated, true)

    const second = await runtime.handleClientToolCall({
      id: 'bounded-help-second-page',
      toolName: 'client_tool_help',
      arguments: {
        toolName: 'bounded_help_tool_00',
        section: 'Overview',
        offset: first.nextOffset,
        limit: 256,
      },
      sessionFiles,
    }) as any
    assert.equal(second.offset, first.nextOffset)
    assert.notEqual(second.help, first.help)

    const resultKeys = collectObjectKeys({ catalog, first, second })
    for (const forbidden of [
      'artifact', 'artifacts', 'dataset', 'datasets', 'durable', 'fileRef', 'fileName',
      'producedFile', 'resource', 'uri', 'contentRef', 'ref',
    ]) {
      assert.equal(resultKeys.has(forbidden), false, forbidden)
    }
    for (const result of [catalog, first, second]) {
      assert.ok(result.outputBindings.every((binding: Record<string, unknown>) => binding.path === '$.help'))
    }
    assert.equal(uploadCalls, 0)
  } finally {
    runtime.dispose()
  }
})

test('prepared client-tool actions validate before confirmation and execute normalized arguments', async () => {
  const lifecycle: string[] = []
  const confirmationRequests: any[] = []
  const tool = defineClientTool<{ subjectId?: string }, Record<string, unknown>, { opened: boolean }>({
    id: 'test_prepared_action',
    description: { text: 'Open a validated subject', capabilities: ['test.subject.open'] },
    inputs: [{ id: 'subjectId', required: true, valueType: 'string' }],
    effect: {
      kind: 'EXTERNAL_ACTION',
      idempotency: 'IDEMPOTENT',
      reversible: true,
      confirmation: { title: 'Fallback title', content: 'Fallback content' },
    },
    output: clientToolOutput.stateChange({
      name: 'navigation-receipt',
      shape: 'navigation.receipt',
      transition: 'NAVIGATION',
    }),
    prepare: (args) => {
      lifecycle.push('prepare')
      const subjectId = String(args.subjectId || '').trim().toUpperCase()
      if (!subjectId) {
        return clientToolResult.failure({
          code: 'SUBJECT_ID_REQUIRED',
          message: 'Subject id is required',
          failureDisposition: 'request',
          recoveryAction: 'repair',
          retryable: true,
        })
      }
      return {
        arguments: { subjectId },
        confirmation: { title: 'Open subject', content: `Open ${subjectId}?` },
      }
    },
    execute: (args) => {
      lifecycle.push(`execute:${args.subjectId}`)
      return { opened: true }
    },
  })
  const runtime = createAiClientToolRuntime([tool], { includeHelpTool: false })

  const result = await runtime.handleClientToolCall({
    id: 'prepared-call',
    toolName: tool.id,
    arguments: { subjectId: ' alpha-01 ' },
    requestConfirmation: (request) => {
      lifecycle.push('confirm')
      confirmationRequests.push(request)
      return { approved: true }
    },
  }) as any

  assert.deepEqual(lifecycle, ['prepare', 'confirm', 'execute:ALPHA-01'])
  assert.equal(confirmationRequests[0].title, 'Open subject')
  assert.equal(confirmationRequests[0].content, 'Open ALPHA-01?')
  assert.deepEqual(confirmationRequests[0].arguments, { subjectId: 'ALPHA-01' })
  assert.equal(confirmationRequests[0].allowArgumentEdits, false)
  assert.equal(result.success, true)
  runtime.dispose()
})

test('prepared client-tool failures and rejections never execute the side effect', async () => {
  let confirmations = 0
  let executions = 0
  const tool = defineClientTool<{ target?: string }>({
    id: 'test_prepared_action_failure',
    description: { text: 'Run a validated action', capabilities: ['test.action.run'] },
    effect: {
      kind: 'WRITE',
      idempotency: 'IDEMPOTENT',
      reversible: true,
      confirmation: {},
    },
    output: clientToolOutput.stateChange({
      name: 'mutation-receipt',
      shape: 'mutation.receipt',
      transition: 'MUTATION',
    }),
    prepare: (args) => args.target
      ? { arguments: { target: String(args.target) } }
      : clientToolResult.failure({
          code: 'TARGET_REQUIRED',
          message: 'Target is required',
          failureDisposition: 'request',
          recoveryAction: 'repair',
          retryable: true,
        }),
    execute: () => {
      executions += 1
      return { updated: true }
    },
  })
  const runtime = createAiClientToolRuntime([tool], { includeHelpTool: false })
  const requestConfirmation = () => {
    confirmations += 1
    return { approved: false }
  }

  const invalid = await runtime.handleClientToolCall({
    id: 'invalid-prepare',
    toolName: tool.id,
    arguments: {},
    requestConfirmation,
  }) as any
  assert.equal(invalid.success, false)
  assert.equal(invalid.code, 'TARGET_REQUIRED')
  assert.equal(confirmations, 0)
  assert.equal(executions, 0)

  const rejected = await runtime.handleClientToolCall({
    id: 'rejected-prepare',
    toolName: tool.id,
    arguments: { target: 'one' },
    requestConfirmation,
  }) as any
  assert.equal(rejected.success, false)
  assert.equal(rejected.status, 'rejected')
  assert.equal(confirmations, 1)
  assert.equal(executions, 0)
  runtime.dispose()
})

test('client-tool failures expose whether external execution started', async () => {
  let executions = 0
  const tool = defineClientTool({
    id: 'test_effect_execution_boundary',
    description: { text: 'Run an effect after confirmation', capabilities: ['test.effect.run'] },
    effect: {
      kind: 'WRITE',
      idempotency: 'IDEMPOTENT',
      reversible: true,
      confirmation: {},
    },
    output: clientToolOutput.stateChange({
      name: 'effect-receipt',
      shape: 'effect.receipt',
      transition: 'MUTATION',
    }),
    execute: () => {
      executions += 1
      const error = new Error('execution failed after entering the effect boundary') as Error & { code: string }
      error.code = 'TEST_EFFECT_EXECUTION_FAILED'
      throw error
    },
  })
  const runtime = createAiClientToolRuntime([tool], { includeHelpTool: false })

  const beforeExecution = await runtime.handleClientToolCall({
    id: 'missing-confirmation-handler',
    toolName: tool.id,
  }) as any
  assert.equal(beforeExecution.success, false)
  assert.equal(beforeExecution.code, 'CLIENT_TOOL_CONFIRM_HANDLER_UNAVAILABLE')
  assert.equal(beforeExecution.effectState, 'not-started')
  assert.equal(executions, 0)

  const afterExecutionStarted = await runtime.handleClientToolCall({
    id: 'execution-window-failure',
    toolName: tool.id,
    requestConfirmation: () => ({ approved: true }),
  }) as any
  assert.equal(afterExecutionStarted.success, false)
  assert.equal(afterExecutionStarted.code, 'TEST_EFFECT_EXECUTION_FAILED')
  assert.equal(afterExecutionStarted.effectState, undefined)
  assert.equal(executions, 1)
  runtime.dispose()
})

test('runtime keeps the prepared tool snapshot stable until confirmation and execution finish', async () => {
  let handlerVersion = 1
  let approve: (() => void) | undefined
  const executions: number[] = []
  const createTool = (version: number) => defineClientTool({
    id: 'test_prepared_snapshot',
    description: { text: 'Run a snapshotted action', capabilities: ['test.snapshot.run'] },
    effect: {
      kind: 'WRITE',
      idempotency: 'IDEMPOTENT',
      reversible: true,
      confirmation: {},
    },
    output: clientToolOutput.stateChange({
      name: 'snapshot-receipt',
      shape: 'snapshot.receipt',
      transition: 'MUTATION',
    }),
    prepare: (args: Record<string, unknown>) => ({ arguments: args }),
    execute: () => {
      executions.push(version)
      return { version }
    },
  })
  const runtime = createAiClientToolRuntime(() => [createTool(handlerVersion)], { includeHelpTool: false })
  const firstCall = runtime.handleClientToolCall({
    id: 'snapshot-first',
    toolName: 'test_prepared_snapshot',
    requestConfirmation: () => new Promise(resolve => {
      approve = () => resolve({ approved: true })
    }),
  })

  for (let index = 0; index < 10 && !approve; index += 1) {
    await Promise.resolve()
  }
  assert.ok(approve)
  handlerVersion = 2
  runtime.refreshClientTools()
  approve?.()
  await firstCall

  await runtime.handleClientToolCall({
    id: 'snapshot-second',
    toolName: 'test_prepared_snapshot',
    requestConfirmation: () => ({ approved: true }),
  })
  assert.deepEqual(executions, [1, 2])
  runtime.dispose()
})

test('runtime quarantines an unprojectable tool from both declaration and execution views', async () => {
  const healthy = {
    id: 'test_catalog_healthy',
    description: 'Healthy tool',
    execute: () => ({ ok: true }),
  }
  const malformed = {
    id: 'test_catalog_malformed',
    description: 'Malformed tool',
    parameterSchema: { type: 'object' as const },
    expands: { _schema: { type: 'object' } },
    execute: () => ({ ok: true }),
  }
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const runtime = createAiClientToolRuntime([healthy, malformed], { includeHelpTool: false })
    assert.deepEqual(runtime.clientTools.map(tool => tool.name), ['test_catalog_healthy'])
    await assert.rejects(
      runtime.handleClientToolCall({ id: 'malformed-call', toolName: malformed.id }),
      /Unsupported client tool/,
    )
    assert.match(String(errors[0]?.[0] || ''), /Rejected client tool definition/)
    assert.equal((errors[0]?.[1] as any)?.toolId, malformed.id)
    runtime.dispose()
  } finally {
    console.error = originalError
  }
})

test('lazy tool factories isolate one compiler failure and retain valid siblings', async () => {
  const createHealthy = (id: string) => defineAiClientToolFactory(id, () => defineClientTool({
    id,
    description: { text: `Healthy ${id}`, capabilities: ['test.catalog.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.lookup({ name: `${id}-output`, shape: 'test.lookup' }),
    execute: () => ({ ok: true, id }),
  }))
  const malformed = defineAiClientToolFactory('test_factory_malformed', () => defineClientTool({
    id: 'test_factory_malformed',
    description: { text: 'Malformed summary', capabilities: ['test.catalog.read'] },
    effect: { kind: 'READ' },
    output: clientToolOutput.aggregateSeries({
      name: 'test-malformed-summary',
      shape: 'tabular.summary',
      fields: [{ name: 'count', type: 'integer', role: 'measure', unit: 'count' }],
    }),
    execute: () => ({ count: 1 }),
  }))
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const runtime = createAiClientToolRuntime([
      createHealthy('test_factory_first'),
      malformed,
      createHealthy('test_factory_last'),
    ], { includeHelpTool: false })
    assert.deepEqual(runtime.clientTools.map(tool => tool.name), [
      'test_factory_first',
      'test_factory_last',
    ])
    await assert.rejects(
      runtime.handleClientToolCall({ id: 'malformed-factory-call', toolName: malformed.id }),
      /Unsupported client tool/,
    )
    assert.ok(errors.some(args => (args[1] as any)?.toolId === malformed.id))
    runtime.dispose()
  } finally {
    console.error = originalError
  }
})

test('lazy tool factories publish removal and recovery without persistent quarantine', async () => {
  let enabled = true
  const factory = defineAiClientToolFactory('test_factory_refresh', () => {
    if (!enabled) throw new Error('temporarily invalid factory')
    return defineClientTool({
      id: 'test_factory_refresh',
      description: { text: 'Refreshable tool', capabilities: ['test.catalog.read'] },
      effect: { kind: 'READ' },
      output: clientToolOutput.lookup({ name: 'test-refresh-output', shape: 'test.lookup' }),
      execute: () => ({ ok: true }),
    })
  })
  const originalError = console.error
  console.error = () => undefined
  try {
    const runtime = createAiClientToolRuntime([factory], { includeHelpTool: false })
    assert.deepEqual(runtime.clientTools.map(tool => tool.name), [factory.id])
    const initialVersion = runtime.clientToolsVersion

    enabled = false
    runtime.refreshClientTools()
    assert.deepEqual(runtime.clientTools, [])
    assert.equal(runtime.clientToolsVersion, initialVersion + 1)
    await assert.rejects(
      runtime.handleClientToolCall({ id: 'removed-factory-call', toolName: factory.id }),
      /Unsupported client tool/,
    )

    enabled = true
    runtime.refreshClientTools()
    assert.deepEqual(runtime.clientTools.map(tool => tool.name), [factory.id])
    assert.equal(runtime.clientToolsVersion, initialVersion + 2)
    await runtime.handleClientToolCall({ id: 'restored-factory-call', toolName: factory.id })
    runtime.dispose()
  } finally {
    console.error = originalError
  }
})

test('provider contributions quarantine one failure without losing healthy siblings', () => {
  const providers = [
    { id: 'test-provider-healthy', read: () => ['healthy contribution'] },
    { id: 'test-provider-broken', read: () => { throw new Error('broken contribution') } },
  ]
  const errors: unknown[][] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const contributions = providers.flatMap(provider => readHomeAgentProviderContribution(
      provider.id,
      'clientTools',
      provider.read,
    ))
    assert.deepEqual(contributions, ['healthy contribution'])
    assert.ok(errors.some(args => (args[1] as any)?.providerId === 'test-provider-broken'))
  } finally {
    console.error = originalError
  }
})

test('client Skill binding contribution preserves provider order and deduplicates opaque ids', () => {
  assert.deepEqual(normalizeClientSkillBindingContribution([
    { bindingId: ' passenger-flow ' },
    { bindingId: '' },
    { bindingId: 'device-analysis' },
    { bindingId: 'passenger-flow' },
    { bindingId: '  ' },
  ]), [
    { bindingId: 'passenger-flow' },
    { bindingId: 'device-analysis' },
  ])
  assert.deepEqual(normalizeClientSkillBindingContribution(), [])
})

test('duplicate client tool ids still reject the complete snapshot', () => {
  const duplicate = (label: string) => ({
    id: 'test_catalog_duplicate',
    description: label,
    execute: () => ({ ok: true }),
  })
  assert.throws(
    () => createAiClientToolRuntime([duplicate('first'), duplicate('second')]),
    /Duplicate client tool id/,
  )
})


test('scope search resolves names to fresh complete candidates without treating text as an id', async () => {
  const text = { question: 'Choose', cancel: 'Cancel', required: 'Required', cancelled: 'Cancelled', incomplete: 'Incomplete', invalid: 'Invalid' }
  const candidates = [{ id: 'a', title: 'A', value: 'device-a/channel-a' }, { id: 'b', title: 'B', value: 'device-b/channel-b' }]
  const requests: any[] = []
  const responses = [{ searchText: ' north ' }, { optionId: 'b' }]
  const found = await selectDomainAgentScopeCandidate({ requestInput: async request => {
    requests.push(request)
    return responses.shift()!
  } }, [], true, 0, text, { placeholder: 'Name', submitText: 'Search', resolve: async name => {
    assert.equal(name, 'north')
    return { candidates, complete: true, total: 2 }
  } })
  assert.equal(found, 'device-b/channel-b')
  assert.deepEqual(requests.map(request => request.options.map((option: any) => option.id)), [[], ['a', 'b']])
  for (const lookup of [
    async () => ({ candidates, complete: false, total: 2 }),
    async () => ({ candidates, complete: true, total: 3 }),
    async () => { throw new Error('permission denied') },
  ]) {
    let prompts = 0
    await assert.rejects(selectDomainAgentScopeCandidate({ requestInput: async () => {
      prompts++
      return { searchText: 'north' }
    } }, [], true, 0, text, { placeholder: 'Name', submitText: 'Search', resolve: lookup }))
    assert.equal(prompts, 1, 'incomplete or failed lookup cannot become another empty picker')
  }
  await assert.rejects(selectDomainAgentScopeCandidate({ requestInput: async () => ({ optionId: 'north' }) },
    candidates, true, 2, text), /Invalid/)
})

test('scope search cannot continue after abort even when its resolver ignores the signal', async () => {
  const controller = new AbortController()
  const text = { question: 'Choose', cancel: 'Cancel', required: 'Required', cancelled: 'Cancelled', incomplete: 'Incomplete', invalid: 'Invalid' }
  let finish!: (value: any) => void
  let started!: () => void
  const lookupStarted = new Promise<void>(resolve => { started = resolve })
  let executed = 0
  const selection = selectDomainAgentScopeCandidate({ signal: controller.signal,
    requestInput: async () => ({ searchText: 'north' }) }, [], true, 0, text,
  { placeholder: 'Name', submitText: 'Search', resolve: async (_name, signal) => {
    assert.equal(signal, controller.signal)
    started()
    return new Promise(resolve => { finish = resolve })
  } }).then(() => { executed++ })
  await lookupStarted
  controller.abort()
  finish({ candidates: [{ id: 'a', title: 'A', value: 'exact-pair' }], complete: true, total: 1 })
  await assert.rejects(selection, /Cancelled/)
  assert.equal(executed, 0)
})

test('scope tree uses complete authorized options and never automatically chooses a replacement scope', async () => {
  const text = { question: 'Choose', cancel: 'Cancel', required: 'Required', cancelled: 'Cancelled', incomplete: 'Incomplete', invalid: 'Invalid' }
  const options = [{ id: 'area:a', title: 'A', value: { areaId: 'a' } }]
  let prompts = 0
  const picked = await selectDomainAgentScopeCandidate({ requestInput: async request => {
    prompts++
    assert.equal(request.editor, 'scope-tree')
    assert.equal(request.options.length, 1)
    return { optionId: 'area:a' }
  } }, [], true, 0, text, { placeholder: 'Name', submitText: 'Search', editor: 'scope-tree',
    browse: async () => ({ candidates: options, complete: true, total: 1 }),
    resolve: async () => { throw new Error('tree filtering must not issue another lookup') },
  })
  assert.deepEqual(picked, { areaId: 'a' })
  assert.equal(prompts, 1)
  await assert.rejects(selectDomainAgentScopeCandidate({ requestInput: async () => {
    throw new Error('invalid tree must not become selectable')
  } }, [{ ...options[0], parentId: 'area:a' }], true, 1, text), /Invalid/)
})
