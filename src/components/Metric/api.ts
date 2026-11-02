import { request, type Request } from '@jetlinks-web/core'
import type { MetricApi, MetricConfig, MetricLatest, MetricTemplate, MetricTemplateEntity, MetricValue, MetricSimulationResponse } from './types'

const options = { hiddenError: true }
const http: Pick<Request, 'get' | 'post' | 'put' | 'remove'> = request
const id = encodeURIComponent
/** API 保留平台请求上下文和授权处理；组件只消费领域结果。 */
function result<T>(response: { result: T; status?: number; message?: string }): T {
  if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
  return response.result
}
export const metricApi: MetricApi = {
  getConfig: async configId => result(await http.get<MetricConfig>(`/metric/configs/${id(configId)}`, undefined, options)),
  byOwner: async (type, ownerId) => result(await http.get<MetricConfig[]>(`/metric/configs/owner/${id(type)}/${id(ownerId)}`, undefined, options)),
  selectable: async () => result(await http.get<MetricTemplateEntity[]>('/metric/configs/templates', undefined, options)),
  configTemplate: async configId => result(await http.get<MetricTemplate>(`/metric/configs/${id(configId)}/template`, undefined, options)),
  saveConfig: async config => result(await http.post<MetricConfig>('/metric/configs', config, options)),
  removeConfig: async configId => { result(await http.remove(`/metric/configs/${id(configId)}`, undefined, options)) },
  latest: async configIds => result(await http.post<MetricLatest[]>('/metric/configs/_latest', { configIds }, options)),
  history: async (configId, query) => result(await http.post<MetricValue[]>(`/metric/configs/${id(configId)}/history`, query, options)),
  queryTemplates: async query => result(await http.post<{ data: MetricTemplateEntity[]; total: number }>('/metric/templates/_query', query, options)),
  saveTemplate: async template => result(await http.post<MetricTemplateEntity>('/metric/templates', template, options)),
  releaseTemplate: async templateId => { result(await http.post(`/metric/templates/${id(templateId)}/_release`, undefined, options)) },
  setAvailable: async (templateId, available) => { result(await http.put(`/metric/templates/${id(templateId)}/available/${available}`, undefined, options)) },
  removeTemplate: async templateId => { result(await http.remove(`/metric/templates/${id(templateId)}`, undefined, options)) },
  simulate: async simulation => result(await http.post<MetricSimulationResponse>('/metric/templates/_simulate', simulation, options))
}

