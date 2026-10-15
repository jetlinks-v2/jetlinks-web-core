import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import * as vueRouter from 'vue-router'

const src = fileURLToPath(new URL('../src/', import.meta.url))
const require = createRequire(import.meta.url)
function createLoader(stubs = {}) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    new Function('require', 'exports', code)(id => {
      if (Object.hasOwn(stubs, id)) return stubs[id]
      if (id === 'vue-router') return vueRouter
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id)
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(src, id.slice('@jetlinks-web-core/'.length))
      return load(existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'))
    }, exports)
    return exports
  }
  return load
}

async function harness(t, { path = '/home', entry = { activate: true }, id = 'module:open' } = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { name: 'home', path: '/home', component: {} },
    { name: 'list', path: '/project/list', component: {} },
    { name: 'other', path: '/other', component: {} },
  ] })
  await router.push(path)
  let opened = 0, unavailable = 0, blocked = 0, pushes = 0
  let navigation
  const menu = { code: 'module/list', name: 'list', routeName: 'list', title: 'List', path: '/project/list', breadcrumb: [], keywords: [] }
  const capabilities = [{ id, name: 'Open', kind: 'feature', menuCode: menu.code, entry }]
  const context = {
    menus: [menu], capabilities, currentRoute: {},
    findMenu: value => context.menus.find(item => [item.code, item.routeName].includes(value)),
    navigateToMenu: (_value, options) => { pushes++; navigation = router.push({ name: 'list', ...options }); return true },
    navigateToRoute: (name, options) => { pushes++; navigation = router.push({ name, ...options }); return true },
  }
  const load = createLoader({
    '@jetlinks-web-core/router': { default: router, __esModule: true },
    '@jetlinks-web-core/locales': { default: { global: { t: key => key } }, __esModule: true },
    '@jetlinks-web-core/store/ai': { useAIStore: () => ({ setDrawer: () => { opened++ } }) },
    '@jetlinks-web/utils': { onlyMessage: () => { unavailable++ } },
    './homeAgentContext': { createHomeAgentContext: () => context },
  })
  const { createFeatureEntryNavigation } = load(resolve(src, 'layout/components/AiChat/featureEntryNavigation.ts'))
  const controller = createFeatureEntryNavigation(router, {
    onOpened: () => { opened++ }, onUnavailable: () => { unavailable++ }, onBlocked: () => { blocked++ },
  })
  t.after(controller.dispose)
  return {
    router, controller, context, load, id, getContext: () => context,
    async settle() { await navigation; await vue.nextTick() },
    stats: () => ({ opened, unavailable, blocked, pushes }),
  }
}

test('same page opens once, keeps scope/query/hash, and permits another explicit click', async t => {
  const h = await harness(t, { path: '/project/list?scope=one&q=filter#section' })
  let calls = 0
  h.controller.register(h.id, '/project/list', () => { calls++; return true })
  h.controller.open(h.id, h.getContext)
  await vue.nextTick()
  assert.equal(calls, 1)
  assert.equal(h.router.currentRoute.value.fullPath, '/project/list?scope=one&q=filter#section')
  assert.deepEqual(h.stats(), { opened: 1, unavailable: 0, blocked: 0, pushes: 0 })
  h.controller.open(h.id, h.getContext)
  assert.equal(calls, 2)
})

test('cross-page intent waits for successful navigation then page registration', async t => {
  const h = await harness(t)
  let calls = 0
  h.controller.open(h.id, h.getContext)
  await h.settle()
  assert.equal(h.stats().opened, 0)
  const release = h.controller.register(h.id, '/project/list', () => { calls++; return true })
  assert.equal(calls, 1)
  release()
  h.controller.register(h.id, '/project/list', () => { calls++; return true })
  assert.equal(calls, 1)
  assert.equal(h.stats().opened, 1)
})

test('page registration before navigation completion cannot activate prematurely', async t => {
  const h = await harness(t)
  let calls = 0
  h.controller.register(h.id, '/project/list', () => { calls++; return true })
  h.controller.open(h.id, h.getContext)
  assert.equal(calls, 0)
  await h.settle()
  assert.equal(calls, 1)
})

test('feature tab uses trusted declaration and retains same-page scope', async t => {
  const h = await harness(t, { path: '/project/list?scope=one', entry: { query: { tab: 'history' } } })
  h.context.capabilities[0].routeName = 'list'
  h.controller.register(h.id, '/project/list', () => { throw Error('Tab entry is navigation only') })
  h.controller.open(h.id, h.getContext)
  await h.settle()
  assert.deepEqual(h.router.currentRoute.value.query, { scope: 'one', tab: 'history' })
  assert.equal(h.stats().opened, 1)
})

