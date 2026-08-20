import { normalizeAiClientToolRecordPath } from './clientToolBindingPath'

export const AI_CLIENT_TOOL_EVIDENCE_CONTRACT = 'tool-result-evidence/v1'

export type AiClientToolFailureDisposition = 'request' | 'tool' | 'dependency' | 'permission/user'
export type AiClientToolRecoveryAction = 'retry' | 'repair' | 'clarify' | 'terminal'

export type AiClientToolFieldSemanticRole =
  | 'timestamp'
  | 'number'
  | 'category'
  /** Display-only row text; it must not be interpreted as a grouping dimension. */
  | 'label'
  | 'longitude'
  | 'latitude'
  | 'geo_point'
  | 'identifier'
  | 'state'
  | 'duration'

export const AI_CLIENT_TOOL_FIELD_TYPES = [
  'string', 'integer', 'number', 'boolean', 'timestamp', 'duration', 'object',
] as const

export const AI_CLIENT_TOOL_FIELD_ROLES = [
  'identifier', 'dimension', 'measure', 'temporal_dimension', 'state', 'longitude', 'latitude', 'label',
] as const

export type AiClientToolFieldType = typeof AI_CLIENT_TOOL_FIELD_TYPES[number]
export type AiClientToolFieldRole = typeof AI_CLIENT_TOOL_FIELD_ROLES[number]

interface AiClientToolOutputFieldBase {
  name: string
  /** Optional user-facing series/axis label supplied by the owning tool. */
  label?: string
  /** Renderer-neutral scalar format such as percent or integer. */
  format?: string
  /** Domain-neutral measure identity such as duration or count. */
  measure?: string
  /** Canonical scalar unit such as ms, percent, or count. */
  unit?: string
  /** Deterministic aggregation/operator identity. */
  aggregation?: string
}

/** Canonical producer wire. Physical scalar type and analytical role are deliberately independent. */
export interface AiClientToolCanonicalOutputField extends AiClientToolOutputFieldBase {
  type: AiClientToolFieldType
  role: AiClientToolFieldRole
  semanticRole?: never
}

/** Released authoring shape retained only for non-migrated tools until their exact consumers move. */
export interface AiClientToolLegacyOutputField extends AiClientToolOutputFieldBase {
  semanticRole: AiClientToolFieldSemanticRole
  type?: never
  role?: never
}

export type AiClientToolOutputField = AiClientToolCanonicalOutputField | AiClientToolLegacyOutputField

export type AiClientToolOrderingDirection = 'asc' | 'desc'

export interface AiClientToolOrderingKey {
  field: string
  direction: AiClientToolOrderingDirection
}

/** Bounded output ordering asserted by the producer; it never describes renderer behavior. */
export interface AiClientToolOrdering {
  keys: AiClientToolOrderingKey[]
  producerGuaranteed: boolean
}

export type AiClientToolCompleteness = 'complete' | 'empty' | 'partial' | 'truncated'

export interface AiClientToolContinuation {
  producerId: string
  capabilityId: string
  scopeDigest: string
  remainingScopeDigest: string
  argument: string
  value: string | number | boolean
}

export interface AiClientToolMetricDescriptor {
  name: string
  measure: string
  unit: string
  aggregation: string
  value?: unknown
  scope: Record<string, unknown>
  coverage: Record<string, unknown>
  exact: boolean
  provenance: Record<string, unknown>
}

export interface AiClientToolOutputBinding {
  name: string
  /** Static producer resource category copied from the owning typed port. */
  type?: string
  /** Optional user-facing binding label; execution continues to use the stable name. */
  label?: string
  ref?: string
  path?: string
  /** Safe JSONPath to the logical record collection inside the referenced JSON value. */
  recordPath?: string
  shape: string
  mediaType?: string
  recordCount?: number
  totalCount?: number
  displayedCount?: number
  complete: boolean
  truncated?: boolean
  completeness?: AiClientToolCompleteness
  continuation?: AiClientToolContinuation
  fields?: AiClientToolOutputField[]
  ordering?: AiClientToolOrdering
  requestedRange?: Record<string, unknown>
  observedRange?: Record<string, unknown>
  coverage?: Record<string, unknown>
  metric?: AiClientToolMetricDescriptor
}

