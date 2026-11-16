import { request } from '@jetlinks-web/core'
import type { AxiosResponseRewrite } from '@jetlinks-web/types'

export interface DocumentHelpConfiguration {
  code: string
  key: string
  content: string
  enabled?: boolean
}
export type DocumentHelpSettings = Record<string, DocumentHelpConfiguration>

/** 与平台图标、base-path 一样读取系统配置，不依赖专用帮助接口。 */
export const getDocumentHelpSettings = (signal?: AbortSignal): Promise<AxiosResponseRewrite<DocumentHelpSettings>> =>
  request.get('/system/config/document-help', {}, {
    signal, hiddenError: true, projectContext: false, tenantDomain: false,
  })

export const getDocumentHelpContent = async (point: Pick<DocumentHelpConfiguration, 'code' | 'key'>, signal: AbortSignal): Promise<AxiosResponseRewrite<DocumentHelpConfiguration>> => {
  const response = await getDocumentHelpSettings(signal)
  const configuration = Object.values(response.result || {}).find(item => item.code === point.code && item.key === point.key)
  const result = configuration || { ...point, content: '', enabled: false }
  return { ...response, data: result, result }
}
