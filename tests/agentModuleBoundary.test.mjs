import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import * as vue from 'vue';
import { parse } from 'vue/compiler-sfc';

const src = fileURLToPath(new URL('../src/', import.meta.url));
const workspace = resolve(src, '../..');
const require = createRequire(import.meta.url);
const agentSource = name => resolve(src, 'layout/components/AiChat', name);

// Run production modules with only browser/service dependencies substituted; reject UI imports.
function createLoader(stubs = {}) {
  const cache = new Map();
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename);
    assert.ok(!filename.includes('/jetlinks-ai-agent-ui/'), `UI dependency: ${filename}`);
    assert.ok(!filename.endsWith('.vue'), `Unexpected renderer dependency: ${filename}`);
    const exports = {};
    cache.set(filename, exports);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'exports', code)(id => {
      if (Object.hasOwn(stubs, id)) return stubs[id];
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id);
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(src, id.slice('@jetlinks-web-core/'.length));
      return load(existsSync(base) ? base : existsSync(`${base}.ts`) ? `${base}.ts` : resolve(base, 'index.ts'));
    }, exports);
    return exports;
  };
  return load;
}

const runtimeStubs = {
  '@jetlinks-web-core/locales': { __esModule: true, default: { global: { t: key => key } } },
  '@jetlinks-web-core/utils/ai-client-tool-request': { withAiClientToolSilentRequest: handler => handler() },
};

test('all business module production declarations are independent of AI UI provider identity', () => {
  const forbidden = /(?:jetlinks-ai-agent-ui|@jetlinks-ai-agent\/)/;
  const excluded = new Set(['.git', 'node_modules', 'dist', 'target', 'coverage', 'tests', 'scripts', 'docs', 'locales']);
  const violations = [];
  const walk = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filename = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name)) walk(filename);
        continue;
      }
      if (!/\.(?:ts|tsx|js|vue|json)$/.test(entry.name) || /\.(?:test|spec)\./.test(entry.name)) continue;
      let source = readFileSync(filename, 'utf8');
      if (entry.name.endsWith('.vue')) {
        const { descriptor } = parse(source);
        source = `${descriptor.script?.content || ''}\n${descriptor.scriptSetup?.content || ''}`;
        // Asset dependencies in templates must obey the same ownership boundary.
        if (forbidden.test(descriptor.template?.content || '')) violations.push(filename);
      }
      const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
      const visit = node => {
        if (ts.isStringLiteralLike(node) && forbidden.test(node.text)) violations.push(filename);
        ts.forEachChild(node, visit);
      };
      visit(tree);
    }
  };
  for (const entry of readdirSync(resolve(workspace, 'modules'), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== 'jetlinks-ai-agent-ui') walk(resolve(workspace, 'modules', entry.name));
  }
  assert.deepEqual([...new Set(violations)], []);
});

test('tool registration, discovery and execution run without an installed AI UI or host adapter', async () => {
  const load = createLoader(runtimeStubs);
  const { aiClientToolRegistry } = load(agentSource('clientToolRegistry.ts'));
  const { createAiClientToolRuntime } = load(agentSource('clientTools.ts'));
  const unregister = aiClientToolRegistry.register('independent-domain', [{
    id: 'independent_read',
    description: 'Read the declared domain value',
    execute: () => ({ value: 42 }),
  }]);
  const runtime = createAiClientToolRuntime([], { registeredToolScopes: ['independent-domain'], includeHelpTool: false });
  try {
    assert.deepEqual(runtime.clientTools.map(tool => tool.id), ['independent_read']);
    const result = await runtime.handleClientToolCall({ id: 'call-1', toolName: 'independent_read', arguments: {} });
    assert.equal(result.value, 42);
  } finally {
    runtime.dispose();
    unregister();
  }
});

