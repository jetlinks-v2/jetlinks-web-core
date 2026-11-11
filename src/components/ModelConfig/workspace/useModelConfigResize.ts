import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import type { ModelConfigState } from './useModelConfigState'

export function useModelConfigResize(state: ModelConfigState) {
  const { siderWidth, resizingSider, editorRef, fileWorkspaceRef, activeType, configTab, definitionViewMode } = state
  const SIDER_WIDTH_STORAGE_KEY = 'jetlinks:model-config:sider-width'
  const SIDER_WIDTH_DEFAULT = 280
  const SIDER_WIDTH_MIN = 220
  const SIDER_WIDTH_MAX = 520
  const SIDER_RESIZE_BREAKPOINT = 1100

  let siderResizeStartX = 0
  let siderResizeStartWidth = SIDER_WIDTH_DEFAULT
  let editorLayoutFrame = 0

  const modelConfigStyle = computed(() => ({
    '--model-config-sider-width': `${siderWidth.value}px`
  }))

  onMounted(() => {
    restoreSiderWidth()
  })

  onBeforeUnmount(() => {
    stopResizeSider()
    if (editorLayoutFrame && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(editorLayoutFrame)
    }
  })

  // 切换一级页签后编辑区宽度发生变化，等待视图挂载后重新布局。
  watch([activeType, configTab, definitionViewMode], () => nextTick(layoutEditor))

  function restoreSiderWidth() {
    if (typeof window === 'undefined') return
    let cached = Number.NaN
    try {
      cached = Number(window.localStorage?.getItem(SIDER_WIDTH_STORAGE_KEY))
    } catch {
      cached = Number.NaN
    }
    if (Number.isFinite(cached)) {
      siderWidth.value = clampSiderWidth(cached)
    }
  }

  function startResizeSider(event: PointerEvent) {
    if (!isSiderResizable()) return
    event.preventDefault()
    resizingSider.value = true
    siderResizeStartX = event.clientX
    siderResizeStartWidth = siderWidth.value
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    window.addEventListener('pointermove', resizeSider)
    window.addEventListener('pointerup', stopResizeSider)
    window.addEventListener('pointercancel', stopResizeSider)
  }

  function resizeSider(event: PointerEvent) {
    if (!resizingSider.value) return
    setSiderWidth(siderResizeStartWidth + event.clientX - siderResizeStartX, false)
  }

  function stopResizeSider() {
    const shouldPersist = resizingSider.value
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', resizeSider)
      window.removeEventListener('pointerup', stopResizeSider)
      window.removeEventListener('pointercancel', stopResizeSider)
    }
    resizingSider.value = false
    if (shouldPersist) {
      persistSiderWidth()
    }
  }

  function resizeSiderByKeyboard(offset: number) {
    if (!isSiderResizable()) return
    setSiderWidth(siderWidth.value + offset)
  }

  function setSiderWidth(width: number, persist = true) {
    siderWidth.value = clampSiderWidth(width)
    if (persist) {
      persistSiderWidth()
    }
    layoutEditor()
  }

  function persistSiderWidth() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage?.setItem(SIDER_WIDTH_STORAGE_KEY, String(siderWidth.value))
    } catch {
      // localStorage 可能被浏览器策略禁用，失败时仅不记忆宽度。
    }
  }

  function clampSiderWidth(width: number) {
    return Math.min(SIDER_WIDTH_MAX, Math.max(SIDER_WIDTH_MIN, Math.round(width)))
  }

  function isSiderResizable() {
    return typeof window !== 'undefined' && window.innerWidth > SIDER_RESIZE_BREAKPOINT
  }

  function layoutEditor() {
    if (typeof requestAnimationFrame === 'undefined') {
      const editor = activeType.value === 'file' ? fileWorkspaceRef.value : editorRef.value
      editor?.layout?.()
      return
    }
    if (editorLayoutFrame) {
      cancelAnimationFrame(editorLayoutFrame)
    }
    editorLayoutFrame = requestAnimationFrame(() => {
      const editor = activeType.value === 'file' ? fileWorkspaceRef.value : editorRef.value
      editor?.layout?.()
      editorLayoutFrame = 0
    })
  }

  return { modelConfigStyle, startResizeSider, resizeSiderByKeyboard, setSiderWidth, layoutEditor, SIDER_WIDTH_MIN, SIDER_WIDTH_MAX }
}
