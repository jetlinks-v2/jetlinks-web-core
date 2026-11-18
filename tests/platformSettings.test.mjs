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
  new Function('require', 'module', 'exports', 'glob', transformSync(readFileSync(resolve(root, file), 'utf8'), {
    loader: 'ts', format: 'cjs', define: { 'import.meta.glob': 'glob' },
  }).code)(require, module, module.exports, () => ({}))
  return module.exports
}
const languageOptions = load('locales/languageOptions.ts')
const model = load('components/PlatformSettings/model.ts', { '../../locales/languageOptions': languageOptions })
const sectionHooks = load('components/PlatformSettings/usePlatformSettingsSection.ts', { './model': model })
const registry = load('components/PlatformSettings/fieldRegistry.ts')
const user = vue.reactive({
  userInfo: {},
  get isSuperAdmin() { return this.userInfo.username === 'admin' },
})
const saas = load('../../modules/saas-runtime-ui/index.ts', {
  '@jetlinks-web-core/locales': { global: { t: key => key } },
  '@jetlinks-web-core/store': { handleSiderBreadcrumb: value => value },
  '@jetlinks-web-core/store/user': { useUserStore: () => user },
  '@jetlinks-web-core/router/types': { RouteSecurityLevel: {} },
  '@jetlinks-web-core/components/PlatformSettings': registry,
}).default
const backgrounds = load('utils/login-background.ts', {
  '@jetlinks-web-core/assets/login/login-bg.png': '/default-saas.png',
  './deployment': { isPrivateDeployment: () => false },
  './public-asset': { resolvePublicAssetUrl: value => value || '' },
})
const hooks = load('hooks/usePlatformSettings.ts', {
  '../components/PlatformSettings/model': model, '../components/PlatformSettings/fieldRegistry': registry,
  '@jetlinks-web-core/utils/components-registry': { componentsRegistry: { getRegistry: () => actions } },
  '@jetlinks-web-core/utils/public-asset': { resolvePublicAssetUrl: value => value },
  '@jetlinks-web-core/utils/login-background': backgrounds,
})
const init = load('views/init-home/useInitialization.ts')
const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}), insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null })
const clone = value => JSON.parse(JSON.stringify(value))
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }
let actions = []
globalThis.window = { location: { origin: 'https://test.example' } }
async function mount(t, mode = 'detail', options = {}) {
  user.userInfo = options.user || {}
  actions = options.saas ? saas.getRegisterComponents().filter(action => action.targetPage === registry.BASIS_FORM_PAGE_CODE)
    : (options.hidden || []).map(target => ({ mode: 'hide', target }))
  let data = { front: { title: 'Saved', ico: '/original.ico', headerTheme: 'dark', layout: 'side', layoutVariant: 'application', extra: { flag: 1 }, ...options.front }, amap: { apiKey: 'web', secretKey: 'secret', webKey: 'service', unknown: 8, ...options.amap }, paths: { 'base-path': 'https://test.example/api', external: true } }
  const writes = []
  const appliedLanguages = []
  const source = {
    load: async () => clone(data),
    save: async patch => { writes.push(clone(patch)); patch.forEach(({ scope, properties }) => { data[scope] = clone(properties) }); return { success: true } },
  }
  const system = {
    async queryInfo() { system.systemInfo = await source.load(); return { success: true } },
    systemInfo: {},
    supportsFrontLanguagePolicy: () => options.platformContext !== false,
    applySavedFrontLanguages: value => { appliedLanguages.push(clone(value)) },
  }
  const useSystemPlatformSettings = load('hooks/useSystemPlatformSettings.ts', {
    './usePlatformSettings': hooks,
    '@jetlinks-web-core/store/system': { useSystemStore: () => system },
    '@jetlinks-web-core/store/auth': { useAuthStore: () => ({ hasPermission: code => code === 'system/Basis:update' && options.editable !== false }) },
    '@jetlinks-web-core/store/user': { useUserStore: () => user },
    '@jetlinks-web-core/api/system/basis': { save_api: payload => source.save(payload) },
  }).useSystemPlatformSettings
  let state
  const app = renderer.createApp({ setup() {
    state = options.systemBinding || options.saas
      ? useSystemPlatformSettings(mode)
      : hooks.usePlatformSettings(source, mode, () => options.editable !== false)
    return () => null
  } })
  app.mount({}); t.after(() => app.unmount()); await tick()
  return { state, source, writes, appliedLanguages, current: () => data }
}

