import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { computed, createRenderer, defineComponent, h, nextTick, reactive, shallowRef } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { Tree } from 'ant-design-vue'

const require = createRequire(import.meta.url)
const directory = resolve(import.meta.dirname, '../src/components/AutoTree')
const evaluate = (source, dependencies = {}) => {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(
    id => dependencies[id] ?? require(id), module, module.exports,
  )
  return module.exports
}
const hook = evaluate(readFileSync(resolve(directory, 'useAutoTree.ts'), 'utf8'))
const { descriptor } = parse(readFileSync(resolve(directory, 'index.vue'), 'utf8'))
const script = compileScript(descriptor, { id: 'auto-tree-contract', inlineTemplate: true })

globalThis.requestAnimationFrame ??= callback => setTimeout(callback, 0)
globalThis.cancelAnimationFrame ??= timer => clearTimeout(timer)

/** 使用原 Tree 的属性定义，仅以可观测组件代替 DOM 渲染，检查包装边界是否丢失绑定。 */
function mountTree(bindings = {}, slots = {}) {
  let inner
  const calls = []
  const original = defineComponent({
    props: Tree.props,
    inheritAttrs: false,
    setup(props, context) {
      inner = { props, ...context }
      context.expose({
        treeRef: shallowRef('original-tree-ref'),
        selectedKeys: computed(() => props.selectedKeys),
        expandedKeys: computed(() => props.expandedKeys),
        scrollTo: value => calls.push(value),
      })
      return () => h('tree-root', context.attrs, Object.values(context.slots).flatMap(slot => slot?.({ key: 'slot-node', title: 'Original scope' }) ?? []))
    },
  })
  const AutoTree = evaluate(script.content, {
    'ant-design-vue': { Tree: original },
    './useAutoTree': hook,
  }).default
  const node = type => ({ type, children: [], parent: null, props: {}, text: '' })
  const renderer = createRenderer({
    createElement: node, createText: text => ({ ...node('#text'), text }), createComment: node,
    setText: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.text = text; target.children = [] },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
    patchProp: (target, key, _previous, value) => { target.props[key] = value },
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
      target.parent = parent
    },
    remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
  })
  const state = reactive(bindings)
  const instance = shallowRef()
  const app = renderer.createApp({ setup: () => () => h(AutoTree, { ...state, ref: instance }, slots) })
  const container = node('root')
  app.mount(container)
  return { app, AutoTree, container, state, instance, calls, get inner() { return inner } }
}

test('runtime props reuse every original definition and preserve omitted controlled values', t => {
  const view = mountTree()
  t.after(() => view.app.unmount())
  assert.equal(view.AutoTree.props, Tree.props)
  assert.ok(Object.keys(Tree.props).length > 50)
  assert.equal(view.inner.props.height, 1)
  for (const key of ['expandedKeys', 'selectedKeys', 'checkedKeys', 'loadedKeys', 'virtual']) {
    assert.equal(view.inner.props[key], undefined, key)
  }
  assert.equal(view.inner.props.selectable, true)
  assert.equal(view.inner.props.checkable, false)
  assert.equal(view.container.children[0].type, 'tree-root', 'no extra DOM wrapper')
})

test('every declared event and future event receives its original arguments exactly once', t => {
  const received = []
  const keys = Object.keys(Tree.props).filter(key => /^on[A-Z]/.test(key))
  const callbacks = Object.fromEntries(keys.map(key => [key, (...args) => received.push([key, ...args])]))
  callbacks.onFutureTreeEvent = (...args) => received.push(['onFutureTreeEvent', ...args])
  const view = mountTree(callbacks)
  t.after(() => view.app.unmount())
  const value = ['node-key']
  const info = { node: { key: 'node-key' }, nativeEvent: { type: 'test' } }
  for (const key of [...keys, 'onFutureTreeEvent']) {
    const name = key[2].toLowerCase() + key.slice(3)
    view.inner.emit(name, value, info)
    assert.equal(received.length, 1, key)
    assert.equal(received[0][0], key)
    assert.equal(received[0][1], value)
    assert.equal(received[0][2], info)
    received.length = 0
  }
})

test('v-model and explicit height / virtual update without replacing the instance', async t => {
  const view = mountTree({ height: 250, virtual: false, expandedKeys: ['root'], selectedKeys: ['old'], checkedKeys: [] })
  t.after(() => view.app.unmount())
  view.state['onUpdate:selectedKeys'] = keys => { view.state.selectedKeys = keys }
  view.state['onUpdate:checkedKeys'] = keys => { view.state.checkedKeys = keys }
  view.state['onUpdate:expandedKeys'] = keys => { view.state.expandedKeys = keys }
  await nextTick()
  const instance = view.instance.value
  view.inner.emit('update:selectedKeys', ['selected'])
  view.inner.emit('update:checkedKeys', { checked: ['checked'], halfChecked: ['root'] })
  view.inner.emit('update:expandedKeys', ['root', 'child'])
  view.state.height = 0
  view.state.virtual = true
  await nextTick()
  assert.deepEqual(view.inner.props.selectedKeys, ['selected'])
  assert.deepEqual(view.inner.props.checkedKeys, { checked: ['checked'], halfChecked: ['root'] })
  assert.deepEqual(view.inner.props.expandedKeys, ['root', 'child'])
  assert.equal(view.inner.props.height, 0)
  assert.equal(view.inner.props.virtual, true)
  assert.equal(view.instance.value, instance)
  instance.scrollTo({ key: 'selected', align: 'top' })
  assert.deepEqual(view.calls, [{ key: 'selected', align: 'top' }])
  assert.equal(instance.treeRef, 'original-tree-ref')
  assert.deepEqual(instance.selectedKeys, ['selected'])
  assert.deepEqual(instance.expandedKeys, ['root', 'child'])
})

test('all named slots, DOM attributes, callback props and custom data fields pass through', t => {
  const rendered = []
  const names = ['default', 'title', 'titleRender', 'icon', 'switcherIcon', 'leafIcon']
  const slots = Object.fromEntries(names.map(name => [name, scope => { rendered.push([name, scope]); return h('slot-' + name) }]))
  const fieldNames = { key: 'id', title: 'label', children: 'nodes' }
  const treeData = [{ id: 'root', label: 'Root', nodes: [] }]
  const loadData = async () => {}
  const filterTreeNode = () => true
  const view = mountTree({
    id: 'tree-id', class: 'existing-tree', style: { color: 'red' }, 'aria-label': 'Original tree', 'data-test': 'tree',
    fieldNames, treeData, loadData, filterTreeNode, checkable: true, checkStrictly: true, draggable: true, multiple: true,
  }, slots)
  t.after(() => view.app.unmount())
  assert.deepEqual(rendered.map(([name]) => name).sort(), names.sort())
  for (const [, scope] of rendered) assert.deepEqual(scope, { key: 'slot-node', title: 'Original scope' })
  for (const key of ['id', 'class', 'aria-label', 'data-test']) assert.equal(view.inner.attrs[key], view.state[key], key)
  assert.deepEqual(view.inner.attrs.style, { color: 'red' })
  assert.deepEqual(view.inner.props.fieldNames, fieldNames)
  assert.deepEqual(view.inner.props.treeData, treeData)
  assert.equal(view.inner.props.loadData, loadData)
  assert.equal(view.inner.props.filterTreeNode, filterTreeNode)
  for (const key of ['checkable', 'checkStrictly', 'draggable', 'multiple']) assert.equal(view.inner.props[key], true, key)
})
