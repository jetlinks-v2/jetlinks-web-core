export type ServiceErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'NETWORK'
  | 'INTERNAL'
  | 'UNAUTHORIZED'
  | 'CANCELED'

export interface ServiceError {
  code: ServiceErrorCode
  message: string
  detail?: unknown
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError }

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data })

export const err = (
  code: ServiceErrorCode,
  message: string,
  detail?: unknown,
): ServiceResult<never> => ({ ok: false, error: { code, message, detail } })
