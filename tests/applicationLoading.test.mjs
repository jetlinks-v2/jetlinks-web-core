import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as vue from 'vue';
import { createPinia, setActivePinia } from 'pinia';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const require = createRequire(import.meta.url);
const dynamicRemoteSource = require.resolve('@jetlinks-web/vite/dist/dynamic-remote');
const item = (id, path = `https://${id}.example.com/`) => ({ id, name: id, path });
const response = result => ({ success: true, result });
const provider = name => ({ default: { agentConversationProviders: {
  surface: { components: { access: { name: `${name}Access` }, conversation: { name: `${name}Conversation` } } },
} } });

function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolve, rejectPromise) => { resolvePromise = resolve; reject = rejectPromise; });
  return { promise, resolve: resolvePromise, reject };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
}

// Store, registry, loader, hook, startup and runtime entry resolution are production code.
function environment(t, {
  env = {}, isSubApp = false, businessRuntime = false,
  applicationScope = businessRuntime ? 'application-42' : undefined,
} = {}) {
  const calls = { lists: [], remotes: [], added: [], errors: [], businessInitializations: 0, menuScopes: [], titleChanges: [] };
  const remotes = new Map();
  const cache = new Map();
  const mounts = [];
  const runtimeEnv = {
    ...(businessRuntime ? { VITE_APP_RUNTIME_SCOPE: 'project', VITE_APP_PROJECT_CODE: 'project-42' } : {}),
    ...env,
  };
  const location = new URL(businessRuntime ? 'https://platform.example.com/project-42/#/overview' : 'https://platform.example.com/');
  if (applicationScope) location.hash += `?applicationScope=${encodeURIComponent(applicationScope)}`;
  const localStorage = memoryStorage();
  const window = {
    __MICRO_APP_ENVIRONMENT__: isSubApp, location, localStorage, sessionStorage: memoryStorage(),
    microApp: { getGlobalData: () => ({}) },
  };
  const state = {
    query: async () => response([item('provider')]),
    remote: async () => provider('Loaded'),
    add: async () => undefined,
    initializeBusiness: async () => {
      businessApplication.currentApplication = { id: 'application-42', name: 'Application 42' };
      businessApplication.initialized = true;
      return businessApplication.currentApplication;
    },
    queryMenus: async () => ({ applied: true, firstMenuPath: '/overview' }),
  };
  const businessApplication = {
    initialized: false,
    scopeSupported: true,
    currentApplication: undefined,
    async initialize() {
      calls.businessInitializations += 1;
      return state.initializeBusiness();
    },
  };
  const system = {
    layout: { title: 'Project' },
    isSessionInitializedFor: () => true,
    changeTitle: title => { calls.titleChanges.push(title); },
  };
  const menu = {
    initialized: false,
    async queryMenus(scope) {
      calls.menuScopes.push(scope);
      const result = await state.queryMenus(scope);
      menu.initialized = true;
      return result;
    },
  };
  const federation = {
    async __federation_method_add_origin_setRemote(name, url) {
      calls.added.push({ name, url });
      await state.add(name, url);
      remotes.set(name, url);
    },
    async __federation_method_getRemote(name, moduleId) {
      const url = remotes.get(name);
      calls.remotes.push({ moduleId, url });
      return state.remote(moduleId, url);
    },
  };
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename);
    const exports = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      transformers: { before: [context => tree => {
        const visit = node => ts.isPropertyAccessExpression(node) && node.name.text === 'env' && ts.isMetaProperty(node.expression)
          ? context.factory.createIdentifier('importMetaEnv')
          : ts.visitEachChild(node, visit, context);
        return ts.visitNode(tree, visit);
      }] },
    }).outputText;
    new Function('require', 'exports', 'window', 'localStorage', 'importMetaEnv', 'console', code)(id => {
      if (id === '@jetlinks-web-core/store') return {
        useApplication: () => application,
        useUserStore: () => ({ userInfo: { id: 'user-42' } }),
        useSystemStore: () => system,
        useBusinessApplicationStore: () => businessApplication,
        useMenuStore: () => menu,
      };
      if (id === '@jetlinks-web/utils') return { getToken: () => localStorage.getItem(runtimeEnv.VITE_TOKEN_KEY) };
      if (id === '@jetlinks-web/core') return { request: { get: async url => {
        assert.equal(url, '/system/resources/ui');
        calls.lists.push(url);
        return state.query();
      } } };
      if (id === 'virtual:__federation__') return federation;
      if (id === '@jetlinks-web/vite/dist/dynamic-remote') return load(dynamicRemoteSource);
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) {
        const entry = require.resolve(id);
        // TypeScript package entry points use the same transpiler, not Node's type stripping.
        return entry.endsWith('.ts') ? load(entry) : require(id);
      }
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(src, id.slice('@jetlinks-web-core/'.length));
      return load(existsSync(`${base}.ts`) ? `${base}.ts` : existsSync(resolve(base, 'index.ts')) ? resolve(base, 'index.ts') : base);
    }, exports, window, localStorage, runtimeEnv, { ...console, error: (...args) => calls.errors.push(args) });
    return exports;
  };
  const pinia = createPinia();
  setActivePinia(pinia);
  const application = load(resolve(src, 'store/application.ts')).useApplication(pinia);
  const registry = load(resolve(src, 'utils/module-registry.ts')).moduleRegistry;
  const hook = load(resolve(src, 'layout/components/AiChat/useAgentConversationComponent.ts')).useAgentConversationComponent;
  const mount = (kind = 'access') => {
    let host;
    const renderer = vue.createRenderer({
      createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
      setText() {}, setElementText() {}, patchProp() {}, insert() {}, remove() {},
      parentNode: () => null, nextSibling: () => null,
    });
    const app = renderer.createApp({ setup() { host = hook(kind, { autoLoad: false }); return () => null; } });
    app.use(pinia);
    app.mount({});
    mounts.push(app);
    return host;
  };
  t.after(() => mounts.forEach(app => app.unmount()));
  const startup = () => load(resolve(src, 'router/startup.ts'));
  const runtime = () => load(resolve(src, 'utils/project-runtime.ts'));
  const scope = load(resolve(src, 'utils/application-scope.ts'));
  return { state, calls, application, registry, mount, startup, runtime, scope, businessApplication, system };
}

