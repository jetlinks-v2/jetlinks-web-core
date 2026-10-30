import { computed, getCurrentInstance, h, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { notification, Button } from 'ant-design-vue'
import { useWebSocket } from '@jetlinks-web-core/hooks'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { getReceivedNoticeProviders } from '@jetlinks-web-core/api/account/center'
import { getTypeList_api, type NotificationTypeDefinition } from '@jetlinks-web-core/api/account/notificationSubscription'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import {
  changeNoticeReadState,
  queryNoticeRecordsNoPaging,
  queryNoticeUnreadSummary,
  useNoticeDataSourceChanges,
  useNoticeDataSourceRealtime,
} from './noticeListHandler'
import {
  BADGE_OVERFLOW_COUNT, createNoticeCategoryTabs, createUnreadQueryParams, toBadgeCount,
  type NoticeProvider, type NoticeRecord, type NoticeTabItem,
} from './noticeUtils'
import { handleRegisteredRealtimeNotice, type NoticeTipOptions } from './noticeRealtimeHandler'
import { runRegisteredLoginNoticeHandlers } from './noticeLoginHandler'
import { resolveNoticeTexts } from './noticeTextResolver'

/** 查询失败与真正的空列表分别处理，兼容现有普通列表和分页结果。 */
function readNoticeRows<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object' || ('success' in response && response.success === false)) throw new Error('Notice query failed')
  const result = 'result' in response ? response.result : undefined
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) return result.data
  throw new Error('Invalid notice response')
}

