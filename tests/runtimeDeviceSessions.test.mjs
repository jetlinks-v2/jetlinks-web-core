import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle, compileTemplate } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics'), cache = new Map(), clocks = []
const translate = (key, params = {}) => `${key}${Object.keys(params).length ? ` ${Object.values(params).join(' ')}` : ''}`
const icon = vue.defineComponent({ setup: () => () => vue.h('i') })
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const source = readFileSync(filename, 'utf8'), script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'device-session-test', inlineTemplate: true }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: translate, locale: vue.ref('en') }) }
    if (id === 'ant-design-vue') return { Empty: { PRESENTED_IMAGE_SIMPLE: '' } }
    if (id === '@ant-design/icons-vue') return new Proxy({}, { get: () => icon })
    if (id === '@vueuse/core') return { useIntervalFn: callback => {
      const clock = { active: false, pause() { this.active = false }, resume() { this.active = true }, tick() { if (this.active) callback() } }
      vue.onScopeDispose(() => clock.pause()); clocks.push(clock); return clock
    } }
    if (id.startsWith('.')) { const file = resolve(dirname(filename), id); return load(existsSync(file) ? file : `${file}.ts`) }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const presentation = load(resolve(root, 'deviceSessionPresentation.ts')), component = load(resolve(root, 'DeviceSessionViewer.vue')).default
const text = node => node.text ?? (node.children ?? []).map(text).join('')
const findAll = (node, predicate) => [node, ...(node.children ?? []).flatMap(child => findAll(child, predicate))].filter(predicate)
const hasClass = (node, name) => typeof node.props?.class === 'string' && node.props.class.split(' ').includes(name)
const flush = async () => { await vue.nextTick(); await vue.nextTick() }

