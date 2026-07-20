export const AI_CLIENT_TOOL_EVIDENCE_CONTRACT = 'tool-result-evidence/v1'

export type AiClientToolFailureDisposition = 'request' | 'tool' | 'dependency' | 'permission/user'
export type AiClientToolRecoveryAction = 'retry' | 'repair' | 'clarify' | 'terminal'

export type AiClientToolFieldSemanticRole =
  | 'timestamp'
  | 'number'
  | 'category'
  | 'longitude'
  | 'latitude'
  | 'identifier'

export interface AiClientToolOutputField {
  name: string
  semanticRole: AiClientToolFieldSemanticRole
  /** Optional user-facing series/axis label supplied by the owning tool. */
  label?: string
  /** Renderer-neutral scalar format such as percent or integer. */
  format?: string
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

const BINDING_SEMANTIC_ROLES = new Set<AiClientToolFieldSemanticRole>([
  'timestamp', 'number', 'category', 'longitude', 'latitude', 'identifier',
])

const boundedBindingFields = (values: AiClientToolOutputField[] | undefined) => (
  (values || []).flatMap((value) => {
    const name = String(value?.name || '').trim().slice(0, 160)
    const semanticRole = String(value?.semanticRole || '').trim().toLowerCase() as AiClientToolFieldSemanticRole
    const label = String(value?.label || '').trim().slice(0, 120)
    const format = String(value?.format || '').trim().toLowerCase().slice(0, 32)
    return name && BINDING_SEMANTIC_ROLES.has(semanticRole) ? [{
      name,
      semanticRole,
      ...(label ? { label } : {}),
      ...(format ? { format } : {}),
    }] : []
  }).slice(0, 32)
)

export const normalizeAiClientToolOutputBindings = (values: AiClientToolOutputBinding[] | undefined) => (
  (values || []).flatMap((value) => {
    const name = String(value?.name || '').trim().slice(0, 160)
    const label = String(value?.label || '').trim().slice(0, 120)
    const ref = String(value?.ref || '').trim().slice(0, 512)
    const path = String(value?.path || '').trim().slice(0, 512)
    const shape = String(value?.shape || '').trim().slice(0, 160)
    if (!name || (!ref && !path) || !shape) return []
    const fields = boundedBindingFields(value.fields)
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
  const evidence: AiClientToolEvidence = {
    contract: AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
    complete: options.complete,
    truncated: options.truncated,
    ...(options.requestedRange ? { requestedRange: { ...options.requestedRange } } : {}),
    ...(options.observedRange ? { observedRange: { ...options.observedRange } } : {}),
    ...(Number.isFinite(options.recordCount) ? { recordCount: Number(options.recordCount) } : {}),
    ...(Number.isFinite(options.returnedCount) ? { returnedCount: Number(options.returnedCount) } : {}),
    ...(options.limitReason ? { limitReason: options.limitReason } : {}),
    ...(options.resultStatus ? { resultStatus: options.resultStatus } : {}),
    ...(options.evidenceCoverage ? { evidenceCoverage: options.evidenceCoverage } : {}),
    ...(options.supportsAbsenceClaim === true ? { supportsAbsenceClaim: true } : {}),
    ...(options.facts && Object.keys(options.facts).length ? { facts: { ...options.facts } } : {}),
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