for (const failureKind of ['HTTP', 'remote']) {
  test(`bootstrap degrades ${failureKind} discovery failure while preserving business scope and generic rejection`, async t => {
    const e = environment(t, { env: { VITE_MICRO_APP: 'true' }, businessRuntime: true });
    const pending = deferred();
    const started = deferred();
    const failure = new Error(`${failureKind} unavailable`);
    if (failureKind === 'HTTP') {
      e.state.query = () => { started.resolve(); return pending.promise; };
    } else {
      e.state.remote = () => { started.resolve(); return pending.promise; };
    }
    const startup = e.startup();
    const bootstrap = startup.bootstrapSession();
    await started.promise;
    const genericRejection = assert.rejects(e.application.queryApplication(), error => error === failure);
    const host = e.mount();
    const discovery = host.loadAgentConversationComponent();
    await Promise.resolve();
    pending.reject(failure);
    await Promise.all([bootstrap, genericRejection, discovery]);
    assert.equal(e.calls.lists.length, 1);
    assert.equal(e.calls.businessInitializations, 1);
    assert.equal(host.conversationComponentError.value, failure);
    assert.equal(e.calls.errors.length, 1, 'store reports discovery failure once');
    assert.deepEqual(e.application.appList, failureKind === 'HTTP' ? [] : [item('provider')]);
    assert.equal(e.registry.hasModule('provider-ui'), false);
    assert.equal(e.application.findAppById('provider')?.path, failureKind === 'HTTP' ? undefined : item('provider').path);
    assert.equal(await startup.ensureMenuRoutes({ hasRoute: () => true }, false), true);
    assert.deepEqual(e.calls.menuScopes, ['application-42']);

    e.state.query = async () => response([item('provider')]);
    e.state.remote = async () => provider('Recovered');
    await e.application.queryApplication();
    assert.equal(e.calls.lists.length, 2);
    assert.equal(e.registry.hasModule('provider-ui'), true);
    assert.equal((await host.loadAgentConversationComponent()).name, 'RecoveredAccess');
    assert.equal(host.conversationComponentError.value, undefined);
  });
}

