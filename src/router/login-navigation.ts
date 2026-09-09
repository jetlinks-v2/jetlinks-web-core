import type { ProjectRuntimeConfig } from '@jetlinks-web-core/utils/project-runtime'

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
 * 会话失效保留当前运行域以便恢复原页面；主动退出则离开 SaaS 项目域，
 * 防止下一次普通登录继续读取项目 token 与子账号登录上下文。
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
  let _origin = origin || location.origin
  if (reason === ACTIVE_LOGOUT_LOGIN_REASON) {
    let loginQuery = `${LOGIN_REASON_QUERY_KEY}=${ACTIVE_LOGOUT_LOGIN_REASON}`

    if (origin) {
      loginQuery += `&clearToken=true`
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
