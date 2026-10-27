import type { DeviceSessionInfo, ViewState } from '../types'
import { deviceSessionCounter, deviceSessionTimestamp } from '../deviceSessionPresentation'
import { formatAllocationBytes } from '../allocationPresentation'

export const deviceObservationMetrics = ['receive', 'send', 'messages', 'pending'] as const
export type DeviceObservationMetric = typeof deviceObservationMetrics[number]
export const deviceObservationMetricColors = { receive: '#1677ff', send: '#13a8a8', messages: '#722ed1', pending: '#d46b08' }
interface ConnectionCounter { key: string; receive?: string; send?: string; messages?: string }
export interface DeviceObservationSample {
  sampledAt: number; connections?: ConnectionCounter[]; pending?: number; interrupted?: boolean
}
export interface DeviceObservationPoint { sampledAt: number; receive?: number; send?: number; messages?: number; pending?: number }
export interface DeviceObservationEntry {
  id: string; label: string; color?: string; sessions: DeviceSessionInfo[]; history: DeviceObservationSample[]; state: ViewState; collecting: boolean
}

/** 每条连接先保留精确计数和连接代次；缺失身份或重复身份不能参与设备总速率。 */
export function deviceObservationSample(sessions: readonly DeviceSessionInfo[], sampledAt: number): DeviceObservationSample {
  const counters: ConnectionCounter[] = [], keys = new Set<string>(), physicalKeys = new Set<string>(), sessionKeys = new Set<string>()
  let complete = sessions.length > 0, pending = 0n, pendingKnown = sessions.length > 0
  for (const session of sessions) {
    const sessionKey = JSON.stringify([session.serverId, session.deviceId, session.transport, session.address, session.connectTime])
    if (sessionKeys.has(sessionKey)) { complete = false; pendingKnown = false }
    sessionKeys.add(sessionKey)
    const count = deviceSessionCounter(session.pendingMessages)
    if (count === undefined) pendingKnown = false
    else pending += BigInt(count)
    if (!session.connections?.length) complete = false
    for (const connection of session.connections ?? []) {
      const connectedAt = deviceSessionTimestamp(connection.metrics?.connectTime)
      const key = JSON.stringify([session.serverId, session.deviceId, session.transport, session.connectTime, connection.id, connection.address, connectedAt])
      const physicalKey = JSON.stringify([connection.id, connection.address, connectedAt])
      // 同一连接在多个节点重复投影时无法确认归属，不猜测去重也不双算速率。
      if (physicalKeys.has(physicalKey)) complete = false
      physicalKeys.add(physicalKey)
      if (!session.serverId || !connection.id || connectedAt === undefined || keys.has(key)) complete = false
      keys.add(key)
      counters.push({ key, receive: deviceSessionCounter(connection.metrics?.readBytes), send: deviceSessionCounter(connection.metrics?.writeBytes), messages: deviceSessionCounter(connection.metrics?.totalMessages) })
    }
  }
  return { sampledAt, connections: complete ? counters.sort((a, b) => a.key.localeCompare(b.key)) : undefined,
    pending: pendingKnown && pending <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(pending) : undefined }
}

/** 先逐连接求差再汇总；重连、缺字段、回退和暂停均断线，不把部分连接画成完整总量。 */
export function deviceObservationPoints(history: readonly DeviceObservationSample[]): DeviceObservationPoint[] {
  return history.map((sample, index) => {
    const previous = history[index - 1], elapsed = previous ? sample.sampledAt - previous.sampledAt : 0
    const same = !sample.interrupted && !previous?.interrupted && elapsed > 0 && previous?.connections && sample.connections
      && previous.connections.length === sample.connections.length && sample.connections.every((connection, i) => connection.key === previous.connections![i].key)
    function rate(field: 'receive' | 'send' | 'messages') {
      if (!same || !sample.connections?.length || !previous?.connections) return undefined
      let delta = 0n
      for (let i = 0; i < sample.connections.length; i++) {
        const from = previous.connections[i][field], to = sample.connections[i][field]
        if (from === undefined || to === undefined || BigInt(to) < BigInt(from)) return undefined
        delta += BigInt(to) - BigInt(from)
      }
      const value = Number(delta) * 1000 / elapsed
      return Number.isFinite(value) && delta <= BigInt(Number.MAX_SAFE_INTEGER) ? value : undefined
    }
    return { sampledAt: sample.sampledAt, pending: sample.interrupted ? undefined : sample.pending, receive: rate('receive'), send: rate('send'), messages: rate('messages') }
  })
}

