import type { Observable } from 'rxjs'
import { createRuntimeNdJson } from './ndjson'
import { parseJsonWithPrecision } from './json'

/** Keep point precision while the shared transport owns authentication, readers and cancellation. */
export function postRuntimeNdJson<T>(url: string, body: unknown): Observable<T> {
  return createRuntimeNdJson(undefined, {
    deserializer: parseJsonWithPrecision,
    async validateResponse(response) {
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        const text = await response.text()
        try {
          const error = parseJsonWithPrecision(text.trim().split('\n')[0])
          if (error && typeof error === 'object' && 'message' in error && error.message) message = String(error.message)
        } catch { /* Gateways can return HTML; retain the HTTP status. */ }
        throw Object.assign(new Error(message), { status: response.status })
      }
      if (!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson')) throw new Error('Expected NDJSON response')
    },
    handleResponse<T>(value: T): T {
      if (value && typeof value === 'object' && 'status' in value && Number(value.status) >= 400) {
        throw new Error('message' in value ? String(value.message) : `HTTP ${value.status}`)
      }
      return value
    },
  }).post<T>(url, JSON.stringify(body))
}
