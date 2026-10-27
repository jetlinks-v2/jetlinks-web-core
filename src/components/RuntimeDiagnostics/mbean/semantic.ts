import type { MBeanDescriptor } from '../types'

export type SemanticFormat = 'count' | 'bytes' | 'ratio' | 'milliseconds' | 'timestamp' | 'text' | 'boolean' | 'rate'
export interface MBeanSemanticMetric { key: string; value: unknown; format: SemanticFormat; max?: number }
export interface MBeanSemanticMetricGroup { kind: 'primary' | 'secondary'; metrics: MBeanSemanticMetric[] }

/** 数值用于快速比较，时间与状态保留为辅助信息；分组只影响呈现，不改变读数。 */
export function groupMBeanSemanticMetrics(metrics: readonly MBeanSemanticMetric[]): MBeanSemanticMetricGroup[] {
  const primary: MBeanSemanticMetric[] = [], secondary: MBeanSemanticMetric[] = []
  for (const metric of metrics) {
    if (['count', 'bytes', 'ratio', 'rate'].includes(metric.format)) primary.push(metric)
    else secondary.push(metric)
  }
  return [
    ...(primary.length ? [{ kind: 'primary' as const, metrics: primary }] : []),
    ...(secondary.length ? [{ kind: 'secondary' as const, metrics: secondary }] : []),
  ]
}
type FieldSpec = readonly [string, SemanticFormat]
const fields: Record<string, readonly FieldSpec[]> = {
  DeviceSessionManager: [['Sessions', 'count'], ['KeepOnlineSize', 'count'], ['History', 'count'], ['DataBytes', 'text']],
  DeviceMessageMonitor: [['StartTime', 'timestamp'], ['SnapshotTime', 'timestamp'], ['ReceivedBytesTotal', 'bytes'], ['SentBytesTotal', 'bytes'], ['UpstreamMessagesTotal', 'count'], ['PropertyReportsTotal', 'count'], ['PropertyValuesTotal', 'count'], ['EventReportsTotal', 'count'], ['ReceivedPacketsTotal', 'count'], ['SentPacketsTotal', 'count'], ['ReceivedQps', 'rate'], ['SentQps', 'rate'], ['CommunicationQps', 'rate'], ['QpsSampleTime', 'timestamp'], ['QpsWindowMillis', 'milliseconds'], ['QpsReady', 'boolean']],
  ThingsDataManager: [['DataSize', 'count'], ['InMemorySize', 'count'], ['DirtyCount', 'count'], ['QueueDepth', 'count'], ['LastFlushDuration', 'milliseconds'], ['L1HitRatio', 'ratio']],
  ReactiveSqlExecutor: [['PendingSize', 'count']],
  SystemMonitorCollector: [['Running', 'boolean'], ['SuccessCount', 'count'], ['FailureCount', 'count'], ['LastSuccessTime', 'timestamp'], ['LastDurationMillis', 'milliseconds']],
  EventBus: [['TotalSubscribers', 'count'], ['TotalTopics', 'count'], ['StructuredPendingSyncPeerCount', 'count'], ['StructuredUnsupportedPeerCount', 'count'], ['StructuredBufferDropCount', 'count'], ['StructuredLastSuccessfulSyncTime', 'timestamp']],
}
export const mbeanAttributeValue = (bean: MBeanDescriptor, name: string) => bean.attributes.find(item => item.name === name && item.available)?.value
export function nonnegativeNumber(value: unknown) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value.trim()))) return undefined
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : undefined
}

/** 只投影已读取的廉价字段，不从摘要触发 getter 或方法，也不为缺失值补零。 */
export function mbeanSemanticMetrics(bean: MBeanDescriptor): MBeanSemanticMetric[] {
  if (bean.domain !== 'org.jetlinks') return []
  if (bean.type === 'NettyAllocator') {
    const value = mbeanAttributeValue(bean, 'Metrics')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const metrics = value as Record<string, unknown>
    return ['allocatorType', 'allocatorDirectUsed', 'allocatorHeapUsed', 'jvmDirectUsed', 'jvmDirectMax', 'pooledDirectPinned']
      .filter(key => key in metrics).map(key => ({ key, value: metrics[key], format: key === 'allocatorType' ? 'text' : 'bytes',
        max: key === 'jvmDirectUsed' ? nonnegativeNumber(metrics.jvmDirectMax) : undefined }))
  }
  return (fields[bean.type] ?? []).flatMap(([key, format]) => bean.attributes.some(item => item.name === key && item.available)
    ? [{ key, format, value: mbeanAttributeValue(bean, key) }] : [])
}

