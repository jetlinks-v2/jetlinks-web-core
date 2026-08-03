import {
  defineAiClientToolContract,
  withAiClientToolContractEvidence,
  type AiClientToolContractFragment,
  type AiClientToolOutputContract,
} from './clientToolContract'
import {
  createAiClientToolFailureResult,
  type AiClientToolCardinality,
  type AiClientToolClaim,
  type AiClientToolFailureOptions,
  type AiClientToolOutputField,
  type AiClientToolOrdering,
} from './clientToolResult'
import {
  createAiClientToolArrayRecordSource,
  createAiClientToolRecordStream,
} from './clientToolResultDelivery'
import type {
  AiClientToolCall,
  AiClientToolConfirmOptions,
  AiClientToolDefinition,
  AiClientToolInput,
  AiClientToolValueType,
} from './clientTools'

export const CLIENT_TOOL_DEFINITION_VERSION = 'client-tool-definition/v1' as const
export const CLIENT_TOOL_DEFINITION_META_KEY = 'clientToolDefinition' as const

const CLIENT_TOOL_RESULT_KIND = 'client-tool-result/v1' as const
const MATERIALIZED_ARTIFACT_KIND = 'ai-client-tool-artifact/v1'
const MATERIALIZED_RECORD_STREAM_KIND = 'ai-client-tool-record-stream/v1'
const INLINE_RECORD_LIMIT = 200

export type ClientToolEffectKind = 'READ' | 'WRITE' | 'EXTERNAL_ACTION'
export type ClientToolIdempotency = 'IDEMPOTENT' | 'NON_IDEMPOTENT' | 'UNKNOWN'
export type ClientToolActivation = 'AUTO' | 'BOOTSTRAP' | 'ON_DEMAND'

export interface ClientToolDescription {
  text: string
  capabilities: readonly [string, ...string[]]
  aliases?: readonly string[]
  intents?: readonly string[]
  notFor?: readonly string[]
  activation?: ClientToolActivation
  help?: string
}

export interface ClientToolValueType {
  type: string
  valueType?: ClientToolValueType
  elementType?: ClientToolValueType
  elements?: readonly { value: unknown; text?: string }[]
  properties?: readonly {
    id: string
    name?: string
    valueType: ClientToolValueType
    expands?: { required?: boolean }
  }[]
  min?: number
  max?: number
  maxLength?: number
}

export interface ClientToolInput {
  id: string
  name?: string
  description?: string
  required?: boolean
  defaultValue?: unknown
  valueType?: string | ClientToolValueType
}

export type ClientToolInputCondition =
  | { input: string; equals: string | number | boolean }
  | { input: string; oneOf: readonly (string | number | boolean)[] }

export interface ClientToolInputAlternative {
  title?: string
  required: readonly [string, ...string[]]
  when?: ClientToolInputCondition
  forbidden?: readonly string[]
}

export interface ClientToolConsumedResource {
  name: string
  optional?: boolean
  source?: 'CONTEXT' | 'TOOL' | 'EITHER'
}

export interface ClientToolPresentation {
  displayName?: string
  progressText?: string
  progressDescription?: string
}

export interface ClientToolOwner {
  module: string
  group?: string
}

export interface ClientToolConfirmation<TContext = Record<string, unknown>> {
  title?: string | ((args: Record<string, unknown>, context: TContext, call: AiClientToolCall) => string)
  content?: string | ((args: Record<string, unknown>, context: TContext, call: AiClientToolCall) => string)
  okText?: string
  cancelText?: string
  when?: (args: Record<string, unknown>, context: TContext, call: AiClientToolCall) => boolean
}

export interface ClientToolReadEffect {
  kind: 'READ'
}

export interface ClientToolWriteEffect<TContext = Record<string, unknown>> {
  kind: 'WRITE'
  idempotency: ClientToolIdempotency
  reversible: boolean
  confirmation: ClientToolConfirmation<TContext> | false
}

export interface ClientToolExternalActionEffect<TContext = Record<string, unknown>> {
  kind: 'EXTERNAL_ACTION'
  idempotency: ClientToolIdempotency
  reversible: boolean
  confirmation: ClientToolConfirmation<TContext> | false
}

export type ClientToolEffect<TContext = Record<string, unknown>> =
  | ClientToolReadEffect
  | ClientToolWriteEffect<TContext>
  | ClientToolExternalActionEffect<TContext>

