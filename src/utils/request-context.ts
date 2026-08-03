import { BASE_API, TOKEN_KEY } from '@jetlinks-web/constants'
import { getToken } from '@jetlinks-web/utils'

import { edgeDefaultUrl, isSubApp } from './consts'
import { getProjectIdFromLocation } from './project-path'
import { getProjectStorage, isProjectStorageEnabled } from './project-storage'

const TENANT_DOMAIN_KEY = 'X-Tenant-Domain'
const VERIFY_CACHE_KEY = 'jetlinks_verify_cache'

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

const getVerifyHeaders = () => {
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

export const getRequestHeaders = () => {
  const headers: Record<string, string> = {}
  const projectId = isProjectStorageEnabled() ? getProjectIdFromLocation() : ''
  const projectStorage = projectId ? getProjectStorage(projectId) : undefined
  const token = projectStorage?.token || getToken()

  if (token) headers[TOKEN_KEY] = token
  if (projectStorage?.domain) headers[TENANT_DOMAIN_KEY] = projectStorage.domain

  return {
    ...headers,
    ...getVerifyHeaders(),
  }
}

export const getUploadHeaders = getRequestHeaders
