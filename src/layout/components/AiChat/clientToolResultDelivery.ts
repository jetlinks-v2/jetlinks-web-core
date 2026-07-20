import type {
  AiClientToolCall,
  AiClientToolResultDelivery,
  AiClientToolSessionFileApi,
} from './clientTools'
import {
  normalizeAiClientToolOutputBindings,
  withAiClientToolEvidence,
  type AiClientToolArtifactReference,
  type AiClientToolClaim,
  type AiClientToolFieldSemanticRole,
  type AiClientToolOutputBinding,
  type AiClientToolOutputField,
} from './clientToolResult'
import { resolveAiClientToolBindingPath } from './clientToolBindingPath'

const RECORD_STREAM_KIND = 'ai-client-tool-record-stream/v1'
const NDJSON_MIME_TYPE = 'application/x-ndjson'
const DEFAULT_CHUNK_BYTES = 256 * 1024
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024
const DEFAULT_MAX_RECORDS = 10_000
const DEFAULT_MAX_DURATION_MS = 25_000
const DEFAULT_MAX_ROW_BYTES = 64 * 1024
const DEFAULT_PREVIEW_LIMIT = 3
const DEFAULT_FALLBACK_SAMPLE_LIMIT = 10

type JsonRecord = Record<string, unknown>

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
  /** Stable shape of the materialized records. */
  outputShape?: string
  timeRange?: JsonRecord
  summary?: JsonRecord
  path?: string
  limits?: AiClientToolRecordDeliveryLimits
}

export interface AiClientToolRecordStream<T> extends AiClientToolRecordStreamOptions<T> {
  kind: typeof RECORD_STREAM_KIND
}

export interface AiClientToolRecordDeliveryData<T> {
  success: true
  producedFile: boolean
  delivery: 'session-file' | 'inline-sample'
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

type SemanticRole = AiClientToolFieldSemanticRole

interface SemanticField {
  path: string
  role: SemanticRole
}

interface TimestampProfile {
  role: 'timestamp'
  count: number
  invalidCount: number
  min?: number
  max?: number
}

interface NumberProfile {
  role: 'number' | 'longitude' | 'latitude'
  count: number
  invalidCount: number
  min?: number
  max?: number
}

interface CategoryProfile {
  role: 'category' | 'identifier'
  count: number
  nullCount: number
  values: Set<string>
  valuesTruncated: boolean
}

type MutableFieldProfile = TimestampProfile | NumberProfile | CategoryProfile

const isCategoryProfile = (profile: MutableFieldProfile): profile is CategoryProfile => (
  profile.role === 'category' || profile.role === 'identifier'
)

const MAX_SEMANTIC_FIELDS = 32
const MAX_CATEGORY_VALUES = 20

const normalizeSemanticRole = (value: unknown): SemanticRole | undefined => {
  const role = String(value || '').trim().toLowerCase()
  return [
    'timestamp', 'number', 'category', 'longitude', 'latitude', 'identifier',
  ].includes(role) ? role as SemanticRole : undefined
}

const collectSemanticFields = (
  schema: JsonRecord,
  prefix = '',
  result: SemanticField[] = [],
): SemanticField[] => {
  if (result.length >= MAX_SEMANTIC_FIELDS) return result
  const properties = isRecord(schema.properties) ? schema.properties : {}
  Object.entries(properties).some(([name, value]) => {
    if (result.length >= MAX_SEMANTIC_FIELDS || !isRecord(value)) return result.length >= MAX_SEMANTIC_FIELDS
    const path = prefix ? `${prefix}.${name}` : name
    const role = normalizeSemanticRole(value['x-ai-role'] ?? value.semanticRole)
      || (value.format === 'date-time' ? 'timestamp' : undefined)
    if (role) result.push({ path, role })
    if (value.type === 'object' || isRecord(value.properties)) collectSemanticFields(value, path, result)
    return result.length >= MAX_SEMANTIC_FIELDS
  })
  return result
}

const valueAtPath = (row: unknown, path: string) => {
  let current = row
  for (const segment of path.split('.')) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined
    current = current[segment]
  }
  return current
}

const timestampValue = (value: unknown) => {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : undefined
}

const numericValue = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const createFieldProfile = (role: SemanticRole): MutableFieldProfile => {
  if (role === 'category' || role === 'identifier') {
    return { role, count: 0, nullCount: 0, values: new Set(), valuesTruncated: false }
  }
  return { role, count: 0, invalidCount: 0 }
}

