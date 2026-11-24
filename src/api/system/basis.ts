import { request } from '@jetlinks-web/core'

// 保存
export const save_api = (data: any) => request.post(`/system/config/scope/_save`, data)
/** 按调用方的请求身份批量读取系统配置。 */
export const getDetails_api = (scopes: readonly string[], client: Pick<typeof request, 'post'> = request) =>
  client.post<any>('/system/config/scopes', scopes, { applicationScope: false })

/**
 * 系统版本
 */
export const systemVersion = () => request.get('/system/version', undefined, { projectContext: false, tenantDomain: false })

/**
 * 系统配置信息
 * @param scopes
 */
export const settingDetail = (scopes: string) => request.get(`/system/config/${scopes}`, {}, { projectContext: false, tenantDomain: false })

/**
 * 判断预处理数据是否开启
 */
export const preprocessorExists = () => request.get(`/command-supports/service/metadataPreprocessor/exists`, undefined, { applicationScope: false })
