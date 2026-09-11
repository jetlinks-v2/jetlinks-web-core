import {
  bindAiClientToolContractExecutionAxis,
  bindAiClientToolContractExecutionOrdering,
  defineAiClientToolContract,
  withAiClientToolContractEvidence,
  type AiClientToolContractFragment,
  type AiClientToolContractOutputState,
  type AiClientToolOutputContract,
} from './clientToolContract'
import {
  createAiClientToolFailureResult,
  isCanonicalAiClientToolOutputField,
  normalizeAiClientToolOutputBindings,
  normalizeAiClientToolOutputFields,
  validateAiClientToolCanonicalFieldValues,
  type AiClientToolCardinality,
  type AiClientToolCanonicalOutputField,
  type AiClientToolClaim,
  type AiClientToolFailureOptions,
  type AiClientToolOutputField,
  type AiClientToolOrdering,
} from './clientToolResult'
import {
  createAiClientToolArrayRecordSource,
  createAiClientToolRecordStream,
  resolveAiClientToolArtifactLogicalSource,
} from './clientToolResultDelivery'
import { normalizeAiClientToolRecordPath } from './clientToolBindingPath'
import type {
  AiClientToolCall,
  AiClientToolConfirmOptions,
  AiClientToolDefinition,
  AiClientToolInput,
  AiClientToolPreparedCall,
  AiClientToolValueType,
} from './clientTools'
import type { AiClientToolParameterSchema } from './clientToolParameterSchema'
import {
  AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION,
  normalizeAiClientToolAnalyticalCapability,
  validateAiClientToolAnalyticalClosedEnumSelector,
  validateAiClientToolAnalyticalFilterBinding,
  validateAiClientToolAnalyticalMeasureBinding,
  validateAiClientToolAnalyticalScopeBinding,
  validateAiClientToolAnalyticalTemporalBinding,
  type AiClientToolAnalyticalCapability,
  type AiClientToolAnalyticalArgumentBinding,
  type AiClientToolAnalyticalClosedEnumSelector,
  type AiClientToolAnalyticalFilterArgumentBinding,
  type AiClientToolAnalyticalMeasureArgumentBinding,
  type AiClientToolAnalyticalScopeArgumentBinding,
  type AiClientToolAnalyticalScopeSelection,
  type AiClientToolAnalyticalSemanticIntentBinding,
  type AiClientToolAnalyticalTemporalArgumentBinding,
  type AiClientToolConsumerPort,
  type AiClientToolOutputAudience,
  type AiClientToolResourceType,
  type AiClientToolRoutingResultDelivery,
  type AiClientToolSourcePolicy,
} from './clientToolRouting'

export const CLIENT_TOOL_DEFINITION_VERSION = 'client-tool-definition/v1' as const
export const CLIENT_TOOL_DEFINITION_META_KEY = 'clientToolDefinition' as const

const CLIENT_TOOL_RESULT_KIND = 'client-tool-result/v1' as const
declare const CLIENT_TOOL_ANALYTICAL_AUTHORING: unique symbol
declare const CLIENT_TOOL_TEMPORAL_AUTHORING: unique symbol
declare const CLIENT_TOOL_SCOPE_AUTHORING: unique symbol
declare const CLIENT_TOOL_STRING_ARGUMENT_AUTHORING: unique symbol
const MATERIALIZED_ARTIFACT_KIND = 'ai-client-tool-artifact/v1'
const MATERIALIZED_RECORD_STREAM_KIND = 'ai-client-tool-record-stream/v1'
const INLINE_RECORD_LIMIT = 200
const ANALYTICAL_TOKEN_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

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

export interface ClientToolAnalyticalMeasure {
  name: string
  aggregations: readonly string[]
  units: readonly string[]
}

export interface ClientToolAnalyticalOrdering {
  axis: string
  direction: 'asc' | 'desc'
}

/** Stable filter authoring; fixed operators default to scalar unless an array representation is explicit. */
export type ClientToolAnalyticalFilterBindingDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> =
  | {
      axis: string
      operator: string
      valueArgument: Extract<keyof TArgs, string>
      valueCardinality?: never
      encoding?: never
      operators?: never
      operatorArgument?: never
    }
  | {
      axis: string
      operator: string
      valueArgument: Extract<keyof TArgs, string>
      valueCardinality: 'one-or-more'
      encoding: 'string-array'
      operators?: never
      operatorArgument?: never
    }
  | {
      axis: string
      operators: readonly [string, ...string[]]
      operatorArgument: Extract<keyof TArgs, string>
      valueArgument: Extract<keyof TArgs, string>
      operator?: never
      valueCardinality?: never
      encoding?: never
    }

export interface ClientToolAnalyticalSemanticIntentBindingDefinition {
  /** Exact member of this tool declaration's description.intents. */
  intent: string
  criterion: string
  measures: readonly [string, ...string[]]
  dimensions: readonly [string, ...string[]]
  /** Explicitly admits project or preparation-resolved scope through this tool's typed scope authoring edge. */
  scopeSelection?: AiClientToolAnalyticalScopeSelection
}

export interface ClientToolAnalyticalClosedEnumSelectorCaseDefinition {
  value: string
  criterion: string
  measures: readonly [string, ...string[]]
  dimensions: readonly [string, ...string[]]
  ordering: ClientToolAnalyticalOrdering
  requestedLimit: number
}

export interface ClientToolAnalyticalClosedEnumSelectorDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Exact closed string-enum input that activates one case for the current call only. */
  argument: Extract<keyof TArgs, string>
  /** Existing integer input that carries the case's requested record window. */
  limitArgument: Extract<keyof TArgs, string>
  cases: readonly [
    ClientToolAnalyticalClosedEnumSelectorCaseDefinition,
    ...ClientToolAnalyticalClosedEnumSelectorCaseDefinition[],
  ]
}

export type ClientToolAnalyticalCoverage = 'complete' | 'partial' | 'complete-or-partial'

interface ClientToolAnalyticalProducerSemantics<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable business producer identity; the adapter maps it to the current wire identity. */
  producerKey: string
  /** Stable fact family shared by producers that describe the same source semantics. */
  factKey: string
  subjects: readonly [string, ...string[]]
  measures: readonly ClientToolAnalyticalMeasure[]
  dimensions?: readonly string[]
  filters?: readonly string[]
  /** Explicit filter materialization semantics; the compiler is the sole owner of routing wire projection. */
  filterBindings?: readonly ClientToolAnalyticalFilterBindingDefinition<TArgs>[]
  grains?: readonly string[]
  /** Explicit declaration-local relationship; the compiler alone projects the routing wire. */
  semanticIntentBindings?: readonly [
    ClientToolAnalyticalSemanticIntentBindingDefinition,
    ...ClientToolAnalyticalSemanticIntentBindingDefinition[],
  ]
  /** Exact enum-value mapping; missing or unmatched values preserve ordinary read-only execution. */
  closedEnumSelector?: ClientToolAnalyticalClosedEnumSelectorDefinition<TArgs>
  /** Required closed-enum input that receives the single measure selected from semantic intent bindings. */
  measureSelector?: Extract<keyof TArgs, string>
  /** Explicit logical output binding. Representation shape remains owned by the tool output declaration. */
  output: string
}

export interface ClientToolAnalyticalProducerDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> extends ClientToolAnalyticalProducerSemantics<TArgs> {
  criteria: readonly [string, ...string[]]
  ordering?: readonly ClientToolAnalyticalOrdering[]
  coverage: ClientToolAnalyticalCoverage
  continuation?: boolean
  /** Final canonical field semantics are authored by this optional output's resolver for each execution. */
  outputFields?: 'execution-authored'
}

type ClientToolBoundedAnalyticalAxisBinding<
  TArgs extends Record<string, unknown>,
> =
  | { axis: string; axisFromInput?: never }
  | { axis?: never; axisFromInput: Extract<keyof TArgs, string> }

export type ClientToolBoundedAnalyticalCriterion<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> = {
  name: string
  /** Semantic measure used to rank the bounded records. */
  measure: string
  direction: 'asc' | 'desc'
  /** Physical scalar field that carries the ranked measure. */
  valueField: string
  /** Physical dimension field that identifies each ranked coordinate. */
  coordinateField: string
} & ClientToolBoundedAnalyticalAxisBinding<TArgs>

export interface ClientToolBoundedAnalyticalProducerDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> extends ClientToolAnalyticalProducerSemantics<TArgs> {
  /** One explicit criterion binding is the sole owner of semantic and physical ranking facts. */
  criterion: ClientToolBoundedAnalyticalCriterion<TArgs>
  /** Exact argument that bounds the requested analytical scope. */
  boundedBy: Extract<keyof TArgs, string>
}

/**
 * Opaque authoring handle consumed only by defineClientTool. Business modules cannot inspect or construct wire metadata.
 */
export interface ClientToolAnalyticalAuthoring<TArgs extends Record<string, unknown>> {
  readonly [CLIENT_TOOL_ANALYTICAL_AUTHORING]: TArgs
}

type StoredClientToolAnalyticalAuthoring =
  | { kind: 'standard'; definition: ClientToolAnalyticalProducerDefinition<any> }
  | { kind: 'bounded'; definition: ClientToolBoundedAnalyticalProducerDefinition<any> }

const clientToolAnalyticalAuthoringDefinitions = new WeakMap<object, StoredClientToolAnalyticalAuthoring>()

const registerClientToolAnalyticalAuthoring = <TArgs extends Record<string, unknown>>(
  value: StoredClientToolAnalyticalAuthoring,
): ClientToolAnalyticalAuthoring<TArgs> => {
  const authoring = Object.freeze({}) as ClientToolAnalyticalAuthoring<TArgs>
  clientToolAnalyticalAuthoringDefinitions.set(authoring, value)
  return authoring
}

/** Declares analytical semantics without exposing the current agent-routing DTO. */
export const defineClientToolAnalyticalProducer = <
  TArgs extends Record<string, unknown> = Record<string, unknown>,
>(definition: ClientToolAnalyticalProducerDefinition<TArgs>): ClientToolAnalyticalAuthoring<TArgs> => (
  registerClientToolAnalyticalAuthoring<TArgs>({ kind: 'standard', definition })
)

/**
 * Declares a producer that completely covers one explicitly bounded requested scope. The compiler binds and verifies
 * the call automatically; business execution results never carry proof tokens.
 */
export const defineClientToolBoundedAnalyticalProducer = <TArgs extends Record<string, unknown>>(
  definition: ClientToolBoundedAnalyticalProducerDefinition<TArgs>,
): ClientToolAnalyticalAuthoring<TArgs> => (
  registerClientToolAnalyticalAuthoring<TArgs>({ kind: 'bounded', definition })
)

export interface ClientToolTemporalRangeDefinition<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> {
  rangeArgument: Extract<keyof TArgs, string>
  startArgument: Extract<keyof TArgs, string>
  endArgument: Extract<keyof TArgs, string>
  customValue: string
  encoding: AiClientToolAnalyticalTemporalArgumentBinding['encoding']
}

/** Opaque input-semantic edge created by shared time-scope helpers and consumed only by the analytical compiler. */
export interface ClientToolTemporalAuthoring<TArgs extends Record<string, unknown>> {
  readonly [CLIENT_TOOL_TEMPORAL_AUTHORING]: TArgs
}

