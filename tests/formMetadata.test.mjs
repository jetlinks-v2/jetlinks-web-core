import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { buildSync } from 'esbuild'
import { effectScope } from 'vue'
const require = createRequire(import.meta.url)
function load(path) {
  const output = buildSync({ entryPoints: [resolve(import.meta.dirname, path)], bundle: true, platform: 'node', format: 'cjs', external: ['vue'], write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('require', 'module', 'exports', output)(require, module, module.exports)
  return module.exports
}
const { createMetadataForm } = load('../src/components/Form/metadata.ts')
const { useFormSession } = load('../src/components/Form/useFormSession.ts')
const { selectedOptions } = load('../src/components/Form/model.ts')
const { formText } = load('../src/components/Form/text.ts')
const { parseJsonWithPrecision } = load('../src/utils/json/index.ts')
const message = (issue, params) => params ? issue + ':' + params.value : issue
const binding = (id, type = 'string', expands = {}) => ({
  key: 'maintenance/' + id, path: ['customFields', 'maintenance', id],
  property: { id: 'customFields.maintenance.' + id, name: id, valueType: { type }, expands },
})
function session(form, submit) {
  const scope = effectScope()
  const view = scope.run(() => useFormSession({
    fields: () => form.fields, values: () => form.values, access: () => form.access, readonly: () => false,
    layout: () => ({ version: 1, sections: [{ id: 'main', label: 'Main', items: form.fields.map(({ key }) => ({ key })) }] }),
    submit: () => submit, validate: () => form.validate, submission: () => 'full',
    requiredMessage: () => 'required', failedMessage: () => 'failed', change() {}, saved() {}, externalChange() {},
  }))
  return { ...view, stop: () => scope.stop() }
}

test('original semantics, i18n and relative references survive exact path projection', () => {
  const reference = binding('project.id', 'string', { reference: { targetType: 'project', labelProperty: 'projectName' }, semanticRole: 'domain:project' })
  const amount = binding('amount', 'double', { numericRepresentation: 'decimal', unit: 'm', i18nMessages: { name: { en: 'Amount' } } })
  const source = { customFields: { maintenance: { 'project.id': 'P1', projectName: 'Project', amount: '12.500000000000000001' } } }
  const form = createMetadataForm([reference, amount], source, { message, access: { [amount.key]: 'write' } })
  assert.equal(form.fields[0].renderer, 'reference')
  assert.equal(form.bindings.get(reference.key).property, reference.property)
  assert.equal(form.bindings.get(reference.key).property.expands.reference.labelProperty, 'projectName')
  assert.equal(form.fields[1].i18nMessages.label.en, 'Amount')
  assert.equal(form.fields[1].unit, 'm')
  assert.equal(form.values[reference.key], 'P1')
  assert.deepEqual(form.toPatch({ [reference.key]: 'P2', [amount.key]: '12.6' }), { customFields: { maintenance: { amount: '12.6' } } })
  assert.equal(source.customFields.maintenance.amount, '12.500000000000000001')
})

test('precision-safe HTTP parsing and decimal constraints never pass through Number', () => {
  const item = binding('amount', 'double', { numericRepresentation: 'decimal', minimum: '9007199254740992.123456789', maximum: '9007199254740993' })
  const source = parseJsonWithPrecision('{"customFields":{"maintenance":{"amount":9007199254740992.123456789}}}')
  const form = createMetadataForm([item], source, { message, access: { [item.key]: 'write' } })
  assert.equal(form.values[item.key], '9007199254740992.123456789')
  assert.equal(form.validate('9007199254740992.123456788', form.fields[0], form.values), 'minimum:9007199254740992.123456789')
  assert.equal(form.validate('9007199254740992.123456790', form.fields[0], form.values), undefined)
  assert.equal(form.validate('NaN', form.fields[0], form.values), 'invalidNumber')
  assert.equal(form.toPatch({ [item.key]: '9007199254740992.123456790' }).customFields.maintenance.amount, '9007199254740992.123456790')
  assert.equal(form.toPatch({ [item.key]: '' }).customFields.maintenance.amount, null)
})

test('datetime converts browser local time to an instant; date never shifts and timestamp remains milliseconds', () => {
  const old = process.env.TZ
  process.env.TZ = 'Asia/Shanghai'
  try {
    const instant = binding('instant', 'date', { fieldType: 'DATETIME' })
    const date = binding('date', 'date', { fieldType: 'DATE' })
    const stamp = binding('stamp', 'date'); stamp.property.valueType.format = 'timestamp'
    const form = createMetadataForm([instant, date, stamp], { customFields: { maintenance: { instant: '2026-11-16T00:00:00Z', date: '2026-11-16' } } }, {
      message, access: Object.fromEntries([instant, date, stamp].map(item => [item.key, 'write'])),
    })
    assert.equal(form.values[instant.key], '2026-11-16T08:00:00')
    const patch = form.toPatch({ [instant.key]: '2026-11-16T09:00:00', [date.key]: '2026-11-16', [stamp.key]: '2026-11-16T09:00:00' }).customFields.maintenance
    assert.equal(patch.instant, '2026-11-16T01:00:00.000Z')
    assert.equal(patch.date, '2026-11-16')
    assert.equal(patch.stamp, Date.parse(patch.instant))
    assert.equal(form.toPatch({ [instant.key]: '' }).customFields.maintenance.instant, null)
    const precise = createMetadataForm([instant], { customFields: { maintenance: { instant: '2026-11-16T00:00:00.123Z' } } }, { message, access: { [instant.key]: 'write' } })
    assert.equal(precise.toPatch(precise.values).customFields.maintenance.instant, '2026-11-16T00:00:00.123Z')
  } finally {
    if (old === undefined) delete process.env.TZ
    else process.env.TZ = old
  }
})

test('create/update capabilities intersect explicit access; denied and hidden data never enter projection or patch', () => {
  const items = [binding('create', 'string', { insertable: true, updatable: false }), binding('secret'), binding('hidden')]
  const source = { customFields: { maintenance: { create: 'C', secret: 'S', hidden: 'H' } } }
  const access = { [items[0].key]: 'write', [items[1].key]: 'denied', [items[2].key]: 'hidden' }
  const form = createMetadataForm(items, source, { message, access })
  assert.equal(form.access[items[0].key], 'read')
  assert.equal(Object.hasOwn(form.values, items[1].key), false)
  assert.equal(Object.hasOwn(form.values, items[2].key), false)
  assert.deepEqual(form.toPatch(Object.fromEntries(items.map(item => [item.key, 'changed']))), {})
  assert.equal(createMetadataForm(items, source, { message, access, operation: 'create' }).access[items[0].key], 'write')
  assert.equal(createMetadataForm(items, source, { message }).access[items[0].key], 'read')
})

test('historical enum values remain removable but unknown or newly selected retired values fail', () => {
  const item = binding('features', 'enum', { selectableOptions: ['active'] })
  item.property.valueType = { type: 'enum', multi: true, elements: [{ value: 'old', text: 'Old' }, { value: 'active', text: 'Active' }, { value: 'never', text: 'Never' }] }
  const form = createMetadataForm([item], { customFields: { maintenance: { features: ['old'] } } }, { message })
  assert.equal(form.fields[0].options[0].disabled, true)
  assert.equal(form.validate(['old', 'active'], form.fields[0], form.values), undefined)
  assert.equal(form.validate(['active'], form.fields[0], form.values), undefined)
  assert.equal(form.validate(['never'], form.fields[0], form.values), 'invalidOption')
  assert.equal(form.validate(['unknown'], form.fields[0], form.values), 'invalidOption')
})

test('synchronized enum messages survive response text, regional fallback and explicit overrides', () => {
  const items = [binding('state', 'enum'), binding('flags')]
  const enumeration = { type: 'enum', elements: [{ value: '0', text: '默认' }],
    expands: { i18nMessages: { '0': { zh: '普通', en: 'Routine' } } } }
  items[0].property.valueType = enumeration
  items[1].property.valueType = { type: 'array', elementType: enumeration }
  const row = { customFields: { maintenance: { state: { value: 0, text: '响应文本' }, flags: [{ value: 0, text: '响应文本' }] } } }
  const form = createMetadataForm(items, row, { message })
  for (const field of form.fields) {
    const option = field.options[0]
    assert.equal(option.label, '响应文本')
    assert.equal(formText(option, 'label', 'en-US'), 'Routine')
    assert.equal(formText(option, 'label', 'zh-CN'), '普通')
    assert.equal(formText(option, 'label', 'fr'), '响应文本')
  }
  items[0].property.expands.optionSource = { items: [{ value: '0', text: '配置', i18nMessages: { text: { zh: '配置译文' } } }] }
  const configured = createMetadataForm(items, row, { message }).fields[0].options[0]
  assert.equal(formText(configured, 'label', 'zh'), '配置译文')
  assert.equal(formText(configured, 'label', 'en'), 'Routine')
  items[0].options = [{ value: 0, label: '宿主', i18nMessages: { label: { en: 'Host choice' } } }]
  const explicit = createMetadataForm(items, row, { message }).fields[0].options[0]
  assert.equal(formText(explicit, 'label', 'en'), 'Host choice')
  assert.equal(explicit.value, 0)
  assert.equal(enumeration.elements[0].text, '默认')
})

test('EnumDict responses and enum arrays share scalar editing, history and full saves', async t => {
  const state = binding('state', 'enum')
  state.property.valueType.elements = [{ value: 'P', text: 'Old metadata text' }, { value: 'C', text: 'Completed' }]
  const flags = binding('flags')
  flags.property.valueType = { type: 'array', elementType: { type: 'enum', elements: [{ value: false, text: 'No' }, { value: 1, text: 'One' }, { value: '1', text: 'Text one' }] } }
  const note = binding('note')
  const items = [state, flags, note]
  const source = { customFields: { maintenance: { state: { value: 'P', text: '待处理' }, flags: [{ value: false, text: '否' }, { value: 'gone', text: '已停用' }], note: 'before' } } }
  const form = createMetadataForm(items, source, { message, access: Object.fromEntries(items.map(item => [item.key, 'write'])) })
  assert.equal(form.values[state.key], 'P')
  assert.equal(form.fields[1].type, 'enum')
  assert.equal(form.fields[1].multiple, true)
  assert.deepEqual(form.values[flags.key], [false, 'gone'])
  assert.equal(selectedOptions(form.fields[0], form.values[state.key])[0].label, '待处理')
  assert.deepEqual(selectedOptions(form.fields[1], form.values[flags.key]).map(item => item.label), ['否', '已停用'])
  assert.equal(form.fields[1].options.find(item => item.value === 'gone').disabled, true)
  assert.equal(form.validate([false, 'gone', 1, '1'], form.fields[1], form.values), undefined)
  assert.equal(form.validate(['new'], form.fields[1], form.values), 'invalidOption')
  let payload
  const view = session(form, async changes => { payload = form.toPatch(changes) }); t.after(view.stop)
  assert.equal(view.commit(note.key, 'after'), true)
  await view.save()
  assert.deepEqual(payload, { customFields: { maintenance: { note: 'after' } } })
  assert.deepEqual(view.errors.value, {})
  assert.equal(view.commit(flags.key, [1, '1']), true)
  await view.save()
  assert.deepEqual(payload, { customFields: { maintenance: { flags: [1, '1'] } } })
  assert.equal(view.commit(state.key, 'C'), true)
  await view.save()
  assert.deepEqual(payload, { customFields: { maintenance: { state: 'C' } } })
  assert.equal(source.customFields.maintenance.state.text, '待处理')
  const denied = createMetadataForm([state], source, { message, access: { [state.key]: 'denied' } })
  assert.equal(Object.hasOwn(denied.values, state.key), false)
  assert.equal(denied.fields[0].options[0].label, 'Old metadata text')
  const structured = binding('objects'); structured.property.valueType = { type: 'array', elementType: { type: 'object' } }
  assert.equal(createMetadataForm([structured], {}, { message }).fields[0].type, 'custom')
})

test('bindings declare independent row operations without inferring existence or raising access', () => {
  const parent = { ...binding('name'), key: 'parent/name', path: ['name'] }
  const created = { ...binding('creationNote', 'string', { insertable: true, updatable: false }), operation: 'create' }
  const ignored = { ...binding('updateNote', 'string', { insertable: false, updatable: true }), operation: 'create' }
  const existing = { ...binding('existing', 'string', { insertable: false, updatable: true }), operation: 'update' }
  const denied = { ...binding('denied'), operation: 'create' }
  const items = [parent, created, ignored, existing, denied]
  const source = { name: 'Parent', customFields: { maintenance: {} } }
  const form = createMetadataForm(items, source, { message, operation: 'update', access: Object.fromEntries(items.map(item => [item.key, item === denied ? 'denied' : 'write'])) })
  assert.deepEqual(form.access, { [parent.key]: 'write', [created.key]: 'write', [ignored.key]: 'read', [existing.key]: 'write', [denied.key]: 'denied' })
  assert.deepEqual(form.toPatch(Object.fromEntries(items.map(item => [item.key, 'changed']))), { name: 'changed', customFields: { maintenance: { creationNote: 'changed', existing: 'changed' } } })
  assert.equal(createMetadataForm([created], source, { message }).access[created.key], 'read')
  assert.equal(createMetadataForm([binding('creationNote', 'string', { updatable: false })], source, { message, access: { [created.key]: 'write' } }).access[created.key], 'read')
  assert.equal(createMetadataForm([existing], source, { message, operation: 'create', access: { [existing.key]: 'write' } }).access[existing.key], 'write')
})

test('numeric EnumDict values follow metadata string codes while explicit typed choices remain distinct', () => {
  const item = binding('priority', 'enum')
  item.property.valueType.elements = [{ value: '0', text: 'Routine' }, { value: '1', text: 'Urgent' }]
  const source = { customFields: { maintenance: { priority: { value: 0, text: '普通' } } } }
  const form = createMetadataForm([item], source, { message, access: { [item.key]: 'write' } })
  assert.equal(form.values[item.key], '0')
  assert.equal(form.fields[0].options.length, 2)
  assert.equal(form.fields[0].options[0].disabled, false)
  assert.equal(selectedOptions(form.fields[0], form.values[item.key])[0].label, '普通')
  assert.equal(form.validate('1', form.fields[0], form.values), undefined)
  assert.deepEqual(form.toPatch({ [item.key]: '1' }), { customFields: { maintenance: { priority: '1' } } })
  const typed = { ...item, options: [{ value: 0, label: 'Number zero' }, { value: '0', label: 'String zero' }] }
  const explicit = createMetadataForm([typed], source, { message })
  assert.equal(explicit.values[item.key], 0)
  assert.equal(explicit.fields[0].options.length, 2)
  assert.equal(explicit.fields[0].options[1].label, 'String zero')
})

test('same field names from different sources and structured results keep independent identities', () => {
  const first = binding('status', 'object', { semanticRole: 'domain:position' })
  const second = { ...binding('status'), key: 'another/status', path: ['another', 'status'] }
  const form = createMetadataForm([first, second], { customFields: { maintenance: { status: { x: 0, valid: false } } }, another: { status: 'running' } }, { message })
  assert.deepEqual(form.values[first.key], { x: 0, valid: false })
  assert.equal(form.fields[0].type, 'custom')
  assert.equal(form.values[second.key], 'running')
  assert.throws(() => createMetadataForm([first, first], {}, { message }), /unique keys/)
})

test('actual backend metadata and JSON values preserve precision, dates, enums and semantics', { skip: !process.env.FORM_BACKEND_CONTRACT }, async t => {
  const contract = parseJsonWithPrecision(readFileSync(process.env.FORM_BACKEND_CONTRACT, 'utf8'))
  const items = contract.properties.map(property => {
    const [container, schema, ...field] = property.id.split('.')
    return { key: property.id, property, path: [container, schema, field.join('.')] }
  })
  const form = createMetadataForm(items, contract.row, { message, access: Object.fromEntries(items.map(item => [item.key, 'write'])) })
  const amount = form.fields.find(field => field.key.endsWith('.number'))
  const time = form.fields.find(field => field.key.endsWith('.time'))
  const day = form.fields.find(field => field.key.endsWith('.day'))
  assert.equal(form.bindings.get(amount.key).property.expands.semanticId, 'domain:amount')
  assert.match(form.values[amount.key], /^9007199254740992\.1234567890*$/)
  assert.equal(form.values[day.key], '2026-11-16')
  const patch = form.toPatch({ [amount.key]: '9007199254740992.123456790', [time.key]: form.values[time.key], [day.key]: form.values[day.key] })
  assert.equal(patch.customFields.schema.number, '9007199254740992.123456790')
  assert.equal(patch.customFields.schema.time, '2026-11-16T00:00:00.000Z')
  assert.equal(patch.customFields.schema.day, '2026-11-16')
  const state = form.fields.find(field => field.key === 'customFields.maintenance.state')
  const flags = form.fields.find(field => field.key === 'customFields.maintenance.flags')
  const priority = form.fields.find(field => field.key === 'customFields.maintenance.priority')
  assert.equal(state.type, 'enum')
  assert.equal(flags.type, 'enum')
  assert.equal(flags.multiple, true)
  assert.equal(form.values[state.key], 'P')
  assert.deepEqual(form.values[flags.key], ['P', 'C'])
  assert.equal(contract.row.customFields.maintenance.priority.value, 0)
  assert.equal(form.values[priority.key], '0')
  assert.equal(form.fields.find(field => field.key === priority.key).options.length, 2)
  assert.equal(selectedOptions(state, form.values[state.key])[0].label, contract.row.customFields.maintenance.state.text)
  const view = session(form, async changes => { assert.deepEqual(form.toPatch(changes), { customFields: { schema: { text: 'changed' } } }) }); t.after(view.stop)
  assert.equal(view.commit('customFields.schema.text', 'changed'), true)
  await view.save()
  assert.equal(view.dirty.value, 0)
  assert.deepEqual(view.errors.value, {})
})

test('actual RPC metadata keeps enum translations when the consumer has no business resources', { skip: !process.env.FORM_I18N_CONTRACT }, () => {
  const contract = parseJsonWithPrecision(readFileSync(process.env.FORM_I18N_CONTRACT, 'utf8'))
  const items = contract.properties.map(property => {
    const [container, schema, ...field] = property.id.split('.')
    return { key: property.id, property, path: [container, schema, field.join('.')] }
  })
  const form = createMetadataForm(items, contract.row, { message })
  const state = form.fields.find(field => field.key === 'customFields.maintenance.state')
  const flags = form.fields.find(field => field.key === 'customFields.maintenance.flags')
  assert.equal(formText(selectedOptions(state, form.values[state.key])[0], 'label', 'en-US'), 'Pending')
  assert.equal(formText(selectedOptions(state, form.values[state.key])[0], 'label', 'zh-CN'), '待处理')
  assert.deepEqual(selectedOptions(flags, form.values[flags.key]).map(option => formText(option, 'label', 'en')), ['Pending', 'Completed'])
  const height = form.fields.find(field => field.key === 'customFields.maintenance.height')
  assert.equal(formText(height, 'label', 'en'), 'Installation height')
  assert.equal(formText(height, 'label', 'zh'), '高度')
})
