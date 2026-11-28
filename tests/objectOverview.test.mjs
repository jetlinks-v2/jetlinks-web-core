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
    if (id === 'vue-i18n') return { useI18n: () => ({ t: (key, params) => key === 'source' && params?.name ? `source ${params.name}` : key }) }
    if (id === '@ant-design/icons-vue') return Object.fromEntries(['ThunderboltOutlined', 'InfoCircleOutlined', 'HistoryOutlined', 'DownOutlined', 'PlusOutlined', 'EditOutlined', 'ReloadOutlined', 'MoreOutlined', 'ArrowRightOutlined'].map(key => [key, () => null]))
    if (['./ObjectInputValue.vue', './ObjectDataExplorer.vue', './ObjectDataTools.vue'].includes(id)) return { __esModule: true, default: () => null }
    if (id.startsWith('.')) return load(resolve(dirname(filename), id.endsWith('.vue') ? id : `${id}.ts`), overrides, cache)
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const Content = load(resolve(root, 'ObjectContentGroup.vue')).default
test('unnamed identity sources use localized type declarations without changing provider routing or declared names', async () => {
  const providers = [{ providerId: 'sample-source', name: 'sample-source', identity: true, metadata: {} }, { providerId: 'metrics', name: 'Owner supplied label', identity: false, metadata: {} }]
  const calls = []
  const { objectCapabilitiesApi } = load(resolve(root, '../../object-capability/api.ts'), {
    '../data-capability/request': { getDataCapabilityRequest: () => ({ get: async url => { calls.push(url); return { status: 200, result: url === '/relation/types' ? [{ id: 'sample', name: 'Sample', i18nName: 'Localized type' }] : providers } } }) }
  })
  const models = await objectCapabilitiesApi({}).models('sample', 'A')
  assert.equal(models[0].name, 'Localized type')
  assert.equal(models[0].providerId, 'sample-source')
  assert.equal(models[1].name, 'Owner supplied label')
  assert.equal(providers[0].name, 'sample-source')
  assert.deepEqual(calls, ['/relation/objects/sample/A/providers', '/relation/types'])
  providers[0].name = 'Explicit name'; calls.length = 0
  assert.equal((await objectCapabilitiesApi({}).models('sample', 'A'))[0].name, 'Explicit name')
  assert.deepEqual(calls, ['/relation/objects/sample/A/providers'])
})

test('an unavailable type label cannot prevent model reading', async () => {
  const providers = [{ providerId: 'sample', name: 'sample', identity: true, metadata: {} }]
  const { objectCapabilitiesApi } = load(resolve(root, '../../object-capability/api.ts'), {
    '../data-capability/request': { getDataCapabilityRequest: () => ({ get: async url => { if (url === '/relation/types') throw Error('unavailable'); return { status: 200, result: providers } } }) }
  })
  assert.deepEqual(await objectCapabilitiesApi({}).models('sample', 'A'), providers)
})
test('shared overview messages switch languages without missing keys or losing interpolation', () => {
  const { createI18n } = require('vue-i18n')
  const { objectOverviewMessages: messages } = load(resolve(root, 'messages.ts'))
  const i18n = createI18n({ legacy: false, locale: 'zh', fallbackLocale: false, messages })
  const expected = { zh: '否', en: 'No', ja: 'いいえ', 'zh-CN': '否', 'en-US': 'No', 'zh-TW': '否', 'ja-JP': 'いいえ' }
  for (const [locale, falseValue] of Object.entries(expected)) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), Object.keys(messages.zh).sort(), locale)
    i18n.global.locale.value = locale
    assert.equal(i18n.global.t('falseValue'), falseValue)
    assert.match(i18n.global.t('source', { name: 'Source-A' }), /Source-A/)
    for (const key of Object.keys(messages[locale])) {
      const translated = i18n.global.t(key, { name: 'Source-A', id: 'A-1', count: 2 })
      assert.equal(i18n.global.te(key, locale), true, `${locale}.${key}`)
      assert.doesNotMatch(translated, /\{(?:name|id|count)\}/, `${locale}.${key}`)
    }
  }
})
test('enum labels accept serialized numeric keys while retaining zero, false and wrapped values', async t => {
  const Data = load(resolve(root, 'ObjectDataView.vue')).default
  const value = vue.ref(0)
  const h = render(t, () => () => vue.h(Data, {
    value: value.value,
    metadata: { type: 'enum', elements: [{ value: '0', text: 'Offline' }, { value: false, text: 'Disabled' }] },
  }))
  assert.equal(h.text(), 'Offline')
  value.value = false; await flush()
  assert.equal(h.text(), 'Disabled')
  value.value = { value: 0, text: 'fallback' }; await flush()
  assert.equal(h.text(), 'Offline')
  value.value = null; await flush()
  assert.equal(h.text(), 'unknown')
})
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
test('shared values distinguish false, zero, empty text and missing data without leaking structured passwords', async t => {
  const Data = load(resolve(root, 'ObjectDataView.vue')).default
  const value = vue.ref(false), metadata = vue.ref({ type: 'boolean' })
  const h = render(t, () => () => vue.h(Data, { value: value.value, metadata: metadata.value }))
  assert.equal(h.text(), 'falseValue')
  value.value = true; await flush(); assert.equal(h.text(), 'trueValue')
  value.value = 0; await flush(); assert.equal(h.text(), '0')
  value.value = ''; await flush(); assert.equal(h.text(), 'emptyValue')
  value.value = undefined; await flush(); assert.equal(h.text(), 'unknown')
  metadata.value = { type: 'password' }; value.value = { secret: 'must-stay-hidden' }; await flush()
  assert.equal(h.text(), '••••••')
  assert.equal(h.all().some(node => node.type === 'details'), false)
})

