import { inject, provide, type InjectionKey } from 'vue'
import { toLayoutMode } from '@jetlinks-web-core/store/system'
import type { BasicLayoutController } from './useBasicLayoutController'

const BASIC_LAYOUT_CONTROLLER_KEY: InjectionKey<BasicLayoutController> = Symbol(
  'basic-layout-controller',
)

export const provideBasicLayoutController = (controller: BasicLayoutController) => {
  provide(BASIC_LAYOUT_CONTROLLER_KEY, controller)
}

/**
 * 取用布局控制器。
 *
 * `layout` 由壳层通过 props 声明自身导航模式（租户 top / 项目 mix / 应用 side），
 * 优先级高于 system.layout.layout 全局配置。这里只设置壳层级覆盖值，绝不改写
 * 全局 store —— 否则壳层之间会互相污染，且整页刷新后无复位方。
 */
export const useBasicLayoutControllerContext = (layout?: string) => {
  const controller = inject(BASIC_LAYOUT_CONTROLLER_KEY)

  if (!controller) {
    throw new Error('useBasicLayoutControllerContext must be used inside BasicLayoutPage')
  }

  // 非法或未声明时不覆盖，交由全局配置兜底。
  const layoutMode = toLayoutMode(layout)
  if (layoutMode) {
    controller.layoutModeOverride.value = layoutMode
  }

  return controller
}
