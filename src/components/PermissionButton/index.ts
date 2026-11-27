import { defineComponent, h, toRefs, type App, type PropType } from 'vue'
import { Button, Tooltip } from 'ant-design-vue'
import { buttonProps } from 'ant-design-vue/es/button/buttonTypes'
import { omit } from 'lodash-es'
import { PermissionButton as BasePermissionButton } from '@jetlinks-web/components'
import {
  useNoPermissionTooltip,
  type NoPermissionTooltipConfig,
} from './useNoPermissionTooltip'

const PERMISSION_BUTTON_PROP_KEYS = [
  'popConfirm',
  'tooltip',
  'hasPermission',
  'noPermissionTitle',
  'popConfirmBefore',
] as const

const EXCLUDED_TOOLTIP_KEYS = [
  'title',
  'open',
  'visible',
  'disabled',
  'placement',
  'align',
  'onOpenChange',
] as const

const definedProps = {
  tooltip: {
    type: Object as PropType<NoPermissionTooltipConfig>,
  },
  popConfirm: {
    type: Object as PropType<Record<string, unknown>>,
  },
  hasPermission: {
    type: [String, Array, Boolean] as PropType<string | string[] | boolean>,
    default: undefined,
  },
  noPermissionTitle: {
    type: String,
  },
  popConfirmBefore: {
    type: Function as PropType<(...args: any[]) => any>,
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
 * Global JPermissionButton override that preserves @jetlinks-web/components behavior when permitted
 * and constrains no-permission hover tooltips within the viewport when disabled.
 */
const PermissionButton = defineComponent({
  name: 'JPermissionButton',
  inheritAttrs: false,
  props: definedProps,
  setup(props, { attrs, slots }) {
    const propsRef = toRefs(props)
    const {
      hasAccess,
      resolvedTitle,
      placement,
      align,
      setTriggerRef,
      handleOpenChange,
    } = useNoPermissionTooltip({
      hasPermission: propsRef.hasPermission,
      tooltip: propsRef.tooltip,
      noPermissionTitle: propsRef.noPermissionTitle,
    })

    return () => {
      if (hasAccess.value) {
        const forwardProps = {
          ...pickDefinedProps(props as Record<string, unknown>),
          ...attrs,
        }
        return h(BasePermissionButton, forwardProps, slots)
      }

      const buttonNodeProps = {
        ...pickDefinedProps(
          omit(props as Record<string, unknown>, [...PERMISSION_BUTTON_PROP_KEYS, 'onClick']),
        ),
        ...omit(attrs, ['onClick']),
        disabled: true,
        ref: setTriggerRef,
      }

      const button = !slots.button
        ? h(Button, buttonNodeProps, {
            default: () => slots.default?.(),
            icon: () => slots.icon?.(),
          })
        : slots.button()

      const safeTooltipProps = omit(props.tooltip || {}, [...EXCLUDED_TOOLTIP_KEYS])

      return h(
        Tooltip,
        {
          ...safeTooltipProps,
          title: resolvedTitle.value,
          placement: placement.value,
          align: align.value,
          onOpenChange: handleOpenChange,
        },
        {
          default: () => button,
        },
      )
    }
  },
})

PermissionButton.install = function (app: App) {
  app.component(PermissionButton.name || 'JPermissionButton', PermissionButton)
}

export default PermissionButton
