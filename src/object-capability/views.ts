import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import type { DashboardValue } from '../components/DashBoardCanvas/types'
import type { ObjectReference } from './types'

export interface ObjectView {
  id: string
  objectType: string
  objectId: string
  name: string
  view: DashboardValue
}
/** Host persistence keeps user/deployment ownership out of a reusable presentation component. */
export interface ObjectViewStore {
  list(object: ObjectReference): Promise<ObjectView[]>
  get(id: string): Promise<ObjectView | undefined>
  defaultView(object: ObjectReference): Promise<string | undefined>
  create(object: ObjectReference, value: Pick<ObjectView, 'name' | 'view'>): Promise<ObjectView>
  save(id: string, value: Pick<ObjectView, 'name' | 'view'>): Promise<ObjectView>
  delete(id: string): Promise<void>
  setDefault(id: string): Promise<void>
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function useObjectViews(object: Readonly<Ref<ObjectReference | undefined>>, defaults: Readonly<Ref<DashboardValue>>,
  store: Readonly<Ref<ObjectViewStore | undefined>>, requested?: Readonly<Ref<string | undefined>>) {
  const views = shallowRef<ObjectView[]>([]), currentId = shallowRef<string>(), defaultId = shallowRef<string>()
  const editing = shallowRef(false), busy = shallowRef(false), loaded = shallowRef(false)
  const failure = shallowRef<'load' | 'save' | 'update'>()
  const failed = computed(() => failure.value !== undefined)
  const draft = shallowRef<DashboardValue>({ canvas: {}, components: [] }), name = shallowRef('')
  let generation = 0
  let activeKey: string | undefined
  const drafts = new Map<string, { view: DashboardValue; name: string; id?: string }>()
  const pendingDrafts = shallowRef(0)
  function discardAll() { drafts.clear(); pendingDrafts.value = 0; editing.value = false }
  const current = computed(() => views.value.find(view => view.id === currentId.value))
  const value = computed(() => editing.value ? draft.value : current.value?.view || defaults.value)
  const matches = (view: ObjectView) => view.objectType === object.value?.type && view.objectId === object.value?.id

  async function load() {
    const token = ++generation
    if (activeKey && editing.value) drafts.set(activeKey, { view: clone(draft.value), name: name.value, id: currentId.value })
    activeKey = object.value ? JSON.stringify([object.value.type, object.value.id]) : undefined
    pendingDrafts.value = [...drafts.keys()].filter(key => key !== activeKey).length
    views.value = []; currentId.value = undefined; defaultId.value = undefined; editing.value = false
    loaded.value = false; failure.value = undefined
    busy.value = false
    if (!object.value || !store.value) return
    busy.value = true
    try {
      const [items, selected] = await Promise.all([store.value.list(object.value), store.value.defaultView(object.value)])
      if (token !== generation) return
      views.value = items.filter(matches); defaultId.value = selected
      const id = requested?.value || selected
      if (id) {
        const view = items.find(item => item.id === id) || await store.value.get(id)
        if (token !== generation) return
        if (view && matches(view)) {
          if (!views.value.some(item => item.id === id)) views.value = [...views.value, view]
          currentId.value = id
        } else if (requested?.value) failure.value = 'load'
      }
      loaded.value = !failed.value
    } catch { if (token === generation) failure.value = 'load' }
    finally {
      if (token === generation) {
        const pending = activeKey && drafts.get(activeKey)
        if (pending) { draft.value = pending.view; name.value = pending.name; currentId.value = pending.id; editing.value = true }
        busy.value = false
      }
    }
  }
  function edit() { draft.value = clone(value.value); name.value = current.value?.name || ''; editing.value = true }
  function cancel() { editing.value = false; if (failure.value !== 'load') failure.value = undefined; if (activeKey) drafts.delete(activeKey) }
  function select(id?: string) { cancel(); currentId.value = id }
  function reset() { draft.value = clone(defaults.value) }
  async function save(asNew = false) {
    if (!store.value || !object.value || !loaded.value || busy.value || !name.value.trim()) return false
    const token = generation, target = { ...object.value }, id = currentId.value
    const body = { name: name.value.trim(), view: clone(draft.value) }
    busy.value = true; failure.value = undefined
    try {
      const saved = id && !asNew ? await store.value.save(id, body) : await store.value.create(target, body)
      if (token !== generation) return false
      views.value = [...views.value.filter(item => item.id !== saved.id), saved]
      currentId.value = saved.id; editing.value = false
      if (activeKey) drafts.delete(activeKey)
      return true
    } catch { if (token === generation) failure.value = 'save'; return false }
    finally { if (token === generation) busy.value = false }
  }
  async function remove() {
    const id = currentId.value, token = generation
    if (!id || !store.value || busy.value) return
    busy.value = true; failure.value = undefined
    try {
      await store.value.delete(id)
      if (token !== generation) return
      views.value = views.value.filter(view => view.id !== id); currentId.value = undefined
      if (defaultId.value === id) defaultId.value = undefined
    } catch { if (token === generation) failure.value = 'update' }
    finally { if (token === generation) busy.value = false }
  }
  async function setDefault() {
    const id = currentId.value, token = generation
    if (!id || !store.value || busy.value) return
    busy.value = true; failure.value = undefined
    try { await store.value.setDefault(id); if (token === generation) defaultId.value = id }
    catch { if (token === generation) failure.value = 'update' }
    finally { if (token === generation) busy.value = false }
  }
  watch(() => [object.value?.type, object.value?.id, store.value, requested?.value], load, { immediate: true })
  onBeforeUnmount(() => { generation++ })
  return { views, currentId, current, defaultId, editing, busy, loaded, failure, failed, draft, name, value, pendingDrafts, discardAll, edit, cancel, select, reset, save, remove, setDefault, reload: load }
}
