import { computed, nextTick, onBeforeUnmount, ref, watch, type CSSProperties } from 'vue'
import { useWindowSize } from '@vueuse/core'
import type { ImagePreviewBox, ImagePreviewProps } from './types'

/** 复用视觉事件的适配、指针缩放和限界拖动，监听随弹窗生命周期清理。 */
export function useImagePreview(props: Readonly<ImagePreviewProps>) {
  const MIN_ZOOM = 1
  const MAX_ZOOM = 4

  const stageRef = ref<HTMLDivElement>()
  const imageRef = ref<HTMLImageElement>()
  const stageSize = ref({ width: 0, height: 0 })
  const naturalSize = ref({ width: 0, height: 0 })
  const { width: viewportWidth, height: viewportHeight } = useWindowSize()
  const zoom = ref(1)
  const translate = ref({ x: 0, y: 0 })
  const dragging = ref(false)
  let dragState: { pointerId: number, startX: number, startY: number, originX: number, originY: number } | undefined
  let resizeObserver: ResizeObserver | undefined

  const modalWidth = computed(() => {
    const { width, height } = naturalSize.value
    if (!width || !height || !viewportWidth.value || !viewportHeight.value) {
      return 'min(1440px, calc(100vw - 64px))'
    }

    const widthByImageHeight = Math.max(0, viewportHeight.value - 180) * (width / height) + 48
    return `${Math.min(1440, viewportWidth.value - 64, widthByImageHeight)}px`
  })
  const stageStyle = computed<CSSProperties>(() => {
    const { width, height } = naturalSize.value
    return width && height ? { aspectRatio: `${width} / ${height}` } : {}
  })
  const imageLayout = computed(() => {
    const { width: stageWidth, height: stageHeight } = stageSize.value
    const { width: imageWidth, height: imageHeight } = naturalSize.value
    if (!stageWidth || !stageHeight || !imageWidth || !imageHeight) return undefined

    // 100% means the complete image fits inside the stage; zooming only enlarges this fitted canvas.
    const ratio = Math.min(stageWidth / imageWidth, stageHeight / imageHeight)
    return {
      width: imageWidth * ratio,
      height: imageHeight * ratio,
    }
  })
  const imageStyle = computed<CSSProperties>(() => ({
    width: `${imageLayout.value?.width || 0}px`,
    height: `${imageLayout.value?.height || 0}px`,
    transform: `translate(${translate.value.x}px, ${translate.value.y}px) scale(${zoom.value})`,
  }))
  const zoomPercent = computed(() => `${Math.round(zoom.value * 100)}%`)
  const canPan = computed(() => {
    const { x, y } = getPanBounds(zoom.value)
    return x > 0 || y > 0
  })

  watch([() => props.open, () => props.url], async ([open]) => {
    resetZoom()
    naturalSize.value = { width: 0, height: 0 }
    if (!open) {
      resizeObserver?.disconnect()
      return
    }
    await nextTick()
    observeStage()
  }, { immediate: true })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    cancelDragging()
  })

  function handleImageLoad() {
    const image = imageRef.value
    if (!image) return
    naturalSize.value = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    }
    resetZoom()
  }

  function handleWheel(event: WheelEvent) {
    const stage = stageRef.value
    if (!stage) return

    const delta = event.deltaY < 0 ? 0.2 : -0.2
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((zoom.value + delta).toFixed(2))))
    if (nextZoom === zoom.value) return

    const rect = stage.getBoundingClientRect()
    const pointerX = event.clientX - rect.left - rect.width / 2
    const pointerY = event.clientY - rect.top - rect.height / 2
    const ratio = nextZoom / zoom.value

    translate.value = clampTranslation({
      x: pointerX - (pointerX - translate.value.x) * ratio,
      y: pointerY - (pointerY - translate.value.y) * ratio,
    }, nextZoom)
    zoom.value = nextZoom
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0 || !canPan.value) return
    const stage = stageRef.value
    if (!stage) return

    event.preventDefault()
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: translate.value.x,
      originY: translate.value.y,
    }
    dragging.value = true
    stage.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent) {
    const state = dragState
    if (!state || state.pointerId !== event.pointerId) return

    translate.value = clampTranslation({
      x: state.originX + event.clientX - state.startX,
      y: state.originY + event.clientY - state.startY,
    })
  }

  function handlePointerUp(event: PointerEvent) {
    if (dragState?.pointerId !== event.pointerId) return
    stageRef.value?.releasePointerCapture?.(event.pointerId)
    cancelDragging()
  }

  function cancelDragging() {
    dragState = undefined
    dragging.value = false
  }

  function resetZoom() {
    zoom.value = 1
    translate.value = { x: 0, y: 0 }
    cancelDragging()
  }

  function observeStage() {
    const stage = stageRef.value
    if (!stage || typeof ResizeObserver === 'undefined') return

    resizeObserver?.disconnect()
    syncStageSize()
    resizeObserver = new ResizeObserver(() => {
      syncStageSize()
      resetZoom()
    })
    resizeObserver.observe(stage)
  }

  function syncStageSize() {
    const stage = stageRef.value
    stageSize.value = stage
      ? { width: stage.clientWidth, height: stage.clientHeight }
      : { width: 0, height: 0 }
  }

  function getPanBounds(scale: number) {
    const layout = imageLayout.value
    if (!layout) return { x: 0, y: 0 }

    return {
      x: Math.max(0, (layout.width * scale - stageSize.value.width) / 2),
      y: Math.max(0, (layout.height * scale - stageSize.value.height) / 2),
    }
  }

  function clampTranslation(next: { x: number, y: number }, scale = zoom.value) {
    const bounds = getPanBounds(scale)

    // The canvas is centered, so each axis can move only through half of its scaled overflow.
    return {
      x: Math.max(-bounds.x, Math.min(bounds.x, next.x)),
      y: Math.max(-bounds.y, Math.min(bounds.y, next.y)),
    }
  }

  function boxStyle(box: ImagePreviewBox): CSSProperties {
    const { width, height } = naturalSize.value
    const factorX = box.unit === 'percent' ? 1 : 100 / width
    const factorY = box.unit === 'percent' ? 1 : 100 / height

    return {
      left: `${box.left * factorX}%`,
      top: `${box.top * factorY}%`,
      width: `${(box.right - box.left) * factorX}%`,
      height: `${(box.bottom - box.top) * factorY}%`,
    }
  }

  return {
    stageRef, imageRef, naturalSize, modalWidth, stageStyle, imageLayout,
    imageStyle, zoomPercent, canPan, dragging, handleWheel, handlePointerDown, handlePointerMove,
    handlePointerUp, cancelDragging, handleImageLoad, resetZoom, boxStyle,
  }
}
