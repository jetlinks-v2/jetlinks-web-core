import type { LoginNavigationReason } from './login-navigation'

type LoginNavigation = (reason: LoginNavigationReason) => void

let pendingLogoutRequests = 0
let logoutSucceeded = false
let navigationStarted = false
let navigationScheduled = false
let pendingNavigation: { reason: LoginNavigationReason; navigate: LoginNavigation } | undefined
let navigationGeneration = 0

/** 登录路由成功落地后结束本轮协调；同文档重新登录时必须允许再次退出。 */
export const completeLoginNavigation = () => {
  navigationGeneration += 1
  pendingLogoutRequests = 0
  logoutSucceeded = false
  navigationStarted = false
  navigationScheduled = false
  pendingNavigation = undefined
}

/** 每轮只发起一次回跳，退出请求完成前暂缓旧请求的 401。 */
const scheduleLoginNavigation = () => {
  if (pendingLogoutRequests || navigationScheduled || navigationStarted || !pendingNavigation) return
  navigationScheduled = true
  const generation = navigationGeneration
  setTimeout(() => {
    if (generation !== navigationGeneration) return
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
  const generation = navigationGeneration
  let completed = false
  return (success: boolean) => {
    // 已进入下一轮时，旧请求不能修改新会话的等待计数或退出原因。
    if (completed || generation !== navigationGeneration) return
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
