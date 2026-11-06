import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { metricApi } from '../api'
import { errorText } from '../service'
import type { MetricApi, MetricContext } from '../types'
import type { MetricCollectionQuery, MetricCollectionResult, MetricCollectionRow, MetricCollectionSelection, MetricReadScopeOption, ReadOperation } from './types'

/** One bounded scope request; stale responses cannot replace a newer scope/page/operation. No per-device requests. */
export function useMetricCollection(context: Ref<MetricContext>, scope: Ref<MetricReadScopeOption>, api: MetricApi = metricApi, selection:Ref<MetricCollectionSelection | undefined> = ref()) {
  const result = ref<MetricCollectionResult>(), loading = ref(false), error = ref(''), selected = ref<MetricCollectionRow>()
  const group = ref<string>(), operation = ref<ReadOperation>('collection'), page = ref(1), descendants = ref(true)
  const view = ref<'list' | 'bars'>('list'), fallback = ref(false)
  const activeGroup = computed(() => result.value?.groups.find(item => item.id === group.value))
  // 同类型树查看下级节点；跨类型查看当前容器直接绑定的设备，不把当前节点冒充下级。
  const depth = computed(() => descendants.value ? 'descendants'
    : scope.value.tree && scope.value.memberType === context.value.ownerType ? 'children' : 'self')
  let sequence = 0, stopped = false, initialized = false
  const preferenceKey = () => `metric-collection:${context.value.ownerType}:${context.value.ownerId}:${scope.value.memberType}`
  function readPreference(): { group?:string | null; operation?:ReadOperation; view?:string; descendants?:boolean } | undefined {
    try { return JSON.parse(localStorage.getItem(preferenceKey()) || 'null') || undefined } catch { return undefined }
  }
  function savePreference() {
    try { localStorage.setItem(preferenceKey(), JSON.stringify({ group:group.value ?? null, operation:operation.value, view:view.value, descendants:descendants.value })) } catch { /* Storage is optional. */ }
  }
  async function refresh() {
    const current = ++sequence
    if (!api.collection) { error.value = 'Metric collection capability unavailable'; return }
    loading.value = true; error.value = ''
    const query: MetricCollectionQuery = { rootType:context.value.ownerType, rootId:context.value.ownerId, memberType:scope.value.memberType,
      depth:depth.value, group:group.value, templateId:selection.value?.templateId, operation:operation.value, pageIndex:page.value - 1, pageSize:20, includeUnconfigured:true }
    try {
      const next = await api.collection(query)
      if (stopped || current !== sequence) return
      result.value = next
      if (!initialized) {
        initialized = true
        const preference = readPreference()
        const primary = next.groups.filter(item => item.displaySettings?.primaryOutput === item.output.metricId)
        const initial = selection.value ? next.groups.find(item=>item.id === selection.value?.group) || primary[0] || next.groups[0]
          : preference?.group === null ? undefined : next.groups.find(item => item.id === preference?.group) || primary[0] || next.groups[0]
        if (initial) {
          group.value = initial.id
          const preferred = preference?.operation || initial.policy?.defaultOperation || 'collection'
          fallback.value = !initial.operations.includes(preferred)
          operation.value = fallback.value ? 'collection' : preferred
          view.value = (preference?.view || initial.policy?.defaultView) === 'bars' ? 'bars' : 'list'
          if (query.group !== group.value || query.operation !== operation.value) await refresh()
        }
      }
    } catch (cause) { if (current === sequence && !stopped) error.value = errorText(cause) }
    finally { if (current === sequence) loading.value = false }
  }
  function selectGroup(value?: string) {
    group.value = value; page.value = 1; fallback.value = false
    const next = activeGroup.value
    const preferred = next?.policy?.defaultOperation || 'collection'
    operation.value = next?.operations.includes(preferred) ? preferred : 'collection'
    view.value = next?.policy?.defaultView === 'bars' ? 'bars' : 'list'
    savePreference(); void refresh()
  }
  function selectOperation(value: ReadOperation) { operation.value = value; page.value = 1; savePreference(); void refresh() }
  function changePage(value: number) { page.value = value; void refresh() }
  function changeDepth(value: boolean) { descendants.value = value; page.value = 1; savePreference(); void refresh() }
  function changeView(value: 'list' | 'bars') { view.value = value; savePreference() }
  watch([() => context.value.ownerType, () => context.value.ownerId, () => scope.value.memberType, selection], () => {
    // 首次请求即使用该对象的范围偏好，避免先扫描全部后代，也不继承上一对象的选择。
    descendants.value = readPreference()?.descendants ?? true
    initialized = false; group.value = selection.value?.group; operation.value = 'collection'; page.value = 1; selected.value = undefined; void refresh()
  }, { immediate:true })
  onBeforeUnmount(() => { stopped = true; sequence++ })
  return { result, loading, error, group, operation, page, descendants, view, fallback, activeGroup, selected,
    refresh, selectGroup, selectOperation, changePage, changeDepth, changeView }
}
