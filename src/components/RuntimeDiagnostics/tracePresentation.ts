import { nanosBetween, nanosText } from './utils'
import type { TraceEvent, TraceRow, TraceSpan } from './types'

/** OpenTelemetry 的 exception 事件才构成异常证据，不按名称或属性模糊猜测。 */
export function exceptionEvents(span: TraceSpan): TraceEvent[] { return span.events?.filter(event => event.name === 'exception') ?? [] }

export function summarizeTrace(rows: TraceRow[]) {
  const valid = rows.filter(row => row.duration !== undefined && nanosText(row.startNanos) !== undefined && nanosText(row.endNanos) !== undefined)
  const start = valid.reduce<string | undefined>((value, row) => value === undefined || BigInt(row.startNanos) < BigInt(value) ? row.startNanos : value, undefined)
  const end = valid.reduce<string | undefined>((value, row) => value === undefined || BigInt(row.endNanos) > BigInt(value) ? row.endNanos : value, undefined)
  return { start, end, duration: start === undefined || end === undefined ? undefined : nanosBetween(start, end),
    nodes: new Set(rows.map(row => row.nodeId).filter(Boolean)).size,
    exceptions: rows.filter(row => exceptionEvents(row).length > 0).length,
    malformed: rows.filter(row => row.missingParent || row.ambiguousParent || row.cyclic || row.duplicate).length }
}

export function traceBar(row: TraceRow, summary: ReturnType<typeof summarizeTrace>): { left: number; width: number } | undefined {
  if (summary.start === undefined || summary.duration === undefined || row.duration === undefined) return undefined
  const offset = nanosBetween(summary.start, row.startNanos)
  if (offset === undefined) return undefined
  if (summary.duration === 0) return { left: 0, width: 0 }
  const left = Math.min(100, Math.max(0, offset / summary.duration * 100))
  return { left, width: Math.min(100 - left, Math.max(0, row.duration / summary.duration * 100)) }
}

export interface TraceDurationLabel { left: number; position: 'inside' | 'after' | 'before' | 'above' | 'hidden' }
/** 长条内显示，短条优先借用后方或前方空位；两侧都不足时单独一层，不改实际时间比例。 */
export function traceDurationLabel(bar: { left: number; width: number } | undefined, axisWidth: number, textWidth: number): TraceDurationLabel {
  const axis = Math.max(0, axisWidth), label = Math.max(0, textWidth), gap = 6
  if (!bar || !axis || !Number.isFinite(axis) || !Number.isFinite(label) || !Number.isFinite(bar.left) || !Number.isFinite(bar.width) || bar.left < 0 || bar.width < 0 || bar.left + bar.width > 100.000001) return { left: 0, position: 'hidden' }
  const start = axis * bar.left / 100, width = axis * bar.width / 100
  const end = start + width
  if (width >= label + gap * 2) return { left: start + gap, position: 'inside' }
  if (end + gap + label <= axis) return { left: end + gap, position: 'after' }
  if (start >= label + gap) return { left: start - label - gap, position: 'before' }
  return { left: Math.max(0, Math.min(start, axis - label)), position: 'above' }
}

/** 原始纳秒差值用于提示和详情精确证据，不经Number转换。 */
export function traceNanosecondDelta(start: unknown, end: unknown): string | undefined {
  const from = nanosText(start), to = nanosText(end)
  if (from === undefined || to === undefined) return undefined
  const delta = BigInt(to) - BigInt(from)
  return delta >= 0n ? String(delta) : undefined
}

/** 慢调用入口只比较已挂接子调用的包含耗时，不把入口、零耗时或结构异常根推断为瓶颈。 */
export function traceSlowCalls(rows: TraceRow[]): TraceRow[] {
  const keys = new Set(rows.map(row => row.key))
  return rows.flatMap((row, index) => {
    const delta = row.parentKey && keys.has(row.parentKey) && row.duration !== undefined && Number.isFinite(row.duration)
      ? traceNanosecondDelta(row.startNanos, row.endNanos) : undefined
    const nanos = delta === undefined ? 0n : BigInt(delta)
    return nanos > 0n ? [{ row, nanos, index }] : []
  }).sort((left, right) => left.nanos > right.nanos ? -1 : left.nanos < right.nanos ? 1 : left.index - right.index)
    .map(item => item.row)
}

