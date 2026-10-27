import { computed, getCurrentInstance, h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { notification, Button } from 'ant-design-vue'
import { useWebSocket } from '@jetlinks-web-core/hooks'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { getReceivedNoticeProviders } from '@jetlinks-web-core/api/account/center'
import { changeNoticeReadState, queryNoticeUnreadSummary, useNoticeDataSourceChanges } from './noticeListHandler'
import { BADGE_OVERFLOW_COUNT, createUnreadQueryParams, toBadgeCount, type NoticeTabItem } from './noticeUtils'
import { handleRegisteredRealtimeNotice, type NoticeTipOptions } from './noticeRealtimeHandler'

type NoticePayload = Record<string, unknown> & { id: string; topicName?: string; message?: string }
type NoticeChannel = { provider: string; type: { id: string; name: string } }

/** 通知查询和实时事件统一在此处理失败，服务不可用时保留状态并允许显式重试。 */
export function useHeaderNotice() {
  const { t } = useI18n()
  const user = useUserStore()
  const menu = useMenuStore()
  const appContext = getCurrentInstance()?.appContext
  const visible = ref(false)
  const total = ref(0)
  const loading = ref(false)
  const error = ref(false)
  const tabs = ref<NoticeTabItem[]>([])
  const noticeInfoRef = ref<{ refresh: () => void } | null>(null)
  let countRequestId = 0
  let providerRequestId = 0

  async function getList() {
    const current = ++countRequestId
    const providers = tabs.value.flatMap(item => item.type).filter(Boolean)
    if (!providers.length) { total.value = 0; loading.value = false; return }
    // 多次实时刷新只接受最后一次响应，失败时保留已有角标。
    loading.value = true
    try {
      const response = await queryNoticeUnreadSummary(providers, createUnreadQueryParams(providers, BADGE_OVERFLOW_COUNT))
      if (current !== countRequestId) return
      total.value = toBadgeCount(response.result.total)
      error.value = false
    } catch {
      if (current === countRequestId) error.value = true
    } finally {
      if (current === countRequestId) loading.value = false
    }
  }

  async function markNotificationRead(payload: NoticePayload) {
    const response = await changeNoticeReadState([String(payload.topicProvider || '')], '_read', [payload.id])
    if (response.status !== 200) throw new Error('Notification update failed')
    await getList()
  }

  async function read(type: string, payload: NoticePayload) {
    try {
      await markNotificationRead(payload)
      if (type !== '_read') menu.routerPush('account/center', { params: { tabKey: 'StationMessage', row: payload } })
    } catch { error.value = true }
  }

  function showNoticeTip(payload: NoticePayload, options: NoticeTipOptions) {
    const key = String(payload.id || options.title || '')
    notification.open({
      key, icon: options.icon, message: options.title, description: options.description,
      onClick: () => { notification.close(key); options.onClick?.() }
    })
  }

  const { send } = useWebSocket({
    async onMessage(data) {
      const payload = data?.payload as NoticePayload | undefined
      if (!payload?.id) return
      const handled = await handleRegisteredRealtimeNotice(payload, {
        markRead: () => markNotificationRead(payload), refresh: getList, appContext, source: 'realtime',
        showTip: options => showNoticeTip(payload, options)
      })
      void getList()
      noticeInfoRef.value?.refresh()
      if (handled) return
      notification.open({
        key: payload.id, message: payload.topicName,
        description: () => h('div', { class: 'ellipsis', style: { cursor: 'pointer' }, onClick: () => read('', payload) }, payload.message),
        onClick: () => read('', payload),
        btn: () => h(Button, {
          type: 'primary', size: 'small',
          onClick: (event: Event) => { event.stopPropagation(); void read('_read', payload) }
        }, { default: () => t('components.Notice.573407-0') })
      })
    }
  })

  async function queryTypeList() {
    const current = ++providerRequestId
    countRequestId++
    loading.value = true
    try {
      const response = await getReceivedNoticeProviders()
      if (current !== providerRequestId) return
      if (response.status !== 200) throw new Error('Notification channels unavailable')
      const grouped = new Map<string, NoticeTabItem>()
      for (const channel of response.result as NoticeChannel[]) {
        const tab = grouped.get(channel.type.id)
        if (tab) tab.type.push(channel.provider)
        else grouped.set(channel.type.id, { key: channel.type.id, tab: channel.type.name, type: [channel.provider] })
      }
      tabs.value = [...grouped.values()]
      error.value = false
      if (tabs.value.length) send('notification', '/notifications', {})
      await getList()
    } catch { if (current === providerRequestId) error.value = true }
    finally { if (current === providerRequestId) loading.value = false }
  }

  useNoticeDataSourceChanges(() => tabs.value.flatMap(tab => tab.type), () => {
    void getList()
    noticeInfoRef.value?.refresh()
  })
  watch(() => user.userInfo?.id, () => { void queryTypeList() })

  function handleRead() { visible.value = false; void getList() }
  watch(computed(() => user.alarmUpdateCount), () => { void getList() })
  watch(visible, opened => {
    if (opened) {
      void (tabs.value.length ? getList() : queryTypeList())
      noticeInfoRef.value?.refresh()
    }
  })
  onMounted(() => { void queryTypeList() })
  return { visible, total, loading, error, tabs, noticeInfoRef, handleRead, retry: queryTypeList }
}
