import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileTemplate, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics')
function load(path) {
  const module = { exports: {} }, imports = id => id.startsWith('.') ? load(resolve(dirname(path), `${id}.ts`)) : require(id)
  new Function('require', 'module', 'exports', transformSync(readFileSync(path, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(imports, module, module.exports)
  return module.exports
}
const model = load(resolve(root, 'device-sessions/observation.ts'))
const row = (bytes = '100', extra = {}) => [{ deviceId: 'device', serverId: 'node', connectTime: 1000, lastCommTime: 9000, pendingMessages: 3, connections: [{ id: 'connection', address: '/127.0.0.1:1234', metrics: { connectTime: 1000, lastCommTime: 8000, readBytes: bytes, writeBytes: '200', totalMessages: '5' } }], ...extra }]

test('communication comes from connection time; session heartbeat is a separate fallback', () => {
  assert.deepEqual(model.deviceObservationActivity(row()), { lastCommAt: 8000, lastHeartbeatAt: 9000 })
  assert.deepEqual(model.deviceObservationActivity(row('0', { connections: [] })), { lastCommAt: undefined, lastHeartbeatAt: 9000 })
  assert.deepEqual(model.deviceObservationActivity([]), { lastCommAt: undefined, lastHeartbeatAt: undefined })
})
test('rates subtract exact per-connection counters before aggregation and preserve actual pending gauges', () => {
  const first = model.deviceObservationSample(row('9223372036854775700'), 10000)
  const next = model.deviceObservationSample(row('9223372036854775800'), 15000)
  assert.equal(model.deviceObservationPoints([first, next])[1].receive, 20)
  assert.equal(model.deviceObservationPoints([first, next])[1].send, 0)
  assert.equal(model.deviceObservationPoints([first, next])[1].pending, 3)
  assert.equal(model.deviceObservationPoints([first])[0].receive, undefined)
})
test('missing counters, rollback, reconnect and ambiguous duplicate connections create gaps instead of false totals', () => {
  const first = model.deviceObservationSample(row('100'), 10000)
  const rollback = model.deviceObservationSample(row('50'), 15000)
  assert.equal(model.deviceObservationPoints([first, rollback])[1].receive, undefined)
  const reconnect = row('200'); reconnect[0].connections[0].metrics.connectTime = 11000
  assert.equal(model.deviceObservationPoints([first, model.deviceObservationSample(reconnect, 15000)])[1].receive, undefined)
  const partial = row('200'); partial[0].connections.push({ id: 'unknown', metrics: { connectTime: 1000 } })
  assert.equal(model.deviceObservationPoints([first, model.deviceObservationSample(partial, 15000)])[1].receive, undefined)
  const repeated = [...row(), ...row('100', { serverId: 'replica' })]
  assert.equal(model.deviceObservationSample(repeated, 15000).connections, undefined)
  assert.equal(model.deviceObservationSample(row('100', { pendingMessages: undefined }), 15000).pending, undefined)
  assert.equal(model.deviceObservationSample([], 15000).pending, undefined, 'no session result does not claim an offline zero')
})
test('pauses and errors interrupt rate baselines and histories are bounded to ten minutes', () => {
  const first = model.deviceObservationSample(row('100'), 10000), next = model.deviceObservationSample(row('200'), 20000)
  assert.equal(model.deviceObservationPoints([first, { sampledAt: 15000, interrupted: true }, next])[2].receive, undefined)
  const beforePause = [first, next]
  assert.equal(model.deviceObservationCurrentPoint([...beforePause, { sampledAt: 25000, interrupted: true }]).receive, 10)
  assert.equal(model.deviceObservationCurrentPoint([...beforePause, { sampledAt: 25000, interrupted: true }, model.deviceObservationSample(row('250'), 30000)]).receive, undefined, 'new resumed sample cannot present an old rate as current')
  let history = []
  for (let i = 0; i < 1000; i++) history = model.appendDeviceObservation(history, { sampledAt: 10000 + i * 1000, pending: i })
  assert.equal(history.length, 121)
  history = model.appendDeviceObservation(history, { sampledAt: 2000000, pending: 1 })
  assert.equal(history.length, 1)
})

function chart(entries, metric = 'receive') {
  const path = resolve(root, 'device-sessions/DeviceObservationChart.vue'), source = readFileSync(path, 'utf8')
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/const props = defineProps<[^>]+>\(\)/, 'const props = __props')
  script += '\nmodule.exports = { option, hasPoint, chartEvents }'
  const module = { exports: {} }, props = vue.reactive({ entries, metric })
  new Function('require', 'module', 'exports', '__props', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : id === 'vue-i18n' ? { useI18n: () => ({ t: key => key, locale: vue.ref('en') }) } : id === 'ant-design-vue' ? { theme: { useToken: () => ({ token: vue.ref({ fontFamily: 'sans-serif', colorTextSecondary: 'gray', colorBorder: 'silver', colorSplit: 'silver' }) }) } } : id === './observation' ? model : {}, module, module.exports, props)
  return { ...module.exports, props }
}
test('the first valid rate sample is visible as a dot, empty trends hide synthetic axes, and known zero remains visible', () => {
  const first = model.deviceObservationSample(row('100'), 10000), second = model.deviceObservationSample(row('200'), 15000)
  const entry = { id: 'device', label: 'Device', color: '#123456', history: [first], sessions: row(), state: { status: 'ready' } }
  assert.equal(chart([entry]).option.value.xAxis.show, false)
  const option = chart([{ ...entry, history: [first, second] }]).option.value
  assert.equal(option.series[0].showSymbol, true)
  assert.deepEqual(option.series[0].data, [[10000, null], [15000, 20]])
  assert.equal(option.series[0].itemStyle.color, '#123456')
  assert.equal(chart([{ ...entry, history: [first, { ...first, sampledAt: 15000 }] }]).hasPoint.value, true)
})
test('observation controls and details compile as API-free SVG presentation', () => {
  for (const file of ['DeviceSessionObservation.vue', 'device-sessions/DeviceObservationChart.vue']) {
    const filename = resolve(root, file), source = readFileSync(filename, 'utf8'), { descriptor, errors } = parse(source)
    assert.deepEqual(errors, []); assert.ok(compileScript(descriptor, { id: file }).content)
    assert.deepEqual(compileTemplate({ filename, id: file, source: descriptor.template.content }).errors, [])
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ filename, id: file, source: style.content, scoped: style.scoped }).errors, [])
    assert.doesNotMatch(source, /fetch\(|localStorage|queryDeviceSessions/)
  }
})

