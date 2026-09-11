import type {
  AiClientToolCall,
  AiClientToolResultDelivery,
  AiClientToolSessionFileApi,
} from './clientTools'
import {
  normalizeAiClientToolCardinality,
  normalizeAiClientToolOutputBindings,
  withAiClientToolEvidence,
  type AiClientToolCardinality,
  type AiClientToolArtifactReference,
  type AiClientToolClaim,
  type AiClientToolOutputBinding,
  type AiClientToolOutputField,
  type AiClientToolOrdering,
} from './clientToolResult'
import type {
  AiClientToolOutputAudience,
  AiClientToolResourceType,
  AiClientToolRoutingResultDelivery,
} from './clientToolRouting'
import type { GeneralAgentMarkdownPresentationCapability } from './generalAgentExtensions'
import { diagnoseAiClientToolOutputPresentationCompatibility } from './clientToolContract'
import {
  normalizeAiClientToolRecordPath,
  resolveAiClientToolBindingPath,
} from './clientToolBindingPath'
import {
  collectAiClientToolSemanticFields,
  createAiClientToolRecordFactCollector,
} from './clientToolRecordFacts'

const RECORD_STREAM_KIND = 'ai-client-tool-record-stream/v1'
const ARTIFACT_KIND = 'ai-client-tool-artifact/v1'
const NDJSON_MIME_TYPE = 'application/x-ndjson'
const DEFAULT_CHUNK_BYTES = 256 * 1024
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_MAX_RECORDS = 10_000
const DEFAULT_MAX_DURATION_MS = 25_000
const DEFAULT_MAX_ROW_BYTES = 64 * 1024
const DEFAULT_PREVIEW_LIMIT = 3
const DEFAULT_FALLBACK_SAMPLE_LIMIT = 10
const DEFAULT_MAX_INLINE_BYTES = 128 * 1024

type JsonRecord = Record<string, unknown>
type SessionFileDeliveryState = 'not-started' | 'unknown' | 'opened' | 'committed' | 'rolled-back'

export type AiClientToolRecordLimitReason =
  | 'bytes'
  | 'duration'
  | 'records'
  | 'rowBytes'
  | 'sample'

export interface AiClientToolRecordConsumerContext {
  signal: AbortSignal
}

/**
 * Produces normalized records one at a time and awaits the consumer for every row.
 *
 * Source adapters must propagate cancellation and must not pre-buffer the complete result.
 */
export interface AiClientToolRecordSource<T> {
  consume: (
    consumer: (row: T) => Promise<void>,
    context: AiClientToolRecordConsumerContext,
  ) => Promise<void>
}

export interface AiClientToolRecordDeliveryLimits {
  chunkBytes?: number
  maxBytes?: number
  maxRecords?: number
  maxDurationMs?: number
  maxRowBytes?: number
  previewLimit?: number
  fallbackSampleLimit?: number
}

export interface AiClientToolRecordStreamOptions<T> {
  source: AiClientToolRecordSource<T>
  schema: JsonRecord
  /** Stable binding name exposed to downstream dataset/chart/document tools. */
  bindingName?: string
  /** Optional user-facing label owned by the output declaration. */
  bindingLabel?: string
  /** Stable shape of the materialized records. */
  outputShape?: string
  timeRange?: JsonRecord
  summary?: JsonRecord
  /** Producer-owned field semantics copied by the contract compiler for materialized records. */
  fields?: readonly AiClientToolOutputField[]
  /** Producer-guaranteed record order; never inferred by the delivery layer. */
  ordering?: AiClientToolOrdering
  /** C2 evidence axes; source coverage and visual omission are producer-owned facts. */
  requestSatisfied?: boolean
  exhaustive?: boolean
  displayTruncated?: boolean
  path?: string
  limits?: AiClientToolRecordDeliveryLimits
}

export interface AiClientToolRecordStream<T> extends AiClientToolRecordStreamOptions<T> {
  kind: typeof RECORD_STREAM_KIND
}

export interface AiClientToolRecordDeliveryData<T> {
  success: true
  producedFile: boolean
  delivery: 'session-file' | 'inline-sample' | 'empty'
  path?: string
  fileRef?: string
  mimeType: typeof NDJSON_MIME_TYPE
  size: number
  count: number
  schema: JsonRecord
  timeRange?: JsonRecord
  observedRange?: JsonRecord
  facts?: JsonRecord
  sample: T[]
  complete: boolean
  truncated: boolean
  requestSatisfied?: boolean
  exhaustive?: boolean
  displayTruncated?: boolean
  limitReason?: AiClientToolRecordLimitReason
  fileUnavailable?: boolean
  fileErrorCode?: 'CLIENT_TOOL_FILE_UNAVAILABLE' | 'CLIENT_TOOL_FILE_WRITE_FAILED'
  audience?: AiClientToolOutputAudience
  required?: boolean
  satisfied?: boolean
  sourceExact?: boolean
  sourceDigest?: string
  sourceDigestProfile?: 'bytes-v1'
}

export interface AiClientToolArtifactOptions<TPreview = unknown> {
  /** Complete renderer source. This value is never copied into the model-facing result. */
  content: ArrayBuffer | Blob | string
  mimeType: string
  preview: TPreview
  /** Producer-reviewed JSON source that may be exposed when session-file delivery is unavailable. */
  modelSafeInline?: unknown
  maxInlineBytes?: number
  bindingName?: string
  /** Optional user-facing label owned by the output declaration. */
  bindingLabel?: string
  outputShape?: string
  /** Safe JSONPath to the logical record collection inside this JSON artifact. */
  recordPath?: string
  fileExtension?: string
  maxBytes?: number
  /** Semantic source cardinality; generic artifact sizes and producer `total` fields are never interpreted as rows. */
  cardinality?: AiClientToolCardinality
  /** Bounded model-only sample metadata; independent from user-visible source cardinality. */
  modelSample?: { count: number; userVisible: false }
  complete?: boolean
  truncated?: boolean
  requestSatisfied?: boolean
  exhaustive?: boolean
  displayTruncated?: boolean
  requestedRange?: JsonRecord
  observedRange?: JsonRecord
  facts?: JsonRecord
  /** Structured field semantics copied from the producer output contract. */
  fields?: readonly AiClientToolOutputField[]
  /** Producer-guaranteed structured record ordering. */
  ordering?: AiClientToolOrdering
  /** Created once by the producer so one execution remains idempotent without coupling paths to call.id. */
  executionId?: string
}

export interface AiClientToolArtifact<TPreview = unknown> extends AiClientToolArtifactOptions<TPreview> {
  kind: typeof ARTIFACT_KIND
  executionId: string
}

interface AiClientToolArtifactDeliveryData<TPreview> {
  producedFile: boolean
  delivery: 'session-file' | 'inline' | 'bounded-preview'
  preview: TPreview
  mimeType: string
  size: number
  source?: unknown
  path?: string
  fileRef?: string
  fileUnavailable?: boolean
  fileErrorCode?: 'CLIENT_TOOL_FILE_WRITE_FAILED'
  limitReason?: 'bytes'
  audience?: AiClientToolOutputAudience
  required?: boolean
  satisfied?: boolean
  sourceExact?: boolean
  sourceDigest?: string
  sourceDigestProfile?: 'bytes-v1'
}

export interface DeliverAiClientToolResultOptions {
  call: AiClientToolCall
  resultDelivery?: AiClientToolResultDelivery
  /** Single canonical binding declared by the executing tool's routing metadata. */
  bindingName?: string
  /** Single canonical output shape declared by the executing tool's routing metadata. */
  outputShape?: string
  /** Canonical producer category for single-output legacy materialization helpers. */
  outputType?: string
  /** Declarative paths for inline values advertised through routing.produces. */
  outputBindings?: AiClientToolResultBindingDefinition[]
  /** Canonical typed outputs used to resolve one materialized carrier without inspecting payload shape. */
  outputs?: readonly AiClientToolResultOutputDefinition[]
  /** The runtime's effective reply guard, in the same serialized JSON characters as that guard. */
  replyMaxJsonLength?: number
}

export interface AiClientToolResultBindingDefinition {
  name: string
  type?: string
  label?: string
  audience?: AiClientToolOutputAudience
  path: string
  /** Logical record collection inside the value selected by path. */
  recordPath?: string
  shape: string
  mediaType?: string
  fields?: AiClientToolOutputField[]
  ordering?: AiClientToolOrdering
}

