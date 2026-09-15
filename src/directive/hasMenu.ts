import type { App } from 'vue'
import { useMenuStore } from '@jetlinks-web-core/store/menu'

/** 注册编译后模板的判断入口；必须在 app.use(pinia) 之后安装。 */
export default function hasMenu(app: App): void {
  const pinia = app.config.globalProperties.$pinia
  if (!pinia) throw new Error('[v-has-menu] 请先安装 Pinia，再安装菜单指令插件。')

  // 显式绑定当前应用的 Pinia，避免读取其他应用最后激活的权限上下文。
  // 在渲染期间读取响应式 Store，使菜单替换、清空和 code 变化都触发更新。
  app.config.globalProperties.$hasMenu = (code: string): boolean => {
    return typeof code === 'string' && code.length > 0 && useMenuStore(pinia).hasMenu(code)
  }
}