/** 铃铛、用户菜单共用未读结果；分类以真实目录和业务模块注册信息为准。 */
export function useHeaderNotice() {
  const { t } = useI18n()
  const user = useUserStore()
  const menu = useMenuStore()
  const appContext = getCurrentInstance()?.appContext
  const visible = ref(false)
  const total = toRef(user, 'unreadNoticeCount')
  const catalogLoading = ref(false)
  const countLoading = ref(false)
  const catalogFailed = ref(false)
  const countFailed = ref(false)
  const loading = computed(() => catalogLoading.value || countLoading.value)
  const error = computed(() => catalogFailed.value || countFailed.value)
  const tabs = ref<NoticeTabItem[]>([])
  const providerNames = ref<Record<string, string>>({})
  const noticeInfoRef = ref<{ refresh: () => void } | null>(null)
  let channelProviders: NoticeProvider[] = []
  let typeProviders: NoticeProvider[] = []
  let countRequestId = 0
  let catalogRequestId = 0
  let disposed = false
  let subscribed = false
  let loginHandlersStarted = false

  async function getList() {
    const current = ++countRequestId
    const providers = [...new Set(tabs.value.flatMap(item => item.type))]
    if (!providers.length) { total.value = 0; countFailed.value = false; countLoading.value = false; return }
    countLoading.value = true
    try {
      const response = await queryNoticeUnreadSummary(
        providers,
        createUnreadQueryParams(providers, BADGE_OVERFLOW_COUNT),
      )
      if (disposed || current !== countRequestId) return
      if (response?.success === false || !response?.result?.total) throw new Error('Unread count unavailable')
      total.value = toBadgeCount(response.result.total)
      countFailed.value = false
    } catch {
      if (!disposed && current === countRequestId) countFailed.value = true
    } finally {
      if (!disposed && current === countRequestId) countLoading.value = false
    }
  }

  async function markNotificationRead(payload: NoticeRecord) {
    const response = await changeNoticeReadState(
      [String(payload.topicProvider || '')],
      '_read',
      [payload.id],
    )
    if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Notification update failed')
    await getList()
  }

  async function read(type: string, payload: NoticeRecord) {
    try {
      await markNotificationRead(payload)
      if (type !== '_read') menu.routerPush('account/center', { params: { tabKey: 'StationMessage', row: payload } })
    } catch { countFailed.value = true }
  }

  function showNoticeTip(payload: NoticeRecord, options: NoticeTipOptions) {
    const key = String(payload.id || options.title || '')
    notification.open({
      key, icon: options.icon, message: options.title, description: options.description,
      onClick: () => { notification.close(key); options.onClick?.() },
    })
  }

  async function handleRealtimePayload(payload: Record<string, any> | undefined) {
    if (!payload?.id || disposed) return
    const notice = payload as NoticeRecord
    const handled = await handleRegisteredRealtimeNotice(notice, {
      markRead: () => markNotificationRead(notice), refresh: getList, appContext, source: 'realtime',
      showTip: options => showNoticeTip(notice, options),
    })
    void getList()
    noticeInfoRef.value?.refresh()
    if (handled) return
    notification.open({
      key: notice.id, message: notice.topicName,
      description: () => h('div', { class: 'ellipsis', style: { cursor: 'pointer' }, onClick: () => read('', notice) }, notice.message),
      onClick: () => read('', notice),
      btn: () => h(Button, {
        type: 'primary', size: 'small',
        onClick: (event: Event) => { event.stopPropagation(); void read('_read', notice) },
      }, { default: () => t('components.Notice.573407-0') }),
    })
  }

  const { send } = useWebSocket({
    onMessage: data => handleRealtimePayload(data?.payload as NoticeRecord | undefined),
  })

  /** 通道失败时保留已知目录，公告入口不依赖订阅通道是否存在。 */
  async function queryTypeList() {
    const current = ++catalogRequestId
    countRequestId++
    catalogLoading.value = true
    try {
      const results = await Promise.allSettled([getReceivedNoticeProviders(), getTypeList_api()])
      if (disposed || current !== catalogRequestId) return
      catalogFailed.value = false
      const [channels, types] = results.map(result => {
        try {
          if (result.status === 'rejected') throw result.reason
          return readNoticeRows<NoticeProvider | NotificationTypeDefinition>(result.value)
        } catch { catalogFailed.value = true; return undefined }
      })
      if (channels) channelProviders = channels as NoticeProvider[]
      if (types) typeProviders = (types as NotificationTypeDefinition[]).map(item => ({ provider: item.id, name: item.name, type: item.type }))
      const merged = new Map<string, NoticeProvider>()
      for (const provider of [...typeProviders, ...channelProviders]) if (provider.provider) merged.set(provider.provider, provider)
      const announcements = componentsRegistry.getRegistry('notification-provider:default').filter(item => item.props?.messageCategory === 'announcement')
      tabs.value = createNoticeCategoryTabs([...merged.keys()], announcements.map(item => item.code))
      providerNames.value = Object.fromEntries([...merged].map(([id, provider]) => [id, provider.type?.name || provider.name || '']))
      for (const item of announcements) providerNames.value[item.code] ||= t('PersonalCenter.messageAnnouncement')
      if (tabs.value.some(item => item.type.length) && !subscribed) {
        send('notification', '/notifications', {})
        subscribed = true
      }
      await getList()
      const providers = tabs.value.flatMap(item => item.type).filter(Boolean)
      if (!loginHandlersStarted && providers.length) {
        loginHandlersStarted = true
        await runRegisteredLoginNoticeHandlers({
          topicProviders: providers,
          appContext,
          refresh: async () => {
            await getList()
            noticeInfoRef.value?.refresh()
          },
        })
      }
    } catch {
      if (!disposed && current === catalogRequestId) catalogFailed.value = true
    } finally {
      if (!disposed && current === catalogRequestId) catalogLoading.value = false
    }
  }

  useNoticeDataSourceChanges(() => tabs.value.flatMap(tab => tab.type), () => {
    void getList()
    noticeInfoRef.value?.refresh()
  })
  useNoticeDataSourceRealtime(() => tabs.value.flatMap(tab => tab.type), handleRealtimePayload)
  watch(() => user.userInfo?.id, () => {
    loginHandlersStarted = false
    subscribed = false
    void queryTypeList()
  })
  function handleRead() { visible.value = false; void getList() }
  watch(() => user.alarmUpdateCount, () => { void getList() })
  watch(visible, opened => {
    if (opened) {
      void (tabs.value.length ? getList() : queryTypeList())
      noticeInfoRef.value?.refresh()
    }
  })
  onMounted(() => { void queryTypeList() })
  onUnmounted(() => { disposed = true; countRequestId++; catalogRequestId++ })
  return { visible, total, loading, error, tabs, providerNames, noticeInfoRef, handleRead, retry: queryTypeList }
}