interface ClientToolOutputBase<TResult> {
  name: string
  shape: string
  label?: string
  fields?: readonly AiClientToolOutputField[]
  /** Renderer-neutral ordering guaranteed by the producer. */
  ordering?: AiClientToolOrdering
  /**
   * Resolves execution-specific field semantics when a producer's columns are selected at runtime.
   * The logical output name and shape remain static; only renderer-neutral field metadata may vary.
   */
  resolveFields?: (result: TResult, selectedValue: unknown) => readonly AiClientToolOutputField[]
  /**
   * Resolves the user-facing label from producer-declared execution fields. Stable binding identity and shape remain
   * owned by the static contract; the resolver must not infer semantics from tool ids or physical field names.
   */
  resolveLabel?: (
    result: TResult,
    selectedValue: unknown,
    fields: readonly AiClientToolOutputField[],
  ) => string | undefined
  optional?: boolean
  select?: (result: TResult) => unknown
}

export interface ClientToolLookupOutput<TResult = unknown> extends ClientToolOutputBase<TResult> {
  kind: 'lookup'
}

export interface ClientToolDetailOutput<TResult = unknown> extends ClientToolOutputBase<TResult> {
  kind: 'detail'
}

export interface ClientToolRecordSetOutput<TResult = unknown> extends ClientToolOutputBase<TResult> {
  kind: 'recordSet'
  mediaType?: string
}

export interface ClientToolAggregateSeriesOutput<TResult = unknown> extends ClientToolOutputBase<TResult> {
  kind: 'aggregateSeries'
}

export interface ClientToolArtifactOutput<TResult = unknown> extends ClientToolOutputBase<TResult> {
  kind: 'artifact'
  mediaType: string
}

export interface ClientToolStateChangeOutput<TResult = unknown> extends ClientToolOutputBase<TResult> {
  kind: 'stateChange'
  transition: 'NAVIGATION' | 'MUTATION'
}

export type ClientToolOutput<TResult = unknown> =
  | ClientToolLookupOutput<TResult>
  | ClientToolDetailOutput<TResult>
  | ClientToolRecordSetOutput<TResult>
  | ClientToolAggregateSeriesOutput<TResult>
  | ClientToolArtifactOutput<TResult>
  | ClientToolStateChangeOutput<TResult>

export interface ClientToolSuccessOptions {
  status?: 'ok' | 'empty'
  summary?: Record<string, unknown>
  requestedRange?: Record<string, unknown>
  observedRange?: Record<string, unknown>
  cardinality?: AiClientToolCardinality
  claims?: AiClientToolClaim[]
  supportsAbsenceClaim?: boolean
  facts?: Record<string, unknown>
  warnings?: string[]
}

export interface ClientToolPartialOptions extends Omit<ClientToolSuccessOptions, 'status'> {
  status?: string
  limitReason?: string
}

interface ClientToolExecutionSuccess<TResult> {
  kind: typeof CLIENT_TOOL_RESULT_KIND
  outcome: 'success' | 'partial'
  data: TResult
  status: string
  complete: boolean
  truncated: boolean
  summary?: Record<string, unknown>
  requestedRange?: Record<string, unknown>
  observedRange?: Record<string, unknown>
  cardinality?: AiClientToolCardinality
  claims?: AiClientToolClaim[]
  supportsAbsenceClaim?: boolean
  facts?: Record<string, unknown>
  warnings?: string[]
  limitReason?: string
}

interface ClientToolExecutionFailure {
  kind: typeof CLIENT_TOOL_RESULT_KIND
  outcome: 'failure'
  failure: AiClientToolFailureOptions
}

export type ClientToolExecutionResult<TResult> =
  | ClientToolExecutionSuccess<TResult>
  | ClientToolExecutionFailure

