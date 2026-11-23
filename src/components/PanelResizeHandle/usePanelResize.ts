import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'

interface PanelResizeOptions {
  modelValue: number
  container?: HTMLElement
  side?: 'left' | 'right'
  orientation?: 'horizontal' | 'vertical'
  limits?: { min?: number; max?: number; contentMin?: number; initial?: number }
}

/** 面板分界线仅维护拖动会话，宽度由使用方持有，不写入业务配置。 */
export function usePanelResize(props: PanelResizeOptions, change: (size: number) => void) {
  const { width, height } = useElementSize(toRef(props, 'container'))
  const available = computed(() => {
    const extent = props.orientation === 'vertical' ? height.value : width.value
    return extent > 0 ? Math.max(0, extent - (props.limits?.contentMin ?? 360)) : Infinity
  })
  const min = computed(() => props.limits?.min ?? 320)
  const max = computed(() => Math.max(min.value, Math.min(props.limits?.max ?? 640, available.value)))
  const size = computed(() => Math.max(min.value, Math.min(max.value, props.modelValue)))
  const dragging = ref(false)
  const controlsOpen = ref(false)
  const hasDragged = ref(false)
  const step = 16
  let session: { position: number; size: number; pointer: number; target: HTMLElement } | undefined
  function setSize(value: number) {
    const next = Math.max(min.value, Math.min(max.value, Math.round(value)))
    if (next !== props.modelValue) change(next)
  }
  function start(event: PointerEvent) {
    if (event.button !== 0 || session) return
    event.preventDefault()
    controlsOpen.value = false
    hasDragged.value = false
    session = { position: coordinate(event), size: size.value, pointer: event.pointerId, target: event.currentTarget as HTMLElement }
    session.target.focus({ preventScroll:true })
    session.target.setPointerCapture(event.pointerId)
    dragging.value = true
  }
  function move(event: PointerEvent) {
    if (session?.pointer === event.pointerId) {
      const delta = coordinate(event) - session.position
      if (delta !== 0) hasDragged.value = true
      setSize(session.size + (props.side === 'left' ? delta : -delta))
    }
  }
  function coordinate(event: PointerEvent) { return props.orientation === 'vertical' ? event.clientY : event.clientX }
  function finish(event?: PointerEvent) {
    if (event && session?.pointer !== event.pointerId) return
    const previous = session
    session = undefined
    dragging.value = false
    if (previous?.target.hasPointerCapture(previous.pointer)) previous.target.releasePointerCapture(previous.pointer)
  }
  function cancel(event?: PointerEvent) {
    if (event && session?.pointer !== event.pointerId) return
    const previous = session
    finish()
    if (previous) setSize(previous.size)
  }
  function reset() { controlsOpen.value = false; finish(); setSize(props.limits?.initial ?? 360) }
  function grow() { finish(); setSize(size.value + step) }
  function shrink() { finish(); setSize(size.value - step) }
  watch([min, max, () => props.modelValue], () => {
    if (size.value !== props.modelValue) setSize(size.value)
  }, { immediate: true })
  onBeforeUnmount(finish)
  return { min, max, size, dragging, controlsOpen, hasDragged, start, move, finish, cancel, reset, setSize, grow, shrink }
}
