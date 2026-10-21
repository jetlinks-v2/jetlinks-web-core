import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import axios from 'axios'
import { isFunction, isObject } from 'lodash-es'
import { createRenderer, defineComponent, h, onUnmounted } from 'vue'
import { createPinia, defineStore } from 'pinia'
import { createI18n, useI18n } from 'vue-i18n'

const require = createRequire(import.meta.url)
const tokenKey = 'X-Access-Token'
const sources = {
  relogin: readFileSync(new URL('../src/views/relogin/index.ts', import.meta.url), 'utf8'),
  package: readFileSync(new URL('../src/package.ts', import.meta.url), 'utf8'),
  // Use the installed request service itself, including its queue and error interceptors.
  axios: readFileSync(join(dirname(require.resolve('@jetlinks-web/core/package.json')), 'src/axios.ts'), 'utf8'),
}
const load = (source, dependencies) => {
  const { code } = transformSync(source, {
    loader: 'ts', format: 'cjs', define: { 'import.meta.env': '{"VITE_TOKEN_REFRESH":"true"}' },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  }, module, module.exports)
  return module.exports
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
const useSession = defineStore('relogin-test', { state: () => ({ username: 'test' }) })
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, patchProp() {}, insert() {}, remove() {},
  parentNode: () => null, nextSibling: () => null,
})

// Keep real Vue/plugin lifecycles, initAxios and AxiosService; isolate only UI and browser state.
const fixture = (t, { privateDeployment = true } = {}) => {
  const pinia = createPinia()
  const session = useSession(pinia)
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { title: 'Relogin' } } })
  let active, opened = deferred(), unmounts = 0, opens = 0, jumps = 0, clears = 0
  const containers = new Set()
  const storage = new Map([[tokenKey, 'expired-token']])
  const previous = Object.fromEntries(['window', 'document', 'localStorage'].map(key => [key, globalThis[key]]))
  globalThis.window = {}
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null }
  globalThis.document = {
    createElement: () => ({ remove() { containers.delete(this) } }),
    body: { appendChild: container => containers.add(container) },
  }
  t.after(() => {
    active?.resolve(true)
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  })
  const Dialog = defineComponent({
    setup(_props, { expose }) {
      assert.equal(containers.size, 1)
      assert.equal(useSession(), session)
      const { t } = useI18n()
      assert.equal(t('title'), 'Relogin')
      onUnmounted(() => { unmounts++ })
      expose({ open: () => {
        opens++
        active = deferred()
        opened.resolve()
        opened = deferred()
        return active.promise
      } })
      return () => h('div', t('title'))
    },
  })
  const utils = {
    getToken: () => storage.get(tokenKey),
    removeToken: () => storage.delete(tokenKey),
  }
  const constants = { TOKEN_KEY: tokenKey, BASE_API: '/api' }
  const { AxiosService } = load(sources.axios, {
    '@jetlinks-web/utils': utils, '@jetlinks-web/constants': constants,
    axios, 'lodash-es': { isFunction, isObject },
  })
  const service = new AxiosService()
  const router = { jumpLogin: () => { jumps++ } }
  const packageApi = load(sources.package, {
    vue: {}, axios, '@jetlinks-web/utils': utils, '@jetlinks-web/constants': constants,
    '@jetlinks-web/core': {
      crateAxios: settings => service.initialize(settings),
      getInstance: () => service.getInstance(), ndJson: { create() {} },
    },
    '@jetlinks-web-core/router': router, 'ant-design-vue': { notification: { error() {} } },
    '@jetlinks-web-core/utils/consts': { isSubApp: false },
    '@jetlinks-web-core/utils/deployment': { isPrivateDeployment: () => privateDeployment },
    '@jetlinks-web-core/views/verify/index.vue': {}, '@jetlinks-web-core/store/pinia': pinia,
    '@jetlinks-web-core/locales': i18n,
    '@jetlinks-web-core/utils/request-context': { getRequestTenantDomain: () => '', isFromCloud: () => false, stripEdgeRequestHeaders() {} },
    '@jetlinks-web-core/utils/navigation': {}, '@jetlinks-web-core/utils/project-path': {},
    '@jetlinks-web-core/utils/project-storage': { isProjectStorageEnabled: () => false },
    '@jetlinks-web-core/utils/ai-client-tool-request': { isAiClientToolSilentRequest: () => false },
    '@jetlinks-web-core/utils/application-scope': { applyApplicationScopeHeaders() {} },
    '@jetlinks-web-core/utils/project-runtime': { getApplicationRuntimeEntry: () => ({}) },
    '@micro-zoe/micro-app': {}, '@jetlinks-web-core/utils/module-registry': {},
    '@jetlinks-web-core/store/verify': { useVerifyStore: () => ({ clearCache: () => { clears++ } }) },
  })
  const { openRelogin } = load(sources.relogin, {
    vue: { createApp: component => renderer.createApp(component) }, axios,
    '@jetlinks-web/utils': utils, '@jetlinks-web-core/router': router,
    '@jetlinks-web-core/package': packageApi, '@jetlinks-web-core/store/pinia': pinia,
    '@jetlinks-web-core/locales': i18n, './index.vue': Dialog,
  })
  packageApi.initAxios({}, { handleReconnect: openRelogin })
  return {
    open: openRelogin, settle: result => active.resolve(result), reject: error => active.reject(error),
    waitForOpen: () => opened.promise, containers, client: service.getInstance(),
    setToken: token => { if (token) storage.set(tokenKey, token); else storage.delete(tokenKey) },
    get token() { return storage.get(tokenKey) }, get jumps() { return jumps },
    get clears() { return clears }, get unmounts() { return unmounts }, get opens() { return opens },
  }
}

