import { computed, onMounted, onScopeDispose } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { useMenuStore } from '@jetlinks-web-core/store/menu'

/** 在独立标签配置通知，返回只刷新候选资源，原业务表单草稿留在所属页面。 */
export function useNotificationConfigNavigation(refresh: () => void | Promise<unknown>, menuCode = 'system/MessageNotification/Templates') {
  const menu = useMenuStore()
  const router = useRouter()
  const { t } = useI18n()
  const available = computed(() => !!menu.getMenu(menuCode)?.path)
  let awaiting = false
  let refreshing = false
  async function refreshOnReturn() {
    if (!awaiting || refreshing || document.visibilityState !== 'visible') return
    refreshing = true
    try { await refresh() } finally { refreshing = false }
  }
  function open(topicProvider: string, channelProvider?: string, query: LocationQueryRaw = {}) {
    const target = menu.getMenu(menuCode)
    if (!target?.path) return
    const href = router.resolve({ path: target.path, query: {
      ...query, topicProvider, ...(channelProvider && channelProvider !== 'inside-mail' ? { channelProvider } : {}),
    } }).href
    const tab = window.open('', '_blank')
    if (!tab) { onlyMessage(t('PersonalCenter.notificationPopupBlocked'), 'warning'); return }
    tab.opener = null
    tab.location.replace(href)
    awaiting = true
  }
  onMounted(() => {
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
  })
  onScopeDispose(() => {
    window.removeEventListener('focus', refreshOnReturn)
    document.removeEventListener('visibilitychange', refreshOnReturn)
  })
  return { available, open }
}
