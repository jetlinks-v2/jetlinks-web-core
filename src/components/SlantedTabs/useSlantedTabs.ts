import { computed, ref, useId, watch } from 'vue'
import type { SlantedTabKey, SlantedTabsProps } from './types'

interface SelectionEmitter {
  (event: 'update:activeKey', key: SlantedTabKey): void
  (event: 'change', key: SlantedTabKey): void
}

/** 管理受控/非受控选择与键盘导航，不修改调用方数据或外部状态。 */
export function useSlantedTabs(props: SlantedTabsProps, emit: SelectionEmitter) {
  const instanceId = useId()
  const localKey = ref<SlantedTabKey>()
  const visitedKeys = ref(new Set<SlantedTabKey>())
  const selectedKey = computed(() => {
    const key = props.activeKey ?? localKey.value
    return props.options.find(option => option.key === key && !option.disabled)?.key
      ?? props.options.find(option => !option.disabled)?.key
  })

  // 面板首次选择后保留实例；选项移除时清理记录，重新加入后恢复懒挂载。
  watch([selectedKey, () => props.options.map(option => option.key)], ([key, keys]) => {
    const next = new Set([...visitedKeys.value].filter(visited => keys.includes(visited)))
    if (key !== undefined) next.add(key)
    visitedKeys.value = next
  }, { immediate: true })

  /** 区分数字与字符串 key，多实例之间也不共享 ARIA 标识。 */
  const tabId = (key: SlantedTabKey) => `${instanceId}-tab-${typeof key}-${encodeURIComponent(key)}`
  const panelId = (key: SlantedTabKey) => `${tabId(key)}-panel`

  /** 只对有效的新选择发出事件，避免重复点击触发调用方重复加载。 */
  const select = (key: SlantedTabKey) => {
    if (props.state.loading || key === selectedKey.value) return
    if (!props.options.some(option => option.key === key && !option.disabled)) return
    localKey.value = key
    emit('update:activeKey', key)
    emit('change', key)
  }

  /** 方向键循环跳过禁用项，Home/End 到首尾，并将焦点页签滚入可见区域。 */
  const onKeydown = (event: KeyboardEvent, key: SlantedTabKey) => {
    if (props.state.loading || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const enabled = props.options.filter(option => !option.disabled)
    if (!enabled.length) return
    event.preventDefault()
    const current = enabled.findIndex(option => option.key === key)
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
      : (current + offset + enabled.length) % enabled.length
    const next = enabled[index].key
    select(next)
    const target = event.currentTarget as HTMLButtonElement
    const button = target.ownerDocument.getElementById(tabId(next))
    button?.focus({ preventScroll: true })
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  return { selectedKey, visitedKeys, select, onKeydown, tabId, panelId }
}