export interface AiClientToolResultOutputDefinition {
  name: string
  type: AiClientToolResourceType
  shape: string
  mediaType: string
  audience: AiClientToolOutputAudience
  delivery: AiClientToolRoutingResultDelivery
}

class RecordDeliveryLimitError extends Error {
  readonly reason: AiClientToolRecordLimitReason

  constructor(reason: AiClientToolRecordLimitReason) {
    super(`client tool record delivery reached ${reason} limit`)
    this.name = 'RecordDeliveryLimitError'
    this.reason = reason
  }
}

class RecordFileWriteError extends Error {
  readonly code = 'CLIENT_TOOL_FILE_WRITE_FAILED'
  readonly cause: unknown

  constructor(cause: unknown) {
    super('session file upload failed')
    this.name = 'RecordFileWriteError'
    this.cause = cause
  }
}

const isRecord = (value: unknown): value is JsonRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const clampInteger = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, Math.floor(number)))
    : fallback
}

const safeCallId = (value: unknown) => {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-')
  return normalized.slice(0, 96) || `result-${Date.now()}`
}

const padTimePart = (value: number, length = 2) => String(value).padStart(length, '0')

const formatResultTime = (timestamp: number) => {
  const time = new Date(timestamp)
  return [
    time.getFullYear(),
    padTimePart(time.getMonth() + 1),
    padTimePart(time.getDate()),
    '-',
    padTimePart(time.getHours()),
    padTimePart(time.getMinutes()),
    padTimePart(time.getSeconds()),
    '-',
    padTimePart(time.getMilliseconds(), 3),
  ].join('')
}

/** Creates a readable, collision-resistant default path for one tool execution. */
export const createAiClientToolResultPath = (
  toolName: unknown,
  timestamp = Date.now(),
) => `tool-results/${safeCallId(toolName || 'tool-result')}-${formatResultTime(timestamp)}.ndjson`

const createExecutionId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Older embedded runtimes fall through to a bounded random identifier.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
}

const safeExtension = (value: unknown) => {
  const extension = String(value || 'bin').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
  return extension.slice(0, 16) || 'bin'
}

export const createAiClientToolArtifactPath = (
  toolName: unknown,
  executionId: unknown,
  extension: unknown,
) => `tool-artifacts/${safeCallId(toolName || 'tool-artifact')}-${safeCallId(executionId)}.${safeExtension(extension)}`

const createAbortError = () => {
  const error = new Error('client tool record delivery aborted') as Error & { code?: string }
  error.name = 'AbortError'
  error.code = 'CLIENT_TOOL_ABORTED'
  return error
}

const isRecordStream = (value: unknown): value is AiClientToolRecordStream<unknown> => (
  isRecord(value)
  && value.kind === RECORD_STREAM_KIND
  && isRecord(value.source)
  && typeof value.source.consume === 'function'
)

const resolveRecordStream = (value: unknown) => {
  if (isRecordStream(value)) {
    return { stream: value, envelope: undefined }
  }
  if (isRecord(value) && isRecordStream(value.data)) {
    return { stream: value.data, envelope: value }
  }
  return undefined
}

const resolveSessionFiles = (
  mode: AiClientToolResultDelivery,
  files?: AiClientToolSessionFileApi,
) => {
  if (mode === 'inline' || !files) return undefined
  try {
    if (files.capabilities?.().available === false) return undefined
  } catch {
    return undefined
  }
  return files
}

const cleanupPartialFile = async (
  files: AiClientToolSessionFileApi | undefined,
  path: string,
  state: SessionFileDeliveryState,
): Promise<SessionFileDeliveryState> => {
  if (!files || (state !== 'unknown' && state !== 'opened')) return state
  try {
    // The server owns physical rollback; repeated client compensation must therefore be idempotent.
    await files.remove(path, { ignoreMissing: true })
    return 'rolled-back'
  } catch {
    // Preserve the unknown state so a transport/storage failure is not mistaken for a completed rollback.
    return 'unknown'
  }
}

const createDeliveryData = <T>(
  input: Omit<AiClientToolRecordDeliveryData<T>, 'success' | 'mimeType'>,
): AiClientToolRecordDeliveryData<T> => ({
  success: true as const,
  mimeType: NDJSON_MIME_TYPE,
  ...input,
})

/** Creates an internal record-stream descriptor that is materialized by the client-tool runtime. */
export const createAiClientToolRecordStream = <T>(
  options: AiClientToolRecordStreamOptions<T>,
): AiClientToolRecordStream<T> => ({
  kind: RECORD_STREAM_KIND,
  ...options,
})

/** Adapts an already bounded producer result to the same backpressure-aware delivery lifecycle. */
export const createAiClientToolArrayRecordSource = <T>(
  records: readonly T[],
): AiClientToolRecordSource<T> => ({
  consume: async (consumer, context) => {
    for (const record of records) {
      if (context.signal.aborted) throw createAbortError()
      await consumer(record)
    }
  },
})

/** Creates a renderer-neutral source descriptor materialized by the client-tool runtime. */
export const createAiClientToolArtifact = <TPreview>(
  options: AiClientToolArtifactOptions<TPreview>,
): AiClientToolArtifact<TPreview> => {
  const { recordPath, ...artifactOptions } = options
  const normalizedRecordPath = recordPath === undefined
    ? undefined
    : normalizeAiClientToolRecordPath(recordPath)
  return {
    kind: ARTIFACT_KIND,
    ...artifactOptions,
    ...(normalizedRecordPath ? { recordPath: normalizedRecordPath } : {}),
    executionId: String(options.executionId || createExecutionId()),
  }
}

const isArtifact = (value: unknown): value is AiClientToolArtifact<unknown> => (
  isRecord(value)
  && value.kind === ARTIFACT_KIND
  && typeof value.mimeType === 'string'
  && 'content' in value
  && 'preview' in value
)

const resolveArtifact = (value: unknown) => {
  if (isArtifact(value)) return { artifact: value, envelope: undefined }
  if (isRecord(value) && isArtifact(value.data)) return { artifact: value.data, envelope: value }
  return undefined
}

const artifactSize = (content: ArrayBuffer | Blob | string) => {
  if (content instanceof Blob) return content.size
  if (content instanceof ArrayBuffer) return content.byteLength
  return new TextEncoder().encode(content).byteLength
}

const artifactSourceBytes = async (content: ArrayBuffer | Blob | string) => (
  typeof content === 'string'
    ? new TextEncoder().encode(content)
    : content instanceof Blob
      ? new Uint8Array(await content.arrayBuffer())
      : new Uint8Array(content)
)

const canonicalArtifactSourceBytes = async (
  artifact: Pick<AiClientToolArtifact<unknown>, 'content' | 'mimeType'>,
) => {
  const bytes = await artifactSourceBytes(artifact.content)
  if (!artifact.mimeType.trim().toLowerCase().includes('json')) return bytes
  try {
    const normalized = JSON.stringify(JSON.parse(new TextDecoder().decode(bytes)))
    return normalized === undefined ? bytes : new TextEncoder().encode(normalized)
  } catch {
    return bytes
  }
}

/**
 * Resolves the exact logical JSON source carried by a materialized artifact. Output record paths describe this source,
 * never the transport descriptor that carries it through the client-tool runtime.
 */
export const resolveAiClientToolArtifactLogicalSource = async (value: unknown) => {
  if (!isArtifact(value) || !value.mimeType.trim().toLowerCase().includes('json')) return undefined
  try {
    const bytes = await canonicalArtifactSourceBytes(value)
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return undefined
  }
}

