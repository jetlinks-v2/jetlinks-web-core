import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'
import { useEventListener } from '@vueuse/core'

type Size = { width:number; height:number }
const MIN_SCALE = .2, MAX_SCALE = 2
export const canvasScale = (value:number) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
export const canvasFit = (content:Size, area:Size) => canvasScale(Math.min(1, (area.width - 24) / content.width, (area.height - 24) / content.height))
/** A centered, scrollable layer keeps the same world point under the pointer after zoom. */
export function canvasAnchor(scroll:number, pointer:number, area:number, content:number, before:number, after:number) {
  const offset = (scale:number) => Math.max(0, (area - content * scale) / 2)
  return Math.max(0, (scroll + pointer - offset(before)) / before * after + offset(after) - pointer)
}

/** Only the viewport and node buttons own shortcuts; nested editors retain their native keys. */
export function canvasKeyTarget(root:HTMLElement, target:EventTarget | null) {
  if (!(target instanceof Element) || !root.contains(target)) return false
  if (target.closest('input,textarea,select,math-field,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],[role="menu"],[role="dialog"],[role="listbox"],.ant-select,.editable-field,.template-graph__trial')) return false
  return target === root || !!target.closest('button[data-node]') || !target.closest('button,a,[role="button"]')
}

/** Viewport state is local to the canvas, shared by toolbar, keys and gestures, and never changes graph coordinates. */
export function useCanvasViewport(root:Ref<HTMLElement | undefined>, size:Ref<Size>, actions:{ clear:()=>void; remove:()=>void; blocked:()=>boolean }) {
  const scale = ref(1), space = ref(false), dragging = ref(false)
  const percent = computed(() => `${Math.round(scale.value * 100)}%`)
  let revision = 0, suppressClick = false
  let drag:{ id:number; x:number; y:number; left:number; top:number } | undefined
  let clickTimer:ReturnType<typeof setTimeout> | undefined
  async function zoom(value:number, pointer?:{x:number;y:number}) {
    const element = root.value
    if (!element) return
    const before = scale.value, after = canvasScale(value), point = pointer || { x:element.clientWidth/2, y:element.clientHeight/2 }
    const left = canvasAnchor(element.scrollLeft, point.x, element.clientWidth, size.value.width, before, after)
    // The graph is centered horizontally only; its top remains at world coordinate zero.
    const top = Math.max(0, (element.scrollTop + point.y) / before * after - point.y)
    const current = ++revision
    scale.value = after
    await nextTick()
    if (current === revision && root.value === element) { element.scrollLeft = left; element.scrollTop = top }
  }
  async function fit() {
    const element = root.value
    if (!element) return
    await zoom(canvasFit(size.value, { width:element.clientWidth, height:element.clientHeight }))
    element.scrollLeft = 0; element.scrollTop = 0
  }
  function keydown(event:KeyboardEvent) {
    const element = root.value
    if (!element || actions.blocked() || event.defaultPrevented || event.isComposing || !canvasKeyTarget(element,event.target)) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (['Delete','Backspace','Escape','+','=','-','_','0','1',' '].includes(event.key)) { event.preventDefault(); event.stopPropagation() }
    if (event.repeat && ['Delete','Backspace','Escape'].includes(event.key)) return
    if (event.key === 'Delete' || event.key === 'Backspace') actions.remove()
    else if (event.key === 'Escape') { cancel(); actions.clear() }
    else if (event.key === '+' || event.key === '=') void zoom(scale.value * 1.2)
    else if (event.key === '-' || event.key === '_') void zoom(scale.value / 1.2)
    else if (event.key === '0') void fit()
    else if (event.key === '1') void zoom(1)
    else if (event.key === ' ') space.value = true
  }
  function wheel(event:WheelEvent) {
    const element = root.value
    if (!element || actions.blocked() || !(event.ctrlKey || event.metaKey) || !element.contains(element.ownerDocument.activeElement) || !canvasKeyTarget(element,event.target)) return
    event.preventDefault()
    const rect = element.getBoundingClientRect()
    void zoom(scale.value * Math.exp(-event.deltaY * .002), { x:event.clientX-rect.left, y:event.clientY-rect.top })
  }
  function down(event:PointerEvent) {
    const element = root.value
    if (!element || !space.value || event.button !== 0 || actions.blocked() || !canvasKeyTarget(element,event.target)) return
    event.preventDefault(); event.stopPropagation()
    element.setPointerCapture?.(event.pointerId)
    drag = { id:event.pointerId,x:event.clientX,y:event.clientY,left:element.scrollLeft,top:element.scrollTop }
    dragging.value = true; suppressClick = true
  }
  function move(event:PointerEvent) {
    if (!drag || drag.id !== event.pointerId || !root.value) return
    root.value.scrollLeft = drag.left - (event.clientX-drag.x)
    root.value.scrollTop = drag.top - (event.clientY-drag.y)
  }
  function end() {
    const pointer = drag?.id
    drag = undefined; dragging.value = false
    if (pointer !== undefined && root.value?.hasPointerCapture?.(pointer)) root.value.releasePointerCapture(pointer)
    clearTimeout(clickTimer); clickTimer = setTimeout(() => { suppressClick = false },0)
  }
  function cancel() { space.value = false; end() }
  function click(event:MouseEvent) { if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false } }
  function focusout(event:FocusEvent) { if (!root.value?.contains(event.relatedTarget as Node)) cancel() }
  useEventListener(root,'wheel',wheel,{ passive:false })
  useEventListener(typeof window === 'undefined' ? undefined : window,'keyup',(event:KeyboardEvent) => { if (event.key === ' ') cancel() })
  useEventListener(typeof window === 'undefined' ? undefined : window,'blur',cancel)
  watch(() => actions.blocked(), value => { if (value) cancel() })
  onScopeDispose(() => { revision++; cancel(); clearTimeout(clickTimer) })
  return { scale,percent,space,dragging,zoom,fit,keydown,down,move,end,cancel,click,focusout }
}
