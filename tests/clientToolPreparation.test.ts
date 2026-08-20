import assert from 'node:assert/strict'
import test from 'node:test'
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
import { createAiClientToolRuntime } from '../src/layout/components/AiChat/clientTools'
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