test('structured values disclose large collections progressively instead of silently truncating them', async t => {
  const Data = load(resolve(root, 'ObjectDataView.vue')).default
  const h = render(t, () => () => vue.h(Data, { value: Array.from({ length: 45 }, (_, index) => `item-${index}`) }))
  assert.doesNotMatch(h.text(), /item-0/)
  h.all().find(node => node.type === 'details').props.onToggle({ target: { open: true } }); await flush()
  assert.match(h.text(), /item-19/); assert.doesNotMatch(h.text(), /item-20/)
  h.button('showMore').props.onClick(); await flush()
  h.button('showMore').props.onClick(); await flush()
  assert.match(h.text(), /item-44/)
  assert.equal(h.button('showMore'), undefined)
})

test('failed source reads cannot be replaced by a ready-only custom presentation', async t => {
  const entry = { selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id: 'value' } },
    member: { name: 'Value', sourceName: 'Source', ref: { kind: 'property' }, metadata: { valueType: { type: 'double' }, expands: { semanticRole: 'value' } } },
    state: { status: 'failed' }, presentation: { component: () => vue.h('span', 'FAKE-NORMAL') } }
  const h = render(t, () => () => vue.h(Content, { entries: [entry], appearance: 'section', runtime: () => undefined }))
  assert.doesNotMatch(h.text(), /FAKE-NORMAL/)
  assert.match(h.text(), /loadFailed/)
})

test('a missing observation stays missing even when a custom presenter is registered', async t => {
  const entry = { selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id: 'reading' } },
    member: { name: 'Reading', sourceName: 'Source', ref: { kind: 'property' }, metadata: { valueType: { type: 'double' }, expands: { semanticRole: 'value' } } },
    state: { status: 'ready', value: null }, presentation: { component: () => vue.h('span', 'FAKE-NORMAL') } }
  const h = render(t, () => () => vue.h(Content, { entries: [entry], appearance: 'section', runtime: () => undefined }))
  assert.doesNotMatch(h.text(), /FAKE-NORMAL/)
  assert.match(h.text(), /noReading/)
})

test('standard reading groups by declarations and keeps observation evidence apart from editable data', async t => {
  const Reading = load(resolve(root, 'ObjectReadingView.vue')).default
  const entries = [
    ['plain', 'data', 0], ['reading', 'value', 0], ['state', 'status', false],
  ].map(([id, role, value]) => ({ selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id } },
    member: { name: id, sourceName: 'Source', ref: { kind: 'property' }, metadata: { valueType: { type: 'double' }, expands: { semanticRole: role } } }, state: { status: 'ready', value } }))
  const h = render(t, () => () => vue.h(Reading, { entries, runtime: () => undefined }))
  assert.ok(h.text().indexOf('reading') < h.text().indexOf('plain'))
  assert.match(h.text(), /timeUnavailable/)
  assert.match(h.text(), /falseValue/)
  assert.equal(h.all().filter(node => node.type === 'article' || node.type === 'li').length, 3)
  assert.equal(h.all().filter(node => node.type === 'ul').length, 1)
  assert.equal(h.all().some(node => node.props.role === 'columnheader'), false)
  assert.doesNotMatch(h.text(), /currentValue|observation/)
  assert.equal(h.text().match(/timeUnavailable/g)?.length, 1, 'missing collection time belongs to the observation group')
})

