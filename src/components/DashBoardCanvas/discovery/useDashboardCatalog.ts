import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { DashboardCatalog } from '../types'
import { loadDashboardCatalog } from './catalog'
import type { DashboardDiscoveryError, DashboardDiscoveryScope, DashboardSources } from './types'

/** 在 setup 中消费显式来源；来源或范围变化立即撤销旧目录，丢弃过期加载结果。 */
export function useDashboardCatalog(
  sources: MaybeRefOrGetter<ReadonlyMap<string, DashboardSources>>,
  scope: MaybeRefOrGetter<DashboardDiscoveryScope>,
) {
  const catalog = shallowRef<DashboardCatalog>({ groups: [], components: {} })
  const errors = shallowRef<DashboardDiscoveryError[]>([])
  const loading = ref(false)
  const revision = ref(0)
  let request = 0
  watch(() => {
    const selection = toValue(scope)
    const available = toValue(sources)
    // 只订阅选中模块的来源，避免无关模块变化重建当前画布组件。
    return [selection, new Map(selection.modules.map(id => [id, available.get(id)])), revision.value] as const
  }, async ([selection, selectedSources]) => {
    const current = ++request
    // 同步清空以撤销已排除组件；调用方的画布配置不在 discovery 内修改。
    catalog.value = { groups: [], components: {} }
    errors.value = []
    loading.value = true
    // 复制条件，防止等待入口时数组被原地修改。
    const result = await loadDashboardCatalog(selectedSources, {
      modules: [...selection.modules], directories: selection.directories?.slice(), groups: selection.groups?.slice(),
      entries: selection.entries?.slice(), includeTypes: selection.includeTypes?.slice(), excludeTypes: selection.excludeTypes?.slice(),
    })
    if (current !== request) return
    catalog.value = result.catalog
    errors.value = result.errors
    loading.value = false
  }, { deep: true, immediate: true, flush: 'sync' })
  onScopeDispose(() => { request += 1 })
  return {
    catalog: computed(() => catalog.value), loading: computed(() => loading.value),
    errors: computed(() => errors.value), reload: () => { revision.value += 1 },
  }
}
