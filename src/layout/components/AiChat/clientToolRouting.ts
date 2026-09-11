import { isSupportedAiClientToolBindingPath } from './clientToolBindingPath'
import {
  AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY,
  mergeAiClientToolParameterSchema,
  type AiClientToolParameterSchema,
} from './clientToolParameterSchema'

export const AI_CLIENT_TOOL_ROUTING_EXPAND_KEY = 'x-ai-routing'
export const AI_CLIENT_TOOL_EFFECT_EXPAND_KEY = 'effect'
export const AI_CLIENT_TOOL_PORT_VERSION = 'ai-tool-port/v1' as const
export const AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION = 'analytical-capability/v1' as const

export const AI_CLIENT_TOOL_RESOURCE_TYPES = [
  'structured-data',
  'artifact',
  'state',
  'presentation',
] as const

export const AI_CLIENT_TOOL_SOURCE_POLICIES = ['CONTEXT', 'TOOL', 'EITHER'] as const

export const AI_CLIENT_TOOL_ROUTING_STAGES = [
  'navigation',
  'preparation',
  'execution',
  'validation',
  'terminal',
  'cleanup',
] as const

export const AI_CLIENT_TOOL_DATA_ACCESS_MODES = [
  'discovery',
  'detail',
  'aggregate',
  'records',
] as const

export const AI_CLIENT_TOOL_RESULT_DELIVERIES = ['inline', 'file', 'auto'] as const

export const AI_CLIENT_TOOL_OUTPUT_AUDIENCES = [
  'model-evidence',
  'client-presentation',
  'reusable-source',
] as const

export type AiClientToolRoutingStage = typeof AI_CLIENT_TOOL_ROUTING_STAGES[number]
export type AiClientToolRoutingDataAccessMode = typeof AI_CLIENT_TOOL_DATA_ACCESS_MODES[number]
export type AiClientToolRoutingResultDelivery = typeof AI_CLIENT_TOOL_RESULT_DELIVERIES[number]
export type AiClientToolOutputAudience = typeof AI_CLIENT_TOOL_OUTPUT_AUDIENCES[number]
export type AiClientToolRoutingExposure = 'auto' | 'eager' | 'deferred'
export type AiClientToolRoutingCost = 'low' | 'medium' | 'high'
export type AiClientToolEvidencePolicy = 'auto' | 'required' | 'optional' | 'none'
export type AiClientToolRoutingStatus = 'valid' | 'missing' | 'malformed'
export type AiClientToolResourceType = typeof AI_CLIENT_TOOL_RESOURCE_TYPES[number]
export type AiClientToolSourcePolicy = typeof AI_CLIENT_TOOL_SOURCE_POLICIES[number]
export type AiClientToolEffectKind = 'READ' | 'WRITE' | 'EXTERNAL_ACTION'
export type AiClientToolEffectStatus = 'canonical' | 'legacy' | 'missing' | 'malformed'

/** Stable producer identity compiled together with the result binding; physical paths remain runtime facts. */
export interface AiClientToolProducerPort {
  name: string
  type: AiClientToolResourceType
  mediaType: string
  shape: string
  /** Canonical visibility/delivery projection. Released routed-legacy ports may omit it. */
  audience?: AiClientToolOutputAudience
}

/** Static consumer requirement. Source policy constrains provenance but never identifies a producer or argument. */
export interface AiClientToolConsumerPort extends Omit<AiClientToolProducerPort, 'audience'> {
  required: boolean
  sourcePolicy: AiClientToolSourcePolicy
  /** Exact scalar target for one admitted value from this canonical source port. */
  argumentBinding?: {
    argument: string
    valueCardinality: 'exactly-one'
    encoding: 'single-string'
    /** Optional typed projection from the current session context; TOOL provenance never permits it. */
    contextSource?: {
      kind: 'subject'
      selection: 'primary'
      subjectType: string
      coordinate: 'id'
    }
  }
}

export interface AiClientToolRoutingIntentSection {
  intent: string
  section: string
}

export interface AiClientToolRoutingHelp {
  quickstartSection?: string
  intentSections?: Record<string, string> | AiClientToolRoutingIntentSection[]
}

export interface AiClientToolAnalyticalMeasureCapability {
  name: string
  aggregations: string[]
  units: string[]
}

export interface AiClientToolAnalyticalOrderingCapability {
  axis: string
  direction: 'asc' | 'desc'
  producerGuaranteed: boolean
}

export interface AiClientToolAnalyticalDimensionArgumentBinding {
  /** Semantic axis selected by this top-level producer argument. */
  semantic: 'dimension'
  /** Exact top-level input identity published in the same tool definition. */
  argument: string
}

/** Exact closed-enum selector for the single measure requested by the current analytical intent. */
export interface AiClientToolAnalyticalMeasureArgumentBinding {
  semantic: 'measure'
  argument: string
  valueCardinality: 'exactly-one'
  encoding: 'single-string'
}

export interface AiClientToolAnalyticalTemporalArgumentBinding {
  /** Canonical absolute task range mapped to the declared custom branch. */
  semantic: 'temporal'
  rangeArgument: string
  startArgument: string
  endArgument: string
  customValue: string
  /** `date` inputs receive ISO-8601 instants; timezone remains task-canonicalization metadata. */
  encoding: 'date-time'
}

export type AiClientToolAnalyticalScopeCoordinate =
  | {
      type: 'project'
      arguments: []
    }
  | {
      type: 'area' | 'point'
      /** Exact canonical consumer-port identity carrying the admitted singleton scope value. */
      sourcePort: string
      /** Exact top-level producer argument receiving that singleton string. */
      arguments: [string]
    }

export interface AiClientToolAnalyticalScopeArgumentBinding {
  semantic: 'scope'
  /** Required protocol discriminator; it never becomes an HTTP/business request parameter. */
  modeArgument: string
  valueCardinality: 'exactly-one'
  encoding: 'single-string'
  /** Closed project/area/point coordinate set; project is an explicit omission branch. */
  coordinates: AiClientToolAnalyticalScopeCoordinate[]
}

/** Fixed operators admit either one scalar string or one-or-more strings without adding an operator argument. */
type AiClientToolFixedAnalyticalFilterArgumentBinding = {
  semantic: 'filter'
  axis: string
  operator: string
  valueArgument: string
} & (
  | { valueCardinality: 'exactly-one'; encoding: 'scalar' }
  | { valueCardinality: 'one-or-more'; encoding: 'string-array' }
)

export type AiClientToolAnalyticalFilterArgumentBinding =
  | AiClientToolFixedAnalyticalFilterArgumentBinding
  | {
      semantic: 'filter'
      axis: string
      operators: string[]
      operatorArgument: string
      valueArgument: string
      valueCardinality: 'one-or-more'
      encoding: 'string-array'
    }

export type AiClientToolAnalyticalArgumentBinding =
  | AiClientToolAnalyticalDimensionArgumentBinding
  | AiClientToolAnalyticalMeasureArgumentBinding
  | AiClientToolAnalyticalTemporalArgumentBinding
  | AiClientToolAnalyticalScopeArgumentBinding
  | AiClientToolAnalyticalFilterArgumentBinding

export interface AiClientToolAnalyticalBoundedCompleteness {
  criterion: 'requested-record-window'
  /** Exact top-level input identity that bounds the requested record window. */
  limitArgument: string
  completeRequired: true
}

export interface AiClientToolAnalyticalScopeSelection {
  /** Exact semantic argument binding owned by this analytical capability. */
  binding: 'scope'
  /** Closed choice: explicit project scope or one preparation-resolved narrower scope. */
  modes: ['project', 'explicit']
  /** Same-invocation canonical output; absent retains the input-coordinate contract. */
  outputBinding?: string
}

export interface AiClientToolAnalyticalSemanticIntentBinding {
  /** Exact natural-language intent published by this same tool declaration. */
  intent: string
  /** One criterion already declared by this analytical capability. */
  criterion: string
  /** Non-empty subset of measures already declared by this analytical capability. */
  measures: string[]
  /** Non-empty subset of dimensions already declared by this analytical capability. */
  dimensions: string[]
  /** Optional declaration-local reference to this capability's unique typed scope binding. */
  scopeSelection?: AiClientToolAnalyticalScopeSelection
}

export interface AiClientToolAnalyticalClosedEnumSelectorCase {
  /** Exact member of the selector argument's declared string enum. */
  value: string
  /** Existing analytical coordinates activated only for this exact value. */
  criterion: string
  measures: string[]
  dimensions: string[]
  ordering: {
    axis: string
    direction: 'asc' | 'desc'
  }
  /** Call-local requested window; population exhaustiveness remains independent. */
  requestedLimit: number
}

/** Declaration-local mapping from one closed-enum argument to existing analytical semantics. */
export interface AiClientToolAnalyticalClosedEnumSelector {
  argument: string
  limitArgument: string
  cases: AiClientToolAnalyticalClosedEnumSelectorCase[]
}

export interface AiClientToolAnalyticalOutputFieldSet {
  mode: 'execution-authored'
  measureCoordinates: 'exact' | 'execution-authored'
  maxFields: number
}

export interface AiClientToolAnalyticalOutputCapability {
  shape: string
  /** Omitted keeps the released static exact-field contract. */
  fieldSet?: AiClientToolAnalyticalOutputFieldSet
}

export interface AiClientToolAnalyticalCapability {
  version: typeof AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION
  capabilityId: string
  semanticKey: string
  subjects: string[]
  measures: AiClientToolAnalyticalMeasureCapability[]
  dimensions: string[]
  filters: string[]
  grains: string[]
  criteria: string[]
  ordering: AiClientToolAnalyticalOrderingCapability[]
  completeness: {
    complete: boolean
    partial: boolean
    continuation: boolean
    boundedBy?: AiClientToolAnalyticalBoundedCompleteness
  }
  /** Explicit declaration-local intent-to-coordinate edges; no natural-language inference is permitted. */
  semanticIntentBindings?: AiClientToolAnalyticalSemanticIntentBinding[]
  /** Optional call-local selector; absent or unmatched values retain ordinary read-only evidence semantics. */
  closedEnumSelector?: AiClientToolAnalyticalClosedEnumSelector
  /** Typed semantic-to-argument edges; content dependencies remain owned by routing prerequisites. */
  argumentBindings?: AiClientToolAnalyticalArgumentBinding[]
  output: AiClientToolAnalyticalOutputCapability
  transformCost: number
}

/**
 * Model-routing signals declared by a browser tool.
 *
 * The contract is deliberately independent from browser execution metadata. It helps the backend
 * discover an already authorized tool, but never grants permission or changes its handler.
 */
export interface AiClientToolRoutingMetadata {
  portVersion?: typeof AI_CLIENT_TOOL_PORT_VERSION
  consumerPorts?: AiClientToolConsumerPort[]
  producerPorts?: AiClientToolProducerPort[]
  aliases?: string[]
  capabilities?: string[]
  accepts?: string[]
  produces?: string[]
  intents?: string[]
  notFor?: string[]
  stages?: AiClientToolRoutingStage[]
  dataAccessModes?: AiClientToolRoutingDataAccessMode[]
  resultDeliveries?: AiClientToolRoutingResultDelivery[]
  outputShapes?: string[]
  cost?: AiClientToolRoutingCost
  /** Hard input bindings that must be supplied by authoritative context or another tool's produces. */
  prerequisites?: string[]
  evidencePolicy?: AiClientToolEvidencePolicy
  exposure?: AiClientToolRoutingExposure
  help?: AiClientToolRoutingHelp
  validationHints?: string[]
  /** Non-analytical custom-range input edge; analytical producers keep this inside their capability. */
  temporalArgumentBinding?: AiClientToolAnalyticalTemporalArgumentBinding
  /** ToolSurface capability declaration transported verbatim after bounded canonical validation. */
  analyticalCapability?: AiClientToolAnalyticalCapability
}

export type AiClientToolRoutingKind =
  | 'navigation'
  | 'discovery'
  | 'detail'
  | 'aggregate'
  | 'records'
  | 'artifact'
  | 'action'

