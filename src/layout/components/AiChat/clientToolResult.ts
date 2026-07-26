export const AI_CLIENT_TOOL_EVIDENCE_CONTRACT = 'tool-result-evidence/v1'

export type AiClientToolFailureDisposition = 'request' | 'tool' | 'dependency' | 'permission/user'
export type AiClientToolRecoveryAction = 'retry' | 'repair' | 'clarify' | 'terminal'

export type AiClientToolFieldSemanticRole =
  | 'timestamp'
  | 'number'
  | 'category'
  | 'longitude'
  | 'latitude'
  | 'geo_point'
  | 'identifier'
  | 'state'
  | 'duration'

export interface AiClientToolOutputField {
  name: string
  semanticRole: AiClientToolFieldSemanticRole
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
  /** Optional user-facing binding label; execution continues to use the stable name. */
  label?: string
  ref?: string
  path?: string
  shape: string
  mediaType?: string
  recordCount?: number
  complete: boolean
  truncated?: boolean
  fields?: AiClientToolOutputField[]
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
  visibility: 'user'
}

export interface AiClientToolEvidence {
  contract: typeof AI_CLIENT_TOOL_EVIDENCE_CONTRACT
  requestedRange?: Record<string, unknown>
  observedRange?: Record<string, unknown>
  recordCount?: number
  returnedCount?: number
  complete: boolean
  truncated: boolean
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
  'timestamp', 'number', 'category', 'longitude', 'latitude', 'geo_point', 'identifier', 'state', 'duration',
])

const boundedBindingFields = (values: AiClientToolOutputField[] | undefined) => (
  (values || []).flatMap((value) => {
    const name = String(value?.name || '').trim().slice(0, 160)
    const semanticRole = String(value?.semanticRole || '').trim().toLowerCase() as AiClientToolFieldSemanticRole
    const label = String(value?.label || '').trim().slice(0, 120)
    const format = String(value?.format || '').trim().toLowerCase().slice(0, 32)
    const measure = String(value?.measure || '').trim().toLowerCase().slice(0, 160)
    const unit = String(value?.unit || '').trim().toLowerCase().slice(0, 32)
    const aggregation = String(value?.aggregation || '').trim().toLowerCase().slice(0, 160)
    return name && BINDING_SEMANTIC_ROLES.has(semanticRole) ? [{
      name,
      semanticRole,
      ...(label ? { label } : {}),
      ...(format ? { format } : {}),
      ...(measure ? { measure } : {}),
      ...(unit ? { unit } : {}),
      ...(aggregation ? { aggregation } : {}),
    }] : []
  }).slice(0, 32)
)

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
    exact: value.exact === true,
    provenance,
  }
}

export const normalizeAiClientToolOutputBindings = (values: AiClientToolOutputBinding[] | undefined) => (
  (values || []).flatMap((value) => {
    const name = String(value?.name || '').trim().slice(0, 160)
    const label = String(value?.label || '').trim().slice(0, 120)
    const ref = String(value?.ref || '').trim().slice(0, 512)
    const path = String(value?.path || '').trim().slice(0, 512)
    const shape = String(value?.shape || '').trim().slice(0, 160)
    if (!name || (!ref && !path) || !shape) return []
    const fields = boundedBindingFields(value.fields)
    const metric = boundedMetric(value.metric)
    const requestedRange = boundedStructuredRecord(value.requestedRange)
    const observedRange = boundedStructuredRecord(value.observedRange)
    const coverage = boundedStructuredRecord(value.coverage)
    return [{
      name,
      ...(label ? { label } : {}),
      ...(ref ? { ref } : {}),
      ...(path ? { path } : {}),
      shape,
      ...(value.mediaType ? { mediaType: String(value.mediaType).trim().slice(0, 160) } : {}),
      ...(Number.isFinite(value.recordCount) ? { recordCount: Number(value.recordCount) } : {}),
      complete: value.complete === true,
      ...(value.truncated !== undefined ? { truncated: value.truncated === true } : {}),
      ...(fields.length ? { fields } : {}),
      ...(requestedRange ? { requestedRange } : {}),
      ...(observedRange ? { observedRange } : {}),
      ...(coverage ? { coverage } : {}),
      ...(metric ? { metric } : {}),
    }]
  }).slice(0, 16)
)

const boundedClaims = (values: AiClientToolClaim[] | undefined) => {
  const ids = new Set<string>()
  return (values || []).flatMap((value) => {
    const id = String(value?.id || '').trim().slice(0, 120)
    const label = String(value?.label || '').trim().slice(0, 120)
    const scalar = value?.value
    if (!id || !label || ids.has(id)
      || !['string', 'number', 'boolean'].includes(typeof scalar)) return []
    ids.add(id)
    return [{
      id,
      label,
      value: typeof scalar === 'string' ? scalar.slice(0, 600) : scalar,
      ...(value.format ? { format: String(value.format).slice(0, 32) } : {}),
      visibility: 'user' as const,
    }]
  }).slice(0, 32)
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
  const evidence: AiClientToolEvidence = {
    contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
    complete: options.complete,
    truncated: options.truncated,
    ...(requestedRange ? { requestedRange } : {}),
    ...(observedRange ? { observedRange } : {}),
    ...(Number.isFinite(options.recordCount) ? { recordCount: Number(options.recordCount) } : {}),
    ...(Number.isFinite(options.returnedCount) ? { returnedCount: Number(options.returnedCount) } : {}),
    ...(options.limitReason ? { limitReason: options.limitReason } : {}),
    ...(options.resultStatus ? { resultStatus: options.resultStatus } : {}),
    ...(options.evidenceCoverage ? { evidenceCoverage: options.evidenceCoverage } : {}),
    ...(options.supportsAbsenceClaim === true ? { supportsAbsenceClaim: true } : {}),
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
