import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
let environment
let nextId = 0

class FakeResizeObserver {
  constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; environment.observers.push(this) }
  observe(target) { this.targets.push(target) }
  disconnect() { this.disconnected = true }
  emit() { if (!this.disconnected) this.callback(this.targets.map(target => ({ target })), this) }
}

const savedGlobals = { window: globalThis.window, document: globalThis.document, ResizeObserver: globalThis.ResizeObserver }
globalThis.document = { documentElement: { scrollHeight: 0, clientHeight: 0 } }
globalThis.ResizeObserver = FakeResizeObserver
globalThis.window = {
  document: globalThis.document,
  ResizeObserver: FakeResizeObserver,
  getComputedStyle: () => ({ marginBottom: '0px', paddingBottom: '0px', borderBottomWidth: '0px' }),
  setTimeout: callback => { const id = ++nextId; environment.timers.set(id, callback); return id },
  clearTimeout: id => environment.timers.delete(id),
  requestAnimationFrame: callback => { const id = ++nextId; environment.frames.set(id, callback); return id },
  cancelAnimationFrame: id => environment.frames.delete(id),
  addEventListener: (name, callback) => environment.listeners.set(name, callback),
  removeEventListener: (name, callback) => { if (environment.listeners.get(name) === callback) environment.listeners.delete(name) },
}
test.after(() => Object.assign(globalThis, savedGlobals))

const bundle = await build({
  stdin: {
    contents: "export { default as FullPage } from './FullPage.vue'; export { providePageChromeTarget } from './hooks/usePageChromeTarget.ts'",
    resolveDir: directory,
    loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', '@vueuse/core'],
  plugins: [{ name: 'compile-full-page', setup(builder) {
    builder.onLoad({ filter: /FullPage\.vue$/ }, ({ path }) => {
      const { descriptor, errors } = parse(readFileSync(path, 'utf8'), { filename: path })
      assert.deepEqual(errors, [])
      const script = compileScript(descriptor, { id: path, inlineTemplate: true })
      return { contents: "import { ref, computed, onMounted, onBeforeUnmount } from 'vue'\n" + script.content, loader: 'ts', resolveDir: directory }
    })
  }}],
})
const module = new Module(directory + 'full-page-test-fixture.cjs')
module.filename = directory + 'full-page-test-fixture.cjs'
module.paths = require.resolve.paths('vue')
module._compile(bundle.outputFiles[0].text, module.filename)
const { FullPage, providePageChromeTarget } = module.exports

function node(type, text = '') {
  return { type, text, props: {}, children: [], parentElement: null, getBoundingClientRect: () => ({ top: environment.top }) }
}
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parentElement) target.parentElement.children.splice(target.parentElement.children.indexOf(target), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
    target.parentElement = parent
  },
  remove(target) { if (target.parentElement) target.parentElement.children.splice(target.parentElement.children.indexOf(target), 1); target.parentElement = null },
  parentNode: target => target.parentElement, nextSibling: target => target.parentElement?.children[target.parentElement.children.indexOf(target) + 1] || null,
})

async function settleFrames() {
  for (let turn = 0; turn < 10; turn++) {
    await nextTick()
    if (!environment.frames.size) return
    const callbacks = [...environment.frames.values()]
    environment.frames.clear()
    callbacks.forEach(callback => callback())
  }
  assert.fail('page height updates did not settle')
}

async function mount(t, withChrome) {
  environment = { top: 120, timers: new Map(), frames: new Map(), listeners: new Map(), observers: [] }
  const chrome = ref({})
  const root = node('root')
  const app = renderer.createApp({
    setup() {
      if (withChrome) providePageChromeTarget(chrome)
      return () => h(FullPage, { fixed: false, padding: 0, margin: '0' })
    },
  })
  app.mount(root)
  let mounted = true
  t.after(() => { if (mounted) app.unmount() })
  await nextTick()
  for (const callback of environment.timers.values()) callback()
  environment.timers.clear()
  await settleFrames()
  return { element: root.children[0], unmount() { app.unmount(); mounted = false } }
}

test('面板外头部异步出现和消失时更新高度，卸载时停止监听', async t => {
  const { element, unmount } = await mount(t, true)
  assert.equal(element.props.style.minHeight, 'calc(100vh - 120px)')
  const observer = environment.observers.at(-1)
  assert.ok(observer)
  assert.equal(observer.targets.length, 1)

  environment.top = 165
  observer.emit()
  observer.emit()
  assert.equal(environment.frames.size, 1)
  await settleFrames()
  assert.equal(element.props.style.minHeight, 'calc(100vh - 165px)')

  environment.top = 120
  observer.emit()
  await settleFrames()
  assert.equal(element.props.style.minHeight, 'calc(100vh - 120px)')

  observer.emit()
  unmount()
  assert.equal(observer.disconnected, true)
  assert.equal(environment.frames.size, 0)
  assert.equal(environment.listeners.size, 0)
})

test('没有面板外头部时保留窗口缩放高度更新', async t => {
  const { element, unmount } = await mount(t, false)
  assert.equal(environment.observers.length, 0)
  assert.equal(element.props.style.minHeight, 'calc(100vh - 120px)')
  environment.top = 140
  environment.listeners.get('resize')()
  await settleFrames()
  assert.equal(element.props.style.minHeight, 'calc(100vh - 140px)')
  unmount()
  assert.equal(environment.listeners.size, 0)
})