const ROUTING_KIND_DEFAULTS: Record<AiClientToolRoutingKind, AiClientToolRoutingMetadata> = {
  navigation: {
    stages: ['navigation'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'none',
    exposure: 'auto',
    cost: 'low',
  },
  discovery: {
    stages: ['navigation', 'preparation'],
    dataAccessModes: ['discovery'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'optional',
    exposure: 'auto',
    cost: 'low',
  },
  detail: {
    stages: ['preparation', 'execution'],
    dataAccessModes: ['detail'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'optional',
    exposure: 'auto',
    cost: 'low',
  },
  aggregate: {
    stages: ['execution'],
    dataAccessModes: ['aggregate'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'required',
    exposure: 'auto',
    validationHints: ['structured-output-exists'],
  },
  records: {
    stages: ['execution'],
    dataAccessModes: ['records'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'optional',
    exposure: 'auto',
  },
  artifact: {
    stages: ['terminal'],
    resultDeliveries: ['file'],
    evidencePolicy: 'required',
    exposure: 'deferred',
    cost: 'high',
    validationHints: ['artifact-exists'],
  },
  action: {
    stages: ['execution'],
    resultDeliveries: ['inline'],
    evidencePolicy: 'optional',
    exposure: 'deferred',
  },
}

/** Applies category defaults while keeping every semantic capability/binding explicit at the owning tool. */
export const defineAiClientToolRouting = (
  kind: AiClientToolRoutingKind,
  metadata: AiClientToolRoutingMetadata,
): AiClientToolRoutingMetadata => ({
  ...ROUTING_KIND_DEFAULTS[kind],
  ...metadata,
})

export interface AiClientToolRoutingSource extends Record<string, unknown> {
  id?: string
  name?: string
  displayName?: string
  description?: string
  inputs?: Array<Record<string, unknown>>
  parameterSchema?: AiClientToolParameterSchema
  routing?: AiClientToolRoutingMetadata
  expands?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

export const resolveAiClientToolCanonicalEffect = (
  tool: AiClientToolRoutingSource,
): AiClientToolEffectKind | undefined => {
  if (!isRecord(tool._meta)) return undefined
  const definition = tool._meta.clientToolDefinition
  if (!isRecord(definition) || definition.version !== 'client-tool-definition/v1') return undefined
  const effect = normalizeText(definition.effect).toUpperCase()
  return (['READ', 'WRITE', 'EXTERNAL_ACTION'] as const).find(candidate => candidate === effect)
}

export interface AiClientToolRoutingIssue {
  code: string
  field: string
  message: string
}

export interface AiClientToolEffectValidation {
  status: AiClientToolEffectStatus
  effect?: AiClientToolEffectKind
  issues: AiClientToolRoutingIssue[]
}

const resolveEffectKind = (value: unknown): AiClientToolEffectKind | undefined => {
  if (typeof value !== 'string') return undefined
  const effect = normalizeText(value).toUpperCase()
  return (['READ', 'WRITE', 'EXTERNAL_ACTION'] as const).find(candidate => candidate === effect)
}

/** Resolves facade and legacy effects once at the attach boundary without guessing from tool text. */
export const validateAiClientToolEffectMetadata = (
  tool: AiClientToolRoutingSource,
): AiClientToolEffectValidation => {
  const definition = isRecord(tool._meta) ? tool._meta.clientToolDefinition : undefined
  const hasCanonicalDefinition = definition !== undefined
  const canonicalEffect = resolveAiClientToolCanonicalEffect(tool)
  const expands = isRecord(tool.expands) ? tool.expands : undefined
  const hasLegacyEffect = !!expands
    && Object.prototype.hasOwnProperty.call(expands, AI_CLIENT_TOOL_EFFECT_EXPAND_KEY)
  const legacyEffect = hasLegacyEffect
    ? resolveEffectKind(expands?.[AI_CLIENT_TOOL_EFFECT_EXPAND_KEY])
    : undefined
  const annotations = isRecord(tool.annotations) ? tool.annotations : undefined
  const risk = isRecord(tool.risk) ? tool.risk : undefined
  const declaresSideEffect = annotations?.readOnlyHint === false
    || annotations?.destructiveHint === true
    || expands?.readOnly === false
    || risk?.readOnly === false
    || expands?.needsApproval === true
    || risk?.needsApproval === true
    || tool.confirm === true
    || isRecord(tool.confirm)
  const declaresReadOnly = annotations?.readOnlyHint === true
    || expands?.readOnly === true
    || risk?.readOnly === true
  const malformed = (code: string, field: string, message: string): AiClientToolEffectValidation => ({
    status: 'malformed',
    issues: [{ code, field, message }],
  })

  if (hasCanonicalDefinition && !canonicalEffect) {
    return malformed('effect_canonical_malformed', '_meta.clientToolDefinition.effect',
      'canonical client-tool effect must be READ, WRITE, or EXTERNAL_ACTION')
  }
  if (hasLegacyEffect && !legacyEffect) {
    return malformed('effect_legacy_malformed', `expands.${AI_CLIENT_TOOL_EFFECT_EXPAND_KEY}`,
      'legacy client-tool effect must be READ, WRITE, or EXTERNAL_ACTION')
  }
  if (canonicalEffect && legacyEffect && canonicalEffect !== legacyEffect) {
    return malformed('effect_conflict', `expands.${AI_CLIENT_TOOL_EFFECT_EXPAND_KEY}`,
      'legacy effect conflicts with the canonical client-tool definition')
  }
  const effect = canonicalEffect || legacyEffect
  if (!effect && declaresSideEffect) {
    return malformed('effect_required_for_side_effect', `expands.${AI_CLIENT_TOOL_EFFECT_EXPAND_KEY}`,
      'a client tool declared as non-read-only must provide typed effect metadata')
  }
  if (effect === 'READ' && declaresSideEffect) {
    return malformed('effect_read_only_conflict', `expands.${AI_CLIENT_TOOL_EFFECT_EXPAND_KEY}`,
      'READ effect conflicts with non-read-only metadata')
  }
  if (effect && effect !== 'READ' && declaresReadOnly) {
    return malformed('effect_side_effect_conflict', `expands.${AI_CLIENT_TOOL_EFFECT_EXPAND_KEY}`,
      `${effect} effect conflicts with read-only metadata`)
  }
  return {
    status: canonicalEffect ? 'canonical' : legacyEffect ? 'legacy' : 'missing',
    ...(effect ? { effect } : {}),
    issues: [],
  }
}

export interface AiClientToolRoutingValidation {
  status: AiClientToolRoutingStatus
  metadata?: AiClientToolRoutingMetadata
  issues: AiClientToolRoutingIssue[]
}

export interface AiClientToolRoutingCatalogIssue extends AiClientToolRoutingIssue {
  toolId: string
}

export interface AiClientToolRoutingCatalogValidationOptions {
  requireRouting?: boolean
  /** Requires browser-runtime JSON paths for every inline routing.produces binding. */
  requireResultBindings?: boolean
  /** Bindings supplied by the authenticated page/session context rather than another tool. */
  availableBindings?: readonly string[]
  /** EAGER is reserved for a very small bootstrap set because the backend treats it atomically. */
  maxEagerTools?: number
  /** Approximate serialized schema budget reserved for frontend EAGER tools. */
  maxEagerSchemaChars?: number
  /** Prevents a technically closed catalog from creating an impractically deep tool chain. */
  maxDependencyDepth?: number
}

export const AI_CLIENT_TOOL_DEFAULT_MAX_EAGER_TOOLS = 3
export const AI_CLIENT_TOOL_DEFAULT_MAX_EAGER_SCHEMA_CHARS = 12_000
export const AI_CLIENT_TOOL_DEFAULT_MAX_DEPENDENCY_DEPTH = 8

const MAX_ROUTING_ITEMS = 64
const MAX_ROUTING_TEXT_LENGTH = 240
const MAX_ALIASES = 16
const MAX_ALIAS_LENGTH = 120
const MAX_HELP_INTENTS = 32
const TOOL_ID_PATTERN = /^[a-z][a-z0-9_]{0,127}$/
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/
const RESOURCE_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+*/_-]*$/

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

/** Accepts canonical and Jakarta-qualified validator names without changing their serialized identity. */
const validatorType = (validator: unknown) => {
  const value = isRecord(validator) ? validator.type : validator
  if (typeof value !== 'string') return ''
  return value.slice(value.lastIndexOf('.') + 1)
}

/** Keeps the argument optional while requiring a supplied one-or-more array to contain at least one value. */
const withOneOrMoreArraySize = (value: Record<string, unknown>) => {
  const expands = isRecord(value.expands) ? value.expands : {}
  const declared = expands.validators
  const validators = Array.isArray(declared)
    ? [...declared]
    : declared === undefined
      ? []
      : [declared]
  const sizeIndexes = validators
    .map((validator, index) => validatorType(validator) === 'Size' ? index : -1)
    .filter(index => index >= 0)
  const sufficient = sizeIndexes.some(index => {
    const validator = validators[index]
    return isRecord(validator)
      && typeof validator.min === 'number'
      && Number.isInteger(validator.min)
      && validator.min >= 1
  })
  if (!sufficient) {
    const sizeIndex = sizeIndexes[0]
    if (sizeIndex === undefined) {
      validators.push({ type: 'Size', min: 1 })
    } else {
      const existing = validators[sizeIndex]
      validators[sizeIndex] = isRecord(existing)
        ? { ...existing, min: 1 }
        : { type: existing, min: 1 }
    }
  }
  return {
    ...value,
    expands: { ...expands, validators },
  }
}

const toSessionInput = (value: unknown, oneOrMoreArray = false) => {
  if (!isRecord(value)) return value
  const projected = oneOrMoreArray ? withOneOrMoreArraySize(value) : value
  const required = projected.required === true
  const hasDefaultValue = Object.prototype.hasOwnProperty.call(projected, 'defaultValue')
    && projected.defaultValue !== undefined
  if (!required && !hasDefaultValue) return projected

  const expands = isRecord(projected.expands) ? projected.expands : {}
  const sessionValue = { ...projected }
  delete sessionValue.defaultValue

  return {
    ...sessionValue,
    // JetLinks FunctionMetadata reads required/default from PropertyMetadata.expands.
    expands: {
      ...expands,
      ...(required ? { required: true } : {}),
      ...(hasDefaultValue && !Object.prototype.hasOwnProperty.call(expands, 'default')
        ? { default: projected.defaultValue }
        : {}),
    },
  }
}

const normalizeText = (value: unknown, maxLength = MAX_ROUTING_TEXT_LENGTH) => {
  const text = String(value || '').trim()
  return text ? text.slice(0, maxLength) : ''
}

const normalizeList = (
  value: unknown,
  maxItems = MAX_ROUTING_ITEMS,
  maxLength = MAX_ROUTING_TEXT_LENGTH,
) => {
  const source = Array.isArray(value) ? value : (value == null ? [] : [value])
  return Array.from(new Set(source
    .map(item => normalizeText(item, maxLength).toLowerCase())
    .filter(Boolean)))
    .slice(0, maxItems)
}

const normalizeNaturalLanguageList = (
  value: unknown,
  maxItems = MAX_ROUTING_ITEMS,
  maxLength = MAX_ROUTING_TEXT_LENGTH,
) => {
  const source = Array.isArray(value) ? value : (value == null ? [] : [value])
  return Array.from(new Set(source
    .map(item => normalizeText(item, maxLength))
    .filter(Boolean)))
    .slice(0, maxItems)
}

const normalizeIntentSections = (value: unknown) => {
  const result: Record<string, string> = {}
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (!isRecord(item) || Object.keys(result).length >= MAX_HELP_INTENTS) return
      const intent = normalizeText(item.intent)
      const section = normalizeText(item.section)
      if (intent && section) result[intent] = section
    })
    return result
  }
  if (!isRecord(value)) return result
  Object.entries(value).slice(0, MAX_HELP_INTENTS).forEach(([intentValue, sectionValue]) => {
    const intent = normalizeText(intentValue)
    const section = normalizeText(sectionValue)
    if (intent && section) result[intent] = section
  })
  return result
}

const normalizeHelp = (value: unknown): AiClientToolRoutingHelp | undefined => {
  if (!isRecord(value)) return undefined
  const quickstartSection = normalizeText(value.quickstartSection)
  const intentSections = normalizeIntentSections(value.intentSections)
  const result = {
    ...(quickstartSection ? { quickstartSection } : {}),
    ...(Object.keys(intentSections).length ? { intentSections } : {}),
  }
  return Object.keys(result).length ? result : undefined
}

const normalizeEnum = <T extends string>(value: unknown, allowed: readonly T[]) => {
  const normalized = normalizeText(value).toLowerCase()
  return allowed.includes(normalized as T) ? normalized as T : undefined
}

const normalizeProducerPort = (value: unknown): AiClientToolProducerPort | undefined => {
  if (!isRecord(value)) return undefined
  const name = normalizeText(value.name, 160).toLowerCase()
  const type = normalizeEnum(value.type, AI_CLIENT_TOOL_RESOURCE_TYPES)
  const mediaType = normalizeText(value.mediaType, 160).toLowerCase()
  const shape = normalizeText(value.shape, 160).toLowerCase()
  const audience = normalizeEnum(value.audience, AI_CLIENT_TOOL_OUTPUT_AUDIENCES)
  if (value.audience !== undefined && !audience) return undefined
  if (!name || !type || !mediaType || !shape) return undefined
  return { name, type, mediaType, shape, ...(audience ? { audience } : {}) }
}

const normalizePorts = <T>(value: unknown, mapper: (item: unknown) => T | undefined): T[] => {
  if (!Array.isArray(value)) return []
  const ports: T[] = []
  value.slice(0, MAX_ROUTING_ITEMS).forEach((item) => {
    const port = mapper(item)
    if (port) ports.push(port)
  })
  return ports
}

const normalizeConsumerPort = (value: unknown): AiClientToolConsumerPort | undefined => {
  const producer = normalizeProducerPort(value)
  if (!producer || !isRecord(value)) return undefined
  const normalizedSourcePolicy = normalizeText(value.sourcePolicy).toUpperCase()
  const sourcePolicy = AI_CLIENT_TOOL_SOURCE_POLICIES.includes(
    normalizedSourcePolicy as AiClientToolSourcePolicy,
  )
    ? normalizedSourcePolicy as AiClientToolSourcePolicy
    : undefined
  const rawArgumentBinding = value.argumentBinding
  const argument = isRecord(rawArgumentBinding)
    ? normalizeText(rawArgumentBinding.argument, 160)
    : ''
  const rawContextSource = isRecord(rawArgumentBinding)
    ? rawArgumentBinding.contextSource
    : undefined
  const authoredSubjectType = isRecord(rawContextSource)
    ? String(rawContextSource.subjectType || '').trim()
    : ''
  const subjectType = authoredSubjectType.length <= 160 ? authoredSubjectType : ''
  const contextSource = rawContextSource === undefined
    ? undefined
    : isRecord(rawContextSource)
      && Object.keys(rawContextSource).length === 4
      && rawContextSource.kind === 'subject'
      && rawContextSource.selection === 'primary'
      && subjectType
      && rawContextSource.coordinate === 'id'
      ? {
          kind: 'subject' as const,
          selection: 'primary' as const,
          subjectType,
          coordinate: 'id' as const,
        }
      : undefined
  const argumentBinding = rawArgumentBinding === undefined
    ? undefined
    : isRecord(rawArgumentBinding)
      && Object.keys(rawArgumentBinding).length === (rawContextSource === undefined ? 3 : 4)
      && argument
      && ANALYTICAL_ARGUMENT_PATTERN.test(argument)
      && rawArgumentBinding.valueCardinality === 'exactly-one'
      && rawArgumentBinding.encoding === 'single-string'
      && (rawContextSource === undefined || contextSource)
      ? {
          argument,
          valueCardinality: 'exactly-one' as const,
          encoding: 'single-string' as const,
          ...(contextSource ? { contextSource } : {}),
        }
      : undefined
  if (!sourcePolicy || typeof value.required !== 'boolean'
    || (rawArgumentBinding !== undefined && !argumentBinding)
    || (sourcePolicy === 'TOOL' && contextSource)
    || (sourcePolicy === 'CONTEXT' && rawArgumentBinding !== undefined && !contextSource)) return undefined
  const { audience: _audience, ...resource } = producer
  return {
    ...resource,
    required: value.required,
    sourcePolicy,
    ...(argumentBinding ? { argumentBinding } : {}),
  }
}

const ANALYTICAL_TOKEN_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/
const ANALYTICAL_ARGUMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]{0,159}$/

const normalizeAnalyticalValues = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || value.length > MAX_ROUTING_ITEMS) return undefined
  const values: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const normalized = normalizeText(item, 160).toLowerCase()
    if (!normalized || !ANALYTICAL_TOKEN_PATTERN.test(normalized)) return undefined
    if (!seen.has(normalized)) {
      seen.add(normalized)
      values.push(normalized)
    }
  }
  return values
}

