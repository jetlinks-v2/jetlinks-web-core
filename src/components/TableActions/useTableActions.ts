import {
  Fragment, cloneVNode, computed, inject, isVNode, onUpdated,
  provide, ref, watch,
} from 'vue'
import type { Component, InjectionKey, Slots, VNode } from 'vue'
import type { TableActionsItemProps, TableActionsItemSlotScope } from './types'

const closeKey: InjectionKey<() => void> = Symbol('TableActions.close')
const blockedSelector = '[disabled], [aria-disabled="true"], [aria-busy="true"], .ant-btn-loading, .ant-switch-loading'
const focusableSelector = 'button, a[href], input, select, textarea, [tabindex]'

/** 展平 template/v-for 的 Fragment，限定局部 key，并兼容裸 common 属性的空字符串值。 */
export function groupTableActionItems(nodes: VNode[], itemType: Component) {
  const groups: { inline: VNode[]; more: VNode[] } = { inline: [], more: [] }
  const visit = (children: VNode[], parentKeys: Array<string | number | symbol>) => {
    children.forEach((node, index) => {
      if (!isVNode(node)) return
      const keys = [...parentKeys, node.key ?? index]
      if (node.type === Fragment && Array.isArray(node.children)) {
        visit(node.children as VNode[], keys)
      } else if (node.type === itemType) {
        const common = node.props?.common === '' || node.props?.common === true
        const item = cloneVNode(node, { key: JSON.stringify(keys) })
        groups[common ? 'inline' : 'more'].push(item)
      }
    })
  }
  visit(nodes, [])
  return groups
}

/** 管理单个操作区的插槽分组、展开状态及键盘焦点；不执行任何业务操作。 */
export function useTableActions(slots: Slots, itemType: Component) {
  const open = ref(false)
  const trigger = ref<HTMLElement>()
  const panel = ref<HTMLElement>()
  let hasMore = false
  let focusRequested = false

  const focusTrigger = () => trigger.value?.querySelector<HTMLButtonElement>('button')?.focus()
  const focusableItems = () => Array.from(panel.value?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
    .filter(element => element.tabIndex >= 0 && !element.closest(blockedSelector) && element.getClientRects().length > 0)

  /** 仅当焦点仍在面板中时归还触发按钮，避免抢走新打开的确认框焦点。 */
  const close = () => {
    const activeElement = panel.value?.ownerDocument.activeElement
    if (activeElement && panel.value?.contains(activeElement)) focusTrigger()
    open.value = false
    focusRequested = false
  }
  provide(closeKey, close)

  /** 从 render 内读取插槽，保留父级插槽的响应式依赖。 */
  const getGroups = () => {
    const groups = groupTableActionItems(slots.default?.() ?? [], itemType)
    hasMore = groups.more.length > 0
    return groups
  }
  onUpdated(() => {
    if (!hasMore && open.value) close()
  })

  const focusPanel = () => (focusableItems()[0] ?? panel.value)?.focus()
  watch([open, panel], (_value, _previous, onCleanup) => {
    if (!open.value || !focusRequested || !panel.value) return
    const element = panel.value
    const observer = new ResizeObserver(() => {
      if (!open.value || !focusRequested || !element.getClientRects().length) return
      focusPanel()
      if (element.contains(element.ownerDocument.activeElement)) {
        focusRequested = false
        observer.disconnect()
      }
    })
    observer.observe(element)
    onCleanup(() => observer.disconnect())
  }, { flush: 'post' })

  const setOpen = (value: boolean) => {
    if (value && hasMore) open.value = true
    else close()
  }

  const onTriggerKeydown = (event: KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (open.value) focusPanel()
      else {
        focusRequested = true
        setOpen(true)
      }
    } else if (event.key === 'Tab' && open.value && !event.shiftKey) {
      event.preventDefault()
      focusPanel()
    }
  }

  const onPanelKeydown = (event: KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
    } else if (event.key === 'Tab') {
      const items = focusableItems()
      const boundary = event.shiftKey ? items[0] : items[items.length - 1]
      if (!items.length || event.target === boundary || event.target === panel.value) {
        close()
        if (event.shiftKey) event.preventDefault()
      }
    }
  }

  return { open, trigger, panel, getGroups, setOpen, onTriggerKeydown, onPanelKeydown }
}

/** 捕获阶段安排下一任务关闭，兼容 click.stop，并等原事件处理完后再检查 preventDefault。 */
export function useTableActionsItem(props: Readonly<TableActionsItemProps>) {
  const close = inject(closeKey, () => {})
  const scope = computed<TableActionsItemSlotScope>(() => ({
    placement: props.common ? 'inline' : 'more',
    close,
  }))

  const onClickCapture = (event: MouseEvent) => {
    const target = event.target
    if (!(target instanceof Element)) return
    const tooltipWrapper = target.closest('.ant-tooltip-disabled-compatible-wrapper')
    const blocked = target.closest(blockedSelector) ?? tooltipWrapper?.querySelector(blockedSelector)
    if (blocked && (event.currentTarget as HTMLElement).contains(blocked)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    if (!props.common && props.closeOnClick !== false) {
      setTimeout(() => {
        if (!event.defaultPrevented) close()
      }, 0)
    }
  }

  return { scope, onClickCapture }
}

/** 防止操作区事件触发表格行的选择、展开或导航。 */
export const stopActionPropagation = (event: Event) => event.stopPropagation()

/** 固定列或 overflow 容器内的操作浮层统一挂载到当前文档 body。 */
export const getTableActionsPopupContainer = (triggerNode: HTMLElement) => triggerNode.ownerDocument.body
