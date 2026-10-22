import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'

const root = resolve(import.meta.dirname, '..')
const messages = JSON.parse(readFileSync(resolve(root, 'src/locales/lang/zh.json'), 'utf8'))
const translate = (key, values = {}) => (messages[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] || '')
globalThis.window = { btoa, atob }
const require = createRequire(import.meta.url)
const cache = new Map()
let networkCalls = 0
let nextKey = 0
let requestContext
const boundary = {
  '@jetlinks-web/core': { request: { get: async () => { networkCalls++; return { result: requestContext } } } },
  '@jetlinks-web/vite/dist/dynamic-remote': { dynamicRemoteManager: {} },
  '@jetlinks-web-core/utils/consts': { isSubApp: false },
  '@jetlinks-web/utils': { randomString: () => `test-${++nextKey}` },
  'vue-i18n': { useI18n: () => ({ t: translate }) },
}

// Execute production modules and the real Vue scheduler. Only host/network/i18n and child rendering are isolated.
const load = filename => {
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  let source = readFileSync(filename, 'utf8')
  const component = filename.endsWith('.vue')
  if (component) source = compileScript(parse(source, { filename }).descriptor, { id: filename }).content
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
  const imports = id => {
    if (Object.hasOwn(boundary, id)) return boundary[id]
    const path = id.startsWith('@jetlinks-web-core/') ? resolve(root, 'src', id.slice(19))
      : id.startsWith('.') ? resolve(dirname(filename), id) : undefined
    if (path === resolve(root, 'src/locales')) return { __esModule: true, default: { global: { t: translate, te: () => false } } }
    if (!path) return require(id)
    if (id.endsWith('.vue')) return path.endsWith('/AssetOwnershipCondition/index.vue') ? load(path) : {}
    return load(path.endsWith('.ts') ? path : `${path}.ts`)
  }
  new Function('require', 'module', 'exports', ...Object.keys(vue), code)(imports, module, module.exports, ...Object.values(vue))
  if (component) module.exports.default.render = () => null
  return module.exports
}
const source = path => load(resolve(root, 'src', path))
const condition = source('components/AssetOwnershipCondition/condition.ts')
const { useAssetOwnershipCondition } = source('components/AssetOwnershipCondition/useAssetOwnershipCondition.ts')
const { moduleRegistry } = source('utils/module-registry.ts')
const { createAssetOwnershipField, toAssetOwnershipFilterTerm } = source('components/AssetOwnershipCondition/field.ts')
const query = source('components/ConditionFilter/utils.ts')
const base = { assetType: 'application', column: 'assetId', userId: 'user-a' }
const context = (assetType = 'application') => ({
  assetType, controlEnabled: true, scopes: [{ type: 'tenant', id: 'forced', required: true, applied: true }],
  ranges: [{ id: 'all', name: 'All accessible', canSelectTargets: false }, { id: 'creator', name: 'Created by me', canSelectTargets: true },
    ...['org', 'tenant', 'campus'].map(dimensionType => ({ id: `dimension:${dimensionType}`, name: dimensionType, dimensionType, canSelectTargets: true }))],
})
const selection = (rangeId, operator = 'targets', ids = []) => ({ rangeId, operator, ids })
const term = (dimension, operator = 'targets', ids = ['one']) =>
  condition.buildAssetOwnershipTerm(selection(`dimension:${dimension}`, operator, ids), base)