export const clientToolResult = {
  success: <TResult>(data: TResult, options: ClientToolSuccessOptions = {}): ClientToolExecutionResult<TResult> => ({
    kind: CLIENT_TOOL_RESULT_KIND,
    outcome: 'success',
    data,
    status: options.status || 'ok',
    complete: true,
    truncated: false,
    ...(options.summary ? { summary: options.summary } : {}),
    ...(options.requestedRange ? { requestedRange: options.requestedRange } : {}),
    ...(options.observedRange ? { observedRange: options.observedRange } : {}),
    ...(options.cardinality ? { cardinality: options.cardinality } : {}),
    ...(options.claims?.length ? { claims: options.claims.map(claim => ({ ...claim })) } : {}),
    ...(options.supportsAbsenceClaim !== undefined
      ? { supportsAbsenceClaim: options.supportsAbsenceClaim }
      : {}),
    ...(options.facts ? { facts: options.facts } : {}),
    ...(options.warnings?.length ? { warnings: [...options.warnings] } : {}),
  }),
  partial: <TResult>(data: TResult, options: ClientToolPartialOptions = {}): ClientToolExecutionResult<TResult> => ({
    kind: CLIENT_TOOL_RESULT_KIND,
    outcome: 'partial',
    data,
    status: options.status || 'partial',
    complete: false,
    truncated: true,
    ...(options.summary ? { summary: options.summary } : {}),
    ...(options.requestedRange ? { requestedRange: options.requestedRange } : {}),
    ...(options.observedRange ? { observedRange: options.observedRange } : {}),
    ...(options.cardinality ? { cardinality: options.cardinality } : {}),
    ...(options.claims?.length ? { claims: options.claims.map(claim => ({ ...claim })) } : {}),
    ...(options.supportsAbsenceClaim !== undefined
      ? { supportsAbsenceClaim: options.supportsAbsenceClaim }
      : {}),
    ...(options.facts ? { facts: options.facts } : {}),
    ...(options.warnings?.length ? { warnings: [...options.warnings] } : {}),
    ...(options.limitReason ? { limitReason: options.limitReason } : {}),
  }),
  failure: (failure: AiClientToolFailureOptions): ClientToolExecutionResult<never> => ({
    kind: CLIENT_TOOL_RESULT_KIND,
    outcome: 'failure',
    failure,
  }),
}

type ClientToolOutputConfig<TResult, TKind extends ClientToolOutput<TResult>['kind']> = Omit<
  Extract<ClientToolOutput<TResult>, { kind: TKind }>,
  'kind'
>

/** Stable, renderer-neutral output presets. Selectors run after the business operation and never retry it. */
export const clientToolOutput = {
  lookup: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'lookup'>): ClientToolLookupOutput<TResult> => ({
    kind: 'lookup',
    ...output,
  }),
  detail: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'detail'>): ClientToolDetailOutput<TResult> => ({
    kind: 'detail',
    ...output,
  }),
  recordSet: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'recordSet'>): ClientToolRecordSetOutput<TResult> => ({
    kind: 'recordSet',
    ...output,
  }),
  aggregateSeries: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'aggregateSeries'>): ClientToolAggregateSeriesOutput<TResult> => ({
    kind: 'aggregateSeries',
    ...output,
  }),
  artifact: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'artifact'>): ClientToolArtifactOutput<TResult> => ({
    kind: 'artifact',
    ...output,
  }),
  stateChange: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'stateChange'>): ClientToolStateChangeOutput<TResult> => ({
    kind: 'stateChange',
    ...output,
  }),
}

export interface ClientToolDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TContext = Record<string, unknown>,
  TResult = unknown,
> {
  id: string
  description: ClientToolDescription
  inputs?: readonly ClientToolInput[]
  /** Closed cross-field alternatives for complex inputs; compiled to the current wire schema internally. */
  inputAlternatives?: readonly ClientToolInputAlternative[]
  consumes?: readonly ClientToolConsumedResource[]
  effect: ClientToolEffect<TContext>
  output: ClientToolOutput<TResult> | readonly ClientToolOutput<TResult>[]
  presentation?: ClientToolPresentation
  owner?: ClientToolOwner
  execute: (
    args: TArgs,
    context: TContext,
    call: AiClientToolCall,
  ) => TResult | ClientToolExecutionResult<TResult> | Promise<TResult | ClientToolExecutionResult<TResult>>
}

export interface CompiledClientToolMetadata {
  version: typeof CLIENT_TOOL_DEFINITION_VERSION
  effect: ClientToolEffectKind
  outputCount: number
}

const asArray = <T>(value: T | readonly T[]) => (Array.isArray(value) ? [...value] : [value]) as T[]
const normalizedText = (value: unknown) => String(value || '').trim()
const uniqueText = (values: readonly string[] = []) => Array.from(new Set(values.map(normalizedText).filter(Boolean)))

