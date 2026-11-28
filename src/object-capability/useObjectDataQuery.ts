import { computed, onActivated, ref, shallowRef, watch, type Ref } from 'vue'
import type { DataCapabilityRuntime, PersistedDataBinding } from '../data-capability/types'
import type { ObjectContentEntry } from '../components/ObjectOverview/ObjectContentGroup.vue'
import { createHistoryWindow } from '../components/RuntimeDiagnostics/history/range'
import type { MetricChart, TimeWindow } from '../components/RuntimeDiagnostics/types'
import { objectDataAccess, objectDataAnalysis } from './dataAccess'
import { useDataCapabilityRequest } from '../data-capability/request'
import { objectCapabilitiesApi } from './api'
import { useValueUnit } from '../hooks/useValueUnit'
import { objectValueSchema } from './metadata'
import type { ObjectCapabilityValue, ObjectDataSample, ObjectFunctionMetadata, ObjectPropertyMetadata } from './types'
import { objectAggregationQuery } from './aggregation'
import { useDiagnosticQuery } from '../hooks/useDiagnosticQuery'
import { selectionKey } from './dashboard'

interface ObjectDataPage { result: ObjectCapabilityValue; pageIndex: number; hasMore: boolean }

/** Source reads and parameter choices have independent lifetimes for one semantic selection. */
export function useObjectDataQuery(entry: Readonly<Ref<ObjectContentEntry | undefined>>, runtime: () => DataCapabilityRuntime | undefined) {
  const access = computed(() => objectDataAccess(entry.value?.member))
  const analysis = computed(() => objectDataAnalysis(entry.value?.member))
  const request = useDataCapabilityRequest()
  const reading = useDiagnosticQuery<ObjectDataPage>({ retainOnDeactivate: true })
  const typeOptions = useDiagnosticQuery<Array<{ value: string; label: string }>>({ retainOnDeactivate: true })
  const objectTypes = computed(() => typeOptions.data.value || [])
  const range = ref<TimeWindow>(createHistoryWindow()), mode = ref<'history' | 'aggregate'>('history')
  const operation = ref(''), intervalSeconds = ref(1), input = shallowRef<Record<string, unknown>>({})
  const busy = computed(() => reading.state.value.status === 'loading')
  const failed = computed(() => reading.state.value.status === 'error')
  const typesBusy = computed(() => typeOptions.state.value.status === 'loading')
  const typesFailed = computed(() => typeOptions.state.value.status === 'error')
  const result = computed(() => reading.data.value?.result)
  const hasMore = computed(() => reading.data.value?.hasMore || false)
  const fields = computed(() => ((entry.value?.member?.metadata as ObjectFunctionMetadata)?.inputs || []).filter(field =>
    !analysis.value || ![analysis.value.from, analysis.value.to, analysis.value.interval].includes(field.id)))
  const valueType = computed(() => mode.value === 'aggregate'
    ? access.value?.operations.find(value => value.id === operation.value)?.valueType
    : (entry.value?.member?.metadata as ObjectPropertyMetadata)?.valueType)
  const unit = useValueUnit(() => valueType.value?.unit)
  const numeric = computed(() => {
    const schema = objectValueSchema(valueType.value)
    return schema && (schema.type === 'number' || schema.type === 'integer') && !schema.enum
  })
  let lastQuery: 'replace' | 'append' | undefined
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
    if (!selected || !session || !('source' in selected.selection.binding)) { reading.clear(); return }
    lastQuery = append ? 'append' : 'replace'
    const data = access.value
    const binding = selected.selection.binding as PersistedDataBinding
    const previous = append ? reading.data.value : undefined
    const pageIndex = previous ? previous.pageIndex + 1 : 0
    const window = { ...range.value }, modeValue = mode.value, interval = intervalSeconds.value
    await reading.run(async signal => {
      let parameters: Record<string, unknown>
      if (data && modeValue === 'aggregate') {
        parameters = { dataMode: modeValue, aggregationQuery: objectAggregationQuery(data, selected.member!.ref.id, window, operation.value, interval) }
      } else if (data) {
        parameters = { dataMode: modeValue, ...window, pageIndex, pageSize: data.pageSize }
      } else {
        parameters = { ...input.value }
        if (analysis.value) Object.assign(parameters, { [analysis.value.from]: window.from, [analysis.value.to]: window.to,
          [analysis.value.interval]: interval * 1000 })
      }
      const response = await session.query<ObjectCapabilityValue>({ ...binding, query: { ...binding.query, ...parameters } }, { signal })
      if (data) for (const value of response.data.values) {
        if (!Array.isArray(value.value) || value.value.some(sample => !sample || typeof sample.timestamp !== 'number' ||
          !Number.isFinite(sample.timestamp) || sample.timestamp < Math.max(0, window.from - (modeValue === 'aggregate' ? interval * 1000 : 0)) || sample.timestamp > window.to)) throw new Error('Invalid source time')
      }
      const more = !!data && modeValue === 'history' && response.data.values.some(value =>
        Array.isArray(value.value) && value.value.length === data.pageSize)
      let next = response.data
      if (previous) next = { ...next, values: next.values.map(value => ({ ...value,
        value: [...(previous.result.values.find(row => row.object.type === value.object.type && row.object.id === value.object.id)?.value as ObjectDataSample[] || []),
          ...value.value as ObjectDataSample[]],
      })) }
      return { result: next, pageIndex, hasMore: more }
    }, true, { retainData: append })
  }
  function more() { if (!busy.value && hasMore.value) void query(true) }
  function changeRange(value: TimeWindow) { range.value = value; resetInterval(); if (access.value) void query() }
  function changeMode(value: 'history' | 'aggregate') { mode.value = value; void query() }
  function changeOperation(value: unknown) {
    if (typeof value !== 'string' || !access.value?.operations.some(item => item.id === value)) return
    operation.value = value; void query()
  }
  async function loadTypes() {
    await typeOptions.run(async signal => {
      const types = await objectCapabilitiesApi({ request }).types(signal)
      return types.map(type => ({ value: type.id, label: type.i18nName || type.name }))
    }, true)
  }
  function retry() { if (failed.value) void query(lastQuery === 'append') }
  watch([() => entry.value && selectionKey(entry.value.selection), () => entry.value?.member?.metadata, runtime], () => {
    const value = entry.value
    reading.clear(); typeOptions.clear(); lastQuery = undefined
    input.value = {}; range.value = createHistoryWindow(); mode.value = access.value?.history ? 'history' : 'aggregate'
    operation.value = access.value?.operations[0]?.id || ''; resetInterval()
    if (value && access.value) void query()
    else if (value && analysis.value?.objectTypes.length) void loadTypes()
  }, { immediate: true })
  onActivated(() => {
    if (!entry.value) return
    if ((access.value || lastQuery) && !reading.data.value && reading.state.value.status === 'ready') void query(lastQuery === 'append')
    if (analysis.value?.objectTypes.length && !typeOptions.data.value && typeOptions.state.value.status === 'ready') void loadTypes()
  })
  return { access, analysis, fields, objectTypes, typesBusy, typesFailed, valueType, range, mode, operation, intervalSeconds, input,
    busy, failed, hasMore, result, samples, charts, query, more, changeRange, changeMode, changeOperation, retry, retryTypes: loadTypes }
}
