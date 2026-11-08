import { request, wsClient, type Request } from '@jetlinks-web/core'
import { createRuntimeNdJson } from '../../utils/ndjson'
import { parseJsonResponseWithPrecision } from '../../utils/json'
import { map } from 'rxjs'
import type { MetricApi, MetricBuiltinItem, MetricCalculatorDescriptor, MetricConfig, MetricLatest, MetricTemplate, MetricTemplateEntity, MetricTemplateRevision, MetricValue, MetricSimulationResponse } from './types'

const options = { hiddenError: true, transformResponse: [parseJsonResponseWithPrecision] }
const http: Pick<Request, 'get' | 'post' | 'put' | 'remove'> = request
const id = encodeURIComponent
/** API 保留平台请求上下文和授权处理；组件只消费领域结果。 */
function result<T>(response: { result: T; status?: number; message?: string }): T {
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}
export const metricApi: MetricApi = {
  aggregate: async query => result(await http.post<import('./collection/types').MetricAggregateResult>('/metric/configs/_aggregate', query, options)),
  collectionOverview: async query => result(await http.post<import('./collection/types').MetricScopeOverview>('/metric/configs/_collection/overview', query, options)),
  collection: async query => result(await http.post<import('./collection/types').MetricCollectionResult>('/metric/configs/_collection', query, options)),
  builtinSources: async (type, objectId) => result(await http.get<MetricBuiltinItem[]>(`/metric/configs/sources/builtin/${id(type)}/${id(objectId)}`, undefined, options)),
  describeSource: async source => result(await http.post<import('./types').MetricProviderSourceDescription>('/metric/configs/sources/_describe', source, options)),
  templateCategories: async () => {
    const items = result(await http.get<{ value:string; text:string; ordinal?:number }[]>('/dictionary/metric-template-category/items', undefined, options))
    return [...items].sort((a,b) => (a.ordinal || 0) - (b.ordinal || 0)).map(item => ({ value:item.value, label:item.text }))
  },
  calculators: async () => result(await http.get<MetricCalculatorDescriptor[]>('/metric/templates/calculators', undefined, options)),
  simulateConfig: async simulation => result(await http.post<MetricSimulationResponse>('/metric/configs/simulate', simulation, options)),
  getConfig: async (configId, target) => result(await http.get<MetricConfig>(`/metric/configs/${id(configId)}`, target, options)),
  byOwner: async (type, ownerId) => result(await http.get<MetricConfig[]>(`/metric/configs/owner/${id(type)}/${id(ownerId)}`, undefined, options)),
  selectable: async () => result(await http.get<MetricTemplateEntity[]>('/metric/configs/templates', undefined, options)),
  configTemplate: async (configId, target) => result(await http.get<MetricTemplate>(`/metric/configs/${id(configId)}/template`, target, options)),
  saveConfig: async config => result(await http.post<MetricConfig>('/metric/configs', config, options)),
  removeConfig: async configId => { result(await http.remove(`/metric/configs/${id(configId)}`, undefined, options)) },
  latest: async (configIds, target) => result(await http.post<MetricLatest[]>('/metric/configs/_latest', { configIds, ...target }, options)),
  watchLatest: (configIds, target, interval, onValue, onError) => {
    const subscription = createRuntimeNdJson().post('/metric/configs/_latest', { configIds, ...target, interval })
      .pipe(map((value: unknown) => {
        const envelope = value as { success?: boolean; result?: MetricLatest; message?: string; status?: number }
        if (envelope.success === false || envelope.status && envelope.status >= 400) {
          throw new Error(envelope.message || String(envelope.status))
        }
        return envelope.result || value as MetricLatest
      })).subscribe({ next: onValue, error: onError, complete: () => onError(new Error('Metric stream closed')) })
    return () => subscription.unsubscribe()
  },
  subscribe: (target, interval, onValue, onError) => {
    const subscription = wsClient.getWebSocket(`metric-results-${crypto.randomUUID()}`,
      `/@${target.targetType}/${target.targetId}/metric/*/*/data`, { interval })
      .subscribe({ next: message => { if (message.payload) onValue(message.payload as MetricValue) }, error: onError })
    return () => subscription.unsubscribe()
  },
  history: async (configId, query) => result(await http.post<MetricValue[]>(`/metric/configs/${id(configId)}/history`, query, options)),
  execution: async (configId, output, query, signal) => result(await http.get<import('./types').MetricExecutionSnapshot | undefined>(`/metric/configs/${id(configId)}/execution/${id(output)}`, query, { ...options, signal })),
  queryTemplates: async query => result(await http.post<{ data: MetricTemplateEntity[]; total: number }>('/metric/templates/_query', query, options)),
  saveTemplate: async (template, editRevision) => result(await http.post<MetricTemplateEntity>(`/metric/templates${editRevision === undefined ? '' : `?editRevision=${editRevision}`}`, template, options)),
  releaseTemplate: async (templateId, editRevision) => result(await http.post<MetricTemplateEntity>(`/metric/templates/${id(templateId)}/_release${editRevision === undefined ? '' : `?editRevision=${editRevision}`}`, undefined, options)),
  discardTemplateDraft: async (templateId, editRevision) => result(await http.post<MetricTemplateEntity>(`/metric/templates/${id(templateId)}/_discard-draft?editRevision=${editRevision}`, {}, options)),
  templateRevisions: async (templateId, before) => result(await http.get<MetricTemplateRevision[]>(`/metric/templates/${id(templateId)}/revisions`, { before }, options)),
  templateReferences: async (templateId, cursor) => result(await http.get<MetricConfig[]>(`/metric/configs/template/${id(templateId)}/references`, { cursor, limit: 32 }, options)),
  applyTemplateRevision: async (configId, revision, expectedRevision) => result(await http.post<MetricConfig>(`/metric/configs/${id(configId)}/template-revision/${revision}?expectedRevision=${expectedRevision}`, undefined, options)),
  setAvailable: async (templateId, available) => { result(await http.put(`/metric/templates/${id(templateId)}/available/${available}`, undefined, options)) },
  removeTemplate: async templateId => { result(await http.remove(`/metric/templates/${id(templateId)}`, undefined, options)) },
  simulate: async simulation => result(await http.post<MetricSimulationResponse>('/metric/templates/_simulate', simulation, options))
}