const normalizeDescription = (description: ClientToolDescription) => {
  const text = normalizedText(description.text)
  const capabilities = uniqueText(description.capabilities)
  if (!text) throw new Error('Client tool description text is required')
  if (!capabilities.length) throw new Error('Client tool capability is required')
  return { text, capabilities }
}

const normalizeOutputs = <TResult>(output: ClientToolDefinition<any, any, TResult>['output']) => {
  const outputs = asArray(output)
  if (!outputs.length) throw new Error('Client tool requires at least one output')
  const names = new Set<string>()
  outputs.forEach((item) => {
    const name = normalizedText(item.name)
    const shape = normalizedText(item.shape)
    if (!name || !shape) throw new Error('Client tool output requires a stable name and shape')
    if (names.has(name)) throw new Error(`Duplicate client tool output: ${name}`)
    names.add(name)
    if (item.kind === 'artifact' && !normalizedText(item.mediaType)) {
      throw new Error(`Client tool artifact output requires a media type: ${name}`)
    }
  })
  if (outputs.filter(item => item.kind === 'artifact').length > 1) {
    throw new Error('One client tool execution can materialize at most one artifact output')
  }
  return outputs
}

const resolveRoutingKind = <TResult>(
  effect: ClientToolEffect,
  outputs: readonly ClientToolOutput<TResult>[],
) => {
  if (effect.kind !== 'READ') {
    return outputs.some(output => output.kind === 'stateChange' && output.transition === 'NAVIGATION')
      ? 'navigation' as const
      : 'action' as const
  }
  if (outputs.some(output => output.kind === 'artifact')) return 'artifact' as const
  if (outputs.some(output => output.kind === 'recordSet')) return 'records' as const
  if (outputs.some(output => output.kind === 'aggregateSeries')) return 'aggregate' as const
  if (outputs.some(output => output.kind === 'detail')) return 'detail' as const
  return 'discovery' as const
}

const resolveActivation = (activation: ClientToolActivation | undefined) => {
  if (activation === 'BOOTSTRAP') return 'eager' as const
  if (activation === 'ON_DEMAND') return 'deferred' as const
  return 'auto' as const
}

const outputSlotPath = (index: number) => `$.__clientToolOutputs.output${index}`

const compileOutputContract = <TResult>(
  output: ClientToolOutput<TResult>,
  index: number,
): AiClientToolOutputContract => {
  const shared = {
    name: normalizedText(output.name),
    shape: normalizedText(output.shape),
    ...(output.label ? { label: output.label } : {}),
    ...(output.fields?.length ? { fields: output.fields.map(field => ({ ...field })) } : {}),
    ...(output.ordering ? { ordering: output.ordering } : {}),
  }
  if (output.kind === 'artifact') {
    return {
      ...shared,
      kind: 'artifact',
      mediaType: normalizedText(output.mediaType),
      delivery: 'file',
    }
  }
  const inline = {
    ...shared,
    path: outputSlotPath(index),
    delivery: output.kind === 'recordSet' ? 'auto' as const : 'inline' as const,
  }
  if (output.kind === 'recordSet') {
    return {
      ...inline,
      kind: 'record-set',
      ...(output.mediaType ? { mediaType: output.mediaType } : {}),
    }
  }
  if (output.kind === 'aggregateSeries') return { ...inline, kind: 'aggregate-series' }
  if (output.kind === 'stateChange') return { ...inline, kind: 'state-events' }
  return { ...inline, kind: 'lookup' }
}

const compileContract = <TResult>(
  definition: ClientToolDefinition<any, any, TResult>,
  outputs: readonly ClientToolOutput<TResult>[],
) => {
  const { capabilities } = normalizeDescription(definition.description)
  const consumes = definition.consumes || []
  const routingKind = resolveRoutingKind(definition.effect, outputs)
  return defineAiClientToolContract({
    routingKind,
    routing: {
      capabilities,
      ...(definition.description.aliases?.length ? { aliases: uniqueText(definition.description.aliases) } : {}),
      ...(definition.description.intents?.length ? { intents: uniqueText(definition.description.intents) } : {}),
      ...(definition.description.notFor?.length ? { notFor: uniqueText(definition.description.notFor) } : {}),
      ...(consumes.length ? { accepts: uniqueText(consumes.map(item => item.name)) } : {}),
      ...(consumes.some(item => !item.optional) ? {
        prerequisites: uniqueText(consumes.filter(item => !item.optional).map(item => item.name)),
      } : {}),
      exposure: resolveActivation(definition.description.activation),
      ...(definition.effect.kind === 'READ' ? {} : { cost: 'medium' as const }),
    },
    outputs: outputs.map(compileOutputContract),
  })
}

