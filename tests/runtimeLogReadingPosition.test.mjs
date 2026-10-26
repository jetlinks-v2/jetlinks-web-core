import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await vue.nextTick() }
function harness(t, values = {}) {
  const hooks = { activated: [], deactivated: [], beforeUpdate: [], unmounted: [] }, frames = new Map(), events = []
  let sequence = 0
  const previousFrame = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  t.after(() => { globalThis.requestAnimationFrame = previousFrame; globalThis.cancelAnimationFrame = previousCancel })
  const filename = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/LogViewer.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename }), compiled = compileScript(descriptor, { id: 'log-reading-position' })
  const { code } = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  const vueBindings = { ...vue, onActivated: callback => hooks.activated.push(callback), onDeactivated: callback => hooks.deactivated.push(callback), onBeforeUpdate: callback => hooks.beforeUpdate.push(callback), onBeforeUnmount: callback => hooks.unmounted.push(callback) }
  const retained = { exports: {} }, retainedCode = transformSync(readFileSync(resolve(import.meta.dirname, '../src/hooks/useRetainedScroll.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  const popupFocus = { exports: {} }, popupFocusCode = transformSync(readFileSync(resolve(dirname(filename), 'popupFocus.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', retainedCode)(() => vueBindings, retained, retained.exports)
  new Function('require', 'module', 'exports', popupFocusCode)(() => vueBindings, popupFocus, popupFocus.exports)
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vueBindings
    if (id === '../../hooks/useRetainedScroll') return retained.exports
    if (id === './popupFocus') return popupFocus.exports
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === 'ant-design-vue') return { Empty: {}, theme: { useToken: () => ({ token: vue.ref({}) }) } }
    if (id.startsWith('@ant-design/icons-vue') || id.endsWith('.vue')) return {}
    if (id === './logs/presentation') return { logPresentation: entry => entry, nextLogMatchId: () => '' }
    return require(id)
  }, module, module.exports)
  const props = vue.reactive({ active: true, entries: [{ id: 'row', text: 'line' }], files: [], fileId: 'a.log', filter: '', following: false, state: { status: 'ready' }, ...values })
  const scope = vue.effectScope(), view = scope.run(() => module.exports.default.setup(props, { expose() {}, emit: (...args) => events.push(args) }))
  const element = { isConnected: true, clientWidth: 500, clientHeight: 200, scrollHeight: 2000, scrollTop: 0, scrollLeft: 0 }
  view.scroller.value = element
  return { props, view, element, events, frames,
    lifecycle: name => hooks[name].forEach(callback => callback()),
    frame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) },
    stop: () => { hooks.unmounted.forEach(callback => callback()); scope.stop() },
  }
}

test('KeepAlive restores both reading axes after layout and ignores detached and pending-restoration zeroes', async t => {
  const h = harness(t)
  try {
    h.element.scrollTop = 490; h.element.scrollLeft = 110; h.view.onScroll()
    h.element.isConnected = false; h.element.clientWidth = 0; h.element.scrollTop = 0; h.element.scrollLeft = 0
    h.view.onScroll(); h.lifecycle('deactivated')
    h.element.isConnected = true; h.element.clientWidth = 500
    h.lifecycle('activated'); h.lifecycle('beforeUpdate'); h.view.onScroll()
    await flush(); assert.equal(h.frames.size, 1)
    h.lifecycle('beforeUpdate'); h.view.onScroll(); h.frame()
    assert.equal(h.element.scrollTop, 490); assert.equal(h.element.scrollLeft, 110)
    assert.deepEqual(h.events, [], 'restoration never starts following or emits a read action')
  } finally { h.stop() }
})

test('tool visibility preserves both axes, cancels obsolete frames and hidden updates never follow to bottom', async t => {
  const h = harness(t)
  try {
    h.element.scrollTop = 350; h.element.scrollLeft = 92; h.view.onScroll()
    h.props.active = false
    h.element.clientHeight = 0; h.element.scrollTop = 0; h.element.scrollLeft = 0; h.view.onScroll()
    h.props.following = true; h.props.entries = [{ id: 'hidden', text: 'new line' }]; await flush()
    assert.equal(h.element.scrollTop, 0)
    h.props.following = false; h.props.active = true; h.element.clientHeight = 200
    await flush(); assert.equal(h.frames.size, 1)
    h.props.active = false; assert.equal(h.frames.size, 0, 'hiding cancels the obsolete animation frame')
    h.props.active = true; await flush(); h.frame()
    assert.equal(h.element.scrollTop, 350); assert.equal(h.element.scrollLeft, 92)
    assert.deepEqual(h.events, [])
    h.props.fileId = 'b.log'; await flush()
    h.props.active = false; h.element.clientHeight = 0; h.element.scrollTop = 0; h.element.scrollLeft = 0
    h.props.active = true; h.element.clientHeight = 200; await flush(); h.frame()
    assert.equal(h.element.scrollTop, 0); assert.equal(h.element.scrollLeft, 0)
  } finally { h.stop() }
})