test('device-session viewer labels are supplied by core locales with matching zh/en keys', () => {
  const dictionaries = ['zh', 'en'].map(language => JSON.parse(readFileSync(resolve(import.meta.dirname, `../src/locales/lang/${language}.json`), 'utf8')))
  const keys = dictionaries.map(dictionary => Object.keys(dictionary).filter(key => key.startsWith('runtimeDiagnostics.deviceSessions.')).sort())
  assert.ok(keys[0].length >= 36)
  assert.deepEqual(keys[0], keys[1])
  for (const dictionary of dictionaries) assert.ok(keys[0].every(key => dictionary[key]))
  assert.equal(dictionaries[0]['runtimeDiagnostics.deviceSessions.lastCommTime'], '最近通信')
  assert.match(dictionaries[0]['runtimeDiagnostics.deviceSessions.lastActiveHint'], /会话.*心跳.*连接.*通信/)
  assert.match(dictionaries[1]['runtimeDiagnostics.deviceSessions.lastActiveHint'], /last heartbeat.*actual last communication/)
})
function harness(input = {}, slots = {}) {
  const events = [], props = vue.reactive({ nodeId: 'iot:8200', deviceId: '', queriedDeviceId: '', resultDeviceId: '', sessions: [], state: { status: 'ready' }, access: { allowed: true }, active: true, ...input })
  const renderer = vue.createRenderer({
    createElement: type => ({ type, props: {}, children: [], parent: null }), createText: value => ({ type: '#text', text: value }), createComment: value => ({ type: '#comment', text: '' }),
    setText: (node, value) => { node.text = value }, setElementText: (node, value) => { node.children = []; node.text = value },
    parentNode: node => node.parent, nextSibling: node => { const list = node.parent?.children ?? []; return list[list.indexOf(node) + 1] },
    patchProp: (node, key, _previous, value) => { node.props[key] = value },
    insert(node, parent, anchor) { if (node.parent) { const index = node.parent.children.indexOf(node); if (index >= 0) node.parent.children.splice(index, 1) }; node.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; if (index < 0) parent.children.push(node); else parent.children.splice(index, 0, node) },
    remove(node) { const index = node.parent?.children.indexOf(node) ?? -1; if (index >= 0) node.parent.children.splice(index, 1); node.parent = null },
  })
  const wrapper = tag => vue.defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
  const button = vue.defineComponent({ inheritAttrs: false, props: ['htmlType', 'type', 'loading', 'disabled'], setup: (props, { attrs, slots }) => () => vue.h('button', { ...attrs, type: props.htmlType || 'button', disabled: props.disabled }, slots.default?.()) })
  const inputStub = vue.defineComponent({ inheritAttrs: false, props: ['value'], emits: ['update:value'], setup: (props, { attrs, emit }) => () => vue.h('input', { ...attrs, value: props.value, onInput: event => emit('update:value', event.target.value) }) })
  const autoComplete = vue.defineComponent({
    inheritAttrs: false, props: ['value', 'options', 'disabled', 'filterOption', 'defaultActiveFirstOption', 'showArrow'], emits: ['update:value', 'search', 'select', 'keydown'],
    setup: (props, { attrs, emit, slots }) => () => vue.h('div', { ...attrs, 'data-autocomplete': true, 'data-default-active-first-option': props.defaultActiveFirstOption, onSelect: value => { emit('update:value', value); emit('select', value) } }, [
      vue.h('input', { value: props.value, disabled: props.disabled, onInput: event => { emit('update:value', event.target.value); emit('search', event.target.value) }, onKeydown: event => emit('keydown', event) }),
      ...(props.options ?? []).map(option => vue.h('div', { 'data-device-option': option.value }, slots.option?.(option))),
      ...(slots.suffixIcon?.() ?? []),
    ]),
  })
  const status = vue.defineComponent({ inheritAttrs: false, props: ['message', 'description'], setup: props => () => vue.h('aside', `${props.message ?? ''}${props.description ? ` ${props.description}` : ''}`) })
  const app = renderer.createApp({ setup: () => () => vue.h(component, { ...props, 'onUpdate:deviceId': value => { props.deviceId = value; events.push(['update:deviceId', value]) }, onQuery: value => events.push(['query', value]), onRefresh: () => events.push(['refresh']), 'onSearch-device': value => events.push(['search-device', value]), 'onSelect-device': value => events.push(['select-device', value]) }, slots) })
  for (const name of ['a-tooltip', 'a-tag', 'a-typography-text']) app.component(name, wrapper('span'))
  app.component('a-button', button); app.component('a-input', inputStub); app.component('a-auto-complete', autoComplete); app.component('a-alert', status); app.component('a-empty', status)
  const container = { type: 'root', props: {}, children: [] }; app.mount(container)
  return { props, events, root: container, clock: clocks.at(-1), stop: () => app.unmount(), nodes: predicate => findAll(container, predicate), content: () => text(container), submit: () => findAll(container, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }) }
}

test('session projection keeps current-node priority, safe zeroes, exact counters and separate connection scopes', () => {
  const data = [{ deviceId: 'remote', serverId: 'other' }, { deviceId: 'local', serverId: 'iot:8200', pendingMessages: 0, connections: [{ pendingMessages: 2, metrics: { pendingMessages: 3, readBytes: 0, writeBytes: '9223372036854775807' } }] }, { deviceId: 'last', serverId: 'other2' }]
  const rows = presentation.deviceSessionRows(data, 'iot:8200')
  assert.deepEqual(rows.map(row => row.session.deviceId), ['local', 'remote', 'last']); assert.equal(data[0].deviceId, 'remote')
  assert.equal(rows[0].pendingMessages, '0')
  assert.deepEqual(rows[0].connections[0].metrics.map(metric => [metric.key, metric.value]), [['pendingMessages', '2'], ['readBytes', '0 B'], ['writeBytes', '8 EB'], ['metricsPendingMessages', '3']])
  for (const value of [null, undefined, '', ' ', false, true, -1, Infinity, NaN, 1.2, Number.MAX_SAFE_INTEGER + 1]) assert.equal(presentation.deviceSessionCounter(value), undefined)
})

