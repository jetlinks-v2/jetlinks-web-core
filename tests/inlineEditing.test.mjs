import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, walk } from './helpers/componentRuntime.mjs'

const flush = async () => { await nextTick(); await nextTick() }
const boundaries = {
  'vue-i18n': { useI18n: () => ({ locale: ref('zh'), t: key => key }) },
  '@vueuse/core': { useElementVisibility: () => ref(false) },
}
const InputEditable = createDashboardLoader(boundaries)('components/Editable/InputEditable.vue').default
const TranslationEditor = createDashboardLoader(boundaries)('components/I18n/I18nTextEditor.vue').default
const I18nEditable = createDashboardLoader({ ...boundaries, '../Editable/InputEditable.vue': { default: InputEditable, __esModule: true }, './I18nTextEditor.vue': { default: TranslationEditor, __esModule: true } })('components/I18n/I18nTextEditable.vue').default

function mount(component, extra = {}, slots = {}) {
  const props = reactive({ value: '原名称', ...extra }), values = [], changes = [], translations = [], focusCalls = []
  const { renderer, root } = createComponentRenderer()
  const Input = defineComponent({ inheritAttrs: false, setup: (_props, { attrs, expose }) => {
    expose({ focus(options) { focusCalls.push(options) } })
    return () => h('input', attrs)
  } })
  const Textarea = defineComponent({ inheritAttrs: false, setup: (_props, { attrs, expose }) => {
    expose({ focus(options) { focusCalls.push(options) } })
    return () => h('textarea', attrs)
  } })
  const Form = defineComponent({ setup: (_props, { slots, expose }) => {
    expose({ validate: async () => {}, resetFields() {} })
    return () => h('form', slots.default?.())
  } })
  const Popover = defineComponent({ props: ['open'], setup: (props, { slots }) => () => h('div', { 'data-popover': true }, [slots.default?.(), props.open && slots.content?.()]) })
  const Tabs = defineComponent({ props: ['activeKey'], emits: ['update:activeKey'], setup: (props, { slots, emit }) => () => h('div', { 'data-active-language': props.activeKey, onSelectLanguage: value => emit('update:activeKey', value) }, slots.default?.()) })
  const app = renderer.createApp({ setup: () => () => h(component, {
    ...props, 'onUpdate:value': value => { values.push(value); props.value = value },
    'onUpdate:i18nMessages': value => { translations.push(value); props.i18nMessages = value },
    onChange: value => changes.push(value),
  }, slots) })
  app.config.globalProperties.$t = key => key
  app.component('a-input', Input).component('a-textarea', Textarea).component('a-form', Form).component('a-popover', Popover).component('a-tabs', Tabs)
  for (const name of ['j-ellipsis', 'a-form-item', 'a-typography-text', 'a-tab-pane']) app.component(name, defineComponent({ setup: (_props, { slots }) => () => h('span', slots.default?.()) }))
  app.component('a-button', defineComponent({ setup: (_props, { slots }) => () => h('button', slots.default?.()) }))
  app.component('AIcon', defineComponent({ setup: () => () => h('i') }))
  app.mount(root)
  const find = predicate => walk(root, predicate)[0]
  const input = () => find(node => ['input', 'textarea'].includes(node.type))
  const start = async () => { find(node => node.type === 'button' && node.props.onClick)?.props.onClick(); await flush() }
  const update = async value => { input().props['onUpdate:value'](value); await flush() }
  const open = async () => { find(node => node.props['data-popover']).props.onOpenChange(true); await flush() }
  const pressButton = async key => { find(node => node.type === 'button' && node.children.some(child => child.text === key)).props.onClick(); await flush() }
  return { app, root, props, values, changes, translations, focusCalls, find, input, start, update, open, pressButton }
}

test('InputEditable keeps a draft while focus moves into its action and commits once only after leaving the whole field', async t => {
  const view = mount(InputEditable, {}, { action: () => h('button', 'extension') }); t.after(() => view.app.unmount())
  await view.start(); await view.update('草稿')
  assert.deepEqual(view.focusCalls, [{ preventScroll: true }])
  const inside = {}, scope = { contains: value => value === inside, ownerDocument: { activeElement: inside } }
  const root = view.find(node => String(node.props.class || '').includes('input-editable--'))
  await root.props.onFocusout({ currentTarget: scope, relatedTarget: inside })
  assert.deepEqual(view.values, []); assert.equal(view.input().props.value, '草稿')
  scope.ownerDocument.activeElement = null
  await root.props.onFocusout({ currentTarget: scope, relatedTarget: null }); await flush()
  assert.deepEqual(view.values, ['草稿']); assert.deepEqual(view.changes, ['草稿'])
})

const keyEvent = (key, extra = {}) => ({ key, preventDefault() {}, stopPropagation() {}, ...extra })

test('multiline input preserves paragraphs, ignores blur and plain Enter, and commits on Ctrl/Cmd+Enter', async t => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    const view = mount(InputEditable, { textarea: true, value: '第一段\n第二段' }); t.after(() => view.app.unmount())
    await view.start(); await view.update('第一段\n第二段\n补充')
    await view.input().props.onKeydown(keyEvent('Enter'))
    const root = view.find(node => String(node.props.class || '').includes('input-editable--'))
    await root.props.onFocusout({}); await flush()
    assert.deepEqual(view.values, [])
    await view.input().props.onKeydown(keyEvent('Enter', { [modifier]: true, isComposing: true })); await flush()
    assert.deepEqual(view.values, [])
    await view.input().props.onKeydown(keyEvent('Enter', { [modifier]: true })); await flush()
    assert.deepEqual(view.values, ['第一段\n第二段\n补充'])
    assert.equal(view.input(), undefined)
  }
})

