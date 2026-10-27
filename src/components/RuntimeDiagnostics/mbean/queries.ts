import type { MBeanDescriptor, MBeanInvocation, MBeanOperation, MBeanQueryId } from '../types'
import { mbeanInvocationArguments } from './arguments'

interface QueryDefinition { id: MBeanQueryId; type: string; instance: string; operation: string; signature: string[] }
/** 只允许已核实实现的只读方法；不按 get/load 前缀推断安全性。 */
const definitions: readonly QueryDefinition[] = [
  { id: 'deviceSession', type: 'DeviceSessionManager', instance: 'PersistenceDeviceSessionManager', operation: 'getSession', signature: ['java.lang.String'] },
  { id: 'eventSubscribers', type: 'EventBus', instance: 'ClusterEventBus', operation: 'getSubscribers', signature: ['java.lang.String'] },
  { id: 'structuredSubscriptions', type: 'EventBus', instance: 'ClusterEventBus', operation: 'structuredSubscriptionSummary', signature: ['int'] },
  { id: 'brokerAll', type: 'SpringMessageBroker', instance: 'SpringMessageBroker', operation: 'loadAll', signature: [] },
  { id: 'brokerByName', type: 'SpringMessageBroker', instance: 'SpringMessageBroker', operation: 'load', signature: ['java.lang.String'] },
]

function queryOperation(bean: MBeanDescriptor, definition: QueryDefinition): MBeanOperation | undefined {
  if (bean.domain !== 'org.jetlinks' || bean.type !== definition.type || bean.name !== definition.instance) return undefined
  return bean.operations.find(operation => operation.name === definition.operation &&
    JSON.stringify(operation.signature) === JSON.stringify(definition.signature) &&
    operation.parameters.length === definition.signature.length &&
    operation.parameters.every((parameter, index) => parameter.type === definition.signature[index]))
}

export function availableMBeanQueries(bean: MBeanDescriptor | undefined): MBeanQueryId[] {
  return bean ? definitions.filter(definition => queryOperation(bean, definition)).map(definition => definition.id) : []
}

/** 输入按 canonical metadata 的参数顺序组装，拒绝缺项、额外参数及无界查询。 */
export function mbeanQueryInvocation(bean: MBeanDescriptor, id: MBeanQueryId, values: readonly (string | undefined)[]): MBeanInvocation | undefined {
  const definition = definitions.find(item => item.id === id)
  const operation = definition && queryOperation(bean, definition)
  if (!operation || values.length !== operation.signature.length) return undefined
  if (id === 'structuredSubscriptions') {
    if (!/^\d+$/.test(values[0] ?? '') || Number(values[0]) < 1 || Number(values[0]) > 200) return undefined
  } else if (values.some(value => !value?.trim())) return undefined
  try { return { bean, operation, args: mbeanInvocationArguments(operation, [...values]) } } catch { return undefined }
}
