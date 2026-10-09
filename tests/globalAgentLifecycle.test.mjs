import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as pinia from 'pinia'

const src = fileURLToPath(new URL('../src/', import.meta.url))
const require = createRequire(import.meta.url)
const i18n = { __esModule: true, default: { global: { t: key => key } } }

// Execute production TS/SFC modules, replacing only browser integration and external services.
function createLoader(stubs) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    let source = readFileSync(filename, 'utf8')
    if (filename.endsWith('.vue')) {
      source = compileScript(parse(source).descriptor, { id: 'lifecycle', inlineTemplate: true }).content
    }
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText
    new Function('require', 'exports', code)(id => {
      if (Object.hasOwn(stubs, id)) return stubs[id]
      if (id.endsWith('.less')) return {}
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id)
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(src, id.slice('@jetlinks-web-core/'.length))
      return load(existsSync(base) ? base : existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'))
    }, exports)
    return exports
  }
  return load
}

function renderer() {
  const node = type => ({ type, children: [], style: {} })
  return vue.createRenderer({
    createElement: node, createText: node, createComment: node,
    setText: (el, text) => { el.text = text },
    setElementText: (el, text) => { el.text = text },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1],
    patchProp: (el, key, previous, value) => { el[key] = value },
    insert(el, parent, anchor) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
      el.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
    },
    remove(el) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
      el.parent = undefined
    },
  })
}

function environment(t) {
  const previousWindow = globalThis.window
  const previousRef = globalThis.ref
  const timers = new Map()
  const cleanups = []
  let timerId = 0
  globalThis.ref = vue.ref
  globalThis.window = Object.assign(new EventTarget(), {
    setTimeout: callback => { timers.set(++timerId, callback); return timerId },
    clearTimeout: id => timers.delete(id),
  })
  pinia.setActivePinia(pinia.createPinia())
  t.after(() => {
    cleanups.reverse().forEach(cleanup => cleanup())
    globalThis.window = previousWindow
    globalThis.ref = previousRef
  })
  const flush = async () => {
    await vue.nextTick()
    const callbacks = [...timers.values()]
    timers.clear()
    callbacks.forEach(callback => callback())
    for (let index = 0; index < 12; index += 1) await Promise.resolve()
    await vue.nextTick()
  }
  flush.onCleanup = cleanup => cleanups.push(cleanup)
  return flush
}

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function storeHarness(t, queryAgentList = async () => ({ success: true, result: [{ agentId: 'agent', clientType: 'pagePoint' }] })) {
  const flush = environment(t)
  let queries = 0
  const load = createLoader({
    pinia,
    '@jetlinks-web-core/api/comm': {
      existsAiAgentSupport: async () => true,
      queryAgentList: (...args) => { queries += 1; return queryAgentList(...args) },
    },
  })
  return { store: load(resolve(src, 'store/ai.ts')).useAIStore(), flush, queries: () => queries }
}

test('same active deployment refreshes context without closing the drawer or clearing unread state', async t => {
  const h = storeHarness(t)
  await h.store.queryAgent('global', { subjectId: 'project', currentView: 'a' })
  h.store.setDrawer(true)
  h.store.bubbleUnreadCount = 3
  const list = h.store.agentList
  await h.store.queryAgent('global', { subjectId: 'project', currentView: 'b' })
  assert.equal(h.queries(), 1)
  assert.equal(h.store.agentList, list)
  assert.equal(h.store.showAiDrawer, true)
  assert.equal(h.store.bubbleUnreadCount, 3)
  assert.equal(h.store.parameters.currentView, 'b')
  await h.store.queryAgent('global')
  assert.equal(h.store.parameters.currentView, 'b')
})

test('same pending deployment query is single-flight and applies the latest context', async t => {
  const result = deferred()
  const h = storeHarness(t, () => result.promise)
  const first = h.store.queryAgent('global', { currentView: 'a' })
  const second = h.store.queryAgent('global', { currentView: 'b' })
  await h.flush()
  assert.equal(h.queries(), 1)
  result.resolve({ success: true, result: [{ agentId: 'agent' }] })
  await Promise.all([first, second])
  assert.equal(h.store.parameters.currentView, 'b')
})

test('late deployment response cannot reclaim a released or replaced page owner', async t => {
  const result = deferred()
  const h = storeHarness(t, (type, client) => client === 'global'
    ? result.promise : Promise.resolve({ success: true, result: [{ agentId: 'page-agent' }] }))
  const first = h.store.queryAgent('global')
  await h.flush()
  h.store.prepareAgentConversation('page', { subjectId: 'device' })
  await h.store.queryAgent('page', { subjectId: 'device' })
  result.resolve({ success: true, result: [{ agentId: 'old-agent' }] })
  await first
  assert.equal(h.store.activeClientId, 'page')
  assert.equal(h.store.agentList[0].agentId, 'page-agent')
  h.store.releaseAgentConversation('page')
  assert.equal(h.store.showAiButton, false)
})

