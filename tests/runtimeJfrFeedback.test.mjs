import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics')
const dictionaries = ['zh', 'en'].map(lang => JSON.parse(readFileSync(resolve(root, `../../locales/lang/${lang}.json`), 'utf8')))
const cache = new Map(), translate = (key, values = {}) => (dictionaries[0][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`)
function load(filename, inline = false) {
  const key = `${filename}:${inline}`
  if (cache.has(key)) return cache.get(key)
  const source = readFileSync(filename, 'utf8'), text = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'jfr-feedback', inlineTemplate: inline }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(text, { loader: 'ts', format: 'cjs', target: 'es2020' }).code)(id => {
    if (id === 'vue') return { ...vue, defineAsyncComponent: factory => factory.toString().includes('FlameGraphViewer') ? load(resolve(root, 'FlameGraphViewer.vue'), true).default : vue.defineComponent({ render: () => vue.h('span') }) }
    if (id === 'vue-i18n') return { useI18n: () => ({ t: translate }) }
    if (id.startsWith('.')) { const file = resolve(dirname(filename), id); return load(existsSync(file) ? file : `${file}.ts`, inline) }
    return require(id)
  }, module, module.exports)
  cache.set(key, module.exports); return module.exports
}
const permission = { allowed: true }, access = { threadDump: permission, jfr: permission, jfrView: permission, jfrExport: permission, heapDump: permission, heapExport: permission }
const defaults = { nodeId: 'node:8200', active: true, activeTab: 'performance', access, elapsedSeconds: 0, samplingState: { status: 'idle' } }
const wrap = tag => vue.defineComponent({ setup: (_, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
function configure(app) {
  for (const name of ['a-tabs', 'a-tab-pane', 'a-space', 'a-tag', 'a-tooltip', 'a-table', 'a-checkable-tag', 'a-typography-text']) app.component(name, wrap('span'))
  app.component('a-tabs', { setup: (_, { attrs, slots }) => () => vue.h('div', attrs, [slots.default?.(), slots.rightExtra?.()]) })
  for (const name of ['a-button', 'a-input-search', 'a-checkbox']) app.component(name, wrap('button'))
  app.component('a-empty', { props: ['description'], setup: props => () => vue.h('p', { class: 'test-empty' }, props.description) })
  app.component('a-badge', { props: ['status', 'text'], setup: props => () => vue.h('span', { 'data-badge-status': props.status }, props.text) })
  app.component('a-popover', { setup: (_, { slots }) => () => vue.h('aside', [slots.default?.(), slots.content?.()]) })
  app.component('a-alert', { props: ['message'], setup: props => () => vue.h('p', props.message) })
  app.component('a-result', { props: ['title'], setup: props => () => vue.h('p', props.title) })
  return app
}
const render = async props => renderToString(configure(vue.createSSRApp({ render: () => vue.h(load(resolve(root, 'JvmDiagnosticPanel.vue'), true).default, { ...defaults, ...props }) })))
const snapshot = samples => ({ startedAt: 1000, sampledAt: 2000, flameGraph: samples ? [{ className: 'org.jetlinks.Example', samples, children: [] }] : [], objectAllocations: [] })

test('production JFR panel has state-specific empty feedback and real update/sample counts', async () => {
  const idle = await render({})
  assert.ok(idle.includes(dictionaries[0]['runtimeDiagnostics.noFlameSamples']))
  const waiting = await render({ samplingState: { status: 'starting', startedAt: 1000, updateCount: 0 }, streamPhase: 'waiting' })
  assert.ok(waiting.includes(dictionaries[0]['runtimeDiagnostics.samplingEmptyWaiting']))
  assert.match(waiting, /data-badge-status="processing"/)
  assert.ok(!waiting.includes(dictionaries[0]['runtimeDiagnostics.noFlameSamples']))
  const empty = await render({ snapshot: snapshot(0), elapsedSeconds: 39, samplingState: { status: 'recording', startedAt: 1000, sampledAt: 2000, updateCount: 39 } })
  assert.ok(empty.includes(translate('runtimeDiagnostics.samplingUpdates', { count: '39' })))
  assert.ok(empty.includes(translate('runtimeDiagnostics.samplingExecutionSamples', { count: '0' })))
  assert.ok(empty.includes(dictionaries[0]['runtimeDiagnostics.samplingEmptyActive']))
  assert.ok(!empty.includes(dictionaries[0]['runtimeDiagnostics.noFlameSamples']))
  assert.ok(!empty.includes(dictionaries[0]['runtimeDiagnostics.samplingCountHint']), 'empty content keeps one concise state explanation instead of flame-specific helper copy')
  const populated = await render({ snapshot: snapshot(2), samplingState: { status: 'recording', startedAt: 1000, sampledAt: 2000, updateCount: 39 } })
  assert.ok(populated.includes(translate('runtimeDiagnostics.samplingUpdates', { count: '39' })))
  assert.ok(populated.includes(translate('runtimeDiagnostics.samplingExecutionSamples', { count: '2' })))
  const stopped = await render({ snapshot: snapshot(0), samplingState: { status: 'stopped', startedAt: 1000, updateCount: 3 } })
  assert.ok(stopped.includes(dictionaries[0]['runtimeDiagnostics.samplingEmptyStopped']))
  assert.ok(!stopped.includes('data-badge-status="processing"'))
  const failed = await render({ samplingState: { status: 'error', startedAt: 1000, message: 'Transport closed' } })
  assert.ok(failed.includes('Transport closed')); assert.ok(failed.includes(dictionaries[0]['runtimeDiagnostics.samplingEmptyUnavailable']))
})

test('delayed first frame and delayed updates remain actionable while retaining real results', async () => {
  for (const [delay, seconds, state] of [['first-frame', 15, { status: 'starting', updateCount: 0 }], ['updates', 5, { status: 'recording', updateCount: 12, sampledAt: 2000 }]]) {
    const html = await render({ snapshot: delay === 'updates' ? snapshot(2) : undefined, samplingState: { ...state, startedAt: 1000, delay, quietSeconds: seconds } })
    if (delay === 'first-frame') assert.match(html, /data-badge-status="warning"/)
    assert.ok(html.includes(translate(delay === 'first-frame' ? 'runtimeDiagnostics.samplingFirstFrameDelayHint' : 'runtimeDiagnostics.samplingUpdatesDelayHint', { seconds })))
    assert.ok(html.includes(dictionaries[0]['runtimeDiagnostics.samplingReconnect']))
    if (delay === 'first-frame') assert.ok(html.includes(dictionaries[0]['runtimeDiagnostics.stopSampling']))
    if (delay === 'updates') assert.ok(html.includes(translate('runtimeDiagnostics.samplingExecutionSamples', { count: '2' })))
  }
})

test('reconnect emits this observer stop then start and checks the same action permissions', () => {
  const props = vue.reactive({ ...defaults, samplingState: { status: 'recording', startedAt: 1000, updateCount: 4, delay: 'updates' } }), events = [], scope = vue.effectScope()
  const view = scope.run(() => load(resolve(root, 'JvmDiagnosticPanel.vue')).default.setup(props, { expose() {}, emit: event => events.push(event) }))
  try {
    view.retry(); assert.deepEqual(events, ['stop', 'start'])
    props.access = { ...access, jfr: { allowed: false } }; view.retry(); assert.deepEqual(events, ['stop', 'start'])
    props.access = access; props.samplingState = { ...props.samplingState, delay: undefined }; view.retry(); assert.deepEqual(events, ['stop', 'start'])
  } finally { scope.stop() }
})

test('generic flame viewer retains its standalone empty fallback and accepts a caller-owned empty slot', async () => {
  const component = load(resolve(root, 'FlameGraphViewer.vue'), true).default
  const fallback = await renderToString(configure(vue.createSSRApp({ render: () => vue.h(component) })))
  assert.ok(fallback.includes(dictionaries[0]['runtimeDiagnostics.noFlameSamples']))
  const custom = await renderToString(configure(vue.createSSRApp({ render: () => vue.h(component, {}, { empty: () => vue.h('p', 'caller empty feedback') }) })))
  assert.ok(custom.includes('caller empty feedback')); assert.ok(!custom.includes(dictionaries[0]['runtimeDiagnostics.noFlameSamples']))
})

function mountedPanel(props) {
  const node = (tag, text = '') => ({ tag, text, style: {}, props: {}, children: [], isConnected: true, clientWidth: 720, clientHeight: 480, scrollHeight: 720, scrollTop: 0, scrollLeft: 0 })
  const renderer = vue.createRenderer({
    createElement: tag => node(tag), createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
    patchProp: (target, key, _, value) => { target.props[key] = value }, parentNode: target => target.parent,
    nextSibling: target => { const siblings = target.parent?.children ?? []; return siblings[siblings.indexOf(target) + 1] },
    insert: (target, parent, anchor) => { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, target); target.parent = parent },
    remove: target => { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1) },
  })
  const container = node('root'), app = configure(renderer.createApp({ render: () => vue.h(load(resolve(root, 'JvmDiagnosticPanel.vue'), true).default, props) }))
  app.mount(container)
  const collect = target => [target, ...target.children.flatMap(collect)]
  const text = target => target.text + target.children.map(text).join('')
  return { app, search: () => collect(container).find(target => target.props.placeholder === dictionaries[0]['runtimeDiagnostics.flameSearch']),
    group: key => collect(container).find(target => target.props.onChange && text(target) === dictionaries[0][`runtimeDiagnostics.flameCategory.${key}`]),
  }
}

test('mounted JVM subpages retain flame reading state and release it on node changes or revoked view access', async () => {
  const props = vue.reactive({ ...defaults, snapshot: snapshot(10) }), h = mountedPanel(props)
  const flush = async () => { await vue.nextTick(); await vue.nextTick() }
  try {
    await flush()
    h.search().props['onUpdate:value']('org.jetlinks'); h.group('platform').props.onChange(true); await flush()
    const searchHandler = h.search().props['onUpdate:value']
    props.activeTab = 'snapshots'; await flush(); assert.equal(h.search(), undefined)
    props.activeTab = 'threads'; await flush(); assert.equal(h.search(), undefined)
    props.activeTab = 'performance'; await flush()
    assert.equal(h.search().props.value, 'org.jetlinks'); assert.equal(h.group('platform').props.checked, true)
    assert.equal(h.search().props['onUpdate:value'], searchHandler, 'returning reuses the original reader instance')
    props.nodeId = 'other:8200'; await flush()
    assert.equal(h.search().props.value, ''); assert.equal(h.group('all').props.checked, true)
    h.search().props['onUpdate:value']('new node'); await flush()
    props.access = { ...access, jfrView: { allowed: false } }; await flush(); assert.equal(h.search(), undefined)
    props.access = access; await flush()
    assert.equal(h.search().props.value, ''); assert.equal(h.group('all').props.checked, true)
  } finally { h.app.unmount() }
})

test('feedback labels are bilingual and changed production component styles compile', () => {
  const keys = ['samplingUpdates', 'samplingExecutionSamples', 'samplingFirstFrameDelayed', 'samplingUpdatesDelayed', 'samplingFirstFrameDelayHint', 'samplingUpdatesDelayHint', 'samplingReconnect', 'samplingEmptyActive', 'samplingEmptyWaiting', 'samplingEmptyStopped', 'samplingEmptyUnavailable', 'samplingCountHint']
  for (const dictionary of dictionaries) for (const key of keys) assert.ok(dictionary[`runtimeDiagnostics.${key}`], key)
  for (const name of ['JvmDiagnosticPanel.vue', 'FlameGraphViewer.vue']) {
    const filename = resolve(root, name), { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: 'jfr-feedback', source: style.content, filename, scoped: style.scoped }).errors, [])
  }
})