export interface AiClientToolArtifactReference {
  uri: string
  path?: string
  fileName?: string
  mimeType: string
  size?: number
}

export interface AiClientToolClaim {
  id: string
  label: string
  value: string | number | boolean
  format?: string
  /** Logical output binding that owns this user-visible fact. */
  binding?: string
  /** Renderer-neutral measure identity declared by the owning binding. */
  measure?: string
  /** Deterministic statistic represented by this fact. */
  statistic?: string
  /** Canonical scalar unit such as count, percent, ms, or bytes. */
  unit?: string
  visibility: 'user'
}

export type AiClientToolCardinality =
  | {
      kind: 'record-set'
      recordCount: number
      returnedCount: number
      totalCount: number
    }
  | {
      kind: 'aggregate-series'
      bucketCount: number
      populatedBucketCount: number
      measurementCount: number
    }
  | {
      kind: 'preview'
      displayedCount: number
      totalCount?: number
      modelSample?: { count: number; userVisible: false }
    }

export interface AiClientToolEvidence {
  contract: typeof AI_CLIENT_TOOL_EVIDENCE_CONTRACT
  requestedRange?: Record<string, unknown>
  observedRange?: Record<string, unknown>
  recordCount?: number
  returnedCount?: number
  totalCount?: number
  displayedCount?: number
  /** Closed cardinality semantics prevent generated buckets and previews from becoming business record counts. */
  cardinality?: AiClientToolCardinality
  /** Bounded model-only sample metadata; never a user-visible count claim. */
  modelSample?: { count: number; userVisible: false }
  complete: boolean
  truncated: boolean
  completeness?: AiClientToolCompleteness
  continuation?: AiClientToolContinuation
  limitReason?: string
  resultStatus?: string
  evidenceCoverage?: string
  supportsAbsenceClaim?: boolean
  facts?: Record<string, unknown>
  claims?: AiClientToolClaim[]
  warnings?: string[]
  artifacts?: AiClientToolArtifactReference[]
  datasets?: string[]
  outputBindings?: AiClientToolOutputBinding[]
}

export interface AiClientToolEvidenceOptions extends Omit<AiClientToolEvidence, 'contract'> {
  outputBindings?: AiClientToolOutputBinding[]
}

export interface AiClientToolRepair {
  field?: string
  preserveArguments?: string[]
  requiredInput?: Record<string, unknown>
  maxAttempts?: number
}

export interface AiClientToolFailureOptions {
  code: string
  message: string
  failureDisposition: AiClientToolFailureDisposition
  recoveryAction?: AiClientToolRecoveryAction
  retryable: boolean
  repair?: AiClientToolRepair
  details?: Record<string, unknown>
}

const boundedStrings = (values: string[] | undefined, limit: number) => (
  Array.from(new Set((values || []).map(value => String(value || '').trim()).filter(Boolean))).slice(0, limit)
)

const STRUCTURED_RECORD_LIMITS = {
  depth: 4,
  objectKeys: 32,
  arrayItems: 32,
  keyCharacters: 160,
  stringCharacters: 600,
} as const

const UNSAFE_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const isStructuredRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

/** Copies model-readable metadata into a bounded JSON-compatible value without inferring domain fields. */
const boundedStructuredValue = (
  value: unknown,
  depth = 0,
  ancestors = new Set<object>(),
): unknown => {
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'string') return value.slice(0, STRUCTURED_RECORD_LIMITS.stringCharacters)
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if ((typeof value !== 'object' || value === null) || depth >= STRUCTURED_RECORD_LIMITS.depth) {
    return undefined
  }
  if (ancestors.has(value)) return undefined
  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      return value
        .slice(0, STRUCTURED_RECORD_LIMITS.arrayItems)
        .map(item => boundedStructuredValue(item, depth + 1, ancestors))
        .filter(item => item !== undefined)
    }
    const entries: Array<[string, unknown]> = []
    const keys = new Set<string>()
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = rawKey.trim().slice(0, STRUCTURED_RECORD_LIMITS.keyCharacters)
      if (!key || UNSAFE_RECORD_KEYS.has(key) || keys.has(key)) continue
      const normalized = boundedStructuredValue(rawValue, depth + 1, ancestors)
      if (normalized === undefined) continue
      entries.push([key, normalized])
      keys.add(key)
      if (entries.length >= STRUCTURED_RECORD_LIMITS.objectKeys) break
    }
    return Object.fromEntries(entries)
  } finally {
    ancestors.delete(value)
  }
}

