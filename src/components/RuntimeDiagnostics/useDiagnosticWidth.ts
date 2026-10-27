import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** 依据可用容器宽度选择就近详情或抽屉，不假定宿主占满浏览器。 */
export function useDiagnosticWidth(element: Ref<HTMLElement | undefined>) {
  const width = ref(0)
  let observer: ResizeObserver | undefined
  onMounted(() => {
    if (!element.value) return
    width.value = element.value.getBoundingClientRect().width
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(entries => { width.value = entries[0]?.contentRect.width ?? 0 })
      observer.observe(element.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())
  return width
}
