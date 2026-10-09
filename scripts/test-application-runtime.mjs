import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createPinia, setActivePinia } from 'pinia'
// Load memory routing before installing the location fixture, so Vue Router stays in SSR mode.
import 'vue-router'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const cacheRoot = path.join(root, 'node_modules', '.cache')
await mkdir(cacheRoot, { recursive: true })
const outputRoot = await mkdtemp(path.join(cacheRoot, 'application-runtime-'))
let bundleIndex = 0
const source = name => path.join(root, 'src', name).replaceAll('\\', '/')
const memoryStorage = () => {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  }
}

const applicationId = '2100158593397268480'
const applicationUrl = `http://localhost:9100/${applicationId}/#/overview?applicationScope=${applicationId}`
const apps = [
  { id: applicationId, name: '应用 A', projectId: 'project', templateId: 'template' },
  { id: 'application-b', name: '应用 B', projectId: 'project', templateId: 'template' },
]
const menu = { id: 'menu', code: 'overview', name: '概览', url: '/overview', owner: 'app' }
let scenarios = 0

// Keep production entry, store, router, menu generation and interceptors intact. Only HTTP,
// module discovery and UI integrations are fixtures; memory history avoids needing a DOM.
const fixtures = {
  '@jetlinks-web/core': `
    const state = () => globalThis.__applicationRuntimeTest
    const execute = async (method, url, data, config = {}) => {
      const request = { ...config, method, url, headers: { ...config.headers } }
      state().axios.requestOptions(request)
      state().requests.push({ ...request, headers: { ...request.headers }, data })
      if (url === '/business-application/me') {
        if (state().applicationError) throw state().applicationError
        return { success: true, result: state().applications }
      }
      if (url === '/menu/user-own/tree') return { success: true, result: state().menus }
      return { success: true, result: {} }
    }
    export const request = {
      get: (url, data, config) => execute('get', url, data, config),
      post: (url, data, config) => execute('post', url, data, config),
    }
    export const crateAxios = settings => { state().axios = settings }
    export const getInstance = () => ({ defaults: {} })
    export const ndJson = { create: settings => { state().ndjson = settings } }
    export const wsClient = { initWebSocket() {}, connect() {} }
  `,
  '@jetlinks-web/constants': `export const BASE_API = '/api'; export const TOKEN_KEY = 'X-Access-Token'; export const TOKEN_KEY_URL = 'token';`,
  '@jetlinks-web/utils': `
    export const getToken = () => localStorage.getItem('X-Access-Token')
    export const setToken = () => {}
    export const removeToken = () => {}
    export const onlyMessage = (...args) => globalThis.__applicationRuntimeTest.messages.push(args)
    export const LocalStore = { get: key => localStorage.getItem(key), set() {}, remove() {} }
  `,
  '@jetlinks-web/hooks': `export const setParamsValue = () => {};`,
  '@micro-zoe/micro-app': `export default { router: { setBaseAppRouter() {} }, setGlobalData() {} }`,
  'ant-design-vue': `export const notification = { error() {} }; export default {}`,
  '@jetlinks-web-core/locales': `export default { global: { t: key => key } }`,
  '@jetlinks-web-core/utils': `
    export * from '${source('utils/project-runtime.ts')}'
    export * from '${source('utils/request-context.ts')}'
    export * from '${source('utils/project-storage.ts')}'
    export * from '${source('utils/application-scope.ts')}'
    export * from '${source('utils/menu.ts')}'
    export const modules = () => ({})
    export const routerFallback = () => {}
    export const isAiClientToolSilentRequest = () => false
    export const getPackageConfig = () => ({})
  `,
  '@jetlinks-web-core/utils/modules': `export const modules = () => ({})`,
  '@jetlinks-web-core/utils/module-registry': `export const moduleRegistry = { getPackageConfig: () => ({}) }`,
  '@jetlinks-web-core/store/verify': `export const useVerifyStore = () => ({})`,
  '@jetlinks-web-core/store/application': `
    export const useApplication = () => globalThis.__applicationRuntimeTest.microApplication
  `,
  '@jetlinks-web-core/store/user': `export const useUserStore = () => globalThis.__applicationRuntimeTest.user`,
  '@jetlinks-web-core/store/system': `export const useSystemStore = () => globalThis.__applicationRuntimeTest.system`,
  '@jetlinks-web-core/store': `
    import { createPinia } from 'pinia'
    export default createPinia()
    export { useApplication } from '@jetlinks-web-core/store/application'
    export { useUserStore } from '@jetlinks-web-core/store/user'
    export { useSystemStore } from '@jetlinks-web-core/store/system'
    export { useAuthStore } from '${source('store/auth.ts')}'
    export { useBusinessApplicationStore } from '${source('store/businessApplication.ts')}'
    export { useMenuStore } from '${source('store/menu.ts')}'
  `,
  '@jetlinks-web-core/router/globModules': `export const collectCoreRouteOverrides = () => []; export const getGlobModules = () => ({ overview: async () => ({}) })`,
  '@jetlinks-web-core/router/extraMenu': `export const getExtraRouters = () => ({})`,
  'basic-routes': `
    export const Login = { path: '/login', name: 'Login', component: {} }
    export const Forbidden = { path: '/403', name: 'Forbidden', component: {}, meta: { skipMenuFetch: true } }
  `,
  'vue-router': `export * from 'vue-router-real'; import { createMemoryHistory } from 'vue-router-real'; export const createWebHashHistory = createMemoryHistory;`,
}

