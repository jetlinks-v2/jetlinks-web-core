import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { relationApi } from '../../api/relations'
import { objectCapabilitiesApi } from '../../object-capability/api'
import { useDataCapabilityRequest } from '../../data-capability/request'
import type { RelationObjectType } from '../../types/relation'
import type { ProcessObject } from './types'

/** 沿用统一对象目录与来源授权；分页搜索不拉取完整设备或空间清单。 */
export function useProcessObjects(initial: Readonly<Ref<ProcessObject | undefined>>, select: (object?: ProcessObject) => void) {
  const types = shallowRef<RelationObjectType[]>([]), type = ref(initial.value?.type || ''), keyword = ref(''), page = ref(0)
  const objects = shallowRef<ProcessObject[]>([]), loading = ref(false), error = ref(''), selected = shallowRef<ProcessObject>()
  const request = useDataCapabilityRequest()
  let generation = 0, disposed = false
  async function load() {
    const token = ++generation; loading.value = true; error.value = ''
    try {
      if (!types.value.length) types.value = await relationApi.types()
      if (disposed || token !== generation) return
      if (!type.value) type.value = initial.value?.type || types.value[0]?.id || ''
      if (!type.value) { objects.value = []; return }
      const currentType = type.value
      const rows = await relationApi.objects(currentType, keyword.value, page.value)
      if (token !== generation || disposed) return
      objects.value = rows.map(row => ({ type: currentType, id: row.id, name: row.name }))
      const value = initial.value
      if (value?.type === currentType && selected.value?.id !== value.id) {
        const [confirmed] = await objectCapabilitiesApi({ request }).objects(currentType, [value.id])
        if (token === generation && !disposed) { selected.value = confirmed ? { type: currentType, id: confirmed.id, name: confirmed.name } : undefined; select(selected.value) }
      }
    } catch (cause) { if (token === generation && !disposed) { error.value = cause instanceof Error ? cause.message : String(cause); objects.value = []; selected.value = undefined; select(undefined) } }
    finally { if (token === generation && !disposed) loading.value = false }
  }
  watch(type, () => { page.value = 0; keyword.value = ''; selected.value = undefined; select(undefined); void load() })
  watch(page, () => { void load() })
  watchDebounced(keyword, () => { if (page.value) page.value = 0; else void load() }, { debounce: 250 })
  watch(initial, value => { if (value?.type && type.value !== value.type) type.value = value.type; else if (!types.value.length || value?.id !== selected.value?.id) void load() }, { immediate: true })
  function choose(object: ProcessObject) { selected.value = object; select(object) }
  onBeforeUnmount(() => { disposed = true; generation++ })
  return { types, type, keyword, page, objects, selected, loading, error, load, choose }
}