test('headerless readings preserve units, declared states, dates, missing data and retry', async t => {
  let retries = 0
  const rows = [
    ['Utilization', 0, { type: 'double', unit: '%' }],
    ['Connectivity', false, { type: 'boolean', falseText: 'Disconnected' }],
    ['State', 0, { type: 'enum', elements: [{ value: '0', text: 'Offline' }] }],
    ['Sample time', '2026-11-27T08:00:00', { type: 'date' }],
    ['Missing', null, { type: 'double' }],
    ['Failed', undefined, { type: 'double' }, 'failed'],
  ].map(([id, value, valueType, status = 'ready']) => ({ selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id }, binding: { source: { capabilityId: id } } }, member: { name: id, sourceName: 'Source', ref: { kind: 'property' }, metadata: { valueType, expands: { semanticRole: 'value' } } }, state: { status, value } }))
  const h = render(t, () => () => vue.h(Content, { entries: rows, appearance: 'section', runtime: () => undefined, onRetry: () => retries++ }))
  assert.equal(h.all().filter(node => node.type === 'li').length, 6)
  assert.equal(h.all().some(node => node.type === 'table'), false)
  for (const value of ['0', '%', 'Disconnected', 'Offline', '2026-11-27', 'noReading']) assert.ok(h.text().includes(value), value)
  h.button('retry').props.onClick(); assert.equal(retries, 1)
})

test('continuous defaults preserve explicit query bindings and do not duplicate field editor actions', () => {
  const { objectReadingSelections, currentObjectSelection, dashboardSelections } = load(resolve(root, '../../object-capability/dashboard.ts'))
  const member = (kind, id, metadata) => ({ ref: { type: 'sample', providerId: 'source', kind, id }, name: id, sourceName: 'Source', metadata })
  const property = member('property', 'value', { valueType: { type: 'double' }, expands: { edit: { providerId: 'source', command: 'save', inputPath: ['value'] } } })
  const query = member('query', 'requiresParameters', { inputs: [{ id: 'scope', valueType: { type: 'string' } }] })
  const editor = member('action', 'save', {}), action = member('action', 'inspect', {})
  const defaults = objectReadingSelections([property, query, editor, action])
  assert.deepEqual(defaults.map(item => item.member.id).sort(), ['inspect', 'value'])
  const explicit = currentObjectSelection(query)
  assert.equal(dashboardSelections({ components: [{ id: 'configured-query', type: 'object-data', componentProps: { selections: [explicit] } }] })[0].member.id, 'requiresParameters')
})

test('reading keeps declaration order while values become available or fail', async t => {
  const Reading = load(resolve(root, 'ObjectReadingView.vue')).default
  const entries = [['Missing', null, 'Unavailable source'], ['Zero', 0, 'Live source'], ['False', false, 'Live source']].map(([name, value, source]) => ({
    selection: { member: { type: 'sample', providerId: source, kind: 'property', id: name } },
    member: { name, sourceName: source, ref: { type: 'sample', providerId: source, kind: 'property', id: name }, metadata: { valueType: { type: typeof value === 'boolean' ? 'boolean' : 'double' } } },
    state: { status: 'ready', value },
  }))
  const current = vue.shallowRef(entries)
  const h = render(t, () => () => vue.h(Reading, { entries: current.value, runtime: () => undefined }))
  assert.match(h.text(), /Zero/)
  assert.match(h.text(), /False/)
  assert.equal(h.button('showAll'), undefined)
  assert.ok(h.text().indexOf('Missing') < h.text().indexOf('Zero'))
  assert.ok(h.text().indexOf('Zero') < h.text().indexOf('False'))
  assert.match(h.text(), /unknown/); assert.match(h.text(), /Unavailable source/)
  assert.match(h.text(), /Live source/)
  assert.equal(h.all().filter(node => node.type === 'article').length, 3)
  assert.equal(entries[0].member.name, 'Missing', 'display ordering must not mutate the source model')
  current.value = entries.map((entry, index) => ({ ...entry, state: index === 0 ? { status: 'ready', value: 7 } : { status: 'failed' } }))
  await flush()
  assert.ok(h.text().indexOf('Missing') < h.text().indexOf('Zero'))
  assert.ok(h.text().indexOf('Zero') < h.text().indexOf('False'))
})

test('record content spans the reading layout without reserving an empty side column', async t => {
  const Reading = load(resolve(root, 'ObjectReadingView.vue')).default
  const visible = vue.ref(false)
  const entries = [{ selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id: 'name' } },
    member: { name: 'Name', sourceName: 'Source', ref: { kind: 'property' }, metadata: { valueType: { type: 'string' } } },
    state: { status: 'ready', value: 'Original value' } }]
  const h = render(t, () => () => vue.h(Reading, { entries, runtime: () => undefined },
    visible.value ? { context: () => vue.h('records', 'Context content') } : {}))
  const hasSide = () => h.all().some(node => String(node.props.class || '').split(' ').includes('object-reading__context'))
  const hasRecords = () => h.all().some(node => String(node.props.class || '').split(' ').includes('object-reading__records'))
  assert.equal(hasSide(), false)
  assert.equal(hasRecords(), false)
  visible.value = true; await flush(); assert.equal(hasSide(), false); assert.equal(hasRecords(), true); assert.match(h.text(), /Context content/)
  visible.value = false; await flush(); assert.equal(hasRecords(), false); assert.match(h.text(), /Original value/)
})