const normalizeAnalyticalMeasure = (value: unknown): AiClientToolAnalyticalMeasureCapability | undefined => {
  if (!isRecord(value) || Object.keys(value).length !== 3) return undefined
  const name = normalizeText(value.name, 160).toLowerCase()
  const aggregations = normalizeAnalyticalValues(value.aggregations)
  const units = normalizeAnalyticalValues(value.units)
  if (!name || !ANALYTICAL_TOKEN_PATTERN.test(name) || !aggregations?.length || !units) return undefined
  return { name, aggregations, units }
}

const normalizeAnalyticalOrdering = (value: unknown): AiClientToolAnalyticalOrderingCapability | undefined => {
  if (!isRecord(value)) return undefined
  const axis = normalizeText(value.axis, 160).toLowerCase()
  const direction = normalizeEnum(value.direction, ['asc', 'desc'] as const)
  if (!axis || !ANALYTICAL_TOKEN_PATTERN.test(axis) || !direction
    || typeof value.producerGuaranteed !== 'boolean') return undefined
  return { axis, direction, producerGuaranteed: value.producerGuaranteed }
}

const normalizeAnalyticalCoordinateSubset = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ROUTING_ITEMS) return undefined
  const normalized = value.map(item => normalizeText(item, 160).toLowerCase())
  if (normalized.some(item => !item || !ANALYTICAL_TOKEN_PATTERN.test(item))
    || new Set(normalized).size !== normalized.length) return undefined
  return normalized
}

const normalizeAnalyticalSemanticIntentBindings = (
  value: unknown,
): AiClientToolAnalyticalSemanticIntentBinding[] | undefined => {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ROUTING_ITEMS) return undefined
  const bindings: AiClientToolAnalyticalSemanticIntentBinding[] = []
  const intents = new Set<string>()
  for (const item of value) {
    if (!isRecord(item)) return undefined
    const hasScopeSelection = Object.prototype.hasOwnProperty.call(item, 'scopeSelection')
    if (Object.keys(item).length !== (hasScopeSelection ? 5 : 4)
      || typeof item.intent !== 'string') return undefined
    const intent = normalizeText(item.intent)
    const criterion = normalizeText(item.criterion, 160).toLowerCase()
    const measures = normalizeAnalyticalCoordinateSubset(item.measures)
    const dimensions = normalizeAnalyticalCoordinateSubset(item.dimensions)
    const rawScopeSelection = item.scopeSelection
    const scopeSelection = !hasScopeSelection
      ? undefined
      : isRecord(rawScopeSelection)
        && Object.keys(rawScopeSelection).length === (rawScopeSelection.outputBinding === undefined ? 2 : 3)
        && (rawScopeSelection.outputBinding === undefined
          || typeof rawScopeSelection.outputBinding === 'string' && !!rawScopeSelection.outputBinding.trim())
        && rawScopeSelection.binding === 'scope'
        && Array.isArray(rawScopeSelection.modes)
        && rawScopeSelection.modes.length === 2
        && rawScopeSelection.modes[0] === 'project'
        && rawScopeSelection.modes[1] === 'explicit'
          ? { binding: 'scope' as const, modes: ['project', 'explicit'] as ['project', 'explicit'],
              ...(rawScopeSelection.outputBinding ? { outputBinding: rawScopeSelection.outputBinding as string } : {}) }
          : false
    if (!intent || intents.has(intent)
      || !criterion || !ANALYTICAL_TOKEN_PATTERN.test(criterion)
      || !measures || !dimensions || scopeSelection === false) return undefined
    intents.add(intent)
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
  ))) return undefined
  return bindings
}

const normalizeAnalyticalClosedEnumSelector = (
  value: unknown,
): AiClientToolAnalyticalClosedEnumSelector | undefined => {
  if (!isRecord(value)
    || Object.keys(value).length !== 3
    || !isExactAnalyticalArgument(value.argument)
    || !isExactAnalyticalArgument(value.limitArgument)
    || value.argument === value.limitArgument
    || !Array.isArray(value.cases)
    || !value.cases.length
    || value.cases.length > MAX_ROUTING_ITEMS) return undefined
  const cases: AiClientToolAnalyticalClosedEnumSelectorCase[] = []
  const values = new Set<string>()
  for (const rawCase of value.cases) {
    if (!isRecord(rawCase)
      || Object.keys(rawCase).length !== 6
      || !isExactAnalyticalToken(rawCase.value)
      || values.has(rawCase.value as string)
      || !isExactAnalyticalToken(rawCase.criterion)
      || !Number.isSafeInteger(rawCase.requestedLimit)
      || Number(rawCase.requestedLimit) <= 0) return undefined
    const measures = normalizeAnalyticalCoordinateSubset(rawCase.measures)
    const dimensions = normalizeAnalyticalCoordinateSubset(rawCase.dimensions)
    const rawOrdering = rawCase.ordering
    const axis = isRecord(rawOrdering) && Object.keys(rawOrdering).length === 2
      ? normalizeText(rawOrdering.axis, 160).toLowerCase()
      : ''
    const direction = isRecord(rawOrdering)
      ? normalizeEnum(rawOrdering.direction, ['asc', 'desc'] as const)
      : undefined
    if (!measures || !dimensions || !axis || !ANALYTICAL_TOKEN_PATTERN.test(axis) || !direction) {
      return undefined
    }
    values.add(rawCase.value as string)
    cases.push({
      value: rawCase.value as string,
      criterion: rawCase.criterion as string,
      measures,
      dimensions,
      ordering: { axis, direction },
      requestedLimit: Number(rawCase.requestedLimit),
    })
  }
  return {
    argument: value.argument as string,
    limitArgument: value.limitArgument as string,
    cases,
  }
}

const normalizeAnalyticalTemporalArgumentBinding = (
  value: unknown,
): AiClientToolAnalyticalTemporalArgumentBinding | undefined => {
  if (!isRecord(value) || value.semantic !== 'temporal') return undefined
  const rangeArgument = normalizeText(value.rangeArgument, 160)
  const startArgument = normalizeText(value.startArgument, 160)
  const endArgument = normalizeText(value.endArgument, 160)
  const customValue = normalizeText(value.customValue, 160)
  const encoding = normalizeEnum(value.encoding, ['date-time'] as const)
  const argumentsForBinding = [rangeArgument, startArgument, endArgument]
  if (Object.keys(value).length !== 6
    || argumentsForBinding.some(argument => !argument || !ANALYTICAL_ARGUMENT_PATTERN.test(argument))
    || new Set(argumentsForBinding).size !== argumentsForBinding.length
    || !customValue || customValue !== value.customValue
    || !ANALYTICAL_ARGUMENT_PATTERN.test(customValue)
    || !encoding) return undefined
  return {
    semantic: 'temporal',
    rangeArgument,
    startArgument,
    endArgument,
    customValue,
    encoding,
  }
}

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
  && ANALYTICAL_ARGUMENT_PATTERN.test(value)
)

const normalizeExactStringEnum = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || !value.length || value.length > MAX_ROUTING_ITEMS
    || value.some(item => !isExactAnalyticalToken(item))
    || new Set(value).size !== value.length) return undefined
  return [...value] as string[]
}

const normalizeAnalyticalFilterArgumentBinding = (
  value: Record<string, unknown>,
): AiClientToolAnalyticalFilterArgumentBinding | undefined => {
  if (value.semantic !== 'filter' || !isExactAnalyticalToken(value.axis)) return undefined
  if (Object.prototype.hasOwnProperty.call(value, 'operator')) {
    const scalar = value.valueCardinality === 'exactly-one' && value.encoding === 'scalar'
    const stringArray = value.valueCardinality === 'one-or-more' && value.encoding === 'string-array'
    if (Object.keys(value).length !== 6
      || !isExactAnalyticalToken(value.operator)
      || !isExactAnalyticalArgument(value.valueArgument)
      || (!scalar && !stringArray)) return undefined
    const fixed = {
      semantic: 'filter',
      axis: value.axis as string,
      operator: value.operator as string,
      valueArgument: value.valueArgument as string,
    } as const
    return stringArray
      ? { ...fixed, valueCardinality: 'one-or-more', encoding: 'string-array' }
      : { ...fixed, valueCardinality: 'exactly-one', encoding: 'scalar' }
  }
  const operators = normalizeExactStringEnum(value.operators)
  if (Object.keys(value).length !== 7
    || !operators
    || !isExactAnalyticalArgument(value.operatorArgument)
    || !isExactAnalyticalArgument(value.valueArgument)
    || value.valueCardinality !== 'one-or-more'
    || value.encoding !== 'string-array') return undefined
  return {
    semantic: 'filter',
    axis: value.axis as string,
    operators,
    operatorArgument: value.operatorArgument as string,
    valueArgument: value.valueArgument as string,
    valueCardinality: 'one-or-more',
    encoding: 'string-array',
  }
}

const normalizeAnalyticalArgumentBindings = (
  value: unknown,
): AiClientToolAnalyticalArgumentBinding[] | undefined => {
  if (!Array.isArray(value) || value.length > MAX_ROUTING_ITEMS) return undefined
  const bindings: AiClientToolAnalyticalArgumentBinding[] = []
  const semantics = new Set<string>()
  const argumentsSeen = new Set<string>()
  const filterPairs = new Set<string>()
  for (const item of value) {
    if (!isRecord(item)) return undefined
    const semantic = item.semantic === 'filter'
      ? 'filter' as const
      : normalizeEnum(item.semantic, ['dimension', 'measure', 'temporal', 'scope'] as const)
    if (!semantic || (semantic !== 'filter' && semantics.has(semantic))) return undefined
    if (semantic !== 'filter') semantics.add(semantic)
    if (semantic === 'filter') {
      const filter = normalizeAnalyticalFilterArgumentBinding(item)
      if (!filter) return undefined
      const argumentsForBinding = 'operatorArgument' in filter
        ? [filter.operatorArgument, filter.valueArgument]
        : [filter.valueArgument]
      if (argumentsForBinding.some(argument => argumentsSeen.has(argument))) return undefined
      const pairs = 'operator' in filter
        ? [filter.operator]
        : filter.operators
      if (pairs.some(operator => filterPairs.has(`${filter.axis}\u0000${operator}`))) return undefined
      argumentsForBinding.forEach(argument => argumentsSeen.add(argument))
      pairs.forEach(operator => filterPairs.add(`${filter.axis}\u0000${operator}`))
      bindings.push(filter)
      continue
    }
    if (semantic === 'dimension') {
      const argument = normalizeText(item.argument, 160)
      if (Object.keys(item).length !== 2
        || !argument || !ANALYTICAL_ARGUMENT_PATTERN.test(argument)
        || argumentsSeen.has(argument)) return undefined
      argumentsSeen.add(argument)
      bindings.push({ semantic, argument })
      continue
    }
    if (semantic === 'measure') {
      const argument = normalizeText(item.argument, 160)
      const valueCardinality = normalizeEnum(item.valueCardinality, ['exactly-one'] as const)
      const encoding = normalizeEnum(item.encoding, ['single-string'] as const)
      if (Object.keys(item).length !== 4
        || !argument || !ANALYTICAL_ARGUMENT_PATTERN.test(argument)
        || argumentsSeen.has(argument) || !valueCardinality || !encoding) return undefined
      argumentsSeen.add(argument)
      bindings.push({ semantic, argument, valueCardinality, encoding })
      continue
    }
    if (semantic === 'scope') {
      const modeArgument = normalizeText(item.modeArgument, 160)
      const valueCardinality = normalizeEnum(item.valueCardinality, ['exactly-one'] as const)
      const encoding = normalizeEnum(item.encoding, ['single-string'] as const)
      if (Object.keys(item).length !== 5
        || !modeArgument || !ANALYTICAL_ARGUMENT_PATTERN.test(modeArgument)
        || argumentsSeen.has(modeArgument) || !valueCardinality || !encoding
        || !Array.isArray(item.coordinates) || item.coordinates.length !== 3) return undefined
      argumentsSeen.add(modeArgument)
      const coordinates = new Map<
        AiClientToolAnalyticalScopeCoordinate['type'],
        AiClientToolAnalyticalScopeCoordinate
      >()
      for (const rawCoordinate of item.coordinates) {
        if (!isRecord(rawCoordinate)) return undefined
        const type = normalizeEnum(rawCoordinate.type, ['project', 'area', 'point'] as const)
        if (!type || coordinates.has(type) || !Array.isArray(rawCoordinate.arguments)) return undefined
        if (type === 'project') {
          if (Object.keys(rawCoordinate).length !== 2 || rawCoordinate.arguments.length) return undefined
          coordinates.set(type, { type, arguments: [] })
          continue
        }
        const sourcePort = normalizeText(rawCoordinate.sourcePort, 160).toLowerCase()
        const argument = normalizeText(rawCoordinate.arguments[0], 160)
        if (Object.keys(rawCoordinate).length !== 3
          || rawCoordinate.arguments.length !== 1
          || !sourcePort || !RESOURCE_TYPE_PATTERN.test(sourcePort)
          || !argument || !ANALYTICAL_ARGUMENT_PATTERN.test(argument)
          || argumentsSeen.has(argument)) return undefined
        argumentsSeen.add(argument)
        coordinates.set(type, { type, sourcePort, arguments: [argument] })
      }
      const project = coordinates.get('project')
      const area = coordinates.get('area')
      const point = coordinates.get('point')
      if (!project || project.type !== 'project'
        || !area || !point
        || area.type !== 'area' || point.type !== 'point') return undefined
      bindings.push({
        semantic,
        modeArgument,
        valueCardinality,
        encoding,
        coordinates: [project, area, point],
      })
      continue
    }
    const temporal = normalizeAnalyticalTemporalArgumentBinding(item)
    if (!temporal) return undefined
    const argumentsForBinding = [temporal.rangeArgument, temporal.startArgument, temporal.endArgument]
    if (argumentsForBinding.some(argument => argumentsSeen.has(argument))) return undefined
    argumentsForBinding.forEach(argument => argumentsSeen.add(argument))
    bindings.push(temporal)
  }
  return bindings
}

