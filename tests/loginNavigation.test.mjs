import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import axios from 'axios'
import { isFunction, isObject } from 'lodash-es'
import * as Vue from 'vue'
import * as Pinia from 'pinia'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const tokenKey = 'X-Access-Token'
const projectCode = 'p_gav8lf'
const deferred = () => {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const memoryStorage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
}
const success = (config, result = {}) => ({
  config, status: 200, data: { status: 200, result }, headers: {},
})
const unauthorized = config => new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
  config, status: 401, data: {}, headers: {},
})

// 执行生产 router、退出 API、存储和 Axios 拦截器；仅隔离无关模块、浏览器与网络。
const fixture = (t, { environment = 'saas', scope = 'auto', base = '/', href = `http://localhost:9201/${projectCode}/#/overview` } = {}) => {
  let location = new URL(href)
  const navigations = []
  const storage = memoryStorage()
  const sessionStorage = memoryStorage()
  const window = {
    localStorage: storage, sessionStorage,
    get location() { return location },
    history: { state: { preserved: true }, replaceState(_state, _title, value) { location = new URL(value, location) } },
  }
  Object.defineProperty(location, 'href', {
    get: () => href,
    set: value => { navigations.push(value) },
    configurable: true,
  })
  const previous = Object.fromEntries(['window', 'localStorage', 'sessionStorage'].map(key => [key, globalThis[key]]))
  const activePinia = Pinia.getActivePinia()
  Object.assign(globalThis, { window, localStorage: storage, sessionStorage })
  Pinia.setActivePinia(undefined)
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
    Pinia.setActivePinia(activePinia)
  })
  const currentRoute = Vue.ref({ path: '/overview', fullPath: '/overview?view=all', matched: [], query: {} })
  const router = { currentRoute, beforeEach() {}, afterEach() {}, onError() {} }
  let resets = 0
  const environmentConfig = { VITE_APP_ENVIRONMENT: environment, VITE_APP_RUNTIME_SCOPE: scope, BASE_URL: base }
  const dependencies = {
    vue: Vue, pinia: Pinia, axios, 'lodash-es': { isFunction, isObject },
    'vue-router': { createRouter: () => router, createWebHashHistory() {} },
    '@jetlinks-web/constants': { TOKEN_KEY: tokenKey, BASE_API: '/api', TOKEN_KEY_URL: 'token' },
    '@jetlinks-web-core/locales': { global: { t: key => key } },
    '@micro-zoe/micro-app': { router: { setBaseAppRouter() {} } },
    'ant-design-vue': { notification: { error() {} } },
    '@jetlinks-web-core/views/verify/index.vue': {},
    '@jetlinks-web-core/utils/consts': { isSubApp: false, langKey: 'lang' },
    '@jetlinks-web-core/utils/request-context': {
      getRequestTenantDomain: flag => flag === false ? '' : projectCode,
      getBaseApi: () => '/api', isFromCloud: () => false, stripEdgeRequestHeaders() {},
    },
    '@jetlinks-web-core/utils/navigation': {},
    '@jetlinks-web-core/utils/ai-client-tool-request': { isAiClientToolSilentRequest: () => false },
    '@jetlinks-web-core/utils/module-registry': {},
    '@jetlinks-web-core/utils/json/collector': {},
    '@jetlinks-web-core/store/route-loading': {}, '@jetlinks-web-core/store/user': {},
  }
  const cache = new Map()
  const stubs = {
    [resolve(root, 'src/router/globModules.ts')]: { collectCoreRouteOverrides: () => [] },
    [resolve(root, 'src/router/coreRoutes.ts')]: {
      resolveCoreRoutes: () => ({
        routes: [{ name: 'Login', path: '/login' }], tokenFilterPaths: ['/login'], menuFilterPaths: [], registry: [],
      }),
    },
    [resolve(root, 'src/router/default-entry.ts')]: { DefaultApplicationEntryError: class extends Error {} },
    [resolve(root, 'src/router/startup.ts')]: { resetSessionStores: () => { resets++ } },
  }
  const evaluate = (filename, source = readFileSync(filename, 'utf8')) => {
    if (cache.has(filename)) return cache.get(filename)
    if (filename in stubs) return stubs[filename]
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs', define: { 'import.meta.env': JSON.stringify(environmentConfig) } })
    const module = { exports: {} }
    cache.set(filename, module.exports)
    new Function('require', 'module', 'exports', code)(name => {
      if (name in dependencies) return dependencies[name]
      if (name.startsWith('@jetlinks-web-core/')) return load(name.slice('@jetlinks-web-core/'.length))
      if (name.startsWith('.')) return evaluate(resolve(dirname(filename), `${name}.ts`))
      assert.fail(`Unisolated dependency: ${name}`)
    }, module, module.exports)
    cache.set(filename, module.exports)
    return module.exports
  }
  const load = name => evaluate(resolve(root, 'src', name.endsWith('.ts') ? name : `${name}.ts`))
  const utils = evaluate(join(dirname(require.resolve('@jetlinks-web/utils/package.json')), 'src/storage.ts'))
  dependencies['@jetlinks-web/utils'] = { ...utils, randomString: () => Math.random().toString(36), onlyMessage() {} }
  const core = evaluate(join(dirname(require.resolve('@jetlinks-web/core/package.json')), 'src/axios.ts'))
  dependencies['@jetlinks-web/core'] = { ...core, ndJson: { create() {} } }
  const navigation = load('router/index')
  dependencies['@jetlinks-web-core/router'] = navigation
  const packageApi = load('package')
  packageApi.initAxios()
  const api = load('api/login')
  const verify = load('api/verify')
  const pinia = load('store/pinia').default
  const client = core.getInstance()
  client.defaults.adapter = async config => success(config)
  return {
    load, storage, window, client, api, verify, packageApi, navigation, navigations, utils, pinia,
    get resets() { return resets },
    setLocation: value => { location = new URL(value) },
  }
}