test('large byte counters scale with exact BigInt rounding while raw bytes remain available', () => {
  assert.equal(presentation.formatDeviceSessionBytes(0), '0 B')
  assert.equal(presentation.formatDeviceSessionBytes('1024'), '1 KB')
  assert.equal(presentation.formatDeviceSessionBytes('9007199254740993'), '8 PB')
  assert.equal(presentation.formatDeviceSessionBytes('9223372036854775807'), '8 EB')
  const exabyte = 1024n ** 6n, justBelowHalfTenth = exabyte * 105n / 100n - 1n
  assert.equal(presentation.formatDeviceSessionBytes(String(justBelowHalfTenth)), '1 EB')
  assert.equal(presentation.formatDeviceSessionBytes(String(justBelowHalfTenth + exabyte / 1000000n)), '1.1 EB')
  const metric = presentation.deviceSessionRows([{ connections: [{ metrics: { readBytes: '9223372036854775807' } }] }], '')[0].connections[0].metrics[0]
  assert.equal(metric.raw, '9223372036854775807'); assert.equal(metric.value, '8 EB')
})

test('session and connection identity survives server result reordering, while actual communication remains a fixed timestamp', async t => {
  const now = 1800000000000, first = { serverId: 'a', deviceId: 'device', lastCommTime: now - 1000, connections: [{ id: 'c1', metrics: { connectTime: now - 10000, lastCommTime: now - 2000 } }] }, second = { serverId: 'b', deviceId: 'device' }
  const before = presentation.deviceSessionRows([first, second], ''), after = presentation.deviceSessionRows([second, first], '')
  assert.equal(before[0].key, after[1].key); assert.equal(before[0].connections[0].key, after[1].connections[0].key)
  t.mock.method(Date, 'now', () => now)
  const h = harness({ sessions: [first], resultDeviceId: 'device' })
  try {
    const content = h.content(), times = h.nodes(node => node.type === 'time').map(text); assert.match(content, /lastHeartbeat/); assert.match(content, /lastCommTime/)
    t.mock.method(Date, 'now', () => now + 120000); h.clock.tick(); await flush()
    assert.deepEqual(h.nodes(node => node.type === 'time').map(text), times, 'heartbeat and last communication do not age with the local timer')
  } finally { h.stop() }
})

test('timestamps, elapsed connection time and recent communication use epoch milliseconds without inventing future durations', () => {
  const now = 1800000000000
  assert.equal(presentation.deviceSessionTimestamp('1799999999000'), now - 1000)
  for (const value of [0, '0', -1, null, '', true, 'not-a-date', 8640000000000001]) assert.equal(presentation.deviceSessionTimestamp(value), undefined)
  assert.equal(presentation.deviceSessionElapsed(now - 1000, now), 1); assert.equal(presentation.deviceSessionElapsed(now + 1, now), undefined)
  assert.equal(presentation.formatDeviceSessionDuration(now - 3665000, now, 'en'), '1h1m5s')
  assert.equal(presentation.formatDeviceSessionDuration(now - (86400 + 7200 + 1200) * 1000, now, 'en'), '1d2h20m')
  assert.equal(presentation.formatDeviceSessionDuration(now - (86400 + 7200 + 1200) * 1000, now, 'zh'), '1天2小时20分')
  assert.match(presentation.formatDeviceSessionLastSeen(now - 3000, now, 'en'), /3 sec.*ago/)
  assert.ok(presentation.formatDeviceSessionTimestamp(now, 'zh')); assert.equal(presentation.formatDeviceSessionDuration(undefined, now), undefined)
})

test('production search form submits trimmed exact IDs and refreshes only the submitted identity; denied and loading actions emit nothing', async () => {
  const h = harness()
  try {
    assert.match(h.content(), /deviceSessions\.initial/)
    const input = h.nodes(node => node.type === 'input')[0]
    input.props.onInput({ target: { value: ' device/A?B#C ' } }); await flush()
    h.submit(); assert.deepEqual(h.events.at(-1), ['query', 'device/A?B#C'])
    assert.equal(h.nodes(node => node.type === 'button' && node.props.type === 'submit').length, 1, 'native form Enter and primary button share one submission path')
    h.props.queriedDeviceId = 'previous'; await flush()
    const refresh = () => h.nodes(node => node.type === 'button' && node.props['aria-label']?.endsWith('.refresh'))[0].props.onClick()
    refresh(); assert.deepEqual(h.events.at(-1), ['refresh'])
    for (const patch of [{ access: { allowed: false } }, { access: { allowed: true }, state: { status: 'loading' } }, { active: false, state: { status: 'ready' } }]) {
      Object.assign(h.props, patch); await flush(); const count = h.events.length; h.submit(); refresh(); assert.equal(h.events.length, count)
    }
  } finally { h.stop() }
})