test('shared byte formatting preserves default callers and fractional rates with explicit locale', () => {
  const bytes = load(resolve(root, 'allocationPresentation.ts')).formatAllocationBytes
  assert.equal(bytes(0.125), `${(0.125).toLocaleString()} B`)
  assert.equal(bytes(1024), '1 KB')
  assert.equal(model.formatDeviceObservationValue(0.25, 'receive', 'en', ''), '0.25 B/s')
  assert.equal(model.formatDeviceObservationValue(1280, 'send', 'de', ''), '1,3 KB/s')
  assert.equal(model.formatDeviceObservationValue(1280, 'messages', 'en', 'messages/s'), '1,280 messages/s')
})

test('legend selection remains bound to device identity across samples, name changes and adding another device', async () => {
  const entry = { id: 'device', label: 'Device', history: [], sessions: [], state: { status: 'ready' } }, view = chart([entry])
  view.chartEvents.legendselectchanged({ selected: { 'Device · device': false } })
  assert.equal(view.option.value.legend.selected['Device · device'], false)
  view.props.entries = [{ ...entry, history: [model.deviceObservationSample(row(), 10000)] }]; await vue.nextTick()
  assert.equal(view.option.value.legend.selected['Device · device'], false)
  view.props.entries = [{ ...entry, label: 'Renamed' }, { ...entry, id: 'second', label: 'Second' }]; await vue.nextTick()
  assert.equal(view.option.value.legend.selected['Renamed · device'], false)
  assert.equal(view.option.value.legend.selected['Second · second'], true)
})

test('device entry controls trim exact IDs, choose named suggestions once, and respect permission and the five-device limit', async () => {
  const filename = resolve(root, 'DeviceSessionObservation.vue'), source = readFileSync(filename, 'utf8'), events = []
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    .replace(/const props = defineProps<[^>]+>\(\)/, 'const props = __props')
    .replace(/const emit = defineEmits<\{[\s\S]*?\}>\(\)/, 'const emit = __emit')
  script += '\nmodule.exports = { input, addInput, selectDevice, searchKeydown, expanded, toggle }'
  const props = vue.reactive({ entries: [], active: true, access: { allowed: true }, deviceOptions: [{ value: 'selected/id', label: 'A readable name' }], paused: false, interval: 5, metric: 'receive' })
  const scope = vue.effectScope(), module = { exports: {} }
  scope.run(() => new Function('require', 'module', 'exports', '__props', '__emit', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : id === 'vue-i18n' ? { useI18n: () => ({ t: key => key, locale: vue.ref('en') }) } : id === './device-sessions/observation' ? model : {}, module, module.exports, props, (...event) => events.push(event)))
  const view = module.exports
  try {
    view.input.value = ' exact/A?B#C '; view.addInput(); assert.deepEqual(events.at(-1), ['add', 'exact/A?B#C'])
    view.selectDevice('selected/id'); view.searchKeydown({ key: 'Enter', preventDefault() {} }); await vue.nextTick()
    assert.equal(events.filter(event => event[0] === 'add' && event[1] === 'selected/id').length, 1)
    assert.deepEqual(events.at(-1), ['add', 'selected/id', 'A readable name'])
    view.input.value = 'blocked'; props.access.allowed = false; const previous = events.length; view.addInput(); view.selectDevice('selected/id'); assert.equal(events.length, previous)
    props.access.allowed = true; props.entries = Array.from({ length: 5 }, (_, i) => ({ id: String(i), history: [] })); view.addInput(); assert.equal(events.length, previous)
    props.entries = [{ id: 'keep', history: [] }]; view.toggle('keep'); await vue.nextTick(); props.entries = [{ id: 'keep', history: [{ sampledAt: 20000 }] }]; await vue.nextTick()
    assert.equal(view.expanded.value.keep, true, 'sampling must not collapse a device detail')
    props.entries = []; await vue.nextTick(); assert.deepEqual(view.expanded.value, {})
  } finally { scope.stop() }
})