const createState = () => ({
  applications: apps,
  menus: [menu],
  requests: [],
  messages: [],
  user: { userInfo: { id: 'user' }, isAdmin: true, isSubAccount: false, init() {} },
  microApplication: { appList: ['loaded'], findAppById() {}, init() {} },
  system: {
    layout: { title: '项目' }, isSessionInitializedFor: () => true,
    changeTitle(title) { document.title = title }, resetSessionInitialization() {},
  },
})

const bundle = async (environment, runtimeScope = 'project', subApp = false) => {
  globalThis.localStorage = memoryStorage()
  localStorage.setItem('X-Access-Token', 'test-token')
  globalThis.window = {
    location: new URL(applicationUrl), sessionStorage: memoryStorage(),
    __MICRO_APP_ENVIRONMENT__: subApp,
    microApp: { getGlobalData: () => ({ api: {} }) },
  }
  globalThis.document = { title: '' }
  globalThis.__applicationRuntimeTest = createState()
  const built = await build({
    stdin: {
      contents: `
        export * as scope from '${source('utils/application-scope.ts')}'
        export * as runtime from '${source('utils/project-runtime.ts')}'
        export * as context from '${source('utils/request-context.ts')}'
        export * as startup from '${source('router/startup.ts')}'
        export { useBusinessApplicationStore } from '${source('store/businessApplication.ts')}'
        export { useMenuStore } from '${source('store/menu.ts')}'
        export { useBasicLayoutVariant } from '${source('layout/hooks/useBasicLayoutVariant.ts')}'
        export { initAxios } from '${source('package.ts')}'
        export { default as router } from '${source('router/index.ts')}'
      `,
      resolveDir: root,
    },
    bundle: true, write: false, platform: 'node', format: 'esm', packages: 'external',
    define: {
      ref: '__autoRef', computed: '__autoComputed', shallowRef: '__autoShallowRef',
      'import.meta.env': JSON.stringify({
        VITE_APP_ENVIRONMENT: environment, VITE_APP_RUNTIME_SCOPE: runtimeScope,
        VITE_APP_NAME: 'iot', VITE_TOKEN_KEY: 'X-Access-Token', BASE_URL: '/',
      }),
    },
    banner: { js: "import { ref as __autoRef, computed as __autoComputed, shallowRef as __autoShallowRef } from 'vue';" },
    plugins: [{
      name: 'external-boundaries',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, args => {
          const importer = args.importer.replaceAll('\\', '/')
          if (args.path === 'vue-router-real') return { path: 'vue-router', external: true }
          if (args.path.endsWith('.vue')) return { path: args.path, namespace: 'fixture' }
          let key = args.path
          if (key.startsWith('@/')) key = `@jetlinks-web-core/${key.slice(2)}`
          if (args.path === './application' && importer.includes('/store/')) key = '@jetlinks-web-core/store/application'
          if (args.path === './globModules' && importer.endsWith('/router/index.ts')) key = '@jetlinks-web-core/router/globModules'
          if (args.path === './basic' && importer.endsWith('/router/coreRoutes.ts')) key = 'basic-routes'
          if (fixtures[key]) return { path: key, namespace: 'fixture' }
          if (key === '@jetlinks-web-core/router') return { path: source('router/index.ts') }
          if (key.startsWith('@jetlinks-web-core/')) return { path: source(`${key.slice('@jetlinks-web-core/'.length)}.ts`) }
        })
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: fixtures[args.path] || 'export default {}', resolveDir: root }))
      },
    }],
  })
  const modulePath = path.join(outputRoot, `${bundleIndex++}.mjs`)
  await writeFile(modulePath, built.outputFiles[0].text)
  const exports = await import(pathToFileURL(modulePath).href)
  exports.initAxios()
  return exports
}

