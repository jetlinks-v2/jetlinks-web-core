import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import axios from 'axios'
import { transformSync } from 'esbuild'
import * as Pinia from 'pinia'
import * as Vue from 'vue'

const require = createRequire(import.meta.url)

test('share config, captcha and token exchange preserve gateway routing without the signed-in identity', async () => {
  const calls = []
  let nextResponseData = { status: 200, result: 'fixture' }
  const storage = new Map([
    ['Accept-Language', 'zh'],
    ['X-Access-Token', 'test-account'],
    ['X-Personal-Token', 'test-other-share'],
  ])
  const dependencies = {
    axios: {
      create: options => axios.create({
        ...options,
        adapter: async config => {
          calls.push(config)
          return { config, headers: {}, status: 200, data: nextResponseData }
        },
      }),
    },
    '@jetlinks-web-core/utils/consts': { langKey: 'Accept-Language' },
    '@jetlinks-web-core/utils/request-context': {
      getBaseApi: () => '/test-gateway',
      getRequestTenantDomain: () => 'test-project',
      stripEdgeRequestHeaders() {},
    },
  }
  const file = new URL('../src/api/share-authorization.ts', import.meta.url)
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'localStorage', code)(
    name => dependencies[name], module, module.exports, { getItem: key => storage.get(key) },
  )
  const { getTokenConfig, getTokenRedirect, getShareCaptcha } = module.exports
  await getTokenConfig('link')
  assert.equal((await getShareCaptcha()).success, true)
  await getTokenRedirect('link', { authParameters: { password: 'fixture' } })
  assert.deepEqual(calls.map(({ method, url }) => [method, url.split('?')[0]]), [
    ['get', '/personal/token/link/_config'],
    ['get', '/authorize/captcha/image'],
    ['post', '/personal/token/link/_redirect'],
  ])
  assert.deepEqual(JSON.parse(calls[2].data), { authParameters: { password: 'fixture' } })
  for (const config of calls) {
    assert.equal(config.baseURL, '/test-gateway')
    assert.equal(config.headers.get('X-Tenant-Domain'), 'test-project')
    assert.equal(config.headers.get('Accept-Language'), 'zh')
    assert.equal(config.headers.has('X-Access-Token'), false)
    assert.equal(config.headers.has('X-Personal-Token'), false)
  }

  for (const nonObject of [null, '']) {
    nextResponseData = nonObject
    assert.deepEqual(await getTokenConfig('link'), { success: false })
  }
})

test('shared system config query updates store without persisting browser account theme or language preferences', async t => {
  const prevWindow = globalThis.window
  const prevDocument = globalThis.document
  const prevPinia = Pinia.getActivePinia()
  t.after(() => {
    if (prevWindow === undefined) delete globalThis.window
    else globalThis.window = prevWindow
    if (prevDocument === undefined) delete globalThis.document
    else globalThis.document = prevDocument
    Pinia.setActivePinia(prevPinia)
  })

  globalThis.window = { location: { origin: 'https://runtime.example' } }
  globalThis.document = { title: '', querySelector: () => null }
  const pinia = Pinia.createPinia()
  Pinia.setActivePinia(pinia)

  const appliedLanguages = []
  const persistedThemes = []
  const appliedThemes = []
  let userThemeCalls = 0
  const deps = {
    pinia: Pinia,
    vue: Vue,
    '@jetlinks-web-core/api/system/basis': {
      getDetails_api: async () => ({ success: true, result: [] }),
      preprocessorExists: async () => ({ success: true, result: false }),
      settingDetail: async () => ({ success: true, result: {} }),
      systemVersion: async () => ({ success: true, result: {} }),
    },
    '@jetlinks-web-core/api/system/calendar': { getTagsColor: async () => ({ success: true, result: {} }) },
    '@jetlinks-web/utils': { getToken: () => 'account-token', LocalStore: { set() {} } },
    '@jetlinks-web-core/utils/consts': { isSubApp: false },
    '@jetlinks-web-core/locales/frontLanguage': {
      createFrontLanguageState: () => ({
        language: Vue.ref('zh'),
        languageOptions: Vue.ref([]),
        languageLabel: Vue.ref('中文'),
        selectLanguage() {},
        applyFrontLanguages: value => appliedLanguages.push(value),
      }),
    },
    './module-override': { withModuleStoreOverride: store => store },
    '@jetlinks-web-core/api/account/theme': {
      getThemeStyle_api: async () => {
        userThemeCalls++
        return { success: true, result: { content: 'dark' } }
      },
    },
    '@jetlinks-web-core/utils/theme-color': {
      applyThemeColor: color => color || '#1677ff',
      getInitialThemeColor: () => '#1677ff',
      persistThemeColor: color => color,
    },
    '@jetlinks-web-core/utils/theme-style': {
      applyThemeStyle: (style, color) => {
        appliedThemes.push({ style, color })
        return { style, color: color || '#1677ff', token: {} }
      },
      getInitialThemeStyleConfig: () => ({ style: 'light', token: {}, color: '#1677ff' }),
      getThemeStyleInitialColor: (_s, c) => c || '#1677ff',
      getThemeStylePrimaryColor: () => '#1677ff',
      normalizeThemeStyle: style => style || 'light',
      persistThemeStyle: (style, color) => {
        persistedThemes.push({ style, color })
        return { style, color: color || '#1677ff', token: {} }
      },
    },
    '@jetlinks-web-core/utils/public-asset': { resolvePublicAssetUrl: x => x },
    '@jetlinks-web-core/utils/project-runtime': {
      getProjectCodeFromLocation: () => '',
      getProjectCodeFromPathname: () => '',
      isApplicationRuntime: () => false,
      isProjectRuntime: () => false,
    },
    '@jetlinks-web-core/utils/project-storage': { getProjectStorage: () => undefined },
    './businessApplicationContext': { useBusinessApplicationContext: () => ({ currentApplication: undefined }) },
  }

  const file = new URL('../src/store/system.ts', import.meta.url)
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(
    name => deps[name] || require(name),
    module,
    module.exports,
  )

  const useSystem = module.exports.createSystemStore({
    queryScopes: async () => ({
      success: true,
      result: [
        { scope: 'front', properties: { title: 'Account Title', headerTheme: 'dark', languages: ['en'] } },
        { scope: 'amap', properties: { apiKey: 'account-map' } },
      ],
    }),
    queryScope: async () => ({ success: true, result: {} }),
  })
  const store = useSystem(pinia)
  const initialApplied = appliedThemes.length

  await store.queryInfo(async () => ({
    success: true,
    result: [
      { scope: 'front', properties: { title: 'Share Title', headerTheme: 'dark', languages: ['ja'] } },
      { scope: 'amap', properties: { apiKey: 'share-map' } },
      { scope: 'paths', properties: {} },
    ],
  }))
  assert.equal(store.systemInfo.amap.apiKey, 'share-map')
  assert.equal(userThemeCalls, 0)
  assert.deepEqual(appliedLanguages, [])
  assert.deepEqual(persistedThemes, [])
  assert.equal(appliedThemes.length, initialApplied + 1)
  assert.equal(appliedThemes.at(-1).style, 'dark')

  await store.queryInfo()
  assert.equal(store.systemInfo.amap.apiKey, 'account-map')
  assert.equal(userThemeCalls, 1)
  assert.deepEqual(appliedLanguages, [['en']])
  assert.equal(persistedThemes.length, 1)
})
