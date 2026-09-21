import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const src = fileURLToPath(new URL('../src/', import.meta.url))
const require = createRequire(import.meta.url)

// 运行实际 TS 模块；仅隔离浏览器环境、后台服务和与导航无关的布局扩展。
function createLoader(stubs = {}) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    const code = ts.transpileModule(readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({})'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    new Function('require', 'exports', code)(id => {
      if (Object.hasOwn(stubs, id)) return stubs[id]
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id)
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(src, id.slice('@jetlinks-web-core/'.length))
      return load(existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'))
    }, exports)
    return exports
  }
  return load
}

const runtimeStubs = {
  './project-storage': {}, './request-context': {}, './deployment': {},
  '@jetlinks-web-core/locales': { default: { global: { t: key => key } }, __esModule: true },
}
const menuTree = () => [{ path: '/a', name: 'a', children: [
  { path: '/a/list', name: 'list', children: [
    { path: '/a/list/first', name: 'first' }, { path: '/a/list/second', name: 'second' },
  ] },
  { path: '/a/groups', name: 'groups', children: [{ path: '/a/groups/first', name: 'group-first' }] },
] }, { path: '/b', name: 'b', children: [
  { path: '/b/users', name: 'users', children: [{ path: '/b/users/list', name: 'user-list' }] },
] }]

function harness(t, { variant = 'project', menus = menuTree(), path = '/a/list/second' } = {}) {
  const scope = vue.effectScope()
  t.after(() => { scope.stop(); delete globalThis.window })
  const route = vue.reactive({ path, meta: {}, query: {}, matched: [] })
  const store = vue.reactive({ siderMenus: menus })
  const pushes = []
  const system = vue.reactive({ theme: 'light', layout: { layout: variant === 'tenant' ? 'top' : 'mix' }, systemInfo: {}, themeStyleToken: {} })
  const load = createLoader({
    ...runtimeStubs,
    'vue-router': { useRoute: () => route, useRouter: () => ({ push: target => { pushes.push(target); return Promise.resolve() } }) },
    '@vueuse/core': { useWindowScroll: () => ({ y: vue.ref(0) }) },
    pinia: { storeToRefs: vue.toRefs },
    '@jetlinks-web-core/hooks': { useResponsiveLayoutDimensions: () => ({ layoutConfig: vue.ref({}) }) },
    '@jetlinks-web-core/store/menu': { useMenuStore: () => store },
    '@jetlinks-web-core/store/system': { useSystemStore: () => system },
    '@jetlinks-web-core/utils': { getHideHeaderRightConfig: () => false },
    '@jetlinks-web-core/utils/business-application-runtime': { isBusinessApplicationRuntime: () => false },
    '@jetlinks-web-core/utils/consts': { isSubApp: false },
    '@jetlinks-web-core/layout/components/AiChat/useGlobalHomeAgent': { useGlobalHomeAgent() {} },
    './useProjectGeneralAgent': { useProjectGeneralAgent() {} },
    './useProjectSecondaryMenu': { provideProjectSecondaryMenu: () => ({ items: vue.ref([]), selectedKey: vue.ref('') }) },
    './useProjectSecondaryMenuExtensions': { useProjectSecondaryMenuExtensions: () => ({ active: vue.ref(false), visible: vue.ref(false), items: vue.ref([]) }) },
  })
  globalThis.window = {}
  const controller = scope.run(() => load(resolve(src, 'layout/hooks/useBasicLayoutController.ts')).useBasicLayoutController(vue.computed(() => variant)))
  return { controller, route, store, pushes }
}

test('deep link opens ancestors only; repeated primary selection keeps page and manual collapse', async t => {
  const { controller: c, pushes } = harness(t)
  assert.deepEqual(c.state.openKeys, ['/a/list'])
  assert.deepEqual(c.layoutSelectedKeys.value, ['/a', '/a/list/second'])
  c.handleOpenKeysChange([])
  c.handlePrimaryMenuClick({ key: '/a' })
  await vue.nextTick()
  assert.deepEqual(pushes, [])
  assert.deepEqual(c.state.openKeys, [])
})

test('query changes, equivalent menu refresh and width correction preserve manual collapse', async t => {
  const { controller: c, route, store } = harness(t)
  c.handleOpenKeysChange([])
  route.query = { page: '2' }
  store.siderMenus = menuTree()
  c.state.collapsed = true
  await vue.nextTick()
  assert.deepEqual(c.state.openKeys, [])
  assert.equal(c.state.collapsed, false)
})