/** 通信与会话心跳来自各自的服务端字段，不能用当前时钟推导活跃时间。 */
export function deviceObservationActivity(sessions: readonly DeviceSessionInfo[]) {
  const comm = sessions.flatMap(session => (session.connections ?? []).map(connection => deviceSessionTimestamp(connection.metrics?.lastCommTime))).filter((value): value is number => value !== undefined)
  const heartbeat = sessions.map(session => deviceSessionTimestamp(session.lastCommTime)).filter((value): value is number => value !== undefined)
  return { lastCommAt: comm.length ? Math.max(...comm) : undefined, lastHeartbeatAt: heartbeat.length ? Math.max(...heartbeat) : undefined }
}

/** 从全部服务节点选择已知建立时间最新的连接，节点与地址始终取自同一条记录。 */
export function deviceObservationConnection(sessions: readonly DeviceSessionInfo[]) {
  const connections = sessions.flatMap(session => (session.connections ?? []).map(connection => ({ serverId: session.serverId, transport: session.transport, address: connection.address, connectedAt: deviceSessionTimestamp(connection.metrics?.connectTime) })))
  // 旧节点未提供连接明细时，只展示其真实会话字段，不从其他节点借用地址或时间。
  const records = connections.length ? connections : sessions.map(session => ({ serverId: session.serverId, transport: session.transport, address: session.address, connectedAt: deviceSessionTimestamp(session.connectTime) }))
  return records.reduce<(typeof records)[number] | undefined>((latest, value) => !latest || (value.connectedAt ?? -Infinity) > (latest.connectedAt ?? -Infinity) ? value : latest, undefined)
}

export function appendDeviceObservation(history: readonly DeviceObservationSample[], sample: DeviceObservationSample) {
  return [...history.filter(value => value.sampledAt >= sample.sampledAt - 600000 && value.sampledAt <= sample.sampledAt), sample].slice(-601)
}

/** 暂停/失败的断点只作用于曲线；摘要仍保留最近完成样本，但不能跨新样本补旧速率。 */
export function deviceObservationCurrentPoint(history: readonly DeviceObservationSample[]) {
  const points = deviceObservationPoints(history)
  for (let index = history.length - 1; index >= 0; index--) if (!history[index].interrupted) return points[index]
  return undefined
}

export const deviceObservationColors = ['#1677ff', '#13a8a8', '#722ed1', '#d46b08', '#c41d7f']

/** 联动按真实时间匹配，最多容许半个实际采样周期；缺测帧参与匹配，不跨断点回填。 */
export function deviceObservationPointAt(points: readonly DeviceObservationPoint[], time: number) {
  if (!points.length || time < points[0].sampledAt || time > points[points.length - 1].sampledAt) return undefined
  const periods = points.slice(1).map((point, index) => point.sampledAt - points[index].sampledAt).filter(value => value > 0).sort((a, b) => a - b)
  const radius = periods.length ? periods[Math.floor((periods.length - 1) / 2)] / 2 : 0
  const closest = points.reduce((previous, point) => Math.abs(point.sampledAt - time) < Math.abs(previous.sampledAt - time) ? point : previous)
  return Math.abs(closest.sampledAt - time) <= radius ? closest : undefined
}

export function formatDeviceObservationValue(value: number, metric: DeviceObservationMetric, locale: string, countUnit: string) {
  return metric === 'receive' || metric === 'send' ? `${formatAllocationBytes(value, locale)}/s` : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} ${countUnit}`
}