const compileEffect = <TContext>(effect: ClientToolEffect<TContext>) => {
  if (effect.kind === 'READ') {
    return {
      annotations: { readOnlyHint: true, idempotentHint: true },
      risk: { readOnly: true, parallelSafe: true, needsApproval: false },
      confirm: undefined,
    }
  }
  const idempotent = effect.idempotency === 'IDEMPOTENT'
  const confirmation = effect.confirmation === false
    ? undefined
    : effect.confirmation as AiClientToolConfirmOptions<TContext>
  return {
    annotations: {
      readOnlyHint: false,
      idempotentHint: idempotent,
      destructiveHint: !effect.reversible,
      ...(effect.kind === 'EXTERNAL_ACTION' ? { openWorldHint: true } : {}),
    },
    risk: {
      readOnly: false,
      parallelSafe: false,
      needsApproval: effect.confirmation !== false,
    },
    confirm: confirmation,
  }
}

const compileInputAlternatives = (
  toolId: string,
  inputs: readonly ClientToolInput[],
  alternatives: readonly ClientToolInputAlternative[] | undefined,
) => {
  if (!alternatives?.length) return undefined
  const declaredInputs = new Map(inputs.map(input => [normalizedText(input.id), input]))
  const branchProperty = (inputId: string) => {
    const input = declaredInputs.get(inputId)
    if (!input) {
      throw new Error(`Client tool ${toolId} input alternative references undeclared input: ${inputId}`)
    }
    const description = normalizedText(input.description)
    return description ? { description } : {}
  }
  return {
    type: 'object' as const,
    oneOf: alternatives.map((alternative) => {
      const when = alternative.when
      const required = uniqueText(alternative.required)
      const whenInput = when ? normalizedText(when.input) : ''
      const forbidden = uniqueText(alternative.forbidden)
      uniqueText([...required, whenInput, ...forbidden]).forEach(branchProperty)
      // Composed branches are audited independently; root inputs still own the actual value constraints.
      const properties = Object.fromEntries(uniqueText([...required, whenInput]).map((inputId) => {
        const condition = inputId === whenInput && when
          ? ('equals' in when ? { const: when.equals } : { enum: [...when.oneOf] })
          : {}
        return [inputId, { ...branchProperty(inputId), ...condition }]
      }))
      return {
        ...(alternative.title ? { title: alternative.title } : {}),
        required,
        properties,
        ...(forbidden.length ? {
          not: {
            anyOf: forbidden.map(input => ({ required: [input] })),
          },
        } : {}),
      }
    }),
  }
}

const isExecutionResult = <TResult>(value: unknown): value is ClientToolExecutionResult<TResult> => (
  !!value
  && typeof value === 'object'
  && !Array.isArray(value)
  && (value as { kind?: unknown }).kind === CLIENT_TOOL_RESULT_KIND
)

const isFailureLike = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  return result.success === false || result.ok === false
}

const createSelectionError = (toolId: string, outputName: string, cause?: unknown) => {
  const error = new Error(`Client tool output selection failed: ${toolId}.${outputName}`) as Error & {
    code?: string
    failureDisposition?: string
    recoveryAction?: string
    retryable?: boolean
    cause?: unknown
  }
  error.code = 'CLIENT_TOOL_OUTPUT_SELECTION_FAILED'
  error.failureDisposition = 'tool'
  error.recoveryAction = 'terminal'
  error.retryable = false
  error.cause = cause
  return error
}

const isInternalDescriptor = (value: unknown, kind: string) => (
  !!value
  && typeof value === 'object'
  && !Array.isArray(value)
  && (value as { kind?: unknown }).kind === kind
)

