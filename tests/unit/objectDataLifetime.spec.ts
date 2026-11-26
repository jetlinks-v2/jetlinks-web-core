import assert from 'node:assert/strict'
import { computed, createRenderer, h, provide, shallowRef } from 'vue'
import { dataCapabilityRequestKey } from '../../src/data-capability/request'
import { useObjectCapabilities } from '../../src/object-capability/useObjectCapabilities'
import { useObjectRelatedData } from '../../src/object-capability/useObjectRelatedData'
import { useObjectCapabilityPicker } from '../../src/object-capability/useObjectCapabilityPicker'
import { currentObjectSelection, dashboardSelections } from '../../src/object-capability/dashboard'
import { objectCapabilityId, objectMembers } from '../../src/object-capability/metadata'
import type { DashboardValue } from '../../src/components/DashBoardCanvas/types'
import type { DataCapabilityRequest, DataCapabilityRuntime } from '../../src/data-capability/types'
import type { ObjectProviderModel } from '../../src/object-capability/types'
import type { VariableObjectSpec } from '../../src/types/relation'

const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
})
const flush = () => new Promise(resolve => setTimeout(resolve, 0))
const models: ObjectProviderModel[] = [{ providerId: 'identity', name: 'Identity', identity: true,
  metadata: { properties: [{ id: 'name', name: 'Name', valueType: { type: 'string' } }] } }]
const member = objectMembers('sample', models)[0]
const direct = currentObjectSelection(member)
const related = { ...direct, object: { objectType: 'sample', objectSource: { source: 'fixed' as const, value: ['B'] } },
  binding: { version: 1 as const, source: { capabilityId: objectCapabilityId(member.ref), version: 1, config: { object: 'B' } } } }
let propertyReads = 0, relatedReads = 0, modelReads = 0
const request = {
  async get() { modelReads++; return { status: 200, result: models } },
  async post() { propertyReads++; return { status: 200, result: [{ property: 'name', value: 'Sample' }] } },
} as unknown as DataCapabilityRequest
const object = shallowRef({ type: 'sample', id: 'A' })
const selected = shallowRef([objectCapabilityId(member.ref)])
const value = shallowRef<DashboardValue>({ canvas: {}, components: [{ id: 'data', type: 'object-data',
  componentProps: { selections: [related], gridItem: { x: 0, y: 0, w: 12, h: 6 } } }] })
const runtime = { async query() { relatedReads++; return { data: { values: [], limited: false } } } } as unknown as DataCapabilityRuntime
const child = { setup() {
  useObjectCapabilities(object, { request, selected })
  useObjectRelatedData(computed(() => dashboardSelections(value.value)), shallowRef(true), () => runtime)
  return () => null
} }
const app = renderer.createApp({ setup() { provide(dataCapabilityRequestKey, request); return () => h(child) } })
app.mount({}); await flush(); await flush()
assert.equal(propertyReads, 1); assert.equal(relatedReads, 1)
const initialModels = modelReads
selected.value = [...selected.value]
value.value = structuredClone(value.value)
value.value.components[0].componentProps.gridItem!.x = 4
await flush(); await flush()
assert.equal(propertyReads, 1, 'the same selected fields do not re-read on layout changes')
assert.equal(relatedReads, 1, 'moving a widget does not re-query relation bindings')
assert.equal(modelReads, initialModels, 'moving a widget does not reload models')
value.value = { ...value.value, components: [] }; await flush()
assert.equal(relatedReads, 1, 'removing a binding clears state without querying it')
app.unmount()

// A saved view can arrive while default values are still in flight. Its fields must load,
// and a late response from the old selection must not overwrite the newer observation.
const extendedModels: ObjectProviderModel[] = [{ ...models[0], metadata: { properties: [
  ...models[0].metadata.properties!, { id: 'status', valueType: { type: 'string' } },
] } }]
const statusMember = objectMembers('sample', extendedModels)[1]
const savedSelection = shallowRef([objectCapabilityId(member.ref)])
const reads: Array<(value: unknown) => void> = []
const delayedRequest = {
  async get() { return { status: 200, result: extendedModels } },
  post() { return new Promise(resolve => reads.push(resolve)) },
} as unknown as DataCapabilityRequest
let capability!: ReturnType<typeof useObjectCapabilities>
const delayedApp = renderer.createApp({ setup() {
  capability = useObjectCapabilities(object, { request: delayedRequest, selected: savedSelection })
  return () => null
} })
delayedApp.mount({}); await flush()
assert.equal(reads.length, 1)
savedSelection.value = [objectCapabilityId(member.ref), objectCapabilityId(statusMember.ref)]
await flush()
assert.equal(reads.length, 2, 'restoring a view while properties are loading reads its new selection')
reads[1]({ status: 200, result: [{ property: 'name', value: 'New' }, { property: 'status', value: 'Ready' }] })
await flush()
reads[0]({ status: 200, result: [{ property: 'name', value: 'Old' }] })
await flush()
assert.equal(capability.values.value[objectCapabilityId(member.ref)].value, 'New')
assert.equal(capability.values.value[objectCapabilityId(statusMember.ref)].value, 'Ready')
delayedApp.unmount()

const spec = shallowRef<VariableObjectSpec | undefined>({ objectType: 'sample', objectId: 'B' })
const modelPaths: string[] = []
const pickerRequest = { async get(url: string) { modelPaths.push(url); return { status: 200, result: models } } } as unknown as DataCapabilityRequest
const pickerApp = renderer.createApp({ setup() {
  provide(dataCapabilityRequestKey, pickerRequest)
  return () => h({ setup() { useObjectCapabilityPicker(spec, object); return () => null } })
} })
pickerApp.mount({}); await flush()
spec.value = currentObjectSelection(member).object
await flush()
assert.deepEqual(modelPaths, ['/relation/objects/sample/providers', '/relation/objects/sample/A/providers'],
  'switching from a type declaration to the current instance reloads its applicable model')
pickerApp.unmount()
console.log('objectDataLifetime: stable layout reads, restored-view races, stale responses and instance model switching passed')
