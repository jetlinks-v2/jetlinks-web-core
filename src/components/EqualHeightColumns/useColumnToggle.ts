import { nextTick, onMounted, ref, shallowRef, watch, type CSSProperties } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'

/** 将折叠按钮挂到最近的面板，跨过中间容器裁切，并跟随真实 Grid 轨道定位。 */
export function useColumnToggle() {
  const layoutRef = ref<HTMLElement>()
  const leftPaneRef = ref<HTMLElement>()
  const anchorRef = ref<HTMLElement>()
  const layerRef = ref<HTMLElement>()
  const toggleHost = shallowRef<HTMLElement>()
  const togglePosition = shallowRef<CSSProperties>({})

  /** 以挂载层的实际坐标换算位置，兼容面板的模糊、定位及滚动上下文。 */
  const syncPosition = () => {
    const layout = layoutRef.value
    const anchor = anchorRef.value
    const layer = layerRef.value
    const host = toggleHost.value
    if (!layout || !anchor || !layer || !host) return

    const anchorRect = anchor.getBoundingClientRect()
    const layerRect = layer.getBoundingClientRect()
    const layerStyle = getComputedStyle(layer)
    togglePosition.value = {
      left: `${parseFloat(layerStyle.left) + anchorRect.left + anchorRect.width / 2 - layerRect.left}px`,
      top: `${parseFloat(layerStyle.top) + anchorRect.top - layerRect.top}px`,
      '--equal-height-columns-edge-offset': `${layout.getBoundingClientRect().left - host.getBoundingClientRect().left}px`,
      // Teleport 后不再继承布局根节点的局部变量，显式沿用轨道过渡。
      '--equal-height-columns-transition': getComputedStyle(layout).getPropertyValue('--equal-height-columns-transition'),
    }
  }

  onMounted(() => {
    toggleHost.value = layoutRef.value?.closest<HTMLElement>('.content-panel') ?? undefined
  })

  // 观察左轨道与间距轨道，直接跟随 Grid 过渡；坐标本身不再叠加位置过渡。
  useResizeObserver([layoutRef, leftPaneRef, anchorRef, toggleHost], syncPosition)
  useEventListener('scroll', syncPosition, { capture: true, passive: true })
  useEventListener('resize', syncPosition)
  watch([toggleHost, layerRef], () => nextTick(syncPosition), { flush: 'post' })

  return { layoutRef, leftPaneRef, anchorRef, layerRef, toggleHost, togglePosition }
}
