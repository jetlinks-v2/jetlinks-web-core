import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import { dataCapabilityRegistry } from '../data-capability/registry'
import { useDataCapabilityRequest } from '../data-capability/request'
import type { DataCapabilityRequest, DataCapabilityRuntime } from '../data-capability/types'
import { objectCapabilitiesApi } from './api'
import { objectCapabilityId, objectMembers } from './metadata'
import { referencePropertyKeys, referenceValue, resolveReferenceNames } from './references'
import type { ObjectCapabilityValue, ObjectMember, ObjectReference, ObjectReferenceValue } from './types'

export interface ObjectMemberState { status: 'loading' | 'ready' | 'failed'; value?: unknown; references?: ObjectReferenceValue }

/** Instance-local model/data lifetime. A slow old request cannot update the next object. */
export function useObjectCapabilities(object: Readonly<Ref<ObjectReference | undefined>>, options: {
  request?: DataCapabilityRequest
  selected?: Readonly<Ref<readonly string[] | undefined>>
} = {}) {
  const request = options.request ?? useDataCapabilityRequest()
  const members = shallowRef<ObjectMember[]>([])
  const values = shallowRef<Record<string, ObjectMemberState>>({})
  const loading = shallowRef(false), failed = shallowRef(false)
  let generation = 0, readRevision = 0, controller = new AbortController(), runtime: DataCapabilityRuntime | undefined
  const visible = computed(() => options.selected?.value === undefined
    ? members.value.filter(member => member.ref.kind === 'property').slice(0, 6)
    : members.value.filter(member => options.selected!.value!.includes(objectCapabilityId(member.ref))))

  function context() { return { request, attributes: { object: object.value }, parameters: { object: object.value } } }
  async function read(selected: ObjectMember[] = visible.value) {
    if (!object.value) return
    const current = generation, revision = ++readRevision, api = objectCapabilitiesApi(context()), target = { ...object.value }
    const signal = controller.signal, session = runtime
    const stale = () => current !== generation || revision !== readRevision
    const next = { ...values.value }
    const groups = new Map<string, ObjectMember[]>()
    for (const member of selected) {
      if (member.ref.kind === 'action') continue
      next[objectCapabilityId(member.ref)] = { status: 'loading' }
      if (member.ref.kind === 'property') groups.set(member.ref.providerId, [...(groups.get(member.ref.providerId) || []), member])
    }
    values.value = next
    const references: Array<{ key: string; value: ObjectReferenceValue }> = []
    await Promise.all([...groups].map(async ([provider, entries]) => {
      try {
        const data = []
        const keys = [...new Set(entries.flatMap(referencePropertyKeys))]
        for (let offset = 0; offset < keys.length; offset += 128) {
          if (stale()) return
          data.push(...await api.properties(target, provider, keys.slice(offset, offset + 128), signal))
        }
        if (stale()) return
        const result = { ...values.value }
        const properties = new Map(data.map(row => [row.property, row.value]))
        for (const member of entries) {
          const key = objectCapabilityId(member.ref), value = properties.get(member.ref.id)
          const reference = referenceValue(member, value, properties)
          result[key] = { status: reference ? 'loading' : 'ready', value }
          if (reference) references.push({ key, value: reference })
        }
        values.value = result
      } catch {
        if (!stale()) values.value = { ...values.value, ...Object.fromEntries(entries.map(member => [objectCapabilityId(member.ref), { status: 'failed' }])) }
      }
    }))
    if (stale()) return
    const resolved = await resolveReferenceNames(references.map(item => item.value), (type, ids) => api.objects(type, ids, signal))
    if (stale()) return
    values.value = { ...values.value, ...Object.fromEntries(references.map((item, index) => [item.key,
      { ...values.value[item.key], status: 'ready', references: resolved[index] }])) }
    for (const member of selected.filter(value => value.ref.kind === 'query')) {
      if (stale()) return
      const key = objectCapabilityId(member.ref)
      try {
        const data = await session!.query<ObjectCapabilityValue>({ version: 1, source: { capabilityId: key, version: 1 } }, { signal })
        if (!stale()) values.value = { ...values.value, [key]: { status: 'ready', value: data.data.values[0]?.value } }
      } catch {
        if (!stale()) values.value = { ...values.value, [key]: { status: 'failed' } }
      }
    }
  }
  async function load() {
    const current = ++generation
    controller.abort(); controller = new AbortController()
    void runtime?.dispose(); runtime = undefined
    members.value = []; values.value = {}; failed.value = false
    if (!object.value) { loading.value = false; return }
    loading.value = true
    runtime = dataCapabilityRegistry.createRuntime({ ...context(), runtimeId: `object:${current}:${crypto.randomUUID()}` })
    try {
      const data = await objectCapabilitiesApi(context()).models(object.value.type, object.value.id, controller.signal)
      if (current !== generation) return
      members.value = objectMembers(object.value.type, data)
    } catch { if (current === generation) failed.value = true }
    finally { if (current === generation) loading.value = false }
  }
  watch(() => [object.value?.type, object.value?.id], load, { immediate: true })
  // Model readiness and the visible set drive one read path, including views restored during a slow read.
  watch(() => loading.value ? undefined : JSON.stringify(visible.value.map(member => objectCapabilityId(member.ref)).sort()),
    () => { if (!loading.value && !failed.value) void read() })
  onBeforeUnmount(() => { generation++; controller.abort(); void runtime?.dispose() })
  return { members, visible, values, loading, failed, refresh: load, read, getRuntime: () => runtime }
}