export type TraceEvidenceKind = 'exception' | 'database' | 'network' | 'runtime' | 'attributes' | 'events'
export interface TraceDetailFocus { kind: TraceEvidenceKind; revision: number; attributeKey?: string }
export interface TraceEvidence { kind: TraceEvidenceKind; type: 'exception' | 'sql' | 'http' | 'output' | 'attributes' | 'events'; text?: string; count?: number; attributeKey?: string }
const httpMethods = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE|CONNECT)$/
const databaseStatementKeys = ['sql', 'db.query.text', 'db.statement']
function plainHttp(attributes: Record<string, unknown>) { return typeof attributes.method === 'string' && httpMethods.test(attributes.method) && typeof attributes.uri === 'string' && /^https?:\/\//.test(attributes.uri) }
function firstTextKey(attributes: Record<string, unknown>, keys: string[]) { return keys.find(key => typeof attributes[key] === 'string' && !!attributes[key].trim()) }
function firstText(attributes: Record<string, unknown>, keys: string[]) { const key = firstTextKey(attributes, keys); return key ? attributes[key] as string : undefined }
function httpStatus(value: unknown): string | undefined { return (typeof value === 'number' && Number.isInteger(value) || typeof value === 'string' && /^\d{3}$/.test(value)) && Number(value) >= 100 && Number(value) <= 599 ? String(value) : undefined }

export interface TraceContextSummary { type: 'action' | 'actor' | 'sourceIp'; text: string; attributeKey: string; fullText?: string; shortText?: string }
const traceContextKeys = {
  action: ['request.action'], actor: ['user.name', 'user.username'], sourceIp: ['request.ip', 'client.address', 'net.peer.ip'],
} as const
// 业务上下文由摘要和详情共用同一声明，避免两处逐渐接受不同字段。
const businessAttributeKeyOrder = new Map<string, number>([...traceContextKeys.action, ...traceContextKeys.actor, ...traceContextKeys.sourceIp].map((key, index) => [key, index]))

/** 摘要只读取已声明的上下文字段；身份标识、凭证和未知原文留在证据区。 */
export function traceContextSummary(span: TraceSpan): TraceContextSummary[] {
  const attributes = span.attributes ?? {}
  return (Object.entries(traceContextKeys) as Array<[TraceContextSummary['type'], readonly string[]]>).flatMap(([type, keys]) => {
    const entries = keys.flatMap(key => {
      const value = attributes[key]
      return typeof value === 'string' && value.trim() ? [{ key, text: value.trim() }] : []
    })
    if (!entries.length) return []
    const texts = [...new Set(entries.map(entry => entry.text))]
    const text = type === 'actor' && texts.length > 1 ? `${texts[0]} (${texts[1]})` : texts[0]
    // 平台动作可带多级资源前缀，短摘要优先保留末段动作，完整原值仍用于提示和定位。
    const actionParts = type === 'action' ? text.split('-').map(part => part.trim()) : []
    const shortText = type === 'actor' && texts.length > 1 ? texts[0] : actionParts.length >= 2 && actionParts.every(Boolean) ? actionParts[actionParts.length - 1] : undefined
    return [{ type, text: text.length > 96 ? `${text.slice(0, 96)}…` : text, attributeKey: entries[0].key,
      ...(text.length > 96 ? { fullText: text } : {}), ...(shortText ? { shortText } : {}) }]
  })
}

/** 只识别平台已声明字段与OTel语义字段，未知属性不升级为异常或HTTP状态。 */
export function traceEvidence(span: TraceSpan): TraceEvidence[] {
  const values: TraceEvidence[] = [], attributes = span.attributes ?? {}, exception = exceptionEvents(span)[0]
  if (exception) values.push({ kind: 'exception', type: 'exception', text: [exception.attributes?.['exception.type'], exception.attributes?.['exception.message']].filter(value => typeof value === 'string' && value).join(' · ') })
  const sql = firstText(attributes, databaseStatementKeys)
  if (sql) values.push({ kind: 'database', type: 'sql', text: sql, attributeKey: firstTextKey(attributes, databaseStatementKeys) })
  const status = httpStatus(attributes['http.response.status_code']) ?? httpStatus(attributes['http.status_code']) ?? (plainHttp(attributes) ? httpStatus(attributes.status) : undefined)
  if (status) values.push({ kind: 'network', type: 'http', text: `HTTP ${status}` })
  const emitted = attributes['flux-next-count']
  if ((typeof emitted === 'number' || typeof emitted === 'string' && /^\d+$/.test(emitted)) && Number.isSafeInteger(Number(emitted)) && Number(emitted) >= 0) values.push({ kind: 'runtime', type: 'output', count: Number(emitted), attributeKey: 'flux-next-count' })
  if (!values.length) {
    const count = Object.keys(attributes).length
    if (count) values.push({ kind: 'attributes', type: 'attributes', count })
    if (span.events?.length) values.push({ kind: 'events', type: 'events', count: span.events.length })
  }
  return values.slice(0, 3)
}

export function defaultTraceEvidence(span: TraceSpan): TraceEvidenceKind { return traceEvidence(span)[0]?.kind ?? 'attributes' }

export interface TraceRowSummary {
  type: TraceContextSummary['type'] | TraceEvidence['type']; kind: TraceEvidenceKind; text?: string; count?: number;
  attributeKey?: string; fullText?: string; shortText?: string;
}
/** 所有入口共用一条摘要；异常优先，保留已识别证据和精确属性目标。 */
export function traceRowSummary(span: TraceSpan): TraceRowSummary[] {
  const evidence = traceEvidence(span)
  return [...evidence.filter(item => item.type === 'exception'),
    ...traceContextSummary(span).map(item => ({ ...item, kind: 'attributes' as const })),
    ...evidence.filter(item => item.type !== 'exception')]
}

/** 长数据库语句与摘要字段一样，首次进入证据时就展开原值。 */
export function traceEvidenceAttributeKey(span: TraceSpan, kind: TraceEvidenceKind): string | undefined {
  return traceEvidence(span).find(item => item.kind === kind)?.attributeKey
}

/** 折叠仅隐藏后代；搜索和 URL 选择可展开祖先，结构异常根仍可见。 */
export function visibleTraceRows(rows: TraceRow[], collapsed: ReadonlySet<string>): TraceRow[] {
  const hidden = new Set<string>()
  return rows.filter(row => {
    if (row.parentKey && (hidden.has(row.parentKey) || collapsed.has(row.parentKey))) { hidden.add(row.key); return false }
    return true
  })
}

export function nodeColorIndex(nodeId?: string): number {
  let hash = 0; for (const char of nodeId ?? '') hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 6
}

/** 仅缩放有效的非负毫秒；相对纳秒差值仍由 nanosBetween 先以 BigInt 计算。 */
export function formatTraceDuration(milliseconds: number | undefined, locale = 'en'): string | undefined {
  if (milliseconds === undefined || !Number.isFinite(milliseconds) || milliseconds < 0) return undefined
  const [value, unit] = milliseconds > 0 && milliseconds < 1 ? [milliseconds * 1000, 'µs'] : milliseconds >= 1000 ? [milliseconds / 1000, 's'] : [milliseconds, 'ms']
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)} ${unit}`
}

/** Epoch 纳秒先整除再转换日期，避免现代时间戳在 Number 中损失精度。 */
export function traceEpochMillis(value: unknown): number | undefined {
  const nanos = nanosText(value)
  if (nanos === undefined) return undefined
  const millis = BigInt(nanos) / 1000000n
  return millis <= 8640000000000000n ? Number(millis) : undefined
}

export function formatTraceTimestamp(value: unknown, locale = 'en'): string | undefined {
  const millis = traceEpochMillis(value)
  return millis === undefined ? undefined : new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hour12: false,
  }).format(millis)
}

export interface TraceAttributeGroup { key: 'business' | 'network' | 'database' | 'messaging' | 'runtime' | 'exception' | 'other'; entries: Array<{ key: string; value: unknown }> }
/** 只按已知语义前缀分组，未知字段保留原名和值，不推测协议或单位。 */
export function groupTraceAttributes(attributes: Record<string, unknown> = {}): TraceAttributeGroup[] {
  const groups = new Map<TraceAttributeGroup['key'], TraceAttributeGroup['entries']>()
  Object.entries(attributes).forEach(([key, value]) => {
    const group: TraceAttributeGroup['key'] = businessAttributeKeyOrder.has(key) ? 'business'
      : /^(http|url|network|net|server|client|peer)\./.test(key) || plainHttp(attributes) && ['uri', 'method', 'status', 'responseHeaders'].includes(key) ? 'network'
      : /^db\./.test(key) || key === 'sql' || key === 'updated' && typeof attributes.sql === 'string' ? 'database' : /^messaging\./.test(key) ? 'messaging'
        : /^(code|thread|process|service|host|os|telemetry)\./.test(key) || key === 'flux-next-count' || ['user.id', 'user.type'].includes(key) ? 'runtime' : /^exception\./.test(key) ? 'exception' : 'other'
    groups.set(group, [...(groups.get(group) ?? []), { key, value }])
  })
  const business = groups.get('business')
  if (business) business.sort((left, right) => businessAttributeKeyOrder.get(left.key)! - businessAttributeKeyOrder.get(right.key)!)
  return (['exception', 'business', 'network', 'database', 'messaging', 'runtime', 'other'] as const)
    .flatMap(key => groups.has(key) ? [{ key, entries: groups.get(key)! }] : [])
}

/** 只格式化有限数值，长整型文本及其他标识不转成 Number，避免损失或改写证据。 */
export function formatTraceAttribute(value: unknown, locale = 'en'): string {
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat(locale, { maximumSignificantDigits: 15 }).format(value)
  if (value === undefined) return '—'
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
