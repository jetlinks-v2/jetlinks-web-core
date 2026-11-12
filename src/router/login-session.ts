import { removeToken } from '@jetlinks-web/utils'
import { deleteRouteQueryParam, getRouteQueryParam } from '@jetlinks-web-core/utils/application-scope'
import { isProjectRuntime } from '@jetlinks-web-core/utils/project-runtime'
import { isProjectStorageEnabled } from '@jetlinks-web-core/utils/project-storage'
import { isActiveLogoutLoginReason, LOGIN_REASON_QUERY_KEY } from './login-navigation'

export const LOGOUT_AUTH_QUERY_KEYS = ['clearToken', 'token', 'from', 'applicationAccess'] as const

let logoutEntryConsumed = false

/** 项目登录与云平台主账号会话独立，登录请求不能回退使用主账号凭证。 */
export const isProjectLoginEntry = () => (
  isProjectStorageEnabled() && isProjectRuntime() && /^#\/login(?:\?|$)/.test(window.location.hash)
)

/**
 * 在目标站点初始化登录请求前结束上一会话，并消费会恢复旧凭证的 URL 参数。
 * 保留退出原因供登录路由清理临时态；同一文档不因残留 reason 再删除新登录凭证。
 */
export const consumeLogoutLoginEntry = (clearVerification: () => void): boolean => {
  const url = new URL(window.location.href)
  const clearRequested = getRouteQueryParam(url, 'clearToken') === 'true'
  const activeLogout = isActiveLogoutLoginReason(getRouteQueryParam(url, LOGIN_REASON_QUERY_KEY))
  if (!clearRequested && (!activeLogout || logoutEntryConsumed)) return false

  // 项目退出只结束当前项目会话，云平台主账号的 token 继续保留。
  removeToken()
  clearVerification()
  for (const key of LOGOUT_AUTH_QUERY_KEYS) deleteRouteQueryParam(url, key)
  window.history.replaceState(window.history.state, '', url.toString())
  logoutEntryConsumed = true
  return true
}