/** Collects bounded typed facts only from schema-declared semantic roles. */
const createRecordFactCollector = (schema: JsonRecord) => {
  const fields = collectSemanticFields(schema)
  const profiles = new Map(fields.map(field => [field.path, createFieldProfile(field.role)]))

  const accept = (row: unknown) => {
    fields.forEach((field) => {
      const profile = profiles.get(field.path)!
      const value = valueAtPath(row, field.path)
      if (isCategoryProfile(profile)) {
        profile.count += 1
        if (value === null || value === undefined || value === '') {
          profile.nullCount += 1
          return
        }
        if (profile.values.size < MAX_CATEGORY_VALUES) profile.values.add(String(value))
        else if (!profile.values.has(String(value))) profile.valuesTruncated = true
        return
      }
      const normalized = profile.role === 'timestamp' ? timestampValue(value) : numericValue(value)
      if (normalized === undefined) {
        profile.invalidCount += 1
        return
      }
      profile.count += 1
      profile.min = profile.min === undefined ? normalized : Math.min(profile.min, normalized)
      profile.max = profile.max === undefined ? normalized : Math.max(profile.max, normalized)
    })
  }

  const snapshot = () => {
    const fieldFacts: JsonRecord = {}
    let observedStart: number | undefined
    let observedEnd: number | undefined
    profiles.forEach((profile, path) => {
      if (isCategoryProfile(profile)) {
        fieldFacts[path] = {
          role: profile.role,
          count: profile.count,
          nullCount: profile.nullCount,
          values: Array.from(profile.values),
          valuesTruncated: profile.valuesTruncated,
        }
        return
      }
      fieldFacts[path] = {
        role: profile.role,
        count: profile.count,
        invalidCount: profile.invalidCount,
        ...(profile.min === undefined ? {} : { min: profile.min }),
        ...(profile.max === undefined ? {} : { max: profile.max }),
      }
      if (profile.role === 'timestamp' && profile.min !== undefined && profile.max !== undefined) {
        observedStart = observedStart === undefined ? profile.min : Math.min(observedStart, profile.min)
        observedEnd = observedEnd === undefined ? profile.max : Math.max(observedEnd, profile.max)
      }
    })
    return {
      observedRange: observedStart === undefined || observedEnd === undefined
        ? undefined
        : { start: observedStart, end: observedEnd },
      facts: Object.keys(fieldFacts).length ? { fields: fieldFacts } : undefined,
    }
  }

  return { accept, snapshot }
}

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
  writeAttempted: boolean,
) => {
  if (!files || !writeAttempted) return
  try {
    await files.remove(path)
  } catch {
    // Cleanup is best-effort; incomplete files are never exposed through the tool result.
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
  const factCollector = createRecordFactCollector(stream.schema)
  const retainedSamples: T[] = []
  let pendingLines: string[] = []
  let pendingBytes = 0
  let totalBytes = 0
  let count = 0
  let uploaded = false
  let writeAttempted = false
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
    if (!files || (!pendingLines.length && uploaded)) return
    const payload = new Blob(pendingLines, { type: NDJSON_MIME_TYPE })
    pendingLines = []
    pendingBytes = 0
    writeAttempted = true
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

    if (files && !fileErrorCode) {
      try {
        await flush()
        if (externalAbort) throw createAbortError()
        let fileRef: string
        try {
          fileRef = files.toUri(path)
        } catch (error) {
          throw new RecordFileWriteError(error)
        }
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
      } catch (error) {
        if (externalAbort) throw createAbortError()
        if (error instanceof RecordFileWriteError) fileErrorCode = error.code
        else throw error
      }
    }

    await cleanupPartialFile(files, path, writeAttempted)
    const complete = sourceCompleted
      && retainedSamples.length >= count
      && !limitReason
    const fallbackLimitReason = complete
      ? undefined
      : (limitReason || (count > retainedSamples.length ? 'sample' : undefined))
    const unavailable = mode !== 'inline'
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
    await cleanupPartialFile(files, path, writeAttempted)
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
  binding: { name: string; shape: string },
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
  const bindingFields = collectSemanticFields(stream.schema).map(field => ({
    name: field.path,
    semanticRole: field.role,
  }))
  const outputBindings: AiClientToolOutputBinding[] = data.producedFile && data.fileRef
    ? [{
        name: bindingName,
        ref: data.fileRef,
        ...(data.path ? { path: data.path } : {}),
        shape: outputShape,
        mediaType: data.mimeType,
        recordCount: data.count,
        complete: data.complete,
        truncated: data.truncated,
        ...(bindingFields.length ? { fields: bindingFields } : {}),
      }]
    : []
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
    returnedCount: data.count,
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
    supportsAbsenceClaim: declaredEvidence.supportsAbsenceClaim === true,
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
    shape: declaredOutputShape || expectedOutputShape || 'tabular.records',
  }
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
  const existing = normalizeAiClientToolOutputBindings([
    ...(Array.isArray(evidence.outputBindings) ? evidence.outputBindings : []),
    ...(Array.isArray(result.outputBindings) ? result.outputBindings : []),
  ] as AiClientToolOutputBinding[])
  const names = new Set(existing.map(binding => binding.name))
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
  const resolved = resolveRecordStream(result)
  if (!resolved) return attachInlineOutputBindings(result, options.outputBindings)
  const stream = resolved.stream as AiClientToolRecordStream<unknown>
  const binding = resolveRecordStreamBinding(stream, options)
  const data = await materializeRecordStream(stream, options)
  return mergeDeliveryResult(stream, resolved.envelope, data, binding)
}
