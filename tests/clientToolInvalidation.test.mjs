import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as vue from 'vue';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const conversation = fileURLToPath(new URL('../../modules/jetlinks-ai-agent-ui/components/AgentConversation/', import.meta.url));
const require = createRequire(import.meta.url);
let locale = '';
globalThis.window ??= new EventTarget();
globalThis.CustomEvent ??= class extends Event {};
const router = { currentRoute: vue.ref({ name: 'test', path: '/test', fullPath: '/test' }) };
const cache = new Map();
const load = filename => {
  if (cache.has(filename)) return cache.get(filename);
  const exports = {};
  cache.set(filename, exports);
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', '{}');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'exports', code)(id => {
    if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => `${locale}${key}` } } };
    if (id === '@jetlinks-web-core/utils/ai-client-tool-request') return { withAiClientToolSilentRequest: fn => fn() };
    if (id === '@jetlinks-web-core/router') return { __esModule: true, default: router };
    if (id === '@jetlinks-web-core/store/menu') return { useMenuStore: () => ({ siderMenus: [] }) };
    if (id === '@jetlinks-web-core/utils/project-storage') return { getProjectStorage: () => ({ name: 'Project' }) };
    if (id === '@jetlinks-web-core/utils/project-runtime') return { normalizeProjectRuntimePath: value => value };
    if (id === './useProjectGeneralAgentDeployment') return { createProjectGeneralAgentSessionClientId: id => `projectAiSearchHub:${id}` };
    if (id === './homeAgentCapabilities') return {
      ...load(resolve(src, 'layout/components/AiChat/homeAgentRuntime.ts')),
      ...load(resolve(src, 'layout/components/AiChat/homeAgentRegistry.ts')),
      ...load(resolve(src, 'layout/components/AiChat/homeAgentContracts.ts')),
    };
    if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id);
    const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(src, id.slice('@jetlinks-web-core/'.length));
    return load(existsSync(base) ? base : existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'));
  }, exports);
  return exports;
};
const core = name => load(resolve(src, `layout/components/AiChat/${name}.ts`));
const { createAiClientToolRuntime, defineAiClientToolFactory, createAiClientToolCatalogSnapshot } = core('clientTools');
const { createHomeAgentRuntime } = core('homeAgentRuntime');
const { createGeneralAgentRuntime } = core('generalAgentRuntime');
const { createProjectGeneralAgentRuntime } = core('projectGeneralAgentRuntime');
const { homeAgentCapabilityRegistry } = core('homeAgentRegistry');
const { HOME_AGENT_CAPABILITY_CHANGE_EVENT } = core('homeAgentContracts');
const { createClientToolInvalidationRefresh, decideInitContractRefresh } = load(resolve(conversation, 'initContractRefreshPolicy.ts'));
const { subscribeClientToolExecutionSignals } = load(resolve(conversation, 'clientToolCallLifecycle.ts'));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done });
  return { promise, resolve };
};
const runtimeKinds = ['home', 'general', 'project'];
const createRuntimeForKind = (kind, getMenus = () => []) => {
  const options = { contextAdapter: { getMenus }, extraTools: () => [{ id: 'extra_read', execute: () => ({ ok: true }) }] };
  return kind === 'home' ? createHomeAgentRuntime(options)
    : kind === 'general' ? createGeneralAgentRuntime(options)
      : createProjectGeneralAgentRuntime({ projectId: 'project', projectName: 'Project', route: router.currentRoute.value,
        router, menus: getMenus });
};