test('failed deployment requests can be retried without a permanent negative cache', async t => {
  let attempts = 0
  const h = storeHarness(t, async () => {
    if (++attempts === 1) throw new Error('temporary')
    return { success: true, result: [{ agentId: 'agent' }] }
  })
  await h.store.queryAgent('global')
  await h.store.queryAgent('global')
  assert.equal(h.queries(), 2)
  assert.equal(h.store.activeClientId, 'global')
})

function globalHarness(t, { project = true, loading = Promise.resolve(), queryAgentList } = {}) {
  const h = storeHarness(t, queryAgentList)
  const route = vue.reactive({ path: '/a', fullPath: '/a', name: 'a', meta: {} })
  const menu = vue.reactive({ initialized: true, siderMenus: [{ name: 'a' }] })
  let creations = 0
  let disposals = 0
  let refreshes = 0
  const createRuntime = () => {
    creations += 1
    return {
      parameters: {}, clientTools: [], clientToolsVersion: 0, skillBindings: [],
      subscribeClientTools: () => () => {},
      refreshContext() {
        refreshes += 1
        this.parameters = { subjectId: project ? 'project' : 'iotHome', currentView: route.name }
        this.clientTools = [{ name: route.name }]
        this.clientToolsVersion += 1
      },
      dispose() { disposals += 1 },
    }
  }
  const load = createLoader({
    'vue-router': { useRouter: () => ({}) },
    '@jetlinks-web-core/store/ai': { useAIStore: () => h.store },
    '@jetlinks-web-core/store/menu': { useMenuStore: () => menu },
    '@jetlinks-web-core/utils/project-runtime': {
      getProjectRuntimeConfig: () => ({ projectCode: project ? 'project' : '' }),
      getProjectIdFromLocation: () => '', isProjectRuntime: () => project,
      normalizeProjectRuntimePath: value => value,
    },
    './homeAgentCapabilities': {
      createHomeAgentRuntime: createRuntime, HOME_AGENT_CLIENT_ID: 'iotHome',
      HOME_AGENT_CAPABILITY_CHANGE_EVENT: 'capability-change',
    },
    './projectGeneralAgentRuntime': {
      createProjectGeneralAgentRuntime: createRuntime,
      createProjectBubbleParameters: runtime => runtime.parameters,
    },
    './generalAgentRuntime': { PROJECT_GENERAL_AGENT_CLIENT_ID: 'projectAiSearchHub', PROJECT_GENERAL_AGENT_SUBJECT_TYPE: 'project' },
    './generalAgentExtensionLoader': { loadGeneralAgentExtensions: () => loading },
    './routeCapabilityLoader': { loadHomeAgentCapabilityProviders: () => loading },
    './homeAgentConversationContext': {},
  })
  const app = renderer().createApp({ setup() {
    load(resolve(src, 'layout/components/AiChat/useGlobalHomeAgent.ts')).useGlobalHomeAgent(route)
    return () => null
  } })
  app.mount({ children: [] })
  let mounted = true
  const unmount = () => { if (mounted) { app.unmount(); mounted = false } }
  h.flush.onCleanup(unmount)
  return { ...h, route, menu, unmount, counts: () => ({ creations, disposals, refreshes }) }
}

for (const project of [true, false]) {
  test(`${project ? 'project' : 'home'} owner reuses one runtime and deployment across routes and menu replacements`, async t => {
    const h = globalHarness(t, { project })
    await h.flush()
    h.store.setDrawer(true)
    for (const page of ['b', 'c', 'd']) {
      Object.assign(h.route, { path: `/${page}`, fullPath: `/${page}`, name: page })
      await h.flush()
      assert.equal(h.store.parameters.currentView, page)
      assert.deepEqual(h.store.parameters.clientTools, [{ name: page }])
      assert.equal(h.store.showAiDrawer, true)
    }
    const before = h.counts().refreshes
    h.menu.siderMenus = [{ name: 'replacement' }]
    await h.flush()
    assert.ok(h.counts().refreshes > before)
    assert.equal(h.counts().creations, 1)
    assert.equal(h.counts().disposals, 0)
    assert.equal(h.queries(), 1)
  })
}

test('page-specific ownership and returning to the global assistant reuse the same runtime', async t => {
  const h = globalHarness(t)
  await h.flush()
  h.route.meta = { pageAgentClientId: 'page' }
  h.route.fullPath = '/device'
  await h.flush()
  assert.equal(h.store.pendingClientId, 'page')
  await h.store.queryAgent('page', { subjectId: 'device' })
  assert.equal(h.store.activeClientId, 'page')
  h.route.meta = {}
  h.route.fullPath = '/b'
  await h.flush()
  assert.equal(h.store.activeClientId, 'projectAiSearchHub')
  assert.equal(h.counts().creations, 1)
  assert.equal(h.counts().disposals, 0)
})

