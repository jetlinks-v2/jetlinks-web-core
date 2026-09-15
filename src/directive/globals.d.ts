import type { ObjectDirective } from 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** 由 v-has-menu 编译转换调用，响应式判断单个菜单 code。 */
    $hasMenu: (code: string) => boolean
  }
  interface GlobalDirectives {
    /** 编译期结构指令，不是 app.directive 注册的 DOM 指令。 */
    vHasMenu: ObjectDirective<HTMLElement, string>
  }
}

export {}
