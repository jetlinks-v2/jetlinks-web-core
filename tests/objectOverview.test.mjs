import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { Subject } from 'rxjs'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../src/components/ObjectOverview')
function load(filename, overrides = {}, cache = new Map()) {
  if (cache.has(filename)) return cache.get(filename)
  let source = readFileSync(filename, 'utf8')
  if (filename.endsWith('.vue')) source = compileScript(parse(source, { filename }).descriptor, { id: filename, inlineTemplate: true }).content
  const module = { exports: {} }
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', code)(id => {
    if (id in overrides) return overrides[id]
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === '@ant-design/icons-vue') return Object.fromEntries(['ThunderboltOutlined', 'InfoCircleOutlined', 'PlusOutlined', 'EditOutlined', 'ReloadOutlined', 'MoreOutlined', 'ArrowRightOutlined'].map(key => [key, () => null]))
    if (id === './ObjectInputValue.vue') return { __esModule: true, default: () => null }
    if (id.startsWith('.')) return load(resolve(dirname(filename), id.endsWith('.vue') ? id : `${id}.ts`), overrides, cache)
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const Content = load(resolve(root, 'ObjectContentGroup.vue')).default
test('reference display overrides a plain value presentation and forwards target identity without writing', async t => {
  const opened = [], preview = vue.ref(false)
  const member = { ref: { type: 'workOrder', providerId: 'identity', kind: 'property', id: 'project' }, name: 'Project', sourceName: 'Work orders', metadata: { id: 'project', valueType: { type: 'string' } } }
  const h = render(t, () => () => vue.h(Content, {
    entries: [{ selection: { member: member.ref }, member, presentation: { component: () => vue.h('span', 'RAW-ID') }, state: { status: 'ready', value: 'P1', references: { items: [{ type: 'project', id: 'P1', name: 'Water supply' }, { type: 'project', id: 'removed', unavailable: true }], limited: false } } }],
    preview: preview.value, runtime: () => undefined, onOpen: object => opened.push(object),
  }))
  assert.ok(!h.text().includes('RAW-ID'))
  h.button('Water supply').props.onClick()
  assert.deepEqual(opened, [{ type: 'project', id: 'P1', name: 'Water supply' }])
  assert.equal(h.button('removed').props.disabled, true)
  preview.value = true; await flush()
  assert.equal(h.button('Water supply').props.disabled, true, 'layout editing retains the reference label and disables navigation')
})
const flush = async () => { await vue.nextTick(); await Promise.resolve(); await vue.nextTick() }
function render(t, setup) {
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
  const app = renderer.createApp({ setup })
  const shell = name => vue.defineComponent({ inheritAttrs: true, setup: (_props, { slots }) => () => vue.h(name, Object.values(slots).flatMap(slot => slot?.())) })
  for (const name of ['AButton', 'ATooltip', 'APopover', 'AIcon', 'AAlert', 'AEmpty', 'ATag', 'ASpace', 'ASpin', 'AForm', 'ASelect', 'ASelectOption', 'ASkeleton', 'AInput', 'ADropdown', 'AMenu', 'AMenuItem']) app.component(name, shell(name))
  app.component('AModal', vue.defineComponent({ props: ['open'], emits: ['cancel'], setup: (props, { slots, emit }) => () => props.open ? vue.h('dialog', { onClose: () => emit('cancel') }, slots.default?.()) : null }))
  app.mount(target); t.after(() => app.unmount())
  const all = (root = target) => [root, ...root.children.flatMap(all)]
  const text = (root = target) => root.type === '#comment' ? '' : root.text + root.children.map(text).join('')
  const button = label => all().find(item => item.type === 'AButton' && text(item) === label)
  return { all, text, button }
}
function harness(t) {
  const stream = new Subject()
  let preparations = 0, executions = 0
  const binding = { version: 1, operation: { capabilityId: 'object.action.saved', version: 1 } }
  const selection = { member: { type: 'sample', providerId: 'operations', kind: 'action', id: 'apply' }, binding }
  const entries = vue.shallowRef([{ selection, member: { ref: selection.member, name: 'Apply', sourceName: 'Operations', metadata: { id: 'apply', inputs: [] } }, state: { status: 'ready' } }])
  const preview = vue.ref(false)
  const runtime = {
    async prepareOperation(request) { preparations++; return { id: 'prepared', request, summary: 'Apply', impacts: [{ type: 'sample', id: 'A', name: 'Pump A' }] } },
    confirmOperation(id) { assert.equal(id, 'prepared'); return { id: 'confirmed' } },
    executeOperation() { executions++; return { events$: stream } },
  }
  return { ...render(t, () => () => vue.h(Content, { title: 'Actions', entries: entries.value, preview: preview.value, runtime: () => runtime })), entries, preview, stream, preparations: () => preparations, executions: () => executions }
}

