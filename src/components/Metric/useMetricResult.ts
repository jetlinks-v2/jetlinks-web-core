import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from './api'
import { errorText } from './service'
import { metricChartPoints } from './presentation'
import { metricHistoryRequest, type MetricHistoryScope } from './useMetricTrends'
import type { MetricApi, MetricConfig, MetricLatest, MetricReference, MetricRuntime, MetricValue } from './types'

/** 历史读取服务器当前口径；有界结果不补零，也不跨配置回填旧请求。 */
export function useMetricResult(reference: Ref<MetricReference | undefined>, api: MetricApi = metricApi, snapshot?: Ref<MetricLatest | undefined>, shared?: MetricHistoryScope, intervalsOnly?: Ref<boolean>) {
  if (shared) return sharedResult(reference, snapshot, shared)
  const values = ref<MetricValue[]>([])
  const current = ref<MetricValue>()
  const runtime = ref<MetricRuntime>()
  const configuration = ref<MetricConfig>()
  const inaccessible = ref(false)
  const loading = ref(false)
  const error = ref('')
  const range = ref(3600000)
  const customRange = ref<[number, number]>()
  let generation = 0
  let liveGeneration = 0
  const points = computed(() => metricChartPoints(values.value))
  const latest = computed(() => values.value[0])
  /** 授权、值与运行反馈属于同一份 latest 快照，必须一起接受或一起忽略。 */
  function applyLatest(value: MetricLatest | undefined, outputId: string) {
    inaccessible.value = !value
    current.value = value?.outputs[outputId]
    runtime.value = value?.runtime
    if (!value) values.value = []
  }
  async function refresh() {
    const token = ++generation
    const liveToken = ++liveGeneration
    if (!reference.value?.configId) return
    const { configId, outputId } = reference.value
    const target = reference.value.targetType && reference.value.targetId
      ? { targetType: reference.value.targetType, targetId: reference.value.targetId } : undefined
    loading.value = true
    error.value = ''
    const end = Date.now()
    const [from, to] = customRange.value || [end - range.value, end]
    let historyRequested = false
    try {
      const [live, config] = await Promise.all([target ? api.latest([configId], target) : api.latest([configId]),
        target ? api.getConfig(configId, target) : api.getConfig(configId)])
      // 抽屉关闭、撤权或切换输出后，不再为已卸载的详情继续发起历史请求。
      if (token !== generation) return
      const authorized = live.find(item => item.configId === configId)
      configuration.value = config
      if (liveToken === liveGeneration) applyLatest(authorized, outputId)
      // 历史准入以已接受的快照为准，不能让过期响应的省略抹掉趋势或阻断合法读取。
      if (inaccessible.value) return
      historyRequested = true
      const response = await api.history(configId, { ...metricHistoryRequest([outputId], [from, to], intervalsOnly?.value), ...target })
      if (token === generation && !inaccessible.value) values.value = response
    } catch (cause) {
      if (token === generation && (liveToken === liveGeneration || historyRequested)) {
        error.value = errorText(cause)
        values.value = []
        if (liveToken === liveGeneration) { current.value = undefined; runtime.value = undefined }
      }
    }
    finally { if (token === generation) loading.value = false }
  }
  watch(() => [reference.value?.configId, reference.value?.outputId, reference.value?.targetType, reference.value?.targetId, intervalsOnly?.value], () => {
    generation++
    values.value = []
    current.value = undefined
    runtime.value = undefined
    configuration.value = undefined
    inaccessible.value = false
    void refresh()
  }, { immediate: true })
  // 查询时段不改变对象身份，保留结果和配置直至新查询返回；切换对象仍清理旧数据。
  watch([range,customRange], () => { void refresh() })
  // 接受面板现有轮询的快照；手动详情刷新仍可用自己的 latest 响应更新当前值。
  if (snapshot) watch(snapshot, value => {
    const selected = reference.value
    if (!value || !selected || value.configId !== selected.configId) return
    // 已收到较新的面板快照时，迟到的详情 latest 不能覆盖它；历史读取仍继续。
    liveGeneration++
    applyLatest(value, selected.outputId)
  }, { immediate: true })
  onScopeDispose(() => { generation++ })
  const bounds = computed<[number, number]>(() => customRange.value || [Date.now() - range.value, Date.now()])
  const limited = computed(() => values.value.length >= 200)
  return { values, current, runtime, configuration, inaccessible, points, latest, loading, error, range, customRange, refresh, bounds, limited }
}

/** 面板已持有授权配置和批量最新值，详情只订阅同一历史状态，不重复 latest/getConfig/history。 */
function sharedResult(reference: Ref<MetricReference | undefined>, snapshot: Ref<MetricLatest | undefined> | undefined, shared: MetricHistoryScope) {
  const configuration = computed(() => shared.configurations.value.find(item => item.id === reference.value?.configId))
  const inaccessible = computed(() => !configuration.value || snapshot?.value?.configId !== reference.value?.configId)
  const history = computed(() => reference.value && shared.entries.value[reference.value.configId])
  const values = computed(() => inaccessible.value ? [] : history.value?.values.filter(value => value.metricId === reference.value?.outputId) || [])
  const current = computed(() => !inaccessible.value && reference.value ? snapshot?.value?.outputs[reference.value.outputId] : undefined)
  const runtime = computed(() => inaccessible.value ? undefined : snapshot?.value?.runtime)
  const loading = computed(() => history.value?.loading || false)
  const error = computed(() => history.value?.error || '')
  const points = computed(() => metricChartPoints(values.value))
  const latest = computed(() => values.value[0])
  const bounds = computed(() => history.value?.bounds)
  const limited = computed(() => (history.value?.values.length || 0) >= 200)
  async function refresh() { await shared.refreshLatest(); shared.refresh(reference.value?.configId) }
  return { configuration, inaccessible, values, current, runtime, loading, error, points, latest, bounds, limited, range: shared.range, customRange: shared.customRange, refresh }
}
