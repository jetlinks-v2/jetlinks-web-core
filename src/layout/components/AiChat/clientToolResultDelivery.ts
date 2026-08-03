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
  limitReason?: AiClientToolRecordLimitReason
  fileUnavailable?: boolean
  fileErrorCode?: 'CLIENT_TOOL_FILE_UNAVAILABLE' | 'CLIENT_TOOL_FILE_WRITE_FAILED'
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
}

export interface DeliverAiClientToolResultOptions {
  call: AiClientToolCall
  resultDelivery?: AiClientToolResultDelivery
  /** Single canonical binding declared by the executing tool's routing metadata. */
  bindingName?: string
  /** Single canonical output shape declared by the executing tool's routing metadata. */
  outputShape?: string
  /** Declarative paths for inline values advertised through routing.produces. */
  outputBindings?: AiClientToolResultBindingDefinition[]
}

export interface AiClientToolResultBindingDefinition {
  name: string
  label?: string
  path: string
  shape: string
  mediaType?: string
  fields?: AiClientToolOutputField[]
  ordering?: AiClientToolOrdering
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

const modelSafeInlineSource = (artifact: AiClientToolArtifact<unknown>) => {
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
    if (new TextEncoder().encode(json).byteLength > maxBytes) return undefined
    return JSON.parse(json) as unknown
  } catch {
    return undefined
  }
}

const artifactFallback = <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  size: number,
  failure: Pick<AiClientToolArtifactDeliveryData<TPreview>, 'fileUnavailable' | 'fileErrorCode' | 'limitReason'>,
): AiClientToolArtifactDeliveryData<TPreview> => {
  const source = modelSafeInlineSource(artifact)
  if (source !== undefined) {
    return {
      producedFile: false,
      delivery: 'inline',
      preview: artifact.preview,
      source,
      mimeType: artifact.mimeType,
      size,
      ...failure,
    }
  }
  return {
    producedFile: false,
    delivery: 'bounded-preview',
    preview: artifact.preview,
    mimeType: artifact.mimeType,
    size,
    ...failure,
  }
}

const materializeArtifact = async <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  options: DeliverAiClientToolResultOptions,
): Promise<AiClientToolArtifactDeliveryData<TPreview>> => {
  const mode = options.resultDelivery || 'auto'
  const files = resolveSessionFiles(mode, options.call.sessionFiles)
  const maxBytes = clampInteger(artifact.maxBytes, 1024, 10 * 1024 * 1024, DEFAULT_MAX_BYTES)
  const size = artifactSize(artifact.content)
  const path = createAiClientToolArtifactPath(
    options.call.toolName,
    artifact.executionId,
    artifact.fileExtension,
  )
  if (options.call.signal?.aborted) throw createAbortError()
  if (!files || size > maxBytes) {
    return artifactFallback(artifact, size, {
      fileUnavailable: !files,
      limitReason: size > maxBytes ? 'bytes' : undefined,
    })
  }
  let deliveryState: SessionFileDeliveryState = 'not-started'
  try {
    deliveryState = 'unknown'
    const uploaded = await files.upload(path, artifact.content, {
      maxBytes,
      signal: options.call.signal,
    })
    deliveryState = 'opened'
    if (options.call.signal?.aborted) throw createAbortError()
    if (uploaded?.ok === false) throw new Error('session file upload was rejected')
    const fileRef = uploaded?.uri || files.toUri(path)
    deliveryState = 'committed'
    return {
      producedFile: true,
      delivery: 'session-file' as const,
      preview: artifact.preview,
      mimeType: artifact.mimeType,
      size: Number.isFinite(uploaded?.size) ? Number(uploaded.size) : size,
      path,
      fileRef,
    }
  } catch (error) {
    deliveryState = await cleanupPartialFile(files, path, deliveryState)
    if (options.call.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw createAbortError()
    }
    return artifactFallback(artifact, size, {
      fileUnavailable: true,
      fileErrorCode: 'CLIENT_TOOL_FILE_WRITE_FAILED' as const,
    })
  }
}

