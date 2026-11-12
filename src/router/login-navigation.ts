import type { ProjectRuntimeConfig } from '@jetlinks-web-core/utils/project-runtime'
import { createProjectPathRuntimeHref } from '@jetlinks-web-core/utils/project-path'
import { isPrivateDeployment } from '@jetlinks-web-core/utils/deployment'

export const LOGIN_REASON_QUERY_KEY = 'reason'
export const ACTIVE_LOGOUT_LOGIN_REASON = 'logout'

export type LoginNavigationReason = 'session-expired' | 'logout'

export interface LoginNavigationLocation {
  origin: string
  pathname: string
  hash: string
}

export interface CreateLoginNavigationHrefOptions {
  currentPath: string
  isProjectRuntime: boolean
  location: LoginNavigationLocation
  loginPath: string
  reason: LoginNavigationReason
  runtimeConfig: ProjectRuntimeConfig
  origin: string | null
}

/**
 * 创建登录页地址。
 *
 * 会话失效保留原页面回跳；从云平台进入的项目主动退出后返回其项目登录入口，
 * 由目标站点清理上一会话凭证，项目编码仅作为下一次登录的定位上下文。
 */
export const createLoginNavigationHref = ({
  currentPath,
  isProjectRuntime: projectRuntime,
  location,
  loginPath,
  reason,
  runtimeConfig,
  origin
}: CreateLoginNavigationHrefOptions) => {
  const _origin = origin || location.origin
  if (reason === ACTIVE_LOGOUT_LOGIN_REASON) {
    let loginQuery = `${LOGIN_REASON_QUERY_KEY}=${ACTIVE_LOGOUT_LOGIN_REASON}`

    if (origin) {
      loginQuery += `&clearToken=true`
    }

    if (origin && projectRuntime && runtimeConfig.projectCode && !isPrivateDeployment()) {
      return `${_origin}${createProjectPathRuntimeHref(runtimeConfig.projectCode, `${loginPath}?${loginQuery}`)}`
    }

    if (runtimeConfig.fixedProject) {
      return `${_origin}${runtimeConfig.basePath}#${loginPath}?${loginQuery}`
    }

    const pathname = projectRuntime ? '/' : location.pathname
    return `${_origin}${pathname}#${loginPath}?${loginQuery}`
  }

  const hashPrefix = location.hash ? '#' : ''
  return `${_origin}${location.pathname}${hashPrefix}${loginPath}?redirect=${encodeURIComponent(currentPath)}`
}

export const isActiveLogoutLoginReason = (value: unknown) => {
  return Array.isArray(value)
    ? value.includes(ACTIVE_LOGOUT_LOGIN_REASON)
    : value === ACTIVE_LOGOUT_LOGIN_REASON
}