const unauthorized = config => new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
  status: 401, data: {}, headers: {}, config,
})
const success = config => ({ status: 200, data: { status: 200, result: config.url }, headers: {}, config })
const observe = promise => promise.then(value => ({ value }), error => ({ error }))

test('successful relogin preserves its result and releases the Vue app and container', async t => {
  const f = fixture(t)
  const pending = f.open()
  assert.equal(f.opens, 1)
  assert.equal(f.containers.size, 1)
  assert.equal(f.unmounts, 0)
  f.settle(true)
  assert.equal(await pending, true)
  assert.equal(f.unmounts, 1)
  assert.equal(f.containers.size, 0)
  assert.equal(f.jumps, 0)
})

test('cancel clears credentials before navigation, rejects and releases resources', async t => {
  const f = fixture(t)
  const pending = f.open()
  f.settle(null)
  await assert.rejects(pending, axios.isCancel)
  assert.equal(f.token, undefined)
  assert.equal(f.jumps, 1)
  assert.equal(f.clears, 1)
  assert.equal(f.unmounts, 1)
  assert.equal(f.containers.size, 0)
  await assert.rejects(f.open(), axios.isCancel)
  assert.equal(f.opens, 1)
  assert.equal(f.jumps, 1)
})

test('relogin failure propagates the original error and releases resources', async t => {
  const f = fixture(t)
  const pending = f.open()
  const error = new Error('Login failed')
  f.reject(error)
  await assert.rejects(pending, reason => reason === error)
  assert.equal(f.unmounts, 1)
  assert.equal(f.containers.size, 0)
  assert.equal(f.token, 'expired-token')
})

test('a missing session never creates a relogin app', async t => {
  const f = fixture(t)
  f.setToken(null)
  await assert.rejects(f.open(), axios.isCancel)
  assert.equal(f.opens, 0)
  assert.equal(f.containers.size, 0)
})

test('cancel rejects the original request and every queued request without replay', { timeout: 2000 }, async t => {
  const f = fixture(t)
  const sent = []
  f.client.defaults.adapter = async config => { sent.push(config.url); throw unauthorized(config) }
  const opened = f.waitForOpen()
  const pending = ['/user/detail', '/identities', '/bindings'].map(url => observe(f.client.get(url)))
  await opened
  await setImmediate()
  f.settle(null)
  const results = await Promise.all(pending)
  assert.ok(results.every(result => axios.isCancel(result.error)))
  assert.equal(sent.length, 3)
  assert.equal(f.opens, 1)
  assert.equal(f.jumps, 1)
  assert.equal(f.containers.size, 0)
})

test('late 401s after logout and after a new login do not reopen relogin', { timeout: 2000 }, async t => {
  const f = fixture(t)
  const afterLogout = deferred(), afterLogin = deferred()
  f.client.defaults.adapter = async config => {
    if (config.url === '/late-logout') await afterLogout.promise
    if (config.url === '/late-login') await afterLogin.promise
    throw unauthorized(config)
  }
  const opened = f.waitForOpen()
  const pending = observe(f.client.get('/user/detail'))
  const lateLogout = observe(f.client.get('/late-logout'))
  const lateLogin = observe(f.client.get('/late-login', { headers: { 'x-access-token': 'expired-token' } }))
  await opened
  f.settle(null)
  assert.ok(axios.isCancel((await pending).error))
  afterLogout.resolve()
  assert.ok(axios.isCancel((await lateLogout).error))
  f.setToken('next-session-token')
  afterLogin.resolve()
  assert.ok(axios.isCancel((await lateLogin).error))
  assert.equal(f.opens, 1)
  assert.equal(f.jumps, 1)
  assert.equal(f.token, 'next-session-token')
  assert.equal(f.containers.size, 0)
})

test('successful relogin retries the original and queued requests with the new token', { timeout: 2000 }, async t => {
  const f = fixture(t)
  const sent = []
  f.client.defaults.adapter = async config => {
    const token = config.headers.get(tokenKey)
    sent.push({ url: config.url, token })
    if (token === 'expired-token') throw unauthorized(config)
    return success(config)
  }
  const opened = f.waitForOpen()
  const pending = ['/user/detail', '/identities', '/bindings'].map(url => f.client.get(url))
  await opened
  await setImmediate()
  f.setToken('refreshed-token')
  f.settle(true)
  assert.ok((await Promise.all(pending)).every(result => result.success))
  assert.equal(sent.length, 6)
  assert.equal(sent.filter(request => request.token === 'refreshed-token').length, 3)
  assert.equal(f.opens, 1)
  assert.equal(f.jumps, 0)
})

test('cancel does not prevent a later session from refreshing normally', { timeout: 2000 }, async t => {
  const f = fixture(t)
  f.client.defaults.adapter = async config => {
    if (config.headers.get(tokenKey) !== 'refreshed-token') throw unauthorized(config)
    return success(config)
  }
  let opened = f.waitForOpen()
  const first = observe(f.client.get('/first-session'))
  await opened
  f.settle(null)
  assert.ok(axios.isCancel((await first).error))
  f.setToken('next-session-token')
  opened = f.waitForOpen()
  const second = f.client.get('/next-session')
  await opened
  f.setToken('refreshed-token')
  f.settle(true)
  assert.equal((await second).success, true)
  assert.equal(f.opens, 2)
  assert.equal(f.unmounts, 2)
})

test('SaaS retains direct login navigation on 401', async t => {
  const f = fixture(t, { privateDeployment: false })
  f.client.defaults.adapter = async config => { throw unauthorized(config) }
  await assert.rejects(f.client.get('/user/detail'), error => error.response.status === 401)
  assert.equal(f.opens, 0)
  assert.equal(f.jumps, 1)
})