test('successful bootstrap completes module loading before business initialization and scoped menus', async t => {
  const e = environment(t, { env: { VITE_MICRO_APP: 'true' }, businessRuntime: true });
  const initializeBusiness = e.state.initializeBusiness;
  e.state.initializeBusiness = async () => {
    assert.equal(e.registry.hasModule('provider-ui'), true);
    assert.deepEqual(e.application.appList.map(app => app.id), ['provider']);
    return initializeBusiness();
  };
  const startup = e.startup();
  await startup.bootstrapSession();
  assert.deepEqual(e.runtime().getApplicationRuntimeEntry(), { type: 'application', applicationId: 'application-42' });
  assert.equal(e.businessApplication.initialized, true);
  assert.equal(e.system.layout.title, 'Application 42');
  assert.deepEqual(e.calls.titleChanges, ['Application 42']);
  assert.equal(e.calls.businessInitializations, 1);
  assert.equal(e.calls.errors.length, 0);
  assert.equal(await startup.ensureMenuRoutes({ hasRoute: () => true }, false), true);
  assert.deepEqual(e.calls.menuScopes, ['application-42']);
  await e.application.queryApplication();
  assert.equal(e.calls.lists.length, 1);
});

for (const discoveryFails of [false, true]) {
  test(`business initialization failures still reject bootstrap when discovery ${discoveryFails ? 'fails' : 'succeeds'}`, async t => {
    const e = environment(t, { env: { VITE_MICRO_APP: 'true' }, businessRuntime: true });
    if (discoveryFails) e.state.remote = async () => { throw new Error('remote unavailable'); };
    const businessFailure = new Error('business scope initialization failed');
    e.state.initializeBusiness = async () => { throw businessFailure; };
    await assert.rejects(e.startup().bootstrapSession(), error => error === businessFailure);
    assert.equal(e.calls.businessInitializations, 1);
    assert.equal(e.calls.errors.length, discoveryFails ? 1 : 0);
    assert.deepEqual(e.calls.menuScopes, []);
  });
}

for (const discoveryFails of [false, true]) {
  test(`application entry unavailability still rejects bootstrap when discovery ${discoveryFails ? 'fails' : 'succeeds'}`, async t => {
    const e = environment(t, { env: { VITE_MICRO_APP: 'true' }, businessRuntime: true });
    if (discoveryFails) e.state.remote = async () => { throw new Error('remote unavailable'); };
    const entryFailure = new e.scope.ApplicationEntryUnavailableError();
    e.state.initializeBusiness = async () => { throw entryFailure; };
    const startup = e.startup();
    await assert.rejects(startup.bootstrapSession(), error => error === entryFailure);
    assert.deepEqual(e.runtime().getApplicationRuntimeEntry(), { type: 'application', applicationId: 'application-42' });
    assert.equal(e.businessApplication.initialized, false);
    assert.equal(e.businessApplication.currentApplication, undefined);
    assert.equal(e.calls.businessInitializations, 1);
    assert.equal(e.calls.errors.length, discoveryFails ? 1 : 0);
    assert.equal(e.system.layout.title, 'Project');
    assert.deepEqual(e.calls.titleChanges, []);
    await assert.rejects(startup.ensureMenuRoutes({ hasRoute: () => true }, false), e.scope.ApplicationEntryUnavailableError);
    assert.deepEqual(e.calls.menuScopes, []);
  });
}

for (const [name, invalidState] of [
  ['uninitialized', { initialized: false }],
  ['unsupported', { scopeSupported: false }],
  ['mismatched', { currentApplication: { id: 'other-application' } }],
]) {
  test(`application menu entry rejects ${name} scope and retries only after the requested entry is available`, async t => {
    const e = environment(t, { businessRuntime: true });
    const startup = e.startup();
    await startup.bootstrapSession();
    const selected = e.businessApplication.currentApplication;
    Object.assign(e.businessApplication, invalidState);
    await assert.rejects(startup.ensureMenuRoutes({ hasRoute: () => true }, false), e.scope.ApplicationEntryUnavailableError);
    assert.deepEqual(e.calls.menuScopes, []);
    Object.assign(e.businessApplication, { initialized: true, scopeSupported: true, currentApplication: selected });
    assert.equal(await startup.ensureMenuRoutes({ hasRoute: () => true }, false), true);
    assert.deepEqual(e.calls.menuScopes, ['application-42']);
  });
}

test('an applied application menu without an accessible first route rejects the application entry', async t => {
  const e = environment(t, { businessRuntime: true });
  const startup = e.startup();
  await startup.bootstrapSession();
  e.state.queryMenus = async () => ({ applied: true });
  const routes = [];
  await assert.rejects(startup.ensureMenuRoutes({ hasRoute: () => false, addRoute: route => routes.push(route) }, false), e.scope.ApplicationEntryUnavailableError);
  assert.deepEqual(e.calls.menuScopes, ['application-42']);
  assert.deepEqual(routes, []);
});