test('remote suggestions render names and exact IDs; choosing emits once while free Enter keeps exact-ID queries', async () => {
  const id = 'device/'.repeat(50), h = harness({ remoteSearch: true, deviceSearching: true, resultDeviceId: 'previous-device', sessions: [{ deviceId: 'previous-device' }], deviceOptions: [{ value: id, label: 'Boiler sensor', description: 'North plant' }] })
  const input = () => h.nodes(node => node.type === 'input')[0]
  const autocomplete = () => h.nodes(node => node.props?.['data-autocomplete'])[0]
  try {
    assert.equal(autocomplete().props['data-default-active-first-option'], false)
    assert.equal(autocomplete().props['aria-busy'], true)
    const option = h.nodes(node => node.props?.['data-device-option'] === id)[0]
    assert.match(text(option), /Boiler sensor/); assert.ok(text(option).includes(id)); assert.match(text(option), /North plant/)
    input().props.onInput({ target: { value: 'Boiler' } }); await flush()
    assert.deepEqual(h.events.slice(-2), [['update:deviceId', 'Boiler'], ['search-device', 'Boiler']])
    assert.equal(text(h.nodes(node => hasClass(node, 'device-session-result-id'))[0]), 'previous-device')
    autocomplete().props.onSelect(id)
    let prevented = false
    input().props.onKeydown({ key: 'Enter', preventDefault() { prevented = true } })
    assert.equal(prevented, true)
    assert.deepEqual(h.events.filter(([event]) => ['query', 'select-device'].includes(event)), [['select-device', id]])
    await flush()
    input().props.onInput({ target: { value: ' direct-device/A?B#C ' } }); await flush()
    input().props.onKeydown({ key: 'Enter', preventDefault() {} })
    assert.deepEqual(h.events.at(-1), ['query', 'direct-device/A?B#C'])
    const count = h.events.length
    input().props.onKeydown({ key: 'Enter', isComposing: true, preventDefault() { assert.fail('IME confirmation must not submit') } })
    assert.equal(h.events.length, count)
    assert.equal(text(h.nodes(node => hasClass(node, 'device-session-result-id'))[0]), 'previous-device')
    for (const patch of [{ active: false }, { active: true, access: { allowed: false } }]) {
      Object.assign(h.props, patch); await flush()
      const before = h.events.length
      assert.equal(input().props.disabled, true)
      input().props.onInput({ target: { value: 'denied' } }); autocomplete().props.onSelect(id)
      input().props.onKeydown({ key: 'Enter', preventDefault() {} }); h.submit()
      assert.equal(h.events.length, before)
    }
  } finally { h.stop() }
})

test('cluster mode omits node priority and composes a permission-aware compact filter slot', async () => {
  const h = harness({ nodeId: undefined, sessions: [{ serverId: 'other' }, { serverId: 'iot:8200' }] }, { filters: ({ disabled }) => vue.h('select', { class: 'node-filter', disabled }) })
  try {
    assert.deepEqual(h.nodes(node => node.type === 'article').map(row => text(row).trim()), ['other', 'iot:8200'])
    assert.ok(!h.content().includes('currentNode'))
    assert.equal(h.nodes(node => node.type === 'select')[0].props.disabled, false)
    h.props.active = false; await flush(); assert.equal(h.nodes(node => node.type === 'select')[0].props.disabled, true)
    h.props.active = true; h.props.access = { allowed: false }; await flush(); assert.equal(h.nodes(node => node.type === 'select')[0].props.disabled, true)
  } finally { h.stop() }
})

test('result header exposes a fixed query-snapshot timestamp and explains activity without claiming live IO', async t => {
  let now = 1800000000000
  t.mock.method(Date, 'now', () => now)
  const h = harness({ state: { status: 'ready', sampledAt: now }, sessions: [{ serverId: 'iot:8200', lastCommTime: now - 1000 }] })
  try {
    const snapshot = () => text(h.nodes(node => hasClass(node, 'device-session-snapshot'))[0])
    const before = snapshot()
    assert.match(before, /deviceSessions\.snapshotAt/)
    assert.ok(before.includes(presentation.formatDeviceSessionTimestamp(now, 'en')))
    assert.match(text(h.nodes(node => hasClass(node, 'device-session-activity-note'))[0]), /deviceSessions\.lastActiveHint/)
    now += 10000; h.clock.tick(); await flush()
    assert.equal(snapshot(), before); assert.equal(h.events.length, 0)
    h.props.state = { status: 'ready' }; await flush(); assert.equal(h.nodes(node => hasClass(node, 'device-session-snapshot')).length, 0)
  } finally { h.stop() }
})

