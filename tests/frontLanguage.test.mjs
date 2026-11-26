import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import dayjs from 'dayjs'
import 'dayjs/locale/ja.js'
import 'dayjs/locale/zh-cn.js'
import { transformSync } from 'esbuild'
import { createPinia, defineStore } from 'pinia'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createI18n, useI18n } from 'vue-i18n'

const core = resolve(import.meta.dirname, '../src')
const saas = resolve(core, '../../modules/saas-manager-ui')
const langKey = 'Accept-Language'
const ruleEditorKey = 'editor-language'
const defaults = ['中文', 'English', '日本語']
const configured = { languages: ['ja', 'en'], title: 'Existing title', logo: '/existing.png' }
const compiled = new Map()

const element = (tag, text = '') => ({ tag, text, children: [] })
const renderer = vue.createRenderer({
  createElement: tag => element(tag),
  createText: text => element('#text', text),
  createComment: () => element('#comment'),
  setText: (node, text) => { node.text = text },
  setElementText: (node, text) => { node.text = text; node.children = [] },
  patchProp() {},
  insert(node, parent, anchor) {
    const previous = node.parent?.children
    if (previous) previous.splice(previous.indexOf(node), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node)
    node.parent = parent
  },
  remove(node) { node.parent.children.splice(node.parent.children.indexOf(node), 1) },
  parentNode: node => node.parent,
  nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1],
})
const flatten = root => [root, ...root.children.flatMap(flatten)]
const text = root => [root.text, ...root.children.map(text)].join('')
const flush = async () => { await setImmediate(); await vue.nextTick() }

function fixture({ browser = 'zh-CN', cache = new Map(), project = false, application = false, micro = false, token = '' } = {}) {
  const storage = {
    getItem: key => cache.get(key) ?? null,
    setItem: (key, value) => cache.set(key, String(value)),
    removeItem: key => cache.delete(key),
  }
  let reloads = 0
  const window = { localStorage: storage, location: { reload: () => { reloads++ } } }
  const document = { querySelector: () => null }
  const i18n = createI18n({
    legacy: false,
    locale: storage.getItem(langKey) || browser.split('-')[0],
    fallbackLocale: browser.toLowerCase(),
    missingWarn: false, fallbackWarn: false,
    messages: { zh: { zhOnly: '仅中文', 'Login.languageZh': '中文', 'Login.languageEn': 'English' }, en: { enOnly: 'English fallback' }, ja: {} },
  })
  const requests = []
  let loadFront = async () => configured
  const request = {
    async get(path) {
      requests.push(path)
      return { success: true, result: await loadFront() }
    },
    async post(path, params) {
      requests.push([path, params])
      return { success: true, result: [{ scope: 'front', properties: await loadFront() }] }
    },
  }
  const pinia = createPinia()
  const pass = () => undefined
  const css = () => ({ style: 'light', color: '', token: {} })
  const themeCalls = { user: 0, applied: [], persisted: [] }
  const dependencies = {
    vue, 'vue-i18n': { useI18n }, pinia: { defineStore: (name, setup) => () => defineStore(name, setup)(pinia) },
    dayjs, '@jetlinks-web/core': { request }, '@jetlinks-web/utils': { getToken: () => token },
    '@jetlinks-web-core/locales': i18n,
    '@jetlinks-web-core/utils/consts': { langKey, ruleEditorKey, isSubApp: micro },
    '@jetlinks-web-core/api/system/calendar': {}, '@jetlinks-web-core/api/account/theme': {
      getThemeStyle_api: async () => { themeCalls.user++; return { success: true, result: { content: 'dark' } } },
    },
    '@jetlinks-web-core/utils/theme-color': { applyThemeColor: pass, getInitialThemeColor: pass, persistThemeColor: pass },
    '@jetlinks-web-core/utils/theme-style': {
      applyThemeStyle: style => { themeCalls.applied.push(style); return { ...css(), style } },
      getInitialThemeStyleConfig: css, getThemeStyleInitialColor: pass,
      getThemeStylePrimaryColor: pass, normalizeThemeStyle: style => style || 'light',
      persistThemeStyle: style => { themeCalls.persisted.push(style); return { ...css(), style } },
    },
    '@jetlinks-web-core/utils/public-asset': { resolvePublicAssetUrl: value => value },
    '@jetlinks-web-core/utils/login-background': { resolveLoginBackground: () => ({}) },
    '@jetlinks-web-core/utils/project-runtime': { isProjectRuntime: () => project, isApplicationRuntime: () => application, getProjectCodeFromLocation: pass, getProjectCodeFromPathname: pass },
    '@jetlinks-web-core/utils/project-storage': { getProjectStorage: pass },
    './businessApplicationContext': { useBusinessApplicationContext: () => ({}) },
    './module-override': { withModuleStoreOverride: store => store },
    './index': i18n,
    './local/provider': { createLocalTranslator: () => undefined },
    './components/Login.vue': { render: () => vue.h('login-form') },
    './components/LoginPageLayout.vue': { setup: (_, { slots }) => () => vue.h('login-shell', [slots.brand?.(), slots.actions?.(), slots.default?.()]) },
  }
  const modules = new Map()
  const load = file => {
    const filename = /\.(vue|ts)$/.test(file) ? file : `${file}.ts`
    if (modules.has(filename)) return modules.get(filename)
    if (!compiled.has(filename)) {
      let source = readFileSync(filename, 'utf8')
      if (filename.endsWith('.vue')) {
        const { descriptor, errors } = parse(source, { filename })
        assert.deepEqual(errors, [])
        source = compileScript(descriptor, { id: filename, inlineTemplate: true }).content
      }
      compiled.set(filename, transformSync(source, { loader: 'ts', format: 'cjs' }).code)
    }
    const module = { exports: {} }
    new Function('require', 'window', 'navigator', 'document', 'module', 'exports', compiled.get(filename))(name => {
      if (name in dependencies) return dependencies[name]
      if (name.startsWith('@jetlinks-web-core/')) return load(resolve(core, name.slice('@jetlinks-web-core/'.length)))
      return load(resolve(dirname(filename), name))
    }, window, { language: browser }, document, module, module.exports)
    modules.set(filename, module.exports)
    return module.exports
  }
  const store = load(resolve(core, 'store/system')).useSystemStore()
  const mount = (t, filename) => {
    const root = element('root')
    const Component = load(filename).default
    const app = renderer.createApp(Component)
    for (const name of ['a-popover', 'a-tooltip', 'AIcon', 'a-menu-item', 'a-menu', 'a-dropdown']) {
      app.component(name, { setup: (_, { slots }) => () => vue.h(name, [slots.default?.(), slots.content?.(), slots.overlay?.()]) })
    }
    app.component('a-button', {
      setup: (_, { attrs, slots }) => () => vue.h(attrs.class === 'language-switch__option' ? 'button' : 'a-button', slots.default?.()),
    })
    app.use(i18n)
    app.mount(root)
    t.after(() => app.unmount())
    return {
      hasForm: () => flatten(root).some(node => node.tag === 'login-form'),
      options: () => flatten(root).filter(node => node.tag === 'button' || node.tag === 'a-menu-item').map(text),
    }
  }
  return { store, storage, i18n, requests, mount, themeCalls, reloads: () => reloads, respond: handler => { loadFront = handler }, load }
}

