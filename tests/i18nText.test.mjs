import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { buildSync } from 'esbuild'
import { effectScope, nextTick, reactive, ref } from 'vue'

const require = createRequire(import.meta.url)
const locale = ref('zh')
function load(path) {
  const source = buildSync({ entryPoints: [resolve(import.meta.dirname, '../src/components', path)], bundle: true, platform: 'node', format: 'cjs', external: ['vue', 'vue-i18n'], write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('require', 'module', 'exports', source)(id => id === 'vue-i18n' ? { useI18n: () => ({ locale, t: key => key }) } : require(id), module, module.exports)
  return module.exports
}
const { resolveI18nText, updateI18nText } = load('I18n/text.ts')
const { formText, formLabel } = load('Form/text.ts')
const { useFormDesigner } = load('Form/useFormDesigner.ts')
const { useI18nTextDialog } = load('I18n/hooks/useI18nTextDialog.ts')
const { useI18nTextField } = load('I18n/hooks/useI18nTextField.ts')

test('locale resolution uses region, language and default without mutating plain strings or translations', () => {
  const messages = { zh: '名称', 'en-US': 'American name', en: 'Name', ja: '' }
  assert.equal(resolveI18nText('Default', messages, 'en_US'), 'American name')
  assert.equal(resolveI18nText('Default', messages, 'en-GB'), 'Name')
  assert.equal(resolveI18nText('Default', messages, 'ja'), 'Default')
  assert.equal(resolveI18nText('Default', { en: '  ' }, 'en'), 'Default')
  assert.equal(resolveI18nText('Default', undefined, 'fr'), 'Default')
  assert.deepEqual(updateI18nText(messages, 'en_US', ' Updated '), { ...messages, 'en-US': 'Updated' })
  assert.deepEqual(updateI18nText(messages, 'en-US', ''), { zh: '名称', en: 'Name', ja: '' })
  assert.equal(messages['en-US'], 'American name')
})

test('field metadata and layout text have explicit inheritance; translating labels never changes stable identities', () => {
  const field = { key: 'custom.height', label: '高度', unit: '米', description: '离地高度', i18nMessages: { label: { en: 'Height' }, unit: { en: 'm' }, description: { en: 'Above ground' } } }
  assert.equal(formLabel(field, { key: field.key, i18nMessages: { label: { zh: '安装高度' } } }, 'en'), 'Height')
  assert.equal(formLabel(field, { key: field.key, label: 'Default override' }, 'en'), 'Default override')
  assert.equal(formText(field, 'unit', 'en'), 'm')
  assert.equal(formText(field, 'description', 'en-US'), 'Above ground')
  const option = { value: false, label: '否', i18nMessages: { label: { en: 'No' } } }
  assert.equal(formText(option, 'label', 'en'), 'No')
  assert.equal(option.value, false)
  assert.equal(field.key, 'custom.height')
})

test('designer translations share layout undo; switching locale confirms names in their original language', async t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const field = { key: 'name', label: '名称', type: 'text', i18nMessages: { label: { en: 'Name' } } }
  const state = reactive({ locale: 'zh', layout: { version: 1, sections: [{ id: 'basic', label: '基本信息', i18nMessages: { label: { en: 'Basic' } }, items: [{ key: 'name' }] }] } })
  const designer = scope.run(() => useFormDesigner({ fields: () => [field], layout: () => state.layout, sampleValues: () => ({}), update: value => { state.layout = value }, sectionLabel: () => ({ label: 'New' }), locale: () => state.locale }, ref()))
  designer.editTitle('name'); designer.titleDraft.value = '设备名称'
  state.locale = 'en'
  assert.equal(formLabel(field, state.layout.sections[0].items[0], 'zh'), '设备名称')
  assert.equal(formLabel(field, state.layout.sections[0].items[0], 'en'), 'Name')
  designer.editTranslations('field', 'name'); designer.saveTranslations({ zh: '设备名称', en: 'Device name', ja: '名前' })
  assert.equal(formLabel(field, state.layout.sections[0].items[0], 'en'), 'Device name')
  designer.undo()
  assert.equal(formLabel(field, state.layout.sections[0].items[0], 'en'), 'Name')
  designer.editSection(state.layout.sections[0]); designer.sectionDraft.value = 'General'; state.locale = 'zh'
  assert.equal(formText(state.layout.sections[0], 'label', 'en'), 'General')
  assert.equal(formText(state.layout.sections[0], 'label', 'zh'), '基本信息')
  assert.equal(JSON.parse(JSON.stringify(state.layout)).sections[0].i18nMessages.label.en, 'General')
  assert.equal(field.i18nMessages.label.zh, undefined)
  await nextTick()
})

test('translation editor retains drafts across language switches, supports cancel and removes cleared translations', async t => {
  locale.value = 'zh'
  const scope = effectScope(); t.after(() => scope.stop())
  const props = reactive({ visible: true, title: '名称', displayValue: '默认名', maxLength: 20, data: { zh: '名称', en: 'Name', ja: '名前' } })
  const events = []
  const editor = scope.run(() => useI18nTextDialog(props, (...event) => events.push(event)))
  editor.formData.zh = '中文名称'; editor.activeLanguage.value = 'en'; editor.formData.en = 'Updated'
  assert.equal(editor.formData.zh, '中文名称')
  assert.equal(editor.preview.value, 'Updated')
  editor.handleCancel()
  assert.equal(events.some(event => event[0] === 'confirm'), false)
  assert.equal(props.data.en, 'Name')
  props.visible = false; await nextTick(); props.visible = true; await nextTick()
  assert.equal(editor.formData.en, 'Name')
  editor.activeLanguage.value = 'en'; editor.formData.en = ''
  assert.equal(editor.preview.value, '默认名')
  editor.handleOk()
  assert.deepEqual(events.find(event => event[0] === 'confirm')[1], { zh: '名称', ja: '名前' })
})

test('translation errors select the invalid language and keep the editor open until corrected', t => {
  locale.value = 'zh'
  const scope = effectScope(); t.after(() => scope.stop())
  const events = []
  const editor = scope.run(() => useI18nTextDialog({ visible: true, title: 'Name', maxLength: 5, data: { zh: '名称', en: 'Too long' } }, (...event) => events.push(event)))
  editor.handleOk()
  assert.equal(editor.activeLanguage.value, 'en')
  assert.ok(editor.error.value)
  assert.equal(events.length, 0)
  editor.formData.en = 'Short'; editor.handleOk()
  assert.equal(events[0][0], 'confirm')
})

test('inherited translations preview per language without being copied into a layout override', t => {
  locale.value = 'zh'
  const scope = effectScope(); t.after(() => scope.stop())
  const events = []
  const editor = scope.run(() => useI18nTextDialog({ visible: true, title: 'Name', displayValue: '默认名', fallbackMessages: { zh: '名称', en: 'Name' }, data: {} }, (...event) => events.push(event)))
  assert.deepEqual({ ...editor.formData }, {})
  editor.activeLanguage.value = 'en'
  assert.equal(editor.defaultText.value, 'Name')
  assert.equal(editor.preview.value, 'Name')
  editor.handleOk()
  assert.deepEqual(events[0], ['confirm', {}])
})

test('applying unchanged inherited text does not add a layout history entry', t => {
  const scope = effectScope(); t.after(() => scope.stop())
  const state = reactive({ layout: { version: 1, sections: [{ id: 'basic', label: 'Basic', items: [{ key: 'name' }] }] } })
  const designer = scope.run(() => useFormDesigner({ fields: () => [{ key: 'name', label: 'Name', type: 'text' }], layout: () => state.layout, sampleValues: () => ({}), update: value => { state.layout = value }, sectionLabel: () => ({ label: 'New' }), locale: () => 'en' }, ref()))
  designer.editTranslations('field', 'name'); designer.saveTranslations({})
  assert.equal(designer.history.value.length, 0)
  assert.equal(Object.hasOwn(state.layout.sections[0].items[0], 'i18nMessages'), false)
})

test('existing shared input retains other fields and languages when editing or clearing regional translations', t => {
  locale.value = 'en-US'
  const scope = effectScope(); t.after(() => scope.stop())
  const messages = { name: { zh: '名称', en: 'Name', 'en-US': 'US name' }, description: { zh: '说明' } }
  const events = []
  const field = scope.run(() => useI18nTextField({ field: 'name', value: 'US name', i18nMessages: messages }, (...event) => events.push(event)))
  field.handleValueChange('Updated')
  assert.equal(events[1][1].name['en-US'], 'Updated')
  assert.deepEqual(events[1][1].description, messages.description)
  field.saveI18nMessages({ en: 'Name', ja: '名前' })
  assert.deepEqual(events.at(-1), ['update:value', 'Name'])
  field.handleValueChange('')
  assert.equal(Object.hasOwn(events.at(-1)[1].name, 'en-US'), false)
  assert.equal(messages.name['en-US'], 'US name')
})
