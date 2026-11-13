import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { effectScope, nextTick, reactive, ref } from 'vue'

const require = createRequire(import.meta.url)
function load(file) {
  const output = buildSync({ entryPoints: [resolve(import.meta.dirname, `../src/components/Form/${file}.ts`)], bundle: true, platform: 'node', format: 'cjs', external: ['vue'], write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(require, module, module.exports)
  return module.exports
}
const { useFormSession } = load('useFormSession')
const { useFormDesigner } = load('useFormDesigner')
const { useFormValueEditor } = load('useFormValueEditor')
const { fieldAccess, moveField, displayValue, selectedOptions } = load('model')
const fields = [{ key: 'amount', label: 'Amount', type: 'number' }, { key: 'enabled', label: 'Enabled', type: 'boolean' }, { key: 'custom.height', label: 'Height', type: 'text' }]
const layout = { version: 1, sections: [{ id: 'a', label: 'A', items: fields.map(({ key }) => ({ key })) }, { id: 'b', label: 'B', items: [] }] }
function mount(overrides = {}) {
  const state = reactive({ fields, layout, values: { amount: 1.2345, enabled: false, 'custom.height': '' }, access: {}, readonly: false, ...overrides })
  const events = []
  const scope = effectScope()
  const session = scope.run(() => useFormSession({ fields: () => state.fields, layout: () => state.layout, values: () => state.values, access: () => state.access, readonly: () => state.readonly, submit: () => state.submit, validate: () => state.validate, requiredMessage: () => 'required', failedMessage: () => 'failed', change: value => events.push(['change', value]), saved: value => events.push(['saved', value]), externalChange: keys => events.push(['external', keys]) }))
  return { state, session, events, stop: () => scope.stop() }
}
test('0, false, null and opaque dotted keys survive editing, restoration and normalized saves', async t => {
  let submitted
  const view = mount({ submit: async patch => { submitted = patch; return { values: { amount: 0 } } } }); t.after(view.stop)
  const { session } = view
  assert.equal(session.commit('enabled', false), true)
  assert.equal(session.dirty.value, 0)
  session.commit('amount', 0); session.commit('custom.height', null)
  assert.equal(view.state.values.amount, 1.2345)
  await session.save()
  assert.deepEqual(submitted, { amount: 0, 'custom.height': null })
  assert.equal(session.value('amount'), 0)
  assert.equal(session.dirty.value, 0)
  session.commit('amount', 99); session.restore('amount')
  assert.equal(session.value('amount'), 0)
})
test('access intersection and revocation remove pending patches, errors and invalid layout entries', async t => {
  const view = mount(); t.after(view.stop)
  view.session.commit('amount', 2)
  view.state.access.amount = 'denied'
  assert.equal(view.session.canWrite('amount'), false)
  assert.equal(view.session.dirty.value, 0)
  assert.equal(view.session.commit('amount', 3), false)
  view.state.access.amount = 'write'
  view.state.fields = [{ ...fields[0], readonly: true }, ...fields.slice(1)]
  assert.equal(view.session.canWrite('amount'), false)
  assert.equal(fieldAccess(fields[0], { key: 'amount', readonly: true }, { amount: 'write' }), 'read')
  assert.equal(view.session.commit('not-declared', 'value'), false)
})
test('refresh reports a conflict and keeps local edits; matching refresh removes the difference', async t => {
  const view = mount(); t.after(view.stop)
  view.session.commit('amount', 2)
  view.state.values.amount = 3
  await nextTick()
  assert.equal(view.session.value('amount'), 2)
  assert.ok(view.events.some(([event, keys]) => event === 'external' && keys.includes('amount')))
  view.state.values.amount = 2; await nextTick()
  assert.equal(view.session.dirty.value, 0)
})
test('failure and field validation preserve edits, successful retry clears them', async t => {
  let fail = true
  const view = mount({ submit: async () => { if (fail) throw new Error('offline') } }); t.after(view.stop)
  view.session.commit('amount', 2)
  await view.session.save()
  assert.equal(view.session.failure.value, 'offline')
  assert.equal(view.session.dirty.value, 1)
  fail = false; await view.session.save()
  assert.equal(view.session.dirty.value, 0)
  view.state.submit = async () => ({ errors: { amount: 'invalid' } })
  view.session.commit('amount', 3); await view.session.save()
  assert.equal(view.session.errors.value.amount, 'invalid')
  assert.equal(view.session.dirty.value, 1)
})
test('in-flight save prevents duplicate operations and does not emit after unmount', async () => {
  let finish, calls = 0
  const view = mount({ submit: () => { calls++; return new Promise(resolve => { finish = resolve }) } })
  view.session.commit('amount', 2)
  const pending = view.session.save()
  await view.session.save(); view.session.restore()
  assert.equal(calls, 1); assert.equal(view.session.dirty.value, 1)
  view.stop(); finish(); await pending
  assert.equal(view.events.filter(([event]) => event === 'saved').length, 0)
})
test('enum identities, display-only precision and immutable two-dimensional movement', () => {
  const enumField = { key: 'choices', type: 'enum', multiple: true, options: [{ value: 1, label: 'Number' }, { value: '1', label: 'String' }, { value: false, label: 'No' }] }
  assert.deepEqual(selectedOptions(enumField, [false, '1', 'unknown']).map(option => option.label), ['No', 'String', 'unknown'])
  assert.equal(displayValue(fields[0], { key: 'amount', digits: 2 }, 1.2345, 'en'), '1.23')
  assert.equal(displayValue(fields[0], { key: 'amount' }, 1234567.12345678, 'en'), '1234567.12345678')
  const moved = moveField(layout, 'amount', 'a', 'custom.height')
  assert.deepEqual(moved.sections[0].items.map(item => item.key), ['enabled', 'amount', 'custom.height'])
  const cross = moveField(moved, 'amount', 'b')
  assert.deepEqual(cross.sections[1].items, [{ key: 'amount' }])
  assert.equal(layout.sections[0].items[0].key, 'amount')
  assert.deepEqual(moveField(cross, 'new', 'b', 'amount').sections[1].items.map(item => item.key), ['new', 'amount'])
})

test('required and custom rules skip inaccessible fields and preserve scalar versus array semantics', async t => {
  const view = mount({ fields: [{ ...fields[0], required: true }, { ...fields[1], required: true }, { ...fields[2], required: true }], access: { 'custom.height': 'hidden' }, validate: (value, field) => field.key === 'amount' && value < 0 ? 'negative' : undefined, submit: async () => {} }); t.after(view.stop)
  assert.equal(view.session.commit('amount', -1), false)
  assert.equal(view.session.errors.value.amount, 'negative')
  view.session.commit('amount', 0)
  await view.session.save()
  assert.equal(view.session.dirty.value, 0)
  assert.equal(view.session.errors.value['custom.height'], undefined)
  const multi = mount({ fields: [{ key: 'choices', label: 'Choices', type: 'enum', multiple: true }], layout: { version: 1, sections: [{ id: 'x', label: 'X', items: [{ key: 'choices' }] }] }, values: { choices: [1, false] } }); t.after(multi.stop)
  multi.session.commit('choices', [])
  assert.deepEqual(multi.session.value('choices'), [])
  multi.session.restore(); assert.deepEqual(multi.session.value('choices'), [1, false])
})
test('two sessions and nested custom drafts never mutate shared host values or submit snapshots', async t => {
  const shared = { amount: { interval: 30 } }
  const first = mount({ values: shared, submit: async patch => { patch.amount.interval = 999 } }); t.after(first.stop)
  const second = mount({ values: shared }); t.after(second.stop)
  const edited = { interval: 60 }
  first.session.commit('amount', edited); edited.interval = 80
  assert.equal(first.session.value('amount').interval, 60)
  assert.equal(second.session.value('amount').interval, 30)
  await first.session.save()
  assert.equal(first.session.value('amount').interval, 60)
  assert.equal(shared.amount.interval, 30)
})
test('permission revocation during save does not reintroduce hidden values or clear unrelated errors', async t => {
  let finish
  const view = mount({ submit: () => new Promise(resolve => { finish = resolve }) }); t.after(view.stop)
  view.session.commit('amount', 2); view.session.commit('enabled', true)
  const pending = view.session.save()
  view.state.access.amount = 'hidden'
  finish({ errors: { amount: 'rejected' } }); await pending
  assert.equal(view.session.failure.value, 'failed')
  assert.equal(view.session.value('enabled'), true)
  assert.equal(Object.hasOwn(view.session.changes.value, 'amount'), false)
  assert.equal(view.events.filter(([event]) => event === 'saved').length, 0)
})
test('external refresh, field removal and readonly mode reconcile patches without widening write access', async t => {
  const view = mount(); t.after(view.stop)
  view.session.commit('amount', 2); view.session.commit('enabled', true)
  view.state.layout = { version: 1, sections: [{ id: 'a', label: 'A', items: [{ key: 'enabled' }] }] }
  assert.equal(view.session.dirty.value, 1)
  view.state.readonly = true
  assert.equal(view.session.dirty.value, 0)
  assert.equal(view.session.commit('enabled', false), false)
})
test('designer uses immutable layout history, restores removed configuration and isolates tryout data', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const state = reactive({ layout: structuredClone(layout), values: { amount: { interval: 30 } } })
  const designer = scope.run(() => useFormDesigner({ layout: () => state.layout, fields: () => fields, sampleValues: () => state.values, update: value => { state.layout = value }, sectionLabel: () => ({ label: 'New' }), locale: () => 'en' }, ref()))
  designer.select('amount'); designer.patchItem({ digits: 2, span: 2 }); designer.remove()
  assert.equal(state.layout.sections[0].items.some(item => item.key === 'amount'), false)
  designer.undo()
  assert.equal(state.layout.sections[0].items[0].digits, 2)
  designer.select('amount'); designer.shift(1)
  assert.deepEqual(state.layout.sections[0].items.map(item => item.key), ['enabled', 'amount', 'custom.height'])
  designer.moveToSection('b')
  assert.equal(state.layout.sections[1].items[0].key, 'amount')
  designer.togglePreview()
  designer.previewValues.value.amount.interval = 90
  assert.equal(state.values.amount.interval, 30)
  assert.equal(layout.sections[0].items[0].span, undefined)
})

test('option editor preserves unknown values and typed identities when adding or clearing selections', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const state = reactive({ field: { key: 'options', label: 'Options', type: 'enum', multiple: true, options: [{ value: 1, label: 'Number' }, { value: '1', label: 'String' }, { value: false, label: 'No' }] }, value: [1, 'missing'] })
  const editor = scope.run(() => useFormValueEditor(state, { update: value => { state.value = value }, confirm() {}, cancel() {}, navigate() {} }, () => 'en'))
  assert.deepEqual(editor.selection.value, ['0', '3'])
  editor.selectValue(['0', '2', '3'])
  assert.deepEqual(state.value, [1, false, 'missing'])
  editor.selectValue([])
  assert.deepEqual(state.value, [])
})
test('editor keyboard contract leaves IME and multiline Enter intact, while Tab and Escape emit commands', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const state = reactive({ field: { key: 'note', label: 'Note', type: 'textarea' }, value: '' })
  const events = []
  const editor = scope.run(() => useFormValueEditor(state, { update() {}, confirm: () => events.push('confirm'), cancel: () => events.push('cancel'), navigate: reverse => events.push(reverse ? 'previous' : 'next') }, () => 'en'))
  const key = (key, extra = {}) => ({ key, preventDefault() {}, stopPropagation() {}, ...extra })
  editor.onKeydown(key('Enter', { isComposing: true }))
  editor.onKeydown(key('Enter'))
  assert.deepEqual(events, [])
  editor.onKeydown(key('Enter', { ctrlKey: true }))
  editor.onKeydown(key('Tab', { shiftKey: true }))
  editor.onKeydown(key('Escape'))
  assert.deepEqual(events, ['confirm', 'previous', 'cancel'])
})