const analyticalBindingArguments = (binding: AiClientToolAnalyticalArgumentBinding): string[] => {
  if (binding.semantic === 'dimension' || binding.semantic === 'measure') return [binding.argument]
  if (binding.semantic === 'temporal') {
    return [binding.rangeArgument, binding.startArgument, binding.endArgument]
  }
  if (binding.semantic === 'filter') {
    return 'operatorArgument' in binding
      ? [binding.operatorArgument, binding.valueArgument]
      : [binding.valueArgument]
  }
  return [binding.modeArgument, ...binding.coordinates.flatMap(coordinate => coordinate.arguments)]
}

const inputIsRequired = (input: Record<string, unknown>) => (
  input.required === true || (isRecord(input.expands) && input.expands.required === true)
)

const inputValueType = (input: Record<string, unknown>) => (
  typeof input.valueType === 'string'
    ? { type: input.valueType }
    : (isRecord(input.valueType) ? input.valueType : undefined)
)

const hasInputDefault = (input: Record<string, unknown>) => (
  Object.prototype.hasOwnProperty.call(input, 'defaultValue')
  || (isRecord(input.expands) && Object.prototype.hasOwnProperty.call(input.expands, 'default'))
)

const hasDistinctNormalizedEnumValues = (values: readonly string[]) => {
  const normalized = values.map(value => value.trim().toLowerCase())
  return normalized.every((value, index) => value && normalized.indexOf(value) === index)
}

const exactStringEnumValues = (value: Record<string, unknown>): string[] | undefined => {
  if (value.type !== 'enum' || !isRecord(value.valueType) || value.valueType.type !== 'string'
    || !Array.isArray(value.elements) || !value.elements.length) return undefined
  const values: string[] = []
  for (const item of value.elements) {
    if (!isRecord(item) || typeof item.value !== 'string') return undefined
    values.push(item.value)
  }
  return hasDistinctNormalizedEnumValues(values) ? values : undefined
}

const isExactScalarStringInput = (input: Record<string, unknown>) => {
  if (hasInputDefault(input)) return false
  if (input.valueType === 'string') return true
  const valueType = inputValueType(input)
  return !!valueType && (valueType.type === 'string' || !!exactStringEnumValues(valueType))
}

type AiClientToolAnalyticalMeasureBindingSource = Pick<
  AiClientToolRoutingSource,
  'inputs'
>

/**
 * Proves that a call-local analytical selector is a closed enum over exactly the
 * intent-admitted measures. Its presence is optional so producers can retain
 * their declared default; when supplied, its cardinality remains exactly one.
 */
export const validateAiClientToolAnalyticalMeasureBinding = (
  source: AiClientToolAnalyticalMeasureBindingSource,
  binding: AiClientToolAnalyticalMeasureArgumentBinding,
  intentMeasures: readonly string[],
): boolean => {
  if (binding.valueCardinality !== 'exactly-one'
    || binding.encoding !== 'single-string'
    || !ANALYTICAL_ARGUMENT_PATTERN.test(binding.argument)
    || !intentMeasures.length
    || !hasDistinctNormalizedEnumValues(intentMeasures)) return false
  const matchingInputs = (source.inputs || []).filter(input => (
    isRecord(input) && normalizeText(input.id, 160) === binding.argument
  ))
  if (matchingInputs.length !== 1 || hasInputDefault(matchingInputs[0])) return false
  const enumValues = exactStringEnumValues(inputValueType(matchingInputs[0]) || {})
  return !!enumValues
    && enumValues.length === intentMeasures.length
    && enumValues.every(value => intentMeasures.includes(value))
}

/** Proves selector cases only against the exact closed enum and bounded integer inputs of this declaration. */
export const validateAiClientToolAnalyticalClosedEnumSelector = (
  source: AiClientToolAnalyticalMeasureBindingSource,
  selector: AiClientToolAnalyticalClosedEnumSelector,
): boolean => {
  const inputs = source.inputs || []
  const selectorInputs = inputs.filter(input => (
    isRecord(input) && normalizeText(input.id, 160) === selector.argument
  ))
  const limitInputs = inputs.filter(input => (
    isRecord(input) && normalizeText(input.id, 160) === selector.limitArgument
  ))
  if (selectorInputs.length !== 1 || limitInputs.length !== 1
    || selector.argument === selector.limitArgument
    || hasInputDefault(selectorInputs[0])
    || hasInputDefault(limitInputs[0])) return false
  const enumValues = exactStringEnumValues(inputValueType(selectorInputs[0]) || {})
  const limitType = inputValueType(limitInputs[0])
  if (!enumValues || !limitType || !['int', 'integer'].includes(String(limitType.type).toLowerCase())) {
    return false
  }
  const minimum = limitType.min === undefined ? undefined : Number(limitType.min)
  const maximum = limitType.max === undefined ? undefined : Number(limitType.max)
  return selector.cases.length > 0
    && selector.cases.every(item => (
      enumValues.includes(item.value)
      && Number.isSafeInteger(item.requestedLimit)
      && item.requestedLimit > 0
      && (minimum === undefined || item.requestedLimit >= minimum)
      && (maximum === undefined || item.requestedLimit <= maximum)
    ))
}

/** Proves the array from canonical JetLinks DataType metadata, never from a JSON Schema compatibility shape. */
const isExactStringArrayInput = (input: Record<string, unknown>) => {
  if (hasInputDefault(input)) return false
  const valueType = inputValueType(input)
  if (!valueType || valueType.type !== 'array'
    || !isRecord(valueType.elementType)) return false
  return valueType.elementType.type === 'string' || !!exactStringEnumValues(valueType.elementType)
}

type AiClientToolAnalyticalFilterBindingSource = Pick<
  AiClientToolRoutingSource,
  'inputs' | 'parameterSchema' | 'expands'
>

/**
 * Proves filter routing only from an exact root object schema and declared top-level input value schemas. The proof
 * does not infer targets from names, normalize provider types, or convert defaults into admitted filter values.
 */
export const validateAiClientToolAnalyticalFilterBinding = (
  source: AiClientToolAnalyticalFilterBindingSource,
  binding: AiClientToolAnalyticalFilterArgumentBinding,
): boolean => {
  const parameterSchema = resolveTemporalParameterSchema(source)
  if (!parameterSchema || parameterSchema.type !== 'object') return false
  const inputs = source.inputs || []
  const findInput = (argument: string) => inputs.filter(input => isRecord(input) && input.id === argument)
  const valueInputs = findInput(binding.valueArgument)
  if (valueInputs.length !== 1) return false
  if ('operator' in binding) {
    if (binding.valueCardinality === 'exactly-one' && binding.encoding === 'scalar') {
      return isExactScalarStringInput(valueInputs[0])
    }
    return binding.valueCardinality === 'one-or-more'
      && binding.encoding === 'string-array'
      && isExactStringArrayInput(valueInputs[0])
  }

  const operatorInputs = findInput(binding.operatorArgument)
  if (operatorInputs.length !== 1 || binding.operatorArgument === binding.valueArgument
    || hasInputDefault(operatorInputs[0])) return false
  const operators = exactStringEnumValues(inputValueType(operatorInputs[0]) || {})
  return !!operators
    && operators.length === binding.operators.length
    && operators.every((operator, index) => operator === binding.operators[index])
    && isExactStringArrayInput(valueInputs[0])
}

const normalizedRequiredList = (value: unknown, allowEmpty = false): string[] | undefined => {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)
    || value.some(item => typeof item !== 'string')) return undefined
  const values = value.map(item => normalizeText(item, 160))
  return values.every((item, index) => item && item === value[index]) && new Set(values).size === values.length
    ? values
    : undefined
}

const branchForbiddenInputs = (branch: Record<string, unknown>): string[] | undefined => {
  if (branch.not === undefined) return []
  if (!isRecord(branch.not) || !Array.isArray(branch.not.anyOf)) return undefined
  const result: string[] = []
  for (const item of branch.not.anyOf) {
    if (!isRecord(item) || Object.keys(item).length !== 1) return undefined
    const required = normalizedRequiredList(item.required)
    if (!required || required.length !== 1 || result.includes(required[0])) return undefined
    result.push(required[0])
  }
  return result
}

const resolveTemporalParameterSchema = (
  source: Pick<AiClientToolRoutingSource, 'parameterSchema' | 'expands'>,
): AiClientToolParameterSchema | undefined => {
  const direct = isRecord(source.parameterSchema) ? source.parameterSchema : undefined
  const expanded = isRecord(source.expands)
    && isRecord(source.expands[AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY])
    ? source.expands[AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY] as AiClientToolParameterSchema
    : undefined
  return direct && expanded ? undefined : direct || expanded
}

/**
 * Proves one temporal edge only from typed inputs and the closed custom-range alternatives owned by the tool definition.
 * Physical argument names and preset values are never inferred by this validator.
 */