test('reading sections append batches at the scroll boundary and retain the final missing value', async t => {
  let intersect
  const Group = load(resolve(root, 'ObjectContentGroup.vue'), {
    '@vueuse/core': { ...require('@vueuse/core'), useIntersectionObserver: (_target, callback) => { intersect = callback; return { stop() {} } } },
  }).default
  const entries = Array.from({ length: 45 }, (_, index) => {
    const ref = { type: 'sample', providerId: 'source', kind: 'property', id: `reading-${index}` }
    return { selection: { member: ref, binding: { source: { capabilityId: `reading-${index}` } } },
      member: { ref, name: `Reading ${index}`, sourceName: 'Source', metadata: { valueType: { type: 'double' }, expands: { semanticRole: 'value' } } },
      state: { status: 'ready', value: index === 44 ? null : index } }
  })
  const h = render(t, () => () => vue.h(Group, { entries, appearance: 'section', runtime: () => undefined }))
  const count = () => h.all().filter(node => node.type === 'li').length
  assert.equal(count(), 20)
  intersect([{ isIntersecting: false }]); await flush(); assert.equal(count(), 20)
  intersect([{ isIntersecting: true }]); await flush(); assert.equal(count(), 40)
  intersect([{ isIntersecting: true }]); await flush(); assert.equal(count(), 45)
  assert.match(h.text(), /Reading 44/); assert.match(h.text(), /noReading/)
  assert.equal(h.all().some(node => node.props.class === 'object-content-group__tail'), false)
  assert.equal(h.button('showAll'), undefined)
  assert.equal(entries.length, 45)
})

test('reading restores enough rows for a remembered scroll position', async t => {
  const entries = Array.from({ length: 70 }, (_, id) => ({ selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id: String(id) } }, state: { status: 'ready', value: id } }))
  const h = render(t, () => () => vue.h(Content, { entries, appearance: 'section', position: { top: 900, visible: 60 }, runtime: () => undefined }))
  await flush()
  assert.equal(h.all().filter(node => node.type === 'article').length, 60)
  const viewport = h.all().find(node => node.props.class === 'object-content-group__viewport')
  assert.equal(viewport.scrollTop, 900)
})

test('delayed readings cannot overwrite a remembered position with a temporary scroll height', async t => {
  const entries = vue.ref(Array.from({ length: 70 }, (_, id) => ({ selection: { member: { type: 'sample', providerId: 'source', kind: 'property', id: String(id) } }, state: { status: 'loading' } })))
  const positions = []
  const h = render(t, () => () => vue.h(Content, { entries: entries.value, appearance: 'section', position: { top: 900, visible: 60 }, onPosition: value => positions.push(value), runtime: () => undefined }))
  await flush()
  const viewport = h.all().find(node => node.props.class === 'object-content-group__viewport')
  viewport.props.onScroll(); await flush()
  assert.deepEqual(positions, [])
  entries.value = entries.value.map(entry => ({ ...entry, state: { status: 'ready', value: 0 } }))
  await flush(); await flush()
  assert.equal(viewport.scrollTop, 900)
  assert.equal(h.all().filter(node => node.type === 'article').length, 60)
  viewport.scrollTop = 950; viewport.props.onScroll()
  assert.deepEqual(positions.at(-1), { top: 950, visible: 60 })
})

test('semantic dashboard defaults combine context above full-width readings', () => {
  const { objectDefaultDashboard, dashboardSelections, addObjectDashboardGroup } = load(resolve(root, '../../object-capability/dashboard.ts'))
  const members = [['reading', 'value'], ['name', 'data'], ['state', 'status']].map(([id, role]) => ({ ref: { type: 'sample', providerId: 'source', kind: 'property', id }, metadata: { valueType: { type: 'string' }, expands: { semanticRole: role } } }))
  const value = objectDefaultDashboard(members, { data: 'Data', observations: 'Readings', status: 'Status' })
  const [context, reading] = value.components
  assert.equal(reading.componentProps.contentGroup, 'observations')
  assert.deepEqual(context.componentProps.contentGroups, ['data', 'status'])
  assert.equal(context.componentProps.collapsible, true)
  assert.deepEqual([reading.componentProps.gridItem.x, reading.componentProps.gridItem.w], [0, 12])
  assert.deepEqual([context.componentProps.gridItem.x, context.componentProps.gridItem.w], [0, 12])
  assert.ok(context.componentProps.gridItem.h < reading.componentProps.gridItem.h)
  assert.equal(reading.componentProps.gridItem.y, context.componentProps.gridItem.h)
  assert.deepEqual(dashboardSelections(value, members).map(item => item.member.id).sort(), ['name', 'reading', 'state'])
  assert.equal(addObjectDashboardGroup(value, 'status', { data: 'Data', actions: 'Actions' }), value)
  assert.equal(members[0].ref.id, 'reading')
})

