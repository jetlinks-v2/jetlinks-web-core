import { createApp } from 'vue'
import { CanceledError } from 'axios'
import { getToken, removeToken } from '@jetlinks-web/utils'
import pinia from '@jetlinks-web-core/store/pinia'
import i18n from '@jetlinks-web-core/locales'
import { clearVerifyCache } from '@jetlinks-web-core/package'
import { jumpLogin } from '@jetlinks-web-core/router'
import Relogin from './index.vue'

/** 成功后放行请求；退出以取消异常结束等待队列，并释放独立应用和容器。 */
export const openRelogin = async (): Promise<unknown> => {
  // 登录页及退出后的迟到 401 已无可恢复会话，不能再次创建弹窗。
  if (!getToken()) {
    throw new CanceledError('relogin_canceled')
  }

  const container = document.createElement('div')
  const app = createApp(Relogin).use(pinia).use(i18n)
  document.body.appendChild(container)
  try {
    const dialog = app.mount(container) as InstanceType<typeof Relogin>
    const result = await dialog.open()
    if (!result) {
      // jumpLogin 异步清理会话；先移除凭证，封住跳转前迟到响应的续登入口。
      removeToken()
      clearVerifyCache()
      jumpLogin()
      // 请求库仅在回调 reject 时拒绝等待队列，返回 null 会留下未结束的请求。
      throw new CanceledError('relogin_canceled')
    }
    return result
  } finally {
    app.unmount()
    container.remove()
  }
}
