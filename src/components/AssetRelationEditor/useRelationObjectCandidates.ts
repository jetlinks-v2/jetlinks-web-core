import { computed, onScopeDispose, ref, watch } from 'vue'
import { relationObjectsApi } from '../../api/relation-objects'
import { moduleRegistry } from '../../utils/module-registry'
import type { ObjectRelationContext } from '../../types/object-relation'
import type { RelationObjectData } from '../../types/relation'
import { relatedQuery } from './source'

/** 统一对象目录与直接关系查询；仅读取已访问页，草稿不改变来源事实。 */
export function useRelationObjectCandidates(
  input: () => { context: ObjectRelationContext; selectedOnly?: boolean; reviewValues?: string[]; focusValue?: string },
  report: (rows: RelationObjectData[]) => void
) {
  const rows = ref<RelationObjectData[]>([]),
    keyword = ref(''),
    loading = ref(false),
    error = ref(''),
    hasMore = ref(false)
  const revision = ref(0)
  const cache = new Map<string, RelationObjectData>()
  let generation = 0,
    page = -1
  const visible = computed(() => {
    const pending = input().selectedOnly
      ? (input().reviewValues || []).flatMap((id) => {
          const row = cache.get(id)
          return row && (!keyword.value || (row.name || row.id).includes(keyword.value)) ? [row] : []
        })
      : []
    return [...new Map([...pending, ...rows.value].map((row) => [row.id, row])).values()]
  })
  async function load(reset = false) {
    if (!reset && (loading.value || !hasMore.value)) return
    const current = reset ? ++generation : generation
    const next = reset ? 0 : page + 1
    const { context, selectedOnly, focusValue } = input()
    loading.value = true
    error.value = ''
    if (reset) {
      rows.value = []
      revision.value++
    }
    const query = {
      pageIndex: next,
      pageSize: 50,
      sorts: [{ name: 'id', order: 'asc' }],
      terms: keyword.value ? [{ column: 'name', termType: 'like', value: `%${keyword.value}%` }] : []
    }
    try {
      const result = selectedOnly
        ? await relationObjectsApi.related(relatedQuery(context, query))
        : await relationObjectsApi.objects(context.relation.targetType, query)
      if (current !== generation) return
      let data = result.data
      if (reset && focusValue && !keyword.value && !data.some((row) => row.id === focusValue)) {
        const focused = await relationObjectsApi.objects(context.relation.targetType, {
          pageIndex: 0,
          pageSize: 1,
          terms: [{ column: 'id', termType: 'eq', value: focusValue }]
        })
        if (current !== generation) return
        data = [...focused.data, ...data]
      }
      data.forEach((row) => cache.set(row.id, row))
      rows.value = [...new Map([...(reset ? [] : rows.value), ...data].map((row) => [row.id, row])).values()]
      page = next
      hasMore.value = (next + 1) * 50 < result.total
      report(data)
    } catch (cause) {
      if (current === generation) error.value = cause instanceof Error ? cause.message : String(cause)
    } finally {
      if (current === generation) loading.value = false
    }
  }
  function search(value: string) {
    keyword.value = value.trim().slice(0, 100)
    return load(true)
  }
  function subtitle(row: RelationObjectData) {
    const declarations = [...moduleRegistry.getAllModules().values()].flatMap((module) =>
      Object.values(module.objectPresentations || {}).filter(
        (value) => value.typeId === input().context.relation.targetType
      )
    )
    return declarations.length === 1 ? declarations[0].directorySubtitle?.(row) : undefined
  }
  watch(
    () => input().context,
    () => {
      cache.clear()
      keyword.value = ''
      void load(true)
    },
    { immediate: true }
  )
  watch(
    () => input().selectedOnly,
    () => {
      void load(true)
    }
  )
  onScopeDispose(() => {
    generation++
  })
  return { rows: visible, keyword, loading, error, hasMore, revision, load, search, subtitle }
}