interface NoticeInfoProps { tabs: NoticeTabItem[] }
const DROPDOWN_PAGE_SIZE = 12

/** 列表、详情接管及消息中心跳转共用现有流程，展示组件只派发语义事件。 */
export function useNoticeInfo(props: NoticeInfoProps, action: () => void) {
  const { locale } = useI18n()
  const user = useUserStore()
  const menu = useMenuStore()
  const route = useRoute()
  const appContext = getCurrentInstance()?.appContext
  const activeKey = ref('notification')
  const list = ref<NoticeRecord[]>([])
  const loading = ref(false)
  const failed = ref(false)
  const openingId = ref('')
  let disposed = false
  let requestId = 0

  /** 新分类和重试使旧请求失效，空 provider 时不发无范围查询。 */
  async function refresh() {
    const current = ++requestId
    const providers = props.tabs.find(item => item.key === activeKey.value)?.type || []
    failed.value = false
    if (!providers.length) { list.value = []; loading.value = false; return }
    loading.value = true
    try {
      const response = await queryNoticeRecordsNoPaging(
        providers,
        createUnreadQueryParams(providers, DROPDOWN_PAGE_SIZE),
      )
      const rows = readNoticeRows<NoticeRecord>(response)
      const resolved = await resolveNoticeTexts(rows)
      if (!disposed && current === requestId) list.value = resolved as NoticeRecord[]
    } catch {
      if (!disposed && current === requestId) failed.value = true
    } finally {
      if (!disposed && current === requestId) loading.value = false
    }
  }

  function navigate(record?: NoticeRecord) {
    const category = activeKey.value
    if (route.path === '/account/center') {
      user.tabKey = 'StationMessage'
      user.other.tabKey = category
      user.messageInfo = record || {}
    } else {
      menu.routerPush('account/center', { params: {
        tabKey: 'StationMessage', other: { tabKey: category }, ...(record ? { row: record } : {}),
      } })
    }
    action()
  }

  function openMessageCenter() { navigate() }

  async function selectNotice(record: NoticeRecord) {
    if (openingId.value) return
    openingId.value = record.id
    let markFailed = false
    try {
      const handled = await handleRegisteredRealtimeNotice(record, {
        appContext, source: 'list', refresh,
        markRead: async () => {
          try {
            const response = await changeNoticeReadState([String(record.topicProvider || '')], '_read', [record.id])
            if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Notification update failed')
            user.updateAlarm()
            void refresh()
          } catch (error) { markFailed = true; throw error }
        },
      })
      if (disposed) return
      if (markFailed) { failed.value = true; return }
      if (handled) action()
      else navigate(record)
    } catch { if (!disposed) failed.value = true }
    finally { if (!disposed) openingId.value = '' }
  }

  useNoticeDataSourceChanges(
    () => props.tabs.find(item => item.key === activeKey.value)?.type || [],
    () => { void refresh() },
  )
  watch(() => props.tabs, () => {
    if (!props.tabs.some(item => item.key === activeKey.value)) activeKey.value = props.tabs[0]?.key || 'notification'
    list.value = []
    void refresh()
  }, { immediate: true })
  watch(activeKey, () => { list.value = []; void refresh() })
  watch(locale, () => { void refresh() })
  watch(() => user.userInfo?.id, () => { void refresh() })
  onUnmounted(() => { disposed = true; requestId++ })
  return { activeKey, list, loading, failed, openingId, refresh, selectNotice, openMessageCenter }
}
