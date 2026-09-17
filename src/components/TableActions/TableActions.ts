import { defineComponent, h } from 'vue'
import type { CSSProperties, SlotsType, VNode } from 'vue'
import { Button, Popover, theme } from 'ant-design-vue'
import { EllipsisOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import TableActionsItem from './TableActionsItem'
import { getTableActionsPopupContainer, stopActionPropagation, useTableActions } from './useTableActions'
import './style.css'

/** 将常用操作和可交互的更多面板组合为一个表格行操作区。 */
export default defineComponent({
  name: 'TableActions',
  slots: Object as SlotsType<{ default: () => VNode[] }>,
  setup(_, { slots }) {
    const { t } = useI18n()
    const { token } = theme.useToken()
    const { open, trigger, panel, getGroups, setOpen, onTriggerKeydown, onPanelKeydown } = useTableActions(slots, TableActionsItem)

    return () => {
      const { inline, more } = getGroups()
      if (!inline.length && !more.length) return null
      const label = t('components.TableActions.more')
      const panelStyle: CSSProperties = {
        '--table-actions-hover': token.value.colorBgTextHover,
        '--table-actions-radius': `${token.value.borderRadiusSM}px`,
      }
      return h('div', {
        class: 'table-actions',
        onClick: stopActionPropagation,
        onDblclick: stopActionPropagation,
        onKeydown: stopActionPropagation,
      }, [
        ...inline,
        more.length ? h(Popover, {
          open: open.value,
          trigger: 'click',
          placement: 'bottomRight',
          arrow: false,
          overlayClassName: 'table-actions-popover',
          overlayInnerStyle: { padding: `${token.value.paddingXXS}px` },
          getPopupContainer: getTableActionsPopupContainer,
          onOpenChange: setOpen,
        }, {
          default: () => h('span', { ref: trigger, onKeydown: onTriggerKeydown }, [
            h(Button, {
              type: 'text',
              size: 'small',
              class: 'table-actions__trigger',
              'aria-label': label,
              'aria-expanded': open.value,
            }, { icon: () => h(EllipsisOutlined) }),
          ]),
          content: () => h('div', {
            ref: panel,
            class: 'table-actions__panel',
            style: panelStyle,
            role: 'group',
            'aria-label': label,
            tabindex: -1,
            onKeydown: onPanelKeydown,
            onClick: stopActionPropagation,
            onDblclick: stopActionPropagation,
          }, more),
        }) : null,
      ])
    }
  },
})
