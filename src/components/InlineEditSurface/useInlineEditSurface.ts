import { nextTick, onBeforeUnmount, onUpdated, ref, watch, type CSSProperties, type Ref } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'

interface Bounds { left: number; top: number; right: number; bottom: number; width: number; height: number }

export function inlineEditSurfacePlacement(anchor: Bounds, content: Pick<Bounds, 'width' | 'height'>, boundary: Bounds, viewport: { width: number; height: number }) {
  const margin = 16
  const inlineTop = anchor.top + (anchor.height - content.height) / 2
  const floating = content.width > Math.max(anchor.width, Math.min(boundary.right, viewport.width - margin) - anchor.left)
    || content.height > Math.max(anchor.height, 32) || inlineTop < margin || inlineTop + content.height > viewport.height - margin
  const inset = floating ? 9 : 0 // 8px内边距和1px边框，内容仍从原入口起点展开。
  const clamp = (value: number, size: number, extent: number) => Math.max(margin, Math.min(value, extent - size - margin))
  return { floating, left: clamp(anchor.left - inset, content.width + inset * 2, viewport.width), top: clamp(floating ? anchor.top - inset : inlineTop, content.height + inset * 2, viewport.height) }
}

/** 只管理原位内容的定位和焦点，不复制编辑器或参与保存。 */
export function useInlineEditSurface(options: {
  open: () => boolean
  hasDisplay: () => boolean
  root: Ref<HTMLElement | undefined>
  layer: Ref<HTMLElement | undefined>
  content: Ref<HTMLElement | undefined>
}) {
  const floating = ref(false), ready = ref(false), style = ref<CSSProperties>({})
  let frame: number | undefined, frameWindow: Window | undefined, generation = 0, disposed = false, focusPending = false
  const focusable = 'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), select:not(:disabled), button:not(:disabled), [tabindex="0"]'

  function measure() {
    const root = options.root.value, content = options.content.value, layer = options.layer.value
    if (!options.open() || !root || !content || !layer) return
    const view = root.ownerDocument.defaultView
    if (!view) return
    const anchor = root.getBoundingClientRect(), box = content.getBoundingClientRect()
    if (!anchor.width || !anchor.height || !box.width || !box.height || anchor.bottom <= 0 || anchor.top >= view.innerHeight) { ready.value = false; return }
    const boundary = (root.offsetParent || root.parentElement)?.getBoundingClientRect() || anchor
    const position = inlineEditSurfacePlacement(anchor, box, boundary, { width: view.innerWidth, height: view.innerHeight })
    const text = view.getComputedStyle(root)
    let zIndex = 1000
    for (let parent = root.parentElement; parent; parent = parent.parentElement) zIndex = Math.max(zIndex, (parseInt(view.getComputedStyle(parent).zIndex) || 0) + 1)
    const next: CSSProperties = { left:`${position.left}px`, top:`${position.top}px`, zIndex, fontFamily:text.fontFamily, fontSize:text.fontSize, fontWeight:text.fontWeight, lineHeight:text.lineHeight, color:text.color, direction:text.direction as CSSProperties['direction'] }
    if (Object.entries(next).some(([key, value]) => style.value[key as keyof CSSProperties] !== value)) style.value = next
    floating.value = position.floating
    ready.value = true
  }

  function schedule() {
    if (!options.open() || frame !== undefined || disposed) return
    frameWindow = options.root.value?.ownerDocument.defaultView || undefined
    if (frameWindow) frame = frameWindow.requestAnimationFrame(() => { frame = undefined; measure() })
  }
  useResizeObserver([options.root, options.content], schedule)
  useEventListener(() => options.root.value?.ownerDocument.defaultView || undefined, 'resize', schedule)
  useEventListener(() => options.root.value?.ownerDocument, 'scroll', schedule, { capture:true, passive:true })
  onUpdated(schedule)
  // 可见样式完成布局后再聚焦，浏览器会忽略隐藏表面内的焦点。
  watch(ready, visible => {
    if (!visible || !focusPending || disposed || !options.open()) return
    focusPending = false
    ;(options.layer.value?.querySelector<HTMLElement>(focusable) || options.layer.value)?.focus({ preventScroll:true })
  }, { flush:'post' })
  watch(options.open, async (open, wasOpen) => {
    const version = ++generation
    const layer = options.layer.value, active = layer?.ownerDocument.activeElement as HTMLElement | null
    const restore = active && layer?.contains(active) ? active : undefined
    ready.value = false
    focusPending = open
    await nextTick()
    if (disposed || version !== generation) return
    if (open) measure()
    else if (wasOpen && options.hasDisplay() && options.root.value?.isConnected) {
      const document = options.root.value.ownerDocument
      if (document.activeElement === document.body || document.activeElement === restore) options.root.value.querySelector<HTMLElement>(focusable)?.focus({ preventScroll:true })
    }
  }, { immediate:true })
  onBeforeUnmount(() => { disposed = true; ++generation; if (frame !== undefined) frameWindow?.cancelAnimationFrame(frame) })
  return { floating, ready, style }
}