test('actual content group opens stable action selection and actual panel prepares, confirms and displays the original receipt', async t => {
  const h = harness(t)
  h.button('Apply').props.onClick(); await flush()
  assert.ok(h.all().some(item => item.type === 'dialog'), 'plain selection survives Vue ref proxying')
  assert.equal(h.preparations(), 0); assert.equal(h.executions(), 0)
  h.entries.value = structuredClone(h.entries.value); await flush()
  assert.ok(h.all().some(item => item.type === 'dialog'), 'equivalent bindings keep the selected operation')
  h.button('run').props.onClick(); await flush()
  assert.match(h.text(), /Pump A/, 'confirmation identifies the frozen target')
  assert.equal(h.executions(), 0)
  h.button('confirm').props.onClick(); h.button('confirm').props.onClick(); await flush()
  assert.equal(h.executions(), 1, 'double-click dispatches once')
  h.stream.next({ type: 'result', result: { message: 'device refused' } })
  h.stream.next({ type: 'warning', message: 'Check receipt' }); h.stream.next({ type: 'completed' }); h.stream.complete(); await flush()
  assert.match(h.text(), /device refused/)
  assert.ok(h.all().some(item => item.type === 'AAlert' && item.props.message === 'actionWarning'))
  h.button('run').props.onClick(); await flush()
  assert.doesNotMatch(h.text(), /device refused/, 'a new attempt clears the old receipt')
  h.preview.value = true; await flush()
  assert.equal(h.all().some(item => item.type === 'dialog'), false)
  h.preview.value = false; await flush()
  assert.equal(h.all().some(item => item.type === 'dialog'), false, 'returning from layout editing does not reopen an operation')
})

test('closing an unconfirmed operation and entering layout preview never execute it', async t => {
  const h = harness(t)
  h.button('Apply').props.onClick(); await flush()
  h.button('run').props.onClick(); await flush()
  h.all().find(item => item.type === 'dialog').props.onClose(); await flush()
  assert.equal(h.executions(), 0)
  h.preview.value = true; await flush()
  assert.equal(h.button('Apply').props.disabled, true)
})

function overview(t, store) {
  const capability = { members: vue.shallowRef([]), values: vue.shallowRef({}), loading: vue.ref(true), failed: vue.ref(false),
    refresh: () => { capability.loading.value = true }, getRuntime: () => undefined }
  const Canvas = vue.defineComponent({ props: ['modelValue'], setup: () => () => vue.h('dashboard') })
  const Overview = load(resolve(root, 'ObjectOverview.vue'), {
    '../DashBoardCanvas': { DashBoardCanvas: Canvas },
    './ObjectCapabilityPicker.vue': { __esModule: true, default: () => null },
    '../../object-capability/useObjectCapabilities': { useObjectCapabilities: () => capability },
    '../../object-capability/useObjectRelatedData': { useObjectRelatedData: () => ({ members: vue.ref([]), states: vue.ref({}) }) },
    '../../object-capability/useObjectMemberPresentations': { useObjectMemberPresentations: () => vue.ref([]) },
  }).default
  const h = render(t, () => () => vue.h(Overview, { object: { type: 'sample', id: 'A' }, store }, {
    actions: () => vue.h('button', 'Source action'), default: () => vue.h('records', 'Original records'),
  }))
  return { ...h, capability, alerts: () => h.all().filter(item => item.type === 'AAlert').map(item => item.props.message) }
}

test('actual overview keeps records visible without a blank dashboard during model loading, failure and empty success', async t => {
  const h = overview(t)
  await flush()
  assert.ok(h.all().some(item => item.type === 'ASkeleton'))
  assert.equal(h.all().some(item => item.type === 'dashboard'), false)
  assert.match(h.text(), /Original records/)
  assert.ok(h.all().some(item => item.type === 'button' && h.text(item) === 'Source action'), 'host actions stay in the overview toolbar')
  h.capability.loading.value = false; h.capability.failed.value = true; await flush()
  assert.deepEqual(h.alerts(), ['dataLoadFailed'])
  assert.equal(h.all().some(item => item.type === 'dashboard'), false)
  assert.equal(h.button('customize'), undefined)
  assert.match(h.text(), /Original records/)
  h.button('retry').props.onClick(); await flush()
  assert.equal(h.capability.loading.value, true)
  h.capability.loading.value = false; h.capability.failed.value = false; await flush()
  assert.deepEqual(h.alerts(), [])
  assert.match(h.text(), /empty/)
  assert.equal(h.all().some(item => item.type === 'dashboard'), false)
})

test('actual overview retries failed personal views and restores saved content before allowing customization', async t => {
  let fail = true, reads = 0, writes = 0
  const store = {
    async list() { reads++; if (fail) throw new Error('404'); return [{ id: 'saved', objectType: 'sample', objectId: 'A', name: 'Saved', view: { canvas: { gridLayout: { rowHeight: 20, marginVertical: 10 } }, components: [{ id: 'data', type: 'object-data', componentProps: { gridItem: { x: 0, y: 0, w: 12, h: 4 }, selections: [] } }] } }] },
    async defaultView() { return 'saved' },
    async create() { writes++; }, async save() { writes++; }, async delete() { writes++; }, async setDefault() { writes++; },
  }
  const h = overview(t, store)
  h.capability.loading.value = false; await flush()
  assert.deepEqual(h.alerts(), ['viewLoadFailed'])
  assert.equal(h.button('customize'), undefined)
  assert.equal(h.all().some(item => item.type === 'dashboard'), false)
  assert.match(h.text(), /Original records/)
  fail = false
  h.all().find(item => item.type === 'AButton' && item.props['aria-label'] === 'retry').props.onClick(); await flush()
  assert.equal(reads, 2, 'refresh retries view persistence as well as the model')
  h.capability.loading.value = false; await flush()
  assert.deepEqual(h.alerts(), [])
  assert.ok(h.button('customize'))
  assert.ok(h.all().some(item => item.type === 'dashboard'))
  assert.equal(h.all().find(item => item.props.class?.includes('object-overview__canvas'))?.props.style.height, '110px')
  assert.equal(writes, 0, 'recovery never writes a default page over the saved view')
})