test('context details expand and collapse without dropping missing values', async t => {
  const ref = { type: 'sample', providerId: 'source', kind: 'property', id: 'name' }
  const entries = [{ selection: { member: ref }, member: { ref, name: 'Name', metadata: { valueType: { type: 'string' } } }, state: { status: 'ready', value: null } }]
  const h = render(t, () => () => vue.h(Content, { title: 'Details', entries, collapsible: true, appearance: 'section', runtime: () => undefined }))
  assert.equal(h.all().filter(node => node.type === 'article').length, 0)
  h.button('expandDetails').props.onClick(); await flush()
  assert.equal(h.all().filter(node => node.type === 'article').length, 1)
  assert.match(h.text(), /unknown/)
  h.button('collapseDetails').props.onClick(); await flush()
  assert.equal(h.all().filter(node => node.type === 'article').length, 0)
  assert.equal(entries.length, 1)
})

test('invalid persisted context groups keep explicit bindings and valid groups are unique', () => {
  const { objectWidgetGroups, dashboardSelections } = load(resolve(root, '../../object-capability/dashboard.ts'))
  const selection = { member: { type: 'sample', providerId: 'source', kind: 'query', id: 'query' } }
  const widget = { id: 'saved', componentProps: { contentGroups: 'data', selections: [selection] } }
  assert.deepEqual(objectWidgetGroups(widget), [])
  assert.deepEqual(dashboardSelections({ components: [widget] }), [selection])
  widget.componentProps.contentGroups = ['data', 'unknown', 'data', 'status']
  assert.deepEqual(objectWidgetGroups(widget), ['data', 'status'])
})

test('a reading-only dashboard uses full width and actions stay below the data', () => {
  const { objectDefaultDashboard } = load(resolve(root, '../../object-capability/dashboard.ts'))
  const reading = { ref: { type: 'sample', providerId: 'source', kind: 'property', id: 'reading' }, metadata: { expands: { semanticRole: 'value' } } }
  const action = { ref: { type: 'sample', providerId: 'source', kind: 'action', id: 'inspect' }, metadata: {} }
  const value = objectDefaultDashboard([reading, action], { data: 'Data', actions: 'Actions', observations: 'Readings' })
  const [data, operations] = value.components.map(widget => widget.componentProps.gridItem)
  assert.deepEqual([data.x, data.y, data.w], [0, 0, 12])
  assert.ok(data.h < 10, 'a short reading group does not reserve an empty tall card')
  assert.deepEqual([operations.x, operations.w, operations.y], [0, 12, data.h])
})

test('reading search reaches unrendered entries and clearing restores the original reading batch', async t => {
  const entries = Array.from({ length: 45 }, (_, index) => ({
    selection: { member: { type: 'reservoir', providerId: 'source', kind: 'property', id: String(index) }, binding: { source: { capabilityId: String(index) } } },
    member: { ref: { kind: 'property' }, name: `Level ${index}:`, sourceName: 'Source', metadata: { valueType: { type: 'double', unit: 'm' }, expands: { semanticRole: 'result' } } },
    state: { status: 'ready', value: index },
  }))
  const h = render(t, () => () => vue.h(Content, { title: 'Data', appearance: 'section', entries, runtime: () => undefined }))
  assert.doesNotMatch(h.text(), /Level 44:/)
  const search = h.all().find(node => node.props['aria-label'] === 'searchReadings')
  assert.ok(search)
  search.props['onUpdate:value']('Level 44'); await flush()
  assert.match(h.text(), /Level 44:/)
  assert.doesNotMatch(h.text(), /Level 0:/)
  search.props['onUpdate:value']('unmatched'); await flush()
  assert.ok(h.all().some(node => node.props.description === 'noMatches'))
  search.props['onUpdate:value'](''); await flush()
  assert.match(h.text(), /Level 0:/)
  assert.doesNotMatch(h.text(), /Level 44:/)
})