test('rule presentation declarations load without a renderer and resolve only while a real renderer is installed', () => {
  const load = createLoader(runtimeStubs);
  const { generalAgentExtensionRegistry: registry } = load(agentSource('generalAgentExtensions.ts'));
  const { ruleEditorFlowchartGeneralAgentExtension: extension } = load(resolve(
    workspace, 'modules/rule-engine-manager-ui/agentCapabilities/ruleEditor/generalAgentExtension.ts',
  ));
  const removeDomain = registry.register(extension);
  let removeRenderer;
  try {
    assert.equal(registry.resolvePresentationBlock('flowchart', 'graph TD; A-->B'), undefined);
    assert.deepEqual(registry.getPresentationCapabilities(), []);
    const renderer = { name: 'InstalledRenderer' };
    const skeleton = { name: 'InstalledSkeleton' };
    removeRenderer = registry.register({
      id: 'test-ui-renderer', order: -100,
      conversation: { presentationRenderers: [{
        type: 'mermaid', renderer, skeleton, decode: content => ({ kind: 'inline', content }),
        presentation: { ...extension.conversation.presentationAliases[0].presentation, deliveryPolicy: 'preferred' },
      }] },
    });
    const block = registry.resolvePresentationBlock('flowchart', 'graph TD; A-->B');
    assert.equal(block.renderer, renderer);
    assert.equal(registry.getPresentationRenderers().find(item => item.type === 'flowchart').skeleton, skeleton);
    assert.deepEqual(block.value, { kind: 'inline', content: 'graph TD; A-->B' });
    const capability = registry.getPresentationCapabilities().find(item => item.type === 'flowchart');
    assert.equal(capability.deliveryPolicy, 'explicit');
    assert.equal(capability.mediaType, extension.conversation.presentationAliases[0].presentation.mediaType);
    removeRenderer();
    removeRenderer = undefined;
    assert.equal(registry.resolvePresentationBlock('flowchart', 'graph TD; A-->B'), undefined);
    assert.deepEqual(registry.getPresentationCapabilities(), []);
  } finally {
    removeRenderer?.();
    removeDomain();
  }
});

test('renderer references stay scoped, reject alias-only cycles and preserve concrete renderer precedence', () => {
  const { generalAgentExtensionRegistry: registry } = createLoader(runtimeStubs)(agentSource('generalAgentExtensions.ts'));
  const presentation = { contentType: 'text', mediaType: 'text/plain', supportsSessionFile: false, maxInlineBytes: 100 };
  const cleanups = [registry.register({ id: 'cycle', conversation: { presentationAliases: [
    { type: 'a', rendererType: 'b', presentation }, { type: 'b', rendererType: 'a', presentation },
  ] } }, 'domain')];
  try {
    assert.deepEqual(registry.getPresentationCapabilities('domain'), []);
    const renderer = { name: 'Renderer' };
    cleanups.push(registry.register({ id: 'target', conversation: { presentationRenderers: [{ type: 'b', renderer, presentation }] } }, 'other'));
    assert.deepEqual(registry.getPresentationCapabilities('domain'), []);
    cleanups.push(registry.register({ id: 'concrete', order: -100, conversation: { presentationRenderers: [{ type: 'a', renderer, presentation }] } }, 'domain'));
    assert.equal(registry.getPresentationRenderers('domain').find(item => item.type === 'a').renderer, renderer);
  } finally {
    cleanups.reverse().forEach(cleanup => cleanup());
  }
});

function mountHost(hook, kind = 'access', options = {}) {
  let host;
  const renderer = vue.createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, patchProp() {}, insert() {}, remove() {},
    parentNode: () => null, nextSibling: () => null,
  });
  const app = renderer.createApp({ setup() { host = hook(kind, options); return () => null; } });
  app.mount({});
  return { host, dispose: () => app.unmount() };
}

