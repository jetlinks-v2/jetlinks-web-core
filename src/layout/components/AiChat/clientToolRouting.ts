import { isSupportedAiClientToolBindingPath } from './clientToolBindingPath'

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
  }
  output: { shape: string }
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

const toSessionInput = (value: unknown) => {
  if (!isRecord(value)) return value
  const required = value.required === true
  const hasDefaultValue = Object.prototype.hasOwnProperty.call(value, 'defaultValue')
    && value.defaultValue !== undefined
  if (!required && !hasDefaultValue) return value

  const expands = isRecord(value.expands) ? value.expands : {}
  const sessionValue = { ...value }
  delete sessionValue.defaultValue

  return {
    ...sessionValue,
    // JetLinks FunctionMetadata reads required/default from PropertyMetadata.expands.
    expands: {
      ...expands,
      ...(required ? { required: true } : {}),
      ...(hasDefaultValue && !Object.prototype.hasOwnProperty.call(expands, 'default')
        ? { default: value.defaultValue }
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
  if (!sourcePolicy || typeof value.required !== 'boolean') return undefined
  const { audience: _audience, ...resource } = producer
  return { ...resource, required: value.required, sourcePolicy }
}

const ANALYTICAL_TOKEN_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

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
  if (!isRecord(value)) return undefined
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

/**
 * Normalizes the sole producer-authored analytical contract. No digest, alias, field-name heuristic or inferred
 * default crosses the session boundary; an incomplete descriptor fails closed as one value.
 */
export const normalizeAiClientToolAnalyticalCapability = (
  value: unknown,
): AiClientToolAnalyticalCapability | undefined => {
  if (!isRecord(value) || value.version !== AI_CLIENT_TOOL_ANALYTICAL_CAPABILITY_VERSION) return undefined
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
  const output = isRecord(value.output) ? value.output : undefined
  const shape = normalizeText(output?.shape, 160).toLowerCase()
  const transformCost = value.transformCost
  if (!capabilityId || !CAPABILITY_PATTERN.test(capabilityId)
    || !semanticKey || !ANALYTICAL_TOKEN_PATTERN.test(semanticKey)
    || !subjects?.length || !dimensions || !filters || !grains || !criteria
    || measures.some(item => !item) || ordering.some(item => !item)
    || !completeness
    || typeof completeness.complete !== 'boolean'
    || typeof completeness.partial !== 'boolean'
    || typeof completeness.continuation !== 'boolean'
    || !shape || !RESOURCE_TYPE_PATTERN.test(shape)
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
    },
    output: { shape },
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
  const analyticalCapability = normalizeAiClientToolAnalyticalCapability(value.analyticalCapability)
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
  const materializedNames = new Set(typedOutputs.flatMap((output) => {
    const name = normalizeText(output.name, 160).toLowerCase()
    const delivery = normalizeText(output.delivery).toLowerCase()
    const kind = normalizeText(output.kind).toLowerCase()
    return name && (delivery === 'file' || (kind === 'artifact' && !delivery)) ? [name] : []
  }))
  const inlineProduces = produces.filter(name => !materializedNames.has(name))

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
    const producedIndex = produces.indexOf(name)
    const expectedShape = outputShapes.length === 1
      ? outputShapes[0]
      : outputShapes[producedIndex]
    if (!shape || (expectedShape && shape !== expectedShape)) {
      addIssue(issues, 'result_binding_shape_invalid', `_meta.resultBindings.${index}.shape`, `result binding shape must match routing output shape: ${expectedShape || 'missing'}`)
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

/**
 * Creates the WebSocket-facing descriptor. Browser-only metadata never crosses this boundary,
 * and the stable id always owns the model-facing tool name.
 */
export const toAiClientToolSessionDefinition = <T extends AiClientToolRoutingSource>(tool: T) => {
  const routing = normalizeAiClientToolRoutingMetadata(tool)
  const effectValidation = validateAiClientToolEffectMetadata(tool)
  if (effectValidation.status === 'malformed') {
    throw new Error(effectValidation.issues[0]?.message || 'malformed client-tool effect metadata')
  }
  const effect = effectValidation.effect
  const explicitExpands = isRecord(tool.expands) ? { ...tool.expands } : {}
  delete explicitExpands[AI_CLIENT_TOOL_ROUTING_EXPAND_KEY]
  delete explicitExpands[AI_CLIENT_TOOL_EFFECT_EXPAND_KEY]
  const expands = {
    ...explicitExpands,
    ...(effect ? { [AI_CLIENT_TOOL_EFFECT_EXPAND_KEY]: effect } : {}),
    ...(routing ? { [AI_CLIENT_TOOL_ROUTING_EXPAND_KEY]: routing } : {}),
  }
  const id = normalizeText(tool.id, 128)
  const description = normalizeText(tool.description, 4_000)
  const inputs = Array.isArray(tool.inputs) ? tool.inputs : undefined
  const output = isRecord(tool.output) ? tool.output : undefined
  const annotations = isRecord(tool.annotations) ? tool.annotations : undefined
  return {
    id,
    name: id,
    ...(description ? { description } : {}),
    ...(inputs ? { inputs: inputs.map(toSessionInput) } : {}),
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
