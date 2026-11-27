import { defineComponent, h, toRefs, type App, type PropType } from 'vue'
import { Button, Tooltip } from 'ant-design-vue'
import { buttonProps } from 'ant-design-vue/es/button/buttonTypes'
import { omit } from 'lodash-es'
import type { PermissionTooltipConfig } from './tooltipPlacement'
import {
  usePermissionButton,
  type PermissionPopConfirmConfig,
} from './usePermissionButton'

const PERMISSION_BUTTON_PROP_KEYS = [
  'popConfirm',
  'tooltip',
  'hasPermission',
  'noPermissionTitle',
  'popConfirmBefore',
] as const

const definedProps = {
  tooltip: {
    type: Object as PropType<PermissionTooltipConfig | null>,
  },
  popConfirm: {
    type: Object as PropType<PermissionPopConfirmConfig | null>,
  },
  hasPermission: {
    type: [String, Array, Boolean] as PropType<string | string[] | boolean>,
    default: undefined,
  },
  noPermissionTitle: {
    type: String,
  },
  popConfirmBefore: {
    type: Function as PropType<(...args: any[]) => unknown>,
  },
  ...omit(buttonProps(), 'icon'),
}

const pickDefinedProps = (source: Record<string, unknown>) => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

/**
 * Self-contained JPermissionButton component with permission gating,
 * secondary confirmation dialog, and viewport-safe tooltip positioning.
 */
const PermissionButton = defineComponent({
  name: 'JPermissionButton',
  inheritAttrs: false,
  props: definedProps,
  setup(props, { attrs, slots }) {
    const propsRef = toRefs(props)
    const {
      hasAccess,
      isDisabled,
      hasTooltip,
      tooltipProps,
      setTriggerRef,
      handleConfirmClick,
    } = usePermissionButton({
      hasPermission: propsRef.hasPermission,
      disabled: propsRef.disabled,
      tooltip: propsRef.tooltip,
      noPermissionTitle: propsRef.noPermissionTitle,
      popConfirm: propsRef.popConfirm,
      popConfirmBefore: propsRef.popConfirmBefore,
    })

    return () => {
      const buttonNodeProps: Record<string, unknown> = {
        ...pickDefinedProps(omit(props as Record<string, unknown>, [...PERMISSION_BUTTON_PROP_KEYS])),
        ...attrs,
        disabled: isDisabled.value,
        ref: setTriggerRef,
      }

      if (!hasAccess.value || isDisabled.value) {
        delete buttonNodeProps.onClick
      } else if (props.popConfirm) {
        buttonNodeProps.onClick = handleConfirmClick
      }

      const buttonNode = !slots.button
        ? h(Button, buttonNodeProps, {
            default: () => slots.default?.(),
            icon: () => slots.icon?.(),
          })
        : slots.button()

      if (hasTooltip.value) {
        return h(Tooltip, tooltipProps.value, {
          default: () => buttonNode,
        })
      }

      return buttonNode
    }
  },
})

PermissionButton.install = function (app: App) {
  app.component(PermissionButton.name || 'JPermissionButton', PermissionButton)
}

export default PermissionButton
