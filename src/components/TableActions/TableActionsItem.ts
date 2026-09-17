import { defineComponent, h } from 'vue'
import type { SlotsType, VNode } from 'vue'
import type { TableActionsItemSlotScope } from './types'
import { useTableActionsItem } from './useTableActions'

/** 声明一个完整操作；按钮、开关、权限和反馈内容均由调用方提供。 */
export default defineComponent({
  name: 'TableActionsItem',
  props: {
    common: { type: Boolean, default: false },
    closeOnClick: { type: Boolean, default: true },
  },
  slots: Object as SlotsType<{ default: (scope: TableActionsItemSlotScope) => VNode[] }>,
  setup(props, { slots }) {
    const { scope, onClickCapture } = useTableActionsItem(props)
    return () => h('div', {
      class: ['table-actions__item', `table-actions__item--${scope.value.placement}`],
      onClickCapture,
    }, slots.default?.(scope.value))
  },
})
