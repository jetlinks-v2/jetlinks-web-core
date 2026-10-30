import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouterParams } from '@jetlinks-web/hooks'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { getReceivedNoticeProviders } from '@jetlinks-web-core/api/account/center'
import { getTypeList_api } from '@jetlinks-web-core/api/account/notificationSubscription'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import {
  markNoticeProvidersRead,
  queryNoticeUnreadSummary,
  useNoticeDataSourceChanges,
} from '@jetlinks-web-core/layout/components/noticeListHandler'
import {
  BADGE_OVERFLOW_COUNT, createTabCountMap, createUnreadQueryParams, toBadgeCount,
  type CappedUnreadCount,
} from '@jetlinks-web-core/layout/components/noticeUtils'
import type { NotificationProvider } from '../Subscribe/useNotificationSettings'

type MessageCategory = 'notification' | 'announcement'
interface MessageGroup { key: MessageCategory; nameKey: string; children: NotificationProvider[] }
interface NotificationType { id: string; name: string; type?: { id: string; name: string } }
export interface MessageTypeRequest { category: MessageCategory; id: string; sequence: number }

/** 按注册能力归组真实 provider，同时兼容顶部通知传来的原分类或单条消息。 */
export function useStationMessage() {
  const { t } = useI18n()
  const user = useUserStore()
  const router = useRouterParams()
  const tabs = ref<MessageGroup[]>([])
  const activeKey = ref<MessageCategory>('notification')
  const activeGroup = computed(() => tabs.value.find(item => item.key === activeKey.value))
  const hasProviders = computed(() => tabs.value.some(item => item.children.length > 0))
  const loading = ref(false)
  const failed = ref(false)
  const operationFailed = ref(false)
  const markingAll = ref(false)
  const counts = ref<Record<string, CappedUnreadCount>>({})
  const requestedType = ref<MessageTypeRequest>()
  let disposed = false
  let countVersion = 0
  let typeSequence = 0

  function selectCategory(value: string | number) {
    const key = String(value)
    const group = tabs.value.find(item => item.key === key
      || item.children.some(child => child.provider === key || child.type?.id === key))
    if (!group) return
    const child = group.children.find(item => item.provider === key || item.type?.id === key)
    if (child && key !== group.key) {
      // 顶部通知“查看更多”传入原分类，切换页签后继续按该分类筛选。
      requestedType.value = { category: group.key, id: child.type?.id || child.provider, sequence: ++typeSequence }
    }
    activeKey.value = group.key
    if (user.other.tabKey !== group.key) user.other.tabKey = group.key
  }

  function clearRequestedType(sequence: number) {
    if (requestedType.value?.sequence === sequence) requestedType.value = undefined
  }

  function syncNotification(notification?: { topicProvider?: string }) {
    if (notification?.topicProvider) selectCategory(notification.topicProvider)
  }

  async function refreshCounts() {
    const ids = tabs.value.flatMap(item => item.children.map(child => child.provider))
    const current = ++countVersion
    if (!ids.length) { counts.value = {}; return }
    try {
      const response = await queryNoticeUnreadSummary(ids, createUnreadQueryParams(ids, BADGE_OVERFLOW_COUNT))
      if (disposed || current !== countVersion || response?.success === false || !response?.result) return
      counts.value = createTabCountMap(
        tabs.value.map(item => ({ key: item.key, tab: item.nameKey, type: item.children.map(child => child.provider) })),
        response.result,
      )
    } catch {
      // 分类角标失败时保留旧值，消息列表仍可使用。
    }
  }

  function countFor(key: string) {
    return toBadgeCount(counts.value[key])
  }

  async function load() {
    if (loading.value) return
    loading.value = true
    let providers = tabs.value.flatMap(group => group.children)
    const results = await Promise.allSettled([getReceivedNoticeProviders(), getTypeList_api()])
    if (disposed) return
    const [channels, types] = results.map(result => {
      if (result.status === 'rejected') return undefined
      const response = result.value
      const rows = Array.isArray(response) ? response : response?.result
      return response?.success === false || !Array.isArray(rows) ? undefined : rows
    }) as [NotificationProvider[] | undefined, NotificationType[] | undefined]
    failed.value = !channels || !types
    if (channels || types) {
      providers = [...(channels || [])]
      const existing = new Set(providers.map(item => item.provider))
      // 通道决定接收方式；类型目录补全系统真实支持的分类，不能因没有通道而丢失历史消息。
      for (const item of types || []) {
        if (!item.id || existing.has(item.id)) continue
        providers.push({ provider: item.id, name: item.name, type: item.type, channels: [] })
        existing.add(item.id)
      }
    }
    const registeredAnnouncements = componentsRegistry.getRegistry('notification-provider:default')
      .filter(item => item.props?.messageCategory === 'announcement')
    const announcementIds = new Set(registeredAnnouncements.map(item => item.code))
    const groups: Record<MessageCategory, MessageGroup> = {
      notification: { key: 'notification', nameKey: 'PersonalCenter.messageNotification', children: [] },
      announcement: { key: 'announcement', nameKey: 'PersonalCenter.messageAnnouncement', children: [] },
    }
    for (const provider of providers) {
      if (!provider?.provider) continue
      groups[announcementIds.has(provider.provider) ? 'announcement' : 'notification'].children.push(provider)
    }
    // 公告收件箱与订阅通道是不同能力；通道缺失不代表当前用户没有历史公告。
    for (const item of registeredAnnouncements) {
      if (groups.announcement.children.some(provider => provider.provider === item.code)) continue
      const name = t('PersonalCenter.messageAnnouncement')
      groups.announcement.children.push({
        provider: item.code, name, channels: [], type: { id: item.code, name },
      })
    }
    tabs.value = [groups.notification, ...(groups.announcement.children.length ? [groups.announcement] : [])]
    if (!tabs.value.some(group => group.key === activeKey.value)) activeKey.value = tabs.value[0]?.key || 'notification'
    selectCategory(router.params.value?.other?.tabKey || user.other.tabKey || '')
    syncNotification(user.messageInfo?.topicProvider ? user.messageInfo : router.params.value?.row)
    loading.value = false
    void refreshCounts()
  }

  async function markAllRead() {
    const providers = [...new Set(tabs.value.flatMap(item => item.children.map(child => child.provider)))]
    if (!providers.length || markingAll.value) return false
    markingAll.value = true
    operationFailed.value = false
    try {
      const response = await markNoticeProvidersRead(providers)
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Mark all failed')
      user.updateAlarm()
      void refreshCounts()
      return true
    } catch {
      if (!disposed) operationFailed.value = true
      return false
    } finally {
      if (!disposed) markingAll.value = false
    }
  }

  watch(() => router.params.value?.other?.tabKey, key => { if (key) selectCategory(key) }, { immediate: true })
  watch(() => user.other.tabKey, key => { if (key) selectCategory(key) })
  watch(() => router.params.value?.row, syncNotification)
  watch(() => user.messageInfo, syncNotification)
  watch(() => [user.alarmUpdateCount, user.unreadNoticeCount], () => { if (tabs.value.length) void refreshCounts() })
  useNoticeDataSourceChanges(
    () => tabs.value.flatMap(item => item.children.map(child => child.provider)),
    () => { void refreshCounts() },
  )
  onMounted(load)
  onUnmounted(() => {
    disposed = true
    countVersion++
    if (user.messageInfo?.id) user.messageInfo = {}
    router.clear?.()
  })
  return {
    user, tabs, activeKey, activeGroup, hasProviders, loading, failed, operationFailed, markingAll,
    countFor, load, selectCategory, markAllRead, requestedType, clearRequestedType,
  }
}
