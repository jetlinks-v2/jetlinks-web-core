import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileTemplate, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import * as echarts from 'echarts'
import { escape } from 'lodash-es'
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
test('latest connection keeps its address and owning service together across nodes without borrowing missing fields', () => {
  const sessions = [
    { serverId: 'old-node', connections: [{ address: '/192.0.2.1:1883', metrics: { connectTime: 1000, lastCommTime: 9000 } }] },
    { serverId: 'new-node', transport: 'MQTT', connections: [{ address: '/192.0.2.2:1884', metrics: { connectTime: 4000 } }, { address: '/192.0.2.3:1885', metrics: { connectTime: 3000 } }] },
  ]
  assert.deepEqual(model.deviceObservationConnection(sessions), { serverId: 'new-node', transport: 'MQTT', address: '/192.0.2.2:1884', connectedAt: 4000 })
  assert.deepEqual(model.deviceObservationConnection([{ serverId: 'unknown', connections: [{ metrics: { connectTime: 5000 } }], address: 'different-session-address' }]), { serverId: 'unknown', transport: undefined, address: undefined, connectedAt: 5000 })
  assert.deepEqual(model.deviceObservationConnection([{ serverId: 'legacy', address: 'session-address', connectTime: 3000 }]), { serverId: 'legacy', transport: undefined, address: 'session-address', connectedAt: 3000 })
  assert.equal(model.deviceObservationConnection([]), undefined)
})
test('rates subtract exact per-connection counters before aggregation and preserve actual pending gauges', () => {
  const first = model.deviceObservationSample(row('9223372036854775700'), 10000)
  const next = model.deviceObservationSample(row('9223372036854775800'), 15000)
  assert.equal(model.deviceObservationPoints([first, next])[1].receive, 20)
  assert.equal(model.deviceObservationPoints([first, next])[1].send, 0)
  assert.equal(model.deviceObservationPoints([first, next])[1].pending, 3)
  assert.equal(model.deviceObservationPoints([first])[0].receive, undefined)
})
test('device message throughput sums every connection across nodes rather than one connection or the maximum', () => {
  const sessions = counts => [
    { deviceId: 'device', serverId: 'node-a', connectTime: 1000, pendingMessages: 0, connections: counts.slice(0, 2).map((totalMessages, index) => ({ id: `connection-${index}`, address: `/a:${index}`, metrics: { connectTime: 1000, totalMessages } })) },
    { deviceId: 'device', serverId: 'node-b', connectTime: 1000, pendingMessages: 0, connections: [{ id: 'connection-2', address: '/b:2', metrics: { connectTime: 1000, totalMessages: counts[2] } }] },
  ]
  const first = model.deviceObservationSample(sessions(['9007199254740993', '100', '200']), 10000)
  const nextSessions = sessions(['9007199254740995', '106', '212']).reverse()
  nextSessions[1].connections.reverse()
  const next = model.deviceObservationSample(nextSessions, 12000)
  assert.equal(model.deviceObservationPoints([first, next])[1].messages, 10, '(2 + 6 + 12) messages / 2 seconds')
  nextSessions[0].connections[0].metrics.totalMessages = undefined
  assert.equal(model.deviceObservationPoints([first, model.deviceObservationSample(nextSessions, 12000)])[1].messages, undefined, 'a partial connection total cannot be presented as a device total')
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
  assert.equal(history.length, 601)
  history = model.appendDeviceObservation(history, { sampledAt: 2000000, pending: 1 })
  assert.equal(history.length, 1)
})

