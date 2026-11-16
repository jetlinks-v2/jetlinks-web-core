import { computed, getCurrentInstance, onActivated, onDeactivated, onScopeDispose, ref, watch, type Ref } from 'vue'
import { getDocumentHelpContent } from '@jetlinks-web-core/api/document'

const configurationRevision = ref(0)

/** 管理保存后刷新已挂载的帮助入口，隐藏的埋点不依赖 hover 才能重新启用。 */
export function notifyDocumentHelpConfigurationChanged() {
  configurationRevision.value++
}

/** 先加载配置再显示入口；悬停复用已准备的正文，避免弹层从加载提示跳到正文。 */
export function useConfiguredDocumentHelp(open: Ref<boolean>, getPoint: () => { code: string; key: string } | undefined) {
  const content = ref('')
  const loading = ref(false)
  const failed = ref(false)
  const enabled = ref(false)
  const active = ref(true)
  const visible = computed(() => !loading.value && !failed.value && enabled.value && Boolean(content.value.trim()))
  let sequence = 0
  let controller: AbortController | undefined

  async function load() {
    const current = ++sequence
    controller?.abort()
    controller = undefined
    content.value = ''
    enabled.value = false
    loading.value = false
    failed.value = false
    const point = getPoint()
    if (!active.value || !point) return
    open.value = false
    controller = new AbortController()
    loading.value = true
    try {
      const response = await getDocumentHelpContent(point, controller.signal)
      if (current !== sequence) return
      if (!response.success || typeof response.result?.content !== 'string') throw new Error('Invalid document help configuration')
      enabled.value = response.result.enabled !== false
      content.value = enabled.value ? response.result.content : ''
    } catch {
      if (current === sequence) failed.value = true
    } finally {
      if (current === sequence) loading.value = false
    }
  }

  watch([() => JSON.stringify(getPoint()), configurationRevision, active], load, { immediate: true })
  // KeepAlive 首次激活不重复请求，返回缓存页面时重新确认启用状态。
  if (getCurrentInstance()) {
    onActivated(() => { active.value = true })
    onDeactivated(() => { open.value = false; active.value = false })
  }
  onScopeDispose(() => { sequence++; controller?.abort() })
  return { content, loading, failed, enabled, visible, load }
}