test('project entry disables application menu scope even when a selected application is retained', async t => {
  const e = environment(t, { businessRuntime: true, applicationScope: null });
  const startup = e.startup();
  await startup.bootstrapSession();
  assert.deepEqual(e.runtime().getApplicationRuntimeEntry(), { type: 'project' });
  assert.equal(e.businessApplication.currentApplication.id, 'application-42');
  assert.equal(e.calls.businessInitializations, 1);
  assert.equal(e.system.layout.title, 'Project');
  assert.deepEqual(e.calls.titleChanges, []);
  assert.equal(await startup.ensureMenuRoutes({ hasRoute: () => true }, false), true);
  assert.deepEqual(e.calls.menuScopes, [false]);
});

for (const discoveryFails of [false, true]) {
  test(`non-business bootstrap skips business initialization when discovery ${discoveryFails ? 'fails' : 'succeeds'}`, async t => {
    const e = environment(t, { env: { VITE_MICRO_APP: 'true' } });
    if (discoveryFails) e.state.remote = async () => { throw new Error('remote unavailable'); };
    const startup = e.startup();
    await startup.bootstrapSession();
    assert.equal(e.calls.businessInitializations, 0);
    assert.equal(e.calls.errors.length, discoveryFails ? 1 : 0);
    assert.equal(await startup.ensureMenuRoutes({ hasRoute: () => true }, false), true);
    assert.deepEqual(e.calls.menuScopes, [false]);
  });
}

test('real platform failure reaches the hook and recovery retries the failed remote', async t => {
  const e = environment(t);
  const failure = new Error('remote entry unavailable');
  e.state.remote = async () => { throw failure; };
  const host = e.mount();
  const first = host.loadAgentConversationComponent();
  assert.equal(host.conversationComponentLoading.value, true);
  assert.equal(await first, undefined);
  assert.equal(host.conversationComponentLoading.value, false);
  assert.equal(host.conversationComponentError.value, failure);
  assert.deepEqual(e.application.appList, [item('provider')]);
  assert.deepEqual(e.application.findAppById('provider'), item('provider'));
  assert.equal(e.registry.hasModule('provider-ui'), false);

  e.state.remote = async () => provider('Recovered');
  const retry = host.loadAgentConversationComponent();
  assert.equal(host.conversationComponentError.value, undefined);
  assert.equal(host.conversationComponentLoading.value, true);
  assert.equal((await retry).name, 'RecoveredAccess');
  assert.equal(host.conversationComponentLoading.value, false);
  assert.equal(host.conversationComponentError.value, undefined);
  assert.equal(e.calls.lists.length, 2);
  assert.equal(e.calls.remotes.length, 2);
});

test('HTTP and unsuccessful application responses remain observable and retryable', async t => {
  const e = environment(t);
  const failure = new Error('HTTP unavailable');
  e.state.query = async () => { throw failure; };
  await assert.rejects(e.application.queryApplication(), error => error === failure);
  e.state.query = async () => ({ success: false, message: 'applications unavailable' });
  await assert.rejects(e.application.queryApplication(), /applications unavailable/);
  e.state.query = async () => response([]);
  await e.application.queryApplication();
  await e.application.queryApplication();
  assert.equal(e.calls.lists.length, 3);
  assert.equal(e.calls.errors.length, 2);
  assert.equal(e.calls.remotes.length, 0);
});

test('bootstrap and concurrent hosts wait for the same real remote load and cache only completion', async t => {
  const e = environment(t);
  const remote = deferred();
  const started = deferred();
  e.state.remote = () => { started.resolve(); return remote.promise; };
  const bootstrap = e.application.queryApplication();
  await started.promise;
  const access = e.mount();
  const conversation = e.mount('conversation');
  const first = access.loadAgentConversationComponent();
  assert.equal(access.loadAgentConversationComponent(), first);
  const second = conversation.loadAgentConversationComponent();
  let settled = false;
  first.then(() => { settled = true; });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(e.calls.lists.length, 1);
  assert.equal(e.calls.remotes.length, 1);
  assert.equal(settled, false);
  assert.equal(access.conversationComponentLoading.value, true);
  assert.equal(conversation.conversationComponentLoading.value, true);
  remote.resolve(provider('Loaded'));
  await Promise.all([bootstrap, first, second]);
  assert.equal(access.conversationComponent.value.name, 'LoadedAccess');
  assert.equal(conversation.conversationComponent.value.name, 'LoadedConversation');
  assert.equal(access.conversationComponentLoading.value, false);
  assert.equal(conversation.conversationComponentLoading.value, false);
  await e.application.queryApplication();
  await access.loadAgentConversationComponent();
  assert.equal(e.calls.lists.length, 1);
  assert.equal(e.calls.remotes.length, 1);
});

