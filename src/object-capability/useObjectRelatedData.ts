import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import type { DataCapabilityRuntime, PersistedDataBinding } from '../data-capability/types'
import { useDataCapabilityRequest } from '../data-capability/request'
import { objectCapabilitiesApi } from './api'
import { objectMembers, sameObjectMember } from './metadata'
import { isCurrentSelection, selectionKey } from './dashboard'
import { useObjectAutoRefresh, type ObjectAutoRefreshOptions } from './useObjectAutoRefresh'
import type { ObjectMemberState } from './useObjectCapabilities'
import type { ObjectCapabilityValue, ObjectMember, ObjectMemberSelection } from './types'

/** One bounded read per distinct relation binding, shared by every visible widget in this page. */
export function useObjectRelatedData(selections: Readonly<Ref<ObjectMemberSelection[]>>, ready: Readonly<Ref<boolean>>,
  runtime: () => DataCapabilityRuntime | undefined, options: ObjectAutoRefreshOptions = {}) {
  const request = useDataCapabilityRequest()
  const states = shallowRef<Record<string, ObjectMemberState>>({}), members = shallowRef<ObjectMember[]>([])
  let generation = 0, controller = new AbortController()
  let reading = false, backgroundRead = false
  const selected = computed(() => [...new Map(selections.value.filter(item => !isCurrentSelection(item))
    .map(item => [selectionKey(item), item])).values()])
  async function read(background = false) {
    const token = ++generation
    controller.abort(); controller = new AbortController(); reading = false
    const signal = controller.signal
    if (!background) { states.value = {}; members.value = [] }
    if (!ready.value) return
    reading = true; backgroundRead = background
    const api = objectCapabilitiesApi({ request })
    const types = [...new Set(selected.value.map(item => item.member.type))]
    if (!background) await Promise.all(types.map(async type => {
      try {
        const models = await api.models(type, undefined, signal)
        if (token === generation) members.value = [...members.value, ...objectMembers(type, models)]
      } catch { /* Each retained selection below gets an explicit unavailable state. */ }
    }))
    for (const item of selected.value) {
      if (token !== generation) return
      const key = selectionKey(item)
      if (!members.value.some(member => sameObjectMember(member.ref, item.member))) {
        states.value = { ...states.value, [key]: { status: 'failed' } }; continue
      }
      if (item.member.kind === 'action') continue
      if (!background || !states.value[key]) states.value = { ...states.value, [key]: { status: 'loading' } }
      try {
        const result = await runtime()!.query<ObjectCapabilityValue>(item.binding as PersistedDataBinding, { signal })
        if (token === generation) states.value = { ...states.value, [key]: { status: 'ready', value: result.data } }
      } catch { if (token === generation) states.value = { ...states.value, [key]: background && states.value[key]?.status === 'ready'
        ? { ...states.value[key], refreshError: true } : { status: 'failed' } } }
    }
    if (token === generation) reading = false
  }
  watch(() => JSON.stringify([ready.value, selected.value.map(selectionKey).sort()]),
    () => { void read() }, { immediate: true })
  useObjectAutoRefresh(options, computed(() => ready.value && selected.value.length > 0),
    () => { if (!reading) void read(true) },
    () => { if (backgroundRead) { generation++; controller.abort(); reading = false } })
  onBeforeUnmount(() => { generation++; controller.abort() })
  return { states, members, refresh: () => read() }
}