for (const order of ['401-first', 'logout-first']) {
  test(`project logout keeps the cloud project login and wins ${order}`, async t => {
    const f = fixture(t)
    f.storage.setItem('pFrom', 'http://localhost:9100')
    f.utils.setToken('project-session')
    f.storage.setItem(tokenKey, 'root-session')
    const pendingReset = deferred()
    f.client.defaults.adapter = async config => {
      if (config.url === '/user-token/reset') { await pendingReset.promise; return success(config) }
      throw unauthorized(config)
    }
    const exiting = f.api.logout().then(response => {
      if (response.success) f.navigation.jumpLogin({ reason: 'logout' })
    })
    if (order === '401-first') {
      await assert.rejects(f.client.get('/user/detail'))
      await delay(5)
      assert.deepEqual(f.navigations, [], '401 must wait for the active logout request')
    }
    pendingReset.resolve()
    await exiting
    if (order === 'logout-first') await assert.rejects(f.client.get('/user/detail'))
    await delay(5)
    assert.deepEqual(f.navigations, [`http://localhost:9100/${projectCode}/#/login?reason=logout&clearToken=true`])
    f.navigation.jumpLogin()
    await delay(5)
    assert.equal(f.navigations.length, 1, 'late failures cannot overwrite the chosen navigation')
    assert.equal(f.resets, 1)
    assert.equal(f.storage.getItem(tokenKey), 'root-session', 'project logout must retain the independent platform session')
    assert.equal(f.utils.getProjectStorage(projectCode), undefined)
  })
}

for (const failure of ['network-error', 'unsuccessful-response']) {
  test(`logout ${failure} releases a waiting session-expired navigation`, async t => {
    const f = fixture(t)
    f.storage.setItem('pFrom', 'http://localhost:9100')
    f.utils.setToken('project-session')
    const pendingReset = deferred()
    f.client.defaults.adapter = async config => {
      if (config.url === '/user-token/reset') return pendingReset.promise
      throw unauthorized(config)
    }
    const exiting = f.api.logout().catch(error => error)
    await assert.rejects(f.client.get('/user/detail'))
    await delay(5)
    assert.equal(f.navigations.length, 0)
    if (failure === 'network-error') pendingReset.reject(new Error('offline'))
    else pendingReset.resolve({ config: {}, status: 200, data: { success: false }, headers: {} })
    await exiting
    await delay(5)
    assert.deepEqual(f.navigations, [`http://localhost:9100/${projectCode}/#/login?redirect=%2Foverview%3Fview%3Dall`])
  })
}

