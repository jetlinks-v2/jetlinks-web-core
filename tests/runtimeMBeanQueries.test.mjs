import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle, compileTemplate } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics'), cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }, code = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', code)(id => id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const { availableMBeanQueries, mbeanQueryInvocation } = load(resolve(root, 'mbean/queries.ts'))
const { useMBeanQueryContext } = load(resolve(root, 'mbean/context.ts'))
const { supportsMBeanSummary } = load(resolve(root, 'registry.ts'))
const { mbeanSemanticMetrics, formatSemanticValue, mbeanBufferCapacity, mbeanErrorRecord, brokerTimingBuckets, brokerSlowCalls, brokerListenerRows } = load(resolve(root, 'mbean/semantic.ts'))
const { nearestVisibilityDelta, revealMBeanSelection } = load(resolve(root, 'mbean/selectionVisibility.ts'))
const operation = (name, signature) => ({ name, signature, returnType: 'java.util.List', parameters: signature.map((type, index) => ({ name: `arg${index}`, type })) })
const bean = (type = 'DeviceSessionManager', name = 'PersistenceDeviceSessionManager', values = {}, operations = [operation('getSession', ['java.lang.String'])]) => ({
  objectName: `org.jetlinks:name=${name},type=${type}`, domain: 'org.jetlinks', type, name, operations,
  attributes: Object.entries(values).map(([name, value]) => ({ name, value, available: true, readable: true, type: 'long' })),
})
const deferred = () => { let resolve; return { promise: new Promise(yes => resolve = yes), resolve: value => resolve(value) } }
const ready = result => ({ state: { status: 'ready' }, result })
function harness() {
  const state = vue.reactive({ bean: bean(), target: 'node-a', active: true, access: { allowed: true }, busy: false })
  const calls = [], execute = vue.shallowRef(async invocation => { calls.push(invocation); return ready('first') })
  const scope = vue.effectScope()
  const view = scope.run(() => useMBeanQueryContext(Object.fromEntries(['bean', 'target', 'active', 'access', 'busy'].map(key => [key, vue.computed(() => state[key])]).concat([['execute', vue.computed(() => execute.value)]]))))
  return { state, execute, calls, ...view, stop: () => scope.stop() }
}

test('readonly query allowlist uses exact implementation identity, signature and canonical metadata', () => {
  const value = bean()
  assert.deepEqual(availableMBeanQueries(value), ['deviceSession'])
  assert.equal(mbeanQueryInvocation(value, 'deviceSession', ['device-1']).operation, value.operations[0])
  assert.deepEqual(mbeanQueryInvocation(value, 'deviceSession', ['device-1']).args, [{ name: 'arg0', value: 'device-1' }])
  for (const mismatch of [{ domain: 'other' }, { type: 'Other' }, { name: 'CustomSessionManager' }, { operations: [operation('getSession', ['long'])] }, { operations: [{ ...operation('getSession', ['java.lang.String']), parameters: [] }] }]) {
    assert.deepEqual(availableMBeanQueries({ ...value, ...mismatch }), [])
  }
  for (const values of [[], [''], [' '], ['device', 'extra']]) assert.equal(mbeanQueryInvocation(value, 'deviceSession', values), undefined)
  assert.equal(mbeanQueryInvocation(value, 'brokerAll', []), undefined)
  const event = bean('EventBus', 'ClusterEventBus', {}, [operation('structuredSubscriptionSummary', ['int'])])
  for (const limit of ['0', '-1', '201', '1.5', 'false', '']) assert.equal(mbeanQueryInvocation(event, 'structuredSubscriptions', [limit]), undefined)
  assert.deepEqual(mbeanQueryInvocation(event, 'structuredSubscriptions', ['200']).args, [{ name: 'arg0', value: '200' }])
})

test('operation-only SpringMessageBroker has a summary while unrelated implementations stay generic', () => {
  const value = bean('SpringMessageBroker', 'SpringMessageBroker', {}, [operation('loadAll', []), operation('load', ['java.lang.String']), operation('reset', [])])
  assert.equal(value.attributes.length, 0); assert.equal(supportsMBeanSummary(value), true)
  assert.deepEqual(availableMBeanQueries(value), ['brokerAll', 'brokerByName'])
  assert.equal(supportsMBeanSummary({ ...value, name: 'OtherBroker' }), false)
  assert.equal(mbeanQueryInvocation(value, 'brokerAll', []).operation.name, 'loadAll')
})

test('query context does not execute on mount; absent callbacks, denied access and invalid input fail closed', async () => {
  const h = harness()
  try {
    assert.equal(h.calls.length, 0)
    await h.context.query('deviceSession', ['']); assert.equal(h.calls.length, 0)
    h.state.access = { allowed: false }; await h.context.query('deviceSession', ['device']); assert.equal(h.calls.length, 0)
    h.state.access = { allowed: true }; h.execute.value = undefined
    assert.equal(h.context.access.value.allowed, false)
    await h.context.query('deviceSession', ['device']); assert.equal(h.context.snapshot.value, undefined)
  } finally { h.stop() }
})

test('same-query refresh retains completed reading; rejected receipt restores it and never stays loading', async () => {
  const h = harness(), next = deferred()
  try {
    h.execute.value = async invocation => { h.calls.push(invocation); return h.calls.length === 1 ? ready('settled') : next.promise }
    await h.context.query('deviceSession', ['one'])
    const pending = h.context.query('deviceSession', ['two'])
    assert.equal(h.context.snapshot.value.result, 'settled'); assert.equal(h.context.snapshot.value.state.status, 'loading')
    await h.context.query('deviceSession', ['duplicate']); assert.equal(h.calls.length, 2)
    next.resolve(undefined); await pending
    assert.equal(h.context.snapshot.value.result, 'settled'); assert.equal(h.context.snapshot.value.state.status, 'ready'); assert.equal(h.context.busy.value, false)
  } finally { h.stop() }
})

test('tool deactivation preserves settled content but discards pending replies', async () => {
  const h = harness(), next = deferred()
  try {
    h.execute.value = async invocation => { h.calls.push(invocation); return h.calls.length === 1 ? ready('settled') : next.promise }
    await h.context.query('deviceSession', ['one'])
    h.state.active = false; assert.equal(h.context.snapshot.value.result, 'settled')
    h.state.active = true
    const pending = h.context.query('deviceSession', ['two'])
    h.state.active = false; assert.equal(h.context.snapshot.value.result, 'settled')
    h.state.active = true; next.resolve(ready('late')); await pending
    assert.equal(h.context.snapshot.value.result, 'settled'); assert.equal(h.context.busy.value, false)
  } finally { h.stop() }
})

test('A-B-A target changes, object changes, permission revocation and disposal invalidate prior results', async () => {
  for (const mutate of [h => { h.state.target = 'node-b'; h.state.target = 'node-a' }, h => { h.state.bean = bean('DeviceSessionManager', 'Other') }, h => { h.state.access = { allowed: false }; h.state.access = { allowed: true } }, h => h.stop()]) {
    const h = harness(), next = deferred()
    h.execute.value = () => next.promise
    const pending = h.context.query('deviceSession', ['one']); mutate(h)
    next.resolve(ready('stale')); await pending
    assert.equal(h.context.snapshot.value, undefined); h.stop()
  }
})

test('ordinary failures are visible and retryable; generic method results have a separate source', async () => {
  const h = harness()
  try {
    let count = 0
    h.execute.value = async () => ++count === 1 ? { state: { status: 'error', message: 'read failed' } } : ready('recovered')
    await h.context.query('deviceSession', ['one'])
    assert.equal(h.context.snapshot.value.state.message, 'read failed'); assert.equal(h.context.busy.value, false)
    await h.context.query('deviceSession', ['one']); assert.equal(h.context.snapshot.value.result, 'recovered')
    h.beginGenericInvocation(); assert.equal(h.resultSource.value, 'generic'); assert.equal(h.context.snapshot.value.result, 'recovered')
    h.execute.value = async () => { throw new Error('unexpected transport failure') }
    await h.context.query('deviceSession', ['one']); assert.equal(h.resultSource.value, 'summary')
    assert.equal(h.context.snapshot.value.state.status, 'error'); assert.equal(h.context.busy.value, false)
  } finally { h.stop() }
})

test('semantic metrics retain actual scopes, unavailable values, exact counter text and safe ratios', () => {
  const value = bean('DeviceSessionManager', 'PersistenceDeviceSessionManager', { Sessions: 7, KeepOnlineSize: 3, History: 2, DataBytes: '2.3MB' })
  assert.deepEqual(mbeanSemanticMetrics(value).map(metric => metric.key), ['Sessions', 'KeepOnlineSize', 'History', 'DataBytes'])
  assert.deepEqual(mbeanSemanticMetrics({ ...value, domain: 'foreign' }), [])
  for (const unknown of [null, undefined, '', ' ', false, true, -1, '-1', Infinity, NaN]) assert.equal(formatSemanticValue(unknown, 'count'), '—')
  assert.equal(formatSemanticValue('9223372036854775807', 'count'), '9223372036854775807')
  assert.equal(formatSemanticValue(0, 'count'), '0'); assert.equal(formatSemanticValue(0, 'ratio'), '0.0%')
  assert.equal(formatSemanticValue(1.2, 'ratio'), '—'); assert.equal(formatSemanticValue(0, 'timestamp'), '—')
  assert.equal(formatSemanticValue(1048576, 'bytes'), '1.0 MiB')
  assert.equal(mbeanBufferCapacity(bean('EventBus', 'ClusterEventBus', { StructuredBufferedEventCount: 2, StructuredBufferedEventLimit: 8 })).percent, 25)
  assert.equal(mbeanBufferCapacity(bean('EventBus', 'ClusterEventBus', { StructuredBufferedEventCount: false, StructuredBufferedEventLimit: 8 })).percent, undefined)
  assert.equal(mbeanErrorRecord(' nil '), ''); assert.equal(mbeanErrorRecord(''), ''); assert.equal(mbeanErrorRecord(null), ''); assert.equal(mbeanErrorRecord(undefined), undefined)
  assert.equal(mbeanErrorRecord('Error\n at x'), 'Error\n at x')
})

test('broker histogram preserves the unbounded final bucket and rejects incomplete or unknown formats', () => {
  const result = brokerTimingBuckets('<=5ms(1),5-20ms(2),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(7)')
  assert.equal(result[6].label, '>1000 ms'); assert.equal(result[6].percent, 70)
  assert.equal(brokerTimingBuckets('<=5ms(1)'), undefined)
  assert.equal(brokerTimingBuckets(null), undefined)
  const zeros = brokerTimingBuckets('<=5ms(0),5-20ms(0),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(0)')
  assert.ok(zeros.every(bucket => bucket.percent === 0))
})

test('listeners with observed slow calls appear first without inventing values for unknown buckets', () => {
  const summary = (fast, slow) => `<=5ms(${fast}),5-20ms(0),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(${slow})`
  const rows = [{ name: 'unknown', total: 1000 }, { name: 'fast', total: 200, summary: summary(200, 0) }, { name: 'slower', total: 10, summary: summary(1, 9) }, { name: 'slow', total: 100, summary: summary(50, 50) }]
  assert.deepEqual(brokerListenerRows(rows).map(row => row.name), ['slower', 'slow', 'fast', 'unknown'])
  assert.equal(rows[0].name, 'unknown', 'source order is not mutated')
  assert.deepEqual(brokerListenerRows(rows, 'slow').map(row => row.name), ['slower', 'slow'])
  assert.equal(brokerListenerRows([{ unknown: 'response' }]), undefined)
})

test('zero observed listener calls have no slow-call ratio while their bucket counts remain real zeroes', () => {
  const empty = '<=5ms(0),5-20ms(0),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(0)'
  assert.equal(brokerSlowCalls(empty), undefined)
  assert.deepEqual(brokerTimingBuckets(empty).map(bucket => bucket.count), [0, 0, 0, 0, 0, 0, 0])
  const sampled = '<=5ms(3),5-20ms(0),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(1)'
  assert.deepEqual(brokerSlowCalls(sampled), { count: 1, percent: 25 })
  assert.deepEqual(brokerListenerRows([{ name: 'empty', summary: empty, total: 0 }, { name: 'sampled', summary: sampled, total: 4 }]).map(row => row.name), ['sampled', 'empty'])
})

test('the real broker template omits empty distributions and labels while preserving zero totals and unknown-format fallback', async () => {
  const filename = resolve(root, 'mbean/SpringBrokerSummary.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const compiled = compileScript(descriptor, { id: 'broker-zero-template', inlineTemplate: true })
  const code = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }).code, module = { exports: {} }
  let result
  const context = { availableQueries: vue.computed(() => ['brokerAll']), access: vue.computed(() => ({ allowed: true })), busy: vue.computed(() => false), query() {} }
  const passthrough = vue.defineComponent({ inheritAttrs: false, setup: (_props, { slots }) => () => vue.h('div', slots.default?.()) })
  const queryResult = vue.defineComponent({ setup: (_props, { slots }) => () => slots.default?.({ result }) })
  const rawCode = vue.defineComponent({ props: ['content'], setup: props => () => vue.h('pre', { class: 'raw-code' }, props.content) })
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === 'ant-design-vue') return { Empty: { PRESENTED_IMAGE_SIMPLE: '' } }
    if (id === '@ant-design/icons-vue') return { InfoCircleOutlined: passthrough }
    if (id === './context') return { useMBeanRendererContext: () => context }
    if (id === './MBeanQueryResult.vue') return { __esModule: true, default: queryResult }
    if (id.endsWith('CodeBlock/index.vue')) return { __esModule: true, default: rawCode }
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }, module, module.exports)
  async function render(summary, total) {
    result = [{ name: 'listener', enabled: true, topic: ['/topic'], total, summary }]
    const app = vue.createSSRApp(module.exports.default, { bean: bean('SpringMessageBroker', 'SpringMessageBroker') })
    for (const name of ['a-button', 'a-input', 'a-tooltip', 'a-tag', 'a-empty']) app.component(name, passthrough)
    return renderToString(app)
  }
  const zero = await render('<=5ms(0),5-20ms(0),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(0)', 0)
  assert.match(zero, /runtimeDiagnostics\.mbeanSummary\.terminalCalls 0/)
  assert.match(zero, /\/topic/)
  assert.ok(!zero.includes('broker-distribution')); assert.ok(!zero.includes('broker-buckets')); assert.ok(!zero.includes('raw-code'))
  const sampled = await render('<=5ms(3),5-20ms(0),20-100ms(0),100-300ms(0),300-500ms(0),500-1000ms(0),1000-5000ms(1)', 4)
  assert.match(sampled, /broker-distribution/); assert.match(sampled, /broker-buckets/); assert.match(sampled, /25\.0%/)
  const unknown = await render('unrecognized timing data', 3)
  assert.match(unknown, /raw-code/); assert.match(unknown, /unrecognized timing data/)
})