const materializeRecordStream = async <T>(
  stream: AiClientToolRecordStream<T>,
  options: DeliverAiClientToolResultOptions,
): Promise<AiClientToolRecordDeliveryData<T>> => {
  const mode = options.resultDelivery || 'auto'
  const files = resolveSessionFiles(mode, options.call.sessionFiles)
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
  let pendingLines: string[] = []
  let pendingBytes = 0
  let totalBytes = 0
  let count = 0
  let uploaded = false
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
    if (!files || !pendingLines.length) return
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

  const accept = async (row: T) => {
    if (externalAbort || sourceController.signal.aborted) throw createAbortError()
    if (count >= maxRecords) throw new RecordDeliveryLimitError('records')
    if (!files && count >= fallbackSampleLimit) throw new RecordDeliveryLimitError('sample')

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

    factCollector.accept(row)
    if (retainedSamples.length < retainedSampleLimit) retainedSamples.push(row)
    count += 1
    totalBytes += rowBytes
    if (files) {
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

    if (sourceCompleted && count === 0 && !limitReason && !fileErrorCode) {
      return createDeliveryData({
        producedFile: false,
        delivery: 'empty',
        size: 0,
        count: 0,
        schema: stream.schema,
        timeRange: stream.timeRange,
        observedRange: profile.observedRange,
        facts: profile.facts,
        sample: [],
        complete: true,
        truncated: false,
      })
    }

    if (files && !fileErrorCode) {
      try {
        await flush()
        if (externalAbort) throw createAbortError()
        if (uploaded) {
          let fileRef: string
          try {
            fileRef = files.toUri(path)
          } catch (error) {
            throw new RecordFileWriteError(error)
          }
          deliveryState = 'committed'
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
            complete: sourceCompleted && !limitReason,
            truncated: !sourceCompleted || !!limitReason,
            limitReason,
          })
        }
      } catch (error) {
        if (externalAbort) throw createAbortError()
        if (error instanceof RecordFileWriteError) fileErrorCode = error.code
        else throw error
      }
    }

    deliveryState = await cleanupPartialFile(files, path, deliveryState)
    const complete = sourceCompleted
      && retainedSamples.length >= count
      && !limitReason
    const fallbackLimitReason = complete
      ? undefined
      : (limitReason || (count > retainedSamples.length ? 'sample' : undefined))
    const unavailable = mode !== 'inline' && (!files || !!fileErrorCode)
    return createDeliveryData({
      producedFile: false,
      delivery: 'inline-sample',
      size: totalBytes,
      count,
      schema: stream.schema,
      timeRange: stream.timeRange,
      observedRange: profile.observedRange,
      facts: profile.facts,
      sample: retainedSamples.slice(0, fallbackSampleLimit),
      complete,
      truncated: !complete,
      limitReason: fallbackLimitReason,
      fileUnavailable: unavailable,
      fileErrorCode: fileErrorCode || (unavailable ? 'CLIENT_TOOL_FILE_UNAVAILABLE' : undefined),
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
  binding: { name: string; label?: string; shape: string },
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
  const outputBindings: AiClientToolOutputBinding[] = data.producedFile && data.fileRef
    ? [{
        name: bindingName,
        ...(binding.label ? { label: binding.label } : {}),
        ref: data.fileRef,
        shape: outputShape,
        mediaType: data.mimeType,
        recordCount: data.count,
        complete: data.complete,
        truncated: data.truncated,
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
    : [{
        name: bindingName,
        ...(binding.label ? { label: binding.label } : {}),
        path: '$.data.sample',
        shape: outputShape,
        mediaType: 'application/json',
        recordCount: data.sample.length,
        complete: data.complete,
        truncated: data.truncated,
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
  const status = data.truncated
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
    name: declaredBindingName || expectedBindingName || 'records',
    ...(declaredBindingLabel ? { label: declaredBindingLabel } : {}),
    shape: declaredOutputShape || expectedOutputShape || 'tabular.records',
  }
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
  return {
    name: declaredBindingName || expectedBindingName || 'artifact',
    ...(declaredBindingLabel ? { label: declaredBindingLabel } : {}),
    shape: declaredOutputShape || expectedOutputShape || 'artifact',
  }
}

const mergeArtifactResult = <TPreview>(
  artifact: AiClientToolArtifact<TPreview>,
  envelope: JsonRecord | undefined,
  delivery: AiClientToolArtifactDeliveryData<TPreview>,
  binding: { name: string; label?: string; shape: string },
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
  const sourceEmpty = recordSet?.totalCount === 0
    || (sourcePreview?.displayedCount === 0 && sourcePreview.totalCount === 0)
    || aggregate?.measurementCount === 0
  const complete = sourceComplete && (delivery.producedFile || inlineSourceAvailable || sourceEmpty)
  const truncated = !complete
  const displayedCount = sourcePreview?.displayedCount
  const returnedCount = recordSet?.returnedCount ?? displayedCount
  const modelSample = artifact.modelSample ?? sourcePreview?.modelSample
  const outputBindings: AiClientToolOutputBinding[] = delivery.producedFile && delivery.fileRef
    ? [{
        name: binding.name,
        ...(binding.label ? { label: binding.label } : {}),
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
        ...(artifact.fields?.length ? { fields: artifact.fields.map(field => ({ ...field })) } : {}),
        ...(artifact.ordering ? { ordering: artifact.ordering } : {}),
      }]
    : inlineSourceAvailable
      ? [{
          name: binding.name,
          ...(binding.label ? { label: binding.label } : {}),
          path: '$.data.presentationSource',
          ...(recordPath ? { recordPath } : {}),
          shape: binding.shape,
          mediaType: artifact.mimeType,
          ...(recordCount === undefined ? {} : { recordCount }),
          ...(totalCount === undefined ? {} : { totalCount }),
          ...(displayedCount === undefined ? {} : { displayedCount }),
          complete,
          truncated,
          ...(artifact.fields?.length ? { fields: artifact.fields.map(field => ({ ...field })) } : {}),
          ...(artifact.ordering ? { ordering: artifact.ordering } : {}),
        }]
      : []
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
  const status = sourceEmpty ? 'empty' : (complete ? String(envelope?.status || 'ok') : 'partial')
  const result = {
    ...(envelope || {}),
    status,
    complete,
    truncated,
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
    limitReason: delivery.limitReason,
    resultStatus: status,
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
  const declared = normalizeAiClientToolOutputBindings(definitions.flatMap((definition) => {
    const resolved = resolveAiClientToolBindingPath(result, definition.path)
    if (!resolved.resolved) return []
    const selectedCount = resolved.values.length === 1 && Array.isArray(resolved.values[0])
      ? resolved.values[0].length
      : resolved.values.length
    return [{
      ...definition,
      complete,
      truncated: !complete,
      recordCount: selectedCount,
    }]
  }))
  const normalizedExisting = normalizeAiClientToolOutputBindings([
    ...(Array.isArray(evidence.outputBindings) ? evidence.outputBindings : []),
    ...(Array.isArray(result.outputBindings) ? result.outputBindings : []),
  ] as AiClientToolOutputBinding[])
  const names = new Set<string>()
  const existing = normalizedExisting.filter((binding) => {
    if (names.has(binding.name)) return false
    names.add(binding.name)
    return true
  })
  const outputBindings = [
    ...existing,
    ...declared.filter(binding => !names.has(binding.name)),
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

/**
 * Materializes a record-stream or attaches declared inline bindings before result guarding and WebSocket reply.
 */
export const deliverAiClientToolResult = async (
  result: unknown,
  options: DeliverAiClientToolResultOptions,
) => {
  const recordStream = resolveRecordStream(result)
  if (recordStream) {
    const stream = recordStream.stream as AiClientToolRecordStream<unknown>
    const binding = resolveRecordStreamBinding(stream, options)
    const data = await materializeRecordStream(stream, options)
    return mergeDeliveryResult(stream, recordStream.envelope, data, binding)
  }
  const artifactResult = resolveArtifact(result)
  if (artifactResult) {
    const artifact = artifactResult.artifact as AiClientToolArtifact<unknown>
    const binding = resolveArtifactBinding(artifact, options)
    const delivery = await materializeArtifact(artifact, options)
    const delivered = mergeArtifactResult(artifact, artifactResult.envelope, delivery, binding)
    // A tool may produce one materialized renderer source plus small inline selectors (for example,
    // result ids used by a follow-up query). Materialization must not suppress those declared ports.
    return attachInlineOutputBindings(delivered, options.outputBindings)
  }
  return attachInlineOutputBindings(result, options.outputBindings)
}
