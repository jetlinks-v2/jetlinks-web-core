import { nextTick, onScopeDispose, ref, shallowRef, useId, watch } from 'vue'
import type { Ref } from 'vue'
import { useElementVisibility, useMutationObserver, useResizeObserver } from '@vueuse/core'
import type { SlantedTabKey, SlantedTabOption, SlantedTabsProps } from './types'

const edgeTolerance = 1

/** 管理单个页签栏的溢出菜单和滚动边界；只操作本实例的 DOM，不改变业务选择契约。 */
export function useSlantedTabsOverflow(
  props: SlantedTabsProps,
  selectedKey: Readonly<Ref<SlantedTabKey | undefined>>,
  select: (key: SlantedTabKey) => void,
  tabId: (key: SlantedTabKey) => string,
) {
  const instanceId = useId()
  const moreTriggerId = `${instanceId}-more-trigger`
  const moreMenuId = `${instanceId}-more-menu`
  const containerRef = shallowRef<HTMLElement>()
  const scrollRef = shallowRef<HTMLElement>()
  const listRef = shallowRef<HTMLElement>()
  const menuRef = shallowRef<HTMLElement>()
  const menuVisible = useElementVisibility(menuRef)
  const hasOverflow = ref(false)
  const canScrollLeft = ref(false)
  const canScrollRight = ref(false)
  const hiddenOptions = shallowRef<SlantedTabOption[]>([])
  const moreOpen = ref(false)
  let frame: number | undefined
  let focusFrame: number | undefined
  let revealPending = false
  let keyboardMenu = false
  let disposed = false

  /** 仅移动标签栏，避免选中隐藏页签时连带滚动页面正文。 */
  const revealSelected = () => {
    const scroll = scrollRef.value
    const key = selectedKey.value
    const button = key === undefined ? undefined : scroll?.ownerDocument.getElementById(tabId(key))
    if (!scroll || !button) return
    const viewport = scroll.getBoundingClientRect()
    const bounds = button.getBoundingClientRect()
    if (bounds.left < viewport.left) scroll.scrollLeft += bounds.left - viewport.left
    else if (bounds.right > viewport.right) scroll.scrollLeft += bounds.right - viewport.right
  }

  /** 使用未扣除“更多”按钮的可用宽度判断溢出，避免临界宽度下按钮反复显隐。 */
  const measure = () => {
    frame = undefined
    const container = containerRef.value
    const scroll = scrollRef.value
    const list = listRef.value
    if (!container || !scroll || !list || !container.clientWidth) {
      hasOverflow.value = canScrollLeft.value = canScrollRight.value = moreOpen.value = false
      hiddenOptions.value = []
      return
    }
    const style = getComputedStyle(container)
    const available = container.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
    const overflowing = list.scrollWidth > available + edgeTolerance
    if (overflowing !== hasOverflow.value) {
      hasOverflow.value = overflowing
      // 等待固定操作区占位更新，再计算真实可视范围。
      void nextTick(() => scheduleMeasure())
      return
    }
    if (revealPending) {
      revealSelected()
      revealPending = false
    }
    const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
    const left = Math.max(0, Math.min(scroll.scrollLeft, maxScroll))
    canScrollLeft.value = overflowing && left > edgeTolerance
    canScrollRight.value = overflowing && maxScroll - left > edgeTolerance
    const viewport = scroll.getBoundingClientRect()
    hiddenOptions.value = overflowing ? props.options.filter(option => {
      const button = scroll.ownerDocument.getElementById(tabId(option.key))
      if (!button) return false
      const bounds = button.getBoundingClientRect()
      return bounds.left < viewport.left - edgeTolerance || bounds.right > viewport.right + edgeTolerance
    }) : []
    if (!overflowing || !hiddenOptions.value.length) moreOpen.value = false
  }

  /** 高频滚动与尺寸变化合并到一帧；选择变化另行请求把当前项滚入视野。 */
  function scheduleMeasure(reveal = false) {
    if (disposed || typeof window === 'undefined') return
    revealPending ||= reveal
    if (frame === undefined) frame = window.requestAnimationFrame(measure)
  }

  /** 溢出时接管导航栏滚轮，包含两端的继续滚动，避免滚动传递到页面。 */
  const onWheel = (event: WheelEvent) => {
    const scroll = scrollRef.value
    if (!scroll || !hasOverflow.value || event.ctrlKey || event.defaultPrevented || !event.cancelable) return
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (!delta) return
    // 到达端点也阻止默认滚动；无溢出或鼠标移出导航栏时仍由页面处理。
    event.preventDefault()
    const unit = event.deltaMode === 1 ? parseFloat(getComputedStyle(scroll).lineHeight) || 16
      : event.deltaMode === 2 ? scroll.clientWidth : 1
    const maxScroll = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
    const left = Math.max(0, Math.min(scroll.scrollLeft, maxScroll))
    const next = Math.max(0, Math.min(left + delta * unit, maxScroll))
    if (next === left) return
    scroll.scrollLeft = next
    scheduleMeasure()
  }

  /** 菜单和标签按钮共用原选择入口，保留数字／字符串 key 及禁用、加载约束。 */
  const selectOverflow = async (key: SlantedTabKey) => {
    if (props.state.loading || !props.options.some(option => option.key === key && !option.disabled)) return
    moreOpen.value = false
    select(key)
    await nextTick()
    if (disposed) return
    const active = selectedKey.value
    if (active !== undefined) scrollRef.value?.ownerDocument.getElementById(tabId(active))?.focus({ preventScroll: true })
    scheduleMeasure(true)
  }

  /** Escape 关闭菜单后归还触发按钮焦点；鼠标移出时由 Dropdown 处理关闭。 */
  const closeMore = () => {
    moreOpen.value = false
    scrollRef.value?.ownerDocument.getElementById(moreTriggerId)?.focus({ preventScroll: true })
  }

  const menuItems = () => Array.from(menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])

  /** 在公开 overlay 插槽的 DOM 挂载后聚焦，避免依赖组件库内部菜单实例。 */
  const focusMenu = () => {
    if (!keyboardMenu || !moreOpen.value || !menuVisible.value || disposed) return
    const target = menuItems()[0] ?? menuRef.value
    if (!target) return
    target.focus({ preventScroll: true })
    // 浮层测量时虽已进入视口，仍可能被隐藏；焦点成功后立即停止等待。
    if (menuRef.value?.ownerDocument.activeElement !== target && focusFrame === undefined) {
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = undefined
        focusMenu()
      })
    }
  }

  /** 在捕获阶段统一菜单按键，Enter/Space 复用点击入口，避免与菜单内部按键重复触发。 */
  const onMenuKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMore()
      return
    }
    const items = menuItems()
    const current = items.indexOf(menuRef.value?.ownerDocument.activeElement as HTMLElement)
    if (['Enter', ' '].includes(event.key) && current >= 0) {
      event.preventDefault()
      event.stopPropagation()
      items[current].click()
    } else if (items.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % items.length
          : current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
      items[next].focus({ preventScroll: true })
    }
  }

  /** 统一键盘触发方式，阻止原生点击在同一按键后再次切换菜单状态。 */
  const onMoreKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && moreOpen.value) {
      event.preventDefault()
      event.stopPropagation()
      closeMore()
      return
    }
    if (props.state.loading || !['ArrowDown', 'Enter', ' '].includes(event.key)) return
    event.preventDefault()
    keyboardMenu = true
    moreOpen.value = true
    void nextTick(focusMenu)
  }

  // 浮层先隐藏测量再显示；可见性观察避免焦点落在尚不可见的菜单上。
  watch([moreOpen, menuRef, menuVisible], ([open]) => {
    if (!open) {
      keyboardMenu = false
      if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame)
      focusFrame = undefined
    } else void nextTick(focusMenu)
  }, { flush: 'post' })
  watch(() => props.state.loading, loading => { if (loading) moreOpen.value = false })
  watch([selectedKey, () => props.options.map(option => [option.key, option.label, option.count, option.disabled])],
    () => scheduleMeasure(true), { immediate: true, flush: 'post' })
  watch([containerRef, scrollRef, listRef], () => scheduleMeasure(true), { flush: 'post' })
  useResizeObserver([containerRef, scrollRef, listRef], () => scheduleMeasure())
  // 自定义标题插槽也可能独立改变文字或节点，不能只观察 options。
  useMutationObserver(listRef, () => scheduleMeasure(), { childList: true, subtree: true, characterData: true })
  onScopeDispose(() => {
    disposed = true
    if (frame !== undefined) window.cancelAnimationFrame(frame)
    if (focusFrame !== undefined) window.cancelAnimationFrame(focusFrame)
  })

  return {
    containerRef, scrollRef, listRef, menuRef, hasOverflow, canScrollLeft, canScrollRight,
    hiddenOptions, moreOpen, moreTriggerId, moreMenuId, selectOverflow, closeMore,
    onMoreKeydown, onMenuKeydown, onWheel, onScroll: () => scheduleMeasure(),
  }
}