function chart(entry, metrics = [...model.deviceObservationMetrics], range, translate = key => key) {
  const source = readFileSync(resolve(root, 'device-sessions/DeviceObservationChart.vue'), 'utf8')
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    .replace(/const props = defineProps<[^>]+>\(\)/, 'const props = __props')
    .replace(/const emit = defineEmits<\{[\s\S]*?\}>\(\)/, 'const emit = __emit')
  script += '\nmodule.exports = { option, hasPoint, chartEvents }'
  const module = { exports: {} }, props = vue.reactive({ entry, metrics, range }), events = []
  new Function('require', 'module', 'exports', '__props', '__emit', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : id === 'vue-i18n' ? { useI18n: () => ({ t: translate, locale: vue.ref('en') }) } : id === 'ant-design-vue' ? { theme: { useToken: () => ({ token: vue.ref({ fontFamily: 'sans-serif', colorText: 'black', colorTextSecondary: 'gray', colorBorder: 'silver', colorSplit: 'silver' }) }) } } : id === './observation' ? model : id === 'lodash-es' ? { escape } : {}, module, module.exports, props, (...args) => events.push(args))
  return { ...module.exports, props, events }
}
const entry = history => ({ id: 'device', label: 'Device', history, sessions: [], state: { status: 'ready' } })
test('all four series use the correct unit axes, exact samples and stable metric colors', () => {
  const first = model.deviceObservationSample(row('100'), 10000), second = model.deviceObservationSample(row('200'), 15000)
  assert.equal(chart(entry([first]), ['receive']).option.value.xAxis.show, false)
  assert.equal(chart(entry([first])).hasPoint.value, true, 'the initial pending gauge is immediately available')
  const view = chart(entry([first, second])), option = view.option.value
  assert.deepEqual(option.series.map(series => series.yAxisIndex), [0, 0, 1, 2])
  assert.deepEqual(option.series[0].data, [[10000, null], [15000, 20]])
  assert.equal(option.series[0].showSymbol, true)
  assert.equal(option.series[0].itemStyle.color, model.deviceObservationMetricColors.receive)
  assert.equal(option.yAxis[2].minInterval, 1)
  assert.ok(option.yAxis.every(axis => axis.name === ''))
  view.props.metrics = ['pending']
  assert.deepEqual(view.option.value.yAxis.map(axis => axis.show), [false, false, true])
  view.props.metrics = []; assert.equal(view.hasPoint.value, false)
})
test('tooltip omits repeated device identity and keeps escaped metrics, frame gaps and actual sample time', () => {
  const history = [model.deviceObservationSample(row('100'), 10000), model.deviceObservationSample(row('200'), 15000), { sampledAt: 20000 }, { sampledAt: 25000 }]
  const view = chart({ ...entry(history), id: '2056924084996218880', label: 'Device identity' }, undefined, undefined, key => `<img src=x>${key}`), tooltip = view.option.value.tooltip.formatter
  const html = tooltip([{ axisValue: 15050, value: [15000, 20] }])
  for (const metric of model.deviceObservationMetrics) assert.ok(html.includes('metric.' + metric))
  assert.ok(html.includes('20 B/s')); assert.ok(html.includes('0 B/s')); assert.ok(html.includes('&lt;img src=x&gt;')); assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('Device identity')); assert.ok(!html.includes('2056924084996218880'))
  assert.equal((tooltip([{ axisValue: 20000 }]).match(/—/g) ?? []).length, 4)
  assert.equal((tooltip([{ axisValue: 50000 }]).match(/—/g) ?? []).length, 4)
  view.props.metrics = ['pending']; assert.ok(tooltip([{ axisValue: 15000 }]).includes('20 B/s'), 'legend only changes curves')
  assert.equal(model.deviceObservationPointAt([{ sampledAt: 10000 }, { sampledAt: 15000 }, { sampledAt: 30000 }], 22000), undefined)
  assert.equal(model.deviceObservationPointAt(history, 15050).sampledAt, 15000)
  assert.equal(model.deviceObservationPointAt(history, 9999), undefined)
})
test('legend selection shares stable metric identities across devices, new samples and renames', () => {
  const a = chart(entry([])), b = chart({ ...entry([]), id: 'other', label: 'Device' })
  a.chartEvents.legendselectchanged({ selected: { receive: false, send: true, messages: true, pending: false } })
  const selected = a.events.at(-1)
  assert.deepEqual(selected, ['update:metrics', ['send', 'messages']])
  a.props.metrics = b.props.metrics = selected[1]
  for (const view of [a, b]) {
    assert.deepEqual(view.option.value.legend.selected, { receive: false, send: true, messages: true, pending: false })
    view.props.entry = { ...view.props.entry, label: 'Renamed', history: [{ sampledAt: 10000 }] }
    assert.equal(view.option.value.legend.selected.receive, false)
  }
})
test('observation controls and charts compile as API-free SVG presentation', () => {
  for (const file of ['DeviceSessionObservation.vue', 'device-sessions/DeviceObservationChart.vue']) {
    const filename = resolve(root, file), source = readFileSync(filename, 'utf8'), { descriptor, errors } = parse(source)
    assert.deepEqual(errors, []); assert.ok(compileScript(descriptor, { id: file }).content)
    assert.deepEqual(compileTemplate({ filename, id: file, source: descriptor.template.content }).errors, [])
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ filename, id: file, source: style.content, scoped: style.scoped }).errors, [])
    assert.doesNotMatch(source, /fetch\(|localStorage|queryDeviceSessions/)
  }
})
test('byte formatting preserves fractional rates and explicit locale', () => {
  assert.equal(model.formatDeviceObservationValue(0.25, 'receive', 'en', ''), '0.25 B/s')
  assert.equal(model.formatDeviceObservationValue(1280, 'send', 'de', ''), '1,3 KB/s')
  assert.equal(model.formatDeviceObservationValue(1280, 'messages', 'en', 'messages/s'), '1,280 messages/s')
})
test('real ECharts instances link timestamps across widths and detach safely on replacement, inactivity and disposal', t => {
  const scope = vue.effectScope(), active = vue.ref(true), module = { exports: {} }
  const source = readFileSync(resolve(root, 'device-sessions/useDeviceObservationCharts.ts'), 'utf8')
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : require(id), module, module.exports)
  const linked = scope.run(() => module.exports.useDeviceObservationCharts(active))
  const instances = []
  t.after(() => { scope.stop(); instances.forEach(instance => instance.dispose()) })
  function make(width, history) {
    const instance = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width, height: 220 })
    instance.setOption(chart(entry(history), [...model.deviceObservationMetrics], { from: 10000, to: 30000 }).option.value)
    instances.push(instance); return instance
  }
  const a = make(500, [{ sampledAt: 10000, pending: 0 }, { sampledAt: 30000, pending: 2 }])
  const b = make(300, [{ sampledAt: 10000, pending: 1 }, { sampledAt: 15000 }, { sampledAt: 30000, pending: 3 }])
  const other = make(400, [{ sampledAt: 10000, pending: 1 }])
  linked.register('a', a); linked.register('b', b)
  const hover = time => a.dispatchAction({ type: 'updateAxisPointer', x: a.convertToPixel({ xAxisIndex: 0 }, time), y: 70 })
  hover(21000)
  assert.equal(b.getOption().xAxis[0].axisPointer.status, 'show')
  assert.ok(Math.abs(b.getOption().xAxis[0].axisPointer.value - 21000) < 1)
  assert.notEqual(other.getOption().xAxis[0].axisPointer.status, 'show', 'other workspaces stay independent')
  active.value = false; assert.equal(b.getOption().xAxis[0].axisPointer.status, 'hide')
  hover(22000); assert.equal(b.getOption().xAxis[0].axisPointer.status, 'hide')
  active.value = true
  linked.register('b', other); linked.unregister('b', b); hover(23000)
  assert.equal(other.getOption().xAxis[0].axisPointer.status, 'show', 'stale dispose cannot detach replacement')
  scope.stop(); hover(24000)
  assert.equal(other.getOption().xAxis[0].axisPointer.status, 'hide')
})

