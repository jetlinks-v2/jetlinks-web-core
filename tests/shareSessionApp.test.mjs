import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { parse, compileScript } from 'vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, reactive, nextTick } from 'vue'

const mocks = {
  '@jetlinks-web/components': 'export const ConfigProvider = { config() {} };',
  './components/CorePagination/defaults': 'export const paginationThemeComponents = () => ({}), runtimeTableConfig = {};',
  'ant-design-vue': 'export const Modal = { warning() {} }, theme = { defaultSeed: { controlHeight: 32 } };',
  'vue-i18n': 'export const useI18n = () => ({ t: x => x });',
  '@jetlinks-web-core/store': `
    export const useAuthStore = () => ({ hasPermission() {} });
    export const useSystemStore = () => ({ language: 'zh', themeStyle: 'light' });
  `,
  '@jetlinks-web/constants': 'export const ComponentsEnum = { Permission: "permission" }, LOCAL_BASE_API = "base";',
  '@jetlinks-web-core/package': `
    export const initPackages = options => globalThis.__shareSessionAppTest.calls.push(['initPackages', options.accountOnly]);
    export const clearVerifyCache = () => {};
  `,
  '@jetlinks-web/core': `
    export const wsClient = {
      initWebSocket: url => globalThis.__shareSessionAppTest.calls.push(['initWebSocket', url]),
      disconnect: () => globalThis.__shareSessionAppTest.calls.push('disconnect'),
    };
  `,
  '@jetlinks-web/utils': 'export const setToken = () => {};',
  '@jetlinks-web-core/router/login-session': 'export const consumeLogoutLoginEntry = () => false, LOGOUT_AUTH_QUERY_KEYS = [];',
  '@jetlinks-web-core/utils/edge-image-proxy': 'export const installEdgeImageProxy = () => {};',
  '@jetlinks-web-core/utils': `
    export const getBaseApi = () => '/api', getPackageConfig = () => ({}), initPersonal = () => {};
    export const resolvePublicAssetUrl = x => x, setProjectStorage = () => {};
  `,
  './utils/components-registry': 'export const componentsRegistry = { batchRegister() {} };',
  '@jetlinks-web-core/utils/theme-style': `
    export const applyThemeStyle = () => {}, getThemeStylePrimaryStateColors = () => ({}), pickAntdToken = () => ({});
  `,
  '@jetlinks-web-core/hooks': 'export const useResponsiveAntdToken = () => ({ token: { value: {} } });',
}

async function loadApp() {
  const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
  const script = compileScript(parse(source).descriptor, { id: 'share-session-test' }).content
  const result = await build({
    stdin: {
      contents: `
        import { computed, watch, provide, onUnmounted, h } from 'vue';
        const useRoute = () => globalThis.__shareSessionAppTest.route;
        const useRouter = () => ({ replace() {} });
        ${script}
      `,
      resolveDir: new URL('../src/', import.meta.url).pathname,
      sourcefile: 'App.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: ['vue'],
    define: { 'import.meta.env.DEV': 'false' },
    plugins: [{
      name: 'fixtures',
      setup(api) {
        api.onResolve({ filter: /^@jetlinks-web-core\/router\/types$/ }, () => ({
          path: new URL('../src/router/types.ts', import.meta.url).pathname,
        }))
        api.onResolve({ filter: /.*/ }, args => {
          const isFixture = args.path in mocks || args.path.endsWith('.vue')
            || args.path.includes('/locale/') || args.path === '@theme-config'
            || args.path === './locales/componentsJa'
          return isFixture ? { path: args.path, namespace: 'fixture' } : undefined
        })
        api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: mocks[args.path] || 'export default {};',
          loader: 'js',
        }))
      },
    }],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(
    module, module.exports, createRequire(import.meta.url),
  )
  return module.exports.default
}

test('share session skips account connection and releases it when leaving an account page', async t => {
  const state = globalThis.__shareSessionAppTest = {
    calls: [],
    route: reactive({ matched: [], meta: {}, query: {}, hash: '' }),
  }
  globalThis.window = {
    location: { hash: '', pathname: '/', search: '' },
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.localStorage = { setItem() {}, getItem() { return null } }

  const renderer = createRenderer({
    createElement: () => ({}),
    insert() {},
    remove() {},
    setElementText() {},
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setComment() {},
    parentNode() {},
    nextSibling() {},
    patchProp() {},
  })
  const component = await loadApp()
  const app = renderer.createApp({ ...component, render: () => null })
  app.mount({})
  t.after(() => app.unmount())

  // No connection is created before the first route matches.
  assert.deepEqual(state.calls, [])
  state.route.matched = [{}]
  state.route.meta = { security: 'public', shareSession: true }
  await nextTick()
  assert.deepEqual(state.calls, [])

  // An account page starts the connection; returning to a share closes it.
  state.route.meta = {}
  await nextTick()
  assert.deepEqual(state.calls, [['initPackages', true]])
  state.route.meta = { security: 'public', shareSession: true }
  await nextTick()
  assert.deepEqual(state.calls, [['initPackages', true], ['initWebSocket', ''], 'disconnect'])

  // A later account page starts a fresh connection.
  state.route.meta = {}
  await nextTick()
  assert.deepEqual(state.calls.at(-1), ['initPackages', true])
})

test('cold-boot directly onto an account route still initializes with accountOnly: true', async t => {
  const state = globalThis.__shareSessionAppTest = {
    calls: [],
    route: reactive({ matched: [{}], meta: {}, query: {}, hash: '' }),
  }
  globalThis.window = {
    location: { hash: '', pathname: '/', search: '' },
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.localStorage = { setItem() {}, getItem() { return null } }

  const renderer = createRenderer({
    createElement: () => ({}),
    insert() {},
    remove() {},
    setElementText() {},
    createText: () => ({}),
    createComment: () => ({}),
    setText() {},
    setComment() {},
    parentNode() {},
    nextSibling() {},
    patchProp() {},
  })
  const component = await loadApp()
  const app = renderer.createApp({ ...component, render: () => null })
  app.mount({})
  t.after(() => app.unmount())
  assert.deepEqual(state.calls, [['initPackages', true]])
})