test('application logout returns to its stored project domain rather than its application ID', async t => {
  const f = fixture(t, { href: 'http://localhost:9201/2099407618896465920/#/overview' })
  f.storage.setItem('pFrom', 'http://localhost:9100')
  f.storage.setItem('project_2099407618896465920', JSON.stringify({ domain: projectCode, scope: '2099407618896465920', token: 'application-token' }))
  f.navigation.jumpLogin({ reason: 'logout' })
  await delay(5)
  assert.deepEqual(f.navigations, [`http://localhost:9100/${projectCode}/#/login?reason=logout&clearToken=true`])
})

test('ordinary, direct project, fixed private and expired-session entries retain their existing routing', t => {
  const f = fixture(t)
  const { createLoginNavigationHref } = f.load('router/login-navigation')
  const options = {
    currentPath: '/overview?tab=1', isProjectRuntime: false,
    location: new URL('http://localhost:9201/#/overview'), loginPath: '/login', reason: 'logout',
    runtimeConfig: { fixedProject: false, projectCode: '', basePath: '/' }, origin: null,
  }
  assert.equal(createLoginNavigationHref(options), 'http://localhost:9201/#/login?reason=logout')
  assert.equal(createLoginNavigationHref({ ...options, isProjectRuntime: true, runtimeConfig: { ...options.runtimeConfig, projectCode } }), 'http://localhost:9201/#/login?reason=logout')
  assert.equal(createLoginNavigationHref({ ...options, reason: 'session-expired' }), 'http://localhost:9201/#/login?redirect=%2Foverview%3Ftab%3D1')
})

test('a fixed private deployment retains its installation base path', t => {
  const f = fixture(t, { environment: '', scope: 'project', base: '/iot/' })
  const { createLoginNavigationHref } = f.load('router/login-navigation')
  assert.equal(createLoginNavigationHref({
    currentPath: '/overview', isProjectRuntime: true,
    location: new URL('http://localhost:9201/iot/#/overview'), loginPath: '/login', reason: 'logout',
    runtimeConfig: { fixedProject: true, basePath: '/iot/', projectCode }, origin: 'http://localhost:9100',
  }), 'http://localhost:9100/iot/#/login?reason=logout&clearToken=true')
})

test('project logout preserves the cloud session while login and every ALTCHA step exclude its credentials', async t => {
  const f = fixture(t, { href: `http://localhost:9100/${projectCode}/#/login?reason=logout&clearToken=true&token=old-url-token&from=old-entry&applicationAccess=old-bootstrap&redirect=%2Foverview&pCode=${projectCode}` })
  f.storage.setItem(tokenKey, 'old-root-token')
  f.utils.setToken('old-project-token')
  f.storage.setItem('project_unrelated', JSON.stringify({ token: 'other-project-token' }))
  f.storage.setItem('jetlinks_verify_cache', JSON.stringify({ key: 'old-verify-key', token: 'old-verify-token' }))
  const sent = []
  f.client.defaults.adapter = async config => { sent.push(config); return success(config) }
  await f.api.login({ username: 'operator', password: 'example' })
  assert.equal(sent[0].headers.get(tokenKey), undefined, 'project login must never inherit the cloud session')
  assert.equal(sent[0].headers.get('x-verify-key'), undefined)
  Pinia.setActivePinia(undefined)
  const { consumeLogoutLoginEntry } = f.load('router/login-session')
  assert.equal(consumeLogoutLoginEntry(f.packageApi.clearVerifyCache), true)
  assert.equal(f.storage.getItem(tokenKey), 'old-root-token')
  assert.equal(f.utils.getToken(), undefined)
  assert.equal(f.storage.getItem('jetlinks_verify_cache'), null)
  assert.equal(JSON.parse(f.storage.getItem('project_unrelated')).token, 'other-project-token')
  const url = new URL(f.window.location.href)
  assert.equal(url.hash, `#/login?reason=logout&redirect=%2Foverview&pCode=${projectCode}`)
  await f.api.login({ username: 'operator', password: 'example' })
  await f.verify.createAltchaCaptchaContext('/authorize/captcha/context', { operation: 'login' })
  await f.verify.getAltchaCaptchaChallenge('/authorize/captcha/altcha/challenge', { key: 'new-key' })
  await f.verify.prevalidateAltchaCaptcha('/authorize/captcha/altcha/prevalidate', { key: 'new-key', payload: 'solution' })
  await f.verify.confirmCaptcha({ key: 'new-key', provider: 'altcha', params: { proof: 'new-proof' } })
  await f.client.post('/authorize/login', {}, { projectContext: false, headers: { 'x-access-token': 'explicit-old-token', 'X-Verify-Key': 'explicit-old-key', 'X-Verify-Token': 'explicit-old-proof' } })
  for (const config of sent.slice(1)) {
    assert.equal(config.headers.get(tokenKey), undefined, config.url)
    assert.equal(config.headers.get('x-verify-key'), undefined, config.url)
    assert.equal(config.headers.get('x-verify-token'), undefined, config.url)
  }
  assert.ok(sent.slice(2, 6).every(config => config.withCredentials), 'ALTCHA still sends its server-bound cookie')
  f.utils.setToken('new-session-token')
  f.storage.setItem(tokenKey, 'new-root-token')
  assert.equal(consumeLogoutLoginEntry(f.packageApi.clearVerifyCache), false)
  assert.equal(f.utils.getToken(), 'new-session-token', 'a consumed reason must not erase a later session')
  await f.client.get('/user/detail')
  assert.equal(sent.at(-1).headers.get(tokenKey), 'new-session-token', 'session bootstrap after project login must use its new token')
  f.setLocation('http://localhost:9100/#/console/index')
  await f.client.get('/user/detail')
  assert.equal(sent.at(-1).headers.get(tokenKey), 'new-root-token', 'the existing cloud tab still has an authenticated session')
  assert.equal(sent.at(-1).headers.get('x-verify-key'), undefined)
})