function hostEnvironment() {
  const modules = new Map();
  const listeners = new Set();
  const counts = { queries: 0 };
  const environment = {
    counts, listeners,
    application: {
      queryApplication: async () => { counts.queries += 1; environment.install(); },
    },
    registry: {
      getAllModules: () => modules,
      onChange: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
    install(components = { access: { name: 'Access' }, conversation: { name: 'Conversation' } }, owner = 'opaque-ui-owner', priority = 0) {
      if (components) modules.set(owner, { agentConversationProviders: { surface: { components, priority } } });
      else modules.delete(owner);
      listeners.forEach(listener => listener());
    },
  };
  const load = createLoader({
    '@jetlinks-web-core/utils/module-registry': { moduleRegistry: environment.registry },
    '@jetlinks-web-core/store/application': { useApplication: () => environment.application },
  });
  environment.hook = load(agentSource('useAgentConversationComponent.ts')).useAgentConversationComponent;
  return environment;
}

test('installed UI is reused and registry replacement/unload is reflected until the host is disposed', async () => {
  const environment = hostEnvironment();
  environment.install();
  const { host, dispose } = mountHost(environment.hook);
  await host.loadAgentConversationComponent();
  assert.equal(host.conversationComponent.value.name, 'Access');
  assert.deepEqual(environment.counts, { queries: 0 });
  environment.install({ access: { name: 'Replacement' } });
  assert.equal(host.conversationComponent.value.name, 'Replacement');
  environment.install({ access: { name: 'Preferred' } }, 'another-ui-owner', 10);
  assert.equal(host.conversationComponent.value.name, 'Preferred');
  environment.install(null, 'another-ui-owner');
  assert.equal(host.conversationComponent.value.name, 'Replacement');
  environment.install(null);
  assert.equal(host.conversationComponent.value, undefined);
  dispose();
  assert.equal(environment.listeners.size, 0);
  environment.install();
  assert.equal(host.conversationComponent.value, undefined);
});

test('hosts delegate platform waiting to the store and deduplicate repeated calls per host', async () => {
  const environment = hostEnvironment();
  let release;
  const discovery = new Promise(resolvePromise => {
    release = () => { environment.install(); resolvePromise(); };
  });
  environment.application.queryApplication = () => {
    environment.counts.queries += 1;
    return discovery;
  };
  const access = mountHost(environment.hook, 'access', { autoLoad: false });
  const conversation = mountHost(environment.hook, 'conversation', { autoLoad: false });
  try {
    const first = access.host.loadAgentConversationComponent();
    const duplicate = access.host.loadAgentConversationComponent();
    const second = conversation.host.loadAgentConversationComponent();
    assert.equal(first, duplicate);
    assert.equal(access.host.conversationComponentLoading.value, true);
    assert.equal(conversation.host.conversationComponentLoading.value, true);
    await Promise.resolve();
    release();
    await Promise.all([first, second]);
    assert.deepEqual(environment.counts, { queries: 2 });
    assert.equal(access.host.conversationComponent.value.name, 'Access');
    assert.equal(conversation.host.conversationComponent.value.name, 'Conversation');
  } finally { access.dispose(); conversation.dispose(); }
});

test('failed platform discovery exposes the error and can be retried without caching an unavailable provider', async () => {
  const environment = hostEnvironment();
  const load = environment.application.queryApplication;
  environment.application.queryApplication = async () => { throw new Error('network unavailable'); };
  const { host, dispose } = mountHost(environment.hook, 'access', { autoLoad: false });
  try {
    assert.equal(await host.loadAgentConversationComponent(), undefined);
    assert.match(host.conversationComponentError.value.message, /network unavailable/);
    assert.equal(host.conversationComponentLoading.value, false);
    environment.application.queryApplication = load;
    await host.loadAgentConversationComponent();
    assert.equal(host.conversationComponent.value.name, 'Access');
    assert.equal(host.conversationComponentError.value, undefined);
  } finally { dispose(); }
});

test('disposed hosts ignore provider registration and late platform discovery completion', async () => {
  const environment = hostEnvironment();
  let release;
  environment.application.queryApplication = () => new Promise(resolvePromise => { release = resolvePromise; });
  const { host, dispose } = mountHost(environment.hook, 'access', { autoLoad: false });
  const loading = host.loadAgentConversationComponent();
  await Promise.resolve();
  dispose();
  environment.install();
  release();
  await loading;
  assert.equal(host.conversationComponent.value, undefined);
  assert.equal(environment.listeners.size, 0);
});

test('shared workflow tools and presentation source helpers do not load any AI UI implementation', () => {
  const load = createLoader(runtimeStubs);
  const workflow = load(agentSource('workflowGuides.ts'));
  assert.equal(workflow.createWorkflowGuideToolDefinition([{ id: 'domain-guide' }]).id, 'agent_workflow_guide');
  const result = workflow.resolveWorkflowGuideToolResult({ guideId: 'domain-guide' }, [{ id: 'domain-guide', steps: [{ capability: 'domain.read' }] }]);
  assert.equal(result.guidance[0].evidencePlan[0].capability, 'domain.read');
  const { createMarkdownPresentationSourceResolver } = load(agentSource('markdownPresentationSource.ts'));
  const resolver = createMarkdownPresentationSourceResolver(value => value === 'fs://safe/file.txt' ? 'safe/file.txt' : '');
  assert.deepEqual(resolver.decode('fs://safe/file.txt'), { kind: 'file', uri: 'fs://safe/file.txt', path: 'safe/file.txt' });
  assert.equal(resolver.decode('fs://../secret'), undefined);
});
