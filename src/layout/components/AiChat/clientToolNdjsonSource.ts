import type { AiClientToolRecordSource } from './clientToolResultDelivery'

const NDJSON_MIME_TYPE = 'application/x-ndjson'

type JsonRecord = Record<string, unknown>
type NdjsonFactory = typeof import('@jetlinks-web/core')['createNdJson']

export interface AiClientToolRequestContext {
  baseURL?: string
  headers?: HeadersInit
}

export interface AiClientToolNdjsonSourceOptions<T> {
  url: string
  data: Record<string, unknown>
  mapRow: (row: unknown) => T | null | undefined | Promise<T | null | undefined>
  baseURL?: string
  request?: RequestInit
  resolveRequestContext?: () => AiClientToolRequestContext | Promise<AiClientToolRequestContext>
  ndjsonFactory?: NdjsonFactory
}

const isRecord = (value: unknown): value is JsonRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

const createAbortError = () => {
  const error = new Error('client tool NDJSON source aborted') as Error & { code?: string }
  error.name = 'AbortError'
  error.code = 'CLIENT_TOOL_ABORTED'
  return error
}

const unwrapResponseRow = (value: unknown) => {
  if (!isRecord(value)) return value
  const envelope = Object.prototype.hasOwnProperty.call(value, 'result')
    && ['success', 'status', 'code'].some(key => Object.prototype.hasOwnProperty.call(value, key))
  if (!envelope) return value
  if (value.success === false) {
    const error = new Error(String(value.message || 'NDJSON query failed')) as Error & { code?: string }
    error.code = String(value.code || 'CLIENT_TOOL_NDJSON_QUERY_FAILED')
    throw error
  }
  return value.result
}

const resolveDefaultRequestContext = async (): Promise<AiClientToolRequestContext> => {
  const { getRequestBaseApi, getRequestHeaders } = await import('../../../utils/request-context')
  const headers = Object.fromEntries(
    Object.entries(getRequestHeaders()).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  return {
    baseURL: getRequestBaseApi(),
    headers,
  }
}

const resolveDefaultNdjsonFactory = async (): Promise<NdjsonFactory> => {
  const { createNdJson } = await import('@jetlinks-web/core')
  return createNdJson
}

/** Creates a backpressure-aware adapter over the platform NDJSON HTTP client. */
export const createAiClientToolNdjsonSource = <T>(
  options: AiClientToolNdjsonSourceOptions<T>,
): AiClientToolRecordSource<T> => ({
  consume: async (consumer, context) => {
    let subscription: { unsubscribe: () => void } | undefined
    let abortListener: (() => void) | undefined
    const requestContext = await (options.resolveRequestContext
      ? options.resolveRequestContext()
      : resolveDefaultRequestContext())
    const ndjsonFactory = options.ndjsonFactory || await resolveDefaultNdjsonFactory()

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (error?: unknown) => {
        if (settled) return
        settled = true
        if (error) reject(error)
        else resolve()
      }
      const ndjson = ndjsonFactory({
        baseURL: options.baseURL || requestContext.baseURL,
        handleResponse: async (input) => {
          const sourceRow = unwrapResponseRow(input)
          if (Array.isArray(sourceRow)) {
            const error = new Error('NDJSON endpoint returned a buffered array') as Error & { code?: string }
            error.code = 'CLIENT_TOOL_NDJSON_SOURCE_BUFFERED'
            throw error
          }
          const row = await options.mapRow(sourceRow)
          if (row !== null && row !== undefined) await consumer(row)
          return input
        },
      })
      const headers = new Headers(options.request?.headers)
      new Headers(requestContext.headers).forEach((value, key) => headers.set(key, value))
      headers.set('Accept', NDJSON_MIME_TYPE)

      subscription = ndjson.post(options.url, options.data, {
        ...(options.request || {}),
        signal: context.signal,
        headers,
      }).subscribe({
        next: () => undefined,
        complete: () => settle(),
        error: error => settle(error),
      })

      abortListener = () => {
        subscription?.unsubscribe()
        settle(createAbortError())
      }
      if (context.signal.aborted) abortListener()
      else context.signal.addEventListener('abort', abortListener, { once: true })
    }).finally(() => {
      if (abortListener) context.signal.removeEventListener('abort', abortListener)
      subscription?.unsubscribe()
    })
  },
})