const boundedStructuredRecord = (value: unknown) => {
  if (!isStructuredRecord(value)) return undefined
  const normalized = boundedStructuredValue(value)
  return isStructuredRecord(normalized) ? normalized : undefined
}

const BINDING_SEMANTIC_ROLES = new Set<AiClientToolFieldSemanticRole>([
  'timestamp', 'number', 'category', 'label', 'longitude', 'latitude', 'geo_point', 'identifier', 'state', 'duration',
])
const BINDING_FIELD_TYPES = new Set<AiClientToolFieldType>(AI_CLIENT_TOOL_FIELD_TYPES)
const BINDING_FIELD_ROLES = new Set<AiClientToolFieldRole>(AI_CLIENT_TOOL_FIELD_ROLES)

/**
 * Accepts either the canonical type/role pair or the released semanticRole shape, never both. Canonical values are
 * validated as authored and are not reconstructed from names, formats, measures or row samples.
 */
export const normalizeAiClientToolOutputFields = (
  values: readonly AiClientToolOutputField[] | undefined,
): AiClientToolOutputField[] | undefined => {
  if (values === undefined) return []
  if (!Array.isArray(values) || values.length > 32) return undefined
  const fields: AiClientToolOutputField[] = []
  const names = new Set<string>()
  let descriptorKind: 'canonical' | 'legacy' | undefined
  for (const rawValue of values as readonly unknown[]) {
    if (!isStructuredRecord(rawValue)) return undefined
    const value = rawValue as Record<string, unknown>
    const requiredText = (raw: unknown, maxLength: number, lowerCase = false) => {
      if (typeof raw !== 'string') return undefined
      const normalized = raw.trim()
      if (!normalized || normalized.length > maxLength) return undefined
      return lowerCase ? normalized.toLowerCase() : normalized
    }
    const optionalText = (raw: unknown, maxLength: number, lowerCase = false) => {
      if (raw === undefined) return ''
      return requiredText(raw, maxLength, lowerCase)
    }
    const name = requiredText(value.name, 160)
    const label = optionalText(value.label, 120)
    const format = optionalText(value.format, 32, true)
    const measure = optionalText(value.measure, 160, true)
    const unit = optionalText(value.unit, 32, true)
    const aggregation = optionalText(value.aggregation, 160, true)
    if (!name || names.has(name)
      || label === undefined || format === undefined || measure === undefined
      || unit === undefined || aggregation === undefined) return undefined
    const common = {
      name,
      ...(label ? { label } : {}),
      ...(format ? { format } : {}),
      ...(measure ? { measure } : {}),
      ...(unit ? { unit } : {}),
      ...(aggregation ? { aggregation } : {}),
    }
    const type = requiredText(value.type, 32, true) as AiClientToolFieldType | undefined
    const role = requiredText(value.role, 32, true) as AiClientToolFieldRole | undefined
    const semanticRole = requiredText(value.semanticRole, 32, true) as AiClientToolFieldSemanticRole | undefined
    const currentKind = type || role ? 'canonical' : 'legacy'
    if (descriptorKind && descriptorKind !== currentKind) return undefined
    descriptorKind = currentKind
    if (currentKind === 'canonical') {
      if (!type || !role || semanticRole
        || !BINDING_FIELD_TYPES.has(type) || !BINDING_FIELD_ROLES.has(role)) return undefined
      fields.push({ ...common, type, role })
    } else {
      if (!semanticRole || !BINDING_SEMANTIC_ROLES.has(semanticRole)) return undefined
      fields.push({ ...common, semanticRole })
    }
    names.add(name)
  }
  return fields
}

