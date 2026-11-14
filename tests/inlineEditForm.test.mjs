import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const root = resolve(import.meta.dirname, '../src/components/InlineEditForm')
const module = { exports: {} }
new Function('require', 'module', 'exports', transformSync(readFileSync(resolve(root, 'useInlineEditField.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(() => vue, module, module.exports)
const { useInlineEditField } = module.exports
const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const messages = { save: 'Save', cancel: 'Cancel', empty: 'Empty', saving: 'Saving', failed: 'Failed' }
function mount(field = {}, submit = async () => ({ ok: true })) {
  const props = vue.reactive({ field: { key: 'field', label: 'Field', value: 'saved', initialValue: 'saved', ...field }, mode: 'detail', disabled: false, busy: false, messages, submit })
  const changes = []
  let state
  const app = renderer.createApp({ setup() { state = useInlineEditField(props, (key, value) => { changes.push([key, value]); props.field.value = value }); return () => null } })
  app.mount({})
  return { app, props, state, changes }
}

test('details retain false/zero labels and render passwords only as a fixed mask', t => {
  for (const [field, expected] of [[{ initialValue: 0 }, '0'], [{ initialValue: false }, 'false'], [{ editor: 'select', initialValue: 0, options: [{ value: 0, label: 'Disabled' }] }, 'Disabled'], [{ editor: 'password', secretSet: true, value: '', initialValue: '' }, '••••••••']]) {
    const view = mount(field); t.after(() => view.app.unmount())
    assert.equal(view.state.display.value, expected)
  }
})

test('Enter then blur issues one write, and a failed write keeps editable input for retry', async t => {
  let finish, calls = 0
  const view = mount({}, async () => { calls++; return new Promise(resolve => { finish = resolve }) }); t.after(() => view.app.unmount())
  view.state.begin(); view.state.update('changed')
  const first = view.state.commit()
  await view.state.commit()
  assert.equal(calls, 1)
  assert.equal(view.state.pending.value, true)
  finish({ ok: false, error: 'Validation failed' }); await first
  assert.equal(view.state.active.value, true)
  assert.equal(view.state.value.value, 'changed')
  assert.equal(view.state.error.value, 'Validation failed')
  view.props.submit = async () => { calls++; view.props.field.initialValue = 'changed'; return { ok: true } }
  await view.state.commit()
  assert.equal(calls, 2)
  assert.equal(view.state.active.value, false)
})

test('cancel and unchanged/empty-secret edits never submit; creation only emits local draft changes', async t => {
  let calls = 0
  const view = mount({}, async () => { calls++; return { ok: true } }); t.after(() => view.app.unmount())
  view.state.begin(); view.state.update('temporary'); view.state.cancel(); await view.state.commit()
  assert.equal(view.state.value.value, 'saved')
  view.state.begin(); await view.state.commit()
  view.props.field = { key: 'password', label: 'Password', editor: 'password', value: '', initialValue: '', secretSet: true }
  await vue.nextTick(); view.state.begin(); await view.state.commit()
  view.props.mode = 'form'; view.state.update('new'); await view.state.commit()
  assert.equal(calls, 0)
  assert.equal(view.props.field.value, 'new')
})

test('complex values are detached drafts and Escape cancels without saving incomplete rows', async t => {
  let calls = 0
  const saved = [{ key: 'one', value: 'saved' }]
  const view = mount({ editor: 'custom', value: saved, initialValue: saved }, async () => { calls++; return { ok: true } }); t.after(() => view.app.unmount())
  view.state.begin(); view.state.update([{ key: 'unfinished', value: '' }])
  view.state.keydown({ key: 'Enter', preventDefault() {}, stopPropagation() {} })
  assert.equal(calls, 0)
  view.state.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} })
  assert.deepEqual(view.state.value.value, saved)
  assert.equal(view.state.active.value, false)
})

test('disabled and pending fields block edits; stale completion cannot close another field', async t => {
  let finish
  const view = mount({}, async () => new Promise(resolve => { finish = resolve })); t.after(() => view.app.unmount())
  view.props.disabled = true; view.state.begin(); view.state.update('forbidden')
  assert.equal(view.state.active.value, false); assert.equal(view.changes.length, 0)
  view.props.disabled = false; view.state.begin(); view.state.update('submitted')
  const pending = view.state.commit(); view.state.cancel()
  assert.equal(view.state.value.value, 'submitted')
  view.props.field = { key: 'another', label: 'Other', value: 'draft', initialValue: 'saved' }
  await vue.nextTick(); finish({ ok: true }); await pending
  assert.equal(view.state.active.value, true); assert.equal(view.state.value.value, 'draft')
})

test('the public form and field SFCs compile with typed slots and explicit Vue imports', () => {
  for (const filename of ['index.vue', 'InlineEditField.vue']) {
    const { descriptor, errors } = parse(readFileSync(resolve(root, filename), 'utf8'), { filename })
    assert.deepEqual(errors, [])
    const result = compileScript(descriptor, { id: filename, inlineTemplate: true })
    assert.doesNotThrow(() => transformSync(result.content, { loader: 'ts', format: 'cjs' }))
  }
})

test('blur saves only when focus leaves a compound editor and retries failed edits without action buttons', async t => {
  let calls = 0
  const inside = {}, outside = {}
  const scope = { contains: node => node === inside, ownerDocument: { activeElement: inside } }
  const view = mount({ editor: 'custom', value: [], initialValue: [] }, async () => ({ ok: ++calls > 1, error: 'Offline' }))
  t.after(() => view.app.unmount())
  view.state.begin(); view.state.update([{ key: 'name', value: 'value' }])
  await view.state.blur({ currentTarget: scope, relatedTarget: inside })
  assert.equal(calls, 0)
  await view.state.blur({ currentTarget: scope, relatedTarget: null })
  assert.equal(calls, 0)
  scope.ownerDocument.activeElement = outside
  await view.state.blur({ currentTarget: scope, relatedTarget: outside })
  assert.equal(calls, 1)
  assert.equal(view.state.error.value, 'Offline')
  assert.equal(view.state.active.value, true)
  await view.state.blur({ currentTarget: scope, relatedTarget: outside })
  assert.equal(calls, 2)
  assert.equal(view.state.active.value, false)
})

test('a queued blur cannot submit after its record editor is unmounted', async () => {
  let calls = 0
  const view = mount({}, async () => { calls++; return { ok: true } })
  view.state.begin(); view.state.update('changed')
  const pending = view.state.blur({ currentTarget: { contains: () => false, ownerDocument: { activeElement: null } }, relatedTarget: null })
  view.app.unmount()
  await pending
  assert.equal(calls, 0)
})