const reset = (api, url = applicationUrl) => {
  window.location = Object.assign(new URL(url), { assign: url => { globalThis.__applicationRuntimeTest.assignedUrl = url } })
  window.sessionStorage.clear()
  localStorage.clear()
  localStorage.setItem('X-Access-Token', 'test-token')
  globalThis.__applicationRuntimeTest = createState()
  api.initAxios()
  api.startup.resetRouteStartupState()
  setActivePinia(createPinia())
}

try {
  for (const environment of ['', 'saas']) {
    const api = await bundle(environment)
    const { scope, runtime, context, startup } = api
    reset(api)
    assert.equal(runtime.isApplicationRuntime(), true)
    assert.equal(api.useBasicLayoutVariant().value, 'application')
    await startup.bootstrapSession()
    assert.equal(api.useBusinessApplicationStore().currentApplication.id, applicationId)
    assert.equal(document.title, '应用 A')
    assert.equal(globalThis.__applicationRuntimeTest.requests[0].headers[scope.APPLICATION_SCOPE_HEADER], undefined)
    await startup.ensureMenuRoutes(api.router, false)
    const menuRequest = globalThis.__applicationRuntimeTest.requests.at(-1)
    assert.deepEqual(menuRequest.data.terms, [{ column: 'owner', value: 'app' }])
    assert.equal(menuRequest.headers[scope.APPLICATION_SCOPE_HEADER], `business_application:${applicationId}`)
    assert.equal(context.getRequestHeaders()[scope.APPLICATION_SCOPE_HEADER], `business_application:${applicationId}`)
    const axiosConfig = globalThis.__applicationRuntimeTest.axios.requestOptions({ url: '/device/_query' })
    const ndjsonConfig = globalThis.__applicationRuntimeTest.ndjson.handleRequest({ url: '/device/_query' })
    assert.equal(axiosConfig.headers[scope.APPLICATION_SCOPE_HEADER], `business_application:${applicationId}`)
    assert.deepEqual(ndjsonConfig.headers, axiosConfig.headers)
    assert.deepEqual(context.getUploadHeaders(), context.getRequestHeaders())
    assert.equal(context.getRequestHeaders({ applicationScope: false })[scope.APPLICATION_SCOPE_HEADER], undefined)
    assert.equal(globalThis.__applicationRuntimeTest.axios.requestOptions({ url: '/edge/device/_query' }).headers[scope.APPLICATION_SCOPE_HEADER], undefined)
    scenarios++

    const tabA = memoryStorage()
    const tabB = memoryStorage()
    scope.setApplicationScope(applicationId, tabA, new URL(applicationUrl))
    scope.setApplicationScope('application-b', tabB, new URL(applicationUrl))
    const withoutQuery = new URL(applicationUrl.split('?')[0])
    assert.equal(scope.resolveApplicationRuntimeEntry(true, undefined, false, withoutQuery, tabA).applicationId, applicationId)
    assert.equal(scope.resolveApplicationRuntimeEntry(true, undefined, false, withoutQuery, tabB).applicationId, 'application-b')
    const conflictingQuery = new URL(applicationUrl)
    conflictingQuery.search = '?applicationScope=legacy'
    assert.equal(scope.resolveApplicationRuntimeEntry(true, undefined, false, conflictingQuery, tabA).applicationId, applicationId)
    assert.equal(scope.resolveMenuApplicationScope('business_application:application-b'), 'application-b')
    scenarios++

    await api.useMenuStore().queryMenus('application-b')
    assert.equal(globalThis.__applicationRuntimeTest.requests.at(-1).headers[scope.APPLICATION_SCOPE_HEADER], 'business_application:application-b')
    await api.useMenuStore().queryMenus(scope.PROJECT_APPLICATION_SCOPE)
    const projectRequest = globalThis.__applicationRuntimeTest.requests.at(-1)
    assert.deepEqual(projectRequest.data.terms, [{ column: 'owner', value: 'iot' }])
    assert.equal(projectRequest.headers[scope.APPLICATION_SCOPE_HEADER], undefined)
    for (const config of [
      { applicationScope: false }, { projectContext: false },
      { applicationScope: scope.PROJECT_APPLICATION_SCOPE },
    ]) {
      const request = { url: '/device/_query', headers: { 'x-asset-scope': 'business_application:old' }, ...config }
      globalThis.__applicationRuntimeTest.axios.requestOptions(request)
      globalThis.__applicationRuntimeTest.axios.requestOptions(request)
      assert.equal(request.headers[scope.APPLICATION_SCOPE_HEADER], undefined)
      assert.equal(request.headers['x-asset-scope'], undefined)
    }
    const explicit = globalThis.__applicationRuntimeTest.axios.requestOptions({
      url: '/device/_query', headers: { 'x-asset-scope': 'business_application:business_application:application-b' },
    })
    assert.equal(explicit.headers[scope.APPLICATION_SCOPE_HEADER], 'business_application:application-b')
    scenarios++

    // Exercise the actual switcher and access utility, including SaaS parent-project restoration.
    reset(api)
    if (environment) {
      const storage = { token: 'saas-token', apiUrl: '/api', domain: 'project', name: '项目', id: 'project-id', scope: applicationId }
      localStorage.setItem(`project_${applicationId}`, JSON.stringify(storage))
      localStorage.setItem('project_project', JSON.stringify({ ...storage, scope: undefined }))
    }
    await startup.bootstrapSession()
    assert.equal(await api.useBusinessApplicationStore().switchApplication('application-b'), true)
    const target = new URL(globalThis.__applicationRuntimeTest.assignedUrl)
    assert.equal(target.pathname, '/application-b/')
    assert.equal(globalThis.__applicationRuntimeTest.requests.at(-1).headers[scope.APPLICATION_SCOPE_HEADER], 'business_application:application-b')
    window.location = Object.assign(target, { assign: url => { globalThis.__applicationRuntimeTest.assignedUrl = url } })
    setActivePinia(createPinia())
    startup.resetRouteStartupState()
    await startup.bootstrapSession()
    assert.equal(api.useBusinessApplicationStore().currentApplication.id, 'application-b')
    assert.equal(await api.useBusinessApplicationStore().switchApplication(scope.PROJECT_APPLICATION_SCOPE), true)
    const projectTarget = new URL(globalThis.__applicationRuntimeTest.assignedUrl, window.location.origin)
    assert.equal(projectTarget.pathname, environment ? '/project/' : '/')
    assert.equal(projectTarget.hash.includes('applicationScope'), false)
    window.location = projectTarget
    assert.equal(runtime.isApplicationRuntime(), false)
    assert.equal(context.getRequestHeaders()[scope.APPLICATION_SCOPE_HEADER], undefined)
    scenarios++

    // Cached entry A must not affect another pathname, a fresh tab, or explicit project intent.
    assert.equal(scope.resolveApplicationRuntimeEntry(true, undefined, false, new URL('http://localhost:9100/project/#/overview'), window.sessionStorage).type, 'project')
    assert.equal(scope.resolveApplicationRuntimeEntry(true, undefined, false, new URL(`http://localhost:9100/${applicationId}/#/overview`), memoryStorage()).type, 'project')
    for (const value of ['', scope.PROJECT_APPLICATION_SCOPE]) {
      window.location = new URL(`${applicationUrl.split('?')[0]}?applicationScope=${value}`)
      assert.equal(runtime.isApplicationRuntime(), false)
      assert.equal(context.getRequestHeaders()[scope.APPLICATION_SCOPE_HEADER], undefined)
    }
    scenarios++

    reset(api, 'http://localhost:9100/project/#/overview')
    await startup.bootstrapSession()
    assert.equal(api.useBusinessApplicationStore().currentApplication.runtimeType, 'project')
    await api.useMenuStore().queryMenus()
    assert.equal(globalThis.__applicationRuntimeTest.requests.at(-1).headers[scope.APPLICATION_SCOPE_HEADER], undefined)
    assert.equal(api.useBasicLayoutVariant().value, 'project')
    scenarios++

    for (const failure of ['missing', 'empty-menu', 'endpoint-missing', 'network']) {
      reset(api)
      const state = globalThis.__applicationRuntimeTest
      if (failure === 'missing') state.applications = []
      if (failure === 'empty-menu') state.menus = []
      if (failure === 'endpoint-missing') state.applicationError = { status: 404 }
      if (failure === 'network') state.applicationError = new Error('network unavailable')
      if (failure === 'empty-menu') {
        await startup.bootstrapSession()
        await assert.rejects(startup.ensureMenuRoutes(api.router, false), scope.ApplicationEntryUnavailableError)
      } else {
        await assert.rejects(startup.bootstrapSession())
        await assert.rejects(startup.ensureMenuRoutes(api.router, false), scope.ApplicationEntryUnavailableError)
        assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree'), false)
      }
      scenarios++
    }

    reset(api, 'http://localhost:9100/project/#/overview')
    globalThis.__applicationRuntimeTest.applicationError = { status: 404 }
    await startup.bootstrapSession()
    assert.equal(api.useBusinessApplicationStore().scopeSupported, false)
    await startup.ensureMenuRoutes(api.router, false)
    assert.equal(globalThis.__applicationRuntimeTest.requests.at(-1).headers[scope.APPLICATION_SCOPE_HEADER], undefined)
    scenarios++

    reset(api)
    await api.router.push(`/overview?applicationScope=${applicationId}`)
    await api.router.push('/overview?filter=online')
    assert.equal(api.router.currentRoute.value.query.applicationScope, applicationId)
    assert.equal(api.router.currentRoute.value.query.filter, 'online')
    window.location = new URL(`http://localhost:9100/${applicationId}/#${api.router.currentRoute.value.fullPath}`)
    window.sessionStorage.clear()
    assert.equal(runtime.isApplicationRuntime(), true)
    scenarios++

    for (const failure of ['missing', 'empty-menu', 'network']) {
      reset(api)
      const state = globalThis.__applicationRuntimeTest
      if (failure === 'missing') state.applications = []
      if (failure === 'empty-menu') state.menus = []
      if (failure === 'network') state.applicationError = new Error('network unavailable')
      const errors = []
      const originalError = console.error
      try {
        console.error = (...args) => errors.push(args)
        await api.router.push(`/invalid?applicationScope=${applicationId}`)
      } finally {
        console.error = originalError
      }
      assert.equal(errors.length, 1)
      assert.ok(failure === 'network'
        ? errors[0][1] === state.applicationError
        : errors[0][1] instanceof scope.ApplicationEntryUnavailableError)
      assert.equal(api.router.currentRoute.value.path, '/403')
      assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree' && request.data.terms[0].value === 'iot'), false)
      if (failure === 'network') assert.equal(state.messages.at(-1)[0], 'components.BusinessApplicationSwitcher.loadFailed')
      scenarios++
    }

    if (environment) {
      reset(api, `http://localhost:9100/${applicationId}/#/overview`)
      localStorage.setItem(`project_${applicationId}`, JSON.stringify({ token: 'saas-token', scope: applicationId, domain: 'project' }))
      assert.equal(runtime.isApplicationRuntime(), true)
      assert.equal(context.getRequestHeaders()[scope.APPLICATION_SCOPE_HEADER], `business_application:${applicationId}`)
      window.location.hash = '#/overview?applicationScope='
      assert.equal(runtime.isApplicationRuntime(), false)
      setActivePinia(createPinia())
      startup.resetRouteStartupState()
      await api.router.push('/overview?applicationScope=')
      await api.router.push('/overview?filter=online')
      assert.equal(api.router.currentRoute.value.query.applicationScope, '')
      window.location.hash = `#${api.router.currentRoute.value.fullPath}`
      assert.equal(runtime.isApplicationRuntime(), false)
      scenarios++
    }
  }

  for (const [runtimeScope, subApp] of [['tenant', false], ['project', true]]) {
    const api = await bundle('', runtimeScope, subApp)
    reset(api)
    assert.equal(api.runtime.isApplicationRuntime(), false)
    assert.equal(api.context.getRequestHeaders()[api.scope.APPLICATION_SCOPE_HEADER], undefined)
    await api.useMenuStore().queryMenus()
    assert.equal(globalThis.__applicationRuntimeTest.requests.at(-1).headers[api.scope.APPLICATION_SCOPE_HEADER], undefined)
    scenarios++
  }

  console.log(`application runtime: ${scenarios} production-chain scenarios passed`)
} finally {
  await rm(outputRoot, { recursive: true, force: true })
}
