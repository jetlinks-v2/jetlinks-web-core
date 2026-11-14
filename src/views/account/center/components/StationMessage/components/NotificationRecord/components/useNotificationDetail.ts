import { computed, nextTick, onErrorCaptured, onMounted, onScopeDispose, ref } from 'vue'
import globalI18n from '@jetlinks-web-core/locales'
import { componentsRegistry } from '@jetlinks-web-core/utils/components-registry'
import { getWorkflowNotice, queryLevel } from '@jetlinks-web-core/api/account/notificationRecord'

const workflows = ['workflow-task-cc', 'workflow-task-todo', 'workflow-task-reject',
  'workflow-process-finish', 'workflow-process-repealed', 'workflow-task-transfer-todo']

/** 详情就绪与读状态解耦，加载失败或关闭弹窗都不能触发自动已读。 */
export function useNotificationDetail(
  props: { data: Record<string, any>; confirm?: () => Promise<void> },
  close: () => void, opened: () => void,
) {
  const confirming = ref(false)
  const loading = ref(false)
  const failed = ref(false)
  const levelList = ref<Array<{ level: number; title: string }>>([])
  const workFlowData = ref<Record<string, any>>()
  let active = true
  let version = 0
  const data = computed(() => {
    if (typeof props.data.detailJson === 'string') {
      try { return JSON.parse(props.data.detailJson) || props.data } catch { return props.data }
    }
    return props.data.detail || props.data
  })
  const hasRegisteredDetail = computed(() => componentsRegistry.getRegistry('notification-detail:default')
    .some(item => item.code === props.data.topicProvider))
  const notificationTitle = computed(() => {
    const messages = data.value?.i18nMessages?.title
    const locale = String(globalI18n.global.locale.value || 'zh').replace('_', '-').toLowerCase()
    return String(messages?.[locale] || messages?.[locale.split('-')[0]]
      || data.value?.title || props.data.title || props.data.topicName || props.data.message || '')
  })
  const getLevelLabel = (id: number) => levelList.value.find(item => item.level === id)?.title || ''
  async function load() {
    const current = ++version
    loading.value = true
    failed.value = false
    try {
      if (workflows.includes(props.data.topicProvider) && !hasRegisteredDetail.value) {
        const response = await getWorkflowNotice({ terms: [{ type: 'or', termType: 'eq', column: 'id',
          value: ['workflow-process-finish', 'workflow-process-repealed'].includes(props.data.topicProvider)
            ? props.data.dataId : data.value?.processId }] })
        if (response?.success === false || !response?.result?.[0]) throw new Error('Workflow detail unavailable')
        if (active && current === version) workFlowData.value = response.result[0]
      } else if (!hasRegisteredDetail.value && props.data.topicProvider?.startsWith('alarm-')) {
        const response = await queryLevel()
        if (response?.success === false) throw new Error('Alarm detail unavailable')
        if (active && current === version) levelList.value = response?.result?.levels || []
      }
      await nextTick()
      if (active && current === version && !failed.value && !hasRegisteredDetail.value) opened()
    } catch {
      if (active && current === version) failed.value = true
    } finally {
      if (active && current === version) loading.value = false
    }
  }
  async function registeredReady() {
    await nextTick()
    if (active && !failed.value) opened()
  }
  async function confirmDetail() {
    if (confirming.value || failed.value || loading.value) return
    confirming.value = true
    try {
      await props.confirm?.()
      if (active) close()
    } catch {
      // 已读写入失败由列表展示错误，保持详情以便再次确认。
    } finally { confirming.value = false }
  }
  onErrorCaptured(() => { failed.value = true })
  onMounted(load)
  onScopeDispose(() => { active = false; ++version })
  return { confirming, confirmDetail, levelList, workFlowData, data, notificationTitle,
    hasRegisteredDetail, getLevelLabel, loading, failed, load, registeredReady }
}