async function mountSections(t, mode = 'detail', options = {}) {
  const v = await mount(t, mode, options)
  const props = {
    mode, model: v.state.model,
    get saved() { return v.state.saved.value },
    get hidden() { return v.state.hidden.value },
    get disabled() { return v.state.disabled.value },
    get busy() { return v.state.busy.value },
    submit: v.state.persist,
  }
  let appearance, map
  const app = renderer.createApp({ setup() {
    appearance = sectionHooks.usePlatformSettingsSection(props, 'front', v.state.change)
    map = sectionHooks.usePlatformSettingsSection(props, 'amap', v.state.change)
    return () => null
  } })
  app.mount({}); t.after(() => app.unmount())
  return { ...v, appearance, map }
}

test('section editing stages appearance and map changes; cancel restores only its own values and errors', async t => {
  const v = await mountSections(t)
  assert.equal(v.appearance.disabled.value, true)
  assert.equal(v.map.disabled.value, true)
  v.appearance.change({ title: 'Blocked' })
  assert.equal(v.state.model.title, 'Saved')
  v.appearance.start(); v.map.start()
  v.appearance.change({ title: 'Draft', ico: '/draft.ico', background: '/draft.png', recordNumber: '备案', showRecordNumber: true })
  v.map.change({ apiKey: 'map-draft', secretKey: '' })
  assert.equal(v.writes.length, 0)
  assert.equal(v.state.assets.value.ico, '/draft.ico')
  assert.equal(await v.map.save(), false)
  assert.ok(v.state.errors.value.apiKey)
  v.appearance.cancel()
  assert.equal(v.state.model.title, 'Saved')
  assert.equal(v.state.assets.value.ico, '/original.ico')
  assert.equal(v.state.model.background, '')
  assert.equal(v.state.model.showRecordNumber, false)
  assert.equal(v.state.model.apiKey, 'map-draft')
  assert.ok(v.state.errors.value.apiKey)
  v.map.cancel()
  assert.equal(v.state.model.apiKey, 'web')
  assert.deepEqual(v.state.errors.value, {})
  assert.equal(v.map.failure.value, '')
  assert.equal(v.map.disabled.value, true)
  assert.equal(v.writes.length, 0)
})

test('saving a section preserves other drafts and validation errors, hidden fields, and extension settings', async t => {
  const v = await mountSections(t, 'detail', { hidden: ['background', 'showRecordNumber'] })
  v.appearance.start(); v.map.start()
  v.appearance.change({ title: 'Appearance', background: '/hidden.png' })
  v.map.change({ apiKey: 'new-map', secretKey: '' })
  assert.equal(await v.map.save(), false)
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.writes[0].map(item => item.scope), ['front'])
  assert.equal(v.writes[0][0].properties.background, undefined)
  assert.equal(v.writes[0][0].properties.showRecordNumber, undefined)
  assert.equal(v.writes[0][0].properties.headerTheme, 'dark')
  assert.deepEqual(v.writes[0][0].properties.extra, { flag: 1 })
  assert.equal(v.appearance.editing.value, false)
  assert.equal(v.map.editing.value, true)
  assert.equal(v.state.model.apiKey, 'new-map')
  assert.ok(v.state.errors.value.apiKey)
  v.map.change({ secretKey: 'new-secret' })
  assert.equal(await v.map.save(), true)
  assert.deepEqual(v.writes[1].map(item => item.scope), ['amap'])
  assert.equal(v.current().amap.unknown, 8)
  assert.equal(v.current().front.title, 'Appearance')
})

