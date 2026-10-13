import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'

// Compile the actual SFC so replacing a widget's layout exercises its production watcher.
const filename = new URL('../src/components/DashBoardCanvas/components/WidgetRenderer.vue', import.meta.url).pathname
const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
const script = compileScript(descriptor, { id: 'widget-renderer-test', inlineTemplate: true })
const output = ts.transpileModule(script.content, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText
const exports = {}
new Function('exports', 'require', output)(exports, id => {
  if (id === 'vue') return vue
  if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
  if (id === 'ant-design-vue') return { Button: { render: () => null } }
  throw new Error(`Unexpected test dependency: ${id}`)
})

test('layout changes retain live widget state while identity or component changes remount it', async () => {
  let mounts = 0
  let disposals = 0
  const Widget = vue.markRaw({ setup() {
    mounts++
    vue.onScopeDispose(() => { disposals++ })
    return () => vue.h('div')
  } })
  const widget = vue.ref({ id: 'cpu', type: 'cpu', componentProps: { gridItem: { x: 0, y: 0, w: 6, h: 13 } } })
  const definition = vue.ref({ component: Widget, defaultConfig: { name: 'CPU' } })
  const renderer = vue.createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp({ setup: () => () => vue.h(exports.default, {
    widget: widget.value, definition: definition.value, previewMode: false,
  }) })
  app.mount({})
  try {
    widget.value = { ...widget.value, componentProps: { gridItem: { x: 6, y: 0, w: 4, h: 11 } } }
    await vue.nextTick()
    assert.equal(mounts, 1, 'dragging/resizing must preserve the mounted widget')
    assert.equal(disposals, 0)
    widget.value = { ...widget.value, id: 'replacement' }
    await vue.nextTick()
    assert.equal(mounts, 2)
    assert.equal(disposals, 1)
    definition.value = { ...definition.value, component: vue.markRaw({ ...Widget }) }
    await vue.nextTick()
    assert.equal(mounts, 3)
  } finally { app.unmount() }
  assert.equal(disposals, 3)
})
