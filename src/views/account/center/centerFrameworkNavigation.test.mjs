import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createRenderer, h, reactive, ref, nextTick } from 'vue'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
const registrationPath = fileURLToPath(new URL('../../../layout/hooks/useProjectSecondaryMenu.ts', import.meta.url))
const key = '__centerFrameworkFixture'
const stubs = {
  'vue-router': 'export const useRoute=()=>ctx.route;export const useRouter=()=>ctx.router',
  '@jetlinks-web/hooks': 'export const useRouterParams=()=>({params:ctx.params})',
  '@jetlinks-web-core/store/user': 'export const useUserStore=()=>ctx.user',
  '@jetlinks-web-core/locales': 'export default {global:{t:key=>key}}',
  '@jetlinks-web-core/utils': 'export const isNoCommunity=true',
  '@jetlinks-web-core/utils/project-runtime': 'export const normalizeProjectRuntimePath=value=>value',
  '@jetlinks-web-core/utils/menuBadge': 'export const isComingSoonMenuMeta=()=>false',
  '@jetlinks-web-core/api/login': 'export const queryModal=async()=>({result:false})',
  '@jetlinks-web-core/api/account/center': 'export const getSsoBinds_api=async()=>({result:[]});export const getSelfIdentities_api=async()=>({result:[]});export const getIdentityProviders_api=async()=>({result:[]})',
}
const bundle = await build({
  stdin: {
    contents: "export {useCenter} from './useCenter';export {provideProjectSecondaryMenu,useOptionalProjectSecondaryMenu} from '@jetlinks-web-core/layout/hooks/useProjectSecondaryMenu';",
    resolveDir: directory, loader: 'ts',
  },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  plugins: [{ name: 'framework-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@jetlinks-web-core\/layout\/hooks\/useProjectSecondaryMenu$/ }, () => ({ path: registrationPath }))
    builder.onResolve({ filter: /^(?:@jetlinks-web|vue-router)/ }, ({ path }) => stubs[path] ? { path, namespace: 'fixture' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: 'const ctx=globalThis.'+key+';\n'+stubs[path] }))
  }}],
})
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
})
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }
async function mount(t, options = {}) {
  const ctx = {
    route: reactive({ name: 'account/center', path: '/account/center', query: options.query || {}, hash: '' }),
    params: ref(options.params || {}),
    user: reactive({ userInfo: { name: '测试', username: 'test' }, tabKey: 'BindThirdAccount', other: { tabKey: '' }, messageInfo: {}, isApplicationUser: false, getUserInfo: async () => {} }),
  }
  ctx.router = { replace: async ({ query }) => { ctx.route.query = query } }
  globalThis[key] = ctx
  const mod = new Module(directory+'framework.cjs')
  mod.paths = require.resolve.paths('vue')
  mod._compile(bundle.outputFiles[0].text, directory+'framework.cjs')
  delete globalThis[key]
  // 生产由自动导入提供；测试使用同一个路由边界。
  globalThis.useRoute = () => ctx.route
  globalThis.useRouter = () => ctx.router
  let host, center
  const visible = ref(true)
  const Child = { setup() {
    center = options.flat
      ? mod.exports.useOptionalProjectSecondaryMenu({ items: [{ key: 'search', label: '文搜图' }, { key: 'track', label: '轨迹' }], defaultActiveKey: 'search' })
      : mod.exports.useCenter()
    return () => h('div')
  } }
  const app = renderer.createApp({ setup() {
    host = mod.exports.provideProjectSecondaryMenu()
    return () => visible.value ? h(Child) : h('span')
  } })
  app.mount({})
  t.after(() => { app.unmount(); delete globalThis.useRoute; delete globalThis.useRouter })
  await flush()
  return { ctx, host, center, visible }
}
test('个人中心注册两组菜单，框架点击与页面页签双向同步', async t => {
  const { ctx, host, center } = await mount(t, { params: { tabKey: 'PersonalToken' } })
  assert.equal(center.hasFrameworkNavigation, true)
  assert.equal(host.grouped.value, true)
  assert.deepEqual(host.items.value.map(group => group.children.length), [4, 2])
  assert.equal(center.activeKey.value, 'PersonalToken')
  assert.equal(host.selectedKey.value, 'PersonalToken')
  host.select('Subscribe')
  await flush()
  assert.equal(ctx.route.query.tab, 'Subscribe')
  assert.equal(center.activeKey.value, 'Subscribe')
  center.selectContent('Security')
  await flush()
  assert.equal(host.selectedKey.value, 'Security')
})
test('离开个人中心或卸载后，不向其他页面遗留分组菜单', async t => {
  const { ctx, host, visible } = await mount(t)
  ctx.route.name = 'system/Basis'
  ctx.route.path = '/system/Basis'
  await flush()
  assert.equal(host.grouped.value, false)
  assert.deepEqual(host.items.value, [])
  visible.value = false
  await flush()
  assert.deepEqual(host.items.value, [])
})
test('现有平铺注册调用保持默认模式、原 query key 和选中行为', async t => {
  const { ctx, host, center } = await mount(t, { flat: true })
  assert.equal(host.grouped.value, false)
  assert.equal(center.activeKey.value, 'search')
  host.select('track')
  await flush()
  assert.equal(ctx.route.query.active, 'track')
  assert.equal(center.activeKey.value, 'track')
  assert.equal(ctx.route.query.tab, undefined)
})