test('failed section saves keep drafts for retry, while unchanged saves and map clear cancellations never write', async t => {
  const v = await mountSections(t)
  v.appearance.start()
  assert.equal(await v.appearance.save(), true)
  assert.equal(v.writes.length, 0)
  v.map.start(); v.map.change({ apiKey: '', secretKey: '', webKey: '' }); v.map.cancel()
  assert.equal(v.writes.length, 0)
  assert.equal(v.map.configured.value, true)
  v.map.start(); v.map.change({ apiKey: '', secretKey: '', webKey: '' })
  const save = v.source.save
  v.source.save = async () => { throw new Error('offline') }
  assert.equal(await v.map.save(), false)
  assert.equal(v.map.editing.value, true)
  assert.equal(v.map.saving.value, false)
  assert.equal(v.state.model.apiKey, '')
  assert.equal(v.state.saved.value.apiKey, 'web')
  assert.ok(v.map.failure.value)
  v.source.save = save
  assert.equal(await v.map.save(), true)
  assert.equal(v.map.configured.value, false)
  assert.equal(v.map.editing.value, false)
  assert.equal(v.current().amap.unknown, 8)
})

test('upload and crop locks prevent appearance save and cancel; pending writes reject repeated submissions', async t => {
  const v = await mountSections(t)
  v.appearance.start(); v.appearance.change({ title: 'Changed' })
  v.appearance.uploading('logo', true); v.appearance.uploading('background', true)
  assert.equal(v.appearance.actionsDisabled.value, true)
  assert.equal(await v.appearance.save(), false)
  v.appearance.cancel()
  assert.equal(v.appearance.editing.value, true)
  v.appearance.uploading('logo', false)
  assert.equal(v.appearance.actionsDisabled.value, true)
  v.appearance.change({ background: '/uploaded.png' })
  v.appearance.uploading('background', false)
  let done, calls = 0
  v.source.save = async () => { calls++; return new Promise(resolve => { done = resolve }) }
  const pending = v.appearance.save()
  assert.equal(v.appearance.saving.value, true)
  assert.equal(await v.appearance.save(), false)
  v.appearance.cancel()
  assert.equal(v.appearance.editing.value, true)
  assert.equal(calls, 1)
  done({ success: true }); await pending
  assert.equal(v.appearance.saving.value, false)
  assert.equal(v.appearance.editing.value, false)
})

test('an in-flight appearance upload can finish during a map write without losing its draft on readback', async t => {
  const v = await mountSections(t)
  v.appearance.start(); v.map.start()
  v.appearance.uploading('logo', true)
  v.map.change({ webKey: 'updated-service' })
  const save = v.source.save
  let done
  v.source.save = async patch => { await new Promise(resolve => { done = resolve }); return save(patch) }
  const pending = v.map.save()
  assert.equal(v.state.busy.value, true)
  v.appearance.change({ logo: '/finished-upload.png' })
  v.appearance.uploading('logo', false)
  done(); await pending
  assert.equal(v.state.model.logo, '/finished-upload.png')
  assert.notEqual(v.state.saved.value.logo, '/finished-upload.png')
  assert.deepEqual(v.writes[0].map(item => item.scope), ['amap'])
  v.source.save = save
  assert.equal(await v.appearance.save(), true)
  assert.equal(v.current().front.logo, '/finished-upload.png')
})

test('unconfigured maps require explicit editing, read-only sections reject changes, and initialization still submits once', async t => {
  const emptyMap = { apiKey: '', secretKey: '', webKey: '' }
  const v = await mountSections(t, 'detail', { amap: emptyMap })
  assert.equal(v.map.configured.value, false)
  assert.equal(v.map.disabled.value, true)
  v.map.start(); v.map.change({ apiKey: 'first', secretKey: 'secret' })
  assert.equal(v.writes.length, 0)
  assert.equal(await v.map.save(), true)
  const readonly = await mountSections(t, 'detail', { editable: false })
  readonly.appearance.start(); readonly.appearance.change({ title: 'Forbidden' })
  assert.equal(readonly.appearance.editing.value, false)
  assert.equal(await readonly.appearance.save(), false)
  assert.equal(readonly.writes.length, 0)
  const form = await mountSections(t, 'form')
  assert.equal(form.appearance.disabled.value, false)
  form.appearance.change({ title: 'Initial', logo: '/initial.png' })
  form.map.change({ apiKey: 'initial-key', secretKey: 'initial-secret' })
  assert.equal(await form.appearance.save(), false)
  form.appearance.cancel()
  assert.equal(form.state.model.title, 'Initial')
  assert.equal(form.writes.length, 0)
  assert.equal(await form.state.submitAll(), true)
  assert.equal(form.writes.length, 1)
  assert.equal(form.current().front.logo, '/initial.png')
  assert.equal(form.current().amap.apiKey, 'initial-key')
})

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

