import axios from 'axios'
import type { AxiosResponseRewrite } from '@jetlinks-web/types'
import { langKey } from '@jetlinks-web-core/utils/consts'
import { getBaseApi, getRequestTenantDomain, stripEdgeRequestHeaders } from '@jetlinks-web-core/utils/request-context'

const client = axios.create({ timeout: 15000, withCredentials: false })

/** 公开授权只使用链接标识和密码等验证信息；项目域名仍用于网关路由。 */
async function requestShareAuthorization<T>(method: 'GET' | 'POST', url: string, body?: unknown) {
  const baseURL = getBaseApi() || '/'
  const headers: Record<string, string> = {}
  const language = localStorage.getItem(langKey)
  const domain = getRequestTenantDomain()
  if (language) headers[langKey] = language
  if (domain) headers['X-Tenant-Domain'] = domain
  stripEdgeRequestHeaders(headers, { url, baseURL })
  const { data } = await client.request<AxiosResponseRewrite<T>>({
    method, url, baseURL, headers, data: body,
  })
  const payload = data && typeof data === 'object' ? data : ({} as AxiosResponseRewrite<T>)
  return { ...payload, success: payload.success ?? payload.status === 200 }
}

export const getTokenConfig = (tokenId: string) =>
  requestShareAuthorization<{ authType: string; authConfiguration?: Record<string, unknown> }>(
    'GET', `/personal/token/${encodeURIComponent(tokenId)}/_config`,
  )

export const getTokenRedirect = (tokenId: string, data: unknown) =>
  requestShareAuthorization<string>('POST', `/personal/token/${encodeURIComponent(tokenId)}/_redirect`, data)

export const getShareCaptcha = () =>
  requestShareAuthorization<{ base64: string; key: string }>('GET', '/authorize/captcha/image?width=130&height=30')
