import dayjs from 'dayjs'
import type { PersonalToken } from './types'

export function tokenStatus(token: PersonalToken, now = Date.now()): { key: string; color: 'default' | 'success' | 'warning' } {
  if (token.status === 'disabled') return { key: 'PersonalCenter.disabled', color: 'default' }
  const expires = Number(token.expires)
  if (expires === -1) return { key: 'PersonalCenter.valid', color: 'success' }
  if (!Number.isFinite(expires) || expires <= 0) return { key: 'comm.table.empty', color: 'default' }
  if (expires <= now) return { key: 'PersonalCenter.expired', color: 'default' }
  if (expires - now <= 7 * 86400000) return { key: 'PersonalCenter.expiring', color: 'warning' }
  return { key: 'PersonalCenter.valid', color: 'success' }
}
export function tokenDate(value?: number | string | null) {
  if (!value) return '—'
  const date = dayjs(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value)
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : '—'
}
export function permissionCount(token: PersonalToken) {
  return (token.scope?.permissions || []).reduce((total, item) => total + (item.actions?.length || 0), 0)
}
