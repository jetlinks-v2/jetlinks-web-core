import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { parse, compileScript, compileStyleAsync } from 'vue/compiler-sfc'

const root = resolve(import.meta.dirname, '../src')
const load = (file, imports = {}) => {
  const module = { exports: {} }
  const require = name => {
    if (name === 'vue') return vue
    if (name === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (name in imports) return imports[name]
    throw new Error(`Unmocked import ${name}`)
  }
  new Function('require', 'module', 'exports', transformSync(readFileSync(resolve(root, file), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(require, module, module.exports)
  return module.exports
}
const model = load('components/PlatformSettings/model.ts')
const registry = load('components/PlatformSettings/fieldRegistry.ts')
const hooks = load('hooks/usePlatformSettings.ts', {
  '../components/PlatformSettings/model': model, '../components/PlatformSettings/fieldRegistry': registry,
  '@jetlinks-web-core/utils/components-registry': { componentsRegistry: { getRegistry: () => hidden.map(target => ({ mode: 'hide', target })) } },
  '@jetlinks-web-core/utils/public-asset': { resolvePublicAssetUrl: value => value },
})
const init = load('views/init-home/useInitialization.ts')
const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const clone = value => JSON.parse(JSON.stringify(value))
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }
let hidden = []
globalThis.window = { location: { origin: 'https://test.example' } }
async function mount(t, mode = 'detail', options = {}) {
  hidden = options.hidden || []
  let data = { front: { title: 'Saved', ico: '/original.ico', headerTheme: 'dark', layout: 'side', layoutVariant: 'application', extra: { flag: 1 } }, amap: { apiKey: 'web', secretKey: 'secret', webKey: 'service', unknown: 8 }, paths: { 'base-path': 'https://test.example/api', external: true } }
  const writes = []
  const source = {
    load: async () => clone(data),
    save: async patch => { writes.push(clone(patch)); patch.forEach(({ scope, properties }) => { data[scope] = clone(properties) }); return { success: true } },
  }
  let state
  const app = renderer.createApp({ setup() { state = hooks.usePlatformSettings(source, mode, () => options.editable !== false); return () => null } })
  app.mount({}); t.after(() => app.unmount()); await tick()
  return { state, source, writes, current: () => data }
}

test('a field save merges only its scope and preserves hidden, unknown, theme and layout values', async t => {
  const v = await mount(t, 'detail', { hidden: ['ico', 'background', 'showRecordNumber', 'base-path'] })
  v.state.change({ title: 'Changed' })
  assert.equal(v.current().front.title, 'Saved')
  assert.equal((await v.state.persist({ title: 'Changed', ico: '/should-not-save.ico' })).ok, true)
  assert.deepEqual(v.writes[0], [{ scope: 'front', properties: { ...v.current().front, title: 'Changed' } }])
  assert.equal(v.current().front.ico, '/original.ico')
  assert.deepEqual(v.current().front.extra, { flag: 1 })
  assert.equal(v.current().front.headerTheme, 'dark')
  assert.equal(v.current().front.layout, 'side')
  assert.equal(v.current().front.layoutVariant, 'application')
  assert.equal(v.state.saved.value.title, 'Changed')
})

test('form edits and component-level submit only update a draft until unified submit', async t => {
  const v = await mount(t, 'form')
  v.state.change({ title: 'Draft' })
  await v.state.persist({ logo: '/new.png' })
  assert.equal(v.writes.length, 0)
  assert.equal(v.state.saved.value.title, 'Saved')
  assert.equal(await v.state.submitAll(), true)
  assert.equal(v.writes.length, 1)
  assert.equal(v.current().front.title, 'Draft')
  assert.equal(v.current().front.logo, '/new.png')
})

test('failed writes retain drafts and can be retried without changing saved appearance', async t => {
  const v = await mount(t); const save = v.source.save
  v.source.save = async () => ({ success: false })
  assert.equal((await v.state.persist({ title: 'Retry me' })).ok, false)
  assert.equal(v.state.model.title, 'Retry me')
  assert.equal(v.state.saved.value.title, 'Saved')
  assert.equal(v.state.busy.value, false)
  v.source.save = save
  assert.equal((await v.state.persist({ title: 'Retry me' })).ok, true)
  assert.equal(v.current().front.title, 'Retry me')
})

test('a successful write with a failed reread remains successful and refresh never writes', async t => {
  const v = await mount(t); const load = v.source.load
  v.source.load = async () => { throw new Error('read unavailable') }
  assert.equal((await v.state.persist({ title: 'Written' })).ok, true)
  assert.equal(v.state.saved.value.title, 'Written')
  assert.equal(v.state.warning.value, 'PlatformSettings.refreshFailed')
  assert.equal(v.writes.length, 1)
  v.source.load = load; await v.state.reload()
  assert.equal(v.writes.length, 1)
  assert.equal(v.state.warning.value, '')
})

test('a pending save rejects duplicate submission and a concurrent manual refresh', async t => {
  const v = await mount(t); let done; let calls = 0
  v.source.save = async () => { calls++; return new Promise(resolve => { done = resolve }) }
  const first = v.state.persist({ title: 'Pending' })
  assert.equal((await v.state.persist({ title: 'Pending' })).ok, false)
  assert.equal(await v.state.reload(), false)
  assert.equal(calls, 1)
  done({ success: true }); await first
  assert.equal(v.state.busy.value, false)
})

test('readback of a separate field preserves unsaved local appearance drafts', async t => {
  const v = await mount(t)
  v.state.change({ title: 'Draft name' })
  await v.state.persist({ webKey: 'service-2' })
  assert.equal(v.state.model.title, 'Draft name')
  assert.equal(v.current().front.title, 'Saved')
  v.state.change({ title: v.state.saved.value.title })
  assert.equal(v.state.model.title, 'Saved')
})

test('map keys validate in pairs and against persisted values, independent of another draft', async t => {
  const v = await mount(t)
  assert.equal((await v.state.persist({ apiKey: 'new', secretKey: '' })).ok, false)
  assert.equal(v.writes.length, 0)
  v.state.change({ apiKey: 'draft' })
  assert.equal((await v.state.persist({ webKey: 'draft' })).ok, true)
  assert.equal((await v.state.persist({ apiKey: 'draft', secretKey: 'new-secret' })).ok, false)
  assert.equal((await v.state.persist({ apiKey: 'new-web', secretKey: 'new-secret' })).ok, true)
  assert.equal(v.current().amap.unknown, 8)
  assert.equal((await v.state.persist({ apiKey: '', secretKey: '', webKey: '' })).ok, true)
  assert.equal(v.state.saved.value.secretKey, '')
})

test('SaaS initialization saves the icon while hidden fields are neither validated nor materialized', async t => {
  const v = await mount(t, 'form', { hidden: ['background', 'showRecordNumber', 'base-path'] })
  v.state.change({ title: 'SaaS', ico: '/saas.ico', 'base-path': 'invalid', recordNumber: 'hidden' })
  assert.equal(v.writes.length, 0)
  assert.equal(await v.state.submitAll(), true)
  const front = v.writes[0].find(x => x.scope === 'front').properties
  assert.equal(front.background, undefined)
  assert.equal(front.showRecordNumber, undefined)
  assert.equal(front.ico, '/saas.ico')
  assert.equal(v.writes[0].some(x => x.scope === 'paths'), false)
})

test('read-only settings reject draft changes and persistence', async t => {
  const v = await mount(t, 'detail', { editable: false })
  v.state.change({ title: 'Forbidden' })
  assert.equal((await v.state.persist({ title: 'Forbidden' })).ok, false)
  assert.equal(v.state.model.title, 'Saved')
  assert.equal(v.writes.length, 0)
})

test('initialization follows the complete order and stops at every false or thrown stage', async () => {
  const order = ['basic', 'menu', 'role', 'roleGroup', 'data', 'finish']
  for (const failAt of [-1, 0, 1, 2, 3, 4, 5]) {
    for (const thrown of [false, true]) {
      const calls = []; let failure
      const result = await init.runInitialization(order.map((key, index) => ({ key, run: async () => {
        calls.push(key); if (index === failAt) { if (thrown) throw new Error('failed'); return false }; return true
      } })), key => { failure = key })
      assert.deepEqual(calls, failAt === -1 ? order : order.slice(0, failAt + 1))
      assert.equal(result, failAt === -1)
      assert.equal(failure, order[failAt])
    }
  }
})

test('initialization suppresses repeat submits, restores loading after failure and redirects only on success', async () => {
  let finish; let calls = 0; let redirects = 0
  const state = init.useInitialization([{ key: 'basic', run: () => { calls++; return new Promise(resolve => { finish = resolve }) } }], () => redirects++)
  const first = state.submit(); await state.submit(); assert.equal(calls, 1)
  finish(false); await first; assert.equal(state.loading.value, false); assert.equal(redirects, 0)
  const retry = state.submit(); finish(true); await retry
  assert.equal(state.loading.value, false); assert.equal(redirects, 1)
})

test('all new SFCs compile, styles parse, and explicit locale keys exist in all supported languages', async () => {
  const files = readdirSync(resolve(root, 'components/PlatformSettings')).filter(f => f.endsWith('.vue')).map(f => `components/PlatformSettings/${f}`)
  files.push('views/init-home/index.vue', 'views/init-home/Basic/Form.vue', 'views/init-home/Role/index.vue', 'views/init-home/initData/index.vue', 'views/login/index.vue', 'views/login/components/LoginPageLayout.vue')
  const locales = ['zh', 'en', 'ja'].map(lang => JSON.parse(readFileSync(resolve(root, `locales/lang/${lang}.json`), 'utf8')))
  for (const file of files) {
    const filename = resolve(root, file); const source = readFileSync(filename, 'utf8')
    assert.ok(source.split('\n').length <= 300, file)
    const { descriptor, errors } = parse(source, { filename }); assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: file, inlineTemplate: true })
    assert.doesNotThrow(() => transformSync(script.content, { loader: 'ts' }))
    for (const style of descriptor.styles) assert.deepEqual((await compileStyleAsync({ source: style.content, filename, id: file, scoped: style.scoped, preprocessLang: style.lang })).errors, [])
    for (const [, key] of source.matchAll(/['"](PlatformSettings\.\w+)['"]/g)) for (const locale of locales) assert.ok(locale[key], `${file}: ${key}`)
  }
})

test('real role hooks propagate rejection and stop after the first unsuccessful role or group', async t => {
  const calls = []
  const api = {
    addRole: async () => { calls.push('role'); return { success: true, result: { id: 'r1' } } },
    getRoleMenu: async () => { calls.push('grant'); return { success: true, result: { menus: [] } } },
    updateRoleMenu: async () => { calls.push('update'); throw new Error('network') },
    addRoleGroup: async () => { calls.push('group'); return { success: false } },
  }
  const mod = load('views/init-home/Role/useInitializationRoles.ts', {
    '@jetlinks-web-core/api/initHome': api, '@jetlinks-web/utils': { randomString: () => 'group' },
    '../data/RoleData': { default: { device: [], link: [] }, RoleData: { device: {}, link: {} }, __esModule: true },
  })
  let state
  const app = renderer.createApp({ setup() { state = mod.useInitializationRoles(); return () => null } }); app.mount({}); t.after(() => app.unmount())
  state.getCheckValue(['device', 'link'])
  await assert.rejects(state.submitRole(), /network/)
  assert.deepEqual(calls, ['role', 'grant', 'update'])
  state.group.value.forEach(group => { group.selected = true })
  assert.equal(await state.submitRoleGroup(), false)
  assert.deepEqual(calls, ['role', 'grant', 'update', 'group'])
})

test('real initial-data hook stops at each failed API, including activation, without creating downstream resources', async t => {
  const stages = ['saveNetwork', 'saveProtocol', 'getProtocol', 'saveAccessConfig', 'saveProduct', 'saveDevice', 'changeDeploy', 'deployDevice']
  for (let fail = -1; fail < stages.length; fail++) {
    const calls = []
    const api = Object.fromEntries(stages.map((name, index) => [name, async () => {
      calls.push(name)
      return { success: index !== fail, result: name === 'getProtocol' ? [{ id: 'protocol', name: 'init-home.index.011072-19' }] : { id: name, name } }
    }]))
    api.getResourcesCurrent = async () => ({ success: true, result: [] })
    const mod = load('views/init-home/initData/useInitializationData.ts', { '@jetlinks-web-core/api/initHome': api, '@jetlinks-web/utils': { regular: {}, onlyMessage() {} } })
    let state
    const app = renderer.createApp({ setup() { state = mod.useInitializationData(); return () => null } }); app.mount({}); t.after(() => app.unmount())
    state.flag.value = true; state.formRef.value = { validate: async () => true }
    assert.equal(await state.save(), fail === -1)
    assert.deepEqual(calls, fail === -1 ? stages : stages.slice(0, fail + 1))
  }
})

test('field extensions stay with their owning card and unanchored extensions render exactly once', () => {
  const actions = [
    { code: 'extra-title', target: 'title', mode: 'after', component: { render: () => null } },
    { code: 'extra-map', target: 'webKey', mode: 'replace', component: { render: () => null } },
    { code: 'append', mode: 'append', component: { render: () => null } },
    { code: 'hidden', target: 'ico', mode: 'hide' },
  ]
  const componentsRegistry = { getRegistry: () => actions }
  const merge = load('hooks/useRegistryComponentsMerge.ts', {
    '@jetlinks-web-core/utils/components-registry': { componentsRegistry },
    'vue-router': { useRoute: () => ({}) }, 'lodash-es': { cloneDeep: clone, isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  })
  const fields = load('components/PlatformSettings/PlatformSettingsFields.ts', {
    '../../utils/components-registry': { componentsRegistry }, '../../hooks/useRegistryComponentsMerge': merge, './fieldRegistry': registry,
  }).default
  const render = (group, keys) => fields.setup({ group }, { slots: { default: () => keys.map(key => vue.h('div', { key })) }, attrs: {} })().map(node => node.key)
  assert.deepEqual(render('appearance', ['title', 'ico']), ['title', 'extra-title:title'])
  assert.deepEqual(render('map', ['apiKey', 'webKey']), ['apiKey', 'extra-map:webKey'])
  assert.deepEqual(render('address', ['base-path']), ['base-path', 'append:append'])
})