/** Computes the identity of the canonical exact source once, independently from its inline/file carrier. */
const createSha256SourceDigest = async (bytes: Uint8Array) => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return undefined
  try {
    const input = bytes.buffer instanceof ArrayBuffer
      && bytes.byteOffset === 0
      && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer
      : bytes.slice().buffer
    const digest = new Uint8Array(await subtle.digest('SHA-256', input))
    return `sha256:${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return undefined
  }
}

const createArtifactSourceDigest = async (artifact: AiClientToolArtifact<unknown>) => (
  createSha256SourceDigest(await canonicalArtifactSourceBytes(artifact))
)

const modelSafeInlineSource = (
  artifact: AiClientToolArtifact<unknown>,
  maximumBytes = DEFAULT_MAX_INLINE_BYTES,
) => {
  if (artifact.modelSafeInline === undefined || artifact.modelSafeInline === null) return undefined
  try {
    const json = JSON.stringify(artifact.modelSafeInline)
    if (json === undefined) return undefined
    const maxBytes = clampInteger(
      artifact.maxInlineBytes,
      1024,
      DEFAULT_MAX_INLINE_BYTES,
      DEFAULT_MAX_INLINE_BYTES,
    )
    const bytes = new TextEncoder().encode(json).byteLength
    if (bytes > Math.min(maxBytes, Math.max(0, maximumBytes))) return undefined
    let exact = false
    if (typeof artifact.content === 'string') {
      if (artifact.mimeType.toLowerCase().includes('json')) {
        try {
          exact = JSON.stringify(JSON.parse(artifact.content)) === json
        } catch {
          exact = false
        }
      } else if (typeof artifact.modelSafeInline === 'string') {
        exact = artifact.content === artifact.modelSafeInline
      }
    }
    return { source: JSON.parse(json) as unknown, exact, bytes }
  } catch {
    return undefined
  }
}

interface AiClientToolMaterializedDeliveryPolicy {
  audience?: AiClientToolOutputAudience
  required: boolean
  allowFile: boolean
  allowInline: boolean
  requireExactInline: boolean
  inlineBytes: number
  preferInline: boolean
}

const presentationCapabilitiesForOutput = (
  output: AiClientToolResultOutputDefinition,
  capabilities: readonly GeneralAgentMarkdownPresentationCapability[] = [],
) => capabilities.filter(capability => !diagnoseAiClientToolOutputPresentationCompatibility({
  kind: output.type === 'artifact' ? 'artifact' : 'record-set',
  ...output,
}, capability).length)

const resolveMaterializedDeliveryPolicy = (
  output: AiClientToolResultOutputDefinition | undefined,
  capabilities: readonly GeneralAgentMarkdownPresentationCapability[] = [],
): AiClientToolMaterializedDeliveryPolicy => {
  if (!output?.audience) {
    return {
      required: true,
      allowFile: true,
      allowInline: true,
      requireExactInline: false,
      inlineBytes: DEFAULT_MAX_INLINE_BYTES,
      preferInline: false,
    }
  }
  if (output.audience === 'model-evidence') {
    return {
      audience: output.audience,
      required: true,
      allowFile: false,
      allowInline: true,
      requireExactInline: false,
      inlineBytes: DEFAULT_MAX_INLINE_BYTES,
      preferInline: true,
    }
  }
  if (output.audience === 'reusable-source') {
    return {
      audience: output.audience,
      required: true,
      allowFile: output.delivery !== 'inline',
      allowInline: output.delivery === 'inline',
      requireExactInline: true,
      inlineBytes: DEFAULT_MAX_INLINE_BYTES,
      preferInline: output.delivery === 'inline',
    }
  }
  const compatible = presentationCapabilitiesForOutput(output, capabilities)
  const requiredCapabilities = compatible.filter(capability => capability.deliveryPolicy === 'required')
  const active = requiredCapabilities.length ? requiredCapabilities : compatible
  const inlineLimits = active.map(capability => Number(capability.maxInlineBytes) || 0)
  return {
    audience: output.audience,
    required: requiredCapabilities.length > 0 || compatible.length === 0,
    allowFile: active.length > 0 && active.every(capability => capability.supportsSessionFile === true),
    allowInline: active.length > 0 && inlineLimits.every(limit => limit > 0),
    requireExactInline: true,
    inlineBytes: inlineLimits.length ? Math.min(...inlineLimits) : 0,
    preferInline: output.delivery !== 'file',
  }
}

const artifactFallback = <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  size: number,
  failure: Pick<AiClientToolArtifactDeliveryData<TPreview>, 'fileUnavailable' | 'fileErrorCode' | 'limitReason'>,
  policy: AiClientToolMaterializedDeliveryPolicy,
  sourceDigest?: string,
): AiClientToolArtifactDeliveryData<TPreview> => {
  const inline = policy.allowInline
    ? modelSafeInlineSource(artifact, policy.inlineBytes)
    : undefined
  if (inline
    && (!policy.requireExactInline || inline.exact)
    && (!policy.requireExactInline || !!sourceDigest)) {
    return {
      producedFile: false,
      delivery: 'inline',
      preview: artifact.preview,
      source: inline.source,
      mimeType: artifact.mimeType,
      size,
      ...(policy.audience ? { audience: policy.audience } : {}),
      required: policy.required,
      satisfied: true,
      sourceExact: inline.exact,
      ...(inline.exact && sourceDigest ? { sourceDigest } : {}),
      ...failure,
    }
  }
  return {
    producedFile: false,
    delivery: 'bounded-preview',
    preview: artifact.preview,
    mimeType: artifact.mimeType,
    size,
    ...(policy.audience ? { audience: policy.audience } : {}),
    required: policy.required,
    satisfied: false,
    sourceExact: false,
    ...failure,
  }
}

const materializeArtifact = async <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  options: DeliverAiClientToolResultOptions,
  output?: AiClientToolResultOutputDefinition,
  sourceBackingPolicy?: AiClientToolMaterializedDeliveryPolicy,
): Promise<AiClientToolArtifactDeliveryData<TPreview>> => {
  const mode = output?.delivery || options.resultDelivery || 'auto'
  const policy = sourceBackingPolicy || resolveMaterializedDeliveryPolicy(output, options.call.presentationCapabilities)
  const files = policy.allowFile ? resolveSessionFiles(mode, options.call.sessionFiles) : undefined
  const maxBytes = clampInteger(artifact.maxBytes, 1024, 10 * 1024 * 1024, DEFAULT_MAX_BYTES)
  const size = artifactSize(artifact.content)
  const sourceDigest = policy.requireExactInline || policy.allowFile
    ? await createArtifactSourceDigest(artifact)
    : undefined
  const path = createAiClientToolArtifactPath(
    options.call.toolName,
    artifact.executionId,
    artifact.fileExtension,
  )
  if (options.call.signal?.aborted) throw createAbortError()
  if (policy.requireExactInline && !sourceDigest) {
    return artifactFallback(artifact, size, {}, policy)
  }
  if (policy.preferInline) {
    const inline = artifactFallback(artifact, size, {}, policy, sourceDigest)
    if (inline.delivery === 'inline') return inline
  }
  if (!files || size > maxBytes) {
    return artifactFallback(artifact, size, {
      fileUnavailable: policy.allowFile && !files ? true : undefined,
      limitReason: size > maxBytes ? 'bytes' : undefined,
    }, policy, sourceDigest)
  }
  // Freeze mutable ArrayBuffer content so the hashed bytes are the exact bytes passed to the upload owner.
  const uploadContent = artifact.content instanceof ArrayBuffer ? artifact.content.slice(0) : artifact.content
  const uploadedDigest = await createSha256SourceDigest(await artifactSourceBytes(uploadContent))
  if (policy.requireExactInline && !uploadedDigest) {
    return artifactFallback(artifact, size, {}, policy, sourceDigest)
  }
  let deliveryState: SessionFileDeliveryState = 'not-started'
  try {
    deliveryState = 'unknown'
    const uploaded = await files.upload(path, uploadContent, {
      maxBytes,
      signal: options.call.signal,
    })
    deliveryState = 'opened'
    if (options.call.signal?.aborted) throw createAbortError()
    if (uploaded?.ok === false) throw new Error('session file upload was rejected')
    const fileRef = uploaded?.uri || files.toUri(path)
    if (sourceBackingPolicy && (!fileRef?.startsWith('fs://') || fileRef !== files.toUri(path))) {
      throw new Error('session source upload returned a different reference')
    }
    deliveryState = 'committed'
    return {
      producedFile: true,
      delivery: 'session-file' as const,
      preview: artifact.preview,
      mimeType: artifact.mimeType,
      size: Number.isFinite(uploaded?.size) ? Number(uploaded.size) : size,
      path,
      fileRef,
      ...(policy.audience ? { audience: policy.audience } : {}),
      required: policy.required,
      satisfied: true,
      sourceExact: true,
      ...(uploadedDigest ? { sourceDigest: uploadedDigest, sourceDigestProfile: 'bytes-v1' as const } : {}),
    }
  } catch (error) {
    deliveryState = await cleanupPartialFile(files, path, deliveryState)
    if (options.call.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw createAbortError()
    }
    return artifactFallback(artifact, size, {
      fileUnavailable: true,
      fileErrorCode: 'CLIENT_TOOL_FILE_WRITE_FAILED' as const,
    }, policy, sourceDigest)
  }
}

const materializeRecordStream = async <T>(
  stream: AiClientToolRecordStream<T>,
  options: DeliverAiClientToolResultOptions,
  output?: AiClientToolResultOutputDefinition,
): Promise<AiClientToolRecordDeliveryData<T>> => {
  const mode = output?.delivery || options.resultDelivery || 'auto'
  const policy = resolveMaterializedDeliveryPolicy(output, options.call.presentationCapabilities)
  const files = policy.allowFile ? resolveSessionFiles(mode, options.call.sessionFiles) : undefined
  const path = stream.path || createAiClientToolResultPath(options.call.toolName)
  const limits = stream.limits || {}
  const chunkBytes = clampInteger(limits.chunkBytes, 64 * 1024, 1024 * 1024, DEFAULT_CHUNK_BYTES)
  const maxBytes = clampInteger(limits.maxBytes, chunkBytes, 10 * 1024 * 1024, DEFAULT_MAX_BYTES)
  const maxRecords = clampInteger(limits.maxRecords, 1, DEFAULT_MAX_RECORDS, DEFAULT_MAX_RECORDS)
  const maxDurationMs = clampInteger(limits.maxDurationMs, 1000, 60_000, DEFAULT_MAX_DURATION_MS)
  const maxRowBytes = clampInteger(limits.maxRowBytes, 1024, chunkBytes, DEFAULT_MAX_ROW_BYTES)
  const previewLimit = clampInteger(limits.previewLimit, 0, 10, DEFAULT_PREVIEW_LIMIT)
  const fallbackSampleLimit = clampInteger(
    limits.fallbackSampleLimit,
    1,
    20,
    DEFAULT_FALLBACK_SAMPLE_LIMIT,
  )
  const retainedSampleLimit = Math.max(previewLimit, fallbackSampleLimit)
  const encoder = new TextEncoder()
  const factCollector = createAiClientToolRecordFactCollector(stream.schema)
  const retainedSamples: T[] = []
  const inlineRecords: T[] = []
  const sourceLines: string[] = []
  let pendingLines: string[] = []
  let pendingBytes = 0
  let totalBytes = 0
  let count = 0
  let uploaded = false
  let inlineCandidate = !!output?.audience
    && policy.allowInline
    && (policy.preferInline || !files)
  let usingFile = !!files && !inlineCandidate
  let deliveryState: SessionFileDeliveryState = 'not-started'
  let sourceCompleted = false
  let timedOut = false
  let limitReason: AiClientToolRecordLimitReason | undefined
  let fileErrorCode: AiClientToolRecordDeliveryData<T>['fileErrorCode']
  let externalAbort = false

  // Internal collection limits stop only the source. Caller cancellation must additionally stop in-flight uploads.
  const sourceController = new AbortController()
  const uploadController = new AbortController()
  const abortFromCaller = () => {
    externalAbort = true
    sourceController.abort()
    uploadController.abort()
  }
  if (options.call.signal?.aborted) abortFromCaller()
  else options.call.signal?.addEventListener('abort', abortFromCaller, { once: true })

  const flush = async () => {
    if (!files || !usingFile || !pendingLines.length) return
    const payload = new Blob(pendingLines, { type: NDJSON_MIME_TYPE })
    pendingLines = []
    pendingBytes = 0
    deliveryState = 'unknown'
    try {
      const result = await files.upload(path, payload, {
        append: uploaded,
        maxBytes,
        signal: uploadController.signal,
      })
      if (result?.ok === false) throw new Error('session file upload was rejected')
    } catch (error) {
      throw new RecordFileWriteError(error)
    }
    uploaded = true
    deliveryState = 'opened'
  }

  const switchToFile = async () => {
    if (!files || usingFile) return
    usingFile = true
    inlineCandidate = false
    inlineRecords.length = 0
    pendingLines = [...sourceLines]
    pendingBytes = totalBytes
    if (pendingBytes >= chunkBytes) await flush()
  }

  const accept = async (row: T) => {
    if (externalAbort || sourceController.signal.aborted) throw createAbortError()
    if (count >= maxRecords) throw new RecordDeliveryLimitError('records')
    if (!usingFile && !inlineCandidate && policy.required && count >= fallbackSampleLimit) {
      throw new RecordDeliveryLimitError('sample')
    }

    const serialized = JSON.stringify(row)
    if (serialized === undefined) {
      const error = new Error('client tool record is not serializable') as Error & { code?: string }
      error.code = 'CLIENT_TOOL_RECORD_INVALID'
      throw error
    }
    const line = `${serialized}\n`
    const rowBytes = encoder.encode(line).byteLength
    if (rowBytes > maxRowBytes) throw new RecordDeliveryLimitError('rowBytes')
    if (totalBytes + rowBytes > maxBytes) throw new RecordDeliveryLimitError('bytes')
    if (inlineCandidate && totalBytes + rowBytes > policy.inlineBytes) {
      if (files) await switchToFile()
      else if (policy.required) throw new RecordDeliveryLimitError('bytes')
      else {
        inlineCandidate = false
        inlineRecords.length = 0
      }
    }

    factCollector.accept(row)
    if (retainedSamples.length < retainedSampleLimit) retainedSamples.push(row)
    if (inlineCandidate) inlineRecords.push(row)
    sourceLines.push(line)
    count += 1
    totalBytes += rowBytes
    if (usingFile) {
      pendingLines.push(line)
      pendingBytes += rowBytes
      if (pendingBytes >= chunkBytes) await flush()
    }
  }

  const sourceTimeout = setTimeout(() => {
    timedOut = true
    sourceController.abort()
  }, maxDurationMs)

  try {
    if (externalAbort) throw createAbortError()
    try {
      await stream.source.consume(accept, { signal: sourceController.signal })
      sourceCompleted = true
    } catch (error) {
      if (externalAbort) throw createAbortError()
      if (timedOut) {
        limitReason = 'duration'
      } else if (error instanceof RecordDeliveryLimitError) {
        limitReason = error.reason
      } else if (error instanceof RecordFileWriteError) {
        fileErrorCode = error.code
      } else {
        throw error
      }
    } finally {
      clearTimeout(sourceTimeout)
    }

    if (externalAbort) throw createAbortError()
    const profile = factCollector.snapshot()

    // Released legacy streams historically keep an empty result inline without opening a file.
    if (!output?.audience && sourceCompleted && count === 0 && !limitReason && !fileErrorCode) {
      usingFile = false
      inlineCandidate = true
    }

    if (usingFile && files && !fileErrorCode) {
      try {
        await flush()
        if (externalAbort) throw createAbortError()
        if (sourceCompleted && count === 0 && !uploaded) {
          deliveryState = 'unknown'
          const result = await files.upload(path, new Blob([], { type: NDJSON_MIME_TYPE }), {
            maxBytes,
            signal: uploadController.signal,
          })
          if (result?.ok === false) throw new RecordFileWriteError(
            new Error('session file upload was rejected'),
          )
          uploaded = true
          deliveryState = 'opened'
        }
        if (uploaded) {
          let fileRef: string
          try {
            fileRef = files.toUri(path)
          } catch (error) {
            throw new RecordFileWriteError(error)
          }
          deliveryState = 'committed'
          const sourceExact = sourceCompleted && !limitReason
          const sourceDigest = sourceExact
            ? await createSha256SourceDigest(new Uint8Array(await new Blob(sourceLines).arrayBuffer()))
            : undefined
          const exactIdentityRequired = policy.audience === 'client-presentation'
            || policy.audience === 'reusable-source'
          const satisfied = sourceExact && (!exactIdentityRequired || !!sourceDigest)
          const exhaustive = stream.exhaustive ?? sourceExact
          const displayTruncated = stream.displayTruncated ?? !!limitReason
          const requestSatisfied = stream.requestSatisfied
            ?? (sourceExact && (satisfied || !policy.required))
          return createDeliveryData({
            producedFile: true,
            delivery: 'session-file',
            path,
            fileRef,
            size: totalBytes,
            count,
            schema: stream.schema,
            timeRange: stream.timeRange,
            observedRange: profile.observedRange,
            facts: profile.facts,
            sample: retainedSamples.slice(0, previewLimit),
            complete: requestSatisfied,
            truncated: displayTruncated,
            requestSatisfied,
            exhaustive,
            displayTruncated,
            limitReason,
            ...(policy.audience ? { audience: policy.audience } : {}),
            required: policy.required,
            satisfied,
            sourceExact: satisfied,
            ...(satisfied && sourceDigest ? { sourceDigest, sourceDigestProfile: 'bytes-v1' as const } : {}),
          })
        }
      } catch (error) {
        if (externalAbort) throw createAbortError()
        if (error instanceof RecordFileWriteError) fileErrorCode = error.code
        else throw error
      }
    }

    deliveryState = await cleanupPartialFile(files, path, deliveryState)
    const producerComplete = sourceCompleted && !limitReason
    const fallbackInlineExact = producerComplete
      && policy.allowInline
      && totalBytes <= policy.inlineBytes
      && retainedSamples.length >= count
    const inlineValues = inlineCandidate
      ? inlineRecords
      : fallbackInlineExact
        ? retainedSamples
        : retainedSamples.slice(0, fallbackSampleLimit)
    const sourceExact = producerComplete
      && (inlineCandidate || fallbackInlineExact)
      && inlineValues.length === count
    const sourceDigest = sourceExact
      ? await createSha256SourceDigest(new Uint8Array(await new Blob(sourceLines).arrayBuffer()))
      : undefined
    const exactIdentityRequired = policy.audience === 'client-presentation'
      || policy.audience === 'reusable-source'
    const satisfied = !policy.audience
      ? producerComplete && retainedSamples.length >= count
      : policy.audience === 'model-evidence'
      ? producerComplete && inlineCandidate
      : sourceExact && (!exactIdentityRequired || !!sourceDigest)
    const requestSatisfied = stream.requestSatisfied ?? (producerComplete && (satisfied || !policy.required))
    const exhaustive = stream.exhaustive ?? producerComplete
    const displayTruncated = stream.displayTruncated ?? (!!limitReason || (!sourceExact && count > 0))
    const complete = requestSatisfied
    const fallbackLimitReason = complete || (producerComplete && !policy.required)
      ? undefined
      : (limitReason || (count > retainedSamples.length ? 'sample' : undefined))
    const unavailable = policy.allowFile && (!files || !!fileErrorCode)
    return createDeliveryData({
      producedFile: false,
      delivery: 'inline-sample',
      size: totalBytes,
      count,
      schema: stream.schema,
      timeRange: stream.timeRange,
      observedRange: profile.observedRange,
      facts: profile.facts,
      sample: inlineValues,
      complete,
      truncated: displayTruncated,
      requestSatisfied,
      exhaustive,
      displayTruncated,
      limitReason: fallbackLimitReason,
      fileUnavailable: unavailable,
      fileErrorCode: fileErrorCode || (unavailable ? 'CLIENT_TOOL_FILE_UNAVAILABLE' : undefined),
      ...(policy.audience ? { audience: policy.audience } : {}),
      required: policy.required,
      satisfied,
      sourceExact: satisfied,
      ...(satisfied && sourceDigest ? { sourceDigest } : {}),
    })
  } catch (error) {
    deliveryState = await cleanupPartialFile(files, path, deliveryState)
    throw error
  } finally {
    clearTimeout(sourceTimeout)
    if (options.call.signal) options.call.signal.removeEventListener('abort', abortFromCaller)
  }
}

const mergeDeliveryResult = <T>(
  stream: AiClientToolRecordStream<T>,
  envelope: JsonRecord | undefined,
  data: AiClientToolRecordDeliveryData<T>,
  binding: {
    name: string
    label?: string
    type?: string
    shape: string
    audience?: AiClientToolOutputAudience
  },
) => {
  const originalSummary = isRecord(envelope?.summary) ? envelope.summary : {}
  const declaredEvidence = isRecord(envelope?.evidence) ? envelope.evidence : {}
  const artifacts: AiClientToolArtifactReference[] = data.producedFile && data.fileRef
    ? [{
        uri: data.fileRef,
        ...(data.path ? { path: data.path, fileName: data.path.split('/').filter(Boolean).pop() } : {}),
        mimeType: data.mimeType,
        size: data.size,
      }]
    : []
  const bindingName = binding.name
  const outputShape = binding.shape
  const bindingRequestedRange = stream.timeRange || (isRecord(declaredEvidence.requestedRange)
    ? declaredEvidence.requestedRange
    : undefined)
  const bindingObservedRange = data.observedRange || (isRecord(declaredEvidence.observedRange)
    ? declaredEvidence.observedRange
    : undefined)
  const bindingFields = stream.fields?.length
    ? stream.fields.map(field => ({ ...field }))
    : collectAiClientToolSemanticFields(stream.schema).map(field => ({
        name: field.path,
        semanticRole: field.role,
        ...(field.label ? { label: field.label } : {}),
        ...(field.format ? { format: field.format } : {}),
        ...(field.measure ? { measure: field.measure } : {}),
        ...(field.unit ? { unit: field.unit } : {}),
        ...(field.aggregation ? { aggregation: field.aggregation } : {}),
      }))
  const exactIdentityRequired = binding.audience === 'client-presentation'
    || binding.audience === 'reusable-source'
  const bindableFile = data.producedFile
    && !!data.fileRef
    && (!exactIdentityRequired || data.sourceExact === true)
  const bindableInline = !data.producedFile
    && (binding.audience === 'model-evidence'
      || !exactIdentityRequired
      || data.sourceExact === true)
  const outputBindings: AiClientToolOutputBinding[] = bindableFile
    ? [{
      name: bindingName,
      ...(binding.type ? { type: binding.type } : {}),
        ...(binding.audience ? { audience: binding.audience } : {}),
        ...(data.sourceDigest ? { sourceDigest: data.sourceDigest } : {}),
        ...(data.sourceDigestProfile ? { sourceDigestProfile: data.sourceDigestProfile } : {}),
        ...(binding.label ? { label: binding.label } : {}),
        ref: data.fileRef,
        shape: outputShape,
        mediaType: data.mimeType,
        recordCount: data.count,
        complete: data.complete,
        truncated: data.truncated,
        ...(data.requestSatisfied !== undefined ? { requestSatisfied: data.requestSatisfied } : {}),
        ...(data.exhaustive !== undefined ? { exhaustive: data.exhaustive } : {}),
        ...(data.displayTruncated !== undefined ? { displayTruncated: data.displayTruncated } : {}),
        ...(bindingRequestedRange ? { requestedRange: bindingRequestedRange } : {}),
        ...(bindingObservedRange ? { observedRange: bindingObservedRange } : {}),
        coverage: {
          complete: data.complete,
          truncated: data.truncated,
          returned: data.count,
        },
        ...(bindingFields.length ? { fields: bindingFields } : {}),
        ...(stream.ordering ? { ordering: stream.ordering } : {}),
      }]
    : bindableInline
      ? [{
      name: bindingName,
      ...(binding.type ? { type: binding.type } : {}),
        ...(binding.audience ? { audience: binding.audience } : {}),
        ...(data.sourceDigest ? { sourceDigest: data.sourceDigest } : {}),
        ...(binding.label ? { label: binding.label } : {}),
        path: '$.data.sample',
        shape: outputShape,
        mediaType: 'application/json',
        recordCount: data.sample.length,
        complete: data.complete,
        truncated: data.truncated,
        ...(data.requestSatisfied !== undefined ? { requestSatisfied: data.requestSatisfied } : {}),
        ...(data.exhaustive !== undefined ? { exhaustive: data.exhaustive } : {}),
        ...(data.displayTruncated !== undefined ? { displayTruncated: data.displayTruncated } : {}),
        ...(bindingRequestedRange ? { requestedRange: bindingRequestedRange } : {}),
        ...(bindingObservedRange ? { observedRange: bindingObservedRange } : {}),
        coverage: {
          complete: data.complete,
          truncated: data.truncated,
          returned: data.sample.length,
        },
        ...(bindingFields.length ? { fields: bindingFields } : {}),
        ...(stream.ordering ? { ordering: stream.ordering } : {}),
      }]
      : []
  const status = !data.complete
    ? 'partial'
    : data.count === 0
      ? 'empty'
      : String(envelope?.status || 'ok')
  const result = {
    ...(envelope || {}),
    status,
    ...(stream.timeRange && !envelope?.timeRange ? { timeRange: stream.timeRange } : {}),
    ...(data.observedRange ? { observedRange: data.observedRange } : {}),
    ...(data.facts ? { facts: data.facts } : {}),
    summary: {
      ...originalSummary,
      ...(stream.summary || {}),
      count: data.count,
      delivery: data.delivery,
      complete: data.complete,
      ...(data.limitReason ? { limitReason: data.limitReason } : {}),
      ...(data.fileUnavailable ? { fileUnavailable: true } : {}),
      ...(data.fileErrorCode ? { fileErrorCode: data.fileErrorCode } : {}),
    },
    data,
    total: data.count,
    truncated: data.truncated,
    producedFile: data.producedFile,
    ...(data.path ? { path: data.path } : {}),
    ...(data.fileRef ? { fileRef: data.fileRef } : {}),
    ...(data.fileRef ? { contentRef: data.fileRef } : {}),
    ...(data.producedFile ? { mimeType: data.mimeType, size: data.size } : {}),
  }
  return withAiClientToolEvidence(result, {
    requestedRange: stream.timeRange || (isRecord(declaredEvidence.requestedRange)
      ? declaredEvidence.requestedRange
      : undefined),
    observedRange: data.observedRange || (isRecord(declaredEvidence.observedRange)
      ? declaredEvidence.observedRange
      : undefined),
    recordCount: data.count,
    returnedCount: data.producedFile ? data.count : data.sample.length,
    complete: data.complete,
    truncated: data.truncated,
    requestSatisfied: data.requestSatisfied,
    exhaustive: data.exhaustive,
    displayTruncated: data.displayTruncated,
    limitReason: data.limitReason,
    resultStatus: status,
    facts: {
      ...(isRecord(declaredEvidence.facts) ? declaredEvidence.facts : {}),
      ...(data.facts || {}),
    },
    claims: Array.isArray(declaredEvidence.claims)
      ? declaredEvidence.claims as AiClientToolClaim[]
      : undefined,
    evidenceCoverage: typeof declaredEvidence.evidenceCoverage === 'string'
      ? declaredEvidence.evidenceCoverage
      : undefined,
    supportsAbsenceClaim: typeof declaredEvidence.supportsAbsenceClaim === 'boolean'
      ? declaredEvidence.supportsAbsenceClaim
      : undefined,
    warnings: [
      ...(Array.isArray(declaredEvidence.warnings) ? declaredEvidence.warnings : []),
      ...(Array.isArray(envelope?.warnings) ? envelope.warnings : []),
    ].map(value => String(value)),
    artifacts,
    datasets: Array.isArray(declaredEvidence.datasets)
      ? declaredEvidence.datasets.map(value => String(value))
      : undefined,
    outputBindings,
  })
}

const resolveRecordStreamBinding = <T>(
  stream: AiClientToolRecordStream<T>,
  options: DeliverAiClientToolResultOptions,
) => {
  const declaredBindingName = String(stream.bindingName || '').trim()
  const declaredBindingLabel = String(stream.bindingLabel || '').trim()
  const expectedBindingName = String(options.bindingName || '').trim()
  const declaredOutputShape = String(stream.outputShape || '').trim()
  const expectedOutputShape = String(options.outputShape || '').trim()
  const output = resolveMaterializedOutput(options.outputs, declaredBindingName, declaredOutputShape)
  if (declaredBindingName && expectedBindingName && declaredBindingName !== expectedBindingName) {
    throw Object.assign(new Error('record stream binding does not match tool routing'), {
      code: 'CLIENT_TOOL_BINDING_MISMATCH',
    })
  }
  if (declaredOutputShape && expectedOutputShape && declaredOutputShape !== expectedOutputShape) {
    throw Object.assign(new Error('record stream output shape does not match tool routing'), {
      code: 'CLIENT_TOOL_OUTPUT_SHAPE_MISMATCH',
    })
  }
  return {
    name: declaredBindingName || output?.name || expectedBindingName || 'records',
    ...(output?.type || options.outputType ? { type: output?.type || options.outputType } : {}),
    ...(declaredBindingLabel ? { label: declaredBindingLabel } : {}),
    shape: declaredOutputShape || output?.shape || expectedOutputShape || 'tabular.records',
    ...(output?.audience ? { audience: output.audience } : {}),
    output,
  }
}

const resolveMaterializedOutput = (
  outputs: readonly AiClientToolResultOutputDefinition[] | undefined,
  bindingName: string,
  outputShape: string,
) => {
  if (!outputs?.length) return undefined
  const candidates = bindingName
    ? outputs.filter(output => output.name === bindingName)
    : outputShape
      ? outputs.filter(output => output.shape === outputShape)
      : outputs.length === 1 ? [...outputs] : []
  if (candidates.length !== 1) {
    throw Object.assign(new Error('materialized result cannot be bound to one canonical output'), {
      code: candidates.length ? 'CLIENT_TOOL_BINDING_AMBIGUOUS' : 'CLIENT_TOOL_BINDING_MISMATCH',
    })
  }
  return candidates[0]
}

const resolveArtifactBinding = <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  options: DeliverAiClientToolResultOptions,
) => {
  const declaredBindingName = String(artifact.bindingName || '').trim()
  const declaredBindingLabel = String(artifact.bindingLabel || '').trim()
  const expectedBindingName = String(options.bindingName || '').trim()
  const declaredOutputShape = String(artifact.outputShape || '').trim()
  const expectedOutputShape = String(options.outputShape || '').trim()
  const output = resolveMaterializedOutput(options.outputs, declaredBindingName, declaredOutputShape)
  if (declaredBindingName && expectedBindingName && declaredBindingName !== expectedBindingName) {
    throw Object.assign(new Error('artifact binding does not match tool routing'), {
      code: 'CLIENT_TOOL_BINDING_MISMATCH',
    })
  }
  if (declaredOutputShape && expectedOutputShape && declaredOutputShape !== expectedOutputShape) {
    throw Object.assign(new Error('artifact output shape does not match tool routing'), {
      code: 'CLIENT_TOOL_OUTPUT_SHAPE_MISMATCH',
    })
  }
  if (output && artifact.mimeType.trim().toLowerCase() !== output.mediaType.trim().toLowerCase()) {
    throw Object.assign(new Error('artifact media type does not match canonical output'), {
      code: 'CLIENT_TOOL_OUTPUT_MEDIA_TYPE_MISMATCH',
    })
  }
  return {
    name: declaredBindingName || output?.name || expectedBindingName || 'artifact',
    ...(output?.type || options.outputType ? { type: output?.type || options.outputType } : {}),
    ...(declaredBindingLabel ? { label: declaredBindingLabel } : {}),
    shape: declaredOutputShape || output?.shape || expectedOutputShape || 'artifact',
    ...(output?.audience ? { audience: output.audience } : {}),
    output,
  }
}

const mergeArtifactResult = <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  envelope: JsonRecord | undefined,
  delivery: AiClientToolArtifactDeliveryData<TPreview>,
  binding: {
    name: string
    label?: string
    type?: string
    shape: string
    audience?: AiClientToolOutputAudience
  },
) => {
  const declaredEvidence = isRecord(envelope?.evidence) ? envelope.evidence : {}
  const recordPath = artifact.recordPath === undefined
    ? undefined
    : normalizeAiClientToolRecordPath(artifact.recordPath)
  const originalSummary = isRecord(envelope?.summary) ? envelope.summary : {}
  const preview = isRecord(delivery.preview) ? delivery.preview : { preview: delivery.preview }
  const cardinality = normalizeAiClientToolCardinality(artifact.cardinality)
  const recordSet = cardinality?.kind === 'record-set' ? cardinality : undefined
  const sourcePreview = cardinality?.kind === 'preview' ? cardinality : undefined
  const aggregate = cardinality?.kind === 'aggregate-series' ? cardinality : undefined
  const recordCount = recordSet?.recordCount
  const totalCount = recordSet?.totalCount ?? sourcePreview?.totalCount
  const sourceComplete = artifact.complete !== false && artifact.truncated !== true
  const inlineSourceAvailable = delivery.delivery === 'inline' && delivery.source !== undefined
  const bindableInlineSource = inlineSourceAvailable && delivery.sourceExact !== false
  const sourceEmpty = recordSet?.totalCount === 0
    || (sourcePreview?.displayedCount === 0 && sourcePreview.totalCount === 0)
    || aggregate?.measurementCount === 0
  const requestSatisfied = artifact.requestSatisfied ?? (sourceComplete && (
    delivery.satisfied === true
    || delivery.required === false
  ))
  const exhaustive = artifact.exhaustive ?? sourceComplete
  const displayTruncated = artifact.displayTruncated ?? artifact.truncated === true
  const complete = requestSatisfied
  const truncated = displayTruncated
  const displayedCount = sourcePreview?.displayedCount
  const returnedCount = recordSet?.returnedCount ?? displayedCount
  const modelSample = artifact.modelSample ?? sourcePreview?.modelSample
  const materializedOutputBindings: AiClientToolOutputBinding[] = delivery.producedFile && delivery.fileRef
    ? [{
        name: binding.name,
        ...(binding.type ? { type: binding.type } : {}),
        ...(binding.label ? { label: binding.label } : {}),
        ...(binding.audience ? { audience: binding.audience } : {}),
        ...(delivery.sourceDigest ? { sourceDigest: delivery.sourceDigest } : {}),
        ...(delivery.sourceDigestProfile ? { sourceDigestProfile: delivery.sourceDigestProfile } : {}),
        ref: delivery.fileRef,
        ...(delivery.path ? { path: delivery.path } : {}),
        ...(recordPath ? { recordPath } : {}),
        shape: binding.shape,
        mediaType: artifact.mimeType,
        ...(recordCount === undefined ? {} : { recordCount }),
        ...(totalCount === undefined ? {} : { totalCount }),
        ...(displayedCount === undefined ? {} : { displayedCount }),
        complete,
        truncated,
        requestSatisfied,
        exhaustive,
        displayTruncated,
        ...(artifact.fields?.length ? { fields: artifact.fields.map(field => ({ ...field })) } : {}),
        ...(artifact.ordering ? { ordering: artifact.ordering } : {}),
      }]
    : bindableInlineSource
      ? [{
          name: binding.name,
          ...(binding.type ? { type: binding.type } : {}),
          ...(binding.label ? { label: binding.label } : {}),
          ...(binding.audience ? { audience: binding.audience } : {}),
          ...(delivery.sourceDigest ? { sourceDigest: delivery.sourceDigest } : {}),
          path: '$.data.presentationSource',
          ...(recordPath ? { recordPath } : {}),
          shape: binding.shape,
          mediaType: artifact.mimeType,
          ...(recordCount === undefined ? {} : { recordCount }),
          ...(totalCount === undefined ? {} : { totalCount }),
          ...(displayedCount === undefined ? {} : { displayedCount }),
          complete,
          truncated,
          requestSatisfied,
          exhaustive,
          displayTruncated,
          ...(artifact.fields?.length ? { fields: artifact.fields.map(field => ({ ...field })) } : {}),
          ...(artifact.ordering ? { ordering: artifact.ordering } : {}),
        }]
      : []
  // Materialized presentation is an additional carrier; preserve producer-authored invocation bindings first.
  const existingBindingNames = new Set<string>()
  const existingOutputBindings = normalizeAiClientToolOutputBindings([
    ...(Array.isArray(declaredEvidence.outputBindings) ? declaredEvidence.outputBindings : []),
    ...(Array.isArray(envelope?.outputBindings) ? envelope.outputBindings : []),
  ] as AiClientToolOutputBinding[]).filter((existingBinding) => {
    if (existingBindingNames.has(existingBinding.name)) return false
    existingBindingNames.add(existingBinding.name)
    return true
  })
  const outputBindings = [
    ...existingOutputBindings,
    ...materializedOutputBindings.filter(binding => !existingBindingNames.has(binding.name)),
  ]
  const artifacts: AiClientToolArtifactReference[] = delivery.producedFile && delivery.fileRef
    ? [{
        uri: delivery.fileRef,
        ...(delivery.path ? {
          path: delivery.path,
          fileName: delivery.path.split('/').filter(Boolean).pop(),
        } : {}),
        mimeType: artifact.mimeType,
        size: delivery.size,
      }]
    : []
  const warnings = [
    ...(Array.isArray(declaredEvidence.warnings) ? declaredEvidence.warnings : []),
    ...(Array.isArray(envelope?.warnings) ? envelope.warnings : []),
    ...(delivery.fileUnavailable ? ['CLIENT_TOOL_FILE_UNAVAILABLE'] : []),
    ...(delivery.fileErrorCode ? [delivery.fileErrorCode] : []),
    ...(delivery.limitReason ? [`CLIENT_TOOL_ARTIFACT_LIMIT_${delivery.limitReason.toUpperCase()}`] : []),
  ].map(value => String(value))
  // Empty cardinality grants absence semantics only; it cannot replace a required carrier proof.
  const status = complete
    ? (sourceEmpty ? 'empty' : String(envelope?.status || 'ok'))
    : 'partial'
  const result = {
    ...(envelope || {}),
    status,
    complete,
    truncated,
    requestSatisfied,
    exhaustive,
    displayTruncated,
    summary: {
      ...originalSummary,
      ...(recordCount === undefined ? {} : { count: recordCount }),
      ...(totalCount === undefined ? {} : { totalCount }),
      ...(displayedCount === undefined ? {} : { displayedCount }),
      delivery: delivery.delivery,
      complete,
    },
    data: {
      ...preview,
      ...(recordPath ? { recordPath } : {}),
      ...(inlineSourceAvailable ? { presentationSource: delivery.source } : {}),
      ...(delivery.fileRef ? { fileRef: delivery.fileRef, contentRef: delivery.fileRef } : {}),
    },
    ...(totalCount === undefined ? {} : { total: totalCount }),
    producedFile: delivery.producedFile,
    ...(delivery.path ? { path: delivery.path } : {}),
    ...(delivery.fileRef ? { fileRef: delivery.fileRef, contentRef: delivery.fileRef } : {}),
    mimeType: artifact.mimeType,
    size: delivery.size,
  }
  // Producer-authored coverage axes must survive materialization; legacy complete/truncated are compatibility mirrors.
  return withAiClientToolEvidence(result, {
    requestedRange: artifact.requestedRange || (isRecord(declaredEvidence.requestedRange)
      ? declaredEvidence.requestedRange
      : undefined),
    observedRange: artifact.observedRange || (isRecord(declaredEvidence.observedRange)
      ? declaredEvidence.observedRange
      : undefined),
    recordCount,
    returnedCount,
    totalCount,
    displayedCount,
    cardinality,
    modelSample,
    complete,
    truncated,
    requestSatisfied,
    exhaustive,
    displayTruncated,
    limitReason: delivery.limitReason,
    resultStatus: status,
    evidenceCoverage: typeof declaredEvidence.evidenceCoverage === 'string'
      ? declaredEvidence.evidenceCoverage
      : undefined,
    supportsAbsenceClaim: typeof declaredEvidence.supportsAbsenceClaim === 'boolean'
      ? declaredEvidence.supportsAbsenceClaim
      : undefined,
    facts: {
      ...(isRecord(declaredEvidence.facts) ? declaredEvidence.facts : {}),
      ...(artifact.facts || {}),
      ...(totalCount === undefined ? {} : { totalCount }),
      ...(displayedCount === undefined ? {} : { displayedCount }),
    },
    warnings,
    artifacts,
    outputBindings,
  })
}

const isFailureResult = (value: JsonRecord) => (
  value.success === false
  || value.ok === false
  || (value.error !== undefined && value.error !== null && value.error !== '')
  || (value.errorType !== undefined && value.errorType !== null && value.errorType !== '')
)

/**
 * Publishes declared inline result paths as execution evidence. Paths are metadata supplied by the owning tool;
 * the runtime never guesses business fields from a binding name or tool id.
 */
const attachInlineOutputBindings = (
  result: unknown,
  definitions: AiClientToolResultBindingDefinition[] | undefined,
) => {
  if (!isRecord(result) || isFailureResult(result) || !definitions?.length) return result
  const evidence = isRecord(result.evidence) ? result.evidence : {}
  const complete = result.complete !== false
    && result.truncated !== true
    && String(result.status || '').toLowerCase() !== 'partial'
  const requestSatisfied = typeof result.requestSatisfied === 'boolean'
    ? result.requestSatisfied
    : complete
  const exhaustive = typeof result.exhaustive === 'boolean'
    ? result.exhaustive
    : complete
  const displayTruncated = typeof result.displayTruncated === 'boolean'
    ? result.displayTruncated
    : result.truncated === true
  const declared = normalizeAiClientToolOutputBindings(definitions.flatMap((definition) => {
    const resolved = resolveAiClientToolBindingPath(result, definition.path)
    if (!resolved.resolved) return []
    const selectedCount = resolved.values.length === 1 && Array.isArray(resolved.values[0])
      ? resolved.values[0].length
      : resolved.values.length
    return [{
      ...definition,
      complete: requestSatisfied,
      truncated: displayTruncated,
      requestSatisfied,
      exhaustive,
      displayTruncated,
      recordCount: selectedCount,
    }]
  }))
  const rawExisting = [
    ...(Array.isArray(evidence.outputBindings) ? evidence.outputBindings : []),
    ...(Array.isArray(result.outputBindings) ? result.outputBindings : []),
  ] as AiClientToolOutputBinding[]
  // An explicit runtime binding owns its name even when malformed; weaker static paths cannot rehabilitate it.
  const declaredNames = new Set(rawExisting.filter(isRecord).map(binding => String(binding.name || '').trim()))
  const normalizedExisting = normalizeAiClientToolOutputBindings(rawExisting)
  const names = new Set<string>()
  const existing = normalizedExisting.filter((binding) => {
    if (names.has(binding.name)) return false
    names.add(binding.name)
    return true
  })
  const outputBindings = [
    ...existing,
    ...declared.filter(binding => !declaredNames.has(binding.name)),
  ]
  if (!outputBindings.length) return result
  return {
    ...result,
    outputBindings,
    ...(Object.keys(evidence).length ? {
      evidence: {
        ...evidence,
        outputBindings,
      },
    } : {}),
  }
}

/** Removes one unambiguous property path without mutating producer values or unrelated output siblings. */
const withoutInlineSource = (result: JsonRecord, path: string): JsonRecord => {
  const keys = path.slice(2).split('.')
  const copy: JsonRecord = { ...result }
  let target = copy
  let source = result
  for (const key of keys.slice(0, -1)) {
    const child = source[key] as JsonRecord
    target[key] = { ...child }
    target = target[key] as JsonRecord
    source = child
  }
  delete target[keys[keys.length - 1]]
  return copy
}

/** Backs an explicitly permitted typed source before the reply guard can discard its records. */
const materializeDeclaredStructuredSources = async (
  result: unknown,
  options: DeliverAiClientToolResultOptions,
) => {
  const budget = options.replyMaxJsonLength
  if (!isRecord(result) || isFailureResult(result) || typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0) return result
  let delivered = result
  const bindings = normalizeAiClientToolOutputBindings(result.outputBindings as AiClientToolOutputBinding[])
  for (const binding of bindings) {
    const outputs = options.outputs?.filter(output => output.name === binding.name) || []
    const output = outputs.length === 1 ? outputs[0] : undefined
    const path = binding.path
    if (!output || output.type !== 'structured-data'
      || (output.delivery !== 'auto' && output.delivery !== 'file')
      || binding.type !== output.type || binding.shape !== output.shape
      || binding.mediaType !== output.mediaType || binding.audience !== output.audience
      || !/\bjson\b/i.test(output.mediaType) || !binding.fields?.length
      || binding.ref || !path || !/^\$(?:\.[A-Za-z_][A-Za-z0-9_-]*)+$/.test(path)
      || !normalizeAiClientToolRecordPath(binding.recordPath)
      || bindings.filter(candidate => candidate.name === binding.name).length !== 1
      || bindings.some(candidate => candidate !== binding && candidate.path && (
        candidate.path === path || candidate.path.startsWith(`${path}.`) || path.startsWith(`${candidate.path}.`)
      ))) continue
    if (output.audience !== 'model-evidence'
      && !resolveMaterializedDeliveryPolicy(output, options.call.presentationCapabilities).allowFile) continue
    const selected = resolveAiClientToolBindingPath(delivered, path)
    if (!selected.resolved || selected.values.length !== 1) continue
    const logicalSource = selected.values[0]
    if (!resolveAiClientToolBindingPath(logicalSource, binding.recordPath).resolved) continue
    let content: string | undefined
    try {
      content = JSON.stringify(logicalSource)
    } catch {
      continue
    }
    if (content === undefined || content.length <= budget) continue
    const artifact = createAiClientToolArtifact({
      content,
      mimeType: output.mediaType,
      fileExtension: 'json',
      preview: undefined,
    })
    const digest = await createArtifactSourceDigest(artifact)
    if (!digest || (binding.sourceDigest && binding.sourceDigest !== digest)) continue
    const delivery = await materializeArtifact(artifact, options, output, {
      audience: output.audience,
      required: true,
      allowFile: true,
      allowInline: false,
      requireExactInline: true,
      inlineBytes: 0,
      preferInline: false,
    })
    if (!delivery.sourceExact || !delivery.fileRef || delivery.sourceDigest !== digest) continue
    const { path: inlinePath, ...sourceBinding } = binding
    const backedBinding = { ...sourceBinding, ref: delivery.fileRef, sourceDigest: digest,
      sourceDigestProfile: delivery.sourceDigestProfile }
    const replace = (values: unknown) => Array.isArray(values)
      ? values.map(value => isRecord(value) && value.name === binding.name ? backedBinding : value)
      : values
    delivered = withoutInlineSource(delivered, inlinePath!)
    delivered.outputBindings = replace(delivered.outputBindings)
    if (isRecord(delivered.evidence)) {
      delivered.evidence = {
        ...delivered.evidence,
        ...(Array.isArray(delivered.evidence.outputBindings)
          ? { outputBindings: replace(delivered.evidence.outputBindings) }
          : {}),
      }
    }
  }
  return delivered
}

/** Materializes declared carriers before result guarding and WebSocket reply. */
export const deliverAiClientToolResult = async (
  result: unknown,
  options: DeliverAiClientToolResultOptions,
) => {
  const recordStream = resolveRecordStream(result)
  if (recordStream) {
    const stream = recordStream.stream as AiClientToolRecordStream<unknown>
    const binding = resolveRecordStreamBinding(stream, options)
    const data = await materializeRecordStream(stream, options, binding.output)
    return materializeDeclaredStructuredSources(
      attachInlineOutputBindings(mergeDeliveryResult(stream, recordStream.envelope, data, binding), options.outputBindings),
      options,
    )
  }
  const artifactResult = resolveArtifact(result)
  if (artifactResult) {
    const artifact = artifactResult.artifact as AiClientToolArtifact<unknown>
    const binding = resolveArtifactBinding(artifact, options)
    let delivery = await materializeArtifact(artifact, options, binding.output)
    let delivered = attachInlineOutputBindings(
      mergeArtifactResult(artifact, artifactResult.envelope, delivery, binding), options.outputBindings,
    )
    const policy = resolveMaterializedDeliveryPolicy(binding.output, options.call.presentationCapabilities)
    const mode = binding.output?.delivery || options.resultDelivery || 'auto'
    const budget = options.replyMaxJsonLength
    if (binding.output && mode === 'auto' && policy.preferInline && policy.allowFile
      && delivery.delivery === 'inline' && !delivery.fileUnavailable && !delivery.fileErrorCode
      && typeof budget === 'number' && Number.isFinite(budget) && budget > 0) {
      let exceedsReplyBudget = false
      try {
        // Renderer limits count source UTF-8 bytes; the reply guard counts the complete JSON envelope's characters.
        exceedsReplyBudget = JSON.stringify(delivered).length > budget
      } catch {
        // Serialization failures remain owned by the reply guard, not an implicit file-promotion path.
        exceedsReplyBudget = false
      }
      if (exceedsReplyBudget) {
        // Change only the preference of an already permitted auto output. Keep its policy and upload failure fallback.
        delivery = await materializeArtifact(artifact, options, { ...binding.output, delivery: 'file' })
        delivered = attachInlineOutputBindings(
          mergeArtifactResult(artifact, artifactResult.envelope, delivery, binding), options.outputBindings,
        )
      }
    }
    // A tool may produce one materialized renderer source plus small inline selectors (for example,
    // result ids used by a follow-up query). Materialization must not suppress those declared ports.
    return materializeDeclaredStructuredSources(delivered, options)
  }
  return materializeDeclaredStructuredSources(attachInlineOutputBindings(result, options.outputBindings), options)
}
