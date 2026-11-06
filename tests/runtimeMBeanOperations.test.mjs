import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { Form } from 'ant-design-vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics')
const cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  let source = readFileSync(filename, 'utf8')
  if (filename.endsWith('.vue')) source = compileScript(parse(source, { filename }).descriptor, { id: filename, inlineTemplate: true }).content
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.startsWith('.')) {
      const path = resolve(dirname(filename), id)
      return load(path.endsWith('.vue') ? path : path + '.ts')
    }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const Operations = load(resolve(root, 'mbean/MBeanOperations.vue')).default
const flush = async () => { await vue.nextTick(); await vue.nextTick() }

function harness(t, parameters = []) {
  const signature = parameters.map(item => item.type)
  const operation = { name: 'inspect', signature, parameters, returnType: 'java.util.List' }
  const bean = { objectName: 'example:type=Buffer,name=one', domain: 'example', type: 'Buffer', name: 'one', attributes: [], operations: [operation] }
  const props = vue.reactive({ bean, target: 'node-a', invokeAccess: { allowed: true }, busy: false, result: undefined, resultState: { status: 'ready' } })
  const events = []
  const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
  const renderer = vue.createRenderer({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; at < 0 ? parent.children.push(child) : parent.children.splice(at, 0, child) },
    remove(child) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null },
    setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text; node.children = [] },
    patchProp: (node, key, _old, value) => { node.props[key] = value },
    parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  })
  const target = node('root')
  const app = renderer.createApp({ setup: () => () => vue.h(Operations, { ...props, onInvoke: value => events.push(value) }) })
  const shell = name => vue.defineComponent({ inheritAttrs: true, setup: (_props, { slots }) => () => vue.h(name, Object.values(slots).flatMap(slot => slot?.())) })
  app.component('AForm', Form)
  for (const name of ['ASelect','AInput','ATextarea','AFormItem','AButton','ADescriptions','ADescriptionsItem','ASpin','AAlert','AEmpty','AResult','AIcon']) app.component(name, shell(name))
  app.component('AModal', vue.defineComponent({ props: ['open'], setup: (props, { slots }) => () => props.open ? vue.h('dialog', slots.default?.()) : null }))
  app.mount(target); t.after(() => app.unmount())
  const all = (root = target) => [root, ...root.children.flatMap(all)]
  const find = type => all().find(node => node.type === type)
  const text = (root = target) => root.type === '#comment' ? '' : root.text + root.children.map(text).join('')
  async function choose() { const select = find('ASelect'); select.props['onUpdate:value']('inspect(' + signature.join(', ') + ')'); select.props.onChange(); await flush() }
  async function submit() { find('form').props.onSubmit({ preventDefault() {}, stopPropagation() {} }); await flush() }
  return { props, events, find, text, choose, submit }
}

test('real Ant Form without a model opens confirmation on native submit and does not execute before confirmation', async t => {
  const h = harness(t)
  await h.choose(); await h.submit()
  assert.ok(h.find('dialog'), 'native form submit must open the confirmation dialog')
  assert.equal(h.events.length, 0)
  h.find('dialog').props.onCancel(); await flush()
  assert.equal(h.find('dialog'), undefined)
  assert.equal(h.events.length, 0)
  await h.submit()
  h.find('dialog').props.onOk(); await flush()
  assert.equal(h.events.length, 1)
  assert.deepEqual(h.events[0].args, [])
})

test('parameter validation remains before confirmation and current arguments retain metadata order', async t => {
  const h = harness(t, [{ name: 'limit', type: 'int' }, { name: 'options', type: 'java.util.Map' }])
  await h.choose(); await h.submit()
  assert.equal(h.find('dialog'), undefined)
  assert.equal(h.find('AAlert').props.message, 'runtimeDiagnostics.required')
  h.find('AInput').props['onUpdate:value']('1'); h.find('ATextarea').props['onUpdate:value']('{bad}')
  await h.submit()
  assert.equal(h.find('AAlert').props.message, 'runtimeDiagnostics.invalid')
  h.find('ATextarea').props['onUpdate:value']('{"enabled":true}')
  await h.submit(); assert.ok(h.find('dialog'))
  h.find('dialog').props.onOk(); await flush()
  assert.deepEqual(h.events[0].args, [{ name: 'limit', value: '1' }, { name: 'options', value: { enabled: true } }])
})

test('confirmed results render as formatted JSON below the form, including empty, null and false values', async t => {
  const h = harness(t)
  await h.choose(); await h.submit(); h.find('dialog').props.onOk(); await flush()
  for (const value of [[{ name: 'one', count: 2 }], [], null, 0, false]) {
    h.props.result = value; h.props.resultState = { status: 'ready' }; await flush()
    assert.equal(h.text(h.find('pre')), typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))
  }
  h.props.result = undefined; h.props.resultState = { status: 'error', message: 'request failed' }; await flush()
  assert.ok(h.text().includes('request failed'))
  assert.equal(h.find('pre'), undefined)
})

test('permission loss and target changes cancel pending confirmations without invoking a different object', async t => {
  const h = harness(t)
  await h.choose(); await h.submit(); assert.ok(h.find('dialog'))
  h.props.invokeAccess = { allowed: false }; await flush()
  assert.equal(h.find('dialog'), undefined); assert.equal(h.events.length, 0)
  h.props.invokeAccess = { allowed: true }; await flush(); await h.submit(); assert.ok(h.find('dialog'))
  h.props.target = 'node-b'; await flush()
  assert.equal(h.find('dialog'), undefined); assert.equal(h.events.length, 0)
})