test('concurrent discovery before the HTTP response issues one application request', async t => {
  const e = environment(t);
  const request = deferred();
  e.state.query = () => request.promise;
  const queries = [e.application.queryApplication(), e.application.queryApplication(), e.application.queryApplication()];
  assert.equal(e.calls.lists.length, 1);
  request.resolve(response([item('provider')]));
  await Promise.all(queries);
  assert.equal(e.calls.remotes.length, 1);
});

test('retry skips every registered module, including successes after a failed module', async t => {
  const e = environment(t);
  e.state.query = async () => response([item('first'), item('second'), item('provider')]);
  let failing = true;
  e.state.remote = async moduleId => {
    if (moduleId === 'second-ui' && failing) throw new Error('second remote unavailable');
    return moduleId === 'provider-ui' ? provider('Loaded') : { default: { utils: { loaded: moduleId } } };
  };
  await assert.rejects(e.application.queryApplication(), /second remote unavailable/);
  const first = e.registry.getModule('first-ui');
  assert.ok(first);
  assert.equal(e.registry.hasModule('second-ui'), false);
  const installedProvider = e.registry.getModule('provider-ui');
  assert.ok(installedProvider);
  assert.deepEqual(e.application.appList.map(app => app.id), ['first', 'second', 'provider']);
  failing = false;
  await e.application.queryApplication();
  assert.equal(e.registry.getModule('first-ui'), first);
  assert.equal(e.registry.getModule('provider-ui'), installedProvider);
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), ['first-ui', 'second-ui', 'provider-ui', 'second-ui']);
  assert.deepEqual(e.application.appList.map(app => app.id), ['first', 'second', 'provider']);
});

for (const ids of [
  ['broken-business', 'conversation-provider'],
  ['conversation-provider', 'broken-business'],
]) {
  test(`permanent remote failure preserves healthy conversation providers in order ${ids.join(' -> ')}`, async t => {
    const e = environment(t);
    const request = deferred();
    const failure = new Error('business remote permanently unavailable');
    e.state.query = () => request.promise;
    e.state.remote = async (moduleId, url) => {
      assert.equal(url, `${item(moduleId.slice(0, -3)).path}assets/remoteEntry.js`);
      if (moduleId === 'broken-business-ui') throw failure;
      return provider('Healthy');
    };
    const generic = e.application.queryApplication();
    const joined = e.application.queryApplication();
    const rejection = Promise.all([generic, joined].map(loading => assert.rejects(loading, error => error === failure)));
    const access = e.mount();
    const conversation = e.mount('conversation');
    const first = access.loadAgentConversationComponent();
    assert.equal(access.loadAgentConversationComponent(), first);
    const second = conversation.loadAgentConversationComponent();
    await Promise.resolve();
    request.resolve(response(ids.map(id => item(id))));
    const [, accessComponent, conversationComponent] = await Promise.all([rejection, first, second]);
    assert.deepEqual(e.calls.remotes.map(call => call.moduleId), ids.map(id => `${id}-ui`));
    assert.equal(accessComponent?.name, 'HealthyAccess');
    assert.equal(conversationComponent?.name, 'HealthyConversation');
    assert.equal(access.conversationComponent.value, accessComponent);
    assert.equal(conversation.conversationComponent.value, conversationComponent);
    assert.equal(access.conversationComponentError.value, undefined);
    assert.equal(conversation.conversationComponentError.value, undefined);
    assert.equal(access.conversationComponentLoading.value, false);
    assert.equal(conversation.conversationComponentLoading.value, false);
    assert.equal(e.registry.hasModule('broken-business-ui'), false);
    assert.equal(e.registry.hasModule('conversation-provider-ui'), true);
    assert.deepEqual(e.application.appList.map(app => app.id), ids);
    assert.equal(e.calls.lists.length, 1);
    assert.equal(e.calls.errors.length, 1);

    const installedProvider = e.registry.getModule('conversation-provider-ui');
    await assert.rejects(e.application.queryApplication(), error => error === failure);
    assert.equal(e.registry.getModule('conversation-provider-ui'), installedProvider);
    assert.deepEqual(e.calls.remotes.map(call => call.moduleId), [...ids.map(id => `${id}-ui`), 'broken-business-ui']);
    assert.equal(await access.loadAgentConversationComponent(), accessComponent);
    assert.equal(await conversation.loadAgentConversationComponent(), conversationComponent);
    assert.equal(e.calls.lists.length, 2);
    assert.equal(e.calls.errors.length, 2);
  });
}