test('shared configuration preserves account preferences while account mode still loads them', async () => {
  const cache = new Map([[langKey, 'zh']])
  const f = fixture({ cache, token: 'account-fixture' })
  await f.store.queryInfo(async () => ({ success: true, result: [
    { scope: 'front', properties: { title: 'Share', headerTheme: 'dark', languages: ['ja'] } },
    { scope: 'amap', properties: { apiKey: 'share-map' } },
  ] }))
  assert.equal(f.store.systemInfo.amap.apiKey, 'share-map')
  assert.equal(f.themeCalls.user, 0)
  assert.deepEqual(f.themeCalls.persisted, [])
  assert.equal(f.themeCalls.applied.at(-1), 'dark')
  assert.equal(cache.get(langKey), 'zh')
  assert.equal(f.i18n.global.locale.value, 'zh')

  await f.store.queryInfo()
  assert.equal(f.themeCalls.user, 1)
  assert.equal(f.themeCalls.persisted.length, 1)
  assert.equal(f.store.systemInfo.front.title, 'Existing title')
})

for (const [label, filename] of [
  ['core', resolve(core, 'views/login/index.vue')],
  ['SaaS', resolve(saas, 'views/login/index.vue')],
]) {
  test(`${label} login applies the public front config before displaying language options`, async t => {
    const f = fixture()
    let complete
    f.respond(() => new Promise(resolve => { complete = resolve }))
    const page = f.mount(t, filename)
    assert.deepEqual(page.options(), [])
    assert.equal(page.hasForm(), true)
    await flush()
    assert.deepEqual(f.requests, ['/system/config/front'])
    complete(configured)
    await flush()
    assert.deepEqual(page.options(), ['日本語', 'English'])
    assert.equal(f.store.languageLabel, '日本語')
  })

  test(`${label} login remains usable if the public front request rejects`, async t => {
    const f = fixture()
    f.respond(async () => { throw new Error('front unavailable') })
    const page = f.mount(t, filename)
    await flush()
    assert.equal(page.hasForm(), true)
    assert.deepEqual(page.options(), defaults)
    assert.equal(f.reloads(), 0)
  })
}

