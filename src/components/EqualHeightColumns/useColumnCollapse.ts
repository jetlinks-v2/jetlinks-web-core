import { computed, nextTick, ref, watch, type Ref } from 'vue'

interface CollapseOptions {
  collapsed?: boolean
  collapsible: boolean
}

/** 布局偏好由受控宿主持有；仅把实际被隐藏区域内的焦点移回折叠入口。 */
export function useColumnCollapse(
  props: CollapseOptions,
  leftPane: Ref<HTMLElement | undefined>,
  request: (collapsed: boolean) => void,
) {
  const localCollapsed = ref(props.collapsed ?? false)
  const toggleRef = ref<{ $el?: HTMLElement }>()
  const isCollapsed = computed(() => props.collapsible && (props.collapsed ?? localCollapsed.value))

  watch(() => props.collapsed, value => {
    if (value !== undefined) localCollapsed.value = value
  })
  watch(isCollapsed, collapsed => {
    const pane = leftPane.value
    const active = pane?.ownerDocument.activeElement
    const toggle = toggleRef.value?.$el
    if (collapsed && active && pane?.contains(active) && !toggle?.contains(active)) {
      void nextTick(() => toggleRef.value?.$el?.focus({ preventScroll: true }))
    }
  })

  function toggleCollapse() {
    if (!props.collapsible) return
    const next = !isCollapsed.value
    if (props.collapsed === undefined) localCollapsed.value = next
    request(next)
  }
  return { isCollapsed, toggleRef, toggleCollapse }
}