const clientToolTemporalAuthoringDefinitions = new WeakMap<
  object,
  ClientToolTemporalRangeDefinition<Record<string, unknown>>
>()

/** Shared time-scope helpers use this factory so business tools never construct routing DTOs. */
export const defineClientToolTemporalRange = <TArgs extends Record<string, unknown>>(
  definition: ClientToolTemporalRangeDefinition<TArgs>,
): ClientToolTemporalAuthoring<TArgs> => {
  const authoring = Object.freeze({}) as ClientToolTemporalAuthoring<TArgs>
  clientToolTemporalAuthoringDefinitions.set(
    authoring,
    definition as ClientToolTemporalRangeDefinition<Record<string, unknown>>,
  )
  return authoring
}

export type ClientToolScopeCoordinateDefinition<TArgs extends Record<string, unknown>> =
  | {
      type: 'project'
      arguments: readonly []
    }
  | {
      type: 'area' | 'point'
      sourcePort: string
      arguments: readonly [Extract<keyof TArgs, string>]
    }

export interface ClientToolScopeDefinition<TArgs extends Record<string, unknown>> {
  /** Formal protocol discriminator for the closed project/explicit scope union. */
  modeArgument: Extract<keyof TArgs, string>
  valueCardinality: AiClientToolAnalyticalScopeArgumentBinding['valueCardinality']
  encoding: AiClientToolAnalyticalScopeArgumentBinding['encoding']
  coordinates: readonly ClientToolScopeCoordinateDefinition<TArgs>[]
}

/** Opaque input/resource edge created by shared scope helpers and consumed only by the analytical compiler. */
export interface ClientToolScopeAuthoring<TArgs extends Record<string, unknown>> {
  readonly [CLIENT_TOOL_SCOPE_AUTHORING]: TArgs
}

const clientToolScopeAuthoringDefinitions = new WeakMap<
  object,
  ClientToolScopeDefinition<Record<string, unknown>>
>()

/** Shared scope helpers use this factory so business tools never construct the analytical wire DTO. */
export const defineClientToolScope = <TArgs extends Record<string, unknown>>(
  definition: ClientToolScopeDefinition<TArgs>,
): ClientToolScopeAuthoring<TArgs> => {
  const authoring = Object.freeze({}) as ClientToolScopeAuthoring<TArgs>
  clientToolScopeAuthoringDefinitions.set(
    authoring,
    definition as ClientToolScopeDefinition<Record<string, unknown>>,
  )
  return authoring
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
  required: readonly string[]
  when?: ClientToolInputCondition
  /** Additional independent discriminators for a closed cross-product branch. */
  alsoWhen?: readonly ClientToolInputCondition[]
  forbidden?: readonly string[]
}

/** Opaque catalog-value edge; the compiler owns cardinality, encoding and wire projection. */
export interface ClientToolStringArgumentAuthoring<TArgs extends Record<string, unknown>> {
  readonly [CLIENT_TOOL_STRING_ARGUMENT_AUTHORING]: TArgs
}

interface ClientToolStringArgumentAuthoringDefinition {
  argument: string
  contextSource?: {
    kind: 'subject'
    selection: 'primary'
    subjectType: string
    coordinate: 'id'
  }
}

const clientToolStringArgumentAuthoringDefinitions = new WeakMap<
  object,
  ClientToolStringArgumentAuthoringDefinition
>()

/** Binds one canonical catalog value to an exact top-level string input without exposing the routing DTO. */
export const defineClientToolStringArgumentBinding = <TArgs extends Record<string, unknown>>(
  argument: Extract<keyof TArgs, string>,
): ClientToolStringArgumentAuthoring<TArgs> => {
  const authoring = Object.freeze({}) as ClientToolStringArgumentAuthoring<TArgs>
  clientToolStringArgumentAuthoringDefinitions.set(authoring, { argument })
  return authoring
}

/** Binds the primary subject id from session context without exposing routing metadata to a business tool. */
export const defineClientToolPrimarySubjectArgumentBinding = <
  TArgs extends Record<string, unknown>,
>(
  argument: Extract<keyof TArgs, string>,
  subjectType: string,
): ClientToolStringArgumentAuthoring<TArgs> => {
  const authoring = Object.freeze({}) as ClientToolStringArgumentAuthoring<TArgs>
  clientToolStringArgumentAuthoringDefinitions.set(authoring, {
    argument,
    contextSource: {
      kind: 'subject',
      selection: 'primary',
      subjectType,
      coordinate: 'id',
    },
  })
  return authoring
}

export interface ClientToolCanonicalConsumedResource<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string
  type: AiClientToolResourceType
  mediaType: string
  shape: string
  required: boolean
  sourcePolicy: AiClientToolSourcePolicy
  /** Compile-time-only semantic target; never serialized as authoring metadata. */
  bindArgument?: ClientToolStringArgumentAuthoring<TArgs>
  optional?: never
  source?: never
}

/**
 * Released client-tool modules may still provide the former name-only consumer declaration. It is projected only to
 * flat discovery metadata and never promoted to a canonical descriptor whose representation cannot be proven.
 */
export interface ClientToolLegacyConsumedResource {
  name: string
  optional?: boolean
  source?: AiClientToolSourcePolicy
  type?: never
  mediaType?: never
  shape?: never
  required?: never
  sourcePolicy?: never
}

export type ClientToolConsumedResource<
  TArgs extends Record<string, unknown> = Record<string, unknown>,
> =
  | ClientToolCanonicalConsumedResource<TArgs>
  | ClientToolLegacyConsumedResource

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

export interface ClientToolPreparedConfirmation {
  title?: string
  content?: string
}

export interface ClientToolPreparedExecution<TArgs extends Record<string, unknown>> {
  arguments: TArgs
  confirmation?: ClientToolPreparedConfirmation
}

export type ClientToolPreparationResult<TArgs extends Record<string, unknown>> =
  | ClientToolPreparedExecution<TArgs>
  | ClientToolExecutionResult<never>

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
  type?: AiClientToolResourceType
  mediaType?: string
  shape: string
  /** Generic delivery audience; the compiler always emits it on the canonical port. */
  audience?: AiClientToolOutputAudience
  /** Explicit JSON path to records within the logical selected source; materialization carriers are not source data. */
  recordPath?: string
  label?: string
  fields?: readonly AiClientToolOutputField[]
  /** Renderer-neutral ordering guaranteed by the producer. */
  ordering?: AiClientToolOrdering
  /**
   * Maps producer-owned ordering from this execution to the selected output. When declared, this mapping owns
   * ordering exclusively: undefined leaves the invocation unordered instead of inferring order from arguments.
   */
  resolveOrdering?: (
    result: TResult,
    selectedValue: unknown,
    fields: readonly AiClientToolOutputField[],
  ) => AiClientToolOrdering | undefined
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

interface ClientToolStructuredOutputBase<TResult> extends ClientToolOutputBase<TResult> {
  /** Explicit producer delivery overrides default inference and carries no renderer semantics. */
  delivery?: Extract<AiClientToolRoutingResultDelivery, 'inline' | 'auto'>
}

export interface ClientToolLookupOutput<TResult = unknown> extends ClientToolStructuredOutputBase<TResult> {
  kind: 'lookup'
}

export interface ClientToolDetailOutput<TResult = unknown> extends ClientToolStructuredOutputBase<TResult> {
  kind: 'detail'
}

export interface ClientToolRecordSetOutput<TResult = unknown> extends ClientToolStructuredOutputBase<TResult> {
  kind: 'recordSet'
}