export const validateAiClientToolAnalyticalTemporalBinding = (
  source: Pick<AiClientToolRoutingSource, 'inputs' | 'parameterSchema' | 'expands'>,
  binding: AiClientToolAnalyticalTemporalArgumentBinding,
  providedArguments: readonly string[] = [],
): boolean => {
  const inputs = source.inputs || []
  const findInput = (argument: string) => inputs.filter(input => normalizeText(input.id, 160) === argument)
  const rangeInputs = findInput(binding.rangeArgument)
  const startInputs = findInput(binding.startArgument)
  const endInputs = findInput(binding.endArgument)
  if (rangeInputs.length !== 1 || startInputs.length !== 1 || endInputs.length !== 1) return false

  const rangeInput = rangeInputs[0]
  const startInput = startInputs[0]
  const endInput = endInputs[0]
  const rangeType = inputValueType(rangeInput)
  const startType = inputValueType(startInput)
  const endType = inputValueType(endInput)
  const rangeElements = rangeType?.type === 'enum'
    && isRecord(rangeType.valueType)
    && rangeType.valueType.type === 'string'
    && Array.isArray(rangeType.elements)
    ? rangeType.elements
    : []
  const rangeValues = rangeElements.flatMap((element) => (
        isRecord(element) && typeof element.value === 'string' ? [element.value] : []
      ))
  if (!inputIsRequired(rangeInput)
    || inputIsRequired(startInput) || inputIsRequired(endInput)
    || rangeValues.length !== rangeElements.length
    || new Set(rangeValues).size !== rangeValues.length
    || rangeValues.filter(value => value === binding.customValue).length !== 1
    || binding.encoding !== 'date-time'
    || startType?.type !== 'date' || endType?.type !== 'date') return false

  const parameterSchema = resolveTemporalParameterSchema(source)
  const branches = parameterSchema?.oneOf
  if (!Array.isArray(branches) || !branches.length) return false
  const temporalArguments = new Set([
    binding.rangeArgument,
    binding.startArgument,
    binding.endArgument,
  ])
  const signatures = new Set<string>()
  const customBranches: Array<{ required: string[]; forbidden: string[] }> = []
  for (const rawBranch of branches) {
    if (!isRecord(rawBranch) || !isRecord(rawBranch.properties)) return false
    const required = normalizedRequiredList(rawBranch.required)
    const forbidden = branchForbiddenInputs(rawBranch)
    const rangeProperty = rawBranch.properties[binding.rangeArgument]
    if (!required || !forbidden || !isRecord(rangeProperty)) return false
    const requiredTemporal = required.filter(argument => temporalArguments.has(argument)).sort()
    const forbiddenTemporal = forbidden.filter(argument => temporalArguments.has(argument)).sort()
    const customBranch = rangeProperty.const === binding.customValue
    const presetValues = Array.isArray(rangeProperty.enum) ? rangeProperty.enum : undefined
    if (customBranch) {
      if (Object.prototype.hasOwnProperty.call(rangeProperty, 'enum')
        || requiredTemporal.join('|') !== [
          binding.endArgument,
          binding.rangeArgument,
          binding.startArgument,
        ].sort().join('|')
        || forbiddenTemporal.length
        || !isRecord(rawBranch.properties[binding.startArgument])
        || !isRecord(rawBranch.properties[binding.endArgument])) return false
      customBranches.push({ required, forbidden })
    } else if (!presetValues?.length
      || presetValues.some(value => typeof value !== 'string' || value === binding.customValue)
      || presetValues.some(value => !rangeValues.includes(value as string))
      || new Set(presetValues).size !== presetValues.length
      || Object.prototype.hasOwnProperty.call(rangeProperty, 'const')
      || requiredTemporal.length !== 1 || requiredTemporal[0] !== binding.rangeArgument
      || forbiddenTemporal.join('|') !== [binding.endArgument, binding.startArgument].sort().join('|')) {
      return false
    }
    const signature = JSON.stringify({
      required: [...required].sort(),
      forbidden: [...forbidden].sort(),
      discriminator: customBranch ? binding.customValue : [...presetValues!].sort(),
    })
    if (signatures.has(signature)) return false
    signatures.add(signature)
  }
  const provided = new Set(providedArguments)
  return customBranches.filter(branch => (
    branch.required
      .filter(argument => !temporalArguments.has(argument))
      .every(argument => provided.has(argument))
    && branch.forbidden
      .filter(argument => !temporalArguments.has(argument))
      .every(argument => !provided.has(argument))
  )).length === 1
}

type AiClientToolAnalyticalScopeBindingSource = Pick<
  AiClientToolRoutingSource,
  'inputs' | 'parameterSchema' | 'expands'
> & {
  consumerPorts?: readonly AiClientToolConsumerPort[]
}

/**
 * Proves scope coordinates only from the opaque shared authoring edge, canonical consumer ports, top-level string
 * inputs and the closed input alternatives. Resource names and parameter shapes never create the mapping themselves.
 */
export const validateAiClientToolAnalyticalScopeBinding = (
  source: AiClientToolAnalyticalScopeBindingSource,
  binding: AiClientToolAnalyticalScopeArgumentBinding,
): boolean => {
  if (binding.valueCardinality !== 'exactly-one'
    || binding.encoding !== 'single-string'
    || binding.coordinates.length !== 3
    || !ANALYTICAL_ARGUMENT_PATTERN.test(binding.modeArgument)) return false
  const coordinates = new Map(binding.coordinates.map(coordinate => [coordinate.type, coordinate]))
  const project = coordinates.get('project')
  const area = coordinates.get('area')
  const point = coordinates.get('point')
  if (coordinates.size !== 3
    || !project || project.type !== 'project' || project.arguments.length
    || !area || area.type !== 'area'
    || !point || point.type !== 'point'
    || area.sourcePort === point.sourcePort) return false

  const inputs = source.inputs || []
  const consumerPorts = source.consumerPorts || []
  const scopeCoordinates = [area, point]
  const scopeArguments = new Set<string>()
  if (scopeArguments.has(binding.modeArgument)) return false
  scopeArguments.add(binding.modeArgument)
  const modeInputs = inputs.filter(input => normalizeText(input.id, 160) === binding.modeArgument)
  if (modeInputs.length !== 1 || !inputIsRequired(modeInputs[0]) || hasInputDefault(modeInputs[0])) return false
  const modeValues = exactStringEnumValues(inputValueType(modeInputs[0]) || {})
  if (!modeValues || modeValues.length !== 2 || modeValues[0] !== 'project' || modeValues[1] !== 'explicit') return false
  for (const coordinate of scopeCoordinates) {
    if (coordinate.arguments.length !== 1) return false
    const argument = coordinate.arguments[0]
    if (scopeArguments.has(argument)) return false
    scopeArguments.add(argument)
    const matchingInputs = inputs.filter(input => normalizeText(input.id, 160) === argument)
    const matchingPorts = consumerPorts.filter(port => (
      normalizeText(port.name, 160).toLowerCase() === coordinate.sourcePort
    ))
    if (matchingInputs.length !== 1 || matchingPorts.length !== 1
      || inputIsRequired(matchingInputs[0])
      || inputValueType(matchingInputs[0])?.type !== 'string'
      || matchingPorts[0].required !== false) return false
  }

  const parameterSchema = resolveTemporalParameterSchema(source)
  const branches = parameterSchema?.oneOf
  if (!Array.isArray(branches) || !branches.length) return false
  const coordinateArguments = new Set([area.arguments[0], point.arguments[0]])
  const signatures = new Map<'project' | 'area' | 'point', Set<string>>([
    ['project', new Set()],
    ['area', new Set()],
    ['point', new Set()],
  ])
  for (const rawBranch of branches) {
    if (!isRecord(rawBranch) || !isRecord(rawBranch.properties)) return false
    const required = normalizedRequiredList(rawBranch.required, true)
    const forbidden = branchForbiddenInputs(rawBranch)
    if (!required || !forbidden) return false
    const requiredScope = required.filter(argument => coordinateArguments.has(argument)).sort()
    const forbiddenScope = forbidden.filter(argument => coordinateArguments.has(argument)).sort()
    const modeProperty = rawBranch.properties[binding.modeArgument]
    if (!required.includes(binding.modeArgument) || !isRecord(modeProperty)
      || Object.keys(modeProperty).some(key => key !== 'const' && key !== 'description')
      || typeof modeProperty.const !== 'string') return false
    let type: 'project' | 'area' | 'point' | undefined
    if (!requiredScope.length
      && modeProperty.const === 'project'
      && forbiddenScope.join('|') === [...coordinateArguments].sort().join('|')) type = 'project'
    if (requiredScope.length === 1 && requiredScope[0] === area.arguments[0]
      && modeProperty.const === 'explicit'
      && forbiddenScope.length === 1 && forbiddenScope[0] === point.arguments[0]) type = 'area'
    if (requiredScope.length === 1 && requiredScope[0] === point.arguments[0]
      && modeProperty.const === 'explicit'
      && forbiddenScope.length === 1 && forbiddenScope[0] === area.arguments[0]) type = 'point'
    if (!type) return false
    const declaredScopeProperties = Object.keys(rawBranch.properties)
      .filter(argument => coordinateArguments.has(argument))
      .sort()
    if (declaredScopeProperties.join('|') !== requiredScope.join('|')) return false
    const remainingProperties = Object.fromEntries(
      Object.entries(rawBranch.properties)
        .filter(([argument]) => !scopeArguments.has(argument))
        .sort(([left], [right]) => left.localeCompare(right)),
    )
    const signature = JSON.stringify({
      required: required.filter(argument => !scopeArguments.has(argument)).sort(),
      forbidden: forbidden.filter(argument => !scopeArguments.has(argument)).sort(),
      properties: remainingProperties,
    })
    const coordinateSignatures = signatures.get(type)!
    if (coordinateSignatures.has(signature)) return false
    coordinateSignatures.add(signature)
  }
  const projectSignatures = signatures.get('project')!
  return projectSignatures.size > 0
    && ['area', 'point'].every(type => {
      const candidate = signatures.get(type as 'area' | 'point')!
      return candidate.size === projectSignatures.size
        && [...candidate].every(signature => projectSignatures.has(signature))
    })
}

const normalizeAnalyticalBoundedCompleteness = (
  value: unknown,
): AiClientToolAnalyticalBoundedCompleteness | undefined => {
  if (!isRecord(value)
    || value.criterion !== 'requested-record-window'
    || value.completeRequired !== true) return undefined
  const limitArgument = normalizeText(value.limitArgument, 160)
  if (!limitArgument || !ANALYTICAL_ARGUMENT_PATTERN.test(limitArgument)) return undefined
  return {
    criterion: 'requested-record-window',
    limitArgument,
    completeRequired: true,
  }
}

const normalizeAnalyticalOutput = (
  value: unknown,
): AiClientToolAnalyticalOutputCapability | undefined => {
  if (!isRecord(value)) return undefined
  const hasFieldSet = Object.prototype.hasOwnProperty.call(value, 'fieldSet')
  if (Object.keys(value).length !== (hasFieldSet ? 2 : 1)) return undefined
  const shape = normalizeText(value.shape, 160).toLowerCase()
  if (!shape || !RESOURCE_TYPE_PATTERN.test(shape)) return undefined
  if (!hasFieldSet) return { shape }
  const fieldSet = value.fieldSet
  if (!isRecord(fieldSet) || Object.keys(fieldSet).length !== 3
    || fieldSet.mode !== 'execution-authored'
    || !(['exact', 'execution-authored'] as const).includes(fieldSet.measureCoordinates as never)
    || !Number.isSafeInteger(fieldSet.maxFields)
    || Number(fieldSet.maxFields) < 2
    || Number(fieldSet.maxFields) > 33) return undefined
  return {
    shape,
    fieldSet: {
      mode: 'execution-authored',
      measureCoordinates: fieldSet.measureCoordinates as 'exact' | 'execution-authored',
      maxFields: Number(fieldSet.maxFields),
    },
  }
}

/**
 * Normalizes the sole producer-authored analytical contract. No digest, alias, field-name heuristic or inferred
 * default crosses the session boundary; an incomplete descriptor fails closed as one value.
 */
export const normalizeAiClientToolAnalyticalCapability = (
  value: unknown,
): AiClientToolAnalyticalCapability | undefined => {
  if (!isRecord(value) || value.version !== AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION) return undefined
  if (Object.prototype.hasOwnProperty.call(value, 'filterBindings')) return undefined
  const capabilityId = normalizeText(value.capabilityId, 160).toLowerCase()
  const semanticKey = normalizeText(value.semanticKey, 160).toLowerCase()
  const subjects = normalizeAnalyticalValues(value.subjects)
  const dimensions = normalizeAnalyticalValues(value.dimensions)
  const filters = normalizeAnalyticalValues(value.filters)
  const grains = normalizeAnalyticalValues(value.grains)
  const criteria = normalizeAnalyticalValues(value.criteria)
  if (!Array.isArray(value.measures) || value.measures.length > MAX_ROUTING_ITEMS
    || !Array.isArray(value.ordering) || value.ordering.length > MAX_ROUTING_ITEMS) return undefined
  const measures = value.measures.map(normalizeAnalyticalMeasure)
  const ordering = value.ordering.map(normalizeAnalyticalOrdering)
  const completeness = isRecord(value.completeness) ? value.completeness : undefined
  const rawBoundedBy = completeness?.boundedBy
  const boundedBy = rawBoundedBy === undefined
    ? undefined
    : normalizeAnalyticalBoundedCompleteness(rawBoundedBy)
  const rawArgumentBindings = value.argumentBindings
  const argumentBindings = rawArgumentBindings === undefined
    ? []
    : normalizeAnalyticalArgumentBindings(rawArgumentBindings)
  const rawSemanticIntentBindings = value.semanticIntentBindings
  const semanticIntentBindings = rawSemanticIntentBindings === undefined
    ? []
    : normalizeAnalyticalSemanticIntentBindings(rawSemanticIntentBindings)
  const rawClosedEnumSelector = value.closedEnumSelector
  const closedEnumSelector = rawClosedEnumSelector === undefined
    ? undefined
    : normalizeAnalyticalClosedEnumSelector(rawClosedEnumSelector)
  const output = normalizeAnalyticalOutput(value.output)
  const scopeArgumentBindings = argumentBindings?.filter(binding => binding.semantic === 'scope') || []
  const filterArgumentBindings = argumentBindings?.filter(binding => binding.semantic === 'filter') || []
  const measureArgumentBindings = argumentBindings?.filter(binding => binding.semantic === 'measure') || []
  const intentMeasures = semanticIntentBindings
    ? Array.from(new Set(semanticIntentBindings.flatMap(binding => binding.measures)))
    : []
  const allAnalyticalBindingArguments = argumentBindings
    ? argumentBindings.flatMap(analyticalBindingArguments)
    : []
  const transformCost = value.transformCost
  if (!capabilityId || !CAPABILITY_PATTERN.test(capabilityId)
    || !semanticKey || !ANALYTICAL_TOKEN_PATTERN.test(semanticKey)
    || !subjects?.length || !dimensions || !filters || !grains || !criteria
    || measures.some(item => !item) || ordering.some(item => !item)
    || !completeness
    || typeof completeness.complete !== 'boolean'
    || typeof completeness.partial !== 'boolean'
    || typeof completeness.continuation !== 'boolean'
    || (rawBoundedBy !== undefined && !boundedBy)
    || !argumentBindings
    || filterArgumentBindings.some(binding => !filters.includes(binding.axis))
    || (measureArgumentBindings.length > 0 && !intentMeasures.length)
    || !semanticIntentBindings
    || (rawClosedEnumSelector !== undefined && !closedEnumSelector)
    || semanticIntentBindings.some(binding => (
      !criteria.includes(binding.criterion)
      || binding.measures.some(name => !measures.some(measure => measure?.name === name))
      || binding.dimensions.some(name => !dimensions.includes(name))
      || (binding.scopeSelection && (binding.scopeSelection.outputBinding
        ? scopeArgumentBindings.length !== 0 : scopeArgumentBindings.length !== 1))
    ))
    || closedEnumSelector && (
      !boundedBy
      || boundedBy.limitArgument !== closedEnumSelector.limitArgument
      || completeness.complete !== true
      || completeness.partial !== true
      || completeness.continuation !== false
      || closedEnumSelector.cases.some(item => (
        !criteria.includes(item.criterion)
        || item.measures.some(name => !measures.some(measure => measure?.name === name))
        || item.dimensions.some(name => !dimensions.includes(name))
        || !ordering.some(candidate => candidate
          && candidate.axis === item.ordering.axis
          && candidate.direction === item.ordering.direction
          && candidate.producerGuaranteed)
      ))
    )
    || (boundedBy && argumentBindings.some(binding => (
      analyticalBindingArguments(binding).includes(boundedBy.limitArgument)
    )))
    || closedEnumSelector && (
      argumentBindings.some(binding => (
        analyticalBindingArguments(binding).includes(closedEnumSelector.argument)
      ))
      || closedEnumSelector.argument === boundedBy?.limitArgument
    )
    || new Set(allAnalyticalBindingArguments).size !== allAnalyticalBindingArguments.length
    || !output
    || !Number.isInteger(transformCost) || Number(transformCost) < 0) return undefined
  return {
    version: AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION,
    capabilityId,
    semanticKey,
    subjects,
    measures: measures as AiClientToolAnalyticalMeasureCapability[],
    dimensions,
    filters,
    grains,
    criteria,
    ordering: ordering as AiClientToolAnalyticalOrderingCapability[],
    completeness: {
      complete: completeness.complete,
      partial: completeness.partial,
      continuation: completeness.continuation,
      ...(boundedBy ? { boundedBy } : {}),
    },
    ...(semanticIntentBindings.length ? { semanticIntentBindings } : {}),
    ...(closedEnumSelector ? { closedEnumSelector } : {}),
    ...(argumentBindings.length ? { argumentBindings } : {}),
    output,
    transformCost: Number(transformCost),
  }
}

