import type { MBeanDescriptor } from '../types'

const typesByDomain: Record<string, string[]> = {
  'java.lang': ['Runtime', 'Memory', 'Threading', 'GarbageCollector', 'OperatingSystem', 'MemoryPool', 'ClassLoading', 'Compilation'],
  'java.nio': ['BufferPool'],
  'org.jetlinks': ['PersistenceBuffer', 'Tracing', 'NettyAllocator', 'ReactiveSqlExecutor', 'ThingsDataManager', 'DeviceSessionManager', 'DeviceMessageMonitor', 'EventBus', 'SpringMessageBroker', 'KafkaConsumer', 'SystemMonitorCollector', 'ThingAggregation', 'DeviceMetricCollector', 'AiAgent', 'AiAgentSession', 'AiAgentFile', 'FileStorageCleaner'],
  'org.jetlinks.pro.event.delivery': ['EventDeliveryManager'],
  'org.jetlinks.pro.event.subscription': ['EventSubscriptionManager'],
}

/** 按完整域与类型识别说明，不以实例名称猜测实现或权限。 */
export function mbeanCatalogEntry(bean: Pick<MBeanDescriptor, 'domain' | 'type'>) {
  if (!typesByDomain[bean.domain]?.includes(bean.type)) return undefined
  return { nameKey: `runtimeDiagnostics.catalog.${bean.type}.name`, descriptionKey: `runtimeDiagnostics.catalog.${bean.type}.description` }
}

export const isJetLinksDomain = (domain: string) => domain === 'org.jetlinks' || domain.startsWith('org.jetlinks.')
export const mbeanGroupKey = (domain: string, type?: string) => JSON.stringify(type ? [domain, type] : [domain])

/** JetLinks 域族优先；同类按技术名称稳定排序，不随语言改变身份。 */
export function compareMBeanDomain(left: string, right: string) {
  const priority = (domain: string) => isJetLinksDomain(domain) ? 0 : domain.startsWith('java.') ? 1 : 2
  return priority(left) - priority(right) || left.localeCompare(right)
}
