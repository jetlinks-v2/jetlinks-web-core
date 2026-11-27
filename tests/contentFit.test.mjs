import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import * as vue from 'vue'

test('text fitting keeps a readable floor, reports intrinsic width, recovers after content changes and releases observers', async t => {
  const keys = ['ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'document']
  const previous = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  t.after(() => keys.forEach((key, index) => previous[index]
    ? Object.defineProperty(globalThis, key, previous[index]) : delete globalThis[key]))
  const mounted = [], unmounted = [], frames = new Map(), listeners = new Map()
  let nextFrame = 0, observer, api, width = 160, textWidth = 180
  class Observer {
    elements = new Set()
    constructor(callback) { this.callback = callback; observer = this }
    observe(element) { this.elements.add(element) }
    disconnect() { this.elements.clear() }
  }
  Object.defineProperties(globalThis, {
    ResizeObserver: { configurable: true, value: Observer },
    requestAnimationFrame: { configurable: true, value: callback => { frames.set(++nextFrame, callback); return nextFrame } },
    cancelAnimationFrame: { configurable: true, value: id => frames.delete(id) },
    getComputedStyle: { configurable: true, value: () => ({ paddingLeft: '0px', paddingRight: '0px', fontSize: `${api.fontSize.value}px` }) },
    document: { configurable: true, value: { fonts: {
      ready: Promise.resolve(), addEventListener: (event, callback) => listeners.set(event, callback),
      removeEventListener: event => listeners.delete(event),
    } } },
  })
  const require = createRequire(import.meta.url)
  const source = buildSync({ entryPoints: [resolve(import.meta.dirname, '../src/hooks/useContentFit.ts')], bundle: true,
    platform: 'node', format: 'cjs', external: ['vue'], write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('require', 'module', 'exports', source)(id => id === 'vue'
    ? { ...vue, onMounted: callback => mounted.push(callback), onBeforeUnmount: callback => unmounted.push(callback) }
    : require(id), module, module.exports)
  const viewport = { get clientWidth() { return width } }
  const content = { get scrollWidth() { return textWidth * api.fontSize.value / 14 },
    get offsetWidth() { return this.scrollWidth } }
  const scope = vue.effectScope()
  t.after(() => scope.stop())
  scope.run(() => { api = module.exports.useContentFit({ viewport: vue.ref(viewport), content: vue.ref(content), minSize: 12, maxSize: 14 }) })
  scope.run(() => mounted.forEach(callback => callback()))
  await Promise.resolve()
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()) }
  flush()
  assert.equal(api.fontSize.value, 12.3)
  assert.equal(api.overflowing.value, false)
  assert.equal(api.preferredWidth.value, 182)
  width = 80; observer.callback(); observer.callback()
  assert.equal(frames.size, 1, 'resize events share one layout frame')
  flush()
  assert.equal(api.fontSize.value, 12)
  assert.equal(api.overflowing.value, true)
  textWidth = 40; api.refresh(); flush()
  assert.equal(api.fontSize.value, 14)
  assert.equal(api.overflowing.value, false)
  width = 220; textWidth = 200; listeners.get('loadingdone')(); flush()
  assert.equal(api.preferredWidth.value, 202)
  assert.equal(api.fontSize.value, 14)
  api.refresh(); unmounted.forEach(callback => callback())
  assert.equal(observer.elements.size, 0)
  assert.equal(listeners.size, 0)
  assert.equal(frames.size, 0)
})
