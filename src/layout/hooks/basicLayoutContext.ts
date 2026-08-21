import { inject, provide, type InjectionKey } from 'vue'
import type { BasicLayoutController } from './useBasicLayoutController'

const BASIC_LAYOUT_CONTROLLER_KEY: InjectionKey<BasicLayoutController> = Symbol(
  'basic-layout-controller',
)

export const provideBasicLayoutController = (controller: BasicLayoutController) => {
  provide(BASIC_LAYOUT_CONTROLLER_KEY, controller)
}

export const useBasicLayoutControllerContext = () => {
  const controller = inject(BASIC_LAYOUT_CONTROLLER_KEY)

  if (!controller) {
    throw new Error('useBasicLayoutControllerContext must be used inside BasicLayoutPage')
  }

  return controller
}
