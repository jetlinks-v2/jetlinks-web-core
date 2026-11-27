import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
import { createComponentRenderer, textContent, walk } from './helpers/componentRuntime.mjs'

const flush = async () => { await nextTick(); await nextTick() }
const boundaries = {
  'vue-i18n': { useI18n: () => ({ locale: ref('zh'), t: key => key }) },
  '@vueuse/core': { useElementVisibility: () => ref(false), useMediaQuery: () => ref(false) },
}
const InputEditable = createDashboardLoader(boundaries)('components/Editable/InputEditable.vue').default
const TranslationInput = defineComponent({ inheritAttrs:false, setup:(_props,{attrs,expose}) => { expose({focus(){}}); return () => h('input',attrs) } })
const TranslationTextarea = defineComponent({ inheritAttrs:false, setup:(_props,{attrs,expose}) => { expose({focus(){}}); return () => h('textarea',attrs) } })
const TranslationTab = defineComponent({ setup:(_props,{slots}) => () => h('span',[slots.tab?.(),slots.default?.()]) })
const TranslationTabs = Object.assign(defineComponent({ props:['activeKey'], setup:(props,{slots,emit}) => () => h('div',{'data-active-language':props.activeKey,onSelectLanguage:key=>emit('update:activeKey',key)},slots.default?.()) }),{TabPane:TranslationTab})
const TranslationButton = defineComponent({ setup:(_props,{slots}) => () => h('button',slots.default?.()) })
const TranslationEditor = createDashboardLoader({...boundaries,'ant-design-vue':{Input:Object.assign(TranslationInput,{TextArea:TranslationTextarea}),Tabs:TranslationTabs,Button:TranslationButton}})('components/I18n/I18nTextEditor.vue').default
const I18nEditable = createDashboardLoader({ ...boundaries, '../Editable/InputEditable.vue': { default: InputEditable, __esModule: true }, './I18nTextEditor.vue': { default: TranslationEditor, __esModule: true } })('components/I18n/I18nTextEditable.vue').default

test('translation drafts retain their editor across a breakpoint and choose the new surface on reopening', async t => {
  const narrow = ref(false)
  const shell = type => defineComponent({ setup: (_props, { slots }) => () => h(type, slots.default?.()) })
  const responsive = { ...boundaries, '@vueuse/core': { ...boundaries['@vueuse/core'], useMediaQuery: () => narrow },
    './I18nTextEditor.vue': { default: TranslationEditor, __esModule: true } }
  const Dialog = createDashboardLoader({ ...responsive, 'ant-design-vue': { Modal: shell('modal'), Drawer: shell('drawer'), Button: TranslationButton } })('components/I18n/I18nTextDialog.vue').default
  const Inline = createDashboardLoader({ ...responsive, '../Editable/InputEditable.vue': { default: InputEditable, __esModule: true },
    './I18nTextDialog.vue': { default: Dialog, __esModule: true } })('components/I18n/I18nTextEditable.vue').default
  const view = mount(Inline, { field: 'name', label: '名称' }); t.after(() => view.app.unmount())
  await view.open(); await view.update('未确认译文')
  const input = view.input()
  narrow.value = true; await flush()
  assert.equal(view.input(), input)
  assert.equal(input.props.value, '未确认译文')
  await view.pressButton('I18n.cancel'); await view.open()
  assert.ok(view.find(node => node.type === 'drawer'))
  await view.update('手机草稿')
  const mobileInput = view.input()
  narrow.value = false; await flush()
  assert.equal(view.input(), mobileInput)
  assert.equal(mobileInput.props.value, '手机草稿')
  assert.deepEqual(view.values, [])
})
const Choice = defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h('div', [h('input', attrs), slots.dropdownRender?.({ menuNode: h('div') })]) })
const Editable = createDashboardLoader({ ...boundaries, 'ant-design-vue': {
  Input: Choice, InputNumber: Choice, Select: Choice,
  DatePicker: Object.assign({}, Choice, { RangePicker: Choice }), TimePicker: Choice, TimeRangePicker: Choice,
} })('components/Editable/index.vue').default