test('multiple permanent failures retain discovery, load every healthy module sequentially and remain retryable', async t => {
  const e = environment(t);
  const ids = ['broken-first', 'healthy-first', 'broken-second', 'healthy-last'];
  const failures = new Map([
    ['broken-first-ui', new Error('first remote permanently unavailable')],
    ['broken-second-ui', new Error('second remote permanently unavailable')],
  ]);
  const firstFailure = failures.get('broken-first-ui');
  let activeLoads = 0, maxActiveLoads = 0;
  e.state.query = async () => response(ids.map(id => item(id)));
  e.state.remote = async (moduleId, url) => {
    activeLoads += 1;
    maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
    try {
      assert.equal(url, `${item(moduleId.slice(0, -3)).path}assets/remoteEntry.js`);
      await Promise.resolve();
      if (failures.has(moduleId)) throw failures.get(moduleId);
      return { default: { utils: { loaded: moduleId } } };
    } finally {
      activeLoads -= 1;
    }
  };
  await assert.rejects(e.application.queryApplication(), error => error === firstFailure);
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), ids.map(id => `${id}-ui`));
  assert.deepEqual(e.application.appList.map(app => app.id), ids);
  const installed = ids.filter(id => id.startsWith('healthy')).map(id => e.registry.getModule(`${id}-ui`));
  assert.ok(installed.every(Boolean));
  assert.equal(e.registry.hasModule('broken-first-ui'), false);
  assert.equal(e.registry.hasModule('broken-second-ui'), false);
  assert.equal(e.application.findAppById('broken-second').path, item('broken-second').path);
  await assert.rejects(e.application.queryApplication(), error => error === firstFailure);
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), [
    ...ids.map(id => `${id}-ui`), 'broken-first-ui', 'broken-second-ui',
  ]);
  failures.clear();
  await e.application.queryApplication();
  await e.application.queryApplication();
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), [
    ...ids.map(id => `${id}-ui`), 'broken-first-ui', 'broken-second-ui', 'broken-first-ui', 'broken-second-ui',
  ]);
  assert.equal(e.registry.getModule('healthy-first-ui'), installed[0]);
  assert.equal(e.registry.getModule('healthy-last-ui'), installed[1]);
  assert.equal(maxActiveLoads, 1);
  assert.equal(e.calls.lists.length, 3);
  assert.equal(e.calls.errors.length, 2);
});

test('discovered applications are available while remote loading is pending and after it fails', async t => {
  const e = environment(t);
  const remote = deferred();
  const started = deferred();
  const failure = new Error('remote unavailable');
  const discovered = { ...item('provider', '  '), version: '1.2.3', page: { baseUrl: '/provider/' } };
  const normalized = { ...discovered, path: 'https://platform.example.com/provider' };
  e.state.query = async () => response([discovered]);
  e.state.remote = () => { started.resolve(); return remote.promise; };
  const loading = e.application.queryApplication();
  const rejection = assert.rejects(loading, error => error === failure);
  await started.promise;
  try {
    assert.deepEqual(e.application.appList, [normalized]);
    assert.deepEqual(e.application.findAppById('provider'), normalized);
    assert.equal(e.registry.hasModule('provider-ui'), false);
  } finally {
    remote.reject(failure);
    await rejection;
  }
  assert.deepEqual(e.application.appList, [normalized]);
  assert.equal(e.registry.hasModule('provider-ui'), false);
});

for (const completion of ['success', 'failure']) {
  for (const finalProvider of ['replacement', 'removed']) {
    test(`hook reconciles the ${finalProvider} provider at platform ${completion} completion`, async t => {
      const e = environment(t);
      const remote = deferred();
      const started = deferred();
      const failure = new Error('unrelated business module unavailable');
      e.state.query = async () => response([item('conversation-provider'), item('business')]);
      e.state.remote = moduleId => {
        if (moduleId === 'conversation-provider-ui') return provider('Original');
        started.resolve();
        return remote.promise;
      };
      const host = e.mount();
      const loading = host.loadAgentConversationComponent();
      await started.promise;
      assert.equal(host.conversationComponent.value.name, 'OriginalAccess');
      const generic = e.application.queryApplication();
      const observed = completion === 'failure' ? assert.rejects(generic, error => error === failure) : generic;
      if (finalProvider === 'replacement') {
        e.registry.register('conversation-provider-ui', provider('Replacement').default, { override: true });
      } else {
        e.registry.unregister('conversation-provider-ui');
      }
      const current = host.conversationComponent.value;
      if (completion === 'failure') remote.reject(failure);
      else remote.resolve({ default: { utils: { loaded: true } } });
      await observed;
      assert.equal(await loading, current);
      assert.equal(host.conversationComponent.value, current);
      assert.equal(current?.name, finalProvider === 'replacement' ? 'ReplacementAccess' : undefined);
      assert.equal(host.conversationComponentError.value, completion === 'failure' && finalProvider === 'removed' ? failure : undefined);
      assert.equal(host.conversationComponentLoading.value, false);
    });
  }
}

