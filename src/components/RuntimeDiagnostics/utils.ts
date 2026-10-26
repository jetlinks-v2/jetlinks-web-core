import type { MBeanDescriptor, MBeanOperation, Nanoseconds, TraceRow, TraceSpan } from './types'
import { bufferMonitorCounters } from './buffer/counters'
export const formatValue = (value: unknown): string => value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
export const operationId = (operation: MBeanOperation) => `${operation.name}(${operation.signature.join(', ')})`

/** ThreadSnapshot 的每个非空行对应一个已采集栈帧；空白行不计入深度。 */
export const threadStackDepth = (stack: string): number => stack.split(/\r?\n/).filter(frame => frame.trim()).length

/** 常用概览只匹配真实域 / 类型，缺失或负数计数保留未知；积压量本身不判定故障。 */
export function runtimeBeanOverview(beans: MBeanDescriptor[]) {
  const value = (bean: MBeanDescriptor | undefined, name: string) => bean?.attributes.find(attribute => attribute.name === name && attribute.available)?.value
  const count = (bean: MBeanDescriptor | undefined, name: string) => {
    const raw = value(bean, name)
    const parsed = raw === null || raw === undefined || raw === '' ? NaN : Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
  }
  const bufferError = (bean: MBeanDescriptor) => {
    const raw = value(bean, 'LastError')
    // PersistenceBuffer 以 nil 表示尚无错误，真实错误原文仍保留堆栈格式。
    if (typeof raw !== 'string') return undefined
    return raw.trim() && raw.trim() !== 'nil' ? raw : ''
  }
  const runtime = beans.find(bean => bean.domain === 'java.lang' && bean.type === 'Runtime')
  const buffers = beans.filter(bean => bean.domain === 'org.jetlinks' && bean.type === 'PersistenceBuffer').map(bean => ({
    objectName: bean.objectName, name: bean.name,
    pending: count(bean, 'Remainder'), dead: count(bean, 'DeadSize'), wip: count(bean, 'Wip'), writerPending: count(bean, 'WriterPending'),
    ...bufferMonitorCounters(value(bean, 'Monitor')),
    error: bufferError(bean),
  })).sort((left, right) => (right.dead ?? -1) - (left.dead ?? -1) || (right.pending ?? -1) - (left.pending ?? -1) || left.name.localeCompare(right.name))
  return { startTime: count(runtime, 'StartTime'), uptime: count(runtime, 'Uptime'), buffers }
}

/** 优先使用服务端精确文本；拒绝已丢精度的 Number，不能用 String 补救。 */
export function nanosText(value: unknown, preciseText?: unknown): Nanoseconds | undefined {
  const parse = (input: unknown) => {
    if (typeof input === 'string' && /^\d+$/.test(input.trim())) return input.trim()
    if (typeof input === 'number' && Number.isSafeInteger(input) && input >= 0) return String(input)
    if (typeof input === 'bigint' && input >= 0n) return String(input)
    return undefined
  }
  return parse(preciseText) ?? parse(value)
}

/** 先以 BigInt 相减再转换；无效、倒序或过大的区间显示未知，避免图表出现 Infinity。 */
export function nanosBetween(start: string, end: string): number | undefined {
  const from = nanosText(start), to = nanosText(end)
  if (from === undefined || to === undefined) return undefined
  const delta = BigInt(to) - BigInt(from)
  const millis = Number(delta) / 1e6
  return delta >= 0n && Number.isFinite(millis) ? millis : undefined
}

/** 按 Span ID 跨节点组树；重复、缺父与成环记录全部可达，歧义父级不猜测挂接。 */
export function traceRows(spans: TraceSpan[]): TraceRow[] {
  const identities = new Map<string, number[]>()
  const identity = (traceId: string, id: string) => JSON.stringify([traceId, id])
  const usedKeys = new Set<string>()
  const rows: TraceRow[] = spans.map((span, index) => {
    const id = identity(span.traceId, span.id)
    identities.set(id, [...(identities.get(id) ?? []), index])
    const baseKey = `${span.nodeId}:${span.id}`
    let key = baseKey, suffix = 1
    while (usedKeys.has(key)) key = `${baseKey}#${++suffix}`
    usedKeys.add(key)
    return { ...span, key, depth: 0, duration: nanosBetween(span.startNanos, span.endNanos),
      missingParent: false, ambiguousParent: false, cyclic: false, duplicate: false }
  })
  const parents = rows.map(row => {
    row.duplicate = (identities.get(identity(row.traceId, row.id))?.length ?? 0) > 1
    if (!row.parentId || /^0+$/.test(row.parentId)) return undefined
    const candidates = identities.get(identity(row.traceId, row.parentId)) ?? []
    row.missingParent = candidates.length === 0
    row.ambiguousParent = candidates.length > 1
    return candidates.length === 1 ? candidates[0] : undefined
  })
  const checked = new Set<number>()
  for (let index = 0; index < rows.length; index++) {
    const path: number[] = [], positions = new Map<number, number>()
    let current: number | undefined = index
    while (current !== undefined && !checked.has(current)) {
      const cycleStart = positions.get(current)
      if (cycleStart !== undefined) {
        for (const member of path.slice(cycleStart)) rows[member].cyclic = true
        break
      }
      positions.set(current, path.length); path.push(current); current = parents[current]
    }
    path.forEach(member => checked.add(member))
  }
  const children = new Map<number, number[]>(), roots: number[] = []
  rows.forEach((row, index) => {
    // 环成员各自作为根保留，其正常后代仍挂接，避免递归裁剪导致证据丢失。
    const parent = row.cyclic ? undefined : parents[index]
    if (parent === undefined) roots.push(index)
    else { row.parentKey = rows[parent].key; children.set(parent, [...(children.get(parent) ?? []), index]) }
  })
  const compare = (left: number, right: number) => {
    const a = nanosText(rows[left].startNanos), b = nanosText(rows[right].startNanos)
    if (a === undefined || b === undefined) return a === b ? left - right : a === undefined ? 1 : -1
    return BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : left - right
  }
  roots.sort(compare); children.forEach(items => items.sort(compare))
  const result: TraceRow[] = [], pending = roots.reverse().map(index => ({ index, depth: 0 }))
  while (pending.length) {
    const item = pending.pop()!
    const row = rows[item.index]
    row.depth = item.depth; result.push(row)
    const descendants = children.get(item.index) ?? []
    for (let index = descendants.length - 1; index >= 0; index--) pending.push({ index: descendants[index], depth: item.depth + 1 })
  }
  return result
}
