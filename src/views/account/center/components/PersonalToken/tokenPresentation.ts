import dayjs from 'dayjs'
import type { PersonalToken } from './types'

/** 后端将明确的非正数过期时间视为永久有效；缺失值仍保持未知。 */
export function isUnlimitedExpiry(value?: number | string | null): boolean {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return false
  const expires = Number(value)
  return Number.isFinite(expires) && expires <= 0
}

export function tokenStatus(token: PersonalToken, now = Date.now()): { key: string; color: 'default' | 'success' | 'warning' } {
  if (token.status === 'disabled') return { key: 'PersonalCenter.disabled', color: 'default' }
  if (isUnlimitedExpiry(token.expires)) return { key: 'PersonalCenter.valid', color: 'success' }
  const expires = Number(token.expires)
  if (token.expires === null || token.expires === undefined || !Number.isFinite(expires) || expires <= 0) return { key: 'comm.table.empty', color: 'default' }
  if (expires <= now) return { key: 'PersonalCenter.expired', color: 'default' }
  if (expires - now <= 7 * 86400000) return { key: 'PersonalCenter.expiring', color: 'warning' }
  return { key: 'PersonalCenter.valid', color: 'success' }
}
export function tokenDate(value?: number | string | null, format = 'YYYY-MM-DD HH:mm') {
  if (!value) return '—'
  const date = dayjs(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
  return date.isValid() ? date.format(format) : '—'
}

/** 按本地自然日显示“今天过期 / 还剩 N 天”，缺失或永久有效返回空值。 */
export function tokenExpiryDays(value?: number | string | null, now = Date.now()): number | null {
  const expires = Number(value)
  if (!Number.isFinite(expires) || expires <= 0) return null
  const date = dayjs(expires)
  return date.isValid() ? date.startOf('day').diff(dayjs(now).startOf('day'), 'day') : null
}

export function permissionCount(token: PersonalToken) {
  return (token.scope?.permissions || []).reduce((total, item) => total + (item.actions?.length || 0), 0)
}
