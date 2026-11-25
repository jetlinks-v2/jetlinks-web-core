import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, flush, textContent, walk } from './helpers/componentRuntime.mjs'

function mount(filename, props) {
  const forms = [], choices = [], inputs = []
  const capture = (records, props) => defineComponent({ props, emits: ['change', 'update:value'], setup(props, { emit, slots }) {
    records.push({ props, emit }); return () => h('div', records === choices ? slots.default?.() : undefined)
  } })
  const Form = capture(forms, ['groups', 'mode', 'submit', 'fields', 'values', 'validate'])
  const Component = createDashboardLoader({
    '../../src/components/InlineEditForm': { InlineEditForm: Form },
    '../../src/components/Form/FormRenderer.vue': { default: Form, __esModule: true },
    '../../src/components/Editable/index.vue': { default: capture(choices, ['value', 'type', 'componentProps']), __esModule: true },
    '../../src/components/Editable/InputEditable.vue': { default: capture(inputs, ['value', 'save']), __esModule: true },
  })(`../tests/public-ui/${filename}.vue`).default
  const { renderer, root } = createComponentRenderer()
  const app = renderer.createApp(Component, props)
  for (const name of ['a-button', 'a-checkbox', 'a-radio-group', 'a-switch', 'a-modal', 'a-input-number', 'a-input', 'a-select', 'AIcon']) app.component(name, defineComponent({ setup: (_props, { attrs, slots }) => () => h(name === 'a-button' ? 'button' : name, attrs, slots.default?.()) }))
  app.mount(root)
  const button = label => walk(root, node => node.type === 'button' && textContent(node) === label)[0]
  const fields = form => form.props.groups.flatMap(group => group.fields)
  return { app, root, forms, choices, inputs, button, fields }
}

test('each inline scene exposes only its own editing and save boundary', async t => {
  for (const [section, heading, formCount, choiceCount] of [
    ['values', '选择与日期', 0, 10], ['fields', '多类型原位编辑', 1, 0], ['form', '通用信息表单', 1, 0],
  ]) {
    const view = mount('InlineEditCases', { section }); t.after(() => view.app.unmount()); await flush()
    assert.deepEqual(walk(view.root, node => node.type === 'h2').map(textContent), [heading])
    assert.equal(view.forms.length, formCount)
    assert.equal(view.choices.length, choiceCount)
  }
})

test('creation and detail examples keep independent drafts and creation accepts only the whole form', async t => {
  const view = mount('Preview'); t.after(() => view.app.unmount()); await flush()
  const detail = view.forms.find(form => !form.props.mode), creation = view.forms.find(form => form.props.mode === 'form')
  const original = view.fields(detail).map(field => field.value)
  assert.deepEqual(view.fields(creation).map(field => field.value), ['', undefined])
  creation.emit('change', 'name', 'New record'); await flush()
  assert.deepEqual(view.fields(detail).map(field => field.value), original)
  assert.match(textContent(view.root), /最近接受：尚未保存/)
  assert.equal(creation.props.submit, undefined)
  view.button('保存新资料').props.onClick(); await flush()
  assert.match(textContent(view.root), /最近接受：New record/)
  view.button('清空草稿').props.onClick(); await flush()
  assert.deepEqual(view.fields(creation).map(field => field.value), ['', undefined])
  assert.deepEqual(view.fields(detail).map(field => field.value), original)
})

test('cleared date and time ranges render an empty state without throwing', async t => {
  const view = mount('InlineEditCases'); t.after(() => view.app.unmount()); await flush()
  for (const type of ['dateRange', 'timeRange']) view.choices.find(choice => choice.props.type === type).emit('update:value', null)
  await flush()
  assert.equal((textContent(view.root).match(/未设置/g) || []).length, 2)
})

test('example validation rejects invalid ranges and successful secret replacement retains no cleartext', async t => {
  const view = mount('InlineEditCases'); t.after(() => view.app.unmount()); await flush()
  const detail = view.forms.find(form => form.props.groups)
  const before = view.fields(detail).find(field => field.key === 'limits').initialValue
  assert.equal((await detail.props.submit('limits', { min: 10, max: 1 })).ok, false)
  assert.deepEqual(view.fields(detail).find(field => field.key === 'limits').initialValue, before)
  detail.emit('change', 'token', 'fictional-secret'); await flush()
  await detail.props.submit('token', 'fictional-secret'); await flush()
  const secret = view.fields(detail).find(field => field.key === 'token')
  assert.equal(secret.value, '')
  assert.equal(secret.initialValue, '')
  assert.equal(secret.secretSet, true)
  assert.ok(!textContent(view.root).includes('fictional-secret'))
})

test('form-level simulated failure preserves the accepted baseline and supports a real retry', async t => {
  const view = mount('InlineEditCases'); t.after(() => view.app.unmount()); await flush()
  const form = view.forms.find(form => form.props.fields)
  const initial = { ...form.props.values }
  const checkbox = walk(view.root, node => node.type === 'a-checkbox' && textContent(node).includes('整表请求异常'))[0]
  checkbox.props['onUpdate:checked'](true); await flush()
  await assert.rejects(form.props.submit({ name: 'Changed' }), /模拟整表请求异常/)
  assert.deepEqual(form.props.values, initial)
  await form.props.submit({ name: 'Changed' }); await flush()
  assert.equal(form.props.values.name, 'Changed')
  assert.match(textContent(view.root), /整表模拟请求 2 次，成功 1 次/)
  assert.ok(form.props.validate({ interval: null }, { key: 'sampling' }))
  assert.equal(form.props.validate({ interval: 30 }, { key: 'sampling' }), undefined)
})

test('the asynchronous input example can hold, reject, throw and then accept a response without a false success', async t => {
  const view = mount('AsyncInlineEditCase'); t.after(() => view.app.unmount()); await flush()
  const input = view.inputs[0]
  const outcome = walk(view.root, node => node.type === 'a-radio-group')[0]
  for (const response of ['rejected', 'thrown', 'success']) {
    outcome.props['onUpdate:value'](response); await flush()
    const pending = input.props.save('Changed')
    await flush()
    assert.equal(input.props.value, '北侧机房')
    assert.equal(view.button('返回模拟结果').props.disabled, false)
    const result = response === 'thrown' ? assert.rejects(pending, /simulated response failure/) : pending
    view.button('返回模拟结果').props.onClick(); await flush()
    if (response === 'thrown') await result
    else assert.equal(await result, response === 'success')
  }
  assert.match(textContent(view.root), /模拟请求 3 次，成功 1 次/)
})
