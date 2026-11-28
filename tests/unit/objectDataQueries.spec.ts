import assert from 'node:assert/strict'
import { DefaultDataCapabilityRegistry } from '../../src/data-capability/internal/provider-registry'
import { createObjectCapabilityProvider } from '../../src/object-capability/provider'
import { objectMembers } from '../../src/object-capability/metadata'
import { currentObjectSelection } from '../../src/object-capability/dashboard'
import { objectDataAccess, objectDataAnalyses } from '../../src/object-capability/dataAccess'
import { objectAggregationQuery } from '../../src/object-capability/aggregation'
import type { ObjectCapabilityValue, ObjectProviderModel } from '../../src/object-capability/types'
import type { DataCapabilityRequest, PersistedDataBinding } from '../../src/data-capability/types'
import { createRenderer, defineComponent, h, KeepAlive, provide, shallowRef, nextTick } from 'vue'
import { dataCapabilityRequestKey } from '../../src/data-capability/request'
import { useObjectDataQuery } from '../../src/object-capability/useObjectDataQuery'
import type { ObjectContentEntry } from '../../src/components/ObjectOverview/ObjectContentGroup.vue'

const models: ObjectProviderModel[] = [{ providerId: 'ledger', identity: false, name: 'Source', metadata: {
  properties: [{ id: 'level', name: 'Level', valueType: { type: 'double', unit: 'metre' }, expands: {
    dataAccess: { history: 'past', aggregate: 'summary', pageSize: 10, groupByTime: { column: 'observedAt', timeZone: 'UTC' },
      operations: [{ id: 'COUNT', name: 'Samples', valueType: { type: 'long' } }] }
  } }], functions: [
    { id: 'past', expands: { functionKind: 'query' } }, { id: 'summary', expands: { functionKind: 'query' } },
    { id: 'scope', inputs: ['start', 'end', 'step', 'category'].map(id => ({ id, valueType: { type: 'long' } })),
      expands: { functionKind: 'query', dataAnalysis: { kind: 'aggregate', from: 'start', to: 'end', interval: 'step', pageSize: 20, objectTypes: ['category'] } } },
  ],
} }]
const members = objectMembers('reservoir', models), selected = currentObjectSelection(members[0])
const access = objectDataAccess(members[0])!
const aggregationQuery = objectAggregationQuery(access, 'other', { from: 1, to: 20 }, 'COUNT', 1)
assert.equal(aggregationQuery.groupByTime?.from, '1970-01-01 00:00:00.001')
assert.equal(aggregationQuery.groupByTime?.to, '1970-01-01 00:00:00.020')
assert.equal(aggregationQuery.groupByTime?.interval, '1s')
assert.equal(aggregationQuery.limit, 10)
const east = objectAggregationQuery({ ...access, groupByTime: { column: 'observedAt', timeZone: 'Asia/Tokyo' } },
  'level', { from: 1, to: 20 }, 'COUNT', 1)