test('compact toolbar actions preserve the current window and pause following without discarding an open entry', async t => {
  const h = harness(t, { following: true, config: { level: 'all', wrap: false } })
  try {
    h.view.detailId.value = 'row'
    h.element.scrollTop = 300; h.element.scrollLeft = 180; h.view.reading.onScroll()
    h.view.setFilter('line')
    assert.deepEqual(h.events.splice(0), [['follow', false], ['filter', 'line']])
    h.props.following = false; h.props.filter = 'line'
    h.view.updateConfig({ wrap: true })
    assert.deepEqual(h.events.splice(0), [['update:config', { level: 'all', wrap: true }]])
    assert.equal(h.view.detailId.value, 'row', 'display options keep the original entry open')
    h.props.active = false
    h.element.clientHeight = 0; h.element.scrollTop = 0; h.element.scrollLeft = 0
    h.props.active = true; h.element.clientHeight = 420
    await flush(); h.frame()
    assert.equal(h.element.scrollTop, 300); assert.equal(h.element.scrollLeft, 180)
    h.view.resume()
    assert.deepEqual(h.events, [['follow', true]])
    assert.equal(h.element.scrollTop, 300, 'resume waits for the host to supply the latest window')
    assert.equal(h.view.detailId.value, '')
  } finally { h.stop() }
})

test('level selection closes its temporary menu and inactive readers close every popover', async t => {
  const h = harness(t, { config: { level: 'all', wrap: true } })
  try {
    h.view.levelMenuOpen.value = true; h.view.moreMenuOpen.value = true
    h.view.selectLevel({ key: 'ERROR' })
    assert.equal(h.view.levelMenuOpen.value, false)
    assert.deepEqual(h.events.splice(0), [['update:config', { level: 'ERROR', wrap: true }]])
    h.view.levelMenuOpen.value = true; h.view.moreMenuOpen.value = true; h.props.active = false
    await flush()
    assert.equal(h.view.levelMenuOpen.value, false); assert.equal(h.view.moreMenuOpen.value, false)
  } finally { h.stop() }
})

test('console auto-scroll can pause and resume without starting or stopping reception', async t => {
  const h = harness(t, { isConsole: true, fileId: 'console', following: false })
  try {
    h.element.scrollTop = 360
    h.view.resume()
    assert.equal(h.element.scrollTop, h.element.scrollHeight, 'console resumes at the already received latest entry')
    assert.deepEqual(h.events.splice(0), [['follow', true]])
    h.props.following = true; h.view.pause()
    assert.deepEqual(h.events, [['follow', false]])
  } finally { h.stop() }
})

test('scroll loading requires reading intent and prepending restores the same visible row offset', async t => {
  const h = harness(t, { hasPrevious: true, hasNext: true, loadingDirection: '' })
  try {
    await flush(); h.frame()
    h.element.scrollTop = 0; h.view.onScroll(); assert.deepEqual(h.events, [], 'layout or restore scroll cannot trigger I/O')
    h.view.readIntent(); h.view.onScroll(); assert.deepEqual(h.events.splice(0), [['previous']])
    h.view.onScroll(); assert.deepEqual(h.events, [], 'one reading intent dispatches at most one window request')
    h.props.loadingDirection = 'backward'; h.view.readIntent(); h.view.onScroll(); assert.deepEqual(h.events, [], 'in-flight window cannot duplicate')
    h.props.loadingDirection = ''; h.element.scrollTop = 1800
    h.view.readIntent(); h.view.onScroll(); assert.deepEqual(h.events.splice(0), [['next']])

    h.element.scrollTop = 200
    h.element.getBoundingClientRect = () => ({ top: 0 })
    let snapshots = 0
    h.element.querySelectorAll = () => [{ dataset: { logId: 'row' }, getBoundingClientRect: () => snapshots === 1 ? { top: -20, bottom: 10 } : { top: 280, bottom: 310 } }]
    const query = h.element.querySelectorAll
    h.element.querySelectorAll = () => { snapshots++; return query() }
    h.props.entries = [{ id: 'older', text: 'older line' }, { id: 'row', text: 'line' }]
    await flush()
    assert.equal(h.element.scrollTop, 500, '300px prepended content keeps the old row at its original -20px offset')
  } finally { h.stop() }
})

test('file download and selection methods enforce busy and refused states before emitting actions', async t => {
  const h = harness(t, { fileBusy: false, exportAccess: { allowed: true } })
  try {
    h.props.fileBusy = true; h.view.download(); h.view.selectFile('other.log')
    h.props.fileBusy = false; h.props.state = { status: 'forbidden' }; h.view.download(); h.view.selectFile('other.log')
    h.props.state = { status: 'loading' }; h.view.download()
    h.props.state = { status: 'ready' }; h.props.fileId = ''; h.view.download()
    h.props.fileId = 'a.log'; h.props.exportAccess = { allowed: false }; h.view.download()
    assert.deepEqual(h.events, [])
    h.props.exportAccess = { allowed: true }; h.view.download(); h.view.selectFile('other.log')
    assert.deepEqual(h.events, [['export'], ['file', 'other.log']])
  } finally { h.stop() }
})