export function formatSemanticValue(value: unknown, format: SemanticFormat, locale?: string) {
  if (format === 'text') return typeof value === 'string' && value.trim() && value.trim() !== 'nil' ? value : '—'
  if (format === 'boolean') return typeof value === 'boolean' ? String(value) : '—'
  const number = nonnegativeNumber(value)
  if (number === undefined) return '—'
  if (format === 'bytes') return `${(number / 1048576).toFixed(1)} MiB`
  if (format === 'ratio') return number <= 1 ? `${(number * 100).toFixed(1)}%` : '—'
  if (format === 'timestamp') return number > 0 && Number.isFinite(new Date(number).getTime()) ? new Date(number).toLocaleString(locale) : '—'
  if (format === 'milliseconds') return `${number} ms`
  if (format === 'rate') return `${number.toLocaleString(locale, { maximumFractionDigits: 2 })} /s`
  // 十进制字符串保留 Java long 精度；转换只用于有限值及负数校验。
  return typeof value === 'string' ? value : String(number)
}

/** 最新错误是历史记录；nil / 空串明确表示无记录，缺字段保持未知。 */
export function mbeanErrorRecord(value: unknown) {
  return value === null ? '' : typeof value === 'string' ? value.trim() === 'nil' || !value.trim() ? '' : value : undefined
}

export function mbeanBufferCapacity(bean: MBeanDescriptor) {
  const used = nonnegativeNumber(mbeanAttributeValue(bean, 'StructuredBufferedEventCount'))
  const limit = nonnegativeNumber(mbeanAttributeValue(bean, 'StructuredBufferedEventLimit'))
  return { used, limit, percent: used !== undefined && limit !== undefined && limit > 0 ? Math.min(100, used / limit * 100) : undefined }
}

export interface BrokerBucket { label: string; count: number; percent: number }
const bucketPatterns = ['<=5ms', '5-20ms', '20-100ms', '100-300ms', '300-500ms', '500-1000ms', '1000-5000ms']
/** DistributionCounter 最后一桶实际没有上界；严格解析，不能把未知文本画成零分布。 */
export function brokerTimingBuckets(value: unknown): BrokerBucket[] | undefined {
  if (typeof value !== 'string') return undefined
  const segments = value.split(',')
  if (segments.length !== bucketPatterns.length) return undefined
  const counts = segments.map((segment, index) => {
    const match = /^(.*?)\((\d+)\)$/.exec(segment.trim())
    return match && match[1] === bucketPatterns[index] ? nonnegativeNumber(match[2]) : undefined
  })
  if (counts.some(count => count === undefined)) return undefined
  const total = (counts as number[]).reduce((sum, count) => sum + count, 0)
  if (!Number.isFinite(total)) return undefined
  return (counts as number[]).map((count, index) => ({ label: index === 6 ? '>1000 ms' : bucketPatterns[index].replace('ms', ' ms'), count, percent: total > 0 ? count / total * 100 : 0 }))
}

/** 仅结构明确的查询结果进入友好展示，未识别结果由调用方保留原文。 */
export function mbeanResultRecords(value: unknown): Record<string, unknown>[] | undefined {
  return Array.isArray(value) && value.every(item => item !== null && typeof item === 'object' && !Array.isArray(item)) ? value as Record<string, unknown>[] : undefined
}

export function brokerSlowCalls(value: unknown) {
  const buckets = brokerTimingBuckets(value)
  if (!buckets) return undefined
  const count = buckets[6].count, total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  // 无调用样本时没有比例依据；原始零计数仍由桶分布展示。
  return total > 0 ? { count, percent: count / total * 100 } : undefined
}

/** 按观测到的最慢桶占比、次数排序，未知分布排后；不修改服务端结果或补造耗时。 */
export function brokerListenerRows(value: unknown, filter = '') {
  const rows = mbeanResultRecords(value)
  if (!rows || rows.some(row => typeof row.name !== 'string')) return undefined
  const query = filter.trim().toLowerCase()
  return rows.filter(row => !query || [row.name, row.topic].map(item => JSON.stringify(item) ?? '').join(' ').toLowerCase().includes(query))
    .map(row => ({ row, slow: brokerSlowCalls(row.summary), total: nonnegativeNumber(row.total) }))
    .sort((left, right) => (right.slow?.percent ?? -1) - (left.slow?.percent ?? -1) || (right.slow?.count ?? -1) - (left.slow?.count ?? -1) || (right.total ?? -1) - (left.total ?? -1) || String(left.row.name).localeCompare(String(right.row.name)))
    .map(item => item.row)
}