export const isCanonicalAiClientToolOutputField = (
  value: AiClientToolOutputField,
): value is AiClientToolCanonicalOutputField => (
  BINDING_FIELD_TYPES.has(String(value?.type || '').trim().toLowerCase() as AiClientToolFieldType)
  && BINDING_FIELD_ROLES.has(String(value?.role || '').trim().toLowerCase() as AiClientToolFieldRole)
  && !String(value?.semanticRole || '').trim()
)

/**
 * Accepts ordering only when every bounded key references a declared field.
 * Invalid declarations fail closed as a whole and are never repaired from field names or row samples.
 */
export const normalizeAiClientToolOrdering = (
  value: unknown,
  fields: readonly AiClientToolOutputField[] | undefined,
): AiClientToolOrdering | undefined => {
  if (!isStructuredRecord(value)
    || typeof value.producerGuaranteed !== 'boolean'
    || !Array.isArray(value.keys)
    || value.keys.length === 0
    || value.keys.length > 8) return undefined
  const declaredFields = new Set((fields || []).map(field => String(field?.name || '').trim()).filter(Boolean))
  const seen = new Set<string>()
  const keys: AiClientToolOrderingKey[] = []
  for (const rawKey of value.keys) {
    if (!isStructuredRecord(rawKey)) return undefined
    const field = String(rawKey.field || '').trim()
    const direction = String(rawKey.direction || '').trim().toLowerCase()
    if (!field
      || field.length > 160
      || !declaredFields.has(field)
      || seen.has(field)
      || (direction !== 'asc' && direction !== 'desc')) return undefined
    seen.add(field)
    keys.push({ field, direction })
  }
  return {
    keys,
    producerGuaranteed: value.producerGuaranteed,
  }
}

const boundedMetric = (value: AiClientToolMetricDescriptor | undefined) => {
  const name = String(value?.name || '').trim().slice(0, 160)
  const measure = String(value?.measure || '').trim().toLowerCase().slice(0, 160)
  const unit = String(value?.unit || '').trim().toLowerCase().slice(0, 32)
  const aggregation = String(value?.aggregation || '').trim().toLowerCase().slice(0, 160)
  const scope = boundedStructuredRecord(value?.scope)
  const coverage = boundedStructuredRecord(value?.coverage)
  const provenance = boundedStructuredRecord(value?.provenance)
  const metricValue = boundedStructuredValue(value?.value)
  if (!name || !measure || !unit || !aggregation || !scope || !coverage || !provenance) return undefined
  return {
    name,
    measure,
    unit,
    aggregation,
    ...(metricValue !== undefined ? { value: metricValue } : {}),
    scope,
    coverage,
    exact: value?.exact === true,
    provenance,
  }
}

const normalizeAiClientToolContinuation = (value: unknown): AiClientToolContinuation | undefined => {
  if (!isStructuredRecord(value)) return undefined
  const boundedText = (raw: unknown, maxLength: number) => {
    if (typeof raw !== 'string') return ''
    const normalized = raw.trim()
    return normalized.length <= maxLength ? normalized : ''
  }
  const producerId = boundedText(value.producerId, 160)
  const capabilityId = boundedText(value.capabilityId, 160)
  const scopeDigest = boundedText(value.scopeDigest, 128)
  const remainingScopeDigest = boundedText(value.remainingScopeDigest, 128)
  const argument = boundedText(value.argument, 160)
  const continuationValue = value.value
  if (!producerId || !capabilityId || !scopeDigest || !remainingScopeDigest || !argument
    || !['string', 'number', 'boolean'].includes(typeof continuationValue)
    || (typeof continuationValue === 'number' && !Number.isFinite(continuationValue))) return undefined
  return {
    producerId,
    capabilityId,
    scopeDigest,
    remainingScopeDigest,
    argument,
    value: continuationValue as string | number | boolean,
  }
}