const normalizeRoutingRecord = (value: unknown): AiClientToolRoutingMetadata | undefined => {
  if (!isRecord(value)) return undefined
  const portVersion = value.portVersion === AI_CLIENT_TOOL_PORT_VERSION
    ? AI_CLIENT_TOOL_PORT_VERSION
    : undefined
  const consumerPorts = normalizePorts(value.consumerPorts, normalizeConsumerPort)
  const producerPorts = normalizePorts(value.producerPorts, normalizeProducerPort)
  const aliases = normalizeNaturalLanguageList(value.aliases, MAX_ALIASES, MAX_ALIAS_LENGTH)
  const capabilities = normalizeList(value.capabilities)
  const accepts = normalizeList(value.accepts)
  const produces = normalizeList(value.produces)
  const intents = normalizeNaturalLanguageList(value.intents)
  const notFor = normalizeNaturalLanguageList(value.notFor)
  const stages = normalizeList(value.stages)
    .filter(item => AI_CLIENT_TOOL_ROUTING_STAGES.includes(item as AiClientToolRoutingStage)) as AiClientToolRoutingStage[]
  const dataAccessModes = normalizeList(value.dataAccessModes)
    .filter(item => AI_CLIENT_TOOL_DATA_ACCESS_MODES.includes(item as AiClientToolRoutingDataAccessMode)) as AiClientToolRoutingDataAccessMode[]
  const resultDeliveries = normalizeList(value.resultDeliveries)
    .filter(item => AI_CLIENT_TOOL_RESULT_DELIVERIES.includes(item as AiClientToolRoutingResultDelivery)) as AiClientToolRoutingResultDelivery[]
  const outputShapes = normalizeList(value.outputShapes)
  const cost = normalizeEnum(value.cost, ['low', 'medium', 'high'] as const)
  const prerequisites = normalizeList(value.prerequisites)
  const evidencePolicy = normalizeEnum(value.evidencePolicy, ['auto', 'required', 'optional', 'none'] as const)
  const exposure = normalizeEnum(value.exposure, ['auto', 'eager', 'deferred'] as const)
  const help = normalizeHelp(value.help)
  const validationHints = normalizeList(value.validationHints)
  const rawTemporalArgumentBinding = value.temporalArgumentBinding
  const temporalArgumentBinding = rawTemporalArgumentBinding === undefined
    ? undefined
    : normalizeAnalyticalTemporalArgumentBinding(rawTemporalArgumentBinding)
  const analyticalCapability = normalizeAiClientToolAnalyticalCapability(value.analyticalCapability)
  if (rawTemporalArgumentBinding !== undefined && !temporalArgumentBinding) return undefined
  if (analyticalCapability?.semanticIntentBindings?.some(binding => !intents.includes(binding.intent))) {
    return undefined
  }
  const result: AiClientToolRoutingMetadata = {
    ...(portVersion ? { portVersion } : {}),
    ...(consumerPorts.length ? { consumerPorts } : {}),
    ...(producerPorts.length ? { producerPorts } : {}),
    ...(aliases.length ? { aliases } : {}),
    ...(capabilities.length ? { capabilities } : {}),
    ...(accepts.length ? { accepts } : {}),
    ...(produces.length ? { produces } : {}),
    ...(intents.length ? { intents } : {}),
    ...(notFor.length ? { notFor } : {}),
    ...(stages.length ? { stages } : {}),
    ...(dataAccessModes.length ? { dataAccessModes } : {}),
    ...(resultDeliveries.length ? { resultDeliveries } : {}),
    ...(outputShapes.length ? { outputShapes } : {}),
    ...(cost ? { cost } : {}),
    ...(prerequisites.length ? { prerequisites } : {}),
    ...(evidencePolicy ? { evidencePolicy } : {}),
    ...(exposure ? { exposure } : {}),
    ...(help ? { help } : {}),
    ...(validationHints.length ? { validationHints } : {}),
    ...(temporalArgumentBinding ? { temporalArgumentBinding } : {}),
    ...(analyticalCapability ? { analyticalCapability } : {}),
  }
  return Object.keys(result).length ? result : undefined
}

const canonicalRoutingValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalRoutingValue)
    return normalized.every(item => typeof item === 'string')
      ? [...normalized].sort()
      : normalized
  }
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalRoutingValue(item)]))
}

const canonicalRouting = (metadata: AiClientToolRoutingMetadata | undefined) => (
  metadata ? JSON.stringify(canonicalRoutingValue(metadata)) : ''
)

const addIssue = (
  issues: AiClientToolRoutingIssue[],
  code: string,
  field: string,
  message: string,
) => issues.push({ code, field, message })

const invalidEnumValues = (source: unknown, field: string, allowed: readonly string[]) => {
  if (!isRecord(source) || source[field] == null) return []
  const values = Array.isArray(source[field]) ? source[field] : [source[field]]
  return values
    .map(value => normalizeText(value).toLowerCase())
    .filter(value => !!value && !allowed.includes(value))
}

const validateIdentifiers = (
  issues: AiClientToolRoutingIssue[],
  field: string,
  values: string[] | undefined,
  pattern: RegExp,
) => {
  for (const value of values || []) {
    if (!pattern.test(value)) {
      addIssue(issues, 'invalid_identifier', field, `${field} contains invalid identifier: ${value}`)
    }
  }
}

