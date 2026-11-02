import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from './api'
import { errorText } from './service'
import { metricChartPoints } from './presentation'
import type { MetricApi, MetricConfig, MetricLatest, MetricReference, MetricRuntime, MetricValue } from './types'

/** 历史读取服务器当前口径；有界结果不补零，也不跨配置回填旧请求。 */
export function useMetricResult(reference: Ref<MetricReference | undefined>, api: MetricApi = metricApi, snapshot?: Ref<MetricLatest | undefined>) {
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
    loading.value = true
    error.value = ''
    const end = Date.now()
    const [from, to] = customRange.value || [end - range.value, end]
    let historyRequested = false
    try {
      const [live, config] = await Promise.all([api.latest([configId]), api.getConfig(configId)])
      // 抽屉关闭、撤权或切换输出后，不再为已卸载的详情继续发起历史请求。
      if (token !== generation) return
      const authorized = live.find(item => item.configId === configId)
      configuration.value = config
      if (liveToken === liveGeneration) applyLatest(authorized, outputId)
      // 历史准入以已接受的快照为准，不能让过期响应的省略抹掉趋势或阻断合法读取。
      if (inaccessible.value) return
      historyRequested = true
      const response = await api.history(configId, {
        outputs: [outputId], query: { paging: true, pageSize: 200, pageIndex: 0,
          sorts: [{ name: 'timestamp', order: 'desc' }],
          terms: [{ column: 'timestamp', termType: 'between', value: [from, to] }] }
      })
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
  watch(() => [reference.value?.configId, reference.value?.outputId, range.value, customRange.value], () => {
    generation++
    values.value = []
    current.value = undefined
    runtime.value = undefined
    configuration.value = undefined
    inaccessible.value = false
    void refresh()
  }, { immediate: true })
  // 接受面板现有轮询的快照；手动详情刷新仍可用自己的 latest 响应更新当前值。
  if (snapshot) watch(snapshot, value => {
    const selected = reference.value
    if (!value || !selected || value.configId !== selected.configId) return
    // 已收到较新的面板快照时，迟到的详情 latest 不能覆盖它；历史读取仍继续。
    liveGeneration++
    applyLatest(value, selected.outputId)
  }, { immediate: true })
  onScopeDispose(() => { generation++ })
  return { values, current, runtime, configuration, inaccessible, points, latest, loading, error, range, customRange, refresh }
}

