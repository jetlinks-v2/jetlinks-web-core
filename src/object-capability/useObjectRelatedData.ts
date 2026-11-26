import { onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import type { DataCapabilityRuntime, PersistedDataBinding } from '../data-capability/types'
import { useDataCapabilityRequest } from '../data-capability/request'
import { objectCapabilitiesApi } from './api'
import { objectMembers, sameObjectMember } from './metadata'
import { isCurrentSelection, selectionKey } from './dashboard'
import type { ObjectMemberState } from './useObjectCapabilities'
import type { ObjectCapabilityValue, ObjectMember, ObjectMemberSelection } from './types'

/** One bounded read per distinct relation binding, shared by every visible widget in this page. */
export function useObjectRelatedData(selections: Readonly<Ref<ObjectMemberSelection[]>>, ready: Readonly<Ref<boolean>>,
  runtime: () => DataCapabilityRuntime | undefined) {
  const request = useDataCapabilityRequest()
  const states = shallowRef<Record<string, ObjectMemberState>>({}), members = shallowRef<ObjectMember[]>([])
  let generation = 0, controller = new AbortController()
  async function read() {
    const token = ++generation
    controller.abort(); controller = new AbortController(); states.value = {}; members.value = []
    if (!ready.value) return
    const selected = [...new Map(selections.value.filter(item => !isCurrentSelection(item)).map(item => [selectionKey(item), item])).values()]
    const api = objectCapabilitiesApi({ request })
    const types = [...new Set(selected.map(item => item.member.type))]
    await Promise.all(types.map(async type => {
      try {
        const models = await api.models(type, undefined, controller.signal)
        if (token === generation) members.value = [...members.value, ...objectMembers(type, models)]
      } catch { /* Each retained selection below gets an explicit unavailable state. */ }
    }))
    for (const item of selected) {
      if (token !== generation) return
      const key = selectionKey(item)
      if (!members.value.some(member => sameObjectMember(member.ref, item.member))) {
        states.value = { ...states.value, [key]: { status: 'failed' } }; continue
      }
      if (item.member.kind === 'action') continue
      states.value = { ...states.value, [key]: { status: 'loading' } }
      try {
        const result = await runtime()!.query<ObjectCapabilityValue>(item.binding as PersistedDataBinding, { signal: controller.signal })
        if (token === generation) states.value = { ...states.value, [key]: { status: 'ready', value: result.data } }
      } catch { if (token === generation) states.value = { ...states.value, [key]: { status: 'failed' } } }
    }
  }
  watch(() => JSON.stringify([ready.value, selections.value.filter(item => !isCurrentSelection(item)).map(selectionKey).sort()]),
    read, { immediate: true })
  onBeforeUnmount(() => { generation++; controller.abort() })
  return { states, members, refresh: read }
}
