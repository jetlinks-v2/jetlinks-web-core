import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import type { DataCapabilityRuntime, PersistedDataBinding } from '../data-capability/types'
import type { ObjectContentEntry } from '../components/ObjectOverview/ObjectContentGroup.vue'
import { createHistoryWindow } from '../components/RuntimeDiagnostics/history/range'
import type { MetricChart, TimeWindow } from '../components/RuntimeDiagnostics/types'
import { objectDataAccess, objectDataAnalysis } from './dataAccess'
import { useDataCapabilityRequest } from '../data-capability/request'
import { objectCapabilitiesApi } from './api'
import { useValueUnit } from '../hooks/useValueUnit'
import { objectValueSchema } from './metadata'
import type { ObjectCapabilityValue, ObjectDataSample, ObjectPropertyMetadata } from './types'

/** One cancellable query lifetime for the selected data item or declared object analysis. */
export function useObjectDataQuery(entry: Readonly<Ref<ObjectContentEntry | undefined>>, runtime: () => DataCapabilityRuntime | undefined) {
  const access = computed(() => objectDataAccess(entry.value?.member))
  const analysis = computed(() => objectDataAnalysis(entry.value?.member))
  const request = useDataCapabilityRequest()
  const objectTypes = shallowRef<Array<{ value: string; label: string }>>([])
  const range = ref<TimeWindow>(createHistoryWindow()), mode = ref<'history' | 'aggregate'>('history')
  const operation = ref(''), intervalSeconds = ref(1), input = shallowRef<Record<string, unknown>>({})
  const busy = ref(false), failed = ref(false), limited = ref(false), pageIndex = ref(0)
  const typesFailed = ref(false)
  const result = shallowRef<ObjectCapabilityValue>()
  const valueType = computed(() => mode.value === 'aggregate'
    ? access.value?.operations.find(value => value.id === operation.value)?.valueType || (entry.value?.member?.metadata as ObjectPropertyMetadata)?.valueType
    : (entry.value?.member?.metadata as ObjectPropertyMetadata)?.valueType)
  const unit = useValueUnit(() => valueType.value?.unit)
  const numeric = computed(() => {
    const schema = objectValueSchema(valueType.value)
    return schema && (schema.type === 'number' || schema.type === 'integer') && !schema.enum
  })
  let generation = 0, controller = new AbortController()
  const samples = computed(() => result.value?.values.flatMap(value => Array.isArray(value.value)
    ? (value.value as ObjectDataSample[]).map(sample => ({ ...sample, object: value.object })) : []) || [])
  const charts = computed<MetricChart[]>(() => !access.value || !numeric.value ? [] : (result.value?.values || []).map(value => ({
    key: JSON.stringify(value.object), label: entry.value?.member?.name || value.object.name || value.object.id,
    unit: unit.value,
    series: [{ key: value.object.id, label: value.object.name || value.object.id,
      samples: (Array.isArray(value.value) ? value.value as ObjectDataSample[] : [])
        .filter(sample => typeof sample.value === 'number' && Number.isFinite(sample.value))
        .map(sample => ({ timestamp: sample.timestamp, value: sample.value as number })).sort((a, b) => a.timestamp - b.timestamp) }],
  })).filter(chart => chart.series.some(series => series.samples.length)))

  function resetInterval() {
    const budget = access.value?.pageSize || analysis.value?.pageSize
    if (budget) intervalSeconds.value = Math.max(1, Math.ceil((range.value.to - range.value.from) / Math.max(1, budget - 1) / 1000))
  }
  async function query(append = false) {
    const selected = entry.value, session = runtime()
    const token = ++generation
    controller.abort(); controller = new AbortController()
    if (!selected || !session || !('source' in selected.selection.binding)) return
    busy.value = true; failed.value = false
    if (!append) { pageIndex.value = 0; result.value = undefined; limited.value = false }
    const data = access.value
    const parameters = data ? { dataMode: mode.value, ...range.value, interval: intervalSeconds.value * 1000,
      aggregation: operation.value, pageIndex: pageIndex.value, pageSize: data.pageSize } : { ...input.value,
        ...(analysis.value ? { [analysis.value.from]: range.value.from, [analysis.value.to]: range.value.to,
          [analysis.value.interval]: intervalSeconds.value * 1000 } : {}),
      }
    const binding = selected.selection.binding as PersistedDataBinding
    try {
      const response = await session.query<ObjectCapabilityValue>({ ...binding, query: { ...binding.query, ...parameters } }, { signal: controller.signal })
      if (token !== generation) return
      if (data) for (const value of response.data.values) {
        if (!Array.isArray(value.value) || value.value.some(sample => !sample || typeof sample.timestamp !== 'number' ||
          !Number.isFinite(sample.timestamp) || sample.timestamp < Math.max(0, range.value.from - (mode.value === 'aggregate' ? intervalSeconds.value * 1000 : 0)) || sample.timestamp > range.value.to)) throw new Error('Invalid source time')
      }
      limited.value = response.data.limited || !!data && mode.value === 'history' && response.data.values.some(value =>
        Array.isArray(value.value) && value.value.length === data.pageSize)
      result.value = append && result.value ? { ...response.data, values: response.data.values.map(value => ({ ...value,
        value: [...(result.value!.values.find(previous => previous.object.type === value.object.type && previous.object.id === value.object.id)?.value as ObjectDataSample[] || []),
          ...value.value as ObjectDataSample[]],
      })) } : response.data
    } catch { if (token === generation) { failed.value = true; if (append) pageIndex.value-- } }
    finally { if (token === generation) busy.value = false }
  }
  function more() { if (!busy.value) { pageIndex.value++; void query(true) } }
  function changeRange(value: TimeWindow) { range.value = value; resetInterval(); void query() }
  function changeMode(value: 'history' | 'aggregate') { mode.value = value; void query() }
  function changeOperation(value: unknown) {
    if (typeof value !== 'string' || !access.value?.operations.some(item => item.id === value)) return
    operation.value = value; void query()
  }
  async function loadTypes() {
    const token = generation
    failed.value = false; typesFailed.value = false; busy.value = true
    try {
      const types = await objectCapabilitiesApi({ request }).types(controller.signal)
      if (token === generation) objectTypes.value = types.map(type => ({ value: type.id, label: type.i18nName || type.name }))
    } catch { if (token === generation) { failed.value = true; typesFailed.value = true } }
    finally { if (token === generation) busy.value = false }
  }
  function retry() {
    if (!typesFailed.value) { void query(); return }
    generation++; controller.abort(); controller = new AbortController(); void loadTypes()
  }
  watch(entry, value => {
    generation++; controller.abort(); controller = new AbortController()
    result.value = undefined; failed.value = false; typesFailed.value = false; busy.value = false; limited.value = false
    input.value = {}; objectTypes.value = []; range.value = createHistoryWindow(); mode.value = access.value?.history ? 'history' : 'aggregate'
    operation.value = access.value?.operations[0]?.id || ''; resetInterval()
    if (value && access.value) void query()
    else if (value && analysis.value?.objectTypes.length) void loadTypes()
  }, { immediate: true })
  onBeforeUnmount(() => { generation++; controller.abort() })
  return { access, analysis, objectTypes, valueType, range, mode, operation, intervalSeconds, input, busy, failed, limited, result, samples, charts,
    query, more, changeRange, changeMode, changeOperation, retry }
}