test('reset discards collected and late remote failures without releasing the current in-flight load', async t => {
  const e = environment(t);
  const oldRemote = deferred();
  const oldStarted = deferred();
  const newRemote = deferred();
  const newStarted = deferred();
  e.state.query = async () => response([item('broken-old'), item('stale'), item('never-load')]);
  e.state.remote = moduleId => {
    if (moduleId === 'broken-old-ui') throw new Error('old batch failure');
    if (moduleId === 'stale-ui') { oldStarted.resolve('started'); return oldRemote.promise; }
    newStarted.resolve();
    return newRemote.promise;
  };
  const oldLoad = e.application.queryApplication();
  const oldOutcome = oldLoad.then(() => 'completed', error => error);
  assert.equal(await Promise.race([oldStarted.promise, oldOutcome]), 'started');
  e.application.init();
  assert.deepEqual(e.application.appList, []);
  e.state.query = async () => response([item('provider')]);
  const newLoad = e.application.queryApplication();
  await newStarted.promise;
  const host = e.mount();
  const component = host.loadAgentConversationComponent();
  await Promise.resolve();
  oldRemote.reject(new Error('late obsolete remote failure'));
  assert.equal(await oldOutcome, 'completed');
  const joinedLoad = e.application.queryApplication();
  let joinedSettled = false;
  joinedLoad.then(() => { joinedSettled = true; });
  await Promise.resolve();
  assert.equal(joinedSettled, false);
  assert.equal(e.calls.errors.length, 0);
  assert.deepEqual(e.application.appList, [item('provider')]);
  assert.equal(e.registry.hasModule('stale-ui'), false);
  assert.equal(e.registry.hasModule('never-load-ui'), false);
  assert.equal(host.conversationComponentLoading.value, true);
  newRemote.resolve(provider('Current'));
  await Promise.all([newLoad, joinedLoad]);
  assert.equal((await component).name, 'CurrentAccess');
  assert.equal(host.conversationComponentError.value, undefined);
  assert.equal(host.conversationComponentLoading.value, false);
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), ['broken-old-ui', 'stale-ui', 'provider-ui']);
  assert.equal(e.calls.lists.length, 2);
});

test('installed modules, self-module filtering and fallback URLs retain existing discovery behavior', async t => {
  const e = environment(t, { env: { VITE_MODULE_NAME: 'self-ui' } });
  const installed = { utils: { value: 42 } };
  e.registry.register('installed-ui', installed);
  e.state.query = async () => response([item('self'), item('installed'), item('provider', '')]);
  await e.application.queryApplication();
  assert.deepEqual(e.application.appList.map(app => app.id), ['installed', 'provider']);
  assert.equal(e.registry.getModule('installed-ui').utils, installed.utils);
  assert.deepEqual(e.calls.remotes, [{ moduleId: 'provider-ui', url: 'https://platform.example.com/provider/assets/remoteEntry.js' }]);
});

test('sub-app discovery retains its own application instead of applying standalone self filtering', async t => {
  const e = environment(t, { env: { VITE_MODULE_NAME: 'self-ui' }, isSubApp: true });
  e.state.query = async () => response([item('self')]);
  await e.application.queryApplication();
  assert.deepEqual(e.application.appList.map(app => app.id), ['self']);
  assert.equal(e.calls.remotes[0].moduleId, 'self-ui');
});

test('reset ignores a late old application list and preserves the new in-flight promise', async t => {
  const e = environment(t);
  const oldRequest = deferred();
  const newRequest = deferred();
  e.state.query = () => e.calls.lists.length === 1 ? oldRequest.promise : newRequest.promise;
  const oldLoad = e.application.queryApplication();
  e.application.init();
  const newLoad = e.application.queryApplication();
  oldRequest.resolve(response([item('stale')]));
  await oldLoad;
  const joinedLoad = e.application.queryApplication();
  assert.equal(e.calls.lists.length, 2);
  assert.equal(e.calls.remotes.length, 0);
  newRequest.resolve(response([item('provider')]));
  await Promise.all([newLoad, joinedLoad]);
  assert.deepEqual(e.application.appList.map(app => app.id), ['provider']);
  assert.equal(e.registry.hasModule('stale-ui'), false);
  await e.application.queryApplication();
  assert.equal(e.calls.lists.length, 2);
});