test('provider unregister and replacement immediately revoke pending approvals in every runtime', async t => {
  for (const kind of runtimeKinds) {
    for (const change of ['unregister', 'replace']) {
      await t.test(`${kind}: ${change}`, async t => {
        let writes = 0;
        const scope = kind === 'home' ? 'home' : 'general';
        const createProvider = () => ({ id: `pending-${kind}`, getClientTools: () => [
          { id: 'pending_write', confirm: true, execute: () => { writes += 1; return { ok: true } } },
        ] });
        const unregister = homeAgentCapabilityRegistry.register(createProvider(), scope);
        const runtime = createRuntimeForKind(kind);
        let unregisterReplacement;
        t.after(() => { runtime.dispose(); unregisterReplacement?.(); unregister() });
        const original = runtime.clientTools.find(tool => tool.id === 'pending_write')._meta.executionSignal;
        const version = runtime.clientToolsVersion;
        let publications = 0;
        const stop = runtime.subscribeClientTools(() => { publications += 1 });
        t.after(stop);
        const ready = deferred();
        const approval = deferred();
        const pending = runtime.handleClientToolCall({ id: 'pending', toolName: 'pending_write', requestConfirmation: () => {
          ready.resolve(); return approval.promise;
        } }).then(result => ({ result }), error => ({ error }));
        await ready.promise;
        if (change === 'unregister') unregister();
        else unregisterReplacement = homeAgentCapabilityRegistry.register(createProvider(), scope);
        // Capture the state before approval or any explicit context refresh can hide the gap.
        const abortedImmediately = original.aborted;
        approval.resolve({ approved: true });
        const outcome = await pending;
        assert.deepEqual({ abortedImmediately, writes, error: outcome.error?.name },
          { abortedImmediately: true, writes: 0, error: 'AbortError' });
        assert.equal(runtime.clientToolsVersion, version + 1);
        assert.equal(publications, 1);
        const latest = runtime.clientTools.find(tool => tool.id === 'pending_write');
        if (change === 'unregister') assert.equal(latest, undefined);
        else {
          assert.notEqual(latest._meta.executionSignal, original);
          assert.equal(latest._meta.executionSignal.aborted, false);
        }
      });
    }
  }
});

test('provider events retain unchanged bindings and are detached before runtime disposal', async t => {
  class CapabilityEventTarget extends EventTarget {
    listeners = new Set();
    addEventListener(type, listener, options) {
      if (type === HOME_AGENT_CAPABILITY_CHANGE_EVENT) this.listeners.add(listener);
      super.addEventListener(type, listener, options);
    }
    removeEventListener(type, listener, options) {
      if (type === HOME_AGENT_CAPABILITY_CHANGE_EVENT) this.listeners.delete(listener);
      super.removeEventListener(type, listener, options);
    }
  }
  for (const kind of runtimeKinds) {
    await t.test(kind, async t => {
      const previousWindow = globalThis.window;
      const target = new CapabilityEventTarget();
      globalThis.window = target;
      let builds = 0;
      let contextReads = 0;
      let writes = 0;
      const scope = kind === 'home' ? 'home' : 'general';
      const unregister = homeAgentCapabilityRegistry.register({ id: `retained-${kind}`, getClientTools: () => {
        builds += 1;
        return [{ id: 'retained_write', confirm: true, execute: () => { writes += 1; return { ok: true } } }];
      } }, scope);
      const runtime = createRuntimeForKind(kind, () => { contextReads += 1; return [] });
      let unregisterAdded;
      t.after(() => { runtime.dispose(); unregisterAdded?.(); unregister(); globalThis.window = previousWindow });
      const signals = new Map(runtime.clientTools.map(tool => [tool.id, tool._meta.executionSignal]));
      const version = runtime.clientToolsVersion;
      let publications = 0;
      const stop = runtime.subscribeClientTools(() => { publications += 1 });
      t.after(stop);
      assert.equal(target.listeners.size, 1);
      const [queuedListener] = target.listeners;
      const ready = deferred();
      const approval = deferred();
      const pending = runtime.handleClientToolCall({ id: 'retained', toolName: 'retained_write', requestConfirmation: () => {
        ready.resolve(); return approval.promise;
      } });
      await ready.promise;
      const buildsBeforeEvent = builds;
      target.dispatchEvent(new CustomEvent(HOME_AGENT_CAPABILITY_CHANGE_EVENT));
      assert.equal(builds, buildsBeforeEvent + 1, 'a no-op event still rebuilds localized declarations');
      assert.equal(runtime.clientToolsVersion, version);
      assert.equal(publications, 0);
      unregisterAdded = homeAgentCapabilityRegistry.register({ id: `added-${kind}`, getClientTools: () => [
        { id: 'added_read', execute: () => ({ ok: true }) },
      ] }, scope);
      assert.ok(runtime.clientTools.some(tool => tool.id === 'added_read'), 'pure additions publish immediately');
      assert.equal(runtime.clientToolsVersion, version + 1);
      assert.equal(publications, 1);
      for (const [id, signal] of signals) {
        assert.equal(signal.aborted, false, `${id} remains executable`);
        assert.equal(runtime.clientTools.find(tool => tool.id === id)._meta.executionSignal, signal);
      }
      approval.resolve({ approved: true });
      await pending;
      assert.equal(writes, 1, 'a retained pending approval survives pure additions');
      const disposeReady = deferred();
      const disposeApproval = deferred();
      const pendingDispose = runtime.handleClientToolCall({ id: 'disposed', toolName: 'retained_write', requestConfirmation: () => {
        disposeReady.resolve(); return disposeApproval.promise;
      } });
      const rejected = assert.rejects(pendingDispose, { name: 'AbortError' });
      await disposeReady.promise;
      let detachedBeforeAbort;
      signals.get('retained_write').addEventListener('abort', () => {
        detachedBeforeAbort = target.listeners.size === 0;
        target.dispatchEvent(new CustomEvent(HOME_AGENT_CAPABILITY_CHANGE_EVENT));
      });
      const buildsBeforeDispose = builds;
      const contextReadsBeforeDispose = contextReads;
      const versionBeforeDispose = runtime.clientToolsVersion;
      runtime.dispose();
      assert.equal(detachedBeforeAbort, true, 'detach before underlying disposal synchronously aborts tools');
      assert.equal(target.listeners.size, 0);
      assert.ok(runtime.clientTools.every(tool => tool._meta.executionSignal.aborted));
      // A previously captured callback and later events cannot revive a disposed runtime.
      queuedListener(new CustomEvent(HOME_AGENT_CAPABILITY_CHANGE_EVENT));
      homeAgentCapabilityRegistry.unregister('absent', scope);
      runtime.refreshContext();
      runtime.refreshClientTools();
      runtime.dispose();
      assert.equal(builds, buildsBeforeDispose);
      assert.equal(contextReads, contextReadsBeforeDispose);
      assert.equal(runtime.clientToolsVersion, versionBeforeDispose);
      assert.equal(publications, 1);
      disposeApproval.resolve({ approved: true });
      await rejected;
      assert.equal(writes, 1, 'disposal prevents the second late approval from executing');
    });
  }
});

