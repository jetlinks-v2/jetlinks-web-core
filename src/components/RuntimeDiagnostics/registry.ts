import type { MBeanDescriptor, MBeanRenderer } from './types'
import { shallowReactive } from 'vue'
import { availableMBeanQueries } from './mbean/queries'
export { mbeanCatalogEntry, isJetLinksDomain, mbeanGroupKey, compareMBeanDomain } from './mbean/catalog'
const renderers = shallowReactive<MBeanRenderer[]>([])
// 以实际注册域、类型和getter契约声明摘要，避免同名扩展对象误命中。
const summaryFields: Record<string, Record<string, string[]>> = {
  'java.lang': {
    Memory: ['HeapMemoryUsage', 'NonHeapMemoryUsage', 'ObjectPendingFinalizationCount'],
    Threading: ['ThreadCount', 'PeakThreadCount', 'DaemonThreadCount', 'TotalStartedThreadCount'],
    GarbageCollector: ['CollectionCount', 'CollectionTime'], Runtime: ['StartTime', 'Uptime', 'VmName', 'VmVersion'],
  },
  'org.jetlinks': {
    PersistenceBuffer: ['Remainder', 'DeadSize', 'Wip', 'WriterPending', 'WriterFallback'],
    Tracing: ['Enabled', 'Size', 'SizeInMemory', 'SizeInMemoryBytes', 'MaxInMemoryBytes', 'StoreBytes'],
    NettyAllocator: ['Metrics'],
    ReactiveSqlExecutor: ['PendingSize'],
    ThingsDataManager: ['DataSize', 'InMemorySize', 'DirtyCount', 'QueueDepth', 'LastFlushDuration', 'L1HitRatio'],
    DeviceSessionManager: ['Sessions', 'KeepOnlineSize', 'History', 'DataBytes'],
    DeviceMessageMonitor: ['StartTime', 'SnapshotTime', 'ReceivedBytesTotal', 'SentBytesTotal', 'UpstreamMessagesTotal', 'PropertyReportsTotal', 'PropertyValuesTotal', 'EventReportsTotal', 'ReceivedPacketsTotal', 'SentPacketsTotal', 'ReceivedQps', 'SentQps', 'CommunicationQps', 'QpsSampleTime', 'QpsWindowMillis', 'QpsReady'],
    EventBus: ['TotalSubscribers', 'TotalTopics', 'StructuredBufferedEventCount', 'StructuredBufferedEventLimit', 'StructuredPendingSyncPeerCount', 'StructuredUnsupportedPeerCount', 'StructuredBufferDropCount', 'StructuredLastSuccessfulSyncTime', 'StructuredLastError'],
    KafkaConsumer: ['In', 'Consumed', 'ErrorTime', 'Subscribed', 'ClientId'],
    SystemMonitorCollector: ['Running', 'SuccessCount', 'FailureCount', 'LastSuccessTime', 'LastDurationMillis'],
    ThingAggregation: ['WriteBatches', 'WritePoints', 'WriteFailures', 'QueryFailures', 'RefreshFailures'],
    DeviceMetricCollector: ['ActiveCollections', 'ActiveSubscriptions', 'PointsAccepted', 'PointsDropped', 'WriteFailures'],
    AiAgent: ['ActiveSessions', 'ActiveTurns', 'CompletedTurns', 'FailedTurns', 'PendingConfirmations'],
    AiAgentSession: ['LocalRuntimeCount', 'PendingProjectedWriteSize', 'LiveMessageOverflows', 'AttachedMessageEmitFailures'],
    AiAgentFile: ['ReadOps', 'WriteOps', 'TotalBytesWritten', 'QuotaRejections', 'OtherRejections'],
    FileStorageCleaner: ['CleanupCount', 'DeletedFiles', 'DeletedSize', 'FailedFiles', 'LastCleanupTime'],
  },
  'org.jetlinks.pro.event.delivery': { EventDeliveryManager: ['RegistrationCount', 'ActiveDeliveryCount', 'RetryCount', 'DeadCount', 'SucceededCount'] },
  'org.jetlinks.pro.event.subscription': { EventSubscriptionManager: ['ActiveSubscriptionCount', 'PendingDeliveryCount', 'FailedDeliveryCount', 'DroppedDeliveryCount', 'RetryCount'] },
}

export const mbeanSummaryFields = (bean: MBeanDescriptor) => summaryFields[bean.domain]?.[bean.type] ?? []

/** 仅匹配已核实的域与最低字段契约；同名业务对象仍走通用属性表。 */
export function supportsMBeanSummary(bean: MBeanDescriptor) {
  return availableMBeanQueries(bean).length > 0 || mbeanSummaryFields(bean).some(field => bean.attributes.some(attribute => attribute.name === field && attribute.available))
}

/** 宿主注册专用展示；注销仅移除该注册，渲染器不持有API或调用权限。 */
export function registerMBeanRenderer(renderer: MBeanRenderer) {
  const previous = renderers.findIndex(item => item.id === renderer.id)
  if (previous >= 0) renderers.splice(previous, 1)
  renderers.unshift(renderer)
  return () => { const index = renderers.indexOf(renderer); if (index >= 0) renderers.splice(index, 1) }
}

/** 匹配器失败时继续回退，保证未知或版本不匹配的对象仍可读取。 */
export function resolveMBeanRenderer(bean: MBeanDescriptor) {
  return renderers.find(renderer => { try { return renderer.match(bean) } catch { return false } })?.component
}