/** Validates one browser tool against the backend x-ai-routing/v1 contract. */
export const validateAiClientToolRoutingMetadata = (
  tool: AiClientToolRoutingSource,
): AiClientToolRoutingValidation => {
  const rawValue = isRecord(tool.expands) ? tool.expands[AI_CLIENT_TOOL_ROUTING_EXPAND_KEY] : undefined
  const hasDeclared = tool.routing != null
  const hasRaw = rawValue != null
  if (!hasDeclared && !hasRaw) return { status: 'missing', issues: [] }

  const declared = normalizeRoutingRecord(tool.routing)
  const raw = normalizeRoutingRecord(rawValue)
  const issues: AiClientToolRoutingIssue[] = []
  if (hasDeclared && !declared) addIssue(issues, 'empty_routing', 'routing', 'routing is empty')
  if (hasRaw && !raw) addIssue(issues, 'empty_routing', 'expands.x-ai-routing', 'x-ai-routing is empty')
  if (declared && raw && canonicalRouting(declared) !== canonicalRouting(raw)) {
    addIssue(issues, 'conflicting_sources', 'routing', 'routing and expands.x-ai-routing must be identical')
  }
  if (isRecord(tool.routing)
    && Object.prototype.hasOwnProperty.call(tool.routing, 'analyticalCapability')
    && !declared?.analyticalCapability) {
    addIssue(issues, 'analytical_capability_malformed', 'routing.analyticalCapability',
      'analyticalCapability must be a complete analytical-capability/v1 descriptor')
  }
  if (isRecord(rawValue)
    && Object.prototype.hasOwnProperty.call(rawValue, 'analyticalCapability')
    && !raw?.analyticalCapability) {
    addIssue(issues, 'analytical_capability_malformed',
      'expands.x-ai-routing.analyticalCapability',
      'analyticalCapability must be a complete analytical-capability/v1 descriptor')
  }

  const source = declared || raw
  if (!source) return { status: 'malformed', issues }
  const declaredSource = hasDeclared && isRecord(tool.routing) ? tool.routing : rawValue
  if (isRecord(declaredSource) && declaredSource.portVersion !== undefined
    && declaredSource.portVersion !== AI_CLIENT_TOOL_PORT_VERSION) {
    addIssue(issues, 'invalid_port_version', 'portVersion', 'unsupported canonical tool port version')
  }
  if (isRecord(declaredSource) && Array.isArray(declaredSource.consumerPorts)
    && source.consumerPorts?.length !== declaredSource.consumerPorts.length) {
    addIssue(issues, 'invalid_consumer_port', 'consumerPorts', 'consumer ports must declare a complete canonical descriptor')
  }
  if (isRecord(declaredSource) && Array.isArray(declaredSource.producerPorts)
    && source.producerPorts?.length !== declaredSource.producerPorts.length) {
    addIssue(issues, 'invalid_producer_port', 'producerPorts', 'producer ports must declare a complete canonical descriptor')
  }
  const argumentOwners = new Map<string, string>()
  const registerArgumentTarget = (field: string, argument: string) => {
    const owner = argumentOwners.get(argument)
    if (owner) {
      addIssue(
        issues,
        'argument_binding_collision',
        field,
        `${field} conflicts with the semantic target already owned by ${owner}`,
      )
      return
    }
    argumentOwners.set(argument, field)
  }
  const validateAnalyticalArgument = (field: string, argument: string) => {
    registerArgumentTarget(field, argument)
    const matches = (tool.inputs || []).filter(input => isRecord(input) && input.id === argument)
    if (matches.length === 1) return
    addIssue(
      issues,
      matches.length ? 'analytical_argument_ambiguous' : 'analytical_argument_missing',
      field,
      `${field} must reference exactly one top-level tool input`,
    )
  }
  const validateConsumerArgument = (field: string, argument: string) => {
    validateAnalyticalArgument(field, argument)
    const matches = (tool.inputs || []).filter(input => isRecord(input) && input.id === argument)
    if (matches.length !== 1) return
    if (normalizeText(inputValueType(matches[0])?.type).toLowerCase() !== 'string') {
      addIssue(
        issues,
        'consumer_argument_schema_incompatible',
        field,
        `${field} must reference one top-level string input`,
      )
    }
  }
  const outputScopes = source.analyticalCapability?.semanticIntentBindings
    ?.flatMap(binding => binding.scopeSelection?.outputBinding ? [binding.scopeSelection] : []) || []
  for (const outputScope of outputScopes.filter((scope, index, values) => (
    values.findIndex(candidate => candidate.outputBinding === scope.outputBinding) === index
  ))) {
    const field = 'analyticalCapability.semanticIntentBindings.scopeSelection'
    validateAnalyticalArgument(field, outputScope.binding)
    const input = (tool.inputs || []).find(input => input.id === outputScope.binding)
    const ports = (source.producerPorts || []).filter(port => port.name === outputScope.outputBinding)
    if (!input || !input.required || inputValueType(input)?.type !== 'object'
      || ports.length !== 1 || ports[0].type !== 'structured-data' || ports[0].mediaType !== 'application/json') {
      addIssue(issues, 'analytical_capability_malformed', field,
        'output scope must reference one declared JSON structured output and a required object selector')
    }
  }
  const consumerArguments = (source.consumerPorts || []).flatMap(port => (
    port.argumentBinding ? [port.argumentBinding.argument] : []
  ))
  for (const [index, port] of (source.consumerPorts || []).entries()) {
    if (port.argumentBinding) {
      validateConsumerArgument(
        `consumerPorts[${index}].argumentBinding.argument`,
        port.argumentBinding.argument,
      )
    }
  }
  const analyticalCapability = source.analyticalCapability
  const scopeProtocolArguments = (analyticalCapability?.argumentBindings || [])
    .filter((binding): binding is AiClientToolAnalyticalScopeArgumentBinding => binding.semantic === 'scope')
    .map(binding => binding.modeArgument)
  const rootTemporalBinding = source.temporalArgumentBinding
  if (rootTemporalBinding && analyticalCapability) {
    addIssue(
      issues,
      'temporal_binding_location_conflict',
      'temporalArgumentBinding',
      'analytical producers must keep temporal binding only inside analyticalCapability.argumentBindings',
    )
  }
  const boundedBy = analyticalCapability?.completeness.boundedBy
  if (boundedBy) {
    validateAnalyticalArgument(
      'analyticalCapability.completeness.boundedBy.limitArgument',
      boundedBy.limitArgument,
    )
  }
  const closedEnumSelector = analyticalCapability?.closedEnumSelector
  if (closedEnumSelector) {
    validateAnalyticalArgument(
      'analyticalCapability.closedEnumSelector.argument',
      closedEnumSelector.argument,
    )
    if (!validateAiClientToolAnalyticalClosedEnumSelector(tool, closedEnumSelector)) {
      addIssue(
        issues,
        'analytical_closed_enum_selector_malformed',
        'analyticalCapability.closedEnumSelector',
        'closed enum selector must reference exact declaration-local enum cases and a bounded integer input',
      )
    }
  }
  for (const [index, binding] of (analyticalCapability?.argumentBindings || []).entries()) {
    if (binding.semantic === 'dimension') {
      validateAnalyticalArgument(
        `analyticalCapability.argumentBindings[${index}].argument`,
        binding.argument,
      )
      continue
    }
    if (binding.semantic === 'measure') {
      const prefix = `analyticalCapability.argumentBindings[${index}]`
      validateAnalyticalArgument(`${prefix}.argument`, binding.argument)
      const intentMeasures = Array.from(new Set(
        (analyticalCapability.semanticIntentBindings || []).flatMap(item => item.measures),
      ))
      if (!validateAiClientToolAnalyticalMeasureBinding(tool, binding, intentMeasures)) {
        addIssue(
          issues,
          'analytical_measure_binding_malformed',
          prefix,
          'measure binding must reference one exact string enum over the intent-admitted measures',
        )
      }
      continue
    }
    if (binding.semantic === 'scope') {
      validateAnalyticalArgument(
        `analyticalCapability.argumentBindings[${index}].modeArgument`,
        binding.modeArgument,
      )
      binding.coordinates.forEach((coordinate, coordinateIndex) => {
        coordinate.arguments.forEach((argument, argumentIndex) => validateAnalyticalArgument(
          `analyticalCapability.argumentBindings[${index}].coordinates[${coordinateIndex}].arguments[${argumentIndex}]`,
          argument,
        ))
      })
      if (!validateAiClientToolAnalyticalScopeBinding({
        inputs: tool.inputs,
        parameterSchema: tool.parameterSchema,
        expands: tool.expands,
        consumerPorts: source.consumerPorts,
      }, binding)) {
        addIssue(
          issues,
          'analytical_scope_binding_malformed',
          `analyticalCapability.argumentBindings[${index}]`,
          'scope binding must reference canonical consumer ports and one closed singleton-string scope contract',
        )
      }
      continue
    }
    if (binding.semantic === 'filter') {
      const prefix = `analyticalCapability.argumentBindings[${index}]`
      validateAnalyticalArgument(`${prefix}.valueArgument`, binding.valueArgument)
      if ('operatorArgument' in binding) {
        validateAnalyticalArgument(`${prefix}.operatorArgument`, binding.operatorArgument)
      }
      if (!validateAiClientToolAnalyticalFilterBinding({
        inputs: tool.inputs,
        parameterSchema: tool.parameterSchema,
        expands: tool.expands,
      }, binding)) {
        addIssue(
          issues,
          'analytical_filter_binding_malformed',
          prefix,
          'filter binding must prove exact root, input, cardinality, encoding and operator schemas',
        )
      }
      continue
    }
    for (const field of ['rangeArgument', 'startArgument', 'endArgument'] as const) {
      validateAnalyticalArgument(
        `analyticalCapability.argumentBindings[${index}].${field}`,
        binding[field],
      )
    }
    if (!validateAiClientToolAnalyticalTemporalBinding(
      tool,
      binding,
      [...consumerArguments, ...scopeProtocolArguments],
    )) {
      addIssue(
        issues,
        'analytical_temporal_binding_malformed',
        `analyticalCapability.argumentBindings[${index}]`,
        'temporal binding must reference one closed custom date-time range contract',
      )
    }
  }
  if (rootTemporalBinding) {
    for (const field of ['rangeArgument', 'startArgument', 'endArgument'] as const) {
      validateAnalyticalArgument(
        `temporalArgumentBinding.${field}`,
        rootTemporalBinding[field],
      )
    }
    if (!validateAiClientToolAnalyticalTemporalBinding(
      tool,
      rootTemporalBinding,
      [...consumerArguments, ...scopeProtocolArguments],
    )) {
      addIssue(
        issues,
        'temporal_binding_malformed',
        'temporalArgumentBinding',
        'temporal binding must reference one closed custom date-time range contract',
      )
    }
  }
  if (!source.capabilities?.length) addIssue(issues, 'required', 'capabilities', 'at least one capability is required')
  if (!source.stages?.length) addIssue(issues, 'required', 'stages', 'at least one workflow stage is required')
  if (source.dataAccessModes?.length && !source.resultDeliveries?.length) {
    addIssue(issues, 'required', 'resultDeliveries', 'data tools must declare result delivery')
  }
  if ((source.dataAccessModes?.length || source.produces?.length) && !source.evidencePolicy) {
    addIssue(issues, 'required', 'evidencePolicy', 'data and output tools must declare evidence policy')
  }
  if (source.produces?.length && !source.outputShapes?.length) {
    addIssue(issues, 'required', 'outputShapes', 'tools with downstream outputs must declare output shapes')
  }
  if (source.evidencePolicy === 'required' && !source.validationHints?.length) {
    addIssue(issues, 'required', 'validationHints', 'required evidence must declare a validation hint')
  }

  invalidEnumValues(tool.routing, 'stages', AI_CLIENT_TOOL_ROUTING_STAGES)
    .forEach(value => addIssue(issues, 'unknown_enum', 'stages', `unsupported stage: ${value}`))
  invalidEnumValues(tool.routing, 'dataAccessModes', AI_CLIENT_TOOL_DATA_ACCESS_MODES)
    .forEach(value => addIssue(issues, 'unknown_enum', 'dataAccessModes', `unsupported data access mode: ${value}`))
  invalidEnumValues(tool.routing, 'resultDeliveries', AI_CLIENT_TOOL_RESULT_DELIVERIES)
    .forEach(value => addIssue(issues, 'unknown_enum', 'resultDeliveries', `unsupported result delivery: ${value}`))
  invalidEnumValues(rawValue, 'stages', AI_CLIENT_TOOL_ROUTING_STAGES)
    .forEach(value => addIssue(issues, 'unknown_enum', 'stages', `unsupported stage: ${value}`))
  invalidEnumValues(rawValue, 'dataAccessModes', AI_CLIENT_TOOL_DATA_ACCESS_MODES)
    .forEach(value => addIssue(issues, 'unknown_enum', 'dataAccessModes', `unsupported data access mode: ${value}`))
  invalidEnumValues(rawValue, 'resultDeliveries', AI_CLIENT_TOOL_RESULT_DELIVERIES)
    .forEach(value => addIssue(issues, 'unknown_enum', 'resultDeliveries', `unsupported result delivery: ${value}`))

  validateIdentifiers(issues, 'capabilities', source.capabilities, CAPABILITY_PATTERN)
  validateIdentifiers(issues, 'accepts', source.accepts, RESOURCE_TYPE_PATTERN)
  validateIdentifiers(issues, 'produces', source.produces, RESOURCE_TYPE_PATTERN)
  validateIdentifiers(issues, 'prerequisites', source.prerequisites, RESOURCE_TYPE_PATTERN)
  validateIdentifiers(issues, 'outputShapes', source.outputShapes, RESOURCE_TYPE_PATTERN)

  const positive = new Set([
    ...(source.aliases || []),
    ...(source.capabilities || []),
    ...(source.intents || []),
  ].map(value => value.trim().toLowerCase()))
  for (const value of source.notFor || []) {
    if (positive.has(value.trim().toLowerCase())) {
      addIssue(issues, 'conflicting_signals', 'notFor', `notFor conflicts with a positive signal: ${value}`)
    }
  }
  return issues.length
    ? { status: 'malformed', metadata: source, issues }
    : { status: 'valid', metadata: source, issues: [] }
}

/**
 * Validates browser-only inline binding paths against the model-facing produces contract.
 * File streams publish their binding after materialization and therefore do not need an inline path.
 */
export const validateAiClientToolResultBindings = (
  tool: AiClientToolRoutingSource,
): AiClientToolRoutingIssue[] => {
  const validation = validateAiClientToolRoutingMetadata(tool)
  const routing = validation.metadata
  const produces = routing?.produces || []
  const outputShapes = routing?.outputShapes || []
  const meta = isRecord(tool._meta) ? tool._meta : {}
  const rawBindings = meta.resultBindings
  const bindings = Array.isArray(rawBindings) ? rawBindings : []
  const issues: AiClientToolRoutingIssue[] = []
  const typedOutputs = isRecord(meta.clientToolContract)
    && Array.isArray(meta.clientToolContract.outputs)
    ? meta.clientToolContract.outputs.filter(isRecord)
    : []
  const typedOutputByName = new Map(typedOutputs.flatMap((output) => {
    const name = normalizeText(output.name, 160).toLowerCase()
    return name ? [[name, output] as const] : []
  }))
  const hasTypedOutputs = typedOutputByName.size > 0
  const materializedNames = new Set(typedOutputs.flatMap((output) => {
    const name = normalizeText(output.name, 160).toLowerCase()
    const delivery = normalizeText(output.delivery).toLowerCase()
    const kind = normalizeText(output.kind).toLowerCase()
    return name && (delivery === 'file' || (kind === 'artifact' && !delivery)) ? [name] : []
  }))
  const inlineProduces = produces.filter(name => !materializedNames.has(name))

  if (hasTypedOutputs) {
    const inlineTypedOutputs = typedOutputs.filter((output) => {
      const delivery = normalizeText(output.delivery).toLowerCase()
      const kind = normalizeText(output.kind).toLowerCase()
      return !!normalizeText(output.path, 512)
        && delivery !== 'file'
        && !(kind === 'artifact' && !delivery)
    })
    const inlineTypedNames = new Set(inlineTypedOutputs.map(output => (
      normalizeText(output.name, 160).toLowerCase()
    )))
    if (rawBindings !== undefined && !Array.isArray(rawBindings)) {
      addIssue(issues, 'result_binding_malformed', '_meta.resultBindings', 'inline result bindings must be an array')
      return issues
    }
    if (!bindings.length && inlineTypedNames.size) {
      addIssue(issues, 'result_binding_missing', '_meta.resultBindings', 'inline produced outputs must declare their actual JSON paths')
      return issues
    }
    const declaredNames = new Set<string>()
    bindings.forEach((value, index) => {
      if (!isRecord(value)) {
        addIssue(issues, 'result_binding_malformed', `_meta.resultBindings.${index}`, 'result binding must be an object')
        return
      }
      const name = normalizeText(value.name, 160).toLowerCase()
      const path = normalizeText(value.path, 512)
      const shape = normalizeText(value.shape, 160).toLowerCase()
      if (!name || declaredNames.has(name)) {
        addIssue(issues, 'result_binding_name_invalid', `_meta.resultBindings.${index}.name`, 'result binding name must be present and unique')
      } else {
        declaredNames.add(name)
      }
      if (!isSupportedAiClientToolBindingPath(path)) {
        addIssue(issues, 'result_binding_path_invalid', `_meta.resultBindings.${index}.path`, 'inline result binding path uses an unsupported JSONPath expression')
      }
      const output = typedOutputByName.get(name)
      if (!output || !inlineTypedNames.has(name)) {
        addIssue(issues, 'result_binding_unexpected', '_meta.resultBindings', `result binding is not declared by typed contract: ${name || 'missing'}`)
        return
      }
      const expectedShape = normalizeText(output.shape, 160).toLowerCase()
      if (!shape || shape !== expectedShape) {
        addIssue(issues, 'result_binding_shape_invalid', `_meta.resultBindings.${index}.shape`, `result binding shape must match typed output shape: ${expectedShape || 'missing'}`)
      }
      ;(['type', 'mediaType', 'audience'] as const).forEach((field) => {
        const actual = normalizeText(value[field], 160).toLowerCase()
        const expected = normalizeText(output[field], 160).toLowerCase()
        if (actual && actual !== expected) {
          addIssue(issues, 'result_binding_shape_invalid', `_meta.resultBindings.${index}.${field}`, `result binding ${field} must match typed output ${field}: ${expected || 'missing'}`)
        }
      })
    })
    inlineTypedNames.forEach((name) => {
      if (!declaredNames.has(name)) {
        addIssue(issues, 'result_binding_missing', '_meta.resultBindings', `missing inline result binding: ${name}`)
      }
    })
    return issues
  }

  if (!produces.length) {
    if (bindings.length) {
      addIssue(issues, 'result_binding_unexpected', '_meta.resultBindings', 'tool has result bindings but declares no produced outputs')
    }
    return issues
  }

  const fileOnly = routing?.resultDeliveries?.length === 1
    && routing.resultDeliveries[0] === 'file'
  if (fileOnly) {
    if (produces.length !== 1 || outputShapes.length !== 1) {
      addIssue(issues, 'file_binding_ambiguous', 'routing.produces', 'file-stream tools must declare exactly one produced output and one output shape')
    }
    return issues
  }

  if (rawBindings !== undefined && !Array.isArray(rawBindings)) {
    addIssue(issues, 'result_binding_malformed', '_meta.resultBindings', 'inline result bindings must be an array')
    return issues
  }
  if (!bindings.length && inlineProduces.length) {
    addIssue(issues, 'result_binding_missing', '_meta.resultBindings', 'inline produced outputs must declare their actual JSON paths')
    return issues
  }

  const declaredNames = new Set<string>()
  const producerPorts = new Map((routing?.producerPorts || []).map(port => [
    normalizeText(port.name, 160).toLowerCase(),
    port,
  ]))
  bindings.forEach((value, index) => {
    if (!isRecord(value)) {
      addIssue(issues, 'result_binding_malformed', `_meta.resultBindings.${index}`, 'result binding must be an object')
      return
    }
    const name = normalizeText(value.name, 160).toLowerCase()
    const path = normalizeText(value.path, 512)
    const shape = normalizeText(value.shape, 160).toLowerCase()
    if (!name || declaredNames.has(name)) {
      addIssue(issues, 'result_binding_name_invalid', `_meta.resultBindings.${index}.name`, 'result binding name must be present and unique')
    } else {
      declaredNames.add(name)
    }
    if (!isSupportedAiClientToolBindingPath(path)) {
      addIssue(issues, 'result_binding_path_invalid', `_meta.resultBindings.${index}.path`, 'inline result binding path uses an unsupported JSONPath expression')
    }
    const producerPort = producerPorts.get(name)
    const producedIndex = produces.indexOf(name)
    const expectedShape = producerPort?.shape || (outputShapes.length === 1
      ? outputShapes[0]
      : outputShapes[producedIndex])
    if (!shape || (expectedShape && shape !== expectedShape)) {
      addIssue(issues, 'result_binding_shape_invalid', `_meta.resultBindings.${index}.shape`, `result binding shape must match routing output shape: ${expectedShape || 'missing'}`)
    }
    if (producerPort) {
      ;(['type', 'mediaType', 'audience'] as const).forEach((field) => {
        const actual = normalizeText(value[field], 160).toLowerCase()
        const expected = normalizeText(producerPort[field], 160).toLowerCase()
        if (actual && actual !== expected) {
          addIssue(issues, 'result_binding_shape_invalid', `_meta.resultBindings.${index}.${field}`, `result binding ${field} must match routing producer port ${field}: ${expected || 'missing'}`)
        }
      })
    }
  })

  inlineProduces.forEach((name) => {
    if (!declaredNames.has(name)) {
      addIssue(issues, 'result_binding_missing', '_meta.resultBindings', `missing inline result binding: ${name}`)
    }
  })
  declaredNames.forEach((name) => {
    if (!inlineProduces.includes(name)) {
      addIssue(issues, 'result_binding_unexpected', '_meta.resultBindings', `result binding is not declared by routing.produces: ${name}`)
    }
  })
  return issues
}

