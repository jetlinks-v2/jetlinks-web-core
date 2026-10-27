import type { DeviceSessionConnection, DeviceSessionInfo } from './types'
import { formatAllocationBytes } from './allocationPresentation'

export interface DeviceSessionMetric { key: string; value: string; raw: string; bytes: boolean }
export interface DeviceSessionConnectionRow {
  key: string; connection: DeviceSessionConnection; metrics: DeviceSessionMetric[]; connectedAt?: number; lastCommAt?: number
}
export interface DeviceSessionRow {
  key: string; session: DeviceSessionInfo; current: boolean; connectedAt?: number; lastCommAt?: number
  pendingMessages?: string; connections: DeviceSessionConnectionRow[]
}

/** 只接受可靠的非负整数；原始十进制文本不经过 Number，零值也保留。 */
export function deviceSessionCounter(value: unknown): string | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined
  return typeof value === 'string' && /^\d+$/.test(value.trim()) ? value.trim() : undefined
}

/** 时间戳为毫秒；0 是 DTO 的未提供时间，不解释为 1970 年连接。 */
export function deviceSessionTimestamp(value: unknown): number | undefined {
  const text = deviceSessionCounter(value)
  if (text === undefined) return undefined
  const number = Number(text)
  return Number.isSafeInteger(number) && number > 0 && number <= 8640000000000000 ? number : undefined
}

export function formatDeviceSessionTimestamp(value: unknown, locale = 'en'): string | undefined {
  const timestamp = deviceSessionTimestamp(value)
  return timestamp === undefined ? undefined : new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(timestamp)
}

/** 时长仅随本地时钟更新；未来时间保留绝对值，不伪造已连接时长。 */
export function deviceSessionElapsed(value: unknown, now: number): number | undefined {
  const timestamp = deviceSessionTimestamp(value)
  return timestamp !== undefined && Number.isFinite(now) && now >= timestamp ? Math.floor((now - timestamp) / 1000) : undefined
}

export function formatDeviceSessionDuration(value: unknown, now: number, locale = 'en'): string | undefined {
  let remaining = deviceSessionElapsed(value, now)
  if (remaining === undefined) return undefined
  const parts: string[] = []
  const zhUnits = { day: '天', hour: '小时', minute: '分', second: '秒' }
  for (const [seconds, unit] of [[86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']] as const) {
    const amount = Math.floor(remaining / seconds)
    if (amount || unit === 'second' && !parts.length) parts.push(locale.startsWith('zh')
      ? `${new Intl.NumberFormat(locale).format(amount)}${zhUnits[unit]}`
      : new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'narrow' }).format(amount))
    remaining %= seconds
    if (parts.length === 3) break
  }
  return parts.join('')
}

export function formatDeviceSessionLastSeen(value: unknown, now: number, locale = 'en'): string | undefined {
  const elapsed = deviceSessionElapsed(value, now)
  if (elapsed === undefined) return undefined
  const [size, unit] = elapsed >= 86400 ? [86400, 'day'] : elapsed >= 3600 ? [3600, 'hour'] : elapsed >= 60 ? [60, 'minute'] : [1, 'second']
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(-Math.floor(elapsed / Number(size)), unit as Intl.RelativeTimeFormatUnit)
}

export function formatDeviceSessionBytes(value: unknown): string | undefined {
  const text = deviceSessionCounter(value)
  if (text === undefined) return undefined
  const bytes = BigInt(text)
  if (bytes <= BigInt(Number.MAX_SAFE_INTEGER)) return formatAllocationBytes(Number(bytes))
  // 大计数先用整数缩放与四舍五入，不能先转 Number 再补救精度。
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB']
  let divisor = 1n, unit = 0
  while (unit < units.length - 1 && bytes >= divisor * 1024n) { divisor *= 1024n; unit++ }
  const tenths = (bytes * 10n + divisor / 2n) / divisor, whole = tenths / 10n, fraction = tenths % 10n
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''} ${units[unit]}`
}

function connectionMetrics(connection: DeviceSessionConnection): DeviceSessionMetric[] {
  const fields = [
    ['pendingMessages', connection.pendingMessages, false], ['readBytes', connection.metrics?.readBytes, true],
    ['writeBytes', connection.metrics?.writeBytes, true], ['totalMessages', connection.metrics?.totalMessages, false],
    ['metricsPendingMessages', connection.metrics?.pendingMessages, false], ['droppedMessages', connection.metrics?.droppedMessages, false],
  ] as const
  return fields.flatMap(([key, input, bytes]) => {
    const raw = deviceSessionCounter(input)
    return raw === undefined ? [] : [{ key, raw, bytes, value: bytes ? formatDeviceSessionBytes(input)! : raw }]
  })
}

/** 当前节点优先，其余保持服务端顺序；会话和连接的待处理指标分别呈现，不相加。 */
export function deviceSessionRows(sessions: readonly DeviceSessionInfo[], nodeId: string): DeviceSessionRow[] {
  const sessionKeys = new Map<string, number>()
  // 会话行是节点上的逻辑分组，地址与建立时间可能取自其中某条连接，不能随其变化重置阅读状态。
  // 同一分组有多条服务端记录时再用物理信息区分；连接本身仍保留完整身份与建立时间。
  const identity = (session: DeviceSessionInfo) => [session.serverId, session.deviceId, session.transport]
  const counts = new Map<string, number>()
  for (const session of sessions) { const base = JSON.stringify(identity(session)); counts.set(base, (counts.get(base) ?? 0) + 1) }
  const key = (identity: unknown[], occurrences: Map<string, number>) => {
    const base = JSON.stringify(identity), occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    return JSON.stringify([base, occurrence])
  }
  return sessions.map(session => {
    const connectionKeys = new Map<string, number>()
    return {
    key: key(counts.get(JSON.stringify(identity(session)))! > 1 ? [...identity(session), session.address, session.connectTime] : identity(session), sessionKeys),
    session, current: !!nodeId && session.serverId === nodeId,
    connectedAt: deviceSessionTimestamp(session.connectTime), lastCommAt: deviceSessionTimestamp(session.lastCommTime),
    pendingMessages: deviceSessionCounter(session.pendingMessages),
    connections: (session.connections ?? []).map(connection => ({
      key: key([connection.id, connection.address, connection.metrics?.connectTime], connectionKeys), connection,
      metrics: connectionMetrics(connection), connectedAt: deviceSessionTimestamp(connection.metrics?.connectTime),
      lastCommAt: deviceSessionTimestamp(connection.metrics?.lastCommTime),
    })),
  } }).sort((left, right) => Number(right.current) - Number(left.current))
}