function mount(component, extra = {}, slots = {}, validate = async () => {}) {
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
    expose({ validate, resetFields() {} })
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
  const start = async () => { find(node => (node.type === 'button' || node.props.role === 'button') && node.props.onClick)?.props.onClick(); await flush() }
  const update = async value => { input().props['onUpdate:value'](value); await flush() }
  const open = async () => { find(node => node.props['data-popover'] && node.props.onOpenChange).props.onOpenChange(true); await flush() }
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
  const languageInput = () => view.find(node => node.type === 'textarea')
  tabs.props.onSelectLanguage('en'); await flush()
  languageInput().props['onUpdate:value']('First paragraph\nSecond paragraph'); await flush()
  tabs.props.onSelectLanguage('zh'); await flush()
  assert.equal(languageInput().props.value, '新说明\n保留换行')
  tabs.props.onSelectLanguage('en'); await flush()
  assert.equal(languageInput().props.value, 'First paragraph\nSecond paragraph')
  await view.pressButton('I18n.apply')
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

test('single-line confirmation prevents an enclosing form submission without blocking IME confirmation', async t => {
  const view = mount(InputEditable); t.after(() => view.app.unmount())
  await view.start(); await view.update('确认一次')
  let prevented = 0
  view.input().props.onKeydown(keyEvent('Enter', { isComposing: true, preventDefault() { prevented++ } }))
  assert.equal(prevented, 0)
  view.input().props.onKeydown(keyEvent('Enter', { preventDefault() { prevented++ } }))
  await view.input().props.onPressEnter({ isComposing: false }); await flush()
  assert.equal(prevented, 1)
  assert.deepEqual(view.values, ['确认一次'])
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
  const tabs = view.find(node => node.props['data-active-language'])
  tabs.props.onSelectLanguage('ja'); await flush()
  view.input().props['onUpdate:value']('新しい名前'); await flush()
  tabs.props.onSelectLanguage('zh'); await flush()
  assert.equal(view.input().props.value, '新名称')
  await view.pressButton('I18n.apply')
  assert.deepEqual(view.values, ['新名称']); assert.equal(view.changes.length, 1)
  assert.deepEqual(view.translations[0], { name: { zh: '新名称', en: 'Original', ja: '新しい名前', de: 'Originalname' }, description: { en: 'Description' } })
})

test('opening a missing translation leaves fallback text as a placeholder instead of copying it into translation data', async t => {
  const view = mount(I18nEditable, { field: 'name', label: '名称', i18nMessages: { name: { en: 'Original' } } }); t.after(() => view.app.unmount())
  await view.open()
  assert.equal(view.input().props.value ?? '', '')
  await view.pressButton('I18n.apply')
  assert.equal(Object.hasOwn(view.translations[0].name, 'zh'), false)
  assert.equal(view.translations[0].name.en, 'Original')
  assert.equal(view.props.value, '原名称', 'confirming an empty translation must preserve its displayed fallback')
})

test('queued blur is invalidated by unmount or cancelling and reopening the field', async () => {
  for (const unmount of [true, false]) {
    let calls = 0
    const view = mount(InputEditable, { save: async () => { calls++; return true } })
    await view.start(); await view.update('旧草稿')
    const root = view.find(node => String(node.props.class || '').includes('input-editable--'))
    const queued = root.props.onFocusout({ currentTarget: { contains: () => false, ownerDocument: { activeElement: null } }, relatedTarget: null })
    if (unmount) view.app.unmount()
    else {
      view.input().props.onKeydown(keyEvent('Escape'))
      await view.start(); await view.update('新草稿')
    }
    await queued
    assert.equal(calls, 0)
    if (!unmount) view.app.unmount()
  }
})

test('single-line keyboard completion returns focus, while pointer blur respects the next target', async t => {
  for (const key of ['Enter', 'Escape']) {
    const view = mount(InputEditable); t.after(() => view.app.unmount())
    const trigger = view.find(node => node.type === 'button' && node.props.onClick)
    await view.start(); await view.update('新名称')
    if (key === 'Enter') await view.input().props.onPressEnter({ isComposing: false })
    else view.input().props.onKeydown(keyEvent(key))
    await flush()
    assert.deepEqual(trigger.focused, { preventScroll: true })
  }
  const view = mount(InputEditable); t.after(() => view.app.unmount())
  const trigger = view.find(node => node.type === 'button' && node.props.onClick)
  await view.start(); await view.update('移开后保存')
  await view.find(node => node.props.onFocusout).props.onFocusout({ currentTarget: { contains: () => false, ownerDocument: { activeElement: {} } }, relatedTarget: null })
  await flush()
  assert.equal(trigger.focused, undefined)
})

test('a thrown save keeps the input and provides a recoverable field error', async t => {
  const view = mount(InputEditable, { save: async () => { throw new Error('offline') } }); t.after(() => view.app.unmount())
  await view.start(); await view.update('未保存')
  await view.input().props.onPressEnter({ isComposing: false }); await flush()
  assert.equal(view.input().props.value, '未保存')
  assert.equal(view.input().props.status, 'error')
  assert.deepEqual(view.values, [])
  assert.ok(view.find(node => node.props.role === 'alert'))
})

test('the blur caused by a pending save cannot automatically retry a failed submission', async t => {
  let finish, calls = 0
  const view = mount(InputEditable, { save: () => ++calls === 1 ? new Promise(resolve => { finish = resolve }) : Promise.resolve(false) }); t.after(() => view.app.unmount())
  await view.start(); await view.update('draft')
  const saved = view.input().props.onPressEnter({ isComposing: false })
  finish(false)
  const blurred = view.find(node => node.props.onFocusout).props.onFocusout({ currentTarget: { contains: () => false, ownerDocument: { activeElement: null } }, relatedTarget: null })
  await Promise.all([saved, blurred]); await flush()
  assert.equal(calls, 1)
  assert.ok(view.input())
})

test('the inline measurement retains its saved text while the editor owns an unconfirmed draft', async t => {
  for (const type of ['string', 'number', 'select', 'date', 'time', 'dateRange', 'timeRange']) {
    const view = mount(Editable, { type, value: type.endsWith('Range') ? ['start', 'end'] : 'original' }); t.after(() => view.app.unmount())
    const trigger = () => view.find(node => String(node.props.class || '').split(' ').includes('text'))
    const baseline = textContent(trigger())
    await view.start(); await view.update(type.endsWith('Range') ? ['a much longer draft', 'end'] : 'a much longer draft')
    assert.equal(textContent(trigger()), baseline)
    assert.deepEqual(view.values, [])
  }
})

test('multi-select and tags keep all choices as one draft until explicit confirmation or cancellation', async t => {
  for (const mode of ['multiple', 'tags']) {
    const view = mount(Editable, { value: ['one'], type: 'select', componentProps: { mode, options: [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }] } }); t.after(() => view.app.unmount())
    await view.start(); await view.update(['one', 'two'])
    assert.equal(view.input().props.open, true)
    assert.equal(view.input().props['max-tag-count'], 0)
    assert.equal(view.input().props['max-tag-placeholder'](), 'One, Two')
    view.input().props.onChange(['one', 'two']); await flush()
    assert.deepEqual(view.values, [])
    await view.find(node => node.props.onFocusout).props.onFocusout({})
    assert.ok(view.input())
    await view.pressButton('Editable.save')
    assert.deepEqual(view.values, [['one', 'two']])
    await view.start(); await view.update(['two'])
    view.input().props.onDropdownVisibleChange(false); await flush()
    view.find(node => node.props.onKeydown).props.onKeydown(keyEvent('Escape')); await flush()
    assert.deepEqual(view.props.value, ['one', 'two'])
    assert.equal(!!view.input(), false)
  }
})