test('already-selected query still activates once on duplicated navigation', async t => {
  const h = await harness(t, { path: '/project/list?type=all', entry: { activate: true, query: { type: 'all' } } })
  let calls = 0
  h.controller.register(h.id, '/project/list', () => { calls++; return true })
  h.controller.open(h.id, h.getContext)
  await h.settle()
  assert.equal(calls, 1)
})

for (const mode of ['unknown', 'no-menu', 'no-entry']) {
  test(`${mode} cannot dispatch or activate an entry`, async t => {
    const h = await harness(t)
    h.controller.register(h.id, '/home', () => { throw Error('Unauthorized opening') })
    if (mode === 'no-menu') h.context.menus = []
    if (mode === 'no-entry') delete h.context.capabilities[0].entry
    h.controller.open(mode === 'unknown' ? 'missing' : h.id, h.getContext)
    assert.deepEqual(h.stats(), { opened: 0, unavailable: 1, blocked: 0, pushes: 0 })
  })
}

test('permissions are checked again after navigation before late page mounting', async t => {
  const h = await harness(t)
  h.controller.open(h.id, h.getContext)
  await h.settle()
  h.context.menus = []
  h.controller.register(h.id, '/project/list', () => { throw Error('Revoked opening') })
  assert.equal(h.stats().opened, 0)
  assert.equal(h.stats().unavailable, 1)
})

test('route guard cancellation preserves page and never replays on a later visit', async t => {
  const h = await harness(t)
  const stop = h.router.beforeEach(() => false)
  h.controller.open(h.id, h.getContext)
  await h.settle()
  assert.equal(h.router.currentRoute.value.path, '/home')
  stop()
  await h.router.push('/project/list')
  h.controller.register(h.id, '/project/list', () => { throw Error('Canceled opening') })
  assert.equal(h.stats().opened, 0)
})

test('redirect and leaving an unmounted target discard the one-shot intent', async t => {
  const h = await harness(t)
  const stop = h.router.beforeEach(to => to.name === 'list' ? { name: 'other' } : true)
  h.controller.open(h.id, h.getContext)
  await h.settle()
  stop()
  await h.router.push('/project/list')
  h.controller.register(h.id, '/project/list', () => { throw Error('Stale opening') })
  assert.equal(h.stats().opened, 0)
})

test('a blocked or throwing opener neither closes the assistant nor retries later', async t => {
  for (const open of [() => false, () => { throw Error('Unavailable') }]) {
    const h = await harness(t, { path: '/project/list' })
    const release = h.controller.register(h.id, '/project/list', open)
    h.controller.open(h.id, h.getContext)
    assert.equal(h.stats().opened, 0)
    assert.equal(h.stats().blocked + h.stats().unavailable, 1)
    release()
    h.controller.register(h.id, '/project/list', () => { throw Error('Replay') })
  }
})

test('failed dispatch leaves no pending intent; refresh creates no intent', async t => {
  const h = await harness(t)
  h.context.navigateToMenu = () => false
  h.controller.open(h.id, h.getContext)
  await h.router.push('/project/list')
  h.controller.register(h.id, '/project/list', () => { throw Error('Failed dispatch replay') })
  const fresh = await harness(t, { path: '/project/list' })
  fresh.controller.register(fresh.id, '/project/list', () => { throw Error('Refresh replay') })
  assert.equal(fresh.stats().opened, 0)
})

test('a stale page handler cannot bypass a changed registered destination', async t => {
  const h = await harness(t, { path: '/project/list' })
  h.controller.register(h.id, '/project/list', () => { throw Error('Old destination') })
  h.context.capabilities[0].routeName = 'other'
  h.controller.open(h.id, h.getContext)
  await h.settle()
  assert.equal(h.router.currentRoute.value.path, '/other')
  assert.equal(h.stats().opened, 0)
})