test('multiline cancel restores the baseline, and failed or pending saves preserve the draft without duplicate writes', async t => {
  let finish, calls = 0
  const view = mount(InputEditable, { textarea: true, save: () => { calls++; return new Promise(resolve => { finish = resolve }) } }); t.after(() => view.app.unmount())
  await view.start(); await view.update('未保存\n多行')
  await view.pressButton('Editable.save')
  await view.input().props.onKeydown(keyEvent('Enter', { ctrlKey: true })); await flush()
  assert.equal(calls, 1)
  finish(false); await flush()
  assert.deepEqual(view.values, []); assert.equal(view.input().props.value, '未保存\n多行')
  await view.input().props.onKeydown(keyEvent('Escape')); await flush()
  assert.equal(view.input(), undefined); assert.equal(view.props.value, '原名称')
})

test('multiline translation handoff and language changes share one draft and one confirmation', async t => {
  const view = mount(I18nEditable, { textarea: true, field: 'description', label: '说明', value: '原说明\n第二段', i18nMessages: { description: { zh: '原说明\n第二段', en: 'Original', fr: 'Conservé' }, name: { en: 'Name' } } }); t.after(() => view.app.unmount())
  await view.start(); await view.update('新说明\n保留换行'); await view.open()
  assert.deepEqual(view.values, [])
  const tabs = view.find(node => node.props['data-active-language'] === 'zh')
  const languageInput = label => view.find(node => node.type === 'textarea' && node.props['aria-label'] === label)
  languageInput('English').props['onUpdate:value']('First paragraph\nSecond paragraph')
  tabs.props.onSelectLanguage('en'); await flush()
  tabs.props.onSelectLanguage('zh'); await flush()
  assert.equal(languageInput('中文').props.value, '新说明\n保留换行')
  assert.equal(languageInput('English').props.value, 'First paragraph\nSecond paragraph')
  await view.pressButton('I18n.confirm')
  assert.deepEqual(view.values, ['新说明\n保留换行']); assert.equal(view.changes.length, 1)
  assert.deepEqual(view.translations[0], { description: { zh: '新说明\n保留换行', en: 'First paragraph\nSecond paragraph', fr: 'Conservé' }, name: { en: 'Name' } })
})

test('InputEditable does not submit the Enter key used to confirm an IME composition', async t => {
  const view = mount(InputEditable); t.after(() => view.app.unmount())
  await view.start(); await view.update('入力中')
  await view.input().props.onPressEnter({ isComposing: true }); await flush()
  assert.deepEqual(view.values, [])
  await view.input().props.onPressEnter({ isComposing: false }); await flush()
  assert.deepEqual(view.values, ['入力中'])
})

test('translation handoff retains the text draft locally; Cancel discards it without publishing value or translations', async t => {
  const view = mount(I18nEditable, { field: 'name', label: '名称', i18nMessages: { name: { zh: '原名称', en: 'Original' } } }); t.after(() => view.app.unmount())
  await view.start(); await view.update('未确认名称'); await view.open()
  assert.deepEqual(view.values, []); assert.deepEqual(view.translations, [])
  assert.equal(view.input().props.value, '未确认名称')
  await view.pressButton('I18n.cancel')
  assert.deepEqual(view.values, []); assert.deepEqual(view.translations, []); assert.equal(view.props.value, '原名称')
})

test('translation confirmation publishes one bundle, reads platform languages, and preserves unexposed languages and other fields', async t => {
  const view = mount(I18nEditable, { field: 'name', label: '名称', i18nMessages: { name: { zh: '原名称', en: 'Original', de: 'Originalname' }, description: { en: 'Description' } } }); t.after(() => view.app.unmount())
  await view.start(); await view.update('新名称'); await view.open()
  const formItems = walk(view.root, node => node.props.name && ['zh', 'en', 'ja'].includes(node.props.name))
  assert.deepEqual(formItems.map(node => node.props.name), ['zh', 'en', 'ja'])
  const japanese = formItems.find(node => node.props.name === 'ja')
  walk(japanese, node => node.type === 'input')[0].props['onUpdate:value']('新しい名前'); await flush()
  await view.pressButton('I18n.confirm')
  assert.deepEqual(view.values, ['新名称']); assert.equal(view.changes.length, 1)
  assert.deepEqual(view.translations[0], { name: { zh: '新名称', en: 'Original', ja: '新しい名前', de: 'Originalname' }, description: { en: 'Description' } })
})

test('opening a missing translation leaves fallback text as a placeholder instead of copying it into translation data', async t => {
  const view = mount(I18nEditable, { field: 'name', label: '名称', i18nMessages: { name: { en: 'Original' } } }); t.after(() => view.app.unmount())
  await view.open()
  assert.equal(view.input().props.value, '')
  await view.pressButton('I18n.confirm')
  assert.equal(Object.hasOwn(view.translations[0].name, 'zh'), false)
  assert.equal(view.translations[0].name.en, 'Original')
  assert.equal(view.props.value, '原名称', 'confirming an empty translation must preserve its displayed fallback')
})
