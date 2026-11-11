import assert from 'node:assert/strict'
import { createRenderer, ref } from 'vue'
import { useObjectViews, type ObjectView, type ObjectViewStore } from '../../src/object-capability/views'
import type { ObjectReference } from '../../src/object-capability/types'
import type { DashboardValue } from '../../src/components/DashBoardCanvas/types'

const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
})
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const object = ref<ObjectReference>({ type: 'sample', id: 'A' })
const defaults = ref<DashboardValue>({ canvas: {}, components: [] })
const values = new Map<string, ObjectView>()
let serial = 0, writes = 0, failSave = false, failLoad = false, failUpdate = false
let pendingA: ((value: ObjectView[]) => void) | undefined
const store = ref<ObjectViewStore>({
  list: target => failLoad ? Promise.reject(new Error('404')) : target.id === 'A' ? new Promise(resolve => { pendingA = resolve }) : Promise.resolve([...values.values()].filter(view => view.objectId === target.id)),
  get: async id => values.get(id), defaultView: async () => undefined,
  async create(target, body) { writes++; const value = { ...body, id: String(++serial), objectType: target.type, objectId: target.id }; values.set(value.id, value); return value },
  async save(id, body) { if (failSave) throw new Error('offline'); writes++; const value = { ...values.get(id)!, ...body }; values.set(id, value); return value },
  async delete(id) { if (failUpdate) throw new Error('offline'); values.delete(id) }, async setDefault() { if (failUpdate) throw new Error('offline') },
})
let state!: ReturnType<typeof useObjectViews>
const app = renderer.createApp({ setup() { state = useObjectViews(object, defaults, store); return () => null } })
app.mount({})
await flush()
object.value = { type: 'sample', id: 'B' }; await flush()
pendingA!([{ id: 'old', objectType: 'sample', objectId: 'A', name: 'Stale', view: defaults.value }]); await flush()
assert.equal(state.views.value.length, 0, 'slow old object results cannot populate the next object')
state.edit(); state.name.value = 'First'; state.cancel()
assert.equal(writes, 0, 'cancel does not write')
state.edit(); state.name.value = 'First'; await state.save()
const first = state.currentId.value!
state.edit(); state.name.value = 'Copy'; await state.save(true)
const second = state.currentId.value!
assert.notEqual(first, second)
assert.equal(values.get(first)?.name, 'First', 'save as preserves the original view')
state.edit(); state.name.value = 'Unsaved'; failSave = true
assert.equal(await state.save(), false)
assert.equal(state.editing.value, true)
assert.equal(state.name.value, 'Unsaved')
assert.equal(state.failed.value, true)
assert.equal(state.failure.value, 'save', 'save failures retain their own cause')
object.value = { type: 'sample', id: 'C' }; await flush()
object.value = { type: 'sample', id: 'B' }; await flush()
assert.equal(state.editing.value, true, 'switching objects retains this page session draft')
assert.equal(state.name.value, 'Unsaved')
failSave = false; state.cancel(); await state.reload()
assert.equal(state.editing.value, false)
assert.equal(state.failure.value, undefined)
failLoad = true
await state.reload()
assert.equal(state.loaded.value, false)
assert.equal(state.failure.value, 'load')
assert.equal(state.editing.value, false)
assert.deepEqual(state.value.value, defaults.value, 'unavailable personal views do not discard the default overview')
state.edit(); state.name.value = 'Recovered draft'
const priorWrites = writes
assert.equal(await state.save(), false, 'unloaded personal views cannot be overwritten by a fallback')
assert.equal(writes, priorWrites)
assert.equal(state.editing.value, true, 'failed persistence keeps the local draft')
state.cancel()
failLoad = false
await state.reload()
assert.equal(state.loaded.value, true)
assert.equal(state.failed.value, false)
state.select(second)
failUpdate = true
await state.setDefault()
assert.equal(state.failure.value, 'update', 'changing preferences is not reported as a failed data read or save')
assert.equal(state.loaded.value, true)
assert.equal(state.currentId.value, second)
failUpdate = false
await state.setDefault()
assert.equal(state.failed.value, false)
app.unmount()
console.log('objectViews: stale results, drafts, save-as, isolated failures and persistence retry passed')