/**
 * Validates a complete client-tool catalog, including stable identity and prerequisite closure.
 * Callers decide whether a missing routing contract is allowed; HYBRID-ready catalogs should reject it.
 */
export const validateAiClientToolRoutingCatalog = (
  tools: readonly AiClientToolRoutingSource[] = [],
  options: AiClientToolRoutingCatalogValidationOptions = {},
) => {
  const issues: AiClientToolRoutingCatalogIssue[] = []
  const ids = new Set<string>()
  const availableBindings = new Set(normalizeList(options.availableBindings))
  const producers = new Map<string, Array<{
    toolId: string
    capabilities: string[]
  }>>()
  const validations = tools.map((tool) => {
    const toolId = normalizeText(tool.id || tool.name, 128)
    return { tool, toolId, validation: validateAiClientToolRoutingMetadata(tool) }
  })
  validations.forEach(({ toolId, validation }) => {
    validation.metadata?.produces?.forEach((binding) => {
      const candidates = producers.get(binding) || []
      candidates.push({ toolId, capabilities: validation.metadata?.capabilities || [] })
      producers.set(binding, candidates)
    })
  })

  validations.forEach(({ tool, toolId, validation }) => {
    if (!TOOL_ID_PATTERN.test(toolId)) {
      issues.push({ toolId, code: 'invalid_tool_id', field: 'id', message: `invalid stable tool id: ${toolId}` })
    } else if (ids.has(toolId)) {
      issues.push({ toolId, code: 'duplicate_tool_id', field: 'id', message: `duplicate tool id: ${toolId}` })
    }
    ids.add(toolId)
    if (options.requireRouting && validation.status === 'missing') {
      issues.push({ toolId, code: 'routing_missing', field: 'routing', message: 'routing is required for this catalog' })
    }
    validation.issues.forEach(issue => issues.push({ toolId, ...issue }))
    if (options.requireResultBindings) {
      validateAiClientToolResultBindings(tool).forEach(issue => issues.push({ toolId, ...issue }))
    }
    validation.metadata?.prerequisites?.forEach((binding) => {
      if (!availableBindings.has(binding) && !producers.has(binding)) {
        issues.push({
          toolId,
          code: 'prerequisite_unsatisfied',
          field: 'prerequisites',
          message: `no tool produces prerequisite binding: ${binding}`,
        })
      }
    })
  })
  const consumedBindings = new Set(validations.flatMap(({ validation }) => (
    validation.metadata?.prerequisites || []
  )))

  producers.forEach((candidates, binding) => {
    if (!consumedBindings.has(binding) || candidates.length < 2 || availableBindings.has(binding)) return
    const capabilityOwners = new Map<string, string[]>()
    candidates.forEach((candidate) => candidate.capabilities.forEach((capability) => {
      capabilityOwners.set(capability, [...(capabilityOwners.get(capability) || []), candidate.toolId])
    }))
    Array.from(capabilityOwners.entries())
      .filter(([, toolIds]) => new Set(toolIds).size > 1)
      .forEach(([capability, toolIds]) => {
        const uniqueToolIds = Array.from(new Set(toolIds))
        uniqueToolIds.forEach((toolId) => issues.push({
          toolId,
          code: 'ambiguous_producer',
          field: 'produces',
          message: `binding ${binding} has multiple producers for capability ${capability}: ${uniqueToolIds.join(', ')}`,
        }))
      })
  })

  // Resolve the catalog as a data-flow graph. A closed graph that cannot make progress contains a cycle.
  const resolvedBindings = new Set(availableBindings)
  const dependencyDepth = new Map<string, number>()
  let changed = true
  while (changed) {
    changed = false
    validations.forEach(({ toolId, validation }) => {
      if (dependencyDepth.has(toolId) || validation.status !== 'valid' || !validation.metadata) return
      const prerequisites = validation.metadata.prerequisites || []
      if (!prerequisites.every(binding => resolvedBindings.has(binding))) return
      const depth = prerequisites.reduce((maxDepth, binding) => {
        const producerDepth = (producers.get(binding) || [])
          .map(producer => dependencyDepth.get(producer.toolId))
          .filter((value): value is number => value != null)
        return producerDepth.length ? Math.max(maxDepth, Math.min(...producerDepth) + 1) : maxDepth
      }, 0)
      dependencyDepth.set(toolId, depth)
      validation.metadata.produces?.forEach(binding => resolvedBindings.add(binding))
      changed = true
    })
  }

  const maxDependencyDepth = Math.max(
    0,
    options.maxDependencyDepth ?? AI_CLIENT_TOOL_DEFAULT_MAX_DEPENDENCY_DEPTH,
  )
  validations.forEach(({ toolId, validation }) => {
    if (validation.status !== 'valid' || !validation.metadata?.prerequisites?.length) return
    const depth = dependencyDepth.get(toolId)
    if (depth == null) {
      const unresolved = validation.metadata.prerequisites.filter(binding => !resolvedBindings.has(binding))
      if (unresolved.length && unresolved.every(binding => producers.has(binding))) {
        issues.push({
          toolId,
          code: 'dependency_cycle',
          field: 'prerequisites',
          message: `cyclic prerequisite bindings prevent catalog resolution: ${unresolved.join(', ')}`,
        })
      }
    } else if (depth > maxDependencyDepth) {
      issues.push({
        toolId,
        code: 'dependency_depth_exceeded',
        field: 'prerequisites',
        message: `dependency depth ${depth} exceeds catalog limit ${maxDependencyDepth}`,
      })
    }
  })

  const eagerTools = validations.filter(item => item.validation.metadata?.exposure === 'eager')
  const maxEagerTools = Math.max(
    0,
    options.maxEagerTools ?? AI_CLIENT_TOOL_DEFAULT_MAX_EAGER_TOOLS,
  )
  const maxEagerSchemaChars = Math.max(
    0,
    options.maxEagerSchemaChars ?? AI_CLIENT_TOOL_DEFAULT_MAX_EAGER_SCHEMA_CHARS,
  )
  const eagerSchemaChars = eagerTools.reduce((total, { tool, validation }) => total + JSON.stringify({
    id: tool.id || tool.name,
    description: tool.description,
    inputs: tool.inputs,
    routing: validation.metadata,
  }).length, 0)
  if (eagerTools.length > maxEagerTools || eagerSchemaChars > maxEagerSchemaChars) {
    eagerTools.forEach(({ toolId }) => issues.push({
      toolId,
      code: 'eager_budget_exceeded',
      field: 'exposure',
      message: `EAGER catalog uses ${eagerTools.length} tools/${eagerSchemaChars} chars; limit is ${maxEagerTools}/${maxEagerSchemaChars}`,
    }))
  }
  eagerTools.forEach(({ toolId, validation }) => {
    if (validation.metadata?.cost && validation.metadata.cost !== 'low') {
      issues.push({
        toolId,
        code: 'eager_cost_invalid',
        field: 'cost',
        message: 'EAGER tools must explicitly declare low cost',
      })
    }
  })
  return issues
}

/** Returns metadata only when the complete contract is valid; partial hints remain explicitly missing. */
export const normalizeAiClientToolRoutingMetadata = (tool: AiClientToolRoutingSource) => {
  const validation = validateAiClientToolRoutingMetadata(tool)
  return validation.status === 'valid' ? validation.metadata : undefined
}

/** Projects model-facing arguments into the business handler contract without parameter-name inference. */
export const toAiClientToolBusinessArguments = (
  tool: AiClientToolRoutingSource,
  args: Record<string, any>,
) => {
  const measureArguments = new Set(
    (normalizeAiClientToolRoutingMetadata(tool)?.analyticalCapability?.argumentBindings || [])
      .filter(binding => binding.semantic === 'measure')
      .map(binding => binding.argument),
  )
  if (!measureArguments.size) return args
  return Object.fromEntries(
    Object.entries(args).filter(([argument]) => !measureArguments.has(argument)),
  )
}

/**
 * Creates the WebSocket-facing descriptor. Browser-only metadata never crosses this boundary,
 * and the stable id always owns the model-facing tool name.
 */
export const toAiClientToolSessionDefinition = <T extends AiClientToolRoutingSource>(tool: T) => {
  const id = normalizeText(tool.id, 128)
  const routing = normalizeAiClientToolRoutingMetadata(tool)
  const effectValidation = validateAiClientToolEffectMetadata(tool)
  if (effectValidation.status === 'malformed') {
    throw new Error(effectValidation.issues[0]?.message || 'malformed client-tool effect metadata')
  }
  const effect = effectValidation.effect
  const explicitExpands = mergeAiClientToolParameterSchema(
    id,
    tool.parameterSchema,
    isRecord(tool.expands) ? tool.expands : undefined,
  )
  delete explicitExpands[AI_CLIENT_TOOL_ROUTING_EXPAND_KEY]
  delete explicitExpands[AI_CLIENT_TOOL_EFFECT_EXPAND_KEY]
  const expands = {
    ...explicitExpands,
    ...(effect ? { [AI_CLIENT_TOOL_EFFECT_EXPAND_KEY]: effect } : {}),
    ...(routing ? { [AI_CLIENT_TOOL_ROUTING_EXPAND_KEY]: routing } : {}),
  }
  const description = normalizeText(tool.description, 4_000)
  const inputs = Array.isArray(tool.inputs) ? tool.inputs : undefined
  const oneOrMoreStringArrayArguments = new Set(
    (routing?.analyticalCapability?.argumentBindings || []).flatMap(binding => (
      'valueArgument' in binding
      && binding.valueCardinality === 'one-or-more'
      && binding.encoding === 'string-array'
        ? [binding.valueArgument]
        : []
    )),
  )
  const output = isRecord(tool.output) ? tool.output : undefined
  const annotations = isRecord(tool.annotations) ? tool.annotations : undefined
  return {
    id,
    name: id,
    ...(description ? { description } : {}),
    ...(inputs ? {
      inputs: inputs.map(input => toSessionInput(
        input,
        isRecord(input)
          && typeof input.id === 'string'
          && oneOrMoreStringArrayArguments.has(input.id),
      )),
    } : {}),
    ...(output ? { output } : {}),
    ...(annotations ? { annotations } : {}),
    ...(Object.keys(expands).length ? { expands } : {}),
  }
}

/** Serializes every authorized definition without routing-based or count-based filtering. */
export const toAiClientToolSessionDefinitions = <T extends AiClientToolRoutingSource>(
  tools: readonly T[] = [],
) => tools
  .filter(tool => validateAiClientToolEffectMetadata(tool).status !== 'malformed')
  .map(tool => toAiClientToolSessionDefinition(tool))