test('automatic updates stay batched, retain old values on failure and stop while hidden or disposed', async t => {
  let tick, resumed = 0, paused = 0, reads = 0, fail = false, capability
  const visibility = vue.ref('visible'), active = vue.ref(true), interval = vue.ref(2)
  const { useObjectCapabilities } = load(resolve(root, '../../object-capability/useObjectCapabilities.ts'), {
    '@vueuse/core': { useDocumentVisibility: () => visibility, useIntervalFn: callback => { tick = callback; return { resume: () => resumed++, pause: () => paused++ } } },
    '../data-capability/registry': { dataCapabilityRegistry: { createRuntime: () => ({ dispose() {} }) } },
    '../data-capability/request': { useDataCapabilityRequest: () => ({}) },
    './api': { objectCapabilitiesApi: () => ({
      models: async () => [{ providerId: 'source', name: 'Source', metadata: { properties: [
        { id: 'level', valueType: { type: 'double' } }, { id: 'pressure', valueType: { type: 'double' } },
      ] } }],
      properties: async (_object, _provider, keys) => { reads++; assert.equal(keys.length, 2); if (fail) throw Error('unavailable'); return keys.map(property => ({ property, value: 0 })) },
    }) }
  })
  const h = render(t, () => { capability = useObjectCapabilities(vue.ref({ type: 'reservoir', id: 'R' }), { active, interval }); return () => null })
  await flush(); await flush()
  assert.equal(reads, 1); assert.ok(resumed > 0)
  fail = true; tick(); await flush(); await flush()
  assert.equal(reads, 2)
  assert.ok(Object.values(capability.values.value).every(value => value.status === 'ready' && value.value === 0 && value.refreshError))
  visibility.value = 'hidden'; await flush(); tick(); await flush()
  assert.equal(reads, 2)
  visibility.value = 'visible'; active.value = false; await flush(); tick(); await flush()
  assert.equal(reads, 2)
  active.value = true; fail = false; await flush(); tick(); await flush(); await flush()
  assert.equal(reads, 3)
  assert.ok(Object.values(capability.values.value).every(value => !value.refreshError))
  assert.ok(paused > 0)
})

test('related auto updates deduplicate bindings, keep old results and discard cancelled background responses', async t => {
  let tick, reads = 0, models = 0, fail = false, delay = false, complete, signal, related
  const visibility = vue.ref('visible'), active = vue.ref(true), interval = vue.ref(2)
  const member = { type: 'reservoir', providerId: 'ledger', kind: 'property', id: 'level' }
  const selection = { member, object: { objectType: 'reservoir', objectId: 'R' }, binding: { version: 1, source: { capabilityId: 'level', version: 1 } } }
  const { useObjectRelatedData } = load(resolve(root, '../../object-capability/useObjectRelatedData.ts'), {
    '@vueuse/core': { useDocumentVisibility: () => visibility, useIntervalFn: callback => { tick = callback; return { resume() {}, pause() {} } } },
    '../data-capability/request': { useDataCapabilityRequest: () => ({}) },
    './api': { objectCapabilitiesApi: () => ({ models: async () => { models++; return [{ providerId: 'ledger', name: 'Ledger', metadata: { properties: [{ id: 'level', valueType: { type: 'double' } }] } }] } }) }
  })
  const runtime = { async query(_binding, options) {
    reads++; signal = options.signal
    if (delay) return new Promise(resolve => { complete = resolve })
    if (fail) throw Error('unavailable')
    return { data: { values: [{ object: { type: 'reservoir', id: 'R' }, value: 0 }], limited: false } }
  } }
  const h = render(t, () => {
    related = useObjectRelatedData(vue.ref([selection, selection]), vue.ref(true), () => runtime, { active, interval })
    return () => null
  })
  await flush(); await flush()
  assert.equal(reads, 1); assert.equal(models, 1)
  fail = true; tick(); await flush(); await flush()
  assert.equal(reads, 2); assert.equal(models, 1, 'polling does not reload the type catalog')
  assert.equal(Object.values(related.states.value)[0].value.values[0].value, 0)
  assert.equal(Object.values(related.states.value)[0].refreshError, true)
  fail = false; delay = true; tick(); await flush(); tick(); await flush()
  assert.equal(reads, 3, 'a pending update cannot overlap another tick')
  visibility.value = 'hidden'; await flush()
  assert.equal(signal.aborted, true)
  complete({ data: { values: [{ value: 99 }], limited: false } }); await flush(); await flush()
  assert.equal(Object.values(related.states.value)[0].value.values[0].value, 0, 'cancelled reads cannot replace the retained value')
  tick(); await flush(); assert.equal(reads, 3)
  visibility.value = 'visible'; active.value = false; await flush(); tick(); await flush()
  assert.equal(reads, 3)
  active.value = true; delay = false; await flush(); tick(); await flush(); await flush()
  assert.equal(reads, 4); assert.equal(Object.values(related.states.value)[0].refreshError, undefined)
})