const prepareMaterializedValue = <TResult>(
  value: unknown,
  output: ClientToolOutput<TResult>,
  fields: readonly AiClientToolOutputField[] | undefined,
  label: string | undefined,
) => {
  if (isInternalDescriptor(value, MATERIALIZED_ARTIFACT_KIND)
    || isInternalDescriptor(value, MATERIALIZED_RECORD_STREAM_KIND)) {
    return {
      ...(value as Record<string, unknown>),
      bindingName: output.name,
      ...(label ? { bindingLabel: label } : {}),
      outputShape: output.shape,
      ...(fields?.length ? { fields: fields.map(field => ({ ...field })) } : {}),
      ...(output.ordering ? { ordering: output.ordering } : {}),
    }
  }
  if (output.kind === 'recordSet' && Array.isArray(value) && value.length > INLINE_RECORD_LIMIT) {
    return createAiClientToolRecordStream({
      source: createAiClientToolArrayRecordSource(value),
      schema: { type: 'object' },
      bindingName: output.name,
      ...(label ? { bindingLabel: label } : {}),
      outputShape: output.shape,
      ...(fields?.length ? { fields: fields.map(field => ({ ...field })) } : {}),
      ...(output.ordering ? { ordering: output.ordering } : {}),
    })
  }
  return undefined
}

const adaptExecutionResult = async <TResult>(
  toolId: string,
  result: TResult | ClientToolExecutionResult<TResult>,
  outputs: readonly ClientToolOutput<TResult>[],
  contract: AiClientToolContractFragment,
) => {
  if (isExecutionResult<TResult>(result) && result.outcome === 'failure') {
    return createAiClientToolFailureResult(result.failure)
  }
  if (!isExecutionResult<TResult>(result) && isFailureLike(result)) return result

  const execution = isExecutionResult<TResult>(result)
    ? result
    : clientToolResult.success(result as TResult)
  if (execution.outcome === 'failure') return createAiClientToolFailureResult(execution.failure)

  const selected: Array<{
    output: ClientToolOutput<TResult>
    index: number
    value: unknown
    fields?: readonly AiClientToolOutputField[]
    label?: string
  }> = []
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index]
    let value: unknown
    try {
      value = output.select ? output.select(execution.data) : execution.data
    } catch (error) {
      throw createSelectionError(toolId, output.name, error)
    }
    if (value === undefined || value === null) {
      if (output.optional) continue
      throw createSelectionError(toolId, output.name)
    }
    let fields = output.fields
    if (output.resolveFields) {
      try {
        fields = output.resolveFields(execution.data, value)
      } catch (error) {
        throw createSelectionError(toolId, output.name, error)
      }
    }
    let label = output.label
    if (output.resolveLabel) {
      try {
        label = normalizedText(output.resolveLabel(execution.data, value, fields || [])) || label
      } catch (error) {
        throw createSelectionError(toolId, output.name, error)
      }
    }
    selected.push({ output, index, value, fields, label })
  }

  const inlineValues: Record<string, unknown> = {}
  let materialized: unknown
  const inlineStates: Array<{
    name: string
    label?: string
    path: string
    recordCount?: number
    complete: boolean
    fields?: AiClientToolOutputField[]
    ordering?: AiClientToolOrdering
    requestedRange?: Record<string, unknown>
    observedRange?: Record<string, unknown>
  }> = []
  selected.forEach(({ output, index, value, fields, label }) => {
    const prepared = prepareMaterializedValue(value, output, fields, label)
    if (prepared) {
      if (materialized) throw createSelectionError(toolId, output.name)
      materialized = prepared
      return
    }
    if (output.kind === 'artifact') {
      throw createSelectionError(toolId, output.name)
    }
    const slot = `output${index}`
    inlineValues[slot] = value
    inlineStates.push({
      name: output.name,
      ...(label ? { label } : {}),
      path: outputSlotPath(index),
      ...(Array.isArray(value) ? { recordCount: value.length } : {}),
      complete: execution.complete,
      ...(fields?.length ? { fields: fields.map(field => ({ ...field })) } : {}),
      ...(output.ordering ? { ordering: output.ordering } : {}),
      ...(execution.requestedRange ? { requestedRange: { ...execution.requestedRange } } : {}),
      ...(execution.observedRange ? { observedRange: { ...execution.observedRange } } : {}),
    })
  })

  const selectedOutputNames = new Set(selected.map(({ output }) => output.name))
  const claims = (execution.claims || []).flatMap((claim) => {
    const binding = String(claim.binding || '').trim()
    if (binding) return selectedOutputNames.has(binding) ? [{ ...claim, binding }] : []
    // A single selected output is unambiguous; multiple outputs must declare their claim binding.
    return selected.length === 1 ? [{ ...claim, binding: selected[0].output.name }] : []
  })

  const envelope = {
    success: true,
    status: execution.status,
    complete: execution.complete,
    truncated: execution.truncated,
    __clientToolOutputs: inlineValues,
    ...(execution.summary ? { summary: execution.summary } : {}),
    ...(materialized ? { data: materialized } : {}),
  }
  return withAiClientToolContractEvidence(envelope, contract, {
    complete: execution.complete,
    truncated: execution.truncated,
    ...(execution.requestedRange ? { requestedRange: execution.requestedRange } : {}),
    ...(execution.observedRange ? { observedRange: execution.observedRange } : {}),
    ...(execution.cardinality ? { cardinality: execution.cardinality } : {}),
    ...(claims.length ? { claims } : {}),
    ...(execution.supportsAbsenceClaim !== undefined
      ? { supportsAbsenceClaim: execution.supportsAbsenceClaim }
      : {}),
    ...(execution.facts ? { facts: execution.facts } : {}),
    ...(execution.warnings?.length ? { warnings: execution.warnings } : {}),
    ...(execution.limitReason ? { limitReason: execution.limitReason } : {}),
    resultStatus: execution.status,
    outputs: inlineStates,
  })
}