test('the authenticated batch updates the top menu and all effective locale consumers', async t => {
  const f = fixture({ cache: new Map([[langKey, 'zh']]) })
  const page = f.mount(t, resolve(core, 'layout/components/Language.vue'))
  f.respond(async () => ({ ...configured, languages: ['ja', 'unsupported', 'en', 'ja', 1] }))
  await f.store.queryInfo()
  await vue.nextTick()
  assert.deepEqual(f.requests, [['/system/config/scopes', ['front', 'amap', 'paths']]])
  assert.deepEqual(page.options(), ['日本語', 'English'])
  assert.equal(f.store.layout.title, configured.title)
  assert.equal(f.store.layout.logo, configured.logo)
  assert.equal(f.store.language, 'ja')
  assert.equal(f.i18n.global.locale.value, 'ja')
  assert.equal(f.i18n.global.t('enOnly'), 'English fallback')
  assert.equal(f.i18n.global.t('zhOnly'), 'zhOnly')
  assert.equal(dayjs.locale(), 'ja')
  assert.equal(f.storage.getItem(langKey), 'ja')
  assert.equal(f.storage.getItem(ruleEditorKey), 'ja')
  f.store.selectLanguage('zh')
  assert.equal(f.store.language, 'ja')
  assert.equal(f.reloads(), 0)
})

test('allowed browser language wins; an automatic fallback is recalculated across reloads', async () => {
  const cache = new Map()
  const english = fixture({ browser: 'en-US', cache })
  await english.store.queryInfo()
  assert.equal(english.store.language, 'en')
  assert.equal(dayjs.locale(), 'en')

  const japanese = fixture({ browser: 'zh-CN', cache })
  await japanese.store.queryInfo()
  assert.equal(japanese.store.language, 'ja')
  japanese.respond(async () => ({ languages: ['en', 'ja'] }))
  await japanese.store.queryInfo()
  assert.equal(japanese.store.language, 'en')
  assert.equal(japanese.reloads(), 0)
})

test('manual selection survives reloads and remains eligible when a language is re-enabled', async () => {
  const cache = new Map()
  const first = fixture({ cache })
  await first.store.queryInfo()
  first.store.selectLanguage('en')
  first.store.selectLanguage('en')
  assert.equal(first.reloads(), 1)
  const next = fixture({ cache })
  await next.store.queryInfo()
  assert.equal(next.store.language, 'en')
  next.respond(async () => ({ languages: ['ja'] }))
  await next.store.queryInfo()
  assert.equal(next.store.language, 'ja')
  next.respond(async () => configured)
  await next.store.queryInfo()
  assert.equal(next.store.language, 'en')
})

test('missing or invalid config restores defaults; legacy untouched cache is retained', async () => {
  const f = fixture({ cache: new Map([[langKey, 'zh']]) })
  for (const languages of [undefined, 'ja,en', ['invalid']]) {
    f.respond(async () => ({ languages }))
    await f.store.queryInfo()
    assert.deepEqual(f.store.languageOptions.map(option => option.label), defaults)
    assert.equal(f.storage.getItem(langKey), 'zh')
  }
  f.respond(async () => configured)
  await f.store.queryInfo()
  assert.equal(f.storage.getItem(langKey), 'ja')
  f.respond(async () => ({}))
  await f.store.queryInfo()
  assert.equal(f.storage.getItem(langKey), 'zh')
  assert.equal(f.i18n.global.fallbackLocale.value, 'zh-cn')
  assert.deepEqual(f.store.languageOptions.map(option => option.label), defaults)
})

test('project runtime reads the saved language list before showing the language menu', async t => {
  const f = fixture({ project: true, cache: new Map([[langKey, 'zh']]) })
  const page = f.mount(t, resolve(core, 'layout/components/Language.vue'))
  f.respond(async () => ({ languages: ['en', 'ja'] }))
  await f.store.queryInfo()
  await vue.nextTick()
  assert.deepEqual(page.options(), ['English', '日本語'])
  assert.equal(f.store.languageLabel, 'English')
  assert.equal(f.i18n.global.locale.value, 'en')
})