for (const project of [true, false]) {
  test(`${project ? 'project' : 'home'} assistant resumes when a page owner releases without navigation`, async t => {
    const h = globalHarness(t, { project })
    await h.flush()
    h.store.prepareAgentConversation('page', { subjectId: 'device' })
    await h.store.queryAgent('page', { subjectId: 'device' })
    await h.flush()
    h.store.releaseAgentConversation('page')
    await h.flush()
    assert.equal(h.store.activeClientId, project ? 'projectAiSearchHub' : 'iotHome')
    assert.equal(h.counts().creations, 1)
  })

  test(`${project ? 'project' : 'home'} deployment responses are discarded after layout unmount`, async t => {
    const result = deferred()
    const h = globalHarness(t, { project, queryAgentList: () => result.promise })
    await h.flush()
    assert.equal(h.queries(), 1)
    h.unmount()
    result.resolve({ success: true, result: [{ agentId: 'late-agent' }] })
    await h.flush()
    assert.equal(h.store.showAiButton, false)
    assert.equal(h.counts().disposals, 1)
  })
}

test('capability loading cannot initialize a global assistant after the page has taken ownership', async t => {
  const loading = deferred()
  const h = globalHarness(t, { loading: loading.promise })
  await h.flush()
  h.route.meta = { pageAgentClientId: 'page' }
  loading.resolve()
  await h.flush()
  assert.equal(h.queries(), 0)
  assert.equal(h.store.pendingClientId, 'page')
})

test('unmount during capability loading cannot create a late runtime or deployment', async t => {
  const loading = deferred()
  const h = globalHarness(t, { loading: loading.promise })
  await h.flush()
  h.unmount()
  loading.resolve()
  await h.flush()
  assert.equal(h.queries(), 0)
  assert.equal(h.counts().creations, 0)
})

test('launcher and lazy drawer stay mounted across visibility and owner transitions', async t => {
  const h = storeHarness(t)
  let bubbleMounts = 0
  let drawerMounts = 0
  let drawerUnmounts = 0
  const load = createLoader({
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
    'vue-router': { useRoute: () => ({}) },
    '@jetlinks-web-core/store': { useAIStore: () => h.store },
    '@ant-design/icons-vue': { RobotOutlined: () => null },
    './agentHandoff': {
      hasPendingAiAgentHandoff: () => false,
      resolveAiAgentHandoffTarget: value => value,
      resolveAiAgentConversationHandoffKey: () => 'stable',
    },
    './useFloatingBubble': { useFloatingBubble() {
      bubbleMounts += 1
      return { bubbleRef: vue.ref(), bubbleStyle: vue.ref({}), isBubbleReady: vue.ref(true) }
    } },
    './AiChatDrawer.vue': { __esModule: true, default: vue.defineComponent({
      setup() {
        drawerMounts += 1
        vue.onBeforeUnmount(() => { drawerUnmounts += 1 })
        return () => vue.h('div')
      },
    }) },
  })
  const app = renderer().createApp(load(resolve(src, 'layout/components/AiChat/index.vue')).default)
  app.component('a-badge', { setup: (props, { slots }) => () => vue.h('span', slots.default?.()) })
  app.component('AIcon', () => null)
  app.mount({ children: [] })
  h.flush.onCleanup(() => app.unmount())
  assert.equal(drawerMounts, 0)
  await h.store.queryAgent('global', { subjectId: 'project' })
  h.store.setDrawer(true)
  await vue.nextTick()
  assert.equal(drawerMounts, 1)
  h.store.releaseAgentConversation('global')
  await vue.nextTick()
  await h.store.queryAgent('page', { subjectId: 'device' })
  h.store.setDrawer(true)
  await vue.nextTick()
  assert.equal(bubbleMounts, 1)
  assert.equal(drawerMounts, 1)
  assert.equal(drawerUnmounts, 0)
})

