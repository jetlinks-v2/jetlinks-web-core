import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics'), file = resolve(root, 'JvmDiagnosticPanel.vue')
const dictionary = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/locales/lang/en.json'), 'utf8'))
const t = (key, values = {}) => (dictionary[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`)
const access = { threadDump: { allowed: true }, jfr: { allowed: true }, jfrView: { allowed: true }, jfrExport: { allowed: true }, heapDump: { allowed: true }, heapExport: { allowed: true } }
function component(inlineTemplate = true) {
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file }), code = compileScript(descriptor, { id: 'jvm-entry', inlineTemplate }).content, module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(code, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t }) }
    if (id === 'ant-design-vue') return { Empty: { PRESENTED_IMAGE_SIMPLE: {} } }
    if (id.startsWith('@ant-design/icons-vue')) return {
      MoreOutlined: vue.defineComponent({ setup: () => () => vue.h('span', { class: 'test-more-icon' }) }),
      PlayCircleOutlined: vue.defineComponent({ setup: () => () => vue.h('span', { class: 'test-play-icon' }) }),
    }
    if (id === './popupFocus') return { createVisiblePopupFocus: () => ({ focus() {}, cancel() {} }) }
    if (id.endsWith('.vue')) return { default: vue.defineComponent({ setup(_, { slots }) { return () => vue.h('div', slots.default?.()) } }) }
    return require(id)
  }, module, module.exports)
  return module.exports.default
}
async function html(extra = {}) {
  const app = vue.createSSRApp({ render: () => vue.h(component(), { nodeId: 'node', activeTab: 'performance', access, samplingState: { status: 'idle' }, ...extra }) })
  for (const name of ['a-tabs', 'a-tab-pane', 'a-popover', 'a-tooltip', 'a-badge', 'a-tag', 'a-result', 'a-empty', 'a-space', 'a-checkbox', 'a-alert']) app.component(name, { inheritAttrs: false, setup(_, { slots, attrs }) { return () => vue.h('div', attrs, Object.values(slots).flatMap(slot => slot?.() ?? [])) } })
  app.component('a-button', { inheritAttrs: false, setup(_, { slots, attrs }) { return () => vue.h('button', attrs, slots.default?.()) } })
  return renderToString(app)
}

test('idle has one central start and retains JFR capture without an empty HTML export', async () => {
  const value = await html()
  assert.equal((value.match(/<button\b[^>]*>(?:<span[^>]*><\/span>)?Start sampling<\/button>/g) ?? []).length, 1)
  assert.ok(value.includes(t('runtimeDiagnostics.jfrFile'))); assert.ok(!value.includes(t('runtimeDiagnostics.exportFlameHtml')))
  assert.ok(value.includes(`title="${t('runtimeDiagnostics.jvmMoreActions')}"`)); assert.ok(value.includes(`aria-label="${t('runtimeDiagnostics.jvmMoreActions')}"`))
  assert.ok(!value.includes(t('runtimeDiagnostics.samplingStatus.idle')))
})
test('starting avoids fake counts while real zero snapshots expose their received evidence', async () => {
  const waiting = await html({ elapsedSeconds: 12, samplingState: { status: 'starting', startedAt: 1 } })
  assert.ok(waiting.includes(t('runtimeDiagnostics.stopSampling'))); assert.ok(waiting.includes('00:12')); assert.ok(!waiting.includes(t('runtimeDiagnostics.samplingUpdates', { count: 0 })))
  const zero = await html({ elapsedSeconds: 12, snapshot: { flameGraph: [], objectAllocations: [] }, samplingState: { status: 'recording', startedAt: 1, updateCount: 2 } })
  assert.ok(zero.includes(t('runtimeDiagnostics.samplingUpdates', { count: 2 })))
})
test('server denial states never render a start action while error and stopped states retain restart semantics', async () => {
  for (const [status, reason] of [['forbidden', 'Server forbidden'], ['unsupported', 'Server unsupported']]) {
    const value = await html({ samplingState: { status, message: reason } })
    assert.ok(!value.includes(t('runtimeDiagnostics.startSampling')))
    assert.equal((value.match(new RegExp(reason, 'g')) ?? []).length, 1)
    assert.ok(value.includes(`${t(`runtimeDiagnostics.samplingStatus.${status}`)}: ${reason}`))
  }
  for (const status of ['error', 'stopped']) assert.ok((await html({ samplingState: { status } })).includes(t('runtimeDiagnostics.startSampling')))
})

test('production action gates reject denied access and allow idle JFR capture independently of sampling', () => {
  const props = vue.reactive({ nodeId: 'node', active: true, activeTab: 'performance', access: { ...access, jfr: { allowed: false }, jfrExport: { allowed: false } }, samplingState: { status: 'idle' } })
  const events = [], scope = vue.effectScope()
  const view = scope.run(() => component(false).setup(props, { emit: event => events.push(event), expose() {} }))
  try {
    view.start(); view.captureJfr()
    assert.deepEqual(events, [])
    props.access = access
    view.captureJfr()
    assert.deepEqual(events, ['capture-jfr'])
    props.samplingState = { status: 'forbidden' }
    view.start()
    assert.deepEqual(events, ['capture-jfr'])
  } finally { scope.stop() }
})

test('two analysis pages keep collection explicit and map legacy modes without extra samples', () => {
  const props = vue.reactive({ nodeId: 'node', active: true, activeTab: 'performance', access, threadState: { status: 'ready' }, samplingState: { status: 'idle' } })
  const events = [], scope = vue.effectScope()
  const view = scope.run(() => component(false).setup(props, { emit: (...args) => events.push(args), expose() {} }))
  try {
    assert.equal(view.active.value, 'performance')
    view.changeTab('snapshots')
    assert.deepEqual(events, [['update:activeTab', 'snapshots']], 'navigation does not capture threads or heap')
    props.activeTab = 'snapshots'
    assert.equal(view.active.value, 'snapshots')
    view.sampleThreads(); view.heapDump()
    assert.deepEqual(events.slice(1), [['sample'], ['heap-dump', { live: false }]])
    events.length = 0; props.activeTab = 'performance'; view.start()
    assert.deepEqual(events, [['start']], 'live collection never takes an implicit thread snapshot')
    props.activeTab = 'memory'; assert.equal(view.active.value, 'performance')
    props.activeTab = 'threads'; assert.equal(view.active.value, 'snapshots')
    props.active = false; view.sampleThreads(); view.heapDump(); view.start()
    assert.deepEqual(events, [['start']], 'inactive readers cannot invoke operations')
  } finally { scope.stop() }
})

test('thread-only users enter snapshots; allocation-only JFR results remain available', () => {
  const props = vue.reactive({ nodeId: 'node', active: true, access: { ...access, jfrView: { allowed: false } }, samplingState: { status: 'idle' } })
  const scope = vue.effectScope(), view = scope.run(() => component(false).setup(props, { emit() {}, expose() {} }))
  try {
    assert.equal(view.active.value, 'snapshots')
    props.access = access
    props.snapshot = { flameGraph: [], objectAllocations: [{ className: 'example.Payload', allocationSize: 2048 }] }
    assert.equal(view.hasAllocations.value, true); assert.equal(view.hasDisplaySamples.value, false)
  } finally { scope.stop() }
})