test('a successful project language save chooses the first allowed language and survives readback', async t => {
  const f = fixture({ project: true, browser: 'ja-JP', cache: new Map([[langKey, 'zh']]) })
  const page = f.mount(t, resolve(core, 'layout/components/Language.vue'))
  f.respond(async () => ({}))
  await f.store.queryInfo()
  assert.equal(f.store.language, 'zh')

  const languages = ['en', 'ja']
  f.store.applySavedFrontLanguages(languages)
  await vue.nextTick()
  assert.deepEqual(page.options(), ['English', '日本語'])
  assert.equal(f.store.languageLabel, 'English')
  assert.equal(f.i18n.global.locale.value, 'en')
  assert.equal(dayjs.locale(), 'en')
  assert.equal(f.storage.getItem(langKey), 'en')
  assert.equal(f.storage.getItem(ruleEditorKey), 'en')
  assert.equal(f.reloads(), 0)

  f.respond(async () => ({ languages }))
  await f.store.queryInfo()
  assert.equal(f.store.language, 'en')

  // Keeping English enabled preserves it even when Japanese becomes the first option.
  f.store.applySavedFrontLanguages(['ja', 'en'])
  await vue.nextTick()
  assert.deepEqual(page.options(), ['日本語', 'English'])
  assert.equal(f.store.language, 'en')
})

test('the authenticated application menu follows project languages and remembers an allowed switch', async t => {
  const cache = new Map([[langKey, 'zh']])
  const context = { application: true, cache, token: 'application-session' }
  const f = fixture(context)
  const page = f.mount(t, resolve(core, 'layout/components/Language.vue'))
  await f.store.queryInfo()
  await vue.nextTick()
  assert.deepEqual(page.options(), ['日本語', 'English'])
  assert.equal(f.store.languageLabel, '日本語')
  assert.equal(f.i18n.global.locale.value, 'ja')
  assert.equal(cache.get(langKey), 'ja')
  f.store.selectLanguage('zh')
  assert.equal(f.reloads(), 0)
  f.store.selectLanguage('en')
  assert.equal(f.reloads(), 1)

  const reopened = fixture(context)
  await reopened.store.queryInfo()
  assert.equal(reopened.store.language, 'en')
  reopened.respond(async () => ({ languages: [] }))
  await reopened.store.queryInfo()
  assert.deepEqual(reopened.store.languageOptions.map(option => option.label), defaults)
})

test('application public and shared config reads do not apply or replace account languages', async () => {
  const f = fixture({ application: true, token: 'application-session' })
  await f.store.querySingleInfo('front')
  assert.deepEqual(f.store.languageOptions.map(option => option.label), defaults)
  assert.equal(f.storage.getItem(langKey), null)

  await f.store.queryInfo()
  const shared = async () => ({ success: true, result: [{ scope: 'front', properties: { languages: ['zh'] } }] })
  await f.store.queryInfo(shared)
  f.respond(async () => ({ languages: ['zh'] }))
  await f.store.querySingleInfo('front')
  assert.deepEqual(f.store.languageOptions.map(option => option.label), ['日本語', 'English'])
  assert.equal(f.storage.getItem(langKey), 'ja')
})

test('unauthenticated applications and embedded micro-apps keep their existing language options', async () => {
  for (const context of [{ application: true }, { micro: true, token: 'host-session' }, { application: true, micro: true, token: 'host-session' }]) {
    const f = fixture(context)
    await f.store.queryInfo()
    assert.deepEqual(f.store.languageOptions.map(option => option.label), defaults)
    assert.equal(f.storage.getItem(langKey), null)
    assert.equal(f.i18n.global.locale.value, 'zh')
  }
})

test('platform settings save keeps languages alongside the changed title and unchanged branding', () => {
  const { mergeSettingsPatch } = fixture().load(resolve(core, 'components/PlatformSettings/model'))
  const { payload } = mergeSettingsPatch({ front: configured, amap: {}, paths: {} }, { title: 'New title' })
  assert.deepEqual(payload, [{ scope: 'front', properties: {
    languages: ['ja', 'en'], title: 'New title', logo: '/existing.png',
  } }])
})

test('SaaS project login keeps its earlier two-language selector outside the policy', async t => {
  const f = fixture({ project: true })
  const page = f.mount(t, resolve(saas, 'views/login/index.vue'))
  await flush()
  assert.deepEqual(page.options(), ['中文', 'English'])
  assert.equal(f.storage.getItem(langKey), null)
})