const normalizeBindingCompleteness = (
  value: AiClientToolOutputBinding,
  continuation: AiClientToolContinuation | undefined,
): { valid: boolean; completeness?: AiClientToolCompleteness } => {
  if (value.completeness === undefined) {
    return { valid: value.continuation === undefined }
  }
  if (typeof value.completeness !== 'string') return { valid: false }
  const declared = value.completeness.trim().toLowerCase() as AiClientToolCompleteness
  if (!(['complete', 'empty', 'partial', 'truncated'] as const).includes(declared)) return { valid: false }
  if (declared === 'complete' || declared === 'empty') {
    return { valid: value.complete === true && value.continuation === undefined, completeness: declared }
  }
  if (declared === 'partial') {
    return { valid: value.complete === false && !!continuation, completeness: declared }
  }
  return { valid: value.complete === false && value.continuation === undefined, completeness: declared }
}

export const normalizeAiClientToolOutputBindings = (values: AiClientToolOutputBinding[] | undefined) => {
  if (values === undefined) return []
  if (!Array.isArray(values)) return []
  return values.flatMap((value) => {
    if (!isStructuredRecord(value) || typeof value.complete !== 'boolean') return []
    const name = String(value?.name || '').trim().slice(0, 160)
    const type = String(value?.type || '').trim().toLowerCase().slice(0, 64)
    const label = String(value?.label || '').trim().slice(0, 120)
    const ref = String(value?.ref || '').trim().slice(0, 512)
    const path = String(value?.path || '').trim().slice(0, 512)
    const recordPath = value?.recordPath === undefined
      ? undefined
      : normalizeAiClientToolRecordPath(value.recordPath)
    const shape = String(value?.shape || '').trim().slice(0, 160)
    if (!name || (!ref && !path) || !shape
      || (value.recordPath !== undefined && !recordPath)
      || (value.fields !== undefined && !Array.isArray(value.fields))) return []
    const fields = normalizeAiClientToolOutputFields(value.fields)
    if (!fields) return []
    const canonicalFields = fields.length > 0 && fields.every(isCanonicalAiClientToolOutputField)
    if (canonicalFields && !recordPath) return []
    const ordering = normalizeAiClientToolOrdering(value.ordering, fields)
    if (value.ordering !== undefined && !ordering) return []
    const continuation = normalizeAiClientToolContinuation(value.continuation)
    if (value.continuation !== undefined && !continuation) return []
    const completenessResult = normalizeBindingCompleteness(value, continuation)
    if (!completenessResult.valid) return []
    const completeness = completenessResult.completeness
    const metric = boundedMetric(value.metric)
    const requestedRange = boundedStructuredRecord(value.requestedRange)
    const observedRange = boundedStructuredRecord(value.observedRange)
    const coverage = boundedStructuredRecord(value.coverage)
    return [{
      name,
      ...(type ? { type } : {}),
      ...(label ? { label } : {}),
      ...(ref ? { ref } : {}),
      ...(path ? { path } : {}),
      ...(recordPath ? { recordPath } : {}),
      shape,
      ...(value.mediaType ? { mediaType: String(value.mediaType).trim().slice(0, 160) } : {}),
      ...(Number.isFinite(value.recordCount) ? { recordCount: Number(value.recordCount) } : {}),
      ...(Number.isFinite(value.totalCount) ? { totalCount: Number(value.totalCount) } : {}),
      ...(Number.isFinite(value.displayedCount) ? { displayedCount: Number(value.displayedCount) } : {}),
      complete: value.complete === true,
      ...(value.truncated !== undefined ? { truncated: value.truncated === true } : {}),
      ...(completeness ? { completeness } : {}),
      ...(completeness === 'partial' && continuation ? { continuation } : {}),
      ...(fields.length ? { fields } : {}),
      ...(ordering ? { ordering } : {}),
      ...(requestedRange ? { requestedRange } : {}),
      ...(observedRange ? { observedRange } : {}),
      ...(coverage ? { coverage } : {}),
      ...(metric ? { metric } : {}),
    }]
  }).slice(0, 16)
}

