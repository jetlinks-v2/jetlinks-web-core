import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, nextTick, reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import type { FormInstance } from 'ant-design-vue'
import { useI18nTextField } from '../src/components/I18n/hooks/useI18nTextField'
import { useI18nTextDialog } from '../src/components/I18n/hooks/useI18nTextDialog'
import type { I18nTextFieldProps, I18nTextDialogProps, I18nMessages } from '../src/components/I18n/types'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import ja from '../src/locales/lang/ja.json'
import { languageOptions } from '../src/locales/languages'

// 使用 Vue 的公开自定义渲染接口，为 composable 提供真实组件和 i18n 上下文。
const renderer = createRenderer<object, object>({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert: () => {},
  remove: () => {},
  setText: () => {},
  setElementText: () => {},
  patchProp: () => {},
  parentNode: () => null,
  nextSibling: () => null,
})

function mountHook<T>(locale: string, setup: () => T) {
  let state: T | undefined
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'zh', messages: { zh, en, ja }, missingWarn: false, fallbackWarn: false })
  const app = renderer.createApp(defineComponent({ setup() {
    state = setup()
    return () => null
  } }))
  app.use(i18n)
  app.mount({})
  assert.ok(state)
  return { state, i18n, unmount: () => app.unmount() }
}

function mountField(locale: string, field: string) {
  const original: I18nMessages = {
    [field]: { zh: '原值', en: 'Original', fr: 'Original français' },
    other: { zh: '其他字段' },
  }
  const props = reactive<I18nTextFieldProps>({ field, label: field, value: '原值', i18nMessages: original })
  const mounted = mountHook(locale, () => useI18nTextField(props, (event, value) => {
    if (event === 'update:value') props.value = value as string
    else props.i18nMessages = value as I18nMessages
  }))
  return { ...mounted, props, original }
}

for (const [locale, language] of [['zh-CN', 'zh'], ['en-US', 'en'], ['en_US', 'en']]) {
  for (const field of ['name', 'description']) {
    test(`${locale} ${field}: input, clear and dialog confirmation keep both bindings consistent`, () => {
      const mounted = mountField(locale, field)
      try {
        const { state, props, original } = mounted
        state.handleValueChange('  Edited  ')
        assert.equal(props.value, '  Edited  ')
        assert.equal(props.i18nMessages?.[field][language], 'Edited')
        assert.equal(props.i18nMessages?.[field].fr, 'Original français')
        assert.deepEqual(props.i18nMessages?.other, { zh: '其他字段' })
        assert.equal(original[field][language], language === 'zh' ? '原值' : 'Original')
        state.handleValueChange(undefined)
        assert.equal(props.value, '')
        assert.equal(props.i18nMessages?.[field][language], undefined)
        state.saveI18nMessages({ zh: '中文', en: 'English', fr: 'Français' })
        assert.equal(props.value, language === 'zh' ? '中文' : 'English')
        assert.deepEqual(props.i18nMessages?.other, { zh: '其他字段' })
        state.saveI18nMessages({ fr: 'Français' })
        assert.equal(props.value, language === 'zh' ? '中文' : 'English', 'missing translation keeps its displayed fallback')
      } finally {
        mounted.unmount()
      }
    })
  }
}

test('an empty field can be edited and the active locale is reactive', () => {
  const props = reactive<I18nTextFieldProps>({ field: 'name', label: 'Name' })
  const mounted = mountHook('zh-CN', () => useI18nTextField(props, (event, value) => {
    if (event === 'update:value') props.value = value as string
    else props.i18nMessages = value as I18nMessages
  }))
  try {
    mounted.state.handleValueChange('中文')
    mounted.i18n.global.locale.value = 'en'
    mounted.state.handleValueChange('English')
    assert.deepEqual(props.i18nMessages, { name: { zh: '中文', en: 'English' } })
    mounted.state.handleValueChange('   ')
    assert.deepEqual(props.i18nMessages, { name: { zh: '中文' } })
  } finally {
    mounted.unmount()
  }
})

test('standalone dialog isolates drafts, cancels without submitting and reinitializes on reopen', async () => {
  const props = reactive<I18nTextDialogProps>({ visible: true, title: 'Name', data: { en: 'Original' }, displayValue: '中文', maxLength: 64 })
  const events: unknown[][] = []
  const mounted = mountHook('zh-CN', () => useI18nTextDialog(props, (...args) => { events.push(args) }))
  try {
    assert.deepEqual(mounted.state.formData, { en: 'Original', zh: '', ja: '' })
    assert.equal(mounted.state.activeLanguage.value, 'zh')
    mounted.state.formData.en = 'Unsaved'
    mounted.state.handleCancel()
    assert.deepEqual(events, [['update:visible', false]])
    assert.deepEqual(props.data, { en: 'Original' })
    props.visible = false
    await nextTick()
    props.data = { zh: 'New source', fr: 'Conservé' }
    props.visible = true
    await nextTick()
    assert.deepEqual(mounted.state.formData, { zh: 'New source', en: '', ja: '', fr: 'Conservé' })
  } finally {
    mounted.unmount()
  }
})