assert.equal(east.groupByTime?.from, '1970-01-01 09:00:00.001', 'source zone is independent of browser time zone')
assert.throws(() => objectAggregationQuery(access, 'level', { from: 1, to: 20 }, 'SUM', 1))
const missingOutput = structuredClone(members[0])
delete (missingOutput.metadata.expands!.dataAccess as any).operations[0].valueType
assert.equal(objectDataAccess(missingOutput)?.aggregate, undefined, 'an undeclared result type cannot inherit the original physical unit')
assert.equal(objectDataAccess(missingOutput)?.history, 'past', 'a malformed aggregate does not remove valid history')
const invalidHistory = structuredClone(members[0])
;(invalidHistory.metadata.expands!.dataAccess as any).history = 7
assert.equal(objectDataAccess(invalidHistory)?.history, undefined, 'invalid declaration fields cannot become command IDs')
assert.equal(objectDataAccess(members[0])?.history, 'past')
assert.equal(objectDataAnalyses(members)[0].ref.id, 'scope')
assert.equal(objectDataAccess({ ...members[0], metadata: { id: 'level', valueType: { type: 'double' } } }), undefined)
const calls: Array<{ url: string; body: unknown; config: any }> = []
let failTypes = false, delayTypes = false
let finishTypes: ((value: { status: number; result: Array<{ id: string; name: string }> }) => void) | undefined
let typeSignal: AbortSignal | undefined
const request = {
  async get(url: string, _params: unknown, options: any) {
    if (url === '/protocol/units') return { status: 200, result: [{ id: 'metre', symbol: 'm' }] }
    if (url === '/relation/types') {
      assert.equal(options.signal.aborted, false, 'new analyses use a fresh request signal')
      typeSignal = options.signal
      if (delayTypes) return new Promise(resolve => { finishTypes = resolve })
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
    from: 1, to: 20, pageSize: 10, pageIndex: 0, aggregationQuery, property: 'other' } } as PersistedDataBinding)
  assert.deepEqual(value.data.values[0].value, [{ timestamp: 10, value: 0 }, { timestamp: 11, value: false }])
  const call = calls.at(-1)!
  assert.equal(call.url, `/relation/objects/reservoir/R/commands/${mode === 'history' ? 'past' : 'summary'}/_query`)
  assert.equal(call.config.params.providerId, 'ledger')
  if (mode === 'history') assert.equal((call.body as any).query.property, 'level', 'query arguments cannot replace the bound data item')
  else {
    assert.equal((call.body as any).query.columns[0].column, 'level', 'aggregate columns keep the bound data item')
    assert.equal((call.body as any).query.columns[0].aggregation, 'COUNT')
    assert.equal((call.body as any).query.groupByTime.column, 'observedAt')
    assert.equal((call.body as any).query.aggregation, undefined, 'no parallel aggregation parameter')
    assert.deepEqual((value.data.values[0].metadata as any).valueType, { type: 'long' },
      'every aggregate consumer receives the declared result semantics without the original physical unit')
  }
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
let scopeLimited = false, noSamples = false
const pages: number[] = [], parameters: Record<string, unknown>[] = []
const reader = { async query(binding: PersistedDataBinding) {
  const query = binding.query as Record<string, any>; parameters.push(query)
  if (delay) return new Promise(resolve => { finish = resolve })
  if (query.dataMode === 'history') pages.push(query.pageIndex)
  if (failNext) { failNext = false; throw new Error('unavailable') }
  const from = query.from ?? query.start ?? Date.parse(query.aggregationQuery.groupByTime.from.replace(' ', 'T') + 'Z')
  return { data: { values: [{ object: { type: 'reservoir', id: 'R' }, value: noSamples ? [] : [
    { timestamp: from + 1, value: 0 }, ...(query.pageIndex ? [] : [{ timestamp: from + 2, value: false }])
  ] }], limited: scopeLimited } }
} } as unknown as import('../../src/data-capability/types').DataCapabilityRuntime
let currentRuntime = reader
const small = structuredClone(members[0]); (small.metadata.expands!.dataAccess as any).pageSize = 2
entry.value = { ...entry.value!, member: small }
const app = renderer.createApp({ setup() {
  provide(dataCapabilityRequestKey, request)
  return () => h({ setup() { state = useObjectDataQuery(entry, () => currentRuntime); return () => null } })
} })
app.mount({}); await flush(); await flush()
assert.deepEqual(state.samples.value.map(sample => sample.value), [0, false])
assert.equal(state.charts.value[0].label, 'Level', 'the chart names the selected data item')
assert.equal(state.charts.value[0].unit, 'm', 'charts resolve declared unit IDs through the same platform dictionary as values')
failNext = true; state.more(); await flush(); await flush()
assert.equal(state.failed.value, true)
assert.equal(state.samples.value.length, 2, 'a failed continuation retains the already read rows')
state.retry(); await flush(); await flush()
assert.deepEqual(pages, [0, 1, 1]); assert.equal(state.samples.value.length, 3)
assert.equal(state.hasMore.value, false, 'continuation depends on the newest page, not the accumulated row count')
state.mode.value = 'aggregate'; state.changeOperation('COUNT')
await flush(); await flush()
assert.equal((parameters.at(-1)!.aggregationQuery as any).columns[0].aggregation, 'COUNT', 'changing an operation queries before presenting its output unit')
assert.equal(state.valueType.value?.unit, undefined, 'aggregation output semantics replace the original physical unit')
delay = true; void state.query(); await flush()
entry.value = undefined; await flush()
finish!({ data: { values: [{ object: { type: 'reservoir', id: 'R' }, value: [] }], limited: false } }); await flush(); await flush()
assert.equal(state.result.value, undefined, 'a closed query cannot be overwritten by a late result')
delay = false; failTypes = true
entry.value = { member: members.find(member => member.ref.id === 'scope'), selection: currentObjectSelection(members.find(member => member.ref.id === 'scope')!), state: { status: 'ready' } }
await flush(); await flush()
assert.equal(state.typesFailed.value, true)
assert.equal(state.failed.value, false, 'option lookup failure belongs to its own request')
failTypes = false; void state.retryTypes(); await flush(); await flush()
assert.deepEqual(state.objectTypes.value, [{ value: 'reservoir', label: 'Reservoir' }], 'type lookup can be retried independently of the data query')
assert.equal(state.failed.value, false)
assert.deepEqual(state.fields.value.map(field => field.id), ['category'], 'parameter roles are resolved by the query hook')
const previousCount = parameters.length, previousInterval = state.intervalSeconds.value
state.changeRange({ from: state.range.value.from - 86_400_000, to: state.range.value.to })
assert.equal(parameters.length, previousCount, 'native query form changes apply only on submit')
assert.ok(state.intervalSeconds.value > previousInterval, 'the shared range control respects the source bucket budget')
state.input.value = { start: 0, end: 0, step: 0, dimension: 'section' }
await state.query()
assert.equal(parameters.at(-1)!.start, state.range.value.from)
assert.equal(parameters.at(-1)!.end, state.range.value.to)
assert.ok(Number(parameters.at(-1)!.step) > 0)
assert.equal(parameters.at(-1)!.dimension, 'section', 'native inputs remain owned by the source schema')
const readResult = state.result.value, readCount = parameters.length
entry.value = { ...entry.value!, state: { status: 'ready', value: 'display update' } }
await flush(); await flush()
assert.equal(state.result.value, readResult, 'presentation-state changes preserve the current query result')
assert.equal(state.input.value.dimension, 'section', 'presentation-state changes do not erase form input')
assert.equal(parameters.length, readCount)
currentRuntime = { ...reader }
entry.value = { ...entry.value! }; await flush(); await flush()
assert.equal(state.result.value, undefined, 'a new subject runtime cannot inherit the previous query result')
assert.deepEqual(state.input.value, {}, 'runtime context changes reset native parameters even when the member identity is unchanged')
delayTypes = true
entry.value = { ...entry.value!, member: { ...entry.value!.member!, metadata: structuredClone(entry.value!.member!.metadata) } }
await flush(); await flush()
assert.equal(state.typesBusy.value, true)
assert.equal(state.busy.value, false, 'catalog loading does not become a data query')
state.input.value = { category: 'reservoir' }
await state.query()
assert.equal(typeSignal!.aborted, false, 'submitting data does not cancel the parameter catalog')
finishTypes!({ status: 200, result: [{ id: 'reservoir', name: 'Reservoir' }] })
await flush(); await flush()
assert.deepEqual(state.objectTypes.value, [{ value: 'reservoir', label: 'Reservoir' }])
assert.ok(state.result.value, 'a completed option lookup preserves the data result')
entry.value = { ...entry.value!, member: { ...entry.value!.member!, metadata: structuredClone(entry.value!.member!.metadata) } }
await flush(); await flush()
const lateTypes = finishTypes!
entry.value = undefined; await flush()
assert.equal(typeSignal!.aborted, true, 'closing invalidates the independent catalog request')
lateTypes({ status: 200, result: [{ id: 'old', name: 'Old' }] })
await flush(); await flush()
assert.deepEqual(state.objectTypes.value, [], 'a late catalog cannot populate a closed form')
delayTypes = false
const statusMember = structuredClone(small)
statusMember.metadata.valueType = { type: 'enum', elements: [{ value: 0, text: 'Idle' }] }
entry.value = { selection: selected, member: statusMember, state: { status: 'ready' } }
await flush(); await flush()
assert.ok(state.samples.value.some(sample => sample.value === 0))
assert.equal(state.charts.value.length, 0, 'numeric enum codes retain state semantics instead of becoming a numeric trend')
scopeLimited = true; noSamples = true
await state.query()
assert.equal(state.result.value?.limited, true, 'the source still exposes an incomplete object scope')
assert.equal(state.hasMore.value, false, 'an incomplete object scope cannot invent another history page')
app.unmount()