const boundedClaims = (values: AiClientToolClaim[] | undefined) => {
  const ids = new Set<string>()
  return (values || []).flatMap((value) => {
    const id = String(value?.id || '').trim().slice(0, 120)
    const label = String(value?.label || '').trim().slice(0, 120)
    const scalar = value?.value
    if (!id || !label || ids.has(id)
      || !['string', 'number', 'boolean'].includes(typeof scalar)) return []
    ids.add(id)
    const binding = String(value.binding || '').trim().slice(0, 160)
    const measure = String(value.measure || '').trim().slice(0, 160)
    const statistic = String(value.statistic || '').trim().toLowerCase().slice(0, 64)
    const unit = String(value.unit || '').trim().toLowerCase().slice(0, 32)
    return [{
      id,
      label,
      value: typeof scalar === 'string' ? scalar.slice(0, 600) : scalar,
      ...(value.format ? { format: String(value.format).slice(0, 32) } : {}),
      ...(binding ? { binding } : {}),
      ...(measure ? { measure } : {}),
      ...(statistic ? { statistic } : {}),
      ...(unit ? { unit } : {}),
      visibility: 'user' as const,
    }]
  }).slice(0, 32)
}

const nonNegativeCount = (value: unknown) => (
  Number.isFinite(value) ? Math.max(0, Math.trunc(Number(value))) : 0
)

/** Normalizes the additive v1 cardinality contract without inferring semantics from generic `total` fields. */
export function normalizeAiClientToolCardinality(value: undefined): undefined
export function normalizeAiClientToolCardinality(
  value: Extract<AiClientToolCardinality, { kind: 'record-set' }>,
): Extract<AiClientToolCardinality, { kind: 'record-set' }>
export function normalizeAiClientToolCardinality(
  value: Extract<AiClientToolCardinality, { kind: 'aggregate-series' }>,
): Extract<AiClientToolCardinality, { kind: 'aggregate-series' }>
export function normalizeAiClientToolCardinality(
  value: Extract<AiClientToolCardinality, { kind: 'preview' }>,
): Extract<AiClientToolCardinality, { kind: 'preview' }>
export function normalizeAiClientToolCardinality(
  value: AiClientToolCardinality | undefined,
): AiClientToolCardinality | undefined
export function normalizeAiClientToolCardinality(
  value: AiClientToolCardinality | undefined,
): AiClientToolCardinality | undefined {
  if (!value) return undefined
  if (value.kind === 'record-set') {
    const returnedCount = nonNegativeCount(value.returnedCount)
    const totalCount = Math.max(
      returnedCount,
      nonNegativeCount(value.recordCount),
      nonNegativeCount(value.totalCount),
    )
    return {
      kind: value.kind,
      recordCount: totalCount,
      returnedCount,
      totalCount,
    }
  }
  if (value.kind === 'aggregate-series') {
    const bucketCount = nonNegativeCount(value.bucketCount)
    const populatedBucketCount = Math.min(bucketCount, nonNegativeCount(value.populatedBucketCount))
    return {
      kind: value.kind,
      bucketCount,
      populatedBucketCount,
      measurementCount: nonNegativeCount(value.measurementCount),
    }
  }
  const displayedCount = nonNegativeCount(value.displayedCount)
  return {
    kind: value.kind,
    displayedCount,
    ...(Number.isFinite(value.totalCount)
      ? { totalCount: Math.max(displayedCount, nonNegativeCount(value.totalCount)) }
      : {}),
    ...(Number.isFinite(value.modelSample?.count) ? {
      modelSample: { count: nonNegativeCount(value.modelSample?.count), userVisible: false },
    } : {}),
  }
}