for (const mode of ['detail', 'form']) {
  test(`SaaS platform admin can save background and record settings in ${mode} mode`, async t => {
    const v = await mount(t, mode, { saas: true, user: { username: 'admin' } })
    assert.deepEqual(v.state.hidden.value, ['base-path'])
    const patch = { background: '/uploaded-background.png', recordNumber: '粤ICP备12345678号', showRecordNumber: true }
    v.state.change(patch)
    assert.equal(v.state.assets.value.background, patch.background)
    assert.equal((await v.state.persist({ ...patch, 'base-path': 'invalid' })).ok, true)
    if (mode === 'form') {
      assert.equal(v.writes.length, 0)
      assert.equal(await v.state.submitAll(), true)
    }
    assert.equal(v.writes.length, 1)
    for (const [key, value] of Object.entries(patch)) {
      assert.equal(v.current().front[key], value)
      assert.equal(v.state.saved.value[key], value)
    }
    assert.deepEqual(v.current().front.extra, { flag: 1 })
    assert.equal(v.writes[0].some(item => item.scope === 'paths'), false)
  })
}

for (const identity of [
  { username: 'manager', type: { id: 'projectManager' } },
  { username: 'owner', type: { id: 'projectOwner' } },
  { username: 'operator' }, {},
]) {
  test(`SaaS ${identity.username || 'unloaded identity'} cannot edit background or record settings`, async t => {
    const front = { background: '/saved.png', recordNumber: 'saved record', showRecordNumber: true }
    const v = await mount(t, 'detail', { saas: true, user: identity, front })
    const forbidden = { background: '/forbidden.png', recordNumber: 'forbidden', showRecordNumber: false }
    v.state.change(forbidden)
    assert.equal(v.state.model.background, '')
    await v.state.persist(forbidden)
    assert.equal(v.writes.length, 0)
    await v.state.persist({ title: 'Allowed', ...forbidden })
    for (const [key, value] of Object.entries(front)) assert.equal(v.current().front[key], value)
  })
}

test('late admin identity reveals saved fields and revocation prevents both per-field and unified writes', async t => {
  const v = await mount(t, 'form', { saas: true, front: { background: '/saved.png', recordNumber: 'saved record', showRecordNumber: true } })
  const render = createFieldRenderer(actions)
  const fields = ['title', 'background', 'showRecordNumber']
  assert.deepEqual(render('appearance', fields), ['title'])
  v.state.change({ title: 'Unsaved title' })
  user.userInfo = { username: 'admin' }
  assert.deepEqual(v.state.hidden.value, ['base-path'])
  assert.deepEqual(render('appearance', fields), fields)
  assert.equal(v.state.model.background, '/saved.png')
  assert.equal(v.state.model.recordNumber, 'saved record')
  assert.equal(v.state.model.title, 'Unsaved title')
  v.state.change({ background: '/new.png', recordNumber: '' })
  assert.equal(await v.state.submitAll(), false)
  assert.equal(v.state.errors.value.recordNumber, 'PlatformSettings.recordRequired')
  user.userInfo = { username: 'owner', type: { id: 'projectOwner' } }
  assert.deepEqual(render('appearance', fields), ['title'])
  assert.equal(v.state.errors.value.recordNumber, undefined)
  assert.equal(await v.state.submitAll(), true)
  assert.equal(v.current().front.background, '/saved.png')
  assert.equal(v.current().front.recordNumber, 'saved record')
  assert.equal(v.current().front.title, 'Unsaved title')
  await v.state.persist({ background: '/forbidden.png' })
  assert.equal(v.writes.length, 1)
})