test('legacy search parameters are consumed while normal login and authenticated verification retain credentials', async t => {
  const f = fixture(t, { href: `http://localhost:9100/${projectCode}/?clearToken=true&token=old&applicationAccess=old#/login?token=older&reason=logout` })
  const { consumeLogoutLoginEntry } = f.load('router/login-session')
  assert.equal(consumeLogoutLoginEntry(f.packageApi.clearVerifyCache), true)
  assert.equal(f.window.location.search, '')
  assert.equal(f.window.location.hash, '#/login?reason=logout')
  f.setLocation(`http://localhost:9100/${projectCode}/#/login?token=new-entry`)
  f.storage.setItem(tokenKey, 'authenticated-session')
  f.utils.setToken('project-session')
  const verifyStore = f.load('store/verify').useVerifyStore(f.pinia)
  verifyStore.setCache('valid-verify-key', 'valid-verify-token')
  assert.equal(consumeLogoutLoginEntry(f.packageApi.clearVerifyCache), false)
  f.setLocation(`http://localhost:9100/${projectCode}/#/overview`)
  const sent = []
  f.client.defaults.adapter = async config => { sent.push(config); return success(config) }
  await f.verify.getAltchaCaptchaChallenge('/authorize/captcha/altcha/challenge', { key: 'authenticated-key' })
  assert.equal(sent[0].headers.get(tokenKey), 'authenticated-session')
  assert.equal(sent[0].headers.get('x-verify-key'), 'valid-verify-key')
  assert.equal(sent[0].headers.get('x-verify-token'), 'valid-verify-token')
})

test('a platform logout still clears its own root token and persisted verification before Pinia installation', t => {
  const f = fixture(t, { href: 'http://localhost:9100/#/login?reason=logout&token=old-entry' })
  f.storage.setItem(tokenKey, 'platform-session')
  f.storage.setItem('jetlinks_verify_cache', JSON.stringify({ key: 'platform-key', token: 'platform-proof' }))
  const verifyStore = f.load('store/verify').useVerifyStore(f.pinia)
  assert.equal(verifyStore.getCache().key, 'platform-key')
  Pinia.setActivePinia(undefined)
  assert.equal(f.load('router/login-session').consumeLogoutLoginEntry(f.packageApi.clearVerifyCache), true)
  assert.equal(f.storage.getItem(tokenKey), null)
  assert.equal(f.storage.getItem('jetlinks_verify_cache'), null)
  assert.equal(verifyStore.getCache(), null)
})