/**
 * Compiles a stable business declaration into the current browser runtime contract.
 * Backend wire fields, JSONPath bindings, evidence and delivery policy remain compiler-owned.
 */
export const defineClientTool = <
  TArgs extends Record<string, unknown> = Record<string, unknown>,
  TContext = Record<string, unknown>,
  TResult = unknown,
>(definition: ClientToolDefinition<TArgs, TContext, TResult>): AiClientToolDefinition<TContext> => {
  const id = normalizedText(definition.id)
  if (!id) throw new Error('Client tool id is required')
  const { text } = normalizeDescription(definition.description)
  const outputs = normalizeOutputs(definition.output)
  const contract = compileContract(definition, outputs)
  const effect = compileEffect(definition.effect)
  const metadata: CompiledClientToolMetadata = {
    version: CLIENT_TOOL_DEFINITION_VERSION,
    effect: definition.effect.kind,
    outputCount: outputs.length,
  }
  return {
    id,
    name: id,
    description: text,
    ...(definition.description.help ? { help: definition.description.help } : {}),
    ...(definition.presentation?.displayName ? { displayName: definition.presentation.displayName } : {}),
    ...(definition.presentation?.progressText ? { progressText: definition.presentation.progressText } : {}),
    ...(definition.presentation?.progressDescription ? {
      progressDescription: definition.presentation.progressDescription,
    } : {}),
    inputs: (definition.inputs || []).map(input => ({ ...input })) as AiClientToolInput[],
    ...(definition.inputAlternatives?.length ? {
      parameterSchema: compileInputAlternatives(id, definition.inputs || [], definition.inputAlternatives),
    } : {}),
    output: { type: 'object' } as AiClientToolValueType,
    annotations: effect.annotations,
    risk: effect.risk,
    ...(effect.confirm ? { confirm: effect.confirm } : {}),
    ...contract,
    _meta: {
      ...contract._meta,
      ...(definition.owner?.module ? { ownerModule: definition.owner.module } : {}),
      ...(definition.owner?.group ? { capabilityGroup: definition.owner.group } : {}),
      [CLIENT_TOOL_DEFINITION_META_KEY]: metadata,
    },
    execute: async (args, context, call) => adaptExecutionResult(
      id,
      await definition.execute(args as TArgs, context, call),
      outputs,
      contract,
    ),
  }
}

export const isCompiledClientToolDefinition = (value: unknown): value is CompiledClientToolMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const metadata = value as Partial<CompiledClientToolMetadata>
  return metadata.version === CLIENT_TOOL_DEFINITION_VERSION
    && ['READ', 'WRITE', 'EXTERNAL_ACTION'].includes(String(metadata.effect))
    && Number.isInteger(metadata.outputCount)
    && Number(metadata.outputCount) > 0
}