test('reset suppresses an old HTTP failure without hiding failures in the new context', async t => {
  const e = environment(t);
  const oldRequest = deferred();
  const newRequest = deferred();
  e.state.query = () => e.calls.lists.length === 1 ? oldRequest.promise : newRequest.promise;
  const oldLoad = e.application.queryApplication();
  e.application.init();
  const newLoad = e.application.queryApplication();
  oldRequest.reject(new Error('obsolete request failed'));
  await oldLoad;
  assert.equal(e.calls.errors.length, 0);
  const joinedLoad = e.application.queryApplication();
  const failures = [assert.rejects(newLoad, /current request failed/), assert.rejects(joinedLoad, /current request failed/)];
  newRequest.reject(new Error('current request failed'));
  await Promise.all(failures);
  assert.equal(e.calls.errors.length, 1);
  e.state.query = async () => response([]);
  await e.application.queryApplication();
  assert.equal(e.calls.lists.length, 3);
});

test('reset during remote loading prevents old registration and further old-list loads', async t => {
  const e = environment(t);
  const oldRemote = deferred();
  const started = deferred();
  e.state.query = async () => response([item('stale'), item('never-load')]);
  e.state.remote = moduleId => {
    if (moduleId === 'stale-ui') { started.resolve(); return oldRemote.promise; }
    return provider('Current');
  };
  const oldLoad = e.application.queryApplication();
  await started.promise;
  e.application.init();
  e.state.query = async () => response([item('provider')]);
  await e.application.queryApplication();
  oldRemote.resolve(provider('Stale'));
  await oldLoad;
  assert.equal(e.registry.hasModule('stale-ui'), false);
  assert.equal(e.registry.hasModule('never-load-ui'), false);
  assert.deepEqual(e.application.appList.map(app => app.id), ['provider']);
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), ['stale-ui', 'provider-ui']);
  await e.application.queryApplication();
  assert.equal(e.calls.lists.length, 2);
});

test('reset during remote setup stops the obsolete component load after that async boundary', async t => {
  const e = environment(t);
  const setup = deferred();
  const started = deferred();
  e.state.query = async () => response([item('stale'), item('never-load')]);
  e.state.add = (name, url) => {
    if (url.includes('stale.example.com')) { started.resolve(); return setup.promise; }
  };
  const oldLoad = e.application.queryApplication();
  await started.promise;
  e.application.init();
  e.state.query = async () => response([item('provider')]);
  await e.application.queryApplication();
  setup.resolve();
  await oldLoad;
  assert.deepEqual(e.calls.remotes.map(call => call.moduleId), ['provider-ui']);
  assert.equal(e.registry.hasModule('stale-ui'), false);
  assert.equal(e.registry.hasModule('never-load-ui'), false);
  assert.deepEqual(e.application.appList.map(app => app.id), ['provider']);
});

test('an invalidated remote completion preserves resources another caller registered successfully', async t => {
  const e = environment(t);
  const remote = deferred();
  const started = deferred();
  e.state.remote = () => { started.resolve(); return remote.promise; };
  let current = true;
  const oldLoad = e.registry.loadRemoteModule('shared-ui', 'https://shared.example.com/assets/remoteEntry.js', () => current);
  await started.promise;
  current = false;
  e.registry.register('shared-ui', { utils: { value: 'current' } });
  const installed = e.registry.getModule('shared-ui');
  remote.resolve({ default: { utils: { value: 'obsolete' } } });
  await oldLoad;
  assert.equal(e.registry.getModule('shared-ui'), installed);
  assert.equal(installed.utils.value, 'current');
});

test('the optional registry guard skips invalidated calls and preserves the original two-argument API', async t => {
  const e = environment(t);
  const path = 'https://provider.example.com/assets/remoteEntry.js';
  await e.registry.loadRemoteModule('cancelled-ui', path, () => false);
  assert.equal(e.calls.added.length, 0);
  assert.equal(e.registry.hasModule('cancelled-ui'), false);
  await e.registry.loadRemoteModule('provider-ui', path);
  assert.equal(e.calls.added.length, 1);
  assert.equal(e.registry.hasModule('provider-ui'), true);
});