test('search filters localized options without losing typed or unknown selections; booleans retain false and null', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const locale = ref('en')
  const state = reactive({ field: { key: 'choice', label: 'Choice', type: 'enum', multiple: true, options: [{ value: 1, label: '数值', i18nMessages: { label: { en: 'Number' } } }, { value: '1', label: '文本', i18nMessages: { label: { en: 'Text' } } }] }, value: [1, 'retired'] })
  const events = { update: value => { state.value = value }, confirm() {}, cancel() {}, navigate() {} }
  const editor = scope.run(() => useFormValueEditor(state, events, () => locale.value, () => ['Yes', 'No']))
  editor.query.value = 'TEXT'
  assert.deepEqual(editor.visibleOptions.value.map(option => option.option.value), ['1'])
  assert.deepEqual(state.value, [1, 'retired'])
  editor.query.value = ''; locale.value = 'zh'
  assert.equal(editor.visibleOptions.value[0].label, '数值')
  const boolean = reactive({ field: { key: 'enabled', label: 'Enabled', type: 'boolean' }, value: false })
  const boolEditor = scope.run(() => useFormValueEditor(boolean, { ...events, update: value => { boolean.value = value } }, () => locale.value, () => ['是', '否']))
  assert.equal(boolEditor.selection.value, '1')
  boolEditor.selectValue('0'); assert.equal(boolean.value, true)
  boolEditor.selectValue(undefined); assert.equal(boolean.value, null)
})

test('date adapter only serializes DatePicker results, retains time and confirms after updating the draft', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const state = reactive({ field: { key: 'due', label: 'Due', type: 'datetime' }, value: '2026-09-16T14:30:45' })
  const confirmations = []
  const editor = scope.run(() => useFormValueEditor(state, { update: value => { state.value = value }, confirm() { confirmations.push(state.value) }, cancel() {}, navigate() {} }, () => 'zh', () => ['是', '否']))
  assert.equal(editor.date.value.locale(), 'zh-cn')
  assert.equal(state.value, '2026-09-16T14:30:45')
  editor.setDate('2026-10-20T09:10:11')
  assert.equal(state.value, '2026-10-20T09:10:11')
  editor.setDate(null)
  assert.equal(state.value, null)
  assert.deepEqual(confirmations, ['2026-10-20T09:10:11', null])
  state.field.type = 'date'
  editor.setDate('2026-10-21')
  assert.equal(state.value, '2026-10-21')
  editor.setDate(null)
  assert.equal(state.value, null)
})