test('history defaults to a chart, switches to the same raw rows and uses a table for nonnumeric values', async t => {
  const charts = vue.ref([{ key: 'series' }]), samples = vue.ref([{ timestamp: 100, value: 0, object: { type: 'sample', id: 'A' } }])
  let reads = 0
  const refs = { access: vue.ref({ history: 'past' }), analysis: vue.ref(), objectTypes: vue.ref([]), valueType: vue.ref(), range: vue.ref(),
    mode: vue.ref('history'), operation: vue.ref(), intervalSeconds: vue.ref(1), input: vue.ref({}), busy: vue.ref(false), failed: vue.ref(false),
    limited: vue.ref(false), result: vue.ref({ values: [{ object: { type: 'sample', id: 'A' } }] }), charts, samples, query: () => reads++ }
  const Explorer = load(resolve(root, 'ObjectDataExplorer.vue'), {
    '../JlDrawerShell/index.vue': { __esModule: true, default: vue.defineComponent({ setup: (_props, { slots }) => () => slots.default?.() }) },
    '../RuntimeDiagnostics': { HistoryMetricCharts: () => vue.h('history-chart'), HistoryRangeControl: () => null },
    '../../object-capability/useObjectDataQuery': { useObjectDataQuery: () => refs },
  }).default
  const h = render(t, () => () => vue.h(Explorer, { entry: { member: { name: 'Level' } }, runtime: () => undefined }))
  assert.ok(h.all().some(node => node.type === 'history-chart'))
  assert.equal(h.all().some(node => node.type === 'data-table'), false)
  const switchView = h.all().find(node => node.props['aria-label'] === 'dataDisplay')
  switchView.props.onChange('table'); await flush()
  assert.equal(h.all().some(node => node.type === 'history-chart'), false)
  const table = h.all().find(node => node.type === 'data-table')
  assert.equal(table.props.dataSource[0].value, 0)
  assert.equal(table.props.columns.at(-1).title, 'Level')
  assert.equal(reads, 0, 'presentation changes do not reload or aggregate source data')
  switchView.props.onChange('chart'); await flush()
  assert.ok(h.all().some(node => node.type === 'history-chart'))
  charts.value = []; samples.value[0].value = false; await flush()
  assert.equal(h.all().some(node => node.type === 'history-chart'), false)
  assert.equal(h.all().find(node => node.type === 'data-table').props.dataSource[0].value, false)
})

test('explicit member presentations override source-wide fallbacks in either module order', () => {
  const ref = { providerId: 'ledger', kind: 'query', id: 'summary' }
  const fallback = { typeId: '*', fields: [], members: [{ ref, component: 'Fallback' }] }
  const exact = { typeId: 'reservoir', fields: [], members: [{ ref, component: 'Exact' }] }
  for (const entries of [[exact, fallback], [fallback, exact]]) {
    const { useObjectPresentationRegistry } = load(resolve(root, '../../object-capability/useObjectPresentationRegistry.ts'), {
      '../utils/module-registry': { moduleRegistry: { onChange: () => () => {}, getAllModules: () => new Map(entries.map((entry, i) => [i, { objectPresentations: { entry } }])) } }
    })
    const scope = vue.effectScope()
    scope.run(() => {
      const { objectMemberPresentation } = load(resolve(root, '../../object-capability/presentations.ts'))
      const type = vue.ref('reservoir'), registry = useObjectPresentationRegistry()
      const presentation = vue.computed(() => objectMemberPresentation({ ...ref, type: type.value }, registry.value))
      assert.equal(presentation.value.component, 'Exact')
      type.value = 'warehouse'
      assert.equal(presentation.value.component, 'Fallback')
    })
    scope.stop()
  }
})

test('saved and editing dashboards use the same container-driven narrow projection without rewriting coordinates', () => {
  const width = vue.ref(760)
  const { useObjectDashboardLayout } = load(resolve(root, '../../object-capability/useObjectDashboardLayout.ts'), {
    '@vueuse/core': { useElementSize: () => ({ width }) }
  })
  const stored = { canvas: {}, components: [
    { id: 'main', componentProps: { gridItem: { x: 0, y: 0, w: 8, h: 8 } } },
    { id: 'side', componentProps: { gridItem: { x: 8, y: 0, w: 4, h: 3 } } },
  ] }
  const value = vue.ref(structuredClone(stored)), editing = vue.ref(false), saved = vue.ref('personal')
  const layout = useObjectDashboardLayout(value, editing, saved)
  assert.equal(layout.displayed.value, value.value)
  width.value = 560
  assert.equal(layout.narrow.value, true)
  const narrow = JSON.parse(JSON.stringify(layout.displayed.value))
  assert.ok(narrow.components.every(widget => widget.componentProps.gridItem.x === 0 && widget.componentProps.gridItem.w === 12))
  editing.value = true
  assert.deepEqual(layout.displayed.value, narrow)
  assert.deepEqual(value.value, stored)
  width.value = 760
  assert.equal(layout.displayed.value, value.value)
})

