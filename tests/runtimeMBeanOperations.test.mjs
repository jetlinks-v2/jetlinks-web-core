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
  for (const name of ['ASelect','AInput','ATextarea','AFormItem','AButton','ATooltip','ASpin','AAlert','AEmpty','AResult','AIcon']) app.component(name, shell(name))
  app.component('AModal', vue.defineComponent({ props: ['open'], setup: (props, { slots }) => () => props.open ? vue.h('dialog', slots.default?.()) : null }))
  app.mount(target); t.after(() => app.unmount())
  const all = (root = target) => [root, ...root.children.flatMap(all)]
  const find = type => all().find(node => node.type === type)
  const text = (root = target) => root.type === '#comment' ? '' : root.text + root.children.map(text).join('')
  async function choose(key = 'inspect(' + signature.join(', ') + ')') { find('ASelect').props.onChange(key); await flush() }
  async function submit() { find('form').props.onSubmit({ preventDefault() {}, stopPropagation() {} }); await flush() }
  return { props, events, find, text, choose, submit }
}

test('real Ant Form submits directly without a confirmation dialog; choosing a method never executes it', async t => {
  const h = harness(t)
  await h.choose()
  assert.equal(h.find('dialog'), undefined)
  assert.equal(h.events.length, 0)
  await h.submit()
  assert.equal(h.find('dialog'), undefined)
  assert.equal(h.events.length, 1)
  assert.deepEqual(h.events[0].args, [])
})

test('direct submission validates arguments and retains metadata order', async t => {
  const h = harness(t, [{ name: 'limit', type: 'int' }, { name: 'options', type: 'java.util.Map' }])
  await h.choose(); await h.submit()
  assert.equal(h.find('dialog'), undefined)
  assert.equal(h.find('AAlert').props.message, 'runtimeDiagnostics.required')
  assert.equal(h.events.length, 0)
  h.find('AInput').props['onUpdate:value']('1'); h.find('ATextarea').props['onUpdate:value']('{bad}')
  await h.submit()
  assert.equal(h.find('AAlert').props.message, 'runtimeDiagnostics.invalid')
  assert.equal(h.events.length, 0)
  h.find('ATextarea').props['onUpdate:value']('{"enabled":true}')
  await h.submit(); assert.equal(h.find('dialog'), undefined)
  assert.equal(h.events.length, 1)
  assert.deepEqual(h.events[0].args, [{ name: 'limit', value: '1' }, { name: 'options', value: { enabled: true } }])
})

test('direct invocation renders formatted JSON below the form, including empty, null and false values', async t => {
  const h = harness(t)
  await h.choose(); await h.submit()
  for (const value of [[{ name: 'one', count: 2 }], [], null, 0, false]) {
    h.props.result = value; h.props.resultState = { status: 'ready' }; await flush()
    assert.equal(h.text(h.find('pre')), typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))
  }
  h.props.result = undefined; h.props.resultState = { status: 'error', message: 'request failed' }; await flush()
  assert.ok(h.text().includes('request failed'))
  assert.equal(h.find('pre'), undefined)
})

test('permission, busy and missing targets prevent direct execution; target changes clear selection and results', async t => {
  const h = harness(t)
  await h.choose()
  h.props.invokeAccess = { allowed: false }; await flush()
  await h.submit(); assert.equal(h.events.length, 0)
  h.props.invokeAccess = { allowed: true }; h.props.busy = true; await flush()
  await h.submit(); assert.equal(h.events.length, 0)
  h.props.busy = false; h.props.target = ''; await flush(); await h.choose()
  await h.submit(); assert.equal(h.events.length, 0)
  h.props.target = 'node-b'; await flush()
  assert.equal(h.find('ASelect').props.value, undefined); assert.equal(h.find('AButton'), undefined); assert.equal(h.events.length, 0)
  await h.choose(); await h.submit()
  h.props.result = { node: 'node-b' }; await flush(); assert.ok(h.find('pre'))
  h.props.invokeAccess = { allowed: false }; await flush(); assert.equal(h.find('pre'), undefined)
})

test('overloaded methods keep full signatures; switching methods clears arguments and old results', async t => {
  const h = harness(t, [{ name: 'value', type: 'int' }])
  const other = { name: 'inspect', signature: ['java.lang.String'], parameters: [{ name: 'value', type: 'java.lang.String' }], returnType: 'java.lang.String' }
  h.props.bean.operations.push(other); await flush()
  assert.deepEqual(h.find('ASelect').props.options.map(option => option.label), ['inspect(int)', 'inspect(java.lang.String)'])
  await h.choose(); h.find('AInput').props['onUpdate:value']('1'); await h.submit()
  assert.deepEqual(h.events[0].operation.signature, ['int'])
  h.props.result = 1; await flush(); assert.ok(h.find('pre'))
  await h.choose('inspect(java.lang.String)'); assert.equal(h.find('pre'), undefined)
  await h.submit(); assert.equal(h.events.length, 1, 'previous numeric argument must not carry over')
  h.find('AInput').props['onUpdate:value'](''); await h.choose('inspect(java.lang.String)'); await h.submit()
  assert.equal(h.events.length, 2, 'reselecting the current method must not clear its input')
  assert.deepEqual(h.events[1].operation.signature, ['java.lang.String'])
  assert.deepEqual(h.events[1].args, [{ name: 'value', value: '' }])
})
