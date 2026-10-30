import { computed, onUnmounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useRouterParams } from '@jetlinks-web/hooks'
import { onlyMessage } from '@jetlinks-web/utils'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { changeStatus_api, getList_api } from '@jetlinks-web-core/api/account/notificationRecord'
import { resolveNoticeTexts } from '@jetlinks-web-core/layout/components/noticeTextResolver'
import type { ConditionFilterChangePayload, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import type { MessageTypeRequest } from '../../useStationMessage'

export interface MessageProvider {
  provider: string
  name: string
  type?: { id: string; name: string }
}

export interface MessageFilterState {
  terms: ConditionFilterTerm[]
  params: { terms: ConditionFilterTerm[] }
}

interface MessageRecordProps {
  category: string
  children: MessageProvider[]
  savedFilter?: MessageFilterState
  requestedType?: MessageTypeRequest
}

type NoticeRecord = Record<string, any> & { id: string; topicProvider?: string }

/** 列表筛选、当前用户读写与外部通知定位共用既有消息接口。 */
export function useNotificationRecords(
  props: MessageRecordProps,
  saveFilter: (state: MessageFilterState) => void,
  typeFilterApplied: (sequence: number) => void = () => {},
) {
  const { t, locale } = useI18n()
  const user = useUserStore()
  const router = useRouterParams()
  const tableRef = ref<{ reload: () => void }>()
  const filterTerms = ref<ConditionFilterTerm[]>(props.savedFilter?.terms ?? [])
  const queryParams = ref<{ terms: ConditionFilterTerm[] }>(
    props.savedFilter?.params ?? { terms: [] },
  )
  const selectedIds = ref<string[]>([])
  const updating = ref(false)
  const failed = ref(false)
  const viewVisible = ref(false)
  const viewItem = ref<NoticeRecord>()
  const providerIds = computed(() => props.children.map(item => item.provider))
  let disposed = false
  let incomingId = ''

  const providerGroups = computed(() => {
    const groups = new Map<string, { id: string; name: string; providers: string[] }>()
    for (const item of props.children) {
      const id = item.type?.id || item.provider
      const group = groups.get(id)
      if (group) group.providers.push(item.provider)
      else groups.set(id, { id, name: item.type?.name || item.name, providers: [item.provider] })
    }
    return [...groups.values()]
  })

  const filterFields = computed<ConditionFilterField[]>(() => [
    {
      title: t('PersonalCenter.messageContent'), dataIndex: 'message',
      search: { type: 'string', defaultTermType: 'like' },
    },
    {
      title: t('NotificationRecord.index.803553-4'), dataIndex: 'topicProvider',
      search: {
        type: 'select', defaultTermType: 'eq', termFilter: ['eq'],
        options: providerGroups.value.map(item => ({ label: item.name, value: item.id })),
        handleTerms: (term: ConditionFilterTerm) => ({
          ...term, termType: 'in',
          value: providerGroups.value.find(item => item.id === String(term.value))?.providers || [],
        }),
      },
    },
    {
      title: t('NotificationRecord.index.803553-7'), dataIndex: 'state',
      search: {
        type: 'select', defaultTermType: 'eq', termFilter: ['eq'],
        options: [
          { label: t('NotificationRecord.index.803553-8'), value: 'unread' },
          { label: t('NotificationRecord.index.803553-9'), value: 'read' },
        ],
      },
    },
    {
      title: t('PersonalCenter.messageFilterTime'), dataIndex: 'notifyTime',
      search: {
        type: 'select', defaultTermType: 'eq', termFilter: ['eq'],
        options: [
          { label: t('PersonalCenter.messageToday'), value: 'today' },
          { label: t('PersonalCenter.messageLast7Days'), value: '7' },
          { label: t('PersonalCenter.messageLast30Days'), value: '30' },
        ],
        handleTerms: (term: ConditionFilterTerm) => {
          // 原型时间选项映射为当前自然日范围，保留平台条件筛选的显示和清除方式。
          const today = dayjs().startOf('day')
          const days = term.value === 'today' ? 1 : Number(term.value)
          return {
            ...term, termType: 'btw',
            value: [today.subtract(days - 1, 'day').valueOf(), today.endOf('day').valueOf()],
          }
        },
      },
    },
  ])

  function onFilterChange(payload: ConditionFilterChangePayload) {
    queryParams.value = payload.filter
    selectedIds.value = []
    saveFilter({ terms: filterTerms.value.map(term => ({ ...term })), params: queryParams.value })
  }

  const columns = computed(() => [
    { title: t('NotificationRecord.index.803553-7'), dataIndex: 'state', key: 'state', scopedSlots: true, width: 100 },
    { title: t('NotificationRecord.index.803553-4'), dataIndex: 'topicProvider', key: 'topicProvider', scopedSlots: true, width: 150 },
    { title: t('PersonalCenter.messageTitle'), dataIndex: 'message', key: 'message', scopedSlots: true, ellipsis: true },
    { title: t('NotificationRecord.index.803553-6'), dataIndex: 'notifyTime', key: 'notifyTime', scopedSlots: true, width: 180 },
    { title: t('NotificationRecord.index.803553-10'), dataIndex: 'action', key: 'action', scopedSlots: true, width: 170 },
  ])

  const defaultParams = computed(() => ({
    sorts: [{ name: 'notifyTime', order: 'desc' }],
    terms: [{ column: 'topicProvider', termType: 'in', value: providerIds.value }],
  }))

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedIds.value,
    onChange: (keys: Array<string | number>) => { selectedIds.value = keys.map(String) },
  }))

  async function requestNotifications(params: Record<string, unknown>) {
    // 没有可访问的 provider 时不能发出无范围的消息查询。
    if (!providerIds.value.length) {
      return { success: true, status: 200, result: { data: [], total: 0, pageIndex: params.pageIndex, pageSize: params.pageSize } }
    }
    const response = await getList_api(params)
    const result = response?.result
    const records = Array.isArray(result) ? result : result?.data
    if (!Array.isArray(records)) return response
    const resolved = await resolveNoticeTexts(records)
    return { ...response, result: Array.isArray(result) ? resolved : { ...result, data: resolved } }
  }

  function parseDetail(record: NoticeRecord) {
    if (record.detail && typeof record.detail === 'object') return record.detail
    if (typeof record.detailJson !== 'string') return undefined
    try {
      const detail = JSON.parse(record.detailJson)
      return detail && typeof detail === 'object' ? detail : undefined
    } catch { return undefined }
  }

  function detailText(detail: Record<string, any> | undefined, field: string) {
    const messages = detail?.i18nMessages?.[field]
    if (!messages || typeof messages !== 'object') return ''
    const language = String(locale.value || 'zh').replace('_', '-').toLowerCase()
    return String(messages[language] || messages[language.split('-')[0]] || '').trim()
  }

  function titleOf(record: NoticeRecord) {
    const detail = parseDetail(record)
    return detailText(detail, 'title')
      || String(detail?.title || record.title || record.topicName || record.message || '').trim()
  }

  function summaryOf(record: NoticeRecord) {
    const detail = parseDetail(record)
    const text = detailText(detail, 'summary') || String(detail?.summary || record.summary || record.message || '').trim()
    return text && text !== titleOf(record) ? text : ''
  }

  function typeOf(record: NoticeRecord) {
    const provider = props.children.find(item => item.provider === record.topicProvider)
    const detailType = props.category === 'announcement' ? parseDetail(record)?.type : undefined
    return (typeof detailType === 'object' ? detailType?.text : '')
      || provider?.type?.name || provider?.name || record.topicName || record.topicProvider || ''
  }

  function stateOf(record: NoticeRecord): string {
    return (typeof record.state === 'string' ? record.state : record.state?.value) || ''
  }

  function stateText(record: NoticeRecord) {
    if (record.state?.text) return record.state.text
    const state = stateOf(record)
    if (state === 'read') return t('NotificationRecord.index.803553-9')
    if (state === 'unread') return t('NotificationRecord.index.803553-8')
    return t('comm.table.empty-2')
  }

  function formatTime(value?: string | number) {
    if (!value || !dayjs(value).isValid()) return t('comm.table.empty-2')
    return dayjs(value).format('YYYY-MM-DD HH:mm:ss')
  }

  function refresh() { tableRef.value?.reload?.() }

  async function mark(type: '_read' | '_unread', ids: string[], notify = true) {
    if (!ids.length || updating.value) return false
    updating.value = true
    failed.value = false
    try {
      const response = await changeStatus_api(type, ids)
      if (response?.success === false || (response?.success !== true && response?.status !== 200)) throw new Error('Notification update failed')
      user.updateAlarm()
      if (!disposed) {
        selectedIds.value = []
        refresh()
        if (notify) onlyMessage(t(type === '_read' ? 'PersonalCenter.messageMarkedRead' : 'PersonalCenter.messageMarkedUnread'))
      }
      return true
    } catch {
      if (!disposed) failed.value = true
      return false
    } finally {
      if (!disposed) updating.value = false
    }
  }

  function markSelected(type: '_read' | '_unread') {
    return mark(type, [...selectedIds.value])
  }

  function toggleRead(record: NoticeRecord) {
    return mark(stateOf(record) === 'read' ? '_unread' : '_read', [record.id])
  }

  function view(record: NoticeRecord) {
    viewItem.value = record
    viewVisible.value = true
  }

  function acceptIncoming(record?: Record<string, any>) {
    if (!record?.id || !record.topicProvider || !providerIds.value.includes(record.topicProvider) || incomingId === record.id) return
    incomingId = record.id
    view(record as NoticeRecord)
    if (user.messageInfo?.id === record.id) user.messageInfo = {}
    if (router.params.value?.row?.id === record.id) router.clear?.()
  }

  watch(() => props.requestedType, request => {
    if (!request || request.category !== props.category) return
    const group = providerGroups.value.find(item => item.id === request.id)
    if (!group) return
    filterTerms.value = [
      { column: 'topicProvider', termType: 'eq', value: group.id, type: 'and' },
    ]
    queryParams.value = { terms: [
      { column: 'topicProvider', termType: 'in', value: group.providers, type: 'and' },
    ] }
    selectedIds.value = []
    saveFilter({ terms: filterTerms.value.map(term => ({ ...term })), params: queryParams.value })
    typeFilterApplied(request.sequence)
  }, { immediate: true })
  watch(locale, refresh)
  watch(() => user.messageInfo, acceptIncoming, { immediate: true })
  watch(() => router.params.value?.row, acceptIncoming, { immediate: true })
  onUnmounted(() => { disposed = true })

  return {
    tableRef, filterTerms, queryParams, selectedIds, updating, failed, viewVisible, viewItem,
    filterFields, columns, defaultParams, rowSelection, onFilterChange, requestNotifications,
    titleOf, summaryOf, typeOf, stateOf, stateText, formatTime, refresh, markSelected, toggleRead, view,
  }
}