test('production results retain long IDs, label current nodes first and expand multiple connections in place', async () => {
  const long = 'device-'.repeat(80), now = Date.now()
  const h = harness({ deviceId: long, queriedDeviceId: long, resultDeviceId: long, sessions: [{ deviceId: long, serverId: 'remote' }, { deviceId: long, serverId: 'iot:8200', transport: 'TCP', connectTime: now - 30000, lastCommTime: now - 1000, pendingMessages: 0, connections: [{ id: 'first-connection', metrics: { readBytes: 0, writeBytes: 0 } }, { id: 'second-connection', pendingMessages: 0, metrics: { readBytes: '9223372036854775807' } }] }] })
  try {
    const rows = h.nodes(node => node.type === 'article')
    assert.match(text(rows[0]), /iot:8200/); assert.match(text(rows[0]), /currentNode/); assert.match(text(rows[0]), /TCP/)
    assert.ok(!text(rows[0]).includes(long)); assert.equal(h.content().split(long).length - 1, 1)
    assert.equal(h.nodes(node => node.props?.copyable?.text === long).length, 1, 'the full result device ID has one copy affordance')
    assert.ok(!h.content().includes('first-connection')); assert.ok(!h.content().includes('second-connection'))
    const toggle = () => h.nodes(node => node.type === 'button' && hasClass(node, 'device-session-connections-toggle'))[0]
    assert.equal(toggle().props['aria-expanded'], false); toggle().props.onClick(); await flush()
    assert.equal(toggle().props['aria-expanded'], true); assert.ok(h.content().includes('first-connection')); assert.ok(h.content().includes('second-connection')); assert.ok(h.content().includes('0 B'))
    assert.ok(h.content().includes('8 EB')); assert.equal(h.nodes(node => node.props?.title === '9223372036854775807 B').length, 1)
    toggle().props.onClick(); await flush(); assert.ok(!h.content().includes('second-connection'))
    assert.equal(h.nodes(node => node.type === 'pre').length, 0)
  } finally { h.stop() }
})

test('expanded connection details show every connection across service nodes without nested toggles', async () => {
  const now = Date.now(), connection = (id, address, age, readBytes) => ({ id, address, metrics: { connectTime: now - age, lastCommTime: now - 1000, readBytes, writeBytes: 0, totalMessages: 4, droppedMessages: 0 } })
  const h = harness({ detailsOnly: true, expandConnections: true, resultDeviceId: 'device', sessions: [
    { deviceId: 'not-repeated-in-popover', serverId: 'iot:8200', address: '/first', connections: [connection('internal-connection-id', '/first', 30000, 1024), connection('b', '/second', 20000, 2048)] },
    { serverId: 'network:8300', connections: [connection('c', '/third', 10000, 4096)] },
    { serverId: 'iot:8200', connections: [connection('d', '/fourth', 5000, 512)] },
  ] })
  try {
    assert.equal(h.nodes(node => hasClass(node, 'device-session-connections-toggle')).length, 0)
    const groups = h.nodes(node => hasClass(node, 'device-session-group'))
    assert.equal(groups.length, 2)
    assert.ok(!h.content().includes('not-repeated-in-popover'))
    assert.ok(!h.content().includes('internal-connection-id'))
    assert.ok(h.nodes(node => node.props?.title?.includes('internal-connection-id')).length > 0, 'connection identity remains available on hover')
    assert.equal(h.nodes(node => node.props?.class === 'device-session-facts').length, 0, 'the compact list does not repeat session summaries')
    for (const [index, addresses] of [[0, ['/first', '/second', '/fourth']], [1, ['/third']]]) {
      assert.ok(addresses.every(address => text(groups[index]).includes(address)))
      const items = findAll(groups[index], node => node.type === 'li')
      assert.equal(items.length, addresses.length)
      for (const [offset, item] of items.entries()) {
        const age = index === 1 ? 10000 : [30000, 20000, 5000][offset]
        const duration = findAll(item, node => hasClass(node, 'device-session-connection-duration'))[0]
        assert.equal(duration.props.title, presentation.formatDeviceSessionTimestamp(now - age, 'en'))
        assert.equal(text(duration), `${age / 1000}s`)
        assert.match(text(item), /deviceSessions\.lastCommTime/)
        assert.match(text(item), /deviceSessions\.readBytes/)
      }
    }
    assert.match(text(groups[0]), /1 KB.*2 KB/); assert.match(text(groups[1]), /4 KB/)
    h.props.access = { allowed: false }; h.props.state = { status: 'forbidden' }; await flush()
    assert.equal(h.nodes(node => node.type === 'li').length, 0)
  } finally { h.stop() }
})

