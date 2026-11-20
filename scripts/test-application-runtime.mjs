import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { AxiosHeaders } from 'axios'
import { createRenderer } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
// Load memory routing before installing the location fixture, so Vue Router stays in SSR mode.
import 'vue-router'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
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

// Browser Location accepts relative href assignments, unlike the native URL setter.
const browserLocation = url => new Proxy(Object.assign(new URL(url), {
  assign: value => { globalThis.__applicationRuntimeTest.assignedUrl = value },
}), {
  get: (target, key) => {
    const value = Reflect.get(target, key, target)
    return typeof value === 'function' ? value.bind(target) : value
  },
  set: (target, key, value) => Reflect.set(target, key, key === 'href' ? new URL(value, target).href : value, target),
})

const applicationId = '2108487683332870144'
const applicationUrl = `http://localhost:9100/${applicationId}/#/overview?applicationScope=${applicationId}`
const apps = [
  { id: applicationId, name: '应用 A', projectId: 'project', templateId: 'template' },
  { id: 'application-b', name: '应用 B', projectId: 'project', templateId: 'template' },
]
const menu = { id: 'menu', code: 'overview', name: '概览', url: '/overview', owner: 'app' }
const personalCenterMenu = {
  id: '19a1f2c763e1231f1e1', code: 'account-center', name: '个人中心',
  url: '/account/center', owner: 'iot', sortIndex: 9999, granted: true,
  options: { show: true }, buttons: [{ id: 'view', enabled: true, granted: true }],
}
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
      if (url === '/authorize/me') {
        if (state().authorizationError) throw state().authorizationError
        if (state().authorizationWait) await state().authorizationWait
        return state().authorizationResponse || { success: true, result: { dimensions: state().dimensions } }
      }
      if (url === '/user/detail' && state().identity) return { success: true, result: state().identity }
      if (url === '/user/settings/init' && state().initSettings) return { success: true, result: state().initSettings }
      if (url === '/authorize/login' && state().loginResponse) return state().loginResponse
      if (url === '/menu/user-own/tree') {
        if (state().menuError) throw state().menuError
        return state().menuResponse || { success: true, result: state().menus }
      }
      return { success: true, result: {} }
    }
    export const request = {
      get: (url, data, config) => execute('get', url, data, config),
      post: (url, data, config) => execute('post', url, data, config),
    }
    export class Request {}
    export const crateAxios = settings => { state().axios = settings }
    export const getInstance = () => ({ defaults: {} })
    export const ndJson = { create: settings => { state().ndjson = settings } }
    export const wsClient = { setOptions() {}, initWebSocket() {}, connect() {} }
  `,
  '@jetlinks-web/constants': `export const BASE_API = '/api'; export const TOKEN_KEY = 'X-Access-Token'; export const TOKEN_KEY_URL = 'token';`,
  '@jetlinks-web/utils': `
    export const getToken = () => localStorage.getItem('X-Access-Token')
    export const setToken = token => localStorage.setItem('X-Access-Token', token)
    export const removeToken = () => {}
    export const encrypt = value => value
    export const onlyMessage = (...args) => globalThis.__applicationRuntimeTest.messages.push(args)
    export const LocalStore = {
      get: key => localStorage.getItem(key),
      set: (key, value) => localStorage.setItem(key, value),
      remove: key => localStorage.removeItem(key),
    }
  `,
  '@jetlinks-web/hooks': `
    import { ref } from 'vue'
    export const setParamsValue = () => {}
    export const useRequest = (request, { onSuccess } = {}) => ({
      data: ref(), loading: ref(false),
      run: data => { globalThis.__applicationRuntimeTest.pendingRelogin = request(data).then(onSuccess) },
    })
  `,
  '@micro-zoe/micro-app': `export default { router: { setBaseAppRouter() {} }, setGlobalData() {} }`,
  'ant-design-vue': `export const notification = { error() {} }; export default {}`,
  '@jetlinks-web-core/locales': `export default { global: { t: key => key, locale: { value: 'zh' } } }`,
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
  '@jetlinks-web-core/views/account/center/data': `export const tabList = []`,
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
  '@jetlinks-web-core/router/globModules': `export const collectCoreRouteOverrides = () => []; export const getGlobModules = () => ({ overview: async () => ({}), ...globalThis.__applicationRuntimeTest.asyncRoutes })`,
  '@jetlinks-web-core/router/extraMenu': `export const getExtraRouters = () => ({})`,
  'basic-routes': `
    export { USER_CENTER_ROUTE, INIT_HOME } from '${source('router/basic.ts')}'
    export const Login = { path: '/login', name: 'Login', component: {} }
    export const Forbidden = { path: '/403', name: 'Forbidden', component: {}, meta: { skipMenuFetch: true } }
  `,
  'vue-router': `export * from 'vue-router-real'; import { createMemoryHistory } from 'vue-router-real'; export const createWebHashHistory = createMemoryHistory; export const useRoute = () => globalThis.__applicationRuntimeTest.route;`,
}

const createState = () => ({
  applications: apps,
  menus: [menu],
  dimensions: [],
  route: { query: {}, params: {} },
  requests: [],
  messages: [],
  user: { userInfo: { id: 'user' }, isAdmin: true, isSubAccount: false, init() {}, async getUserInfo() {} },
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
  globalThis.sessionStorage = window.sessionStorage
  globalThis.location = window.location
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
        export { useAuthStore } from '${source('store/auth.ts')}'
        export { useLoginSuccess } from '${source('views/login/hooks/useLoginSuccess.ts')}'
        export { useReloginForm } from '${source('views/relogin/components/useReloginForm.ts')}'
        export { useUserStore as useSessionUserStore } from '${source('store/user.ts')}'
        export { DefaultApplicationEntryError } from '${source('router/default-entry.ts')}'
        export { useBasicLayoutVariant } from '${source('layout/hooks/useBasicLayoutVariant.ts')}'
        export { initAxios } from '${source('package.ts')}'
        export { prepareApplicationAccess } from '${source('utils/application-access.ts')}'
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
        // Vite 的菜单资源发现属于模块扫描边界；保留生产语言解析及菜单生成逻辑。
        builder.onLoad({ filter: /[/\\]menuLocale\.ts$/ }, async args => ({
          contents: (await readFile(args.path, 'utf8')).replace(/import\.meta\.glob\([^\n]+\)/, '{}'),
          loader: 'ts', resolveDir: path.dirname(args.path),
        }))
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
  window.location = browserLocation(url)
  window.sessionStorage.clear()
  globalThis.sessionStorage = window.sessionStorage
  globalThis.location = window.location
  localStorage.clear()
  localStorage.setItem('X-Access-Token', 'test-token')
  globalThis.__applicationRuntimeTest = createState()
  api.initAxios()
  api.startup.resetRouteStartupState()
  setActivePinia(createPinia())
}

// 旧子账号守卫发起整页跳转后不会完成当前导航；回归必须显式失败，不能悬挂。
const withNavigationDeadline = async promise => {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('navigation did not finish')), 1000) }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

try {
  for (const [environment, runtimeScope] of [['', 'project'], ['saas', 'project'], ['saas', 'auto']]) {
    const api = await bundle(environment, runtimeScope)
    const { scope, runtime, context, startup } = api

    // 固定项目构建可以在没有项目业务上下文的根后台渲染项目壳层。
    for (const entry of ['/', '/index.html']) {
      reset(api, `http://localhost:9200${entry}#/account/center?tab=Subscribe`)
      assert.equal(api.useBasicLayoutVariant().value, runtimeScope === 'project' ? 'project' : 'tenant')
      assert.equal(runtime.isProjectRuntime(), !environment)
      assert.equal(context.getRequestHeaders()[scope.APPLICATION_SCOPE_HEADER], undefined)
      scenarios++
    }

    // 发布菜单身份唯一，但复用一个播放器；项目规范化和应用一级布局不能丢失组件定位。
    for (const owner of ['iot', 'app']) {
      reset(api, owner === 'app' ? applicationUrl : 'http://localhost:9200/project/#/')
      const state = globalThis.__applicationRuntimeTest
      state.asyncRoutes = { 'visualization/rele': async () => ({ default: { name: 'PublishedCanvas' } }) }
      const publications = ['101', '102'].map(id => ({
        id, code: `published-${id}`, name: `Published ${id}`, owner,
        url: `/visualization/release-page/${id}`,
        options: { meta: { componentCode: 'visualization/rele', authCode: 'retired', authCodes: ['retired'] } },
      }))
      state.menus = owner === 'app' ? publications : [{
        id: 'resources', code: 'resources', name: 'Resources', url: '/resources', owner,
        children: [{id: 'visualization', code: 'visualization', name: 'Visualization', url: '/resources/visualization', owner, children: publications}]
      }]
      await api.useMenuStore().queryMenus(owner === 'app' ? applicationId : false)
      for (const publication of publications) {
        const matched = api.router.resolve(publication.url).matched
        const leaf = matched.at(-1)
        assert.equal(leaf.name, publication.code)
        assert.equal(leaf.meta.componentCode, 'visualization/rele')
        assert.equal(typeof leaf.components?.default, 'function')
        assert.equal((await leaf.components.default()).default.name, 'PublishedCanvas')
        assert.ok(matched.length >= 2, 'published pages retain the surrounding layout')
        if (runtime.isProjectRuntime()) {
          assert.equal(leaf.meta.authCode, undefined)
          assert.equal(leaf.meta.authCodes, undefined)
        }
      }
      scenarios++
    }

    // 裸应用入口必须先核验授权身份，不能在首个请求中把应用 ID 当作租户域名。
    for (const domain of [undefined, applicationId, 'project']) {
      reset(api, `http://localhost:9200/${applicationId}/#/`)
      if (environment && domain !== undefined) {
        localStorage.setItem(`project_${applicationId}`, JSON.stringify({ token: 'saas-token', domain }))
      }
      const state = globalThis.__applicationRuntimeTest
      state.user.userInfo = {}
      state.user.getUserInfo = async () => {
        const request = state.axios.requestOptions({ url: '/user/detail', applicationScope: false })
        state.requests.push(request)
        state.user.userInfo = { id: 'user' }
      }
      await startup.bootstrapSession()
      assert.equal(state.requests[0].url, '/business-application/me')
      assert.equal(state.requests[0].headers['X-Tenant-Domain'], undefined)
      assert.equal(runtime.getApplicationRuntimeEntry().applicationId, applicationId)
      assert.equal(api.useBusinessApplicationStore().currentApplication.id, applicationId)
      const expectedDomain = environment && domain === 'project' ? 'project' : undefined
      if (environment && !expectedDomain) {
        assert.equal(api.useBusinessApplicationStore().applications.some(item => item.runtimeType === 'project'), false)
      }
      assert.equal(state.requests[1].headers['X-Tenant-Domain'], expectedDomain)
      await startup.ensureMenuRoutes(api.router, false)
      assert.equal(state.requests.at(-1).headers['X-Asset-Scope'], `business_application:${applicationId}`)
      for (const headers of [
        state.axios.requestOptions({ url: '/device/_query' }).headers,
        state.ndjson.handleRequest({ url: '/device/_query' }).headers,
        context.getUploadHeaders(),
      ]) {
        assert.equal(headers['X-Asset-Scope'], `business_application:${applicationId}`)
        assert.equal(headers['X-Tenant-Domain'], expectedDomain)
      }
      scenarios++
    }

    // 从“访问应用”进入时复制项目域名和应用 Scope，跳过本地凭证的接口仍保留项目路由。
    for (const storedDomain of ['project', undefined]) {
      reset(api, 'http://localhost:9200/project/#/application-center/ProjectApplication')
      if (environment) {
        localStorage.setItem('project_project', JSON.stringify({ token: 'saas-token', domain: storedDomain }))
      }
      const access = api.prepareApplicationAccess({
        applicationId, applicationName: '应用 A', accessContext: context.getApplicationAccessContext(),
      })
      assert.equal(access.success, true)
      if (environment) {
        const applicationStorage = JSON.parse(localStorage.getItem(`project_${applicationId}`))
        assert.equal(applicationStorage.domain, 'project')
        assert.equal(applicationStorage.scope, applicationId)
        assert.equal(applicationStorage.token, 'saas-token')
      }
      window.location = new URL(access.url)
      window.sessionStorage.clear()
      await startup.bootstrapSession()
      for (const headers of [
        globalThis.__applicationRuntimeTest.axios.requestOptions({ url: '/device/_query' }).headers,
        globalThis.__applicationRuntimeTest.ndjson.handleRequest({ url: '/device/_query' }).headers,
        context.getUploadHeaders(),
      ]) {
        assert.equal(headers['X-Asset-Scope'], `business_application:${applicationId}`)
        assert.equal(headers['X-Tenant-Domain'], environment ? 'project' : undefined)
      }
      const loginRequest = globalThis.__applicationRuntimeTest.axios.requestOptions({ url: '/authorize/captcha/config', projectContext: false })
      assert.equal(loginRequest.headers['X-Tenant-Domain'], environment ? 'project' : undefined)
      assert.equal(loginRequest.headers['X-Asset-Scope'], undefined)
      scenarios++
    }

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
    assert.equal(globalThis.__applicationRuntimeTest.axios.requestOptions({ url: '/edge/device/_query' }).headers[scope.APPLICATION_SCOPE_HEADER], `business_application:${applicationId}`)
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

    // Edge transports must discard cloud context, including explicit headers and retry residue.
    reset(api)
    if (environment) {
      localStorage.setItem(`project_${applicationId}`, JSON.stringify({ token: 'saas-token', domain: 'project', scope: applicationId }))
    }
    localStorage.setItem('jetlinks_verify_cache', JSON.stringify({ key: 'verify-key', token: 'verify-token' }))
    const assertEdgeHeaders = (headers, name) => {
      assert.equal(Object.keys(headers).some(key => ['x-tenant-domain', 'x-asset-scope'].includes(key.toLowerCase())), false, name)
      assert.equal(headers['X-Access-Token'], environment ? 'saas-token' : 'test-token', name)
      assert.equal(headers['x-verify-key'], 'verify-key', name)
      assert.equal(headers['x-verify-token'], 'verify-token', name)
    }
    const edgeTargets = [
      { url: '/edge/device/gateway-1/_/device-instance/_query' },
      { url: '/api/edge/device/gateway-1/_' },
      { url: 'edge/device/gateway-1/_/file/upload', baseURL: '/api' },
      { url: '/edge/product/product-1/_/system/config/front' },
      { url: 'https://proxy.example/api/edge/device/gateway-1/_/device-instance/_query' },
      { url: '//proxy.example/api/edge/device/gateway-1/_/device-instance/_query' },
      { url: '/device-instance/_query', baseURL: '/api/edge/device/gateway-1/_' },
      { url: 'device-instance/_query', baseURL: 'https://proxy.example/api/edge/device/gateway-1/_/' },
    ]
    for (const target of edgeTargets) {
      for (const [name, send] of [
        ['axios', config => globalThis.__applicationRuntimeTest.axios.requestOptions(config)],
        ['ndjson', config => globalThis.__applicationRuntimeTest.ndjson.handleRequest(config)],
      ]) {
        for (const makeHeaders of [value => ({ ...value }), value => AxiosHeaders.from(value)]) {
          const request = {
            ...target, applicationScope: 'explicit-application',
            headers: makeHeaders({
              'X-Tenant-Domain': 'old-project', 'x-tenant-domain': 'stale-project',
              'X-Asset-Scope': 'business_application:old', 'x-AsSeT-sCoPe': 'device:old',
              'X-Custom': 'retained',
            }),
          }
          assertEdgeHeaders(send(request).headers, name)
          assert.equal(request.headers['X-Custom'], 'retained', name)
          request.headers['x-tenant-domain'] = 'retry-project'
          request.headers['x-asset-scope'] = 'business_application:retry'
          assertEdgeHeaders(send(request).headers, `${name} retry`)
        }
      }
      assertEdgeHeaders(context.getRequestHeaders({ ...target, applicationScope: 'explicit-application' }), 'fetch')
      assertEdgeHeaders(context.getUploadHeaders(target), 'upload')
      scenarios++
    }

    // Cloud management URLs and proxy strings in query/hash must retain their normal scope.
    for (const target of [
      { url: '/edge/device/_query' },
      { url: '/edge/device/gateway-1' },
      { url: '/edge/device/gateway-1/_query' },
      { url: '/device/_query?next=/edge/device/gateway-1/_/device-instance' },
      { url: '/device/_query#example=/edge/device/gateway-1/_/device-instance' },
      { url: 'https://cloud.example/api/device/_query', baseURL: '/edge/device/gateway-1/_' },
    ]) {
      for (const headers of [
        globalThis.__applicationRuntimeTest.axios.requestOptions({ ...target }).headers,
        globalThis.__applicationRuntimeTest.ndjson.handleRequest({ ...target }).headers,
        context.getUploadHeaders(target),
      ]) {
        assert.equal(headers[scope.APPLICATION_SCOPE_HEADER], `business_application:${applicationId}`)
        assert.equal(headers['X-Tenant-Domain'], environment ? 'project' : undefined)
      }
      scenarios++
    }

    // Upload/fetch helpers can receive the edge base from the saved API without an explicit URL.
    if (environment) {
      localStorage.setItem(`project_${applicationId}`, JSON.stringify({
        token: 'saas-token', domain: 'project', scope: applicationId,
        apiUrl: 'https://proxy.example/api/edge/device/gateway-1/_',
      }))
      assertEdgeHeaders(context.getUploadHeaders(), 'stored edge API')
      scenarios++
    }

    // Remote edge pages rewrite relative URLs only after normal header injection.
    for (const terminal of ['cloud', 'cloud-pc']) {
      reset(api, 'http://localhost:9200/api/ui/edge/cloud/default/#/overview')
      if (environment) assert.equal(api.useBasicLayoutVariant().value, 'tenant')
      localStorage.setItem('terminal', terminal)
      localStorage.setItem('thingType', 'device')
      localStorage.setItem('thingId', 'gateway-1')
      localStorage.setItem('proxy', '/api')
      localStorage.setItem('jetlinks_verify_cache', JSON.stringify({ key: 'verify-key', token: 'verify-token' }))
      if (environment) {
        localStorage.setItem('project_api', JSON.stringify({ token: 'saas-token', domain: 'project', scope: applicationId }))
      }
      for (const send of [
        config => globalThis.__applicationRuntimeTest.axios.requestOptions(config),
        config => globalThis.__applicationRuntimeTest.ndjson.handleRequest(config),
      ]) {
        const request = send({
          url: '/device-instance/_query', applicationScope: 'explicit-application',
          headers: { 'x-tenant-domain': 'stale-project', 'x-asset-scope': 'device:old' },
        })
        assert.equal(request.baseURL, context.getFromCloudPathName())
        assert.equal(request.url, 'device-instance/_query')
        assertEdgeHeaders(request.headers, terminal)
        assertEdgeHeaders(send(request).headers, `${terminal} retry`)
      }
      assertEdgeHeaders(context.getUploadHeaders({ applicationScope: 'explicit-application' }), `${terminal} upload`)
      scenarios++
    }

    // Exercise the actual switcher and access utility, including SaaS parent-project restoration.
    reset(api)
    if (environment) {
      const storage = { token: 'saas-token', apiUrl: '/api', domain: 'project', name: '项目', id: 'project-id', scope: applicationId }
      localStorage.setItem(`project_${applicationId}`, JSON.stringify(storage))
      localStorage.setItem('project_project', JSON.stringify({ ...storage, scope: undefined }))
    }
    await startup.bootstrapSession()
    globalThis.__applicationRuntimeTest.menus = []
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
    assert.equal(projectTarget.hash, '#/account/center')
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

    const applicationRole = { type: 'role', options: { applicationId } }
    const projectRole = { type: 'role', options: {} }
    const projectUrl = 'http://localhost:9100/p_vdhvrs/#/'
    const prepareProject = (dimensions, applications = apps) => {
      reset(api, projectUrl)
      const state = globalThis.__applicationRuntimeTest
      state.user.isAdmin = false
      state.dimensions = dimensions
      state.applications = applications
      if (environment) {
        localStorage.setItem('project_p_vdhvrs', JSON.stringify({ token: 'project-token', domain: 'p_vdhvrs' }))
      }
      return state
    }

    for (const [name, dimensions, onlyApplications] of [
      ['project', [projectRole], false],
      ['mixed', [applicationRole, projectRole], false],
      ['application', [applicationRole], true],
      ['object-type', [{ ...applicationRole, type: { id: 'role' } }], true],
      ['ignored-project', [applicationRole, { ...projectRole, options: { ignore: true } }], true],
      ['ignored-application', [{ type: 'role', options: { applicationId, ignore: true } }], false],
      ['empty', [], false],
      ['tenant', [{ type: 'tenant' }, { type: 'business_application' }], false],
      ['blank-application', [{ type: 'role', options: { applicationId: '  ' } }], false],
    ]) {
      const state = prepareProject(dimensions)
      state.menus = [{ ...menu, owner: onlyApplications ? 'app' : 'iot' }]
      assert.equal(await startup.bootstrapSession(), onlyApplications, name)
      if (onlyApplications) {
        assert.equal(new URL(state.assignedUrl).pathname, `/${applicationId}/`, name)
        // Continue at the real application URL, preserving requests to verify every menu stayed in scope.
        window.location = new URL(state.assignedUrl)
        setActivePinia(createPinia())
        await startup.bootstrapSession()
      }
      await startup.ensureMenuRoutes(api.router, false)
      const authorizationIndex = state.requests.findIndex(request => request.url === '/authorize/me')
      const menuRequests = state.requests.filter(request => request.url === '/menu/user-own/tree')
      assert.ok(authorizationIndex >= 0 && authorizationIndex < state.requests.findIndex(request => request.url === '/menu/user-own/tree'), name)
      assert.equal(state.requests[authorizationIndex].headers[scope.APPLICATION_SCOPE_HEADER], undefined, name)
      assert.equal(state.requests[authorizationIndex].headers['X-Tenant-Domain'], environment ? 'p_vdhvrs' : undefined, name)
      assert.ok(menuRequests.every(request => request.data.terms[0].value === (onlyApplications ? 'app' : 'iot')), name)
      assert.ok(menuRequests.every(request => request.headers[scope.APPLICATION_SCOPE_HEADER] === (onlyApplications ? `business_application:${applicationId}` : undefined)), name)
      scenarios++
    }

    // API ordering wins over role ordering, including a first application other than the role's application.
    {
      const state = prepareProject([applicationRole], [...apps].reverse())
      assert.equal(await startup.bootstrapSession(), true)
      assert.equal(new URL(state.assignedUrl).pathname, '/application-b/')
      assert.equal(state.requests.at(-1).headers[scope.APPLICATION_SCOPE_HEADER], 'business_application:application-b')
      scenarios++
    }

    for (const mode of ['administrator', 'explicit-project', 'authenticated-page']) {
      const state = prepareProject([applicationRole])
      if (mode === 'administrator') state.user.isAdmin = true
      if (mode === 'explicit-project') window.location.hash = `#/?applicationScope=${scope.PROJECT_APPLICATION_SCOPE}`
      assert.equal(await startup.bootstrapSession(mode !== 'authenticated-page'), false)
      assert.equal(state.requests.some(request => request.url === '/authorize/me'), false)
      assert.equal(state.assignedUrl, undefined)
      scenarios++
    }

    for (const failure of ['authorization-network', 'authorization-result', 'empty-applications', 'menu-response', 'menu-network', 'application-network']) {
      const state = prepareProject([applicationRole])
      if (failure === 'authorization-network') state.authorizationError = new Error('authorization network failed')
      if (failure === 'authorization-result') state.authorizationResponse = { success: false }
      if (failure === 'empty-applications') state.applications = []
      if (failure === 'menu-response') state.menuResponse = { success: false, result: [] }
      if (failure === 'menu-network') state.menuError = new Error('menu request failed')
      if (failure === 'application-network') state.applicationError = new Error('application network failed')
      const originalError = console.error
      try {
        console.error = () => {}
        await api.router.push('/')
      } finally {
        console.error = originalError
      }
      assert.equal(api.router.currentRoute.value.path, '/403', failure)
      assert.equal(state.assignedUrl, undefined, failure)
      assert.ok(state.messages.length > 0, failure)
      assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree' && request.data.terms[0]?.value !== 'app'), false, failure)
      assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree'), failure.startsWith('menu-'), failure)
      scenarios++
    }

    for (const onlyApplications of [false, true]) {
      const state = prepareProject(onlyApplications ? [applicationRole] : [applicationRole, projectRole])
      state.menus = []
      await api.useLoginSuccess().handleLoginSuccess('new-token')
      const menuRequests = state.requests.filter(request => request.url === '/menu/user-own/tree')
      if (onlyApplications) {
        assert.equal(new URL(state.assignedUrl).pathname, `/${applicationId}/`)
        assert.ok(menuRequests.every(request => request.headers[scope.APPLICATION_SCOPE_HEADER] === `business_application:${applicationId}`))
      } else {
        assert.equal(new URL(window.location.href, projectUrl).pathname, environment ? '/p_vdhvrs/' : '/')
        assert.equal(menuRequests.length, 0)
      }
      assert.equal(state.requests.filter(request => request.url === '/authorize/me').length, 1)
      assert.equal(state.requests.find(request => request.url === '/authorize/me').headers['X-Access-Token'], 'new-token')
      scenarios++
    }

    // Explicit application links stay on that application after login, including username@project accounts.
    {
      reset(api, 'http://localhost:9100/application-b/#/login?applicationScope=application-b')
      const state = globalThis.__applicationRuntimeTest
      state.user.isAdmin = false
      state.dimensions = [applicationRole]
      if (environment) {
        localStorage.setItem('project_application-b', JSON.stringify({ token: 'previous-token', domain: 'p_vdhvrs', scope: 'application-b' }))
      }
      await api.useLoginSuccess().handleLoginSuccess('application-token', { username: 'testyy@p_vdhvrs' })
      assert.equal(new URL(window.location.href).pathname, '/application-b/')
      assert.equal(scope.getRouteQueryParam(window.location, 'applicationScope'), 'application-b')
      assert.equal(state.requests.some(request => request.url === '/authorize/me' || request.url === '/menu/user-own/tree'), false)
      assert.equal(state.requests[0].headers['X-Access-Token'], 'application-token')
      scenarios++
    }

    {
      const state = prepareProject([applicationRole])
      state.authorizationError = new Error('authorization unavailable')
      await api.useLoginSuccess().handleLoginSuccess('new-token')
      assert.equal(new URL(window.location.href).hash, '#/403')
      assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree'), false)
      scenarios++
    }

    // Concurrent reads merge; logout and a late old response cannot restore the previous account's decision.
    {
      const state = prepareProject([applicationRole])
      const auth = api.useAuthStore()
      let release
      state.authorizationWait = new Promise(resolve => { release = resolve })
      const old = auth.hasOnlyApplicationRoles()
      const oldRejected = assert.rejects(old, /session changed/)
      const duplicateRejected = assert.rejects(auth.hasOnlyApplicationRoles(), /session changed/)
      assert.equal(state.requests.filter(request => request.url === '/authorize/me').length, 1)
      auth.init()
      state.authorizationWait = undefined
      state.dimensions = [projectRole]
      assert.equal(await auth.hasOnlyApplicationRoles(), false)
      release()
      await Promise.all([oldRejected, duplicateRejected])
      assert.equal(await auth.hasOnlyApplicationRoles(), false)
      assert.equal(state.requests.filter(request => request.url === '/authorize/me').length, 2)
      scenarios++
    }

    for (const failure of ['missing', 'invalid-menu-response', 'endpoint-missing', 'network']) {
      reset(api)
      const state = globalThis.__applicationRuntimeTest
      if (failure === 'missing') state.applications = []
      if (failure === 'invalid-menu-response') state.menus = null
      if (failure === 'endpoint-missing') state.applicationError = { status: 404 }
      if (failure === 'network') state.applicationError = new Error('network unavailable')
      if (failure === 'invalid-menu-response') {
        await startup.bootstrapSession()
        await assert.rejects(startup.ensureMenuRoutes(api.router, false), /Failed to load menus/)
        assert.equal(api.useMenuStore().initialized, false)
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

    for (const failure of ['missing', 'empty-menu', 'menu-request', 'network']) {
      reset(api)
      const state = globalThis.__applicationRuntimeTest
      if (failure === 'missing') state.applications = []
      if (failure === 'empty-menu') state.menus = []
      if (failure === 'menu-request') state.menuResponse = { success: false, result: [], message: 'menu unavailable' }
      if (failure === 'network') state.applicationError = new Error('network unavailable')
      const errors = []
      const originalError = console.error
      try {
        console.error = (...args) => errors.push(args)
        const path = failure === 'menu-request' ? '/' : failure === 'missing' ? '/account/center' : '/invalid'
        await api.router.push(`${path}?applicationScope=${applicationId}`)
      } finally {
        console.error = originalError
      }
      if (failure === 'empty-menu') {
        // The missing deep link is forbidden, but application admission and the menu request succeeded.
        assert.equal(errors.length, 0)
        const removeRoute = api.router.addRoute({ name: 'module-business-page', path: '/module-business-page', component: {} })
        try {
          await withNavigationDeadline(api.router.push('/module-business-page'))
          assert.equal(api.router.currentRoute.value.path, '/403', 'pre-registered business routes still require menu access')
        } finally {
          removeRoute()
        }
      } else {
        assert.equal(errors.length, 1)
        if (failure === 'network') assert.equal(errors[0][1], state.applicationError)
        else if (failure === 'menu-request') assert.equal(errors[0][1].message, 'menu unavailable')
        else assert.ok(errors[0][1] instanceof scope.ApplicationEntryUnavailableError)
      }
      assert.equal(api.router.currentRoute.value.path, '/403')
      assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree' && request.data.terms[0].value === 'iot'), false)
      if (failure === 'network' || failure === 'menu-request') assert.equal(state.messages.at(-1)[0], 'components.BusinessApplicationSwitcher.loadFailed')
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

  // Real user store, route guard, and login/relogin flows; only the HTTP and UI boundaries are fixtures.
  {
    const api = await bundle('', 'tenant')
    const initRequests = state => state.requests.filter(({ url }) => url === '/user/settings/init').length
    const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {} })
    const identities = [
      ['admin', 'user', true, true],
      ['manager', 'projectManager', false, true],
      ['owner', 'projectOwner', false, true],
      ['member', 'user', false, false],
    ]
    for (const [username, type, superAdmin, administrator] of identities) {
      reset(api, 'http://localhost:9200/#/')
      const state = globalThis.__applicationRuntimeTest
      state.user = api.useSessionUserStore()
      state.identity = { id: username, username, type: { id: type } }
      state.initSettings = []
      await withNavigationDeadline(api.router.push(`/init-home?identity=${username}`))
      assert.equal(api.router.currentRoute.value.path, superAdmin ? '/init-home' : '/404', username)
      assert.equal(state.user.isSuperAdmin, superAdmin, username)
      assert.equal(state.user.isAdmin, administrator, username)
      scenarios++

      await api.useLoginSuccess().handleLoginSuccess('login-token')
      assert.equal(window.location.hash === '#/init-home', superAdmin, username)
      assert.equal(initRequests(state), Number(superAdmin), username)
      scenarios++

      // Simulate a different account using the relogin modal, including a stale admin session for denied users.
      state.user.setUserInfo({ id: 'previous', username: 'admin' })
      localStorage.setItem('userId', 'previous')
      state.loginResponse = { success: true, result: { token: 'relogin-token', userId: username } }
      window.location = browserLocation('http://localhost:9200/#/')
      document.location = window.location
      let relogin
      const app = renderer.createApp({ setup() {
        relogin = api.useReloginForm({ type: 'relogin' }, () => {})
        return () => null
      } })
      app.mount({})
      try {
        relogin.submit({ password: 'fixture' })
        await state.pendingRelogin
        assert.equal(window.location.hash === '#/init-home', superAdmin, username)
        assert.equal(initRequests(state), 2 * Number(superAdmin), username)
        assert.equal(state.user.isSuperAdmin, superAdmin, username)
      } finally {
        app.unmount()
      }
      api.startup.resetSessionStores()
      assert.equal(state.user.isSuperAdmin, false, username)
      scenarios++
    }
    reset(api, 'http://localhost:9200/#/')
    const state = globalThis.__applicationRuntimeTest
    state.user = api.useSessionUserStore()
    state.identity = { id: 'admin', username: 'admin', type: { id: 'user' } }
    state.initSettings = [{ name: 'init' }]
    await api.useLoginSuccess().handleLoginSuccess('login-token')
    assert.equal(initRequests(state), 1)
    assert.notEqual(window.location.hash, '#/init-home', 'initialized admin does not automatically reopen setup')
    scenarios++

    reset(api, 'http://localhost:9200/#/')
    localStorage.removeItem('X-Access-Token')
    await withNavigationDeadline(api.router.push('/init-home'))
    assert.equal(api.router.currentRoute.value.path, '/login')
    scenarios++
  }

  // A fresh router must stop on 403 after a discovery failure, without redirecting to 403 repeatedly.
  {
    const api = await bundle('saas', 'auto')
    reset(api, 'http://localhost:9100/p_vdhvrs/#/')
    const state = globalThis.__applicationRuntimeTest
    state.user.isAdmin = false
    state.applicationError = new Error('application discovery unavailable')
    const originalError = console.error
    try {
      console.error = () => {}
      await api.router.push('/')
    } finally {
      console.error = originalError
    }
    assert.equal(api.router.currentRoute.value.path, '/403')
    assert.equal(state.requests.some(request => request.url === '/menu/user-own/tree'), false)
    assert.ok(state.requests.filter(request => request.url === '/business-application/me').length <= 2)
    scenarios++
  }

  // Successful full-page navigation cancels the pending project navigation before its menus load.
  {
    const api = await bundle('saas', 'auto')
    reset(api, 'http://localhost:9100/p_vdhvrs/#/')
    const state = globalThis.__applicationRuntimeTest
    state.user.isAdmin = false
    state.dimensions = [{ type: 'role', options: { applicationId } }]
    localStorage.setItem('project_p_vdhvrs', JSON.stringify({ token: 'project-token', domain: 'p_vdhvrs' }))
    await api.router.push('/overview')
    assert.equal(new URL(state.assignedUrl).pathname, `/${applicationId}/`)
    assert.equal(api.router.currentRoute.value.path, '/')
    assert.ok(state.requests.filter(request => request.url === '/menu/user-own/tree').every(request => request.data.terms[0]?.value === 'app'))
    scenarios++
  }

  for (const [runtimeScope, subApp] of [['tenant', false], ['project', true]]) {
    const api = await bundle('', runtimeScope, subApp)
    if (runtimeScope === 'tenant') {
      reset(api, 'http://localhost:9200/#/account/center?tab=Subscribe')
      assert.equal(api.useBasicLayoutVariant().value, 'tenant')
      scenarios++
    }
    reset(api)
    assert.equal(api.runtime.isApplicationRuntime(), false)
    assert.equal(api.context.getRequestHeaders()[api.scope.APPLICATION_SCOPE_HEADER], undefined)
    await api.useMenuStore().queryMenus()
    assert.equal(globalThis.__applicationRuntimeTest.requests.at(-1).headers[api.scope.APPLICATION_SCOPE_HEADER], undefined)
    scenarios++
  }

  for (const [environment, runtimeScope] of [['', 'project'], ['saas', 'project'], ['saas', 'auto']]) {
    const cases = [
      { name: 'login', login: true },
      { name: 'sub-account login', login: true, subAccount: true },
      { name: 'project root refresh' },
      { name: 'sub-account direct center', subAccount: true, target: '/account/center' },
      { name: 'hidden static center', subAccount: true, overridePath: 'center' },
      { name: 'overridden static path', subAccount: true, overridePath: 'profile', expected: '/account/profile' },
      { name: 'business menu takes priority', subAccount: true, menus: [personalCenterMenu, { ...menu, owner: 'iot' }], expected: '/overview' },
      { name: 'legacy user-owned menu without granted', menus: [{ ...personalCenterMenu, granted: undefined }] },
      { name: 'empty menu login', menus: [], login: true, subAccount: true },
      { name: 'explicitly denied center menu', menus: [{ ...personalCenterMenu, granted: false }] },
      { name: 'hidden page only', menus: [{ ...menu, options: { show: false } }] },
      { name: 'placeholder in a directory', menus: [{ code: 'group', url: '/group', children: [
        { ...menu, meta: { menuBadge: { type: 'comingSoon' } } },
      ] }] },
      { name: 'removed static center', menus: [], removeCenter: true, expected: '/403', noEntry: true },
    ]

    for (const application of [false, true]) {
      for (const scenario of cases) {
        const api = await bundle(environment, runtimeScope)
        const page = scenario.login ? 'login' : ''
        reset(api, application
          ? `http://localhost:9200/${applicationId}/#/${page}?applicationScope=${applicationId}`
          : `http://localhost:9200/project/#/${page}`)
        const state = globalThis.__applicationRuntimeTest
        state.user.isAdmin = false
        state.user.isSubAccount = Boolean(scenario.subAccount)
        state.menus = (scenario.menus || [personalCenterMenu]).map(item => ({ ...item, owner: application ? 'app' : 'iot' }))
        if (scenario.removeCenter) api.router.removeRoute('Account')
        if (scenario.overridePath) {
          // 模块可将个人中心隐藏或使用相对 child path；入口必须取注册后的实际路径。
          api.router.addRoute({
            path: '/account', name: 'Account', component: {}, meta: { hideInMenu: true },
            children: [{ path: scenario.overridePath, name: 'account/center', component: {}, meta: { hideInMenu: true } }],
          })
        }
        const store = api.useMenuStore()
        const queryResults = []
        store.$onAction(({ name, after }) => {
          if (name === 'queryMenus') after(result => queryResults.push(result))
        })
        if (scenario.login) await api.useLoginSuccess().handleLoginSuccess('new-token')
        const expected = scenario.expected || '/account/center'
        const label = `${environment || 'private'}/${runtimeScope}/${application ? 'application' : 'project'}: ${scenario.name}`
        const originalHref = window.location.href
        await withNavigationDeadline(api.router.push(scenario.target || '/'))
        assert.equal(api.router.currentRoute.value.path, expected, label)
        assert.equal(window.location.href, originalHref, `${label}: no full-page redirect loop`)
        assert.equal(queryResults.at(-1).firstMenuPath, scenario.noEntry ? undefined : expected, label)
        assert.equal(api.router.getRoutes().find(route => route.path === '/')?.redirect, expected, label)
        assert.equal(api.router.hasRoute('account-center'), false, `${label}: reuse the static route`)
        const menuRequests = state.requests.filter(request => request.url === '/menu/user-own/tree')
        assert.ok(menuRequests.length, label)
        assert.ok(menuRequests.every(request => request.data.terms[0]?.value === (application ? 'app' : 'iot')
          && request.headers[api.scope.APPLICATION_SCOPE_HEADER] === (application ? `business_application:${applicationId}` : undefined)), label)
        if (application) assert.equal(api.router.currentRoute.value.query.applicationScope, applicationId, label)
        if (!state.menus.length) assert.deepEqual(api.useAuthStore().permissions, {}, label)
        if (!scenario.noEntry) {
          store.init()
          api.startup.resetRouteStartupState()
          await withNavigationDeadline(api.router.replace('/'))
          assert.equal(api.router.currentRoute.value.path, expected, `${label}: reload menus`)
          assert.equal(queryResults.at(-1).firstMenuPath, expected, label)
        }
        scenarios++
      }
    }
  }

  // 租户子账号仍然拒绝进入，其他旧租户路径仍返回项目根入口。
  {
    const api = await bundle('saas', 'tenant')
    reset(api, 'http://localhost:9200/#/account/center')
    globalThis.__applicationRuntimeTest.user.isSubAccount = true
    globalThis.__applicationRuntimeTest.menus = [personalCenterMenu]
    await withNavigationDeadline(api.router.push('/account/center'))
    assert.equal(api.router.currentRoute.value.path, '/403')
    scenarios++
  }
  {
    const api = await bundle('saas', 'project')
    reset(api, 'http://localhost:9200/project/#/account/legacy')
    globalThis.__applicationRuntimeTest.user.isSubAccount = true
    const redirected = new Promise(resolve => {
      window.location = new Proxy(window.location, {
        set(target, key, value) {
          const changed = Reflect.set(target, key, value, target)
          if (key === 'href') resolve(target.href)
          return changed
        },
      })
    })
    void api.router.push('/account/legacy')
    assert.equal(await withNavigationDeadline(redirected), 'http://localhost:9200/project/#/')
    scenarios++
  }

  console.log(`application runtime: ${scenarios} production-chain scenarios passed`)
} finally {
  await rm(outputRoot, { recursive: true, force: true })
}