test('an explicitly closed multi-select popup leaves Escape available to cancel the field', async t => {
  const view = mount(Editable, { value: ['one'], type: 'select', componentProps: { mode: 'multiple', open: false, defaultOpen: true } }); t.after(() => view.app.unmount())
  await view.start()
  assert.equal(view.input().props.open, false)
  view.find(node => node.props.onKeydown).props.onKeydown(keyEvent('Escape')); await flush()
  assert.equal(!!view.input(), false)
  assert.deepEqual(view.values, [])
})

test('choice popups own Enter and the first Escape; only native change commits a completed value', async t => {
  for (const type of ['select', 'date', 'time', 'dateRange', 'timeRange']) {
    const initial = type.endsWith('Range') ? ['2026-11-01', '2026-11-07'] : 'one'
    const next = type.endsWith('Range') ? ['2026-11-02', '2026-11-08'] : 'two'
    const view = mount(Editable, { type, value: initial }); t.after(() => view.app.unmount())
    await view.start()
    const root = view.find(node => node.props.onFocusout)
    const open = view.input().props[type === 'select' ? 'onDropdownVisibleChange' : 'onOpenChange']
    open(true)
    root.props.onKeydown(keyEvent('Enter')); root.props.onKeydown(keyEvent('Escape')); await flush()
    assert.ok(view.input()); assert.deepEqual(view.values, [])
    const escape = keyEvent('Escape')
    root.props.onKeydownCapture(escape)
    open(false)
    root.props.onKeydown(escape); await flush()
    assert.ok(view.input(), 'closing a popup before bubbling Escape must not cancel its field')
    view.input().props.onChange(next); await flush()
    assert.deepEqual(view.values, [next])
    assert.deepEqual(view.find(node => node.props.role === 'button').focused, { preventScroll: true })
  }
})

test('translation cancellation discards a draft and a later session initializes from the saved baseline', async t => {
  const view = mount(I18nEditable, { field: 'name', label: '名称' }); t.after(() => view.app.unmount())
  await view.open(); await view.update('discarded'); await view.pressButton('I18n.cancel')
  await view.open()
  assert.equal(view.input().props.value ?? '', '')
  assert.deepEqual(view.values, []); assert.deepEqual(view.translations, [])
})