const active = shallowRef(true), pendingReads: Array<{ signal: AbortSignal; finish: () => void }> = []
const retainedEntry = shallowRef<ObjectContentEntry>({ selection: selected, member: small, state: { status: 'ready' } })
let retained!: ReturnType<typeof useObjectDataQuery>
const retainedReader = { query(binding: PersistedDataBinding, options: { signal: AbortSignal }) {
  return new Promise(resolve => pendingReads.push({ signal: options.signal, finish: () => resolve({ data: {
    values: [{ object: { type: 'reservoir', id: 'R' }, value: [{ timestamp: Number(binding.query!.from ?? binding.query!.start) + 1, value: 0 }] }], limited: false,
  } }) }))
} } as unknown as import('../../src/data-capability/types').DataCapabilityRuntime
const ReadPanel = defineComponent({ setup() {
  retained = useObjectDataQuery(retainedEntry, () => retainedReader)
  return () => h('div')
} })
const BlankPanel = defineComponent({ setup: () => () => h('div') })
const retainedApp = renderer.createApp({ setup() {
  provide(dataCapabilityRequestKey, request)
  return () => h(KeepAlive, null, () => h(active.value ? ReadPanel : BlankPanel))
} })
retainedApp.mount({}); await flush(); await flush()
assert.equal(pendingReads.length, 1)
active.value = false; await flush()
assert.equal(pendingReads[0].signal.aborted, true, 'deactivation cancels pending reads through the common lifetime')
active.value = true; await flush(); await flush()
assert.equal(pendingReads.length, 2, 'returning resumes a cancelled initial read')
pendingReads[0].finish(); await flush(); await flush()
assert.equal(retained.result.value, undefined, 'a cancelled initial response cannot win after returning')
pendingReads[1].finish(); await flush(); await flush()
assert.equal(retained.samples.value[0].value, 0)
active.value = false; await flush(); active.value = true; await flush(); await flush()
assert.equal(pendingReads.length, 2, 'returning preserves completed reading without an extra query')
assert.equal(retained.samples.value[0].value, 0)
const scopeMember = members.find(member => member.ref.id === 'scope')!
retainedEntry.value = { selection: currentObjectSelection(scopeMember), member: scopeMember, state: { status: 'ready' } }
await flush(); await flush()
assert.equal(pendingReads.length, 2, 'native forms never query before explicit submit')
void retained.query(); await flush()
active.value = false; await flush()
assert.equal(pendingReads[2].signal.aborted, true)
active.value = true; await flush(); await flush()
assert.equal(pendingReads.length, 4, 'returning resumes a submitted native query but does not create a new form submission')
pendingReads[2].finish(); pendingReads[3].finish(); await flush(); await flush()
assert.ok(retained.result.value)
retainedApp.unmount()
console.log('objectDataQueries: neutral source declarations, parameter binding, source routing, raw values and unsupported modes passed')
