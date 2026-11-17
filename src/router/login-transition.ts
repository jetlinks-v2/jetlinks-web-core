import type { LoginNavigationReason } from './login-navigation'

type LoginNavigation = (reason: LoginNavigationReason) => void

let pendingLogoutRequests = 0
let logoutSucceeded = false
let navigationStarted = false
let navigationScheduled = false
let pendingNavigation: { reason: LoginNavigationReason; navigate: LoginNavigation } | undefined

/** 同一文档只发起一次整页回跳，退出请求完成前暂缓旧请求的 401。 */
const scheduleLoginNavigation = () => {
  if (pendingLogoutRequests || navigationScheduled || navigationStarted || !pendingNavigation) return
  navigationScheduled = true
  setTimeout(() => {
    navigationScheduled = false
    if (pendingLogoutRequests || navigationStarted || !pendingNavigation) return

    const { reason, navigate } = pendingNavigation
    pendingNavigation = undefined
    navigationStarted = true
    navigate(logoutSucceeded ? 'logout' : reason)
  })
}

/** 在退出请求发出前登记；返回的完成函数必须在成功或失败时调用。 */
export const beginLogoutRequest = () => {
  pendingLogoutRequests += 1
  let completed = false
  return (success: boolean) => {
    if (completed) return
    completed = true
    pendingLogoutRequests -= 1
    logoutSucceeded ||= success
    scheduleLoginNavigation()
  }
}

/** 主动退出优先于会话失效；退出失败时仍允许已等待的失效导航继续。 */
export const requestLoginNavigation = (reason: LoginNavigationReason, navigate: LoginNavigation) => {
  if (navigationStarted) return
  if (!pendingNavigation || reason === 'logout') {
    pendingNavigation = { reason, navigate }
  }
  scheduleLoginNavigation()
}
