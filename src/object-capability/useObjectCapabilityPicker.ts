import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import { useDataCapabilityRequest } from '../data-capability/request'
import type { VariableObjectSpec } from '../types/relation'
import { objectCapabilitiesApi } from './api'
import { objectCapabilityId, objectMembers } from './metadata'
import type { ObjectMember, ObjectMemberSelection, ObjectReference } from './types'

/** RelationSelector owns path editing; this hook discovers only the selected endpoint's declared members. */
export function useObjectCapabilityPicker(spec: Readonly<Ref<VariableObjectSpec | undefined>>, contextObject?: Readonly<Ref<ObjectReference | undefined>>) {
  const request = useDataCapabilityRequest()
  const members = shallowRef<ObjectMember[]>([]), loading = shallowRef(false), failed = shallowRef(false)
  let generation = 0, controller = new AbortController()
  const targetType = computed(() => {
    let type = spec.value?.objectType, step = spec.value?.related
    while (step) { type = step.objectType; step = step.next }
    return type
  })
  const instanceId = computed(() => {
    const current = contextObject?.value
    return current && current.type === targetType.value && !spec.value?.related
      && spec.value?.objectSource?.source === 'upper' && spec.value.objectSource.upperKey === 'object' ? current.id : undefined
  })
  async function load() {
    const token = ++generation
    controller.abort(); controller = new AbortController(); members.value = []; failed.value = false
    if (!targetType.value) { loading.value = false; return }
    loading.value = true
    try {
      const data = await objectCapabilitiesApi({ request }).models(targetType.value, instanceId.value, controller.signal)
      if (token === generation) members.value = objectMembers(targetType.value, data)
    } catch { if (token === generation) failed.value = true }
    finally { if (token === generation) loading.value = false }
  }
  function selection(member: ObjectMember): ObjectMemberSelection {
    const ref = { capabilityId: objectCapabilityId(member.ref), version: 1, config: { object: spec.value } }
    return { object: spec.value, member: member.ref, binding: member.ref.kind === 'action'
      ? { version: 1, operation: ref } : { version: 1, source: ref } }
  }
  watch(() => [targetType.value, instanceId.value], load, { immediate: true })
  onBeforeUnmount(() => { generation++; controller.abort() })
  return { members, loading, failed, load, selection }
}
