import { computed, nextTick, onActivated, onBeforeUpdate, onDeactivated, onScopeDispose, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

/** 只在组件内存保留显式滚动容器的双轴位置；停用、隐藏和恢复期间的零值不能覆盖阅读位置。 */
export function useRetainedScroll(element: Ref<HTMLElement | undefined>, active: MaybeRefOrGetter<boolean> = true) {
  const enabled = computed(() => toValue(active))
  let activated = true, restoring = false, version = 0, frame: number | undefined, observer: ResizeObserver | undefined
  let position = { top: 0, left: 0 }
  const laidOut = () => !!element.value?.isConnected && element.value.clientWidth > 0 && element.value.clientHeight > 0
  const visible = () => activated && enabled.value && laidOut()
  function cancel() { version++; if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; restoring = false }
  function remember() {
    if (activated && !restoring && laidOut() && element.value) position = { top: element.value.scrollTop, left: element.value.scrollLeft }
  }
  function queueRestore(current: number) {
    if (frame !== undefined || !restoring || !activated || !enabled.value) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (current !== version || !restoring || !visible() || !element.value) return
      element.value.scrollTop = position.top; element.value.scrollLeft = position.left
      restoring = false
    })
  }
  async function restore() {
    cancel(); restoring = true
    const current = version
    await nextTick()
    if (current !== version) return
    if (!activated || !enabled.value) { restoring = false; return }
    queueRestore(current)
  }
  /** 正文身份改变或权限清理时显式归零，不把其他对象的阅读位置带入新内容。 */
  function reset() { cancel(); position = { top: 0, left: 0 }; if (activated && enabled.value) void restore() }
  function onScroll() { if (!visible() || restoring) return false; remember(); return true }
  watch(enabled, value => { if (value) void restore(); else { remember(); cancel() } }, { flush: 'sync' })
  watch(element, current => {
    observer?.disconnect(); observer = undefined
    if (current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => { if (restoring && visible()) queueRestore(version) })
      observer.observe(current)
    }
    // 由状态容器移除再创建的同一正文也需要恢复；首次布局从0开始。
    if (current && visible()) void restore()
  }, { flush: 'post' })
  onBeforeUpdate(() => { if (enabled.value) remember() })
  onDeactivated(() => { if (enabled.value) remember(); activated = false; cancel() })
  onActivated(() => { activated = true; void restore() })
  onScopeDispose(() => { cancel(); observer?.disconnect() })
  return { onScroll, restore, reset, visible }
}
