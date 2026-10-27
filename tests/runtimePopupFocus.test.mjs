import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'

const filename = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/popupFocus.ts')
const module = { exports: {} }
new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(() => {}, module, module.exports)
const { createVisiblePopupFocus } = module.exports

function harness(t) {
  const original = { document: globalThis.document, ResizeObserver: globalThis.ResizeObserver, MutationObserver: globalThis.MutationObserver }
  const resize = [], mutation = []
  globalThis.document = { body: {} }
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; resize.push(this) } observe() {} disconnect() { this.disconnected = true } }
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; mutation.push(this) } observe() {} disconnect() { this.disconnected = true } }
  t.after(() => Object.assign(globalThis, original))
  const target = { isConnected: true, offsetWidth: 0, getBoundingClientRect: () => ({ height: 0 }), focused: 0, focus() { this.focused++ } }
  const popup = { querySelector: () => target }
  return { resize, mutation, target, popup }
}

test('visible popup focus waits for layout once and releases observers', t => {
  const h = harness(t), focus = createVisiblePopupFocus()
  focus.focus({ getPopup: () => h.popup, getTarget: () => h.target })
  assert.equal(h.target.focused, 0); assert.equal(h.resize.length, 1)
  h.target.offsetWidth = 24; h.resize[0].callback()
  assert.equal(h.target.focused, 1); assert.equal(h.resize[0].disconnected, true)
  h.resize[0].callback()
  assert.equal(h.target.focused, 1, 'a released observer cannot focus twice')
})

test('popup focus cancellation and inactive targets never steal focus', t => {
  const h = harness(t), focus = createVisiblePopupFocus()
  focus.focus({ getPopup: () => h.popup, getTarget: () => h.target })
  focus.cancel(); h.target.offsetWidth = 24; h.resize[0].callback()
  assert.equal(h.target.focused, 0); assert.equal(h.resize[0].disconnected, true)
  h.target.offsetWidth = 0
  focus.focus({ getPopup: () => h.popup, getTarget: () => h.target, isActive: () => false })
  assert.equal(h.target.focused, 0, 'inactive node/tool does not acquire popup focus')
  assert.ok(h.resize.every(observer => observer.disconnected), 'node change or close leaves no observer behind')
})