/** Adds the canonical evidence envelope without replacing the owning tool's business result shape. */
export const withAiClientToolEvidence = <T extends Record<string, unknown>>(
  result: T,
  options: AiClientToolEvidenceOptions,
) => {
  const outputBindings = normalizeAiClientToolOutputBindings(options.outputBindings)
  const claims = boundedClaims(options.claims)
  const requestedRange = boundedStructuredRecord(options.requestedRange)
  const observedRange = boundedStructuredRecord(options.observedRange)
  const facts = boundedStructuredRecord(options.facts)
  const cardinality = normalizeAiClientToolCardinality(options.cardinality)
  const recordSet = cardinality?.kind === 'record-set' ? cardinality : undefined
  const preview = cardinality?.kind === 'preview' ? cardinality : undefined
  const recordCount = Number.isFinite(options.recordCount) ? Number(options.recordCount) : recordSet?.recordCount
  const returnedCount = Number.isFinite(options.returnedCount) ? Number(options.returnedCount) : recordSet?.returnedCount
  const totalCount = Number.isFinite(options.totalCount)
    ? Number(options.totalCount)
    : (recordSet?.totalCount ?? preview?.totalCount)
  const displayedCount = Number.isFinite(options.displayedCount)
    ? Number(options.displayedCount)
    : preview?.displayedCount
  const modelSample = options.modelSample ?? preview?.modelSample
  const continuation = normalizeAiClientToolContinuation(options.continuation)
  const completeness: AiClientToolCompleteness = options.complete
    ? options.resultStatus === 'empty' ? 'empty' : 'complete'
    : continuation ? 'partial' : 'truncated'
  const evidence: AiClientToolEvidence = {
    contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
    complete: options.complete,
    truncated: options.truncated,
    completeness,
    ...(completeness === 'partial' && continuation ? { continuation } : {}),
    ...(requestedRange ? { requestedRange } : {}),
    ...(observedRange ? { observedRange } : {}),
    ...(Number.isFinite(recordCount) ? { recordCount: Number(recordCount) } : {}),
    ...(Number.isFinite(returnedCount) ? { returnedCount: Number(returnedCount) } : {}),
    ...(Number.isFinite(totalCount) ? { totalCount: Number(totalCount) } : {}),
    ...(Number.isFinite(displayedCount) ? { displayedCount: Number(displayedCount) } : {}),
    ...(cardinality ? { cardinality } : {}),
    ...(Number.isFinite(modelSample?.count) ? {
      modelSample: { count: Number(modelSample?.count), userVisible: false },
    } : {}),
    ...(options.limitReason ? { limitReason: options.limitReason } : {}),
    ...(options.resultStatus ? { resultStatus: options.resultStatus } : {}),
    ...(options.evidenceCoverage ? { evidenceCoverage: options.evidenceCoverage } : {}),
    ...(options.supportsAbsenceClaim !== undefined
      ? { supportsAbsenceClaim: options.supportsAbsenceClaim === true }
      : {}),
    ...(facts && Object.keys(facts).length ? { facts } : {}),
    ...(claims.length ? { claims } : {}),
    ...(options.warnings?.length ? { warnings: boundedStrings(options.warnings, 8) } : {}),
    ...(options.artifacts?.length ? { artifacts: options.artifacts.slice(0, 16).map(value => ({ ...value })) } : {}),
    ...(options.datasets?.length ? { datasets: boundedStrings(options.datasets, 16) } : {}),
    ...(outputBindings.length ? { outputBindings } : {}),
  }
  return {
    ...result,
    success: true as const,
    complete: options.complete,
    truncated: options.truncated,
    completeness,
    ...(completeness === 'partial' && continuation ? { continuation } : {}),
    evidence,
    // The top-level mirror is model-readable; the evidence envelope remains the authoritative source.
    ...(outputBindings.length ? { outputBindings } : {}),
  }
}

/** Creates the machine-readable failure shape consumed by the backend retry/repair policy. */
export const createAiClientToolFailureResult = (options: AiClientToolFailureOptions) => ({
  success: false as const,
  code: options.code,
  message: options.message,
  failureDisposition: options.failureDisposition,
  ...(options.recoveryAction ? { recoveryAction: options.recoveryAction } : {}),
  retryable: options.retryable,
  ...(options.repair ? {
    repair: {
      ...options.repair,
      ...(options.repair.preserveArguments
        ? { preserveArguments: boundedStrings(options.repair.preserveArguments, 32) }
        : {}),
      ...(Number.isFinite(options.repair.maxAttempts)
        ? { maxAttempts: Math.max(0, Math.min(Number(options.repair.maxAttempts), 3)) }
        : {}),
    },
  } : {}),
  ...(options.details ? { details: { ...options.details } } : {}),
})
