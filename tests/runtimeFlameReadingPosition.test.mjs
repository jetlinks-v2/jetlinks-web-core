import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const component = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics')
const runtimeModule = { exports: {} }
new Function('require', 'module', 'exports', transformSync(readFileSync(resolve(component, 'flameGraph.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(require, runtimeModule, runtimeModule.exports)
const runtime = runtimeModule.exports
const runtimeCache = new Map([[resolve(component, 'flameGraph.ts'), runtime]])
function load(filename) {
  if (runtimeCache.has(filename)) return runtimeCache.get(filename)
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
  runtimeCache.set(filename, module.exports); return module.exports
}
const flush = async () => { await vue.nextTick(); await vue.nextTick() }
function snapshot(depth = 64, startedAt = 1) {
  let root = { className: 'io.rsocket.core.Connection', samples: 10, children: [] }
  for (let index = 1; index < depth; index++) root = { className: `stack.Frame${index}`, samples: 10, children: [root] }
  return { flameGraph: [root], objectAllocations: [], startedAt }
}
function harness(t, initial = snapshot()) {
  const hooks = { activated: [], deactivated: [] }, observers = [], events = []
  const previousObserver = globalThis.ResizeObserver
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; observers.push(this) } observe() {} disconnect() { this.disconnected = true } }
  t.after(() => { globalThis.ResizeObserver = previousObserver })
  const vueBindings = { ...vue, onActivated: callback => hooks.activated.push(callback), onDeactivated: callback => hooks.deactivated.push(callback) }
  const filename = resolve(component, 'FlameGraphViewer.vue'), module = { exports: {} }
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const script = compileScript(descriptor, { id: 'flame-reading-position' })
  new Function('require', 'module', 'exports', transformSync(script.content, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vueBindings
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === './flameGraph') return runtime
    if (id.endsWith('.vue')) return { default: {} }
    if (id.startsWith('./flame/')) return load(resolve(component, `${id}.ts`))
    return require(id)
  }, module, module.exports)
  const props = vue.reactive({ snapshot: initial, platformPrefixes: ['org.jetlinks.'] }), scope = vue.effectScope()
  const view = scope.run(() => module.exports.default.setup(props, { expose() {}, emit: (...args) => events.push(args) }))
  const canvas = vue.reactive({ isConnected: true, clientWidth: 624, clientHeight: 480, scrollHeight: initial ? Math.max(60, runtime.buildFlameLayout(initial.flameGraph).depth * 27) : 0, scrollTop: 0, scrollLeft: 0 })
  view.canvas.value = canvas
  // Simulate DOM patch after pre-flush watchers; measurements come from the production layout.
  scope.run(() => vue.watch(() => view.svg.value, () => { canvas.scrollHeight = Math.max(60, view.layout.value.depth * 27) }, { flush: 'post' }))
  return { props, view, canvas, observers,
    lifecycle: name => hooks[name].forEach(callback => callback()),
    stop: () => scope.stop(),
  }
}

test('production viewer opens a deep first result at the root and retains relative depth during streaming', async t => {
  const h = harness(t)
  try {
    await flush()
    assert.equal(h.canvas.scrollTop, 1248, 'the 64-level root is in the first viewport')
    assert.match(h.view.svg.value, /viewBox="0 0 720 1728"/)
    h.canvas.scrollTop -= 180; h.canvas.scrollLeft = 72; h.view.rememberViewport()
    h.props.snapshot = snapshot(80)
    await flush()
    assert.equal(h.canvas.scrollTop, 2160 - 480 - 180)
    assert.equal(h.canvas.scrollLeft, 72)
    h.canvas.clientWidth = 980; h.observers.at(-1).callback(); await flush()
    assert.match(h.view.svg.value, /viewBox="0 0 980 2160"/)
    assert.equal(h.canvas.scrollTop, 1500, 'resizing changes only the horizontal layout, not stack layer height or reading depth')
    h.view.search.value = 'Connection'; h.view.category.value = 'network'; await flush()
    assert.equal(h.canvas.scrollTop, 1500, 'search and category change preserve the reader location')
    assert.equal(h.canvas.scrollLeft, 72)
  } finally { h.stop() }
})

test('focus, reset, a new session on the same object, and the first nonempty result locate their own root', async t => {
  const h = harness(t)
  try {
    await flush()
    h.canvas.scrollTop = 700; h.canvas.scrollLeft = 90; h.view.rememberViewport()
    h.view.focus.value = h.view.layout.value.cells[60].key; await flush()
    assert.equal(h.view.layout.value.depth, 4); assert.equal(h.canvas.scrollTop, 0); assert.equal(h.canvas.scrollLeft, 0)
    h.view.focus.value = undefined; await flush()
    assert.equal(h.canvas.scrollTop, 1248)
    h.canvas.scrollTop = 600; h.canvas.scrollLeft = 40; h.view.rememberViewport()
    h.props.snapshot.startedAt = 2; await flush()
    assert.equal(h.canvas.scrollTop, 1248); assert.equal(h.canvas.scrollLeft, 0)
    h.props.snapshot = { startedAt: 3, flameGraph: [], objectAllocations: [] }; await flush()
    h.props.snapshot = snapshot(50, 3); await flush()
    assert.equal(h.canvas.scrollTop, 1350 - 480)
    h.props.snapshot = snapshot(2, 4); await flush()
    assert.equal(h.canvas.scrollTop, 0, 'shallow graphs remain fully visible')
  } finally { h.stop() }
})

test('hidden layout and KeepAlive preserve both axes without accepting hidden zeroes or stale restores', async t => {
  const h = harness(t)
  try {
    await flush()
    h.canvas.scrollTop = 900; h.canvas.scrollLeft = 83; h.view.rememberViewport()
    h.lifecycle('deactivated')
    h.canvas.clientWidth = 0; h.canvas.scrollTop = 0; h.canvas.scrollLeft = 0; h.view.rememberViewport()
    h.lifecycle('activated'); await flush()
    assert.equal(h.canvas.scrollTop, 0, 'hidden content waits for effective layout')
    h.canvas.clientWidth = 624; h.observers.at(-1).callback(); await flush()
    assert.equal(h.canvas.scrollTop, 900); assert.equal(h.canvas.scrollLeft, 83)
    h.canvas.clientHeight = 0; h.canvas.scrollTop = 0; h.view.rememberViewport()
    h.canvas.clientHeight = 480; h.observers.at(-1).callback(); await flush()
    assert.equal(h.canvas.scrollTop, 900, 'v-show restoration does not need a KeepAlive event')
    h.props.snapshot = snapshot(80, 2); h.stop(); await flush()
    assert.ok(h.observers.every(observer => observer.disconnected))
    assert.equal(h.canvas.scrollTop, 900, 'disposed pending work cannot reposition the canvas')
  } finally { h.stop() }
})