test('factory rebuilds retain their trusted owner but replacement and schema drift revoke it', () => {
  const build = () => ({ id: 'factory_read', description: 'Read', execute: () => ({ ok: true }) });
  let factory = defineAiClientToolFactory('factory_read', build);
  const runtime = createAiClientToolRuntime(() => [factory], { includeHelpTool: false });
  const signal = runtime.clientTools[0]._meta.executionSignal;
  const version = runtime.clientToolsVersion;
  factory = defineAiClientToolFactory('factory_read', build);
  runtime.refreshClientTools();
  assert.equal(runtime.clientTools[0]._meta.executionSignal, signal);
  assert.equal(runtime.clientToolsVersion, version);
  factory = defineAiClientToolFactory('factory_read', () => build());
  runtime.refreshClientTools();
  assert.equal(signal.aborted, true);
  const replaced = runtime.clientTools[0]._meta.executionSignal;
  factory = defineAiClientToolFactory('factory_read', () => ({ ...build(), description: 'Changed contract' }));
  runtime.refreshClientTools();
  assert.equal(replaced.aborted, true);
  runtime.dispose();
});

test('home/general/project runtime wrappers and parameter consumers retain live binding signals', async t => {
  const previousWindow = globalThis.window;
  const previousCustomEvent = globalThis.CustomEvent;
  globalThis.window = new EventTarget();
  globalThis.CustomEvent = class extends Event {};
  t.after(() => { globalThis.window = previousWindow; globalThis.CustomEvent = previousCustomEvent });
  for (const kind of runtimeKinds) {
    let writes = 0;
    let builds = 0;
    const createProvider = () => ({ id: `owner-${kind}`, getClientTools: () => {
      builds += 1;
      return [{ id: 'provider_write', confirm: true, execute: () => { writes += 1; return { ok: true } } }];
    } });
    let unregister = homeAgentCapabilityRegistry.register(createProvider(), kind === 'home' ? 'home' : 'general');
    const runtime = createRuntimeForKind(kind);
    let replace;
    let parameters;
    // Execute the existing consumer's parameter composition rather than rely on object spread retaining getters.
    const consumer = readFileSync(resolve(src, 'layout/components/AiChat/useGlobalHomeAgent.ts'), 'utf8');
    const marker = 'const createRuntimeParameters = ';
    const start = kind === 'home' ? consumer.lastIndexOf(marker) : consumer.indexOf(marker);
    const expression = consumer.slice(start, consumer.indexOf('\n\n', start));
    const consumerCode = ts.transpileModule(`${expression}\nreturn createRuntimeParameters;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const compose = new Function('createProjectBubbleParameters', 'projectId', 'PROJECT_GENERAL_AGENT_SUBJECT_TYPE', consumerCode)(
      core('projectGeneralAgentRuntime').createProjectBubbleParameters, 'project', 'project',
    );
    const sync = () => { parameters = compose(runtime) };
    const stop = runtime.subscribeClientTools(sync);
    t.after(() => { locale = ''; stop(); runtime.dispose(); replace?.(); unregister() });
    sync();
    const original = parameters.clientTools.find(tool => tool.id === 'provider_write')._meta.executionSignal;
    const baseSignals = runtime.clientTools.filter(tool => tool.id.startsWith('home_agent_')).map(tool => tool._meta.executionSignal);
    const version = runtime.clientToolsVersion;
    const ready = deferred();
    const approval = deferred();
    const pending = runtime.handleClientToolCall({ id: 'prepared', toolName: 'provider_write', requestConfirmation: () => {
      ready.resolve(); return approval.promise;
    } });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await ready.promise;
    runtime.refreshContext();
    runtime.refreshContext();
    assert.ok(builds >= 3);
    assert.equal(runtime.clientToolsVersion, version, kind);
    assert.equal(original.aborted, false);
    assert.ok(baseSignals.every(signal => !signal.aborted));
    replace = homeAgentCapabilityRegistry.register(createProvider(), kind === 'home' ? 'home' : 'general');
    assert.equal(original.aborted, true);
    const latest = parameters.clientTools.find(tool => tool.id === 'provider_write')._meta.executionSignal;
    assert.equal(latest.aborted, false);
    assert.notEqual(latest, original);
    approval.resolve({ approved: true });
    await rejected;
    assert.equal(writes, 0);
    const wire = createAiClientToolCatalogSnapshot(parameters.clientTools).wireDefinitions;
    assert.ok(wire.every(tool => !('_meta' in tool) && !('executionBinding' in tool)));
    assert.ok(baseSignals.every(signal => !signal.aborted), 'provider replacement retains unrelated base bindings');
    locale = 'changed-locale/';
    runtime.refreshContext();
    assert.ok(baseSignals.every(signal => signal.aborted), 'localized wire changes still revoke the old contract');
    locale = '';
    stop(); runtime.dispose(); replace(); unregister();
  }
});

test('production invalidator waits for core publication and Vue props flush before same-schema attach', async () => {
  const source = readFileSync(resolve(conversation, 'index.vue'), 'utf8');
  const invalidator = source.slice(source.indexOf('const clientToolInvalidationRefresh = '), source.indexOf('const scheduleInitContractRefresh = '));
  const connect = source.slice(source.indexOf('const connectSession = '), source.indexOf('\n};', source.indexOf('const connectSession = ')) + 3);
  const reset = source.slice(source.indexOf('const softResetSession = '), source.indexOf('let initContractRefreshGeneration = '));
  const schedule = source.slice(source.indexOf('const scheduleInitContractRefresh = '), source.indexOf('\nwatch(', source.indexOf('const scheduleInitContractRefresh = ')));
  for (const live of [false, true]) {
    let tools = [{ id: 'live', execute: () => ({ ok: true }) }];
    const runtime = createAiClientToolRuntime(() => tools, { includeHelpTool: false });
    const parameters = vue.shallowRef({ clientTools: runtime.clientTools });
    const unused = new AbortController();
    parameters.value.clientTools.push({ id: 'invalid_optional', expands: { effect: 'INVALID' }, _meta: { executionSignal: unused.signal } });
    const props = vue.reactive({ clientTools: parameters.value.clientTools, agentConfig: {}, parameters: {} });
    const effect = vue.watchEffect(() => { props.clientTools = parameters.value.clientTools });
    const frames = [];
    const cancellation = deferred();
    let cancelCount = 0;
    let pendingRefresh;
    const errors = [];
    const adapter = { invalidateClientTools: () => {}, setConnectionOptions: () => {},
      setInitPayload: payload => frames.push(payload), connect: () => {}, disconnect: () => {},
      destroySession: async () => {}, reset: () => {} };
    const activeKey = vue.ref('same');
    const code = `${connect}\n${reset}\nlet deferredInitContractRefresh = false; let initContractRefreshGeneration = 0;
      let initContractResetQueue = Promise.resolve(); let unsubscribeClientToolExecutionSignals; ${invalidator}\n${schedule}
      return { connectSession, resetSession, scheduleInitContractRefresh, clientToolInvalidationRefresh,
        dispose: () => unsubscribeClientToolExecutionSignals?.() };`;
    const compiled = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const factory = new Function('createClientToolInvalidationRefresh', 'conversationDisposed', 'cancellingTurn',
      'hasInitContractRefreshLock', 'hasActiveTurn', 'awaitingAuthoritativeTurnEnd', 'ensureAdapter',
      'rejectPendingClientToolConfirmations', 'createClientToolConfirmationError', 'sessionState', 'cancelTurn',
      'nextTick', 'shouldPreserveTimelineForInitContractChange', 'handleCancelTurnError', 'props', 'serialize',
      'normalizeAgentConversationParameters', 'buildInitContractKey', 'activeInitConfigKey', 'activeInitParamsKey',
      'activeInitContractKey', 'subscribeClientToolExecutionSignals', 'buildInitPayload', 'clearConversationState',
      'adapterRef', 'resolveClientToolDefinitions', 'decideInitContractRefresh', compiled);
    const createRefresh = options => {
      const refresh = createClientToolInvalidationRefresh(options);
      const invalidate = refresh.invalidate;
      refresh.invalidate = () => { pendingRefresh = invalidate(); return pendingRefresh };
      return refresh;
    };
    const h = factory(createRefresh, false, vue.ref(false), state => state.hasActiveTurn,
      vue.ref(live), vue.ref(false), () => adapter, () => {}, () => new Error('cancelled'),
      { ready: true, sessionId: 'keep-history' }, () => { cancelCount += 1; return cancellation.promise },
      vue.nextTick, () => true, error => errors.push(error.name), props, JSON.stringify, value => value,
      () => 'same', vue.ref(''), vue.ref(''), activeKey, subscribeClientToolExecutionSignals,
      () => {
        assert.ok(createAiClientToolCatalogSnapshot(props.clientTools).definitions.every(tool => !tool._meta.executionSignal.aborted), 'never reattach revoked props');
        return { tools: createAiClientToolCatalogSnapshot(props.clientTools).wireDefinitions };
      }, options => { if (options) assert.equal(options.preserveTimeline, true) }, vue.ref(adapter),
      () => createAiClientToolCatalogSnapshot(props.clientTools).definitions, decideInitContractRefresh);
    h.connectSession();
    frames.length = 0;
    unused.abort();
    assert.equal(h.clientToolInvalidationRefresh.blocked, false, 'excluded optional definitions do not invalidate an attached catalog');
    const subscriber = runtime.subscribeClientTools(() => { parameters.value = { clientTools: runtime.clientTools } });
    const oldSignal = props.clientTools[0]._meta.executionSignal;
    tools = [{ ...tools[0], execute: () => ({ changed: true }) }];
    runtime.refreshClientTools();
    assert.equal(oldSignal.aborted, true);
    assert.equal(h.clientToolInvalidationRefresh.blocked, true);
    assert.equal(props.clientTools[0]._meta.executionSignal, oldSignal, 'abort precedes Vue props flush');
    await Promise.resolve();
    if (live) {
      assert.equal(frames.length, 0, 'attach waits for session.cancel');
      tools = [{ ...tools[0], execute: () => ({ latest: true }) }];
      runtime.refreshClientTools();
      cancellation.resolve();
    }
    await pendingRefresh;
    assert.equal(cancelCount, live ? 1 : 0);
    assert.equal(frames.length, 1, 'same fingerprint still reattaches once');
    assert.equal(activeKey.value, 'same');
    assert.ok(!JSON.stringify(frames[0]).includes('executionSignal'));
    assert.equal(h.clientToolInvalidationRefresh.blocked, false);
    assert.deepEqual(errors, []);
    // Disposing a runtime revokes signals without publishing a replacement props catalog.
    frames.length = 0;
    runtime.dispose();
    await pendingRefresh;
    assert.equal(h.clientToolInvalidationRefresh.blocked, true);
    assert.deepEqual(errors, ['AbortError']);
    for (let index = 0; index < 5; index += 1) h.connectSession();
    await pendingRefresh;
    assert.equal(frames.length, 0, 'a permanently revoked directory never reconnects in a loop');
    assert.deepEqual(errors, ['AbortError'], 'the failed gate reports once');
    const replacement = createAiClientToolRuntime([{ id: 'live', execute: () => ({ replacement: true }) }], { includeHelpTool: false });
    parameters.value = { clientTools: replacement.clientTools };
    await vue.nextTick();
    h.scheduleInitContractRefresh();
    await Promise.resolve();
    assert.equal(h.clientToolInvalidationRefresh.blocked, true, 'valid async props alone do not recover a failed gate');
    assert.equal(frames.length, 0);
    await h.resetSession();
    assert.equal(h.clientToolInvalidationRefresh.blocked, false, 'explicit fresh session recovers with the valid replacement catalog');
    assert.equal(frames.length, 1);
    assert.ok(frames[0].tools.every(tool => !('_meta' in tool) && !('executionBinding' in tool)));
    h.dispose(); effect(); subscriber(); runtime.dispose(); replacement.dispose();
  }
});