test('connection expansion survives refreshed counters, changing representative connections and reordered results', async () => {
  const connection = (id, readBytes = 0) => ({ id, address: `/${id}`, metrics: { connectTime: 1800000000000, readBytes } })
  const session = { deviceId: 'device', serverId: 'iot:8200', transport: 'MQTT', address: '/first', connectTime: 1800000000000, connections: [connection('first'), connection('second')] }
  const h = harness({ resultDeviceId: 'device', sessions: [session] })
  const toggle = () => h.nodes(node => node.type === 'button' && hasClass(node, 'device-session-connections-toggle'))[0]
  try {
    toggle().props.onClick(); await flush()
    const list = h.nodes(node => node.type === 'ul')[0], id = toggle().props['aria-controls']
    h.props.sessions = [{ deviceId: 'device', serverId: 'remote' }, { ...session, address: '/second', connectTime: 1800000001000, lastCommTime: 1800000005000, connections: [connection('second', 2048), connection('first', 1024), connection('third')] }]
    await flush()
    assert.equal(toggle().props['aria-expanded'], true)
    assert.equal(toggle().props['aria-controls'], id)
    assert.equal(h.nodes(node => node.type === 'ul')[0], list, 'the connection list remains mounted during refresh')
    assert.ok(h.content().includes('2 KB')); assert.ok(h.content().includes('third'))
    h.props.state = { status: 'stale' }; await flush(); assert.equal(toggle().props['aria-expanded'], true)
    h.props.sessions = []; h.props.state = { status: 'empty' }; await flush()
    h.props.sessions = [session]; h.props.state = { status: 'ready' }; await flush()
    assert.equal(toggle().props['aria-expanded'], false, 'a confirmed disappearing session loses its old expansion')
    toggle().props.onClick(); await flush()
    h.props.access = { allowed: false }; await flush()
    h.props.access = { allowed: true }; await flush()
    assert.equal(toggle().props['aria-expanded'], false, 'revoked access clears reading state')
    toggle().props.onClick(); await flush()
    h.props.resultDeviceId = 'other-device'; await flush()
    assert.equal(toggle().props['aria-expanded'], false, 'another query identity does not inherit expansion')
  } finally { h.stop() }
})

test('row-specific device IDs remain visible when they differ from the result identity or no global ID exists', async () => {
  const h = harness({ resultDeviceId: 'expected-device', sessions: [{ deviceId: 'expected-device', serverId: 'iot:8200' }, { deviceId: 'actual-other-device' }] })
  try {
    const rows = h.nodes(node => node.type === 'article')
    assert.ok(!text(rows[0]).includes('expected-device')); assert.match(text(rows[1]), /actual-other-device/); assert.match(text(rows[1]), /deviceSessions\.unknownNode/)
    h.props.resultDeviceId = ''; await flush()
    assert.match(text(h.nodes(node => node.type === 'article')[0]), /expected-device/)
  } finally { h.stop() }
})

