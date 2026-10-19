import { BASE_API, TOKEN_KEY } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'

import { edgeDefaultUrl, isSubApp } from './consts'
import { getProjectIdFromLocation } from './project-path'
import { getProjectStorage, isProjectStorageEnabled, type ProjectStorageInfo } from './project-storage'
import { getApplicationRuntimeEntry } from './project-runtime'
import { APPLICATION_SCOPE_HEADER, applyApplicationScopeHeaders, type MenuApplicationScope } from './application-scope'

const TENANT_DOMAIN_KEY = 'X-Tenant-Domain'
const VERIFY_CACHE_KEY = 'jetlinks_verify_cache'

/** 应用路径不是租户域名；应用仅复用已保存的项目域名，不能用应用 ID 兜底。 */
export const getRequestTenantDomain = (tenantDomain?: false): string | undefined => {
  if (tenantDomain === false || !isProjectStorageEnabled()) return undefined

  const code = getProjectIdFromLocation()
  const storedDomain = code ? getProjectStorage(code)?.domain : undefined
  const domain = typeof storedDomain === 'string' ? storedDomain.trim() : ''
  const entry = getApplicationRuntimeEntry()
  if (entry.type === 'application') {
    return domain && domain !== entry.applicationId ? domain : undefined
  }

  return domain || code || undefined
}

export const isFromCloud = () => (
  ['cloud', 'cloud-pc'].includes(String(localStorage.getItem('terminal')))
  && window.location.href.includes(edgeDefaultUrl)
)

export const getFromCloudPathName = (path?: string) => {
  const { pathname, origin } = window.location
  let url = origin + pathname
  if ('cloud-pc' === String(localStorage.getItem('terminal'))) {
    url = `/edge/${localStorage.getItem('thingType')}/${localStorage.getItem('thingId')}/_`
    if (localStorage.getItem('proxy')) {
      url = localStorage.getItem('proxy') + url
    }
  } else if (url.endsWith('/')) {
    url = `${window.location.pathname}/edge/${localStorage.getItem('thingType')}/${localStorage.getItem('thingId')}/_`
  }
  return path ? url + path : url
}

export const getBaseApi = () => {
  if (isSubApp) {
    const global = (window as any).microApp.getGlobalData()
    return global.api?.getBaseApi?.() || BASE_API
  }

  return isFromCloud() ? getFromCloudPathName() : BASE_API
}

/**
 * 获取与平台普通请求一致的当前 API 地址。
 *
 * 项目运行态可能使用独立的 API 地址，不能让 fetch、流式请求等非 Axios
 * 传输绕回页面默认的 `/api`。
 */
export const getRequestBaseApi = () => {
  const projectId = isProjectStorageEnabled() ? getProjectIdFromLocation() : ''
  const projectApi = projectId ? getProjectStorage(projectId)?.apiUrl : undefined

  return projectApi || getBaseApi()
}

type RequestTarget = {
  url?: string
  baseURL?: string
}

/** 仅识别真正的边端代理路径，云端 /edge/device/_query 等管理接口仍使用云端上下文。 */
const isEdgeRequest = ({ url = '', baseURL }: RequestTarget): boolean => {
  if (isFromCloud()) return true

  // Axios 的绝对 URL 忽略 baseURL；相对 URL（包括以 / 开头）追加在 baseURL 后。
  const target = /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(url)
    ? url
    : `${(baseURL ?? getRequestBaseApi() ?? '').replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`
  try {
    return /(?:^|\/)edge\/[^/]+\/[^/]+\/_(?:\/|$)/.test(new URL(target, window.location.origin).pathname)
  } catch {
    // 无效 URL 交给传输层处理，不因解析失败而改写云端权限上下文。
    return false
  }
}

/** 边端没有租户和云端资产 Scope，发送前清理显式头与重试残留，头名称不区分大小写。 */
export const stripEdgeRequestHeaders = (headers: Record<string, unknown>, target: RequestTarget = {}): void => {
  if (!isEdgeRequest(target)) return

  for (const key of Object.keys(headers)) {
    const name = key.toLowerCase()
    if (name === TENANT_DOMAIN_KEY.toLowerCase() || name === APPLICATION_SCOPE_HEADER.toLowerCase()) {
      delete headers[key]
    }
  }
}

const getVerifyHeaders = (): Record<string, string> => {
  if (typeof localStorage === 'undefined') return {}

  try {
    const raw = localStorage.getItem(VERIFY_CACHE_KEY)
    if (!raw) return {}

    const cache = JSON.parse(raw) as { key?: unknown; token?: unknown }
    const key = typeof cache.key === 'string' ? cache.key : ''
    const token = typeof cache.token === 'string' ? cache.token : ''

    return key && token
      ? {
          'x-verify-key': key,
          'x-verify-token': token,
        }
      : {}
  } catch {
    return {}
  }
}

export const getRequestHeaders = (options: RequestTarget & {
  applicationScope?: MenuApplicationScope
  projectContext?: false
  tenantDomain?: false
} = {}): Record<string, string> => {
  const headers: Record<string, string> = {}
  const projectId = isProjectStorageEnabled() ? getProjectIdFromLocation() : ''
  const projectStorage = projectId ? getProjectStorage(projectId) : undefined
  const token = (options.projectContext === false ? undefined : projectStorage?.token) || getToken()
  const domain = getRequestTenantDomain(options.tenantDomain)

  if (token) headers[TOKEN_KEY] = token
  if (domain) headers[TENANT_DOMAIN_KEY] = domain
  applyApplicationScopeHeaders(
    headers,
    options.applicationScope,
    getApplicationRuntimeEntry().applicationId,
    options.projectContext,
  )
  stripEdgeRequestHeaders(headers, options)

  return {
    ...headers,
    ...getVerifyHeaders(),
  }
}

export const getUploadHeaders = getRequestHeaders

/** 使用当前请求的凭证和 API 地址进入应用，兼容没有项目会话的独立部署。 */
export const getApplicationAccessContext = (): ProjectStorageInfo => {
  const headers = getRequestHeaders()
  return {
    token: headers[TOKEN_KEY],
    apiUrl: getRequestBaseApi(),
    domain: headers[TENANT_DOMAIN_KEY],
  }
}
