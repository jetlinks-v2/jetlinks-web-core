import assert from 'node:assert/strict'
import { DefaultDataCapabilityRegistry } from '../../src/data-capability/internal/provider-registry'
import { createObjectCapabilityProvider } from '../../src/object-capability/provider'
import { objectMembers } from '../../src/object-capability/metadata'
import { currentObjectSelection } from '../../src/object-capability/dashboard'
import { objectDataAccess, objectDataAnalyses } from '../../src/object-capability/dataAccess'
import type { ObjectCapabilityValue, ObjectProviderModel } from '../../src/object-capability/types'
import type { DataCapabilityRequest, PersistedDataBinding } from '../../src/data-capability/types'
import { createRenderer, h, provide, shallowRef, nextTick } from 'vue'
import { dataCapabilityRequestKey } from '../../src/data-capability/request'
import { useObjectDataQuery } from '../../src/object-capability/useObjectDataQuery'
import type { ObjectContentEntry } from '../../src/components/ObjectOverview/ObjectContentGroup.vue'

const models: ObjectProviderModel[] = [{ providerId: 'ledger', identity: false, name: 'Source', metadata: {
  properties: [{ id: 'level', name: 'Level', valueType: { type: 'double', unit: 'metre' }, expands: {
    dataAccess: { history: 'past', aggregate: 'summary', pageSize: 10, operations: [{ id: 'tally', name: 'Samples', valueType: { type: 'long' } }] }
  } }], functions: [
    { id: 'past', expands: { functionKind: 'query' } }, { id: 'summary', expands: { functionKind: 'query' } },
    { id: 'scope', inputs: ['start', 'end', 'step', 'category'].map(id => ({ id, valueType: { type: 'long' } })),
      expands: { functionKind: 'query', dataAnalysis: { kind: 'aggregate', from: 'start', to: 'end', interval: 'step', pageSize: 20, objectTypes: ['category'] } } },
  ],
} }]
const members = objectMembers('reservoir', models), selected = currentObjectSelection(members[0])
assert.equal(objectDataAccess(members[0])?.history, 'past')
assert.equal(objectDataAnalyses(members)[0].ref.id, 'scope')
assert.equal(objectDataAccess({ ...members[0], metadata: { id: 'level', valueType: { type: 'double' } } }), undefined)
const calls: Array<{ url: string; body: unknown; config: any }> = []
let failTypes = false
const request = {
  async get(url: string, _params: unknown, options: any) {
    if (url === '/protocol/units') return { status: 200, result: [{ id: 'metre', symbol: 'm' }] }
    if (url === '/relation/types') {
      assert.equal(options.signal.aborted, false, 'new analyses use a fresh request signal')
      if (failTypes) throw Error('catalog unavailable')
      return { status: 200, result: [{ id: 'reservoir', name: 'Reservoir' }] }
    }
    return { status: 200, result: models }
  },
  async post(url: string, body: any, config: any) {
    calls.push({ url, body, config })
    if (url === '/relation/objects/_resolve') return { status: 200, result: { objects: [{ type: 'reservoir', id: 'R' }], limited: false } }
    return { status: 200, result: [{ timestamp: 10, value: 0 }, { timestamp: 11, value: false }] }
  }
} as DataCapabilityRequest
const registry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
registry.registerProvider(createObjectCapabilityProvider())
const runtime = registry.createRuntime({ runtimeId: 'data-query', request,
  attributes: { object: { type: 'reservoir', id: 'R' } }, parameters: { object: { type: 'reservoir', id: 'R' } } })
for (const mode of ['history', 'aggregate']) {
  const value = await runtime.query<ObjectCapabilityValue>({ ...selected.binding, query: { dataMode: mode,
    from: 1, to: 20, interval: 5, pageSize: 10, pageIndex: 0, aggregation: 'tally', property: 'other' } } as PersistedDataBinding)
  assert.deepEqual(value.data.values[0].value, [{ timestamp: 10, value: 0 }, { timestamp: 11, value: false }])
  const call = calls.at(-1)!
  assert.equal(call.url, `/relation/objects/reservoir/R/commands/${mode === 'history' ? 'past' : 'summary'}/_query`)
  assert.equal(call.config.params.providerId, 'ledger')
  assert.equal((call.body as any).query.property, 'level', 'query arguments cannot replace the bound data item')
}
const before = calls.length
await assert.rejects(runtime.query({ ...selected.binding, query: { dataMode: 'undeclared' } } as PersistedDataBinding))
assert.equal(calls.filter(call => call.url.includes('/commands/')).length, 2, 'unsupported modes cannot execute a command')
assert.ok(calls.length >= before)
await runtime.dispose()

