import { createApp } from 'vue'
import pinia from '@jetlinks-web-core/store/pinia'
import i18n from '@jetlinks-web-core/locales'
import Relogin from './index.vue'

/** 打开续登弹窗，返回原登录结果，并在结束或异常时释放独立应用和容器。 */
export const openRelogin = async (): Promise<unknown> => {
  const container = document.createElement('div')
  const app = createApp(Relogin).use(pinia).use(i18n)
  document.body.appendChild(container)
  try {
    const dialog = app.mount(container) as InstanceType<typeof Relogin>
    return await dialog.open()
  } finally {
    app.unmount()
    container.remove()
  }
}