test('admin record validation, toggle, and failed background save retain the existing retry behavior', async t => {
  const v = await mount(t, 'detail', { saas: true, user: { username: 'admin' } })
  assert.equal((await v.state.persist({ showRecordNumber: true, recordNumber: '' })).ok, false)
  assert.equal(v.writes.length, 0)
  assert.equal((await v.state.persist({ recordNumber: 'record', showRecordNumber: true })).ok, true)
  assert.equal((await v.state.persist({ showRecordNumber: false })).ok, true)
  assert.equal(v.current().front.showRecordNumber, false)
  const save = v.source.save
  v.source.save = async () => ({ success: false })
  v.state.change({ background: '/uploaded.png' })
  assert.equal((await v.state.persist({ background: '/uploaded.png' })).ok, false)
  assert.equal(v.state.model.background, '/uploaded.png')
  assert.equal(v.state.saved.value.background, '')
  v.source.save = save
  assert.equal((await v.state.persist({ background: '/uploaded.png' })).ok, true)
  assert.equal(v.state.saved.value.background, '/uploaded.png')
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

function createFieldRenderer(actions) {
  const componentsRegistry = { getRegistry: () => actions }
  const merge = load('hooks/useRegistryComponentsMerge.ts', {
    '@jetlinks-web-core/utils/components-registry': { componentsRegistry },
    'vue-router': { useRoute: () => ({}) }, 'lodash-es': { cloneDeep: clone, isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  })
  const fields = load('components/PlatformSettings/PlatformSettingsFields.ts', {
    '../../utils/components-registry': { componentsRegistry }, '../../hooks/useRegistryComponentsMerge': merge, './fieldRegistry': registry,
  }).default
  return (group, keys) => fields.setup({ group }, { slots: { default: () => keys.map(key => vue.h('div', { key })) }, attrs: {} })().map(node => node.key)
}

test('field extensions stay with their owning card and unanchored extensions render exactly once', () => {
  const render = createFieldRenderer([
    { code: 'extra-title', target: 'title', mode: 'after', component: { render: () => null } },
    { code: 'extra-map', target: 'webKey', mode: 'replace', component: { render: () => null } },
    { code: 'append', mode: 'append', component: { render: () => null } },
    { code: 'hidden', target: 'ico', mode: 'hide' },
  ])
  assert.deepEqual(render('appearance', ['title', 'ico']), ['title', 'extra-title:title'])
  assert.deepEqual(render('map', ['apiKey', 'webKey']), ['apiKey', 'extra-map:webKey'])
  assert.deepEqual(render('address', ['base-path']), ['base-path', 'append:append'])
})


test('platform appearance preserves language order, stages drafts, cancels, and clears to defaults', async t => {
  const v = await mountSections(t, 'detail', {
    systemBinding: true, user: { username: 'admin' }, front: { languages: ['ja', 'en'] },
  })
  assert.equal(v.state.hidden.value.includes('languages'), false)
  assert.deepEqual(v.state.saved.value.languages, ['ja', 'en'])

  v.appearance.start()
  v.appearance.change({ languages: ['en', 'ja'] })
  assert.deepEqual(v.state.model.languages, ['en', 'ja'])
  assert.deepEqual(v.current().front.languages, ['ja', 'en'])
  assert.deepEqual(v.writes, [])
  v.appearance.cancel()
  assert.deepEqual(v.state.model.languages, ['ja', 'en'])

  v.appearance.start()
  v.appearance.change({ languages: ['ja', 'en'] })
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.writes, [])

  v.appearance.start()
  v.appearance.change({ languages: ['en', 'ja'] })
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.writes[0][0].properties.languages, ['en', 'ja'])
  assert.equal(v.current().front.title, 'Saved')
  assert.equal(v.current().front.ico, '/original.ico')
  assert.deepEqual(v.current().front.extra, { flag: 1 })

  v.appearance.start()
  v.appearance.change({ languages: [] })
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.writes[1][0].properties.languages, [])
  assert.deepEqual(v.state.saved.value.languages, [])
})

test('language draft survives saving a different section and untouched invalid config is preserved', async t => {
  const saved = ['ja', 'unknown', 'en', 'ja']
  const v = await mountSections(t, 'detail', { systemBinding: true, user: { username: 'admin' }, front: { languages: saved } })
  assert.deepEqual(v.state.saved.value.languages, ['ja', 'en'])
  v.appearance.start()
  v.appearance.change({ title: 'Updated' })
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.writes[0][0].properties.languages, saved)

  v.appearance.start()
  v.appearance.change({ languages: ['en'] })
  v.map.start()
  v.map.change({ webKey: 'changed' })
  assert.equal(await v.map.save(), true)
  assert.deepEqual(v.state.model.languages, ['en'])
  assert.deepEqual(v.writes[1].map(entry => entry.scope), ['amap'])
  assert.deepEqual(v.current().front.languages, saved)
})

