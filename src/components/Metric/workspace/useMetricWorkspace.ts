import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useMetricResources } from '../extensions/useMetricResources'
import type { MetricContext, MetricObjectSelection, MetricWorkspaceSelection } from '../types'

type Memory = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const memoryKey = (scope: string) => `metric-workspace:${scope}`

/** Scope memory contains only IDs. A navigator must confirm every object in its current authorized query. */
export function useMetricWorkspace(scopeKey: Ref<string>, initial: Ref<MetricWorkspaceSelection | undefined>, editable: Ref<boolean>, changed: (selection: MetricWorkspaceSelection | undefined) => void, memory?: Memory) {
  const resources = useMetricResources()
  const confirmed = shallowRef<MetricObjectSelection>()
  const unavailable = ref(false)
  function readMemory(): { ownerType?: string; ownerIds: Record<string, string> } {
    try {
      const value = JSON.parse(memory?.getItem(memoryKey(scopeKey.value)) || 'null')
      const ownerIds = value?.ownerIds
      return {
        ownerType: typeof value?.ownerType === 'string' ? value.ownerType : undefined,
        ownerIds: ownerIds && typeof ownerIds === 'object' && !Array.isArray(ownerIds)
          ? Object.fromEntries(Object.entries(ownerIds).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {}
      }
    } catch { return { ownerIds: {} } }
  }
  function remembered(ownerType = readMemory().ownerType): MetricWorkspaceSelection | undefined {
    return ownerType ? { ownerType, ownerId: readMemory().ownerIds[ownerType] || '' } : undefined
  }
  const selection = shallowRef<MetricWorkspaceSelection | undefined>(initial.value || remembered())
  const dimension = computed(() => resources.value.dimensions.find(item => item.provider.ownerType === selection.value?.ownerType))
  const context = computed<MetricContext | undefined>(() => {
    const object = confirmed.value
    const provider = dimension.value?.provider
    if (!object || !provider || selection.value?.ownerId !== object.ownerId) return
    let canEdit = false
    try { canEdit = editable.value && (provider.canEdit?.(object) ?? true) } catch { canEdit = false }
    return { ...object, ownerType: provider.ownerType, preferenceScope:scopeKey.value, editable: canEdit, ...(provider.inheritance ? { inheritance: provider.inheritance() } : {}) }
  })
  /** 只记各维度ID；失效一个维度不能删除同一身份下其他维度的选择。 */
  function persist(value?: MetricWorkspaceSelection, invalidType?: string) {
    const stored = readMemory()
    if (invalidType) delete stored.ownerIds[invalidType]
    if (value) {
      if (value.ownerId) stored.ownerIds[value.ownerType] = value.ownerId
      else delete stored.ownerIds[value.ownerType]
    }
    stored.ownerType = value?.ownerType
    try { memory?.setItem(memoryKey(scopeKey.value), JSON.stringify(stored)) } catch { /* Storage can be unavailable without blocking authorized navigation. */ }
  }
  function chooseDimension(ownerType: string) {
    if (!resources.value.dimensions.some(item => item.provider.ownerType === ownerType)) return
    confirmed.value = undefined
    unavailable.value = false
    selection.value = remembered(ownerType)
    persist(selection.value)
    changed(selection.value)
  }
  function confirmObject(object?: MetricObjectSelection) {
    const provider = dimension.value?.provider
    if (!provider) return
    confirmed.value = undefined
    unavailable.value = false
    if (!object?.ownerId || typeof object.label !== 'string') {
      selection.value = { ownerType: provider.ownerType, ownerId: '' }
    } else {
      selection.value = { ownerType: provider.ownerType, ownerId: object.ownerId }
      confirmed.value = { ...object }
    }
    persist(selection.value)
    changed(selection.value)
  }
  watch(initial, value => {
    if (value?.ownerType === selection.value?.ownerType && value?.ownerId === selection.value?.ownerId) return
    confirmed.value = undefined; unavailable.value = false; selection.value = value && { ...value }
  }, { flush: 'sync' })
  watch(scopeKey, () => { confirmed.value = undefined; unavailable.value = false; selection.value = remembered(); changed(selection.value) }, { flush: 'sync' })
  watch(() => JSON.stringify(selection.value), () => { confirmed.value = undefined }, { flush: 'sync' })
  watch(() => [selection.value?.ownerType, dimension.value?.provider] as const, ([type, next], previousValue) => {
    const [previousType, previous] = previousValue || []
    if (type && (!next || type === previousType && previous && next !== previous)) {
      confirmed.value = undefined
      unavailable.value = true
      selection.value = undefined
      persist(undefined, type)
      changed(undefined)
    }
  }, { flush: 'sync', immediate: true })
  return { resources, selection, dimension, confirmed, context, unavailable: computed(() => unavailable.value || !!selection.value && !dimension.value), chooseDimension, confirmObject }
}