const flush = async () => { await vue.nextTick(); await Promise.resolve(); await vue.nextTick() }
function render(t, setup) {
  const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null, clientHeight: 100, scrollTop: 0 })
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
  for (const name of ['ACard', 'AButton', 'ATooltip', 'APopover', 'AIcon', 'AAlert', 'AEmpty', 'ATag', 'ASpace', 'ASpin', 'AForm', 'ASelect', 'ASelectOption', 'ASkeleton', 'AInput', 'ADropdown', 'AMenu', 'AMenuItem', 'ASegmented']) app.component(name, shell(name))
  app.component('ATable', vue.defineComponent({ props: ['dataSource', 'columns'], setup: (props, { attrs }) => () => vue.h('data-table', { ...attrs, ...props }) }))
  app.component('AList', vue.defineComponent({
    props: ['dataSource', 'rowKey', 'size'],
    setup: (props, { slots, attrs }) => () => vue.h('ul', attrs, props.dataSource.flatMap((item, index) => slots.renderItem?.({ item, index })))
  }))
  app.component('AListItem', vue.defineComponent({ setup: (_props, { slots }) => () => vue.h('li', [slots.default?.(), slots.extra?.()]) }))
  app.component('AListItemMeta', shell('list-meta'))
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
  const operationEvents = []
  const binding = { version: 1, operation: { capabilityId: 'object.action.saved', version: 1 } }
  const selection = { member: { type: 'sample', providerId: 'operations', kind: 'action', id: 'apply' }, binding }
  const entries = vue.shallowRef([{ selection, member: { ref: selection.member, name: 'Apply', sourceName: 'Operations', metadata: { id: 'apply', inputs: [] } }, state: { status: 'ready' } }])
  const preview = vue.ref(false)
  const runtime = {
    async prepareOperation(request) { preparations++; return { id: 'prepared', request, summary: 'Apply', impacts: [{ type: 'sample', id: 'A', name: 'Pump A' }] } },
    confirmOperation(id) { assert.equal(id, 'prepared'); return { id: 'confirmed' } },
    executeOperation() { executions++; return { events$: stream } },
  }
  return { ...render(t, () => () => vue.h(Content, { title: 'Actions', entries: entries.value, preview: preview.value, runtime: () => runtime, onOperation: event => operationEvents.push(event) })), entries, preview, stream, operationEvents, preparations: () => preparations, executions: () => executions }
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
  assert.deepEqual(h.operationEvents.map(event => event.type), ['result', 'warning', 'completed'], 'the host receives original receipt and warning before deciding whether to read back')
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
    '../../object-capability/useObjectCapabilities': { useObjectCapabilities: (_object, options) => { capability.selected = options.selected; return capability } },
    '../../object-capability/useObjectRelatedData': { useObjectRelatedData: () => ({ members: vue.ref([]), states: vue.ref({}) }) },
    '../../object-capability/useObjectPresentationRegistry': { useObjectPresentationRegistry: () => vue.ref(new Map()) },
  }).default
  const h = render(t, () => () => vue.h(Overview, { object: { type: 'sample', id: 'A' }, store }, {
    actions: () => vue.h('button', 'Source action'), default: () => vue.h('records', 'Original records'),
  }))
  return { ...h, capability, alerts: () => h.all().filter(item => item.type === 'AAlert').map(item => item.props.message) }
}

test('standard reading retains all property reads without an expand-all action', async t => {
  const h = overview(t)
  h.capability.members.value = Array.from({ length: 12 }, (_, index) => ({
    ref: { type: 'sample', providerId: 'source', kind: 'property', id: `field-${index}` },
    name: `Field ${index}`, sourceName: 'Source', identitySource: true, metadata: { valueType: { type: 'string' } },
  }))
  h.capability.members.value = [...h.capability.members.value, { ref: { type: 'sample', providerId: 'source', kind: 'query', id: 'requiresParameters' },
    name: 'Parameterized query', sourceName: 'Source', metadata: { inputs: [{ id: 'scope', valueType: { type: 'string' } }] } }]
  h.capability.loading.value = false; await flush()
  assert.equal(h.capability.selected.value.length, 12)
  assert.equal(h.all().filter(node => node.type === 'article').length, 12)
  assert.equal(h.button('showAll'), undefined)
  assert.equal(h.capability.selected.value.length, 12, 'disclosure never rewrites the model or its reads')
  assert.doesNotMatch(h.text(), /Parameterized query/)
  assert.equal(h.all().some(node => node.type === 'dashboard'), false)
})

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
  assert.equal(h.all().find(item => item.props.class?.includes('object-overview__canvas'))?.props.style.minHeight, '110px')
  assert.equal(writes, 0, 'recovery never writes a default page over the saved view')
})