test('production states distinguish no sessions from offline and loading/error retain results under their original device ID', async () => {
  const h = harness({ queriedDeviceId: 'new', resultDeviceId: 'old', sessions: [{ deviceId: 'old', serverId: 'iot:8200' }], state: { status: 'loading' } })
  try {
    assert.match(h.content(), /deviceSessions\.loading new/); assert.equal(text(h.nodes(node => hasClass(node, 'device-session-result-id'))[0]), 'old'); assert.match(h.content(), /retainedResults/)
    h.props.state = { status: 'error', message: 'network failed' }; await flush(); assert.match(h.content(), /network failed/); assert.equal(text(h.nodes(node => hasClass(node, 'device-session-result-id'))[0]), 'old')
    h.props.state = { status: 'forbidden' }; await flush(); assert.match(h.content(), /deviceSessions\.forbidden/); assert.equal(h.nodes(node => node.type === 'article').length, 0)
    h.props.sessions = []; h.props.state = { status: 'empty' }; await flush(); assert.match(h.content(), /deviceSessions\.noSessions/); assert.ok(!/offline|离线/.test(h.content()))
    h.props.state = { status: 'unsupported' }; await flush(); assert.match(h.content(), /deviceSessions\.unsupported/)
  } finally { h.stop() }
})

test('local time advances without query events and pauses on inactive views; absent fields add no fabricated metrics', async t => {
  let now = 1800000000000
  t.mock.method(Date, 'now', () => now)
  const h = harness({ sessions: [{ deviceId: 'clock', serverId: 'iot:8200', connectTime: now - 1000, lastCommTime: now - 1000 }], queriedDeviceId: 'clock' })
  try {
    const before = h.content(); now += 1000; h.clock.tick(); await flush(); assert.notEqual(h.content(), before); assert.equal(h.events.length, 0)
    h.props.active = false; await flush(); assert.equal(h.clock.active, false)
    const paused = h.content(); now += 10000; h.clock.tick(); await flush(); assert.equal(h.content(), paused)
    h.props.active = true; await flush(); assert.notEqual(h.content(), paused); assert.equal(h.events.length, 0)
    for (const status of ['forbidden', 'unsupported']) {
      h.props.state = { status }; await flush(); assert.equal(h.clock.active, false)
      h.props.state = { status: 'ready' }; await flush(); assert.equal(h.clock.active, true)
    }
    h.props.sessions = [{ deviceId: 'missing', serverId: 'iot:8200' }]; await flush(); assert.equal(h.clock.active, false); assert.ok(!h.content().includes('readBytes')); assert.ok(!h.content().includes('0 B'))
  } finally { h.stop(); assert.equal(h.clock.active, false) }
})

test('production SFC, styles, fixture and public exports compile with wrap-safe layouts', () => {
  for (const filename of [resolve(root, 'DeviceSessionViewer.vue'), resolve(import.meta.dirname, 'RuntimeDeviceSessionPreview.vue')]) {
    const source = readFileSync(filename, 'utf8'), { descriptor, errors } = parse(source, { filename })
    assert.deepEqual(errors, []); assert.ok(compileScript(descriptor, { id: filename }).content)
    assert.deepEqual(compileTemplate({ id: filename, filename, source: descriptor.template.content }).errors, [])
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: filename, filename, source: style.content, scoped: style.scoped }).errors, [])
    assert.ok(source.split('\n').length < 300)
  }
  const source = readFileSync(resolve(root, 'DeviceSessionViewer.vue'), 'utf8')
  assert.match(source, /overflow-wrap:anywhere/); assert.match(source, /min-width:0/); assert.ok(!source.includes('localStorage')); assert.ok(!source.includes('fetch('))
  assert.ok(!source.includes('--ink-3')); assert.match(source, /\.device-session-facts dt[^}]*--ink-2/); assert.match(source, /\.device-session-facts dd[^}]*--ink-1/)
  assert.match(source, /\.device-session-connections \{[^}]*background:var\(--bg-sunken,var\(--ant-color-fill-alter,#f5f7fa\)\)/)
  assert.match(readFileSync(resolve(root, 'index.ts'), 'utf8'), /export const DeviceSessionViewer/)
  assert.match(readFileSync(resolve(root, '../index.ts'), 'utf8'), /export \{ DeviceSessionViewer \}/)
  assert.match(readFileSync(resolve(root, '../index.ts'), 'utf8'), /export type \{[^}]*DeviceSessionDeviceOption/)
})