test('device entry controls trim exact IDs, choose named suggestions once, and respect permission and the five-device limit', async t => {
  let now = 1800000000000, tick = () => {}, clockActive = false
  t.mock.method(Date, 'now', () => now)
  const filename = resolve(root, 'DeviceSessionObservation.vue'), source = readFileSync(filename, 'utf8'), events = []
  let script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    .replace(/const props = defineProps<[^>]+>\(\)/, 'const props = __props')
    .replace(/const emit = defineEmits<\{[\s\S]*?\}>\(\)/, 'const emit = __emit')
  script += '\nmodule.exports = { input, addInput, selectDevice, searchKeydown, expanded, openDetails, connectionDuration, connectionCount }'
  const props = vue.reactive({ entries: [], active: true, access: { allowed: true }, deviceOptions: [{ value: 'selected/id', label: 'A readable name' }], paused: false, interval: 5, metrics: [...model.deviceObservationMetrics] })
  const scope = vue.effectScope(), module = { exports: {} }
  scope.run(() => new Function('require', 'module', 'exports', '__props', '__emit', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => id === 'vue' ? vue : id === '@vueuse/core' ? { useIntervalFn: callback => { tick = () => { if (clockActive) callback() }; vue.onScopeDispose(() => { clockActive = false }); return { resume() { clockActive = true }, pause() { clockActive = false } } } } : id === './deviceSessionPresentation' ? load(resolve(root, 'deviceSessionPresentation.ts')) : id === 'vue-i18n' ? { useI18n: () => ({ t: key => key, locale: vue.ref('en') }) } : id === './device-sessions/observation' ? model : id === './device-sessions/useDeviceObservationCharts' ? { useDeviceObservationCharts: () => ({ register() {}, unregister() {} }) } : {}, module, module.exports, props, (...event) => events.push(event)))
  const view = module.exports
  try {
    const sessions = row(); sessions.push({ serverId: 'other-node', connections: [{ address: '/other', metrics: { connectTime: now - 10000 } }] })
    props.entries = [{ id: 'duration', sessions, history: [] }]; await vue.nextTick()
    assert.equal(view.connectionCount(props.entries[0]), 2, 'connection count includes all nodes')
    assert.equal(view.connectionDuration(props.entries[0]), '10s')
    const eventsBeforeClock = events.length; now += 5000; tick(); await vue.nextTick()
    assert.equal(view.connectionDuration(props.entries[0]), '15s'); assert.equal(events.length, eventsBeforeClock, 'duration updates never request new samples')
    props.active = false; await vue.nextTick(); assert.equal(clockActive, false)
    now += 5000; tick(); assert.equal(view.connectionDuration(props.entries[0]), '15s')
    props.active = true; await vue.nextTick(); assert.equal(view.connectionDuration(props.entries[0]), '20s')
    props.entries = []; await vue.nextTick(); assert.equal(clockActive, false)
    view.input.value = ' exact/A?B#C '; view.addInput(); assert.deepEqual(events.at(-1), ['add', 'exact/A?B#C'])
    view.selectDevice('selected/id'); view.searchKeydown({ key: 'Enter', preventDefault() {} }); await vue.nextTick()
    assert.equal(events.filter(event => event[0] === 'add' && event[1] === 'selected/id').length, 1)
    assert.deepEqual(events.at(-1), ['add', 'selected/id', 'A readable name'])
    view.input.value = 'blocked'; props.access.allowed = false; const previous = events.length; view.addInput(); view.selectDevice('selected/id'); assert.equal(events.length, previous)
    props.access.allowed = true; props.entries = Array.from({ length: 5 }, (_, i) => ({ id: String(i), sessions: [], history: [] })); view.addInput(); assert.equal(events.length, previous)
    props.entries = [{ id: 'keep', sessions: [], history: [] }]; view.openDetails('keep', true); await vue.nextTick(); props.entries = [{ id: 'keep', sessions: [], history: [{ sampledAt: 20000 }] }]; await vue.nextTick()
    assert.equal(view.expanded.value.keep, true, 'sampling must not collapse a device detail')
    props.active = false; await vue.nextTick(); assert.deepEqual(view.expanded.value, {}, 'portaled details close when leaving the view')
    props.entries = []; await vue.nextTick(); assert.deepEqual(view.expanded.value, {})
  } finally { scope.stop() }
})
