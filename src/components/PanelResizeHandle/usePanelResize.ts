import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import { useElementSize } from '@vueuse/core'

interface PanelResizeOptions {
  modelValue: number
  container?: HTMLElement
  side?: 'left' | 'right'
  limits?: { min?: number; max?: number; contentMin?: number; initial?: number }
}

/** 面板分界线仅维护拖动会话，宽度由使用方持有，不写入业务配置。 */
export function usePanelResize(props: PanelResizeOptions, change: (size: number) => void) {
  const { width } = useElementSize(toRef(props, 'container'))
  const min = computed(() => props.limits?.min ?? 320)
  const max = computed(() => Math.max(min.value, Math.min(props.limits?.max ?? 640,
    width.value > 0 ? width.value - (props.limits?.contentMin ?? 360) : Infinity)))
  const size = computed(() => Math.max(min.value, Math.min(max.value, props.modelValue)))
  const dragging = ref(false)
  const controlsOpen = ref(false)
  const step = 16
  let session: { x: number; size: number; pointer: number; target: HTMLElement } | undefined
  function setSize(value: number) {
    const next = Math.round(Math.max(min.value, Math.min(max.value, value)))
    if (next !== props.modelValue) change(next)
  }
  function start(event: PointerEvent) {
    if (event.button !== 0 || session) return
    event.preventDefault()
    session = { x: event.clientX, size: size.value, pointer: event.pointerId, target: event.currentTarget as HTMLElement }
    session.target.focus({ preventScroll:true })
    session.target.setPointerCapture(event.pointerId)
    dragging.value = true
  }
  function move(event: PointerEvent) {
    if (session?.pointer === event.pointerId) {
      const delta = event.clientX - session.x
      setSize(session.size + (props.side === 'left' ? delta : -delta))
    }
  }
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
  function reset() { finish(); setSize(props.limits?.initial ?? 360) }
  function grow() { finish(); setSize(size.value + step) }
  function shrink() { finish(); setSize(size.value - step) }
  watch([min, max, () => props.modelValue], () => setSize(size.value), { immediate: true })
  onBeforeUnmount(finish)
  return { min, max, size, dragging, controlsOpen, start, move, finish, cancel, reset, setSize, grow, shrink }
}