test('restored selection scrolls only outside the viewport and only by the nearest delta', () => {
  assert.equal(nearestVisibilityDelta({ start: 10, end: 100 }, { start: 20, end: 50 }), 0)
  assert.equal(nearestVisibilityDelta({ start: 10, end: 100 }, { start: 110, end: 130 }), 30)
  assert.equal(nearestVisibilityDelta({ start: 10, end: 100 }, { start: 0, end: 20 }), -10)
  assert.equal(nearestVisibilityDelta({ start: 10, end: 100 }, { start: 0, end: 130 }), 0)
  let bounds = { top: 20, bottom: 40, left: 20, right: 80 }
  const title = { dataset: { mbeanObject: 'selected' }, getBoundingClientRect: () => bounds }
  const container = { clientWidth: 100, clientHeight: 100, scrollTop: 50, scrollLeft: 20, querySelectorAll: () => [title], getBoundingClientRect: () => ({ top: 0, bottom: 100, left: 0, right: 100 }) }
  assert.equal(revealMBeanSelection(container, 'selected'), false); assert.equal(container.scrollTop, 50)
  bounds = { top: 120, bottom: 150, left: 20, right: 80 }
  assert.equal(revealMBeanSelection(container, 'selected'), true); assert.equal(container.scrollTop, 100); assert.equal(container.scrollLeft, 20)
})