test('same primary navigation merges groups; another primary resets them', async t => {
  const { controller: c, route, pushes } = harness(t)
  c.handleOpenKeysChange(['/a/groups'])
  route.path = '/a/list/first'
  await vue.nextTick()
  assert.deepEqual(c.state.openKeys, ['/a/groups', '/a/list'])
  c.handlePrimaryMenuClick({ key: '/b' })
  assert.deepEqual(pushes, ['/b/users/list'])
  route.path = '/b/users/list'
  await vue.nextTick()
  assert.deepEqual(c.state.openKeys, ['/b/users'])
})

test('late menus and hidden detail pages recover ancestors from cached breadcrumbs', async t => {
  const { controller: c, route, store } = harness(t, { menus: [], path: '/detail/42' })
  assert.deepEqual(c.state.openKeys, [])
  store.siderMenus = menuTree()
  route.meta = { breadcrumb: [], breadcrumbCache: [{ path: '/a/list/second' }] }
  await vue.nextTick()
  assert.deepEqual(c.state.openKeys, ['/a/list'])
})

test('top navigation remains uncontrolled', t => {
  const { controller: c } = harness(t, { variant: 'tenant' })
  assert.equal(c.layoutOpenKeys.value, undefined)
  c.handleOpenKeysChange(['/a'])
  assert.deepEqual(c.state.openKeys, [])
})

test('application primary menus have no expandable sidebar groups', t => {
  const { controller: c } = harness(t, { variant: 'application' })
  assert.deepEqual(c.state.openKeys, [])
})

test('disabled and coming-soon children are skipped', t => {
  const menus = menuTree()
  menus[1].children[0].children.unshift(
    { path: '/b/disabled', name: 'disabled', meta: { disabled: true } },
    { path: '/b/soon', name: 'soon', meta: { menuBadge: { type: 'comingSoon' } } },
  )
  const { controller: c, pushes } = harness(t, { menus })
  c.handlePrimaryMenuClick({ key: '/b' })
  c.handlePrimaryMenuClick({ key: '/b/disabled' })
  c.handlePrimaryMenuClick({ key: '/b/soon' })
  assert.deepEqual(pushes, ['/b/users/list'])
})

test('renderer routes once and retains query, modified clicks, links and disabled badges', async () => {
  const load = createLoader(runtimeStubs)
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/a', name: 'a', redirect: '/a/list/first' },
    { path: '/a/list/first', name: 'first', component: {} },
    { path: '/a/list/second', name: 'second', component: {} },
  ] })
  await router.push('/a/list/second?page=2')
  const { useProjectNavigation } = load(resolve(src, 'layout/hooks/useProjectNavigation.ts'))
  const menus = vue.computed(menuTree)
  const nav = useProjectNavigation({ menus, filteredMenus: menus, searchKeyword: vue.ref(''), route: router.currentRoute.value, router })
  const { createLayoutMenuItemRenderer } = load(resolve(src, 'layout/utils/projectMenuRender.ts'))
  const render = createLayoutMenuItemRenderer(nav.navigatePrimary)
  const node = render({ item: menus.value[0] })
  const link = node.children.default()
  assert.equal(link.props.custom, true)
  const anchor = link.children.default({ href: '/a' })
  assert.equal(anchor.props.href, '/a')
  assert.equal(anchor.props.onClick, undefined)
  const event = { preventDefault() { this.defaultPrevented = true }, button: 0 }
  node.props.onClick(event)
  await vue.nextTick()
  assert.equal(event.defaultPrevented, true)
  assert.equal(router.currentRoute.value.fullPath, '/a/list/second?page=2')
  for (const key of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    const modified = { ...event, defaultPrevented: false, [key]: true }
    node.props.onClick(modified)
    assert.equal(modified.defaultPrevented, false)
  }
  assert.equal(render({ item: { path: 'https://example.com' } }), undefined)
  assert.equal(render({ item: { path: '/a', meta: { target: '_blank' } } }), undefined)
  assert.equal(render({ item: { path: '/soon', meta: { menuBadge: { type: 'comingSoon' } } } }).props.disabled, true)
})
