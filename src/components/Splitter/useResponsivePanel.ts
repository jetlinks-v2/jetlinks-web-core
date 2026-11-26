import { computed, ref, watch, type Ref } from 'vue'
import type { PanelResizeDragEvent } from '../PanelResizeHandle/types'

/** 手动收放由宿主持有；窄容器中的临时打开不写回用户偏好。 */
export function useResponsivePanel(preference: Ref<boolean>, compact: Readonly<Ref<boolean>>) {
  const overlayOpen = ref(false)
  const revealSize = ref<number>()
  const revealIntent = ref(false)
  const inlineCollapsed = computed(() => compact.value || preference.value)
  const collapsed = computed(() => compact.value ? !overlayOpen.value : preference.value)

  function setCollapsed(next: boolean) {
    resetReveal()
    if (compact.value) overlayOpen.value = !next
    else preference.value = next
  }

  function resetReveal() {
    revealSize.value = undefined
    revealIntent.value = false
  }

  /** 请求尺寸已由公共握柄归一化，左右与上下布局共用中点确认和回拖缓冲。 */
  function drag(event: PanelResizeDragEvent, extent: number) {
    if (!compact.value || overlayOpen.value || extent <= 0) return
    if (event.phase === 'start') { resetReveal(); revealSize.value = 0; return }
    if (revealSize.value === undefined) return
    if (event.phase === 'move') {
      revealSize.value = Math.max(0, Math.min(extent, event.requestedSize))
      revealIntent.value = revealSize.value > extent * (revealIntent.value ? 0.4 : 0.5)
      return
    }
    const open = event.phase === 'end' && revealIntent.value
    resetReveal()
    if (open) overlayOpen.value = true
  }

  function close() {
    resetReveal()
    overlayOpen.value = false
  }

  // 布局切换只结束临时覆盖，不把上一次打开状态带入下一轮窄屏。
  watch(compact, close, { flush: 'sync' })

  return { inlineCollapsed, collapsed, overlayOpen, revealSize, revealIntent, drag, setCollapsed,
    toggle: () => setCollapsed(!collapsed.value), close }
}