test('specialized summaries and Browser compile without adding transport dependencies', () => {
  for (const name of ['MBeanBrowser.vue', 'MBeanSummary.vue', 'mbean/MBeanSemanticMetrics.vue', 'mbean/MBeanQueryResult.vue', 'mbean/DeviceSessionSummary.vue', 'mbean/EventBusSummary.vue', 'mbean/SpringBrokerSummary.vue']) {
    const filename = resolve(root, name), source = readFileSync(filename, 'utf8'), { descriptor, errors } = parse(source, { filename })
    assert.deepEqual(errors, [], name); assert.ok(compileScript(descriptor, { id: name }).content)
    assert.deepEqual(compileTemplate({ id: name, filename, source: descriptor.template.content }).errors, [], name)
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: name, filename, source: style.content, scoped: style.scoped }).errors, [], name)
    assert.ok(source.split('\n').length < 300, name)
  }
  const publicIndex = readFileSync(resolve(root, '../index.ts'), 'utf8')
  assert.match(publicIndex, /export \{ useMBeanRendererContext \} from '\.\/RuntimeDiagnostics'/)
  assert.match(publicIndex, /export type \{[^}]*MBeanRendererContext[^}]*MBeanInvocationOutcome[^}]*MBeanQuerySnapshot[^}]*\} from '\.\/RuntimeDiagnostics'/)
})
test('DeviceMessageMonitor uses the existing semantic catalog with sixteen scalar metrics and a composite snapshot attribute and exact counts',()=>{
 const value=bean('DeviceMessageMonitor','DeviceMessageMonitor',{StartTime:1000,SnapshotTime:4000,ReceivedBytesTotal:'9223372036854775807',SentBytesTotal:'0',UpstreamMessagesTotal:'9223372036854775807',PropertyReportsTotal:'4',PropertyValuesTotal:'12',EventReportsTotal:'2',ReceivedPacketsTotal:'9007199254740993',SentPacketsTotal:'0',ReceivedQps:17,SentQps:5,CommunicationQps:22,QpsSampleTime:3900,QpsWindowMillis:1000,QpsReady:true,QpsSnapshot:{ReceivedQps:17,SentQps:5,CommunicationQps:22,QpsSampleTime:3900,QpsWindowMillis:1000,QpsReady:true}},[])
 assert.equal(supportsMBeanSummary(value),true)
 const metrics=mbeanSemanticMetrics(value);assert.equal(metrics.length,16)
 assert.equal(metrics.find(metric=>metric.key==='SnapshotTime').format,'timestamp')
 assert.equal(metrics.find(metric=>metric.key==='ReceivedBytesTotal').format,'bytes')
 assert.equal(metrics.find(metric=>metric.key==='CommunicationQps').format,'rate');assert.equal(formatSemanticValue(22,'rate'),'22 /s')
 assert.equal(formatSemanticValue(metrics.find(metric=>metric.key==='UpstreamMessagesTotal').value,'count'),'9223372036854775807')
 assert.deepEqual(mbeanSemanticMetrics({...value,domain:'other'}),[])
 assert.deepEqual(availableMBeanQueries(value),[])
})