export interface ClientToolAggregateSeriesOutput<TResult = unknown> extends ClientToolStructuredOutputBase<TResult> {
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
  requestSatisfied?: boolean
  exhaustive?: boolean
  displayTruncated?: boolean
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
  requestSatisfied?: boolean
  exhaustive?: boolean
  displayTruncated?: boolean
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
    complete: options.requestSatisfied ?? true,
    truncated: options.displayTruncated ?? false,
    ...(options.requestSatisfied !== undefined ? { requestSatisfied: options.requestSatisfied } : {}),
    ...(options.exhaustive !== undefined ? { exhaustive: options.exhaustive } : {}),
    ...(options.displayTruncated !== undefined ? { displayTruncated: options.displayTruncated } : {}),
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
    complete: options.requestSatisfied ?? false,
    // Partial population coverage does not imply that the delivered representation omitted records.
    truncated: options.displayTruncated ?? false,
    ...(options.requestSatisfied !== undefined ? { requestSatisfied: options.requestSatisfied } : {}),
    ...(options.exhaustive !== undefined ? { exhaustive: options.exhaustive } : {}),
    ...(options.displayTruncated !== undefined ? { displayTruncated: options.displayTruncated } : {}),
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

const defaultOutputAudience = (kind: ClientToolOutput['kind']): AiClientToolOutputAudience => (
  kind === 'artifact' ? 'reusable-source' : 'model-evidence'
)

const inferredOutputDelivery = <TResult>(
  output: ClientToolOutput<TResult>,
): AiClientToolRoutingResultDelivery => {
  if (output.kind === 'artifact') return 'file'
  const audience = output.audience || defaultOutputAudience(output.kind)
  return output.kind === 'recordSet' && audience !== 'model-evidence' ? 'auto' : 'inline'
}

const outputDelivery = <TResult>(
  output: ClientToolOutput<TResult>,
): AiClientToolRoutingResultDelivery => (
  output.kind !== 'artifact' && output.kind !== 'stateChange' && output.delivery
    ? output.delivery
    : inferredOutputDelivery(output)
)

/** Stable, renderer-neutral output presets. Selectors run after the business operation and never retry it. */
export const clientToolOutput = {
  lookup: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'lookup'>): ClientToolLookupOutput<TResult> => ({
    kind: 'lookup',
    ...output,
    audience: output.audience || defaultOutputAudience('lookup'),
  }),
  detail: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'detail'>): ClientToolDetailOutput<TResult> => ({
    kind: 'detail',
    ...output,
    audience: output.audience || defaultOutputAudience('detail'),
  }),
  recordSet: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'recordSet'>): ClientToolRecordSetOutput<TResult> => ({
    kind: 'recordSet',
    ...output,
    audience: output.audience || defaultOutputAudience('recordSet'),
  }),
  aggregateSeries: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'aggregateSeries'>): ClientToolAggregateSeriesOutput<TResult> => ({
    kind: 'aggregateSeries',
    ...output,
    audience: output.audience || defaultOutputAudience('aggregateSeries'),
  }),
  artifact: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'artifact'>): ClientToolArtifactOutput<TResult> => ({
    kind: 'artifact',
    ...output,
    audience: output.audience || defaultOutputAudience('artifact'),
  }),
  stateChange: <TResult = unknown>(output: ClientToolOutputConfig<TResult, 'stateChange'>): ClientToolStateChangeOutput<TResult> => ({
    kind: 'stateChange',
    ...output,
    audience: output.audience || defaultOutputAudience('stateChange'),
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
  consumes?: readonly ClientToolConsumedResource<TArgs>[]
  /** Compile-time-only flag for non-terminal scope/discovery preparation; never serialized as a second role. */
  preparation?: true
  analytical?: ClientToolAnalyticalAuthoring<TArgs>
  /** Opaque typed time-scope edge; the compiler projects it only into the canonical analytical capability. */
  temporal?: ClientToolTemporalAuthoring<TArgs>
  /** Opaque typed subject-scope edge; resource provenance and argument targets remain compiler-owned. */
  scope?: ClientToolScopeAuthoring<TArgs>
  effect: ClientToolEffect<TContext>
  output: ClientToolOutput<TResult> | readonly ClientToolOutput<TResult>[]
  presentation?: ClientToolPresentation
  owner?: ClientToolOwner
  /**
   * Validates and normalizes a side-effect target before confirmation. A failure ends the call without prompting;
   * execution must still revalidate mutable external state after approval.
   */
  prepare?: (
    args: TArgs,
    context: TContext,
    call: AiClientToolCall,
  ) => ClientToolPreparationResult<TArgs> | Promise<ClientToolPreparationResult<TArgs>>
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
  const intents = uniqueText(description.intents)
  if (!text) throw new Error('Client tool description text is required')
  if (!capabilities.length) throw new Error('Client tool capability is required')
  return { text, capabilities, intents }
}

const normalizeOutputs = <TResult>(output: ClientToolDefinition<any, any, TResult>['output']) => {
  const outputs = asArray(output)
  if (!outputs.length) throw new Error('Client tool requires at least one output')
  const names = new Set<string>()
  outputs.forEach((item) => {
    const name = normalizedText(item.name)
    const shape = normalizedText(item.shape)
    if (!name || !shape) throw new Error('Client tool output requires a stable name and shape')
    if (item.audience !== undefined
      && !(['model-evidence', 'client-presentation', 'reusable-source'] as const).includes(item.audience)) {
      throw new Error(`Client tool output audience is invalid: ${name}`)
    }
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

const compilePreparation = (
  value: true | undefined,
  analytical: CompiledClientToolAnalyticalAuthoring | undefined,
) => {
  if (value === undefined) return undefined
  if (value !== true) throw new Error('Client tool preparation flag must be true when declared')
  if (analytical) {
    throw new Error('Client tool preparation cannot declare analytical producer authority')
  }
  return ['preparation'] as const
}

const outputSlotPath = (index: number) => `$.__clientToolOutputs.output${index}`

const CANONICAL_CONSUMER_FIELDS = ['type', 'mediaType', 'shape', 'required', 'sourcePolicy'] as const

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key)

const isCanonicalConsumer = <TArgs extends Record<string, unknown>>(
  value: ClientToolConsumedResource<TArgs>,
): value is ClientToolCanonicalConsumedResource<TArgs> => CANONICAL_CONSUMER_FIELDS.every(key => hasOwn(value, key))

const isLegacyConsumer = (
  value: ClientToolConsumedResource<any>,
): value is ClientToolLegacyConsumedResource => CANONICAL_CONSUMER_FIELDS.every(key => !hasOwn(value, key))

type CompiledClientToolConsumedResources = {
  status: 'valid' | 'malformed'
  canonical: AiClientToolConsumerPort[]
  legacy: ClientToolLegacyConsumedResource[]
}

const isSingleStringInput = (input: ClientToolInput | undefined) => {
  const valueType = input?.valueType
  return normalizedText(typeof valueType === 'string' ? valueType : valueType?.type).toLowerCase() === 'string'
}

const compileConsumedResources = <TArgs extends Record<string, unknown>>(
  consumes: readonly ClientToolConsumedResource<TArgs>[],
  inputs: readonly ClientToolInput[],
): CompiledClientToolConsumedResources => {
  if (!consumes.length) return { status: 'valid', canonical: [], legacy: [] }
  const canonical = consumes.filter(isCanonicalConsumer)
  const legacy = consumes.filter(isLegacyConsumer)
  if (canonical.length !== consumes.length && legacy.length !== consumes.length) {
    throw new Error('Client tool consumers must use either canonical descriptors or legacy name-only declarations')
  }
  const compiled = canonical.map((resource): AiClientToolConsumerPort | undefined => {
    const port: AiClientToolConsumerPort = {
      name: normalizedText(resource.name),
      type: resource.type,
      mediaType: normalizedText(resource.mediaType).toLowerCase(),
      shape: normalizedText(resource.shape).toLowerCase(),
      required: resource.required === true,
      sourcePolicy: resource.sourcePolicy,
    }
    if (!resource.bindArgument) return port
    const authoring = clientToolStringArgumentAuthoringDefinitions.get(resource.bindArgument)
    const argument = normalizedText(authoring?.argument)
    const subjectType = normalizedText(authoring?.contextSource?.subjectType)
    const contextSource = authoring?.contextSource && subjectType
      && subjectType.length <= 160
      ? {
          ...authoring.contextSource,
          subjectType,
        }
      : undefined
    const matches = inputs.filter(input => normalizedText(input.id) === argument)
    if (!argument || matches.length !== 1 || !isSingleStringInput(matches[0])
      || (resource.sourcePolicy === 'TOOL' && contextSource)
      || (resource.sourcePolicy === 'CONTEXT' && !contextSource)
      || (authoring?.contextSource && !contextSource)) return undefined
    return {
      ...port,
      argumentBinding: {
        argument: matches[0].id,
        valueCardinality: 'exactly-one',
        encoding: 'single-string',
        ...(contextSource ? { contextSource } : {}),
      },
    }
  })
  const argumentsSeen = new Set<string>()
  const malformed = compiled.some(port => !port)
    || compiled.some((port) => {
      const argument = port?.argumentBinding?.argument
      if (!argument) return false
      if (argumentsSeen.has(argument)) return true
      argumentsSeen.add(argument)
      return false
    })
  return {
    status: malformed ? 'malformed' : 'valid',
    canonical: malformed
      ? canonical.map((resource): AiClientToolConsumerPort => ({
          name: normalizedText(resource.name),
          type: resource.type,
          mediaType: normalizedText(resource.mediaType).toLowerCase(),
          shape: normalizedText(resource.shape).toLowerCase(),
          required: resource.required === true,
          sourcePolicy: resource.sourcePolicy,
        }))
      : compiled as AiClientToolConsumerPort[],
    legacy,
  }
}

const compileOutputContract = <TResult>(
  output: ClientToolOutput<TResult>,
  index: number,
): AiClientToolOutputContract => {
  const shared = {
    name: normalizedText(output.name),
    type: output.kind === 'artifact'
      ? 'artifact'
      : output.type || (output.kind === 'stateChange' ? 'state' : 'structured-data'),
    mediaType: normalizedText(output.mediaType || 'application/json'),
    shape: normalizedText(output.shape),
    audience: output.audience || defaultOutputAudience(output.kind),
    ...(output.recordPath !== undefined ? { recordPath: output.recordPath } : {}),
    ...(output.label ? { label: output.label } : {}),
    ...(output.fields?.length ? { fields: output.fields.map(field => ({ ...field })) } : {}),
    ...(!output.resolveOrdering && output.ordering ? { ordering: output.ordering } : {}),
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
    delivery: outputDelivery(output) as 'inline' | 'auto',
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
  compiledConsumes: CompiledClientToolConsumedResources,
  outputs: readonly ClientToolOutput<TResult>[],
  analyticalCapability?: AiClientToolAnalyticalCapability,
  temporalArgumentBinding?: AiClientToolAnalyticalTemporalArgumentBinding,
  workflowStages?: readonly ('preparation' | 'execution')[],
) => {
  const { capabilities, intents } = normalizeDescription(definition.description)
  const routingKind = resolveRoutingKind(definition.effect, outputs)
  const baseContract = defineAiClientToolContract({
    routingKind,
    routing: {
      capabilities,
      ...(definition.description.aliases?.length ? { aliases: uniqueText(definition.description.aliases) } : {}),
      ...(intents.length ? { intents } : {}),
      ...(definition.description.notFor?.length ? { notFor: uniqueText(definition.description.notFor) } : {}),
      exposure: resolveActivation(definition.description.activation),
      ...(definition.effect.kind === 'READ' ? {} : { cost: 'medium' as const }),
      ...(workflowStages ? { stages: [...workflowStages] } : {}),
      ...(temporalArgumentBinding ? { temporalArgumentBinding } : {}),
      ...(analyticalCapability ? { analyticalCapability } : {}),
    },
    inputs: compiledConsumes.canonical.map(input => ({ ...input })),
    outputs: outputs.map(compileOutputContract),
  })
  const contract: AiClientToolContractFragment = compiledConsumes.canonical.length
    ? {
        ...baseContract,
        routing: {
          ...baseContract.routing,
          consumerPorts: compiledConsumes.canonical.map(input => ({ ...input })),
        },
      }
    : baseContract
  if (!compiledConsumes.legacy.length) return contract

  // A name-only legacy consumer keeps its released discovery behavior without fabricating canonical identity.
  const accepts = uniqueText(compiledConsumes.legacy.map(input => input.name))
  const prerequisites = uniqueText(compiledConsumes.legacy.filter(input => !input.optional).map(input => input.name))
  return {
    ...contract,
    routing: {
      ...contract.routing,
      ...(accepts.length ? { accepts } : {}),
      ...(prerequisites.length ? { prerequisites } : {}),
    },
    _meta: {
      ...contract._meta,
      ...(prerequisites.length ? { prerequisites } : {}),
    },
  }
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
    const valueType = input.valueType
    const dateTime = !!valueType
      && typeof valueType === 'object'
      && valueType.type === 'date'
    return {
      ...(description ? { description } : {}),
      ...(dateTime ? { type: 'string', format: 'date-time' } : {}),
    }
  }
  return {
    type: 'object' as const,
    oneOf: alternatives.map((alternative) => {
      const conditions = [
        ...(alternative.when ? [alternative.when] : []),
        ...(alternative.alsoWhen || []),
      ]
      const required = uniqueText(alternative.required)
      const conditionByInput = new Map<string, ClientToolInputCondition>()
      for (const condition of conditions) {
        const input = normalizedText(condition.input)
        if (!input || conditionByInput.has(input)) {
          throw new Error(`Client tool ${toolId} input alternative has ambiguous condition input`)
        }
        conditionByInput.set(input, condition)
      }
      const conditionInputs = [...conditionByInput.keys()]
      const forbidden = uniqueText(alternative.forbidden)
      uniqueText([...required, ...conditionInputs, ...forbidden]).forEach(branchProperty)
      // Composed branches are audited independently; root inputs still own the actual value constraints.
      const properties = Object.fromEntries(uniqueText([...required, ...conditionInputs]).map((inputId) => {
        const condition = conditionByInput.get(inputId)
        const constraint = condition
          ? ('equals' in condition ? { const: condition.equals } : { enum: [...condition.oneOf] })
          : {}
        return [inputId, { ...branchProperty(inputId), ...constraint }]
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
  ordering: AiClientToolOrdering | undefined,
) => {
  if (isInternalDescriptor(value, MATERIALIZED_ARTIFACT_KIND)
    || isInternalDescriptor(value, MATERIALIZED_RECORD_STREAM_KIND)) {
    return {
      ...(value as Record<string, unknown>),
      bindingName: output.name,
      ...(label ? { bindingLabel: label } : {}),
      outputShape: output.shape,
      ...(output.recordPath ? { recordPath: output.recordPath } : {}),
      ...(fields?.length ? { fields: fields.map(field => ({ ...field })) } : {}),
      ...(output.resolveOrdering ? { ordering } : ordering ? { ordering } : {}),
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
      ...(ordering ? { ordering } : {}),
    })
  }
  return undefined
}

type CompiledClientToolAnalyticalAuthoring =
  | { status: 'malformed' }
  | {
      status: 'standard'
      capability: AiClientToolAnalyticalCapability
      output: string
      validationMode: 'static' | 'execution-authored'
    }
  | {
      status: 'bounded'
      capability: AiClientToolAnalyticalCapability
      limitInput: string
      defaultLimit?: unknown
      minimum?: number
      maximum?: number
      output: string
      physicalOrdering: AiClientToolOrdering
      fieldBinding: {
        valueField: string
        coordinateField: string
        axis?: string
        axisFromInput?: string
      }
    }

const resolveAnalyticalCoverage = (
  coverage: ClientToolAnalyticalCoverage,
  continuation: boolean,
) => {
  if (coverage === 'complete') return { complete: true, partial: false, continuation }
  if (coverage === 'partial') return { complete: false, partial: true, continuation }
  if (coverage === 'complete-or-partial') return { complete: true, partial: true, continuation }
  return undefined
}

/**
 * Keeps analytical display semantics compatible with the declared physical scalar type. Generic/legacy field
 * normalization remains permissive because display formatting alone never grants analytical authority.
 */
const isAnalyticalFieldTypeAndDisplayFormatCompatible = (
  field: AiClientToolCanonicalOutputField,
) => {
  const format = normalizedText(field.format).toLowerCase()
  if (!format) return true
  switch (field.type) {
    case 'string':
      return format === 'auto' || format === 'text'
    case 'integer':
      return ['integer', 'number', 'decimal'].includes(format)
    case 'number':
      return ['number', 'decimal'].includes(format)
        || (format === 'percent'
          && ['%', 'percent', 'percentage'].includes(normalizedText(field.unit).toLowerCase()))
    case 'boolean':
      return format === 'boolean'
    case 'timestamp':
      return format === 'datetime'
    case 'duration':
      return format === 'duration'
    case 'object':
      return format === 'json'
    default:
      return false
  }
}

const validatesStandardAnalyticalOutputSemantics = <TResult>(
  capability: AiClientToolAnalyticalCapability,
  output: ClientToolOutput<TResult>,
  fields: readonly AiClientToolOutputField[] | undefined = output.fields,
  validationMode: 'static' | 'execution-authored' = 'static',
  finalFields: boolean = validationMode === 'static',
) => {
  const fieldSet = capability.output.fieldSet
  const normalizedFields = normalizeAiClientToolOutputFields(fields, fieldSet?.maxFields)
  if (!normalizedFields || normalizedFields.length !== (fields?.length || 0)) return false
  const canonicalFields = normalizedFields.filter(isCanonicalAiClientToolOutputField)
  if (canonicalFields.some(field => !isAnalyticalFieldTypeAndDisplayFormatCompatible(field))) return false
  if (validationMode === 'execution-authored'
    && (!fieldSet || fieldSet.mode !== 'execution-authored'
      || canonicalFields.length !== normalizedFields.length)) return false
  const axisFields = canonicalFields.filter(field => field.axis)
  const measureFields = canonicalFields.filter(field => field.role === 'measure')
  const axes = axisFields.map(field => field.axis!)
  if (new Set(axes).size !== axes.length
    || axes.some(axis => !capability.dimensions.includes(axis))) return false

  const typedSummary = canonicalFields.length > 0
    && capability.criteria.length === 1
    && capability.criteria[0] === 'summary'
  const timeTrend = capability.criteria.includes('trend') && capability.dimensions.includes('time')
  const validateMeasures = validationMode === 'static' || finalFields
  const requiresExactMeasures = validationMode === 'execution-authored' || typedSummary || timeTrend
  if (validationMode === 'execution-authored' && !validateMeasures && measureFields.length) return false
  if (validateMeasures && requiresExactMeasures && !measureFields.length) return false
  if (validateMeasures && requiresExactMeasures) {
    if (measureFields.some(field => (
      !['integer', 'number'].includes(field.type)
      || !normalizedText(field.label)
      || !normalizedText(field.measure)
    ))) return false
    if (validationMode === 'execution-authored') {
      const memberMeasures = measureFields.map(field => normalizedText(field.measure).toLowerCase())
      const memberLabels = measureFields.map(field => normalizedText(field.label).toLowerCase())
      if (measureFields.length > 32
        || measureFields.some(field => (
          !ANALYTICAL_TOKEN_PATTERN.test(normalizedText(field.measure).toLowerCase())
          || !normalizedText(field.unit)
        ))
        || new Set(memberMeasures).size !== memberMeasures.length
        || new Set(memberLabels).size !== memberLabels.length) return false
      if (!fieldSet) return false
      if (fieldSet.measureCoordinates === 'exact') {
        if (measureFields.some(field => {
          const measure = capability.measures.find(candidate => (
            candidate.name === normalizedText(field.measure).toLowerCase()
          ))
          const aggregation = normalizedText(field.aggregation).toLowerCase()
          const unit = normalizedText(field.unit).toLowerCase()
          return !measure || !measure.aggregations.includes(aggregation)
            || (measure.units.length > 0 && !measure.units.includes(unit))
        })) return false
      } else {
        if (capability.measures.length !== 1) return false
        const family = capability.measures[0]
        if (measureFields.some(field => (
          !family.aggregations.includes(normalizedText(field.aggregation).toLowerCase())
          || (family.units.length > 0 && !family.units.includes(normalizedText(field.unit).toLowerCase()))
        ))) return false
      }
    } else {
      if (measureFields.some(field => (
        capability.measures.filter(measure => measure.name === normalizedText(field.measure).toLowerCase()).length !== 1
      ))) return false
      for (const measure of capability.measures) {
        const matchingFields = measureFields.filter(field => (
          normalizedText(field.measure).toLowerCase() === measure.name
        ))
        if (matchingFields.length !== 1) return false
        const field = matchingFields[0]
        const aggregation = normalizedText(field.aggregation).toLowerCase()
        const unit = normalizedText(field.unit).toLowerCase()
        if (!aggregation || !unit
          || !measure.aggregations.includes(aggregation)
          || (measure.units.length > 0 && !measure.units.includes(unit))) return false
      }
    }
  }

  // Typed scalar summaries and time-based trend promotion require exact physical measures. Execution-authored fields
  // preserve the same time/order proof but retain their execution-selected concrete coordinates.
  // Time/order proof is a trend requirement. Dynamic rank and comparison outputs can legitimately have no time axis.
  if (!timeTrend) return true
  const temporalFields = canonicalFields.filter(field => field.role === 'temporal_dimension')
  if (temporalFields.length !== 1
    || temporalFields[0].axis !== 'time'
    || temporalFields[0].role !== 'temporal_dimension'
    || temporalFields[0].type !== 'timestamp') return false
  const ordering = output.ordering
  if (!ordering
    || !ordering.producerGuaranteed
    || ordering.keys.length !== capability.ordering.length
    || ordering.keys.some(key => key.field !== temporalFields[0].name)
    || ordering.keys.some((key, index) => (
      key.field !== capability.ordering[index]?.axis
      || key.direction !== capability.ordering[index]?.direction
    ))) return false
  return true
}

const resolveAnalyticalAxisEnum = (input: ClientToolInput | undefined): string[] | undefined => {
  const valueType = input?.valueType
  if (!valueType || typeof valueType !== 'object'
    || normalizedText(valueType.type).toLowerCase() !== 'enum'
    || normalizedText(valueType.valueType?.type).toLowerCase() !== 'string'
    || !Array.isArray(valueType.elements)
    || !valueType.elements.length) return undefined
  const values: string[] = []
  const seen = new Set<string>()
  for (const element of valueType.elements) {
    if (!element || typeof element !== 'object' || typeof element.value !== 'string') return undefined
    const value = normalizedText(element.value)
    if (!value || value !== element.value || value !== value.toLowerCase() || seen.has(value)) return undefined
    seen.add(value)
    values.push(value)
  }
  return values
}

const matchesAnalyticalDimensions = (
  values: readonly string[] | undefined,
  dimensions: readonly string[],
) => !!values
  && values.length === dimensions.length
  && values.every(value => dimensions.includes(value))

const isExactAnalyticalToken = (value: unknown) => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= 160
  && ANALYTICAL_TOKEN_PATTERN.test(value)
)

const isExactAnalyticalArgument = (value: unknown) => (
  typeof value === 'string'
  && value.length > 0
  && value.length <= 160
  && /^[A-Za-z_][A-Za-z0-9_-]{0,159}$/.test(value)
)

const hasFilterBindings = (analytical: ClientToolAnalyticalAuthoring<any> | undefined) => {
  if (!analytical) return false
  const stored = clientToolAnalyticalAuthoringDefinitions.get(analytical)
  return stored?.definition.filterBindings !== undefined
}

type CompiledClientToolFilterAuthoring =
  | { status: 'malformed' }
  | { status: 'valid'; bindings: AiClientToolAnalyticalFilterArgumentBinding[] }

const compileFilterAuthoring = <TArgs extends Record<string, unknown>>(
  value: readonly ClientToolAnalyticalFilterBindingDefinition<TArgs>[] | undefined,
  filters: readonly string[] | undefined,
  inputs: readonly ClientToolInput[],
  parameterSchema: AiClientToolParameterSchema | undefined,
): CompiledClientToolFilterAuthoring | undefined => {
  if (value === undefined) return filters?.length ? { status: 'malformed' } : undefined
  if (!Array.isArray(value) || !value.length || !Array.isArray(filters)) return { status: 'malformed' }
  const axes = new Set(filters)
  if (filters.some(axis => !isExactAnalyticalToken(axis)) || axes.size !== filters.length) {
    return { status: 'malformed' }
  }
  const bindings: AiClientToolAnalyticalFilterArgumentBinding[] = []
  const pairs = new Set<string>()
  for (const rawBinding of value) {
    if (!rawBinding || typeof rawBinding !== 'object' || Array.isArray(rawBinding)
      || !isExactAnalyticalToken(rawBinding.axis) || !axes.has(rawBinding.axis)
      || !isExactAnalyticalArgument(rawBinding.valueArgument)) return { status: 'malformed' }
    if ('operator' in rawBinding) {
      const stringArray = rawBinding.valueCardinality === 'one-or-more'
        && rawBinding.encoding === 'string-array'
      const scalar = rawBinding.valueCardinality === undefined && rawBinding.encoding === undefined
      if ((!scalar && !stringArray)
        || Object.keys(rawBinding).length !== (stringArray ? 5 : 3)
        || !isExactAnalyticalToken(rawBinding.operator)) return { status: 'malformed' }
      const pair = `${rawBinding.axis}\u0000${rawBinding.operator}`
      if (pairs.has(pair)) return { status: 'malformed' }
      pairs.add(pair)
      if (stringArray) {
        bindings.push({
          semantic: 'filter',
          axis: rawBinding.axis,
          operator: rawBinding.operator,
          valueArgument: rawBinding.valueArgument,
          valueCardinality: 'one-or-more',
          encoding: 'string-array',
        })
      } else {
        bindings.push({
          semantic: 'filter',
          axis: rawBinding.axis,
          operator: rawBinding.operator,
          valueArgument: rawBinding.valueArgument,
          valueCardinality: 'exactly-one',
          encoding: 'scalar',
        })
      }
      continue
    }
    if (Object.keys(rawBinding).length !== 4
      || !Array.isArray(rawBinding.operators) || !rawBinding.operators.length
      || !isExactAnalyticalArgument(rawBinding.operatorArgument)) return { status: 'malformed' }
    const operators = [...rawBinding.operators]
    if (operators.some(operator => !isExactAnalyticalToken(operator))
      || new Set(operators).size !== operators.length) return { status: 'malformed' }
    if (operators.some(operator => pairs.has(`${rawBinding.axis}\u0000${operator}`))) {
      return { status: 'malformed' }
    }
    operators.forEach(operator => pairs.add(`${rawBinding.axis}\u0000${operator}`))
    bindings.push({
      semantic: 'filter',
      axis: rawBinding.axis,
      operators,
      operatorArgument: rawBinding.operatorArgument,
      valueArgument: rawBinding.valueArgument,
      valueCardinality: 'one-or-more',
      encoding: 'string-array',
    })
  }
  return bindings.every(binding => validateAiClientToolAnalyticalFilterBinding({
    inputs: inputs.map(input => ({ ...input })),
    parameterSchema,
  }, binding))
    ? { status: 'valid', bindings }
    : { status: 'malformed' }
}

type CompiledClientToolTemporalAuthoring =
  | { status: 'malformed' }
  | { status: 'valid'; binding: AiClientToolAnalyticalTemporalArgumentBinding }

type CompiledClientToolScopeAuthoring =
  | { status: 'malformed' }
  | { status: 'valid'; binding: AiClientToolAnalyticalScopeArgumentBinding }

const compileTemporalAuthoring = <TArgs extends Record<string, unknown>>(
  temporal: ClientToolTemporalAuthoring<TArgs> | undefined,
  inputs: readonly ClientToolInput[],
  parameterSchema: AiClientToolParameterSchema | undefined,
  providedArguments: readonly string[] = [],
): CompiledClientToolTemporalAuthoring | undefined => {
  if (!temporal) return undefined
  const stored = clientToolTemporalAuthoringDefinitions.get(temporal)
  if (!stored) return { status: 'malformed' }
  const binding: AiClientToolAnalyticalTemporalArgumentBinding = {
    semantic: 'temporal',
    rangeArgument: normalizedText(stored.rangeArgument),
    startArgument: normalizedText(stored.startArgument),
    endArgument: normalizedText(stored.endArgument),
    customValue: normalizedText(stored.customValue),
    encoding: stored.encoding,
  }
  return validateAiClientToolAnalyticalTemporalBinding({
    inputs: inputs.map(input => ({ ...input })),
    parameterSchema,
  }, binding, providedArguments)
    ? { status: 'valid', binding }
    : { status: 'malformed' }
}

const compileScopeAuthoring = <TArgs extends Record<string, unknown>>(
  scope: ClientToolScopeAuthoring<TArgs> | undefined,
  inputs: readonly ClientToolInput[],
  parameterSchema: AiClientToolParameterSchema | undefined,
  consumerPorts: readonly AiClientToolConsumerPort[],
): CompiledClientToolScopeAuthoring | undefined => {
  if (!scope) return undefined
  const stored = clientToolScopeAuthoringDefinitions.get(scope)
  if (!stored) return { status: 'malformed' }
  const binding: AiClientToolAnalyticalScopeArgumentBinding = {
    semantic: 'scope',
    modeArgument: normalizedText(stored.modeArgument),
    valueCardinality: stored.valueCardinality,
    encoding: stored.encoding,
    coordinates: stored.coordinates.map((coordinate) => (
      coordinate.type === 'project'
        ? { type: 'project' as const, arguments: [] }
        : {
            type: coordinate.type,
            sourcePort: normalizedText(coordinate.sourcePort).toLowerCase(),
            arguments: [normalizedText(coordinate.arguments[0])],
          }
    )),
  }
  return validateAiClientToolAnalyticalScopeBinding({
    inputs: inputs.map(input => ({ ...input })),
    parameterSchema,
    consumerPorts: consumerPorts.map(port => ({ ...port })),
  }, binding)
    ? { status: 'valid', binding }
    : { status: 'malformed' }
}

const compileAnalyticalSemanticIntentBindings = (
  value: unknown,
  descriptionIntents: readonly string[],
  compiledScope: CompiledClientToolScopeAuthoring | undefined,
  inputs: readonly ClientToolInput[],
  outputs: readonly ClientToolOutput<any>[],
): AiClientToolAnalyticalSemanticIntentBinding[] | false | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value) || !value.length) return false
  const bindings: AiClientToolAnalyticalSemanticIntentBinding[] = []
  const seenIntents = new Set<string>()
  const normalizeCoordinates = (coordinates: unknown): string[] | undefined => {
    if (!Array.isArray(coordinates) || !coordinates.length
      || coordinates.some(item => typeof item !== 'string')) return undefined
    const normalized = coordinates.map(item => normalizedText(item).toLowerCase())
    if (normalized.some(item => !item) || new Set(normalized).size !== normalized.length) return undefined
    return normalized
  }
  for (const rawBinding of value) {
    if (!rawBinding || typeof rawBinding !== 'object' || Array.isArray(rawBinding)) return false
    const binding = rawBinding as Record<string, unknown>
    const hasScopeSelection = Object.prototype.hasOwnProperty.call(binding, 'scopeSelection')
    if (Object.keys(binding).length !== (hasScopeSelection ? 5 : 4)) return false
    if (typeof binding.intent !== 'string' || typeof binding.criterion !== 'string') return false
    const intent = normalizedText(binding.intent)
    const criterion = normalizedText(binding.criterion).toLowerCase()
    const measures = normalizeCoordinates(binding.measures)
    const dimensions = normalizeCoordinates(binding.dimensions)
    const rawScopeSelection = binding.scopeSelection
    const outputBinding = rawScopeSelection && typeof rawScopeSelection === 'object'
      ? (rawScopeSelection as Record<string, unknown>).outputBinding : undefined
    const outputScopeValid = typeof outputBinding === 'string' && !!outputBinding.trim()
      && compiledScope === undefined
      && inputs.filter(input => input.id === 'scope' && input.required && input.valueType?.type === 'object').length === 1
      && outputs.filter(output => output.name === outputBinding && output.kind === 'detail').length === 1
    const scopeSelection = !hasScopeSelection
      ? undefined
      : rawScopeSelection && typeof rawScopeSelection === 'object' && !Array.isArray(rawScopeSelection)
        && Object.keys(rawScopeSelection).length === (outputBinding === undefined ? 2 : 3)
        && (rawScopeSelection as Record<string, unknown>).binding === 'scope'
        && Array.isArray((rawScopeSelection as Record<string, unknown>).modes)
        && ((rawScopeSelection as Record<string, unknown>).modes as unknown[]).length === 2
        && ((rawScopeSelection as Record<string, unknown>).modes as unknown[])[0] === 'project'
        && ((rawScopeSelection as Record<string, unknown>).modes as unknown[])[1] === 'explicit'
        && (outputBinding === undefined ? compiledScope?.status === 'valid' : outputScopeValid)
          ? { binding: 'scope' as const, modes: ['project', 'explicit'] as ['project', 'explicit'],
              ...(typeof outputBinding === 'string' ? { outputBinding } : {}) }
          : false
    if (!intent || !descriptionIntents.includes(intent) || seenIntents.has(intent)
      || !criterion || !measures || !dimensions || scopeSelection === false) return false
    seenIntents.add(intent)
    bindings.push({
      intent,
      criterion,
      measures,
      dimensions,
      ...(scopeSelection ? { scopeSelection } : {}),
    })
  }
  const outputScope = bindings.find(binding => binding.scopeSelection?.outputBinding)?.scopeSelection
  if (outputScope && bindings.some(binding => (
    binding.scopeSelection?.outputBinding !== outputScope.outputBinding
  ))) return false
  return bindings
}

type CompiledClientToolClosedEnumSelector =
  | { status: 'malformed' }
  | { status: 'valid'; selector: AiClientToolAnalyticalClosedEnumSelector }

/** Compiles an exact call-local selector without deriving semantic coordinates from names or descriptions. */
const compileClosedEnumSelector = <TArgs extends Record<string, unknown>>(
  value: ClientToolAnalyticalClosedEnumSelectorDefinition<TArgs> | undefined,
  inputs: readonly ClientToolInput[],
): CompiledClientToolClosedEnumSelector | undefined => {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 3
    || !isExactAnalyticalArgument(value.argument)
    || !isExactAnalyticalArgument(value.limitArgument)
    || value.argument === value.limitArgument
    || !Array.isArray(value.cases)
    || !value.cases.length) return { status: 'malformed' }
  const cases: AiClientToolAnalyticalClosedEnumSelector['cases'] = []
  const values = new Set<string>()
  for (const rawCase of value.cases) {
    if (!rawCase || typeof rawCase !== 'object' || Array.isArray(rawCase)
      || Object.keys(rawCase).length !== 6
      || !isExactAnalyticalToken(rawCase.value)
      || values.has(rawCase.value)
      || !isExactAnalyticalToken(rawCase.criterion)
      || !Array.isArray(rawCase.measures)
      || !rawCase.measures.length
      || rawCase.measures.some(item => !isExactAnalyticalToken(item))
      || new Set(rawCase.measures).size !== rawCase.measures.length
      || !Array.isArray(rawCase.dimensions)
      || !rawCase.dimensions.length
      || rawCase.dimensions.some(item => !isExactAnalyticalToken(item))
      || new Set(rawCase.dimensions).size !== rawCase.dimensions.length
      || !rawCase.ordering || typeof rawCase.ordering !== 'object'
      || Array.isArray(rawCase.ordering)
      || Object.keys(rawCase.ordering).length !== 2
      || !isExactAnalyticalToken(rawCase.ordering.axis)
      || !['asc', 'desc'].includes(rawCase.ordering.direction)
      || !Number.isSafeInteger(rawCase.requestedLimit)
      || rawCase.requestedLimit <= 0) return { status: 'malformed' }
    values.add(rawCase.value)
    cases.push({
      value: rawCase.value,
      criterion: rawCase.criterion,
      measures: [...rawCase.measures],
      dimensions: [...rawCase.dimensions],
      ordering: {
        axis: rawCase.ordering.axis,
        direction: rawCase.ordering.direction,
      },
      requestedLimit: rawCase.requestedLimit,
    })
  }
  const selector: AiClientToolAnalyticalClosedEnumSelector = {
    argument: value.argument,
    limitArgument: value.limitArgument,
    cases,
  }
  return validateAiClientToolAnalyticalClosedEnumSelector(
    { inputs: inputs.map(input => ({ ...input })) },
    selector,
  )
    ? { status: 'valid', selector }
    : { status: 'malformed' }
}

type CompiledClientToolMeasureSelector =
  | { status: 'malformed' }
  | { status: 'valid'; binding: AiClientToolAnalyticalMeasureArgumentBinding }

/** Compiles one typed selector only when its required enum exactly matches all intent-admitted measures. */
const compileMeasureSelector = <TArgs extends Record<string, unknown>>(
  selector: Extract<keyof TArgs, string> | undefined,
  semanticIntentBindings: readonly AiClientToolAnalyticalSemanticIntentBinding[] | undefined,
  inputs: readonly ClientToolInput[],
): CompiledClientToolMeasureSelector | undefined => {
  if (selector === undefined) return undefined
  const binding: AiClientToolAnalyticalMeasureArgumentBinding = {
    semantic: 'measure',
    argument: normalizedText(selector),
    valueCardinality: 'exactly-one',
    encoding: 'single-string',
  }
  const intentMeasures = Array.from(new Set(
    (semanticIntentBindings || []).flatMap(item => item.measures),
  ))
  return validateAiClientToolAnalyticalMeasureBinding(
    { inputs: inputs.map(input => ({ ...input })) },
    binding,
    intentMeasures,
  )
    ? { status: 'valid', binding }
    : { status: 'malformed' }
}

const compileAnalyticalAuthoring = <TArgs extends Record<string, unknown>, TResult>(
  analytical: ClientToolAnalyticalAuthoring<TArgs> | undefined,
  descriptionIntents: readonly string[],
  compiledTemporal: CompiledClientToolTemporalAuthoring | undefined,
  scope: ClientToolScopeAuthoring<TArgs> | undefined,
  inputs: readonly ClientToolInput[],
  parameterSchema: AiClientToolParameterSchema | undefined,
  consumerPorts: readonly AiClientToolConsumerPort[],
  outputs: readonly ClientToolOutput<TResult>[],
): CompiledClientToolAnalyticalAuthoring | undefined => {
  if (!analytical) return scope ? { status: 'malformed' } : undefined
  const stored = clientToolAnalyticalAuthoringDefinitions.get(analytical)
  if (!stored) return { status: 'malformed' }
  if (compiledTemporal?.status === 'malformed') return { status: 'malformed' }
  const compiledScope = compileScopeAuthoring(scope, inputs, parameterSchema, consumerPorts)
  if (compiledScope?.status === 'malformed') return { status: 'malformed' }
  const standardDefinition = stored.kind === 'standard' ? stored.definition : undefined
  const boundedDefinition = stored.kind === 'bounded' ? stored.definition : undefined
  const definition = stored.definition
  const semanticIntentBindings = compileAnalyticalSemanticIntentBindings(
    definition.semanticIntentBindings,
    descriptionIntents,
    compiledScope,
    inputs,
    outputs,
  )
  if (semanticIntentBindings === false) return { status: 'malformed' }
  const measureSelector = compileMeasureSelector(
    definition.measureSelector,
    semanticIntentBindings,
    inputs,
  )
  if (measureSelector?.status === 'malformed') return { status: 'malformed' }
  const closedEnumSelector = compileClosedEnumSelector(definition.closedEnumSelector, inputs)
  if (closedEnumSelector?.status === 'malformed') return { status: 'malformed' }
  const compiledFilters = compileFilterAuthoring(
    definition.filterBindings,
    definition.filters,
    inputs,
    parameterSchema,
  )
  if (compiledFilters?.status === 'malformed') return { status: 'malformed' }
  const outputName = normalizedText(definition.output)
  const matchingOutputs = outputs.filter(candidate => normalizedText(candidate.name) === outputName)
  if (!outputName || matchingOutputs.length !== 1) return { status: 'malformed' }
  const output = matchingOutputs[0]

  const boundedBy = boundedDefinition
    ? normalizedText(boundedDefinition.boundedBy)
    : closedEnumSelector?.status === 'valid'
      ? closedEnumSelector.selector.limitArgument
      : undefined
  const rawCriterion = boundedDefinition?.criterion
  const boundedCriterion = rawCriterion
    && typeof rawCriterion === 'object'
    && !Array.isArray(rawCriterion)
    ? rawCriterion as ClientToolBoundedAnalyticalCriterion<Record<string, unknown>>
    : undefined
  const criterionName = boundedCriterion ? normalizedText(boundedCriterion.name).toLowerCase() : undefined
  const criterionMeasure = boundedCriterion ? normalizedText(boundedCriterion.measure).toLowerCase() : undefined
  const criterionDirection = boundedCriterion ? normalizedText(boundedCriterion.direction).toLowerCase() : undefined
  const valueField = boundedCriterion ? normalizedText(boundedCriterion.valueField) : undefined
  const coordinateField = boundedCriterion ? normalizedText(boundedCriterion.coordinateField) : undefined
  const staticAxis = boundedCriterion ? normalizedText(boundedCriterion.axis).toLowerCase() : undefined
  const axisFromInput = boundedCriterion ? normalizedText(boundedCriterion.axisFromInput) : undefined
  if (boundedDefinition && (!boundedCriterion || !criterionName || !criterionMeasure
    || !valueField || !coordinateField || valueField === coordinateField
    || !['asc', 'desc'].includes(criterionDirection || '')
    || (!!staticAxis === !!axisFromInput))) return { status: 'malformed' }
  const criteria = boundedDefinition ? [criterionName!] : standardDefinition!.criteria
  const completeness = boundedDefinition
    ? { complete: true, partial: true, continuation: false }
    : resolveAnalyticalCoverage(standardDefinition!.coverage, standardDefinition!.continuation === true)
  if (!completeness
    || closedEnumSelector?.status === 'valid'
    && (!completeness.complete || !completeness.partial || completeness.continuation)) {
    return { status: 'malformed' }
  }

  const matchingInputs = boundedBy
    ? inputs.filter(candidate => normalizedText(candidate.id) === boundedBy)
    : []
  const matchingAxisInputs = axisFromInput
    ? inputs.filter(candidate => normalizedText(candidate.id) === axisFromInput)
    : []
  const boundedInput = matchingInputs[0]
  const axisInput = matchingAxisInputs[0]
  const argumentBindings: AiClientToolAnalyticalArgumentBinding[] = [
    ...(axisFromInput ? [{ semantic: 'dimension' as const, argument: axisInput?.id }] : []),
    ...(measureSelector?.status === 'valid' ? [measureSelector.binding] : []),
    ...(compiledTemporal?.status === 'valid' ? [compiledTemporal.binding] : []),
    ...(compiledScope?.status === 'valid' ? [compiledScope.binding] : []),
    ...(compiledFilters?.status === 'valid' ? compiledFilters.bindings : []),
  ]
  const boundArguments = argumentBindings.flatMap(binding => (
    binding.semantic === 'dimension' || binding.semantic === 'measure'
      ? [binding.argument]
      : binding.semantic === 'temporal'
        ? [binding.rangeArgument, binding.startArgument, binding.endArgument]
        : binding.semantic === 'scope'
          ? [binding.modeArgument, ...binding.coordinates.flatMap(coordinate => coordinate.arguments)]
          : 'operatorArgument' in binding
            ? [binding.operatorArgument, binding.valueArgument]
            : [binding.valueArgument]
  ))
  const selectorArgument = closedEnumSelector?.status === 'valid'
    ? closedEnumSelector.selector.argument
    : undefined
  const boundTargets = [boundedBy, selectorArgument, ...boundArguments].filter(Boolean)
  if (new Set(boundTargets).size !== boundTargets.length) return { status: 'malformed' }

  const capability = normalizeAiClientToolAnalyticalCapability({
    version: AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION,
    capabilityId: definition.producerKey,
    semanticKey: definition.factKey,
    subjects: [...definition.subjects],
    measures: definition.measures.map(measure => ({
      name: measure.name,
      aggregations: [...measure.aggregations],
      units: [...measure.units],
    })),
    dimensions: [...(definition.dimensions || [])],
    filters: [...(definition.filters || [])],
    grains: [...(definition.grains || [])],
    criteria: [...criteria],
    ordering: (boundedDefinition
      ? [{ axis: criterionMeasure!, direction: criterionDirection as 'asc' | 'desc' }]
      : (standardDefinition!.ordering || [])).map(ordering => ({
      ...ordering,
      producerGuaranteed: true,
    })),
    completeness: boundedBy
      ? {
          ...completeness,
          boundedBy: {
            criterion: 'requested-record-window',
            limitArgument: boundedInput?.id,
            completeRequired: true,
          },
        }
      : completeness,
    ...(semanticIntentBindings?.length ? { semanticIntentBindings } : {}),
    ...(closedEnumSelector?.status === 'valid'
      ? { closedEnumSelector: closedEnumSelector.selector }
      : {}),
    ...(argumentBindings.length ? { argumentBindings } : {}),
    output: {
      shape: output.shape,
      ...(stored.kind === 'standard' && standardDefinition!.outputFields === 'execution-authored'
        ? {
            fieldSet: {
              mode: 'execution-authored' as const,
              // One declared routing measure is a family; multiple declared measures remain exact coordinates.
              measureCoordinates: definition.measures.length === 1
                ? 'execution-authored' as const
                : 'exact' as const,
              maxFields: 33,
            },
          }
        : {}),
    },
    transformCost: 0,
  })
  if (!capability) return { status: 'malformed' }
  if (stored.kind === 'standard') {
    const validationMode = standardDefinition!.outputFields === undefined
      ? 'static' as const
      : standardDefinition!.outputFields === 'execution-authored'
        ? 'execution-authored' as const
        : undefined
    if (!validationMode
      || (validationMode === 'execution-authored'
        && (output.optional !== true
          || typeof output.resolveFields !== 'function'
          || !isExactAiClientToolRecordPath(output.recordPath)))) {
      return { status: 'malformed' }
    }
    return validatesStandardAnalyticalOutputSemantics(
      capability,
      output,
      output.fields,
      validationMode,
      false,
    )
      ? { status: 'standard', capability, output: output.name, validationMode }
      : { status: 'malformed' }
  }

  // Bounded scope uses explicit authoring bindings only. Semantic filters, output shapes, labels and array positions never
  // select a physical port because doing so would turn a coincidental representation match into completion authority.
  const normalizedFields = normalizeAiClientToolOutputFields(output.fields)
  const measureFields = (normalizedFields || []).filter(field => (
    isCanonicalAiClientToolOutputField(field)
    && field.name === valueField
    && field.role === 'measure'
    && normalizedText(field.measure).toLowerCase() === criterionMeasure
  ))
  const coordinateFields = (normalizedFields || []).filter(field => (
    isCanonicalAiClientToolOutputField(field)
    && field.name === coordinateField
    && field.role === 'dimension'
    && !field.axis
  ))
  const declaredMeasures = capability.measures.filter(measure => measure.name === criterionMeasure)
  const axisValues = axisFromInput ? resolveAnalyticalAxisEnum(axisInput) : undefined
  if (!boundedInput
    || matchingInputs.length !== 1
    || capability.criteria.length !== 1
    || capability.ordering.length !== 1
    || declaredMeasures.length !== 1
    || !normalizedFields
    || normalizedFields.length !== (output.fields?.length || 0)
    || normalizedFields.some(field => (
      isCanonicalAiClientToolOutputField(field)
      && !isAnalyticalFieldTypeAndDisplayFormatCompatible(field)
    ))
    || measureFields.length !== 1
    || coordinateFields.length !== 1
    || output.ordering !== undefined
    || (axisFromInput
      ? !axisInput
        || matchingAxisInputs.length !== 1
        || !matchesAnalyticalDimensions(axisValues, capability.dimensions)
      : !capability.dimensions.includes(staticAxis!))) {
    return { status: 'malformed' }
  }
  const input = boundedInput
  const valueType = typeof input.valueType === 'string' ? input.valueType : input.valueType?.type
  if (!['int', 'integer', 'number'].includes(normalizedText(valueType).toLowerCase())) {
    return { status: 'malformed' }
  }
  const minimum = typeof input.valueType === 'object' ? input.valueType.min : undefined
  const maximum = typeof input.valueType === 'object' ? input.valueType.max : undefined
  if ((minimum !== undefined && !Number.isSafeInteger(minimum))
    || (maximum !== undefined && !Number.isSafeInteger(maximum))
    || (minimum !== undefined && maximum !== undefined && minimum > maximum)) {
    return { status: 'malformed' }
  }
  return {
    status: 'bounded',
    capability,
    limitInput: input.id,
    ...(input.defaultValue !== undefined ? { defaultLimit: input.defaultValue } : {}),
    ...(minimum !== undefined ? { minimum } : {}),
    ...(maximum !== undefined ? { maximum } : {}),
    output: output.name,
    physicalOrdering: {
      keys: [{ field: valueField!, direction: criterionDirection as 'asc' | 'desc' }],
      producerGuaranteed: true,
    },
    fieldBinding: {
      valueField: valueField!,
      coordinateField: coordinateField!,
      ...(staticAxis ? { axis: staticAxis } : {}),
      ...(axisFromInput ? { axisFromInput } : {}),
    },
  }
}

const isExactAiClientToolRecordPath = (value: unknown) => {
  const recordPath = normalizeAiClientToolRecordPath(value)
  return !!recordPath && !recordPath.includes('[*]')
}

const applyCompiledAnalyticalOutputSemantics = <TResult>(
  outputs: readonly ClientToolOutput<TResult>[],
  analytical: CompiledClientToolAnalyticalAuthoring | undefined,
): readonly ClientToolOutput<TResult>[] => {
  if (!analytical || analytical.status !== 'bounded') return outputs
  return outputs.map((output) => {
    if (output.name !== analytical.output) return output
    const fields = output.fields?.map<AiClientToolOutputField>((field) => {
      if (field.name !== analytical.fieldBinding.coordinateField
        || !analytical.fieldBinding.axis
        || !isCanonicalAiClientToolOutputField(field)) return { ...field }
      return { ...field, axis: analytical.fieldBinding.axis }
    })
    return {
      ...output,
      ...(fields ? { fields } : {}),
      ordering: analytical.physicalOrdering,
    }
  })
}

const downgradeUnprovenAnalyticalResult = <TResult>(
  execution: ClientToolExecutionSuccess<TResult>,
): ClientToolExecutionSuccess<TResult> => {
  return {
    ...execution,
    outcome: 'partial',
    status: 'partial',
    complete: false,
    truncated: false,
    requestSatisfied: false,
    exhaustive: false,
    displayTruncated: false,
    limitReason: 'analytical_scope_unproven',
  }
}

/** Resolves only explicitly authored semantic bindings; physical names and runtime values are never guessed. */
const resolveBoundedAnalyticalFields = (
  args: Record<string, unknown>,
  fields: readonly AiClientToolOutputField[] | undefined,
  analytical: Extract<CompiledClientToolAnalyticalAuthoring, { status: 'bounded' }>,
): AiClientToolOutputField[] | undefined => {
  const normalizedFields = normalizeAiClientToolOutputFields(fields)
  if (!normalizedFields
    || normalizedFields.length !== (fields?.length || 0)
    || normalizedFields.some(field => (
      isCanonicalAiClientToolOutputField(field)
      && !isAnalyticalFieldTypeAndDisplayFormatCompatible(field)
    ))) return undefined
  const semanticMeasure = analytical.capability.ordering[0]?.axis
  const valueFields = normalizedFields.filter(field => (
    isCanonicalAiClientToolOutputField(field)
    && field.name === analytical.fieldBinding.valueField
    && field.role === 'measure'
    && normalizedText(field.measure).toLowerCase() === semanticMeasure
  ))
  const requestedAxis = analytical.fieldBinding.axis
    || normalizedText(args[analytical.fieldBinding.axisFromInput!]).toLowerCase()
  const coordinateFields = normalizedFields.filter(field => (
    isCanonicalAiClientToolOutputField(field)
    && field.name === analytical.fieldBinding.coordinateField
    && field.role === 'dimension'
    && (!field.axis || field.axis === requestedAxis)
  ))
  if (!requestedAxis
    || !analytical.capability.dimensions.includes(requestedAxis)
    || valueFields.length !== 1
    || coordinateFields.length !== 1) return undefined
  return normalizedFields.map<AiClientToolOutputField>((field) => {
    if (field.name !== analytical.fieldBinding.coordinateField
      || !isCanonicalAiClientToolOutputField(field)) return field
    return { ...field, axis: requestedAxis }
  })
}

const isExecutionAuthoredAnalyticalOutput = <TResult>(
  analytical: CompiledClientToolAnalyticalAuthoring | undefined,
  output: ClientToolOutput<TResult>,
) => analytical?.status === 'standard'
  && analytical.validationMode === 'execution-authored'
  && analytical.capability.output.fieldSet?.mode === 'execution-authored'
  && analytical.output === output.name

/**
 * Execution-authored fields are optional analytical authority. An unproven projection keeps the selected raw output
 * but removes field and ordering semantics instead of borrowing authority from the declaration or a sibling.
 */
const resolveExecutionAuthoredAnalyticalFields = <TResult>(
  analytical: Extract<CompiledClientToolAnalyticalAuthoring, { status: 'standard' }>,
  output: ClientToolOutput<TResult>,
  fields: readonly AiClientToolOutputField[] | undefined,
): AiClientToolOutputField[] | undefined => {
  const normalizedFields = normalizeAiClientToolOutputFields(
    fields,
    analytical.capability.output.fieldSet?.maxFields,
  )
  if (!normalizedFields
    || normalizedFields.length !== (fields?.length || 0)
    || !normalizedFields.length
    || !normalizedFields.every(isCanonicalAiClientToolOutputField)
    || !validatesStandardAnalyticalOutputSemantics(
      analytical.capability,
      output,
      normalizedFields,
      'execution-authored',
      true,
    )) return undefined
  return normalizedFields
}

const resolveAnalyticalExecution = <TResult>(
  execution: ClientToolExecutionSuccess<TResult>,
  args: Record<string, unknown>,
  selected: readonly {
    output: ClientToolOutput<TResult>
    value: unknown
    fields?: readonly AiClientToolOutputField[]
  }[],
  analytical: CompiledClientToolAnalyticalAuthoring | undefined,
): {
  execution: ClientToolExecutionSuccess<TResult>
  boundedOutput?: {
    name: string
    recordCount: number
    fields: AiClientToolOutputField[]
    axisField: string
    axis: string
  }
} => {
  if (execution.outcome !== 'success') return { execution }
  if (!analytical) return { execution }
  if (analytical.status === 'malformed') {
    return { execution: downgradeUnprovenAnalyticalResult(execution) }
  }
  if (analytical.status === 'standard') return { execution }

  const requestedLimit = args[analytical.limitInput] ?? analytical.defaultLimit
  const selectedOutput = selected.find(item => item.output.name === analytical.output)
  const fields = resolveBoundedAnalyticalFields(args, selectedOutput?.fields, analytical)
  const complete = typeof requestedLimit === 'number'
    && Number.isSafeInteger(requestedLimit)
    && requestedLimit > 0
    && (analytical.minimum === undefined || requestedLimit >= analytical.minimum)
    && (analytical.maximum === undefined || requestedLimit <= analytical.maximum)
    && Array.isArray(selectedOutput?.value)
    && !!fields
    && selectedOutput.value.length <= requestedLimit
  if (!complete || !selectedOutput || !Array.isArray(selectedOutput.value) || !fields) {
    return { execution: downgradeUnprovenAnalyticalResult(execution) }
  }
  return {
    execution,
    boundedOutput: {
      name: analytical.output,
      recordCount: selectedOutput.value.length,
      fields,
      axisField: analytical.fieldBinding.coordinateField,
      axis: fields.find(field => field.name === analytical.fieldBinding.coordinateField)!.axis!,
    },
  }
}

/**
 * A closed selector may prove the order of this invocation without making that order part of the
 * reusable output declaration. The producer's declared temporal field is the only field eligible
 * to carry the projection; ambiguous or unmatched cases remain unordered ordinary execution.
 */
const resolveClosedEnumExecutionOrdering = <TResult>(
  args: Record<string, unknown>,
  output: ClientToolOutput<TResult>,
  fields: readonly AiClientToolOutputField[] | undefined,
  analytical: CompiledClientToolAnalyticalAuthoring | undefined,
): AiClientToolOrdering | undefined => {
  if (!analytical || analytical.status !== 'standard' || output.name !== analytical.output) return undefined
  const selector = analytical.capability.closedEnumSelector
  if (!selector || typeof args[selector.argument] !== 'string') return undefined
  const selectedCase = selector.cases.find(item => item.value === args[selector.argument])
  if (!selectedCase) return undefined
  const temporalFields = (fields || []).filter((field) => (
    isCanonicalAiClientToolOutputField(field)
    && field.role === 'temporal_dimension'
    && selectedCase.dimensions.includes(normalizedText(field.axis))
  ))
  if (temporalFields.length !== 1) return undefined
  return {
    keys: [{ field: temporalFields[0].name, direction: selectedCase.ordering.direction }],
    producerGuaranteed: true,
  }
}

const adaptExecutionResult = async <TResult>(
  toolId: string,
  args: Record<string, unknown>,
  result: TResult | ClientToolExecutionResult<TResult>,
  outputs: readonly ClientToolOutput<TResult>[],
  contract: AiClientToolContractFragment,
  analytical: CompiledClientToolAnalyticalAuthoring | undefined,
) => {
  if (isExecutionResult<TResult>(result) && result.outcome === 'failure') {
    return createAiClientToolFailureResult(result.failure)
  }
  if (!isExecutionResult<TResult>(result) && isFailureLike(result)) return result

  let execution = isExecutionResult<TResult>(result)
    ? result
    : clientToolResult.success(result as TResult)
  if (execution.outcome === 'failure') return createAiClientToolFailureResult(execution.failure)

  const selected: Array<{
    output: ClientToolOutput<TResult>
    index: number
    value: unknown
    fields?: readonly AiClientToolOutputField[]
    label?: string
    ordering?: AiClientToolOrdering
  }> = []
  for (let index = 0; index < outputs.length; index += 1) {
    const output = outputs[index]
    const executionAuthoredAnalyticalOutput = isExecutionAuthoredAnalyticalOutput(analytical, output)
    let value: unknown
    try {
      value = output.select ? output.select(execution.data) : execution.data
    } catch (error) {
      if (executionAuthoredAnalyticalOutput) continue
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
        if (executionAuthoredAnalyticalOutput) {
          fields = undefined
        } else {
          throw createSelectionError(toolId, output.name, error)
        }
      }
    }
    if (executionAuthoredAnalyticalOutput) {
      const resolvedFields = resolveExecutionAuthoredAnalyticalFields(
        analytical as Extract<CompiledClientToolAnalyticalAuthoring, { status: 'standard' }>,
        output,
        fields,
      )
      fields = resolvedFields
    }
    const materializedArtifact = isInternalDescriptor(value, MATERIALIZED_ARTIFACT_KIND)
    const carrierRecordPath = materializedArtifact
      ? (value as { recordPath?: unknown }).recordPath
      : undefined
    if (materializedArtifact
      && output.recordPath !== undefined
      && carrierRecordPath !== undefined
      && carrierRecordPath !== output.recordPath) {
      throw createSelectionError(toolId, output.name)
    }
    const validationSource = materializedArtifact
      && fields?.some(isCanonicalAiClientToolOutputField)
      ? await resolveAiClientToolArtifactLogicalSource(value)
      : value
    if (!validateAiClientToolCanonicalFieldValues(validationSource, output.recordPath, fields, {
      ...(executionAuthoredAnalyticalOutput
        ? {
            maxFields: (analytical as Extract<CompiledClientToolAnalyticalAuthoring, { status: 'standard' }>)
              .capability.output.fieldSet?.maxFields,
            requireMeasureValues: true,
          }
        : {}),
    })) {
      if (executionAuthoredAnalyticalOutput) continue
      throw createSelectionError(toolId, output.name)
    }
    let label = output.label
    if (output.resolveLabel) {
      try {
        label = normalizedText(output.resolveLabel(execution.data, value, fields || [])) || label
      } catch (error) {
        if (executionAuthoredAnalyticalOutput) continue
        throw createSelectionError(toolId, output.name, error)
      }
    }
    let ordering: AiClientToolOrdering | undefined
    if (output.resolveOrdering) {
      try {
        ordering = output.resolveOrdering(execution.data, value, fields || [])
      } catch (error) {
        if (executionAuthoredAnalyticalOutput) continue
        throw createSelectionError(toolId, output.name, error)
      }
    } else {
      ordering = resolveClosedEnumExecutionOrdering(args, output, fields, analytical)
    }
    selected.push({
      output,
      index,
      value,
      fields,
      label,
      ordering,
    })
  }

  // A bounded producer's success is authoritative only when the declared input/output bindings and observed
  // cardinality cover this call's canonical scope. A failed proof degrades this result without affecting peers.
  const analyticalResolution = resolveAnalyticalExecution(execution, args, selected, analytical)
  execution = analyticalResolution.execution
  const boundedOutput = analyticalResolution.boundedOutput

  const inlineValues: Record<string, unknown> = {}
  let materialized: unknown
  const inlineStates: AiClientToolContractOutputState[] = []
  selected.forEach(({ output, index, value, fields, label, ordering }) => {
    const resolvedFields = boundedOutput?.name === output.name ? boundedOutput.fields : fields
    const resolvedOrdering = output.resolveOrdering ? ordering : ordering || output.ordering
    const prepared = prepareMaterializedValue(value, output, resolvedFields, label, resolvedOrdering)
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
    const state: AiClientToolContractOutputState = {
      name: output.name,
      ...(label ? { label } : {}),
      path: outputSlotPath(index),
      ...(Array.isArray(value) ? { recordCount: value.length } : {}),
      ...(boundedOutput?.name === output.name ? { totalCount: boundedOutput.recordCount } : {}),
      complete: execution.complete,
      truncated: execution.truncated,
      ...(execution.requestSatisfied !== undefined ? { requestSatisfied: execution.requestSatisfied } : {}),
      ...(execution.exhaustive !== undefined ? { exhaustive: execution.exhaustive } : {}),
      ...(execution.displayTruncated !== undefined ? { displayTruncated: execution.displayTruncated } : {}),
      ...(execution.requestedRange ? { requestedRange: { ...execution.requestedRange } } : {}),
      ...(execution.observedRange ? { observedRange: { ...execution.observedRange } } : {}),
    }
    const axisBoundState = boundedOutput?.name === output.name
      ? bindAiClientToolContractExecutionAxis(state, boundedOutput.axisField, boundedOutput.axis)
      : state
    inlineStates.push(resolvedOrdering && ordering
      ? bindAiClientToolContractExecutionOrdering(axisBoundState, resolvedOrdering)
      : axisBoundState)
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
    ...(execution.requestSatisfied !== undefined ? { requestSatisfied: execution.requestSatisfied } : {}),
    ...(execution.exhaustive !== undefined ? { exhaustive: execution.exhaustive } : {}),
    ...(execution.displayTruncated !== undefined ? { displayTruncated: execution.displayTruncated } : {}),
    __clientToolOutputs: inlineValues,
    ...(execution.summary ? { summary: execution.summary } : {}),
    ...(materialized ? { data: materialized } : {}),
  }
  const resultWithEvidence = withAiClientToolContractEvidence(envelope, contract, {
    complete: execution.complete,
    truncated: execution.truncated,
    ...(execution.requestSatisfied !== undefined ? { requestSatisfied: execution.requestSatisfied } : {}),
    ...(execution.exhaustive !== undefined ? { exhaustive: execution.exhaustive } : {}),
    ...(execution.displayTruncated !== undefined ? { displayTruncated: execution.displayTruncated } : {}),
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
  if (analytical?.status !== 'standard' || analytical.validationMode !== 'execution-authored') {
    return resultWithEvidence
  }
  const executionOutput = selected.find(({ output }) => output.name === analytical.output)
  if (!executionOutput || !resultWithEvidence.outputBindings) return resultWithEvidence
  const outputBindings = normalizeAiClientToolOutputBindings(resultWithEvidence.outputBindings.map(binding => (
    binding.name !== analytical.output
      ? binding
      : (() => {
          const { fields: _fields, ordering: _ordering, ...baseBinding } = binding
          return executionOutput.fields
            ? {
                ...baseBinding,
                fields: executionOutput.fields.map(field => ({ ...field })),
                ordering: executionOutput.output.resolveOrdering
                  ? executionOutput.ordering
                  : executionOutput.output.ordering,
              }
            : baseBinding
        })()
  )), { maxFields: analytical.capability.output.fieldSet?.maxFields })
  if (outputBindings.length !== resultWithEvidence.outputBindings.length) return resultWithEvidence
  return {
    ...resultWithEvidence,
    outputBindings,
    evidence: {
      ...resultWithEvidence.evidence,
      outputBindings,
    },
  }
}

const adaptPreparationResult = <TArgs extends Record<string, unknown>>(
  toolId: string,
  result: ClientToolPreparationResult<TArgs>,
): AiClientToolPreparedCall | ReturnType<typeof createAiClientToolFailureResult> => {
  if (isExecutionResult<never>(result)) {
    if (result.outcome === 'failure') return createAiClientToolFailureResult(result.failure)
    throw new Error(`Client tool ${toolId} prepare must return prepared arguments or a failure`)
  }
  if (isFailureLike(result)) return result
  if (!result
    || typeof result !== 'object'
    || !result.arguments
    || typeof result.arguments !== 'object'
    || Array.isArray(result.arguments)) {
    throw new Error(`Client tool ${toolId} prepare arguments must be an object`)
  }
  return {
    arguments: { ...result.arguments },
    ...(result.confirmation ? { confirmation: { ...result.confirmation } } : {}),
  }
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
  if (definition.prepare && definition.effect.kind === 'READ') {
    throw new Error(`Client tool ${id} cannot prepare a read-only effect`)
  }
  const { text, intents } = normalizeDescription(definition.description)
  const declaredOutputs = normalizeOutputs(definition.output)
  const parameterSchema = definition.inputAlternatives?.length
    ? compileInputAlternatives(id, definition.inputs || [], definition.inputAlternatives)
    : hasFilterBindings(definition.analytical) ? { type: 'object' as const } : undefined
  const compiledConsumes = compileConsumedResources(
    definition.consumes || [],
    definition.inputs || [],
  )
  const consumerArguments = compiledConsumes.canonical.flatMap(port => (
    port.argumentBinding ? [port.argumentBinding.argument] : []
  ))
  // A scope discriminator selects a closed protocol branch but is not a business request argument. It only lets the
  // temporal validator recognize the project branch when temporal and scope alternatives are crossed.
  const scopeModeArgument = definition.scope
    ? normalizedText(clientToolScopeAuthoringDefinitions.get(definition.scope)?.modeArgument)
    : ''
  const compiledTemporal = compileTemporalAuthoring(
    definition.temporal,
    definition.inputs || [],
    parameterSchema,
    [...consumerArguments, ...(scopeModeArgument ? [scopeModeArgument] : [])],
  )
  const analytical = compileAnalyticalAuthoring(
    definition.analytical,
    intents,
    compiledTemporal,
    definition.scope,
    definition.inputs || [],
    parameterSchema,
    compiledConsumes.canonical,
    declaredOutputs,
  )
  // Explicit invalid authority must not disappear into an otherwise valid ordinary tool contract.
  if (definition.analytical !== undefined && analytical?.status === 'malformed') {
    throw new Error('Client tool analytical declaration is invalid')
  }
  const workflowStages = compilePreparation(definition.preparation, analytical)
  const outputs = applyCompiledAnalyticalOutputSemantics(declaredOutputs, analytical)
  let analyticalCapability = analytical && analytical.status !== 'malformed'
    ? analytical.capability
    : undefined
  let temporalArgumentBinding = !definition.analytical && compiledTemporal?.status === 'valid'
    ? compiledTemporal.binding
    : undefined
  let publishedConsumes = compiledConsumes
  const analyticalArguments = analyticalCapability
    ? [
        ...(analyticalCapability.completeness.boundedBy
          ? [analyticalCapability.completeness.boundedBy.limitArgument]
          : []),
        ...(analyticalCapability.closedEnumSelector
          ? [analyticalCapability.closedEnumSelector.argument]
          : []),
        ...(analyticalCapability.argumentBindings || []).flatMap(binding => (
          binding.semantic === 'dimension' || binding.semantic === 'measure'
            ? [binding.argument]
            : binding.semantic === 'temporal'
              ? [binding.rangeArgument, binding.startArgument, binding.endArgument]
              : binding.semantic === 'scope'
                ? [binding.modeArgument, ...binding.coordinates.flatMap(coordinate => coordinate.arguments)]
                : 'operatorArgument' in binding
                  ? [binding.operatorArgument, binding.valueArgument]
                  : [binding.valueArgument]
        )),
      ]
    : []
  const rootTemporalArguments = temporalArgumentBinding
    ? [
        temporalArgumentBinding.rangeArgument,
        temporalArgumentBinding.startArgument,
        temporalArgumentBinding.endArgument,
      ]
    : []
  const allBoundArguments = [...consumerArguments, ...analyticalArguments, ...rootTemporalArguments]
  if (new Set(allBoundArguments).size !== allBoundArguments.length) {
    analyticalCapability = undefined
    temporalArgumentBinding = undefined
    publishedConsumes = {
      ...compiledConsumes,
      status: 'malformed',
      canonical: compiledConsumes.canonical.map(({ argumentBinding: _binding, ...port }) => port),
    }
  }
  const contract = compileContract(
    definition,
    publishedConsumes,
    outputs,
    analyticalCapability,
    temporalArgumentBinding,
    workflowStages,
  )
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
    ...(parameterSchema ? { parameterSchema } : {}),
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
    ...(definition.prepare ? {
      prepare: async (args, context, call) => adaptPreparationResult(
        id,
        await definition.prepare!(args as TArgs, context, call),
      ),
    } : {}),
    execute: async (args, context, call) => adaptExecutionResult(
      id,
      args,
      await definition.execute(args as TArgs, context, call),
      outputs,
      contract,
      analytical,
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