test('platform initialization only writes languages when an actual selection was made', async t => {
  const v = await mountSections(t, 'form', { systemBinding: true, user: { username: 'admin' } })
  assert.equal(v.state.hidden.value.includes('languages'), false)
  assert.deepEqual(v.state.model.languages, [])
  v.appearance.change({ title: 'Initialize' })
  assert.equal(await v.state.submit(), true)
  assert.equal(Object.hasOwn(v.writes[0][0].properties, 'languages'), false)
  v.appearance.change({ languages: ['ja', 'en'] })
  assert.equal(v.writes.length, 1)
  assert.equal(await v.state.submit(), true)
  assert.deepEqual(v.writes[1][0].properties.languages, ['ja', 'en'])
})

test('admin can configure languages in project deployment in both page modes', async t => {
  for (const mode of ['detail', 'form']) {
    const v = await mountSections(t, mode, {
      systemBinding: true, user: { username: 'admin' }, platformContext: false, front: { languages: ['zh'] },
    })
    assert.equal(v.state.hidden.value.includes('languages'), false)
    assert.deepEqual(v.state.model.languages, ['zh'])
    if (mode === 'detail') v.appearance.start()
    v.appearance.change({ languages: ['ja', 'en'] })
    assert.equal(await (mode === 'detail' ? v.appearance.save() : v.state.submit()), true)
    assert.deepEqual(v.current().front.languages, ['ja', 'en'])
  }
})

for (const [identity, userInfo] of [
  ['project manager', { username: 'manager', type: { id: 'projectManager' } }],
  ['project owner', { username: 'owner', type: { id: 'projectOwner' } }],
  ['project member', { username: 'member' }],
]) {
  test(`${identity} cannot submit platform languages in detail or initialization mode`, async t => {
    for (const mode of ['detail', 'form']) {
      const v = await mountSections(t, mode, { systemBinding: true, user: userInfo, platformContext: false, front: { languages: ['ja', 'en'] } })
      assert.ok(v.state.hidden.value.includes('languages'))
      v.state.change({ title: 'Allowed field', languages: ['zh'] })
      assert.deepEqual(v.state.model.languages, [])
      if (mode === 'form') {
        assert.equal(await v.state.submit(), true)
      } else {
        assert.equal((await v.state.persist({ title: 'Allowed field', languages: ['zh'] })).ok, true)
      }
      assert.deepEqual(v.current().front.languages, ['ja', 'en'])
      assert.equal(v.current().front.title, 'Allowed field')
    }
  })
}

test('platform admin still needs the existing Basis update permission in detail mode', async t => {
  const v = await mountSections(t, 'detail', { systemBinding: true, user: { username: 'admin' }, editable: false })
  assert.equal(v.state.disabled.value, true)
  assert.equal((await v.state.persist({ languages: ['ja', 'en'] })).ok, false)
  assert.deepEqual(v.writes, [])
})


test('only successful language writes notify the active store, even when the config readback fails', async t => {
  const v = await mountSections(t, 'detail', { systemBinding: true, user: { username: 'admin' }, front: { languages: ['zh'] } })
  const save = v.source.save

  v.appearance.start()
  v.appearance.change({ title: 'Branding only' })
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.appliedLanguages, [])

  v.appearance.start()
  v.appearance.change({ languages: ['en', 'ja'] })
  assert.deepEqual(v.appliedLanguages, [])
  v.source.save = async () => ({ success: false })
  assert.equal(await v.appearance.save(), false)
  assert.deepEqual(v.appliedLanguages, [])

  v.source.save = save
  v.source.load = async () => { throw new Error('readback unavailable') }
  assert.equal(await v.appearance.save(), true)
  assert.deepEqual(v.appliedLanguages, [['en', 'ja']])
  assert.equal(v.state.warning.value, 'PlatformSettings.refreshFailed')
})