test('home and project runtimes refresh route-specific capabilities without freezing live getters', t => {
  environment(t)
  const route = vue.reactive({ name: 'a', path: '/a', fullPath: '/a' })
  let menus = [{ code: 'a', title: 'A', path: '/a' }, { code: 'b', title: 'B', path: '/b' }]
  let providerEnabled = true
  let toolVersion = 0
  const provider = {
    id: 'page',
    getClientTools: context => [{ id: `query_${context.currentView}`, name: `query_${context.currentView}` }],
    getSkillBindings: context => [{ bindingId: context.currentView }],
    getWorkflowGuides: context => [{ id: context.currentView }],
    getSystemPromptLines: context => [context.currentView],
  }
  const load = createLoader({
    '@jetlinks-web-core/locales': i18n,
    '@jetlinks-web-core/router': { __esModule: true, default: { currentRoute: vue.ref(route) } },
    '@jetlinks-web-core/store/menu': { useMenuStore: () => ({ siderMenus: menus }) },
    '@jetlinks-web-core/utils/project-runtime': { normalizeProjectRuntimePath: value => value },
    '@jetlinks-web-core/utils/project-storage': { getProjectStorage: () => ({ name: 'Project' }) },
    '@jetlinks-web-core/api/comm': {},
    './homeAgentRegistry': { homeAgentCapabilityRegistry: { getProviders: () => providerEnabled ? [provider] : [] } },
    './homeAgentBaseTools': { createHomeAgentBaseTools: () => [] },
    './homeAgentHandoff': { createHomeAgentMarkdownLinkHandler: () => () => {} },
    './generalAgentExtensionLoader': { createGeneralAgentExtensionLoaderTool: () => ({ id: 'load' }) },
    './clientCapabilityLoader': { resolveClientCapabilityLoaderToolId: () => '' },
    './clientTools': {
      AI_CLIENT_TOOL_EVIDENCE_NARRATIVE_CONTRACT: 'evidence',
      createAiClientToolRuntime(source, options) {
        let tools = source()
        return {
          get clientTools() { return tools }, get clientToolsVersion() { return toolVersion },
          clientToolsName: options.toolsName, clientToolsDescription: options.toolsDescription,
          refreshClientTools() {
            const next = source()
            if (JSON.stringify(next) !== JSON.stringify(tools)) toolVersion += 1
            tools = next
          },
          subscribeClientTools: () => () => {}, dispose: () => {},
          handleClientToolCall: async call => tools.some(tool => tool.id === call.toolName),
        }
      },
    },
  })
  const runtime = load(resolve(src, 'layout/components/AiChat/projectGeneralAgentRuntime.ts')).createProjectGeneralAgentRuntime({
    route, projectId: 'project', menus: () => menus, router: { push: () => {} },
  })
  const handler = runtime.handleClientToolCall
  assert.equal(runtime.parameters.sessionClientId, 'projectAiSearchHub:project')
  Object.assign(route, { name: 'b', path: '/b', fullPath: '/b' })
  runtime.refreshContext()
  assert.equal(runtime.handleClientToolCall, handler)
  assert.equal(runtime.clientToolsVersion, 1)
  assert.ok(runtime.clientTools.some(tool => tool.id === 'query_b'))
  assert.ok(!runtime.clientTools.some(tool => tool.id === 'query_a'))
  assert.equal(runtime.parameters.currentView, 'b')
  assert.deepEqual(runtime.parameters.workflowGuides, [{ id: 'b' }])
  assert.deepEqual(runtime.skillBindings, [{ bindingId: 'b' }])
  assert.match(runtime.parameters.systemPrompt, /\nb$/)
  runtime.refreshContext()
  assert.equal(runtime.clientToolsVersion, 1)
  menus = [{ code: 'c', title: 'C', path: '/c' }]
  providerEnabled = false
  runtime.refreshContext()
  assert.ok(!runtime.clientTools.some(tool => tool.id === 'query_b'))
  assert.equal(runtime.getContext().findMenu('b'), undefined)
  assert.ok(runtime.getContext().findMenu('c'))
  assert.deepEqual(runtime.parameters.workflowGuides, [])
  assert.deepEqual(runtime.skillBindings, [])
})

test('drawer identity changes only for agent, client, subject or explicit conversation identity', () => {
  const source = readFileSync(resolve(src, 'layout/components/AiChat/AiChatDrawer.vue'), 'utf8')
  const match = source.match(/const conversationKey = (computed\([\s\S]*?\)\));/)
  assert.ok(match)
  const fields = {
    activeAgent: vue.ref({ agentId: 'agent', clientType: 'pagePoint' }),
    conversationClientId: vue.ref('global'), conversationSubject: vue.ref({ type: 'project', id: 'p1' }),
    conversationIdentityKey: vue.ref('identity'),
    conversationClientToolsName: vue.ref('tools-a'), conversationWorkflowGuides: vue.ref([]),
    conversationSystemPrompt: vue.ref('prompt-a'),
  }
  const key = new Function('computed', ...Object.keys(fields), `return ${match[1]}`)(vue.computed, ...Object.values(fields))
  const initial = key.value
  fields.conversationClientToolsName.value = 'tools-b'
  fields.conversationWorkflowGuides.value = [{ id: 'new' }]
  fields.conversationSystemPrompt.value = 'prompt-b'
  assert.equal(key.value, initial)
  fields.conversationSubject.value = { type: 'project', id: 'p2' }
  assert.notEqual(key.value, initial)
})
