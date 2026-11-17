import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { metricApi } from '../api'
import { errorText } from '../service'
import type { MetricApi, MetricHistoryAggregate, MetricHistoryOperation, MetricReference, MetricValue } from '../types'

/** 按需查询已存结果；不轮询，不重算，不把时间桶绑定到任意一条执行记录。 */
export function useMetricHistoryAggregate(reference:Ref<MetricReference>, bounds:Ref<[number,number] | undefined>,
  available:Ref<boolean>, api:MetricApi = metricApi, dataVersion?:Ref<string | undefined>, queryKey?:Ref<string | undefined>) {
  const operations = shallowRef<MetricHistoryAggregate['operations']>([])
  const operation = ref<MetricHistoryOperation | ''>(''), interval = ref(0)
  const response = shallowRef<MetricHistoryAggregate>(), loading = ref(false), error = ref('')
  const queriedBounds = shallowRef<[number,number]>()
  let generation = 0, controller:AbortController | undefined, described = false
  const width = computed(() => interval.value || Math.max(1000, Math.ceil(((bounds.value?.[1] || 0)-(bounds.value?.[0] || 0))/200/1000)*1000))
  const values = computed<MetricValue[]>(() => response.value?.buckets.map(bucket => ({
    metricId:reference.value.outputId, value:bucket.value ?? null, evaluationTime:Math.max(bucket.from,queriedBounds.value?.[0] ?? bucket.from),
    status:bucket.value == null ? 'invalid' : 'success',
    tags:{historyAggregation:{operation:response.value!.operation,from:bucket.from,to:bucket.to}},
  })) || [])
  function cancel() { generation++; controller?.abort(); controller = undefined; loading.value = false }
  async function load() {
    cancel()
    if (!available.value || !api.aggregateHistory || !bounds.value) return
    const token = generation, selected = reference.value, extent:[number,number] = [...bounds.value]
    controller = new AbortController(); loading.value = true; error.value = ''; response.value = undefined
    try {
      const result = await api.aggregateHistory(selected.configId, { output:selected.outputId,
        targetType:selected.targetType,targetId:selected.targetId, from:extent[0], to:extent[1],
        interval:width.value, ...(dataVersion?.value ? {dataVersion:dataVersion.value} : {}), ...(operation.value ? {operation:operation.value} : {}) }, controller.signal)
      if (token !== generation) return
      operations.value = result.operations; described = true; response.value = result; queriedBounds.value = extent
    } catch (cause) { if (token === generation) error.value = errorText(cause) }
    finally { if (token === generation) loading.value = false }
  }
  function describe() { if (!described && !loading.value) void load() }
  watch(() => JSON.stringify([reference.value,available.value,dataVersion?.value]), () => {
    cancel(); described = false; operations.value = []; operation.value = ''; response.value = undefined; error.value = ''
  })
  watch([operation,interval,() => queryKey?.value ?? JSON.stringify(bounds.value)], () => {
    if (operation.value) void load(); else { cancel(); response.value = undefined; error.value = '' }
  })
  onScopeDispose(cancel)
  return {operations,operation,interval,width,values,bounds:queriedBounds,loading,error,describe,refresh:load}
}
