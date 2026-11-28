import { computed, ref, shallowRef, type Ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import type { DashboardValue } from '../components/DashBoardCanvas/types'
import { objectReadingDashboard } from './dashboard'

/** Container width and rendered content, rather than window width, determine the reading layout. */
export function useObjectDashboardLayout(value: Ref<DashboardValue>, editing: Ref<boolean>, saved: Ref<string | undefined>) {
  const container = ref<HTMLElement>()
  const { width } = useElementSize(container)
  const heights = shallowRef<Record<string, number>>({})
  const narrow = computed(() => width.value > 0 && width.value < 640)
  const displayed = computed(() => narrow.value
    ? objectReadingDashboard(value.value, heights.value, true)
    : editing.value || saved.value ? value.value : objectReadingDashboard(value.value, heights.value))
  function measure(id: string, height: number) {
    const pixels = Math.ceil(height)
    if (heights.value[id] !== pixels) heights.value = { ...heights.value, [id]: pixels }
  }
  return { container, narrow, displayed, measure }
}
