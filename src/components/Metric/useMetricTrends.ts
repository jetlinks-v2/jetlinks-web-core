import { computed, onActivated, onDeactivated, onScopeDispose, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue'
import { metricApi } from './api'
import { errorText } from './service'
import type { MetricApi, MetricConfig, MetricHistoryRequest, MetricReference, MetricValue } from './types'

export interface MetricTrendTarget { id: string; key: string; outputs: string[]; intervalOutputs?: string[]; targetType?: string; targetId?: string }
export interface MetricHistoryState {
  values: MetricValue[]
  bounds: [number, number]
  loading: boolean
  error: string
}
export interface MetricHistoryScope {
  configurations: Ref<MetricConfig[]>
  entries: Ref<Record<string, MetricHistoryState>>
  range: Ref<number>
  customRange: Ref<[number, number] | undefined>
  refresh: (id?: string) => void
  refreshLatest: () => Promise<void>
}
export const metricHistoryKey: InjectionKey<MetricHistoryScope> = Symbol('metric-history')

/** 概览与独立详情使用同一有界查询口径；一次配置查询覆盖其全部输出。 */
export function metricHistoryRequest(outputs: string[], bounds: [number, number], intervalsOnly = false): MetricHistoryRequest {
  return { outputs, ...(intervalsOnly ? { intervalsOnly: true } : {}), query: { paging: true, pageSize: 200, pageIndex: 0,
    sorts: [{ name: 'timestamp', order: 'desc' }], terms: intervalsOnly
      ? [{ column: 'intervalStart', termType: 'lt', value: bounds[1] }, { column: 'intervalEnd', termType: 'gt', value: bounds[0] }]
      : [{ column: 'timestamp', termType: 'between', value: bounds }] } }
}

/** 一个对象共享历史快照。只读取可见卡片与打开的详情，旧请求不写入新的对象、范围或数据版本。 */
export function useMetricTrends(targets: Ref<MetricTrendTarget[]>, selected: Ref<MetricReference | undefined>, snapshot: Ref<unknown>, api: MetricApi = metricApi) {
  const entries = shallowRef<Record<string, MetricHistoryState>>({})
  const range = ref(3600000)
  const customRange = ref<[number, number]>()
  const visible = ref(new Set<string>())
  const elements = new Map<string, Element>()
  const owners = new WeakMap<Element, string>()
  const queued = new Map<string, { target: MetricTrendTarget; state: MetricHistoryState }>()
  const keys = new Map<string, string>()
  let active = true
  let running = 0
  let bounds: [number, number] = [Date.now() - range.value, Date.now()]
  const admitted = computed(() => new Set([...visible.value, ...(selected.value ? [selected.value.configId] : [])]))
  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(changes => {
    const next = new Set(visible.value)
    for (const change of changes) {
      const id = owners.get(change.target)
      if (id) change.isIntersecting ? next.add(id) : next.delete(id)
    }
    visible.value = next
  }, { rootMargin: '80px' })

  function observe(id: string, element: Element | null) {
    const previous = elements.get(id)
    if (previous === element) return
    if (previous) { observer?.unobserve(previous); owners.delete(previous) }
    elements.delete(id)
    if (element) { elements.set(id, element); owners.set(element, id); observer?.observe(element) }
    if (!observer || !element) {
      const next = new Set(visible.value)
      element ? next.add(id) : next.delete(id)
      visible.value = next
    }
  }
  function update(id: string, state: MetricHistoryState, patch: Partial<MetricHistoryState>) {
    if (!active || entries.value[id] !== state) return
    entries.value = { ...entries.value, [id]: { ...state, ...patch } }
  }
  /** 同一面板至多三个在途查询；切换范围时只替换队列，尚未结束的旧查询仍占并发额度。 */
  function drain() {
    if (!active) return
    for (const [id, job] of queued) {
      if (running >= 3) break
      if (!admitted.value.has(id)) continue
      queued.delete(id)
      if (entries.value[id] !== job.state) continue
      running++
      void readHistory(job.target, job.state)
        .then(values => update(id, job.state, { values, loading: false }))
        .catch(cause => update(id, job.state, { error: errorText(cause), values: [], loading: false }))
        .finally(() => { running--; drain() })
    }
  }
  async function readHistory(target: MetricTrendTarget, state: MetricHistoryState) {
    const intervalOutputs = target.intervalOutputs || []
    const normal = target.outputs.filter(output => !intervalOutputs.includes(output))
    const scope = target.targetType && target.targetId ? { targetType: target.targetType, targetId: target.targetId } : {}
    const values = normal.length ? await api.history(target.id, { ...metricHistoryRequest(normal, state.bounds), ...scope }) : []
    // Serial subqueries retain the panel's three-request limit and discard obsolete follow-ups.
    if (!active || entries.value[target.id] !== state || !intervalOutputs.length) return values
    return [...values, ...await api.history(target.id, { ...metricHistoryRequest(intervalOutputs, state.bounds, true), ...scope })]
  }
  function reconcile() {
    const current = new Map(targets.value.map(target => [target.id, target]))
    const retained: Record<string, MetricHistoryState> = {}
    for (const [id, state] of Object.entries(entries.value)) {
      if (current.get(id)?.key === keys.get(id)) retained[id] = state
      else { queued.delete(id); keys.delete(id) }
    }
    entries.value = retained
    if (!active) return
    for (const id of admitted.value) {
      const target = current.get(id)
      if (!target || entries.value[id]) continue
      const state: MetricHistoryState = { values: [], bounds: [...bounds], loading: true, error: '' }
      entries.value = { ...entries.value, [id]: state }
      keys.set(id, target.key)
      queued.set(id, { target, state })
    }
    drain()
  }
  function refresh(id?: string, restart = false) {
    const end = Date.now()
    bounds = customRange.value || [end - range.value, end]
    const next = { ...entries.value }
    for (const target of targets.value) {
      const key = target.id, previous = next[key]
      if (restart && !admitted.value.has(key)) { delete next[key]; continue }
      if ((!id || id === key) && admitted.value.has(key) && previous && (restart || !previous.loading)) {
        const state = { ...previous, bounds: [...bounds] as [number, number], loading: true, error: '' }
        next[key] = state
        queued.set(key, { target, state })
      }
    }
    entries.value = next
    reconcile()
  }
  watch(targets, reconcile, { immediate: true })
  watch(admitted, reconcile)
  watch(snapshot, () => refresh())
  // 同一对象切换查询时保留已显示的样本；新状态身份隔离旧请求，避免清空图表造成页面跳变。
  watch([range, customRange], () => { queued.clear(); refresh(undefined,true) })
  onDeactivated(() => { active = false; queued.clear(); entries.value = {} })
  onActivated(() => { if (!active) { active = true; refresh() } })
  onScopeDispose(() => { active = false; observer?.disconnect(); queued.clear(); elements.clear(); entries.value = {} })
  return { entries, range, customRange, observe, refresh }
}