const renderer = createRenderer<object, object>({ patchProp() {}, insert() {}, remove() {}, createElement: () => ({}),
  createText: () => ({}), createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null })
const flush = async () => { await nextTick(); await Promise.resolve(); await nextTick(); await Promise.resolve() }
const entry = shallowRef<ObjectContentEntry | undefined>({ selection: selected, member: members[0], state: { status: 'ready' } })
let state!: ReturnType<typeof useObjectDataQuery>, failNext = false, finish: ((value: unknown) => void) | undefined, delay = false
const pages: number[] = [], parameters: Record<string, unknown>[] = []
const reader = { async query(binding: PersistedDataBinding) {
  const query = binding.query as Record<string, any>; parameters.push(query)
  if (delay) return new Promise(resolve => { finish = resolve })
  pages.push(query.pageIndex)
  if (failNext) { failNext = false; throw new Error('unavailable') }
  return { data: { values: [{ object: { type: 'reservoir', id: 'R' }, value: [
    { timestamp: query.from + 1, value: 0 }, ...(query.pageIndex ? [] : [{ timestamp: query.from + 2, value: false }])
  ] }], limited: false } }
} } as unknown as import('../../src/data-capability/types').DataCapabilityRuntime
const small = structuredClone(members[0]); (small.metadata.expands!.dataAccess as any).pageSize = 2
entry.value = { ...entry.value!, member: small }
const app = renderer.createApp({ setup() {
  provide(dataCapabilityRequestKey, request)
  return () => h({ setup() { state = useObjectDataQuery(entry, () => reader); return () => null } })
} })
app.mount({}); await flush(); await flush()
assert.deepEqual(state.samples.value.map(sample => sample.value), [0, false])
assert.equal(state.charts.value[0].label, 'Level', 'the chart names the selected data item')
assert.equal(state.charts.value[0].unit, 'm', 'charts resolve declared unit IDs through the same platform dictionary as values')
failNext = true; state.more(); await flush(); await flush()
assert.equal(state.failed.value, true)
state.more(); await flush(); await flush()
assert.deepEqual(pages, [0, 1, 1]); assert.equal(state.samples.value.length, 3)
state.mode.value = 'aggregate'; state.changeOperation('tally')
await flush(); await flush()
assert.equal(parameters.at(-1)!.aggregation, 'tally', 'changing an operation queries before presenting its output unit')
assert.equal(state.valueType.value?.unit, undefined, 'aggregation output semantics replace the original physical unit')
delay = true; void state.query(); await flush()
entry.value = undefined; await flush()
finish!({ data: { values: [{ object: { type: 'reservoir', id: 'R' }, value: [] }], limited: false } }); await flush(); await flush()
assert.equal(state.result.value, undefined, 'a closed query cannot be overwritten by a late result')
delay = false; failTypes = true
entry.value = { member: members.find(member => member.ref.id === 'scope'), selection: currentObjectSelection(members.find(member => member.ref.id === 'scope')!), state: { status: 'ready' } }
await flush(); await flush()
assert.equal(state.failed.value, true)
failTypes = false; state.retry(); await flush(); await flush()
assert.deepEqual(state.objectTypes.value, [{ value: 'reservoir', label: 'Reservoir' }], 'type lookup can be retried independently of the data query')
assert.equal(state.failed.value, false)
state.input.value = { start: 0, end: 0, step: 0, dimension: 'section' }
await state.query()
assert.equal(parameters.at(-1)!.start, state.range.value.from)
assert.equal(parameters.at(-1)!.end, state.range.value.to)
assert.ok(Number(parameters.at(-1)!.step) > 0)
assert.equal(parameters.at(-1)!.dimension, 'section', 'native inputs remain owned by the source schema')
const statusMember = structuredClone(small)
statusMember.metadata.valueType = { type: 'enum', elements: [{ value: 0, text: 'Idle' }] }
entry.value = { selection: selected, member: statusMember, state: { status: 'ready' } }
await flush(); await flush()
assert.ok(state.samples.value.some(sample => sample.value === 0))
assert.equal(state.charts.value.length, 0, 'numeric enum codes retain state semantics instead of becoming a numeric trend')
app.unmount()
console.log('objectDataQueries: neutral source declarations, parameter binding, source routing, raw values and unsupported modes passed')