test('dialog submits trimmed nonempty translations only after validation, preserving other languages', async () => {
  const props = reactive<I18nTextDialogProps>({ visible: true, title: 'Description', data: { zh: '  中文  ', en: ' ', fr: 'Français' }, maxLength: 3 })
  const events: unknown[][] = []
  const mounted = mountHook('zh', () => useI18nTextDialog(props, (...args) => { events.push(args) }))
  try {
    let validateCalls = 0
    mounted.state.formRef.value = {
      validate: async () => { validateCalls++; throw { errorFields: [{ name: ['en'], errors: ['too long'] }] } },
    } as unknown as FormInstance
    assert.equal(mounted.state.rules.value.zh[0].max, 3)
    await mounted.state.handleOk()
    assert.equal(validateCalls, 1)
    assert.equal(mounted.state.activeLanguage.value, 'en', 'validation reveals the language containing an error')
    assert.deepEqual(events, [], 'invalid form stays open without submitting')
    mounted.state.formRef.value = { validate: async () => ({}) } as unknown as FormInstance
    await mounted.state.handleOk()
    assert.deepEqual(events, [['confirm', { zh: '中文', fr: 'Français' }], ['update:visible', false]])
    assert.deepEqual(props.data, { zh: '  中文  ', en: ' ', fr: 'Français' })
  } finally {
    mounted.unmount()
  }
})

test('one confirmation runs at a time and cancelled validation cannot publish into a reopened draft', async () => {
  const props = reactive<I18nTextDialogProps>({ visible: true, title: 'Description', textarea: true, data: { zh: '原说明' } })
  const events: unknown[][] = []
  const mounted = mountHook('ja-JP', () => useI18nTextDialog(props, (...args) => { events.push(args) }))
  try {
    let finish!: () => void
    let calls = 0
    mounted.state.formRef.value = {
      validate: () => { calls++; return new Promise<void>(resolve => { finish = resolve }) }, resetFields() {},
    } as unknown as FormInstance
    assert.equal(mounted.state.activeLanguage.value, 'ja')
    const pending = mounted.state.handleOk()
    await mounted.state.handleOk()
    assert.equal(calls, 1)
    mounted.state.handleCancel()
    props.visible = false
    await nextTick()
    props.data = { zh: '另一份草稿' }
    props.visible = true
    await nextTick()
    finish(); await pending
    assert.deepEqual(events, [['update:visible', false]])
    assert.equal(mounted.state.formData.zh, '另一份草稿')
  } finally {
    mounted.unmount()
  }
})

test('unmount invalidates an outstanding translation confirmation', async () => {
  const events: unknown[][] = []
  const mounted = mountHook('zh', () => useI18nTextDialog({ visible: true, title: 'Description', textarea: true }, (...args) => { events.push(args) }))
  let finish!: () => void
  mounted.state.formRef.value = { validate: () => new Promise<void>(resolve => { finish = resolve }) } as unknown as FormInstance
  const pending = mounted.state.handleOk()
  mounted.unmount()
  finish(); await pending
  assert.deepEqual(events, [])
})

test('core-only locales provide all labels and validation messages', () => {
  for (const { value: locale } of languageOptions) {
    const mounted = mountHook(locale, () => useI18nTextDialog({ visible: false, title: 'Name', maxLength: 64 }, () => {}))
    try {
      const { t } = mounted.i18n.global
      for (const key of ['configure', 'chinese', 'english', 'placeholder', 'maxLength', 'cancel', 'confirm', 'fallback']) {
        const code = `I18n.${key}`
        const value = t(code, { language: 'English', max: 64, value: '原文' })
        assert.notEqual(value, code)
        assert.ok(!value.includes('{max}') && !value.includes('{language}'))
      }
      assert.deepEqual(mounted.state.languages.value, languageOptions.map(({ value: code, label }) => ({ code, label })))
      assert.match(String(mounted.state.rules.value.en[0].message), /64/)
      for (const key of ['Editable.save', 'Editable.cancel']) assert.notEqual(t(key), key)
    } finally {
      mounted.unmount()
    }
  }
})