test('missing page handler expires into page fallback and cannot replay', async t => {
  const h = await harness(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  h.controller.open(h.id, h.getContext)
  await h.settle()
  t.mock.timers.tick(10000)
  h.controller.register(h.id, '/project/list', () => { throw Error('Expired opening') })
  assert.equal(h.stats().unavailable, 1)
  assert.equal(h.stats().opened, 0)
})

test('any module can declare an entry, without exposing handlers or query to the model', async t => {
  const h = await harness(t, { id: 'independent:template-picker', entry: { activate: true, query: { panel: 'library' } } })
  const { compactHomeAgentCapability } = h.load(resolve(src, 'layout/components/AiChat/homeAgentCatalog.ts'))
  const compact = compactHomeAgentCapability(h.context.capabilities[0])
  assert.equal(compact.markdownLink, '[Open](#feature=independent%3Atemplate-picker)')
  assert.equal(compact.entry, undefined)
  let calls = 0
  h.controller.register(h.id, '/project/list', () => { calls++; return true })
  h.controller.open(h.id, h.getContext)
  await h.settle()
  assert.equal(calls, 1)
  assert.equal(h.router.currentRoute.value.query.panel, 'library')
})

test('controlled link ignores model-supplied navigation options and preserves menu fallback', async t => {
  const h = await harness(t)
  const handoff = h.load(resolve(src, 'layout/components/AiChat/homeAgentHandoff.ts'))
  assert.equal(handoff.resolveHomeAgentFeatureLink('#feature=module%3Aopen&query=%7B%22tab%22%3A%22unsafe%22%7D'), h.id)
  assert.equal(handoff.resolveHomeAgentFeatureLink('#menu=module%2Flist'), undefined)
  assert.equal(handoff.resolveHomeAgentFeatureLink('#feature='), '')
  let prevented = 0
  const handler = handoff.createHomeAgentMarkdownLinkHandler()
  handler({ href: '#feature=module%3Aopen&query=unsafe', event: { preventDefault() { prevented++ } } })
  await h.settle()
  assert.deepEqual(h.router.currentRoute.value.query, {})
  assert.equal(prevented, 1)
  handler({ href: '#feature=missing', event: { preventDefault() { prevented++ } } })
  assert.equal(prevented, 2)
  assert.equal(handler({ href: 'https://example.org', event: {} }), false)
})

test('waiting on an unsaved-edit guard does not expire the click before navigation succeeds', async t => {
  const h = await harness(t)
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let allow
  h.router.beforeEach(() => new Promise(resolve => { allow = resolve }))
  h.controller.open(h.id, h.getContext)
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(20000)
  assert.equal(h.stats().unavailable, 0)
  allow(true)
  await h.settle()
  let calls = 0
  h.controller.register(h.id, '/project/list', () => { calls++; return true })
  assert.equal(calls, 1)
})

test('feature entry loads before router initialization and opens after the router is ready', async t => {
  const h = await harness(t, { path: '/project/list', entry: {} })
  let routerReady = false
  let opened = 0
  const load = createLoader({
    '@jetlinks-web-core/router': {
      __esModule: true,
      get default() {
        if (!routerReady) throw new ReferenceError("Cannot access 'router' before initialization")
        return h.router
      },
    },
    '@jetlinks-web-core/locales': { default: { global: { t: key => key } }, __esModule: true },
    '@jetlinks-web-core/store/ai': { useAIStore: () => ({ setDrawer: () => { opened++ } }) },
    '@jetlinks-web/utils': { onlyMessage: () => assert.fail('Entry should be available') },
  })
  const feature = load(resolve(src, 'layout/components/AiChat/useHomeAgentFeatureEntry.ts'))
  routerReady = true
  feature.openHomeAgentFeatureEntry(h.id, h.getContext)
  feature.openHomeAgentFeatureEntry(h.id, h.getContext)
  assert.equal(opened, 2)
  assert.equal(h.router.currentRoute.value.path, '/project/list')
})

test('the page hook releases old mounted handlers and only collapses the assistant', async t => {
  const h = await harness(t, { path: '/project/list' })
  const feature = h.load(resolve(src, 'layout/components/AiChat/useHomeAgentFeatureEntry.ts'))
  const renderer = vue.createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  let oldCalls = 0, newCalls = 0
  const root = {}
  const page = open => ({ setup() { feature.useHomeAgentFeatureEntry(h.id, open); return () => null } })
  const view = vue.shallowRef(page(() => { oldCalls++; return true }))
  const app = renderer.createApp({ setup: () => () => view.value ? vue.h(view.value) : null })
  app.use(h.router)
  app.mount(root)
  t.after(() => app.unmount())
  feature.openHomeAgentFeatureEntry(h.id, h.getContext)
  view.value = null
  await vue.nextTick()
  view.value = page(() => { newCalls++; return true })
  await vue.nextTick()
  assert.equal(newCalls, 0)
  feature.openHomeAgentFeatureEntry(h.id, h.getContext)
  assert.equal(oldCalls, 1)
  assert.equal(newCalls, 1)
  assert.equal(h.stats().opened, 2)
  // The wrapper calls only setDrawer, not conversation release/initialization.
  view.value = null
  await vue.nextTick()
})