const adapter = (extra = {}) => ({
  getOperators: () => ['targets', 'notTargets', 'bound', 'unbound'],
  createSelector: () => ({ options: [{ value: 'one', label: 'Root', children: [{ value: 'two', label: 'Child' }] }] }),
  ...extra,
})
const register = (name, resources) => moduleRegistry.register(name, { assetDimensionFilters: resources })
const fixture = (extra = {}, value) => {
  const scope = vue.effectScope()
  const changes = [], displays = []
  const props = vue.reactive({ options: { ...base, ...extra }, value })
  const api = scope.run(() => useAssetOwnershipCondition(props,
    next => { changes.push(next); props.value = next }, display => displays.push(display), translate))
  return { props, changes, displays, api, stop: () => scope.stop() }
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('all, creator and each dimension operator round-trip without guessing columns or splitting IDs', () => {
  assert.equal(condition.buildAssetOwnershipTerm(selection('all'), base), undefined)
  const created = condition.buildAssetOwnershipTerm(selection('creator', 'targets', ['user-a']), base)
  assert.deepEqual(created, { column: 'assetId', termType: 'application-creator', value: 'user-a' })
  assert.equal(condition.parseAssetOwnershipTerm(created, base).rangeId, 'creator')
  for (const dimension of ['org', 'tenant', 'campus']) {
    for (const operator of ['targets', 'notTargets', 'bound', 'unbound']) {
      const ids = ['a,1:child', '二级组织']
      const actual = term(dimension, operator, ids)
      const decoded = condition.parseAssetOwnershipTerm(actual, base)
      assert.deepEqual(decoded, selection(`dimension:${dimension}`, operator, ['bound', 'unbound'].includes(operator) ? [] : ids))
      assert.equal(actual.value.not, ['notTargets', 'unbound'].includes(operator))
      assert.equal(Object.hasOwn(actual.value, 'targets'), !['bound', 'unbound'].includes(operator))
    }
  }
  assert.throws(() => term('org', 'targets', []))
  assert.throws(() => condition.buildAssetOwnershipTerm(selection('creator'), { ...base, userId: undefined }))
  assert.throws(() => condition.buildAssetOwnershipTerm(selection('creator', 'notTargets', ['other']), base))
})

test('foreign, mixed and unsupported conditions are not silently reconstructed', () => {
  for (const value of [null, {}, { ...term('org'), column: 'otherId' },
    { ...term('org'), options: ['not'] },
    { ...term('org'), terms: [{ column: 'name', termType: 'eq', value: 'extra' }] },
    { ...term('org'), value: { assetType: 'application', targets: [{ type: 'org', id: '1', relation: 'owner' }] } },
    { ...term('org'), value: { ...term('org').value, closure: 'true' } },
    { ...term('org'), value: { ...term('org').value, closures: [{ type: 'org', id: 'parent' }] } },
    { ...term('org', 'bound'), value: { ...term('org', 'bound').value, closure: true } },
    { ...term('org'), value: { ...term('org').value, assetType: 'device' } },
    { ...term('org'), value: { ...term('org').value, relations: ['owner'] } },
    { ...term('org'), value: { assetType: 'application', targets: [{ type: 'org', id: '1' }, { type: 'tenant', id: '2' }] } },
    { ...term('org'), value: { assetType: 'application', targetType: 'org', targets: [{ type: 'org', id: '1' }] } },
    { column: 'assetId', termType: 'application-creator', value: [] },
    { column: 'assetId', termType: 'application-creator', value: ['user-a', null] },
  ]) assert.equal(condition.parseAssetOwnershipTerm(value, base), undefined)
})

test('simple closures round-trip with multiple targets, negation and OR without enumerating children', () => {
  const labels = new Map([['org', [{ value: 'one', label: '华东' }, { value: 'two', label: '华南' }]]])
  const fields = [{ dataIndex: 'name', search: { type: 'string' } }, createAssetOwnershipField(base)]
  const name = { column: 'name', termType: 'eq', value: 'demo' }
  for (const closure of [true, false]) {
    for (const operator of ['targets', 'notTargets']) {
      const selected = { ...selection('dimension:org', operator, ['one', 'two']), closure }
      const actual = { ...condition.buildAssetOwnershipTerm(selected, base), type: 'or' }
      assert.deepEqual(actual.value.targets, [{ type: 'org', id: 'one' }, { type: 'org', id: 'two' }])
      assert.equal(actual.value.closure, closure)
      assert.deepEqual(condition.parseAssetOwnershipTerm(actual, base), selected)
      const original = [name, toAssetOwnershipFilterTerm(actual)]
      assert.deepEqual(query.buildQueryFilter(query.decodeConditionFilterQuery(query.encodeConditionFilterQuery(original, fields), fields), fields).terms, [name, actual])
      assert.equal(condition.formatAssetOwnershipTerm(actual, base, context(), labels, translate),
        `${operator === 'notTargets' ? '不' : ''}属于org：华东、华南${closure ? '及下级' : ''}`)
    }
  }
})

test('explicit ID input works without directory permission, stays lazy and cannot invent a context range', async () => {
  let directoryCalls = 0
  register('manual-id', { tenant: adapter({ allowIdInput: true, createSelector: () => { directoryCalls++; return {} } }) })
  const c = context()
  c.ranges.find(range => range.id === 'dimension:tenant').canSelectTargets = false
  const h = fixture({ context: c })
  try {
    h.api.selectRange('dimension:tenant')
    assert.deepEqual(h.api.operators.value, ['targets', 'notTargets', 'bound', 'unbound'])
    assert.equal(h.api.targetMode.value, 'input')
    await h.api.openTargets()
    assert.equal(h.api.targetOpen.value, true)
    assert.equal(h.api.selector.value, undefined)
    h.api.selectTargets([' tenant-a ', 'tenant-a', ' ', 'tenant-b'])
    h.api.submit()
    await vue.nextTick()
    assert.deepEqual(h.props.value, term('tenant', 'targets', ['tenant-a', 'tenant-b']))
    await h.api.resumeEditing()
    assert.equal(h.api.targetOpen.value, true)
    assert.deepEqual(h.api.draft.value.ids, ['tenant-a', 'tenant-b'])
    assert.equal(directoryCalls, 0)
    h.props.options.context.ranges = c.ranges.filter(range => range.id !== 'dimension:tenant')
    assert.equal(h.api.failure.value, 'unavailable')
    assert.equal(h.api.targetOpen.value, false)
    h.api.submit()
    assert.equal(h.changes.length, 1)
  } finally { h.stop(); moduleRegistry.unregister('manual-id') }
})

test('switching from a permitted directory to declared ID input ignores late directory names', async () => {
  const pending = deferred()
  register('input-fallback', { campus: adapter({ allowIdInput: true,
    createSelector: () => ({ optionPanel: { loadOptions: () => pending.promise } }),
  }) })
  const h = fixture({ context: context() }, term('campus'))
  try {
    await h.api.resumeEditing()
    assert.equal(h.api.targetMode.value, 'directory')
    const request = h.api.selector.value.optionPanel.loadOptions()
    h.props.options.context.ranges.find(range => range.id === 'dimension:campus').canSelectTargets = false
    assert.equal(h.api.targetOpen.value, false)
    pending.resolve([{ value: 'one', label: 'Late name' }])
    await request
    await h.api.resumeEditing()
    assert.equal(h.api.targetMode.value, 'input')
    assert.equal(h.api.preview.value, '属于campus：one')
    assert.equal(h.changes.length, 0)
  } finally { h.stop(); moduleRegistry.unregister('input-fallback') }
})

test('closure drafts restore, preserve negation and become unavailable if extension support disappears', async () => {
  register('closure-org', { org: adapter({ supportsClosure: true }) })
  const original = condition.buildAssetOwnershipTerm({ ...selection('dimension:org', 'notTargets', ['one']), closure: true }, base)
  const h = fixture({ context: context() }, original)
  try {
    await h.api.resumeEditing()
    assert.equal(h.api.draft.value.closure, true)
    assert.equal(h.api.targetOpen.value, true)
    h.api.selectTargets(['one', 'two'])
    h.api.submit()
    await vue.nextTick()
    assert.equal(h.props.value.value.closure, true)
    assert.equal(h.props.value.value.not, true)
    await h.api.resumeEditing()
    assert.deepEqual(h.api.draft.value.ids, ['one', 'two'])
    assert.equal(h.api.draft.value.closure, true)
    moduleRegistry.unregister('closure-org')
    register('closure-org', { org: adapter() })
    assert.equal(h.api.failure.value, 'unavailable')
    h.api.submit()
    assert.equal(h.changes.length, 1)
    h.api.selectRange('dimension:org')
    assert.equal(h.api.draft.value.closure, undefined)
  } finally { h.stop(); moduleRegistry.unregister('closure-org') }
})

test('existence operators omit closure and ordinary target selection starts without descendants', async () => {
  register('closure-existence', { org: adapter({ supportsClosure: true }) })
  const h = fixture({ context: context() })
  try {
    h.api.selectRange('dimension:org')
    assert.equal(h.api.draft.value.closure, undefined)
    h.api.draft.value.closure = true
    h.api.selectOperator('bound')
    assert.equal(h.api.draft.value.closure, undefined)
    assert.equal(Object.hasOwn(h.changes.at(-1).value, 'closure'), false)
    h.api.selectOperator('notTargets')
    assert.equal(h.api.draft.value.closure, undefined)
  } finally { h.stop(); moduleRegistry.unregister('closure-existence') }
})

test('creator supports explicit users, route round-trip and useful cold previews without requests', () => {
  const created = condition.buildAssetOwnershipTerm(selection('creator', 'targets', ['user-a', 'other', 'missing']), base)
  assert.deepEqual(created.value, ['user-a', 'other', 'missing'])
  assert.deepEqual(condition.parseAssetOwnershipTerm(created, { ...base, userId: undefined }),
    selection('creator', 'targets', created.value))
  const labels = new Map([['creator', [{ value: 'other', label: '张三' }]]])
  assert.equal(condition.formatAssetOwnershipTerm(created, base, context(), labels, translate), '创建人：我、张三、missing')
  const fields = [{ dataIndex: 'name', search: { type: 'string' } }, createAssetOwnershipField(base)]
  const name = { column: 'name', termType: 'eq', value: 'demo' }
  const original = [name, { ...toAssetOwnershipFilterTerm(created), type: 'or' }]
  const restored = query.decodeConditionFilterQuery(query.encodeConditionFilterQuery(original, fields), fields)
  assert.deepEqual(query.buildQueryFilter(restored, fields), { terms: [name, { ...created, type: 'or' }] })
})

test('creator defaults only when selected and uses the same lazy target protocol for multiple users', async () => {
  let factories = 0, requests = 0
  const h = fixture({ context: context(), createCreatorSelector: () => {
    factories++
    return { optionPanel: {
      loadOptions: async () => { requests++; return [{ value: 'other', label: '张三' }] },
      loadSelectedOptions: async () => { requests++; return [] },
    } }
  } })
  try {
    await vue.nextTick()
    assert.equal(factories, 0)
    assert.equal(h.changes.length, 0)
    assert.equal(h.api.ranges.value.find(range => range.value === 'creator').label, '创建人')
    h.api.selectRange('creator')
    assert.deepEqual(h.api.draft.value.ids, ['user-a'])
    assert.equal(h.changes.length, 0)
    await h.api.openTargets()
    assert.equal(factories, 1)
    assert.equal(requests, 0)
    assert.deepEqual(h.api.selector.value.options, [{ value: 'user-a', label: '我' }])
    await h.api.selector.value.optionPanel.loadOptions('张', { pageIndex: 1, pageSize: 20 })
    h.api.selectTargets(['user-a', 'other'])
    h.api.submit()
    await vue.nextTick()
    assert.deepEqual(h.changes.at(-1).value, ['user-a', 'other'])
    assert.equal(h.api.preview.value, '创建人：我、张三')
    await h.api.openTargets()
    assert.deepEqual(h.api.draft.value.ids, ['user-a', 'other'])
  } finally { h.stop() }
})

test('importing a standard OR condition preserves its connector through query and route transforms', () => {
  const fields = [{ dataIndex: 'name', search: { type: 'string' } }, createAssetOwnershipField(base)]
  const name = { column: 'name', termType: 'eq', value: 'demo' }
  const original = { ...term('org'), type: 'or' }
  const imported = [name, toAssetOwnershipFilterTerm(original)]
  assert.deepEqual(query.buildQueryFilter(imported, fields).terms, [name, original])
  const restored = query.decodeConditionFilterQuery(query.encodeConditionFilterQuery(imported, fields), fields)
  assert.deepEqual(query.buildQueryFilter(restored, fields).terms, [name, original])
  restored[1].type = 'and'
  assert.deepEqual(query.buildQueryFilter(restored, fields).terms, [name, { ...original, type: 'and' }])
})

test('creator preserves inaccessible users and ignores pending names after selector permission is removed', async () => {
  const pending = deferred()
  let factories = 0
  const created = { column: 'assetId', termType: 'application-creator', value: ['other', 'deleted'] }
  const h = fixture({ context: context(), createCreatorSelector: () => {
    factories++
    return { optionPanel: { loadSelectedOptions: () => pending.promise } }
  } }, created)
  try {
    await vue.nextTick()
    assert.equal(factories, 0)
    assert.deepEqual(h.api.draft.value.ids, ['other', 'deleted'])
    await h.api.openTargets()
    const work = h.api.selector.value.optionPanel.loadSelectedOptions(['other', 'deleted'])
    h.props.options.createCreatorSelector = undefined
    pending.resolve([{ value: 'other', label: 'Old name' }])
    await work
    await vue.nextTick()
    assert.equal(h.api.targetOpen.value, false)
    assert.equal(h.api.preview.value, '创建人：other、deleted')
    assert.deepEqual(h.props.value, created)
    assert.equal(h.changes.length, 0)
    await h.api.openTargets()
    assert.equal(factories, 1)
    h.api.selectRange('creator')
    assert.equal(h.changes.at(-1).value, 'user-a')
  } finally { h.stop() }
})

test('creator can select users without a current user and never submits an empty target list', async () => {
  const h = fixture({ context: context(), userId: undefined, createCreatorSelector: () => ({ options: [] }) })
  try {
    assert.equal(h.api.ranges.value.find(range => range.value === 'creator').disabled, false)
    h.api.selectRange('creator')
    h.api.submit()
    assert.equal(h.changes.length, 0)
    await h.api.openTargets()
    h.api.selectTargets(['other'])
    h.api.submit()
    assert.equal(h.changes.at(-1).value, 'other')
  } finally { h.stop() }
})

test('context disables creator directory while keeping self and existing user conditions', async () => {
  let factories = 0
  const c = context()
  c.ranges.find(range => range.id === 'creator').canSelectTargets = false
  const original = { column: 'assetId', termType: 'application-creator', value: ['other', 'deleted'] }
  const h = fixture({ context: c, createCreatorSelector: () => { factories++; return {} } }, original)
  try {
    await h.api.openTargets()
    assert.equal(factories, 0)
    assert.deepEqual(h.props.value, original)
    assert.equal(h.changes.length, 0)
    h.api.selectRange('creator')
    assert.equal(h.changes.at(-1).value, 'user-a')
    assert.equal(factories, 0)
    h.props.options.userId = undefined
    assert.equal(h.api.ranges.value.find(range => range.value === 'creator').disabled, true)
  } finally { h.stop() }
})

test('context gates only targeted dimension operators and missing capabilities stay closed', async () => {
  register('selection-capability', { campus: adapter(), org: adapter({ getOperators: () => ['targets'] }) })
  const c = context()
  c.ranges.find(range => range.id === 'dimension:campus').canSelectTargets = false
  delete c.ranges.find(range => range.id === 'dimension:org').canSelectTargets
  const h = fixture({ context: c })
  try {
    assert.equal(h.api.ranges.value.find(range => range.value === 'dimension:org').disabled, true)
    h.api.selectRange('dimension:campus')
    assert.deepEqual(h.api.operators.value, ['bound', 'unbound'])
    assert.equal(h.changes.at(-1).value.targetType, 'campus')
    await h.api.openTargets()
    assert.equal(h.api.selector.value, undefined)
    h.props.options.context.ranges.find(range => range.id === 'dimension:campus').canSelectTargets = true
    assert.deepEqual(h.api.operators.value, ['targets', 'notTargets', 'bound', 'unbound'])
  } finally { h.stop(); moduleRegistry.unregister('selection-capability') }
})

test('revoking context target selection closes the panel and ignores pending names', async () => {
  const pending = deferred()
  const original = { column: 'assetId', termType: 'application-creator', value: ['other'] }
  const h = fixture({ context: context(), createCreatorSelector: () => ({
    optionPanel: { loadSelectedOptions: () => pending.promise },
  }) }, original)
  try {
    await h.api.openTargets()
    const work = h.api.selector.value.optionPanel.loadSelectedOptions(['other'])
    h.props.options.context.ranges.find(range => range.id === 'creator').canSelectTargets = false
    pending.resolve([{ value: 'other', label: 'Late name' }])
    await work
    assert.equal(h.api.targetOpen.value, false)
    assert.equal(h.api.preview.value, '创建人：other')
    assert.deepEqual(h.props.value, original)
    assert.equal(h.changes.length, 0)
  } finally { h.stop() }
})

test('unassigned uses the global backend predicate and preserves route logic without directory requests', async () => {
  const unbound = condition.buildAssetOwnershipTerm(selection('unbound'), base)
  assert.deepEqual(unbound, { column: 'assetId', termType: 'assets-unbound', value: 'application' })
  assert.deepEqual(condition.parseAssetOwnershipTerm(unbound, base), selection('unbound'))
  assert.equal(condition.parseAssetOwnershipTerm({ ...unbound, value: 'device' }, base), undefined)
  assert.equal(condition.parseAssetOwnershipTerm({ ...unbound, value: { assetType: 'application' } }, base), undefined)
  assert.equal(condition.formatAssetOwnershipTerm(unbound, base, undefined, new Map(), translate), '无归属')
  assert.notDeepEqual(unbound, term('tenant', 'unbound'))
  networkCalls = 0
  const c = context()
  c.ranges.unshift({ id: 'unbound', name: '无归属', canSelectTargets: false })
  const h = fixture({ context: c }, { ...unbound, type: 'or' })
  try {
    await vue.nextTick()
    assert.deepEqual(h.api.ranges.value.map(range => range.value),
      ['all', 'creator', 'dimension:org', 'dimension:tenant', 'dimension:campus', 'unbound'])
    assert.equal(c.ranges[0].id, 'unbound', 'presentation sorting must not mutate the Context')
    assert.equal(h.api.failure.value, undefined)
    assert.equal(h.api.preview.value, '无归属')
    assert.equal(h.api.ranges.value.find(range => range.value === 'unbound').disabled, false)
    h.api.selectRange('unbound')
    assert.deepEqual(h.changes.at(-1), { ...unbound, type: 'or' })
    await h.api.openTargets()
    assert.equal(h.api.selector.value, undefined)
    assert.equal(h.api.targetOpen.value, false)
    assert.equal(networkCalls, 0)
    h.props.options.context = context()
    await vue.nextTick()
    assert.equal(h.api.failure.value, 'unavailable')
    h.api.selectRange('unbound')
    h.api.submit()
    assert.equal(h.changes.length, 1)
    assert.deepEqual(h.props.value, { ...unbound, type: 'or' })
  } finally { h.stop() }
  const fields = [createAssetOwnershipField(base), { dataIndex: 'name', title: 'Name', search: { type: 'string' } }]
  const name = { column: 'name', termType: 'eq', value: 'example' }
  const terms = [name, { ...toAssetOwnershipFilterTerm(unbound), type: 'or' }]
  const expected = { terms: [name, { ...unbound, type: 'or' }] }
  assert.deepEqual(query.buildQueryFilter(terms, fields), expected)
  assert.deepEqual(query.buildQueryFilter(query.decodeConditionFilterQuery(query.encodeConditionFilterQuery(terms, fields), fields), fields), expected)
})

test('previews state the matching rule and target names as a sentence', () => {
  const c = context()
  c.ranges.find(range => range.dimensionType === 'org').name = '组织'
  c.ranges.find(range => range.dimensionType === 'tenant').name = '租户'
  const labels = new Map([['org', [{ value: 'one', label: '研发部' }, { value: 'two', label: '运维部' }]]])
  const format = (dimension, operator) => condition.formatAssetOwnershipTerm(term(dimension, operator, ['one', 'two']), base, c, labels, translate)
  assert.equal(format('org', 'targets'), '属于组织：研发部、运维部')
  assert.equal(format('org', 'notTargets'), '不属于组织：研发部、运维部')
  assert.equal(format('tenant', 'bound'), '已绑定租户')
  assert.equal(format('tenant', 'unbound'), '未绑定任何租户')
})

test('mount preparation and cold reflection have zero requests; context is deduplicated and loaded on interaction', async () => {
  networkCalls = 0
  requestContext = context()
  const h = fixture({}, term('org'))
  try {
    createAssetOwnershipField({ ...base })
    await vue.nextTick()
    assert.equal(networkCalls, 0)
    assert.match(h.api.preview.value, /org.*one/)
    const first = h.api.activate(), second = h.api.activate()
    assert.equal(first, second)
    await first
    assert.equal(networkCalls, 1)
    await h.api.activate()
    assert.equal(networkCalls, 1)
    assert.equal(h.changes.length, 0)
  } finally { h.stop() }
})

test('context failure preserves selection and retries on the next explicit interaction', async () => {
  let attempts = 0
  const value = term('org')
  const h = fixture({ loadContext: () => { if (++attempts === 1) throw Error('offline'); return Promise.resolve(context()) } }, value)
  try {
    await h.api.activate()
    assert.equal(h.api.failure.value, 'contextFailed')
    assert.deepEqual(h.props.value, value)
    assert.equal(h.changes.length, 0)
    await h.api.activate()
    assert.equal(attempts, 2)
    assert.equal(h.api.contextFailed.value, false)
  } finally { h.stop() }
})

test('reopening restores targeted creator or dimension selections, while existence and denied ranges stay directory-free', async () => {
  let factories = 0
  register('reopen-org', { org: adapter({ createSelector: () => { factories++; return {} } }) })
  const creator = { column: 'assetId', termType: 'application-creator', value: ['user-a', 'other'] }
  const options = { loadContext: async () => context(), createCreatorSelector: () => { factories++; return {} } }
  try {
    for (const original of [creator, term('org', 'notTargets', ['two'])]) {
      const h = fixture(options, original)
      try {
        const before = factories
        await h.api.resumeEditing()
        assert.equal(h.api.targetOpen.value, true)
        assert.equal(factories, before + 1)
        assert.deepEqual(h.api.draft.value, condition.parseAssetOwnershipTerm(original, base))
        assert.equal(h.changes.length, 0)
      } finally { h.stop() }
    }
    const denied = context()
    denied.ranges.forEach(range => { range.canSelectTargets = false })
    for (const [extra, original] of [[options, term('org', 'unbound')], [{ ...options, context: denied }, creator]]) {
      const h = fixture(extra, original)
      try {
        const before = factories
        await h.api.resumeEditing()
        assert.equal(h.api.targetOpen.value, false)
        assert.equal(factories, before)
        assert.equal(h.changes.length, 0)
        assert.deepEqual(h.props.value, original)
      } finally { h.stop() }
    }
  } finally { moduleRegistry.unregister('reopen-org') }
})

test('a pending reopen cannot restore an old directory after the condition changes or the editor unmounts', async () => {
  for (const stop of [false, true]) {
    const pending = deferred()
    let factories = 0
    const original = { column: 'assetId', termType: 'application-creator', value: ['other'] }
    const h = fixture({ loadContext: () => pending.promise, createCreatorSelector: () => { factories++; return {} } }, original)
    try {
      const opening = h.api.resumeEditing()
      await vue.nextTick()
      if (stop) h.stop()
      else { h.props.value = term('org', 'unbound'); await vue.nextTick() }
      pending.resolve(context())
      await opening
      assert.equal(h.api.targetOpen.value, false)
      assert.equal(factories, 0)
      assert.equal(h.changes.length, 0)
    } finally { h.stop() }
  }
})

test('custom module supplies selection and bound/unbound operators without modifying core', async () => {
  const description = vue.ref('按校区归属筛选')
  register('campus-extension', { campus: adapter({
    icon: 'EnvironmentOutlined', getDescription: () => description.value,
  }) })
  const h = fixture({ context: context() })
  try {
    const campus = () => h.api.ranges.value.find(range => range.value === 'dimension:campus')
    assert.equal(campus().icon, 'EnvironmentOutlined')
    assert.equal(campus().description, '按校区归属筛选')
    description.value = 'Filter by campus ownership'
    assert.equal(campus().description, 'Filter by campus ownership')
    h.api.selectRange('dimension:campus')
    assert.equal(h.changes.length, 0, 'incomplete target selection must not clear the committed condition')
    await h.api.openTargets()
    h.api.selectTargets(['two'])
    h.api.submit()
    await vue.nextTick()
    assert.deepEqual(h.changes.at(-1), term('campus', 'targets', ['two']))
    assert.match(h.api.preview.value, /Root\/Child/)
    h.api.selectOperator('unbound')
    assert.deepEqual(h.changes.at(-1), term('campus', 'unbound'))
    h.api.selectOperator('bound')
    assert.deepEqual(h.changes.at(-1), term('campus', 'bound'))
    h.api.selectRange('creator')
    assert.equal(h.changes.at(-1).value, base.userId)
    h.api.selectRange('all')
    assert.equal(h.changes.at(-1), undefined)
  } finally { h.stop(); moduleRegistry.unregister('campus-extension') }
})

test('context capabilities, module support and user identity restrict selectable choices', async () => {
  register('capability-extension', { campus: adapter({ getOperators: asset => asset === 'application' ? ['bound'] : [] , createSelector: undefined }) })
  const h = fixture({ context: context(), userId: undefined })
  try {
    assert.equal(h.api.ranges.value.find(range => range.value === 'creator').disabled, true)
    assert.equal(h.api.ranges.value.find(range => range.value === 'dimension:org').disabled, true)
    h.api.selectRange('dimension:campus')
    assert.deepEqual(h.changes.at(-1), term('campus', 'bound'))
    h.api.selectOperator('unbound')
    assert.equal(h.changes.length, 1)
    h.props.options.context = { ...context(), ranges: context().ranges.filter(range => range.id !== 'dimension:campus') }
    await vue.nextTick()
    h.api.selectRange('dimension:campus')
    assert.equal(h.changes.length, 1, 'registry cannot grant a range absent from context')
  } finally { h.stop(); moduleRegistry.unregister('capability-extension') }
})

test('missing, duplicate and unloaded providers preserve existing conditions', () => {
  const h = fixture({ context: context() }, term('org'))
  try {
    assert.equal(h.api.failure.value, 'unavailable')
    h.api.submit()
    register('org-first', { org: adapter() })
    assert.equal(h.api.failure.value, undefined)
    register('org-duplicate', { org: adapter() })
    assert.equal(h.api.failure.value, 'unavailable')
    moduleRegistry.unregister('org-duplicate')
    assert.equal(h.api.failure.value, undefined)
    moduleRegistry.unregister('org-first')
    h.api.submit()
    assert.equal(h.api.failure.value, 'unavailable')
    assert.equal(h.changes.length, 0)
    assert.deepEqual(h.props.value, term('org'))
  } finally { h.stop() }
})

test('target-only providers without a selector are disabled; custom editors can supply display labels', async () => {
  register('custom-editor', { campus: adapter({ getOperators: () => ['targets'], createSelector: undefined }) })
  const h = fixture({ context: context() }, term('campus'))
  try {
    assert.equal(h.api.ranges.value.find(range => range.value === 'dimension:campus').disabled, true)
    moduleRegistry.unregister('custom-editor')
    register('custom-editor', { campus: adapter({ createSelector: () => ({ component: {} }) }) })
    await h.api.openTargets()
    h.api.selector.value.onOptionsChange([{ value: 'one', label: 'Custom label' }])
    assert.match(h.api.preview.value, /Custom label/)
    const lateLabels = h.api.selector.value.onOptionsChange
    h.api.selectOperator('unbound')
    lateLabels([{ value: 'one', label: 'Late label' }])
    assert.equal(h.displays.at(-1).labels.get('campus')[0].label, 'Custom label')
  } finally { h.stop(); moduleRegistry.unregister('custom-editor') }
})

test('target loaders and name resolution run only after opening targets and retain failures for retry', async () => {
  let loads = 0, selectedLoads = 0, fail = true
  register('lazy-org', { org: adapter({ createSelector: () => ({ optionPanel: {
    loadOptions: async () => { loads++; if (fail) throw Error('offline'); return [{ value: 'one', label: 'Resolved org' }] },
    loadSelectedOptions: async ids => { selectedLoads++; return ids.map(value => ({ value, label: 'Resolved org' })) },
  } }) }) })
  const h = fixture({ context: context() }, term('org'))
  try {
    await h.api.activate()
    assert.equal(loads + selectedLoads, 0)
    await h.api.openTargets()
    const config = h.api.selector.value.optionPanel
    await assert.rejects(config.loadOptions('query'))
    assert.equal(h.api.failure.value, 'optionsFailed')
    h.api.submit()
    assert.equal(h.changes.length, 0)
    fail = false
    await h.api.openTargets()
    await h.api.selector.value.optionPanel.loadSelectedOptions(['one'])
    assert.match(h.api.preview.value, /Resolved org/)
    assert.equal(h.api.failure.value, undefined)
    assert.equal(loads, 1)
    assert.equal(selectedLoads, 1)
  } finally { h.stop(); moduleRegistry.unregister('lazy-org') }
})

for (const loader of ['loadOptions', 'loadSelectedOptions']) {
  test(`${loader}: a stale failure cannot disable a newer successful selection`, async () => {
    const old = deferred(), current = deferred()
    const requests = [old, current]
    const created = { column: 'assetId', termType: 'application-creator', value: 'other' }
    const h = fixture({ context: context(), createCreatorSelector: () => ({
      optionPanel: { [loader]: () => requests.shift().promise },
    }) }, created)
    try {
      await h.api.openTargets()
      const load = h.api.selector.value.optionPanel[loader]
      const stale = load(loader === 'loadOptions' ? 'old' : ['other'])
      const latest = load(loader === 'loadOptions' ? 'new' : ['other'])
      current.resolve([{ value: 'other', label: 'Current name' }])
      await latest
      old.reject(Error('stale failure'))
      await assert.rejects(stale)
      assert.equal(h.api.failure.value, undefined)
      assert.equal(h.api.preview.value, '创建人：Current name')
      h.api.submit()
      assert.deepEqual(h.changes.at(-1), created)
    } finally { h.stop() }
  })

  test(`${loader}: stale success cannot overwrite labels from the latest response`, async () => {
    const old = deferred(), current = deferred()
    const requests = [old, current]
    const h = fixture({ context: context(), createCreatorSelector: () => ({
      optionPanel: { [loader]: () => requests.shift().promise },
    }) }, { column: 'assetId', termType: 'application-creator', value: 'other' })
    try {
      await h.api.openTargets()
      const load = h.api.selector.value.optionPanel[loader]
      const stale = load(loader === 'loadOptions' ? 'old' : ['other'])
      const latest = load(loader === 'loadOptions' ? 'new' : ['other'])
      current.resolve([{ value: 'other', label: 'Current name' }])
      await latest
      old.resolve([{ value: 'other', label: 'Stale name' }])
      await stale
      assert.equal(h.api.preview.value, '创建人：Current name')
      assert.equal(h.displays.at(-1).labels.get('creator').find(item => item.value === 'other').label, 'Current name')
    } finally { h.stop() }
  })
}

test('successful retries clear only their own loader errors without reopening the selector', async () => {
  let failSearch = true, failSelected = true
  const options = [{ value: 'other', label: 'Resolved name' }]
  const h = fixture({ context: context(), createCreatorSelector: () => ({ optionPanel: {
    loadOptions: async () => { if (failSearch) throw Error('search offline'); return options },
    loadSelectedOptions: async () => { if (failSelected) throw Error('lookup offline'); return options },
  } }) }, { column: 'assetId', termType: 'application-creator', value: 'other' })
  try {
    await h.api.openTargets()
    const config = h.api.selector.value.optionPanel
    await assert.rejects(config.loadOptions('query'))
    await assert.rejects(config.loadSelectedOptions(['other']))
    failSearch = false
    await config.loadOptions('query')
    assert.equal(h.api.failure.value, 'optionsFailed', 'search success must not clear a lookup error')
    h.api.submit()
    assert.equal(h.changes.length, 0)
    failSelected = false
    await config.loadSelectedOptions(['other'])
    assert.equal(h.api.failure.value, undefined)
    h.api.submit()
    assert.equal(h.changes.at(-1).value, 'other')
  } finally { h.stop() }
})

test('asset/identity changes and unmount discard late context responses without an automatic reload', async () => {
  const pending = deferred()
  let loads = 0
  const h = fixture({ loadContext: () => { loads++; return pending.promise } }, term('org'))
  try {
    const work = h.api.activate()
    await Promise.resolve()
    h.props.options.assetType = 'device'
    pending.resolve(context())
    await work
    assert.equal(h.api.context.value, undefined)
    assert.equal(loads, 1)
    assert.equal(h.changes.length, 0)
    assert.equal(h.api.invalid.value, true)
  } finally { h.stop() }
  const late = deferred()
  const stopped = fixture({ loadContext: () => late.promise })
  const work = stopped.api.activate()
  stopped.stop()
  late.resolve(context())
  await work
  assert.equal(stopped.displays.length, 0)
})

test('late target failures do not overwrite a new operator or external condition', async () => {
  const pending = deferred()
  register('late-org', { org: adapter({ createSelector: () => ({ optionPanel: { loadOptions: () => pending.promise } }) }) })
  const h = fixture({ context: context() }, term('org'))
  try {
    await h.api.openTargets()
    const work = h.api.selector.value.optionPanel.loadOptions('query')
    h.api.selectOperator('unbound')
    pending.reject(Error('late failure'))
    await assert.rejects(work)
    await vue.nextTick()
    assert.equal(h.api.failure.value, undefined)
    assert.deepEqual(h.changes.at(-1), term('org', 'unbound'))
  } finally { h.stop(); moduleRegistry.unregister('late-org') }
})

test('switching the asset before a pending interaction settles cannot start or open a stale selector', async () => {
  let loads = 0
  const h = fixture({ loadContext: async () => { loads++; return context() } }, term('org'))
  try {
    const opening = h.api.openTargets()
    h.props.options.assetType = 'device'
    await opening
    assert.equal(loads, 0)
    assert.equal(h.api.targetOpen.value, false)
    assert.equal(h.api.selector.value, undefined)
  } finally { h.stop() }
})

test('real ConditionFilter transforms and route encoding preserve AND/OR and unsupported existing semantics', () => {
  const fields = [createAssetOwnershipField({ ...base }, { dataIndex: 'tenantOwnership' }),
    createAssetOwnershipField({ ...base }, { dataIndex: 'orgOwnership' })]
  const tenant = toAssetOwnershipFilterTerm(term('tenant', 'unbound'), 'tenantOwnership')
  const org = toAssetOwnershipFilterTerm(term('org', 'targets', ['one', 'two']), 'orgOwnership')
  const terms = [tenant, { ...org, type: 'and' }]
  const before = query.buildQueryFilter(terms, fields)
  assert.equal(before.terms.length, 2)
  assert.equal(before.terms[0].value.targetType, 'tenant')
  assert.equal(before.terms[1].value.targets.length, 2)
  assert.equal(before.terms[1].type, 'and')
  const restored = query.decodeConditionFilterQuery(query.encodeConditionFilterQuery(terms, fields), fields)
  assert.deepEqual(query.buildQueryFilter(restored, fields), before)
  const grouped = [{ terms: [tenant, { ...org, type: 'or' }] }]
  assert.equal(query.buildQueryFilter(grouped, fields).terms[0].terms[1].type, 'or')
  assert.deepEqual(query.buildQueryFilter(query.decodeConditionFilterQuery(query.encodeConditionFilterQuery(grouped, fields), fields), fields),
    query.buildQueryFilter(grouped, fields))
  const original = { ...term('org'), value: { ...term('org').value, closure: true, relations: ['owner'] } }
  assert.deepEqual(query.buildQueryFilter([toAssetOwnershipFilterTerm(original, 'orgOwnership')], fields).terms[0], original)
})

test('the real editor SFC mounts and changes external conditions without triggering context or target requests', async () => {
  networkCalls = 0
  const component = source('components/AssetOwnershipCondition/index.vue').default
  const renderer = vue.createRenderer({ createElement: tag => ({ tag, children: [] }),
    createText: text => ({ text }), createComment: text => ({ text }),
    insert: (child, parent) => parent.children.push(child), remove: () => {},
    setText: () => {}, setElementText: () => {}, patchProp: () => {}, parentNode: () => null, nextSibling: () => null })
  const props = vue.reactive({ options: { ...base }, value: term('org') })
  const changes = []
  const app = renderer.createApp({ setup: () => () => vue.h(component, { ...props, onChange: value => changes.push(value) }) })
  app.mount({ children: [] })
  try {
    props.value = term('tenant', 'unbound')
    await vue.nextTick()
    assert.equal(networkCalls, 0)
    assert.equal(changes.length, 0)
  } finally { app.unmount() }
  const filename = resolve(root, 'src/components/AssetOwnershipCondition/index.vue')
  const descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor
  const script = compileScript(descriptor, { id: 'ownership' })
  const template = compileTemplate({ source: descriptor.template.content, filename, id: 'ownership', compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
})

test('the ConditionFilter field reopens the real SFC with checked IDs and resolves user labels without changing query values', async () => {
  const component = source('components/AssetOwnershipCondition/index.vue').default
  const renderer = vue.createRenderer({ createElement: tag => ({ tag, children: [] }),
    createText: text => ({ text }), createComment: text => ({ text }),
    insert: (child, parent) => parent.children.push(child), remove: () => {},
    setText: () => {}, setElementText: () => {}, patchProp: () => {}, parentNode: () => null, nextSibling: () => null })
  let contextLoads = 0, directories = 0
  const field = createAssetOwnershipField({ ...base, loadContext: async () => { contextLoads++; return context() },
    createCreatorSelector: () => ({ optionPanel: { loadSelectedOptions: async ids => {
      directories++
      return ids.filter(id => id === 'other').map(value => ({ value, label: '张三 (zhangsan)' }))
    } } }),
  })
  const original = { column: 'assetId', termType: 'application-creator', value: ['user-a', 'other', 'deleted'] }
  const restored = query.decodeConditionFilterQuery(query.encodeConditionFilterQuery([toAssetOwnershipFilterTerm(original)], [field]), [field])
  assert.equal(contextLoads, 0)
  assert.equal(directories, 0)
  const blank = renderer.createApp({ setup: () => () => vue.h(component, field.search.componentProps) })
  blank.mount({ children: [] })
  await vue.nextTick()
  assert.equal(contextLoads, 0, 'opening a new, empty field does not restore a directory')
  blank.unmount()
  for (let opening = 0; opening < 2; opening++) {
    const editor = vue.ref()
    const changes = []
    const app = renderer.createApp({ setup: () => () => vue.h(component, {
      ...field.search.componentProps, value: restored[0].value, ref: editor, onChange: value => changes.push(value),
    }) })
    app.mount({ children: [] }) // 模拟用户点击 Token 后，ConditionFilter 按需创建新的编辑实例。
    try {
      await new Promise(resolve => setImmediate(resolve))
      const state = editor.value.$.setupState
      assert.equal(state.targetOpen, true)
      assert.deepEqual(state.draft.ids, original.value)
      await state.selector.optionPanel.loadSelectedOptions(state.draft.ids)
      assert.equal(field.search.formatValuePreview(original), '创建人：我、张三 (zhangsan)、deleted')
      assert.equal(state.preview, '创建人：我、张三 (zhangsan)、deleted')
      await state.onRangeChange(undefined)
      assert.deepEqual(state.draft.ids, original.value, 'clicking the current range must not reset users to self')
      assert.equal(changes.length, 0)
      assert.deepEqual(query.buildQueryFilter(restored, [field]).terms, [original])
    } finally { app.unmount() }
  }
  assert.equal(contextLoads, 2)
  assert.equal(directories, 2)
})
