import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createRenderer, h, nextTick, reactive, ref } from 'vue'

const require = createRequire(import.meta.url)
const entry = fileURLToPath(new URL('./useCenter.ts', import.meta.url))
const contextKey = '__jetlinksCenterTestContext'
const stubSources = {
  '@jetlinks-web-core/store/user': 'export const useUserStore = () => context.user',
  '@jetlinks-web/hooks': 'export const useRouterParams = () => ({ params: context.params })',
  'vue-router': 'export const useRoute = () => context.route; export const useRouter = () => context.router',
  '@jetlinks-web-core/api/login': 'export const queryModal = (...args) => context.queryModal(...args)',
  '@jetlinks-web-core/api/account/center': 'export const getSelfIdentities_api = () => context.getIdentities(); export const getSsoBinds_api = () => context.getThirdAccounts(); export const getIdentityProviders_api = () => context.getProviders()',
  '@jetlinks-web-core/locales': "export default { global: { t: (key) => context.language.value + ':' + key } }",
  '@jetlinks-web-core/utils': 'export const isNoCommunity = context.isNoCommunity',
}
const bundle = await build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['vue', 'dayjs'],
  plugins: [{
    name: 'center-boundary-fixtures',
    setup(builder) {
      builder.onResolve({ filter: /^(?:@jetlinks-web|vue-router)/ }, ({ path }) => {
        if (stubSources[path]) return { path, namespace: 'center-fixture' }
      })
      builder.onLoad({ filter: /.*/, namespace: 'center-fixture' }, ({ path }) => ({
        contents: `const context = globalThis.${contextKey};\n${stubSources[path]}`,
      }))
    },
  }],
})

const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
})
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

// 挂载真实 composable 与 Vue 生命周期，只替换 Store、路由和 API 边界。
const mountCenter = async (t, options = {}) => {
  const calls = { identities: 0, thirdAccounts: 0, support: 0, user: 0 }
  const user = reactive({
    userInfo: {
      id: 'fixture-user', name: '账户测试', username: 'fixture', createTime: 1600000000000,
      telephone: '13800009999', email: 'fallback@example.test',
      roleList: [{ name: '管理员' }], orgList: [{ name: '研发' }], positions: [],
    },
    isApplicationUser: options.application || false,
    tabKey: 'BindThirdAccount', other: { tabKey: 'alarm' }, messageInfo: {},
    async getUserInfo() {
      calls.user += 1
      await options.loadUser?.(user)
    },
  })
  const context = {
    user, calls, isNoCommunity: options.community !== true, language: ref('zh'),
    params: ref(options.params || {}), route: reactive({ query: options.query || {} }),
    async queryModal() { calls.support += 1; return { result: options.identitySupported !== false } },
    async getProviders() { return { result: [{ id: 'mobile' }, { id: 'email' }] } },
    async getIdentities() {
      calls.identities += 1
      return options.identitiesRequest?.() || { result: [
        { provider: 'email', identity: 'second@example.test' },
        { provider: 'email', identity: 'primary@example.test', isPrimary: true },
        { provider: 'mobile', identity: '13600003333' },
        { provider: 'mobile', identity: '13900001234', isPrimary: true },
      ] }
    },
    async getThirdAccounts() {
      calls.thirdAccounts += 1
      return options.thirdAccountsRequest?.() || { result: [
        { id: 'supported', name: '第三方登录', bound: true, features: [] },
        { id: 'unsupported', name: '不可重定向', bound: false, features: ['ssoUnsupportedRedirect'] },
      ] }
    },
  }
  context.router = { async replace({ query }) { context.route.query = query } }
  globalThis[contextKey] = context
  const compiled = new Module(entry)
  compiled.filename = entry
  compiled.paths = require.resolve.paths('vue')
  compiled._compile(bundle.outputFiles[0].text, entry)
  delete globalThis[contextKey]
  let center
  const app = renderer.createApp({ setup() { center = compiled.exports.useCenter(); return () => h('div') } })
  app.mount({})
  let mounted = true
  const unmount = () => { if (mounted) { app.unmount(); mounted = false } }
  t.after(unmount)
  await flush()
  return { center, context, user, calls, unmount }
}

test('默认消息中心，账户信息常驻且仅保留三个主切换项', async t => {
  const { center, user } = await mountCenter(t)
  assert.equal(center.activeKey.value, 'StationMessage')
  assert.equal(user.tabKey, 'StationMessage')
  assert.equal(center.accountInfoVisible.value, false)
  assert.deepEqual(center.profile.value.items.map(item => item.key), ['id', 'username', 'roles', 'orgs', 'mobile'])
  assert.deepEqual(center.segments.value.map(item => item.value), ['StationMessage', 'Subscribe', 'PersonalToken'])
  center.selectContent('PersonalToken')
  await flush()
  assert.equal(center.activeKey.value, 'PersonalToken')
  center.selectContent('unknown')
  await flush()
  assert.equal(center.activeKey.value, 'StationMessage')
})

test('路由指定订阅页且慢速用户加载完成后仍保持手动选择', async t => {
  const loaded = deferred()
  const { center } = await mountCenter(t, { params: { tabKey: 'Subscribe' }, loadUser: () => loaded.promise })
  assert.equal(center.activeKey.value, 'Subscribe')
  center.selectContent('PersonalToken')
  loaded.resolve()
  await flush()
  assert.equal(center.activeKey.value, 'PersonalToken')
})

test('历史首页视图和账号信息参数打开辅助入口', async t => {
  const { center, context, user } = await mountCenter(t, { params: { tabKey: 'HomeView' } })
  assert.equal(center.homeViewVisible.value, true)
  user.tabKey = 'StationMessage'
  assert.equal(center.homeViewVisible.value, false)
  context.params.value = { tabKey: 'BindThirdAccount' }
  await flush()
  assert.equal(center.accountInfoVisible.value, true)
  assert.equal(center.homeViewVisible.value, false)
  context.params.value = { tabKey: 'PersonalToken' }
  await flush()
  assert.equal(center.accountInfoVisible.value, false)
  assert.equal(center.activeKey.value, 'PersonalToken')
})

test('应用用户无法从历史参数或辅助入口打开首页视图', async t => {
  const { center } = await mountCenter(t, { application: true, params: { tabKey: 'HomeView' } })
  assert.equal(center.homeViewVisible.value, false)
  assert.equal(center.profile.value.canConfigureHome, false)
  center.openHomeView()
  assert.equal(center.homeViewVisible.value, false)
})

test('异步识别到应用用户后关闭首页视图', async t => {
  const loaded = deferred()
  const { center } = await mountCenter(t, {
    params: { tabKey: 'HomeView' },
    loadUser: async user => { await loaded.promise; user.isApplicationUser = true },
  })
  assert.equal(center.homeViewVisible.value, true)
  loaded.resolve()
  await flush()
  assert.equal(center.homeViewVisible.value, false)
})

test('新通知切回消息中心，旧通知不干扰订阅和令牌切换', async t => {
  const { center, context, user } = await mountCenter(t)
  center.selectContent('Subscribe')
  center.openAccountInfo()
  user.messageInfo = { id: 'notice-1', topicProvider: 'alarm' }
  await flush()
  assert.equal(center.activeKey.value, 'StationMessage')
  assert.equal(center.accountInfoVisible.value, false)
  center.selectContent('PersonalToken')
  await flush()
  assert.equal(center.activeKey.value, 'PersonalToken')
  context.params.value = { row: { id: 'notice-2', topicProvider: 'alarm' }, tabKey: 'StationMessage' }
  await flush()
  assert.equal(center.activeKey.value, 'StationMessage')
})

test('验证返回的联系方式锚点不会被 Store 回声关闭', async t => {
  const { center, context } = await mountCenter(t, { query: { anchor: 'email-section' } })
  assert.equal(center.accountInfoVisible.value, true)
  center.openAccountInfo('phone-section')
  await flush()
  assert.equal(center.accountInfoVisible.value, true)
  assert.equal(context.route.query.anchor, 'phone-section')
})

test('主身份优先、无身份服务时回退账户联系方式，过滤不支持重定向的绑定', async t => {
  const { center } = await mountCenter(t)
  assert.equal(center.profile.value.items.find(item => item.key === 'mobile').value, '139****1234')
  assert.deepEqual(center.profile.value.thirdAccounts.map(item => item.key), ['supported'])
  const fallback = await mountCenter(t, { identitySupported: false })
  assert.equal(fallback.calls.identities, 0)
  assert.equal(fallback.center.profile.value.items.find(item => item.key === 'mobile').value, '138****9999')
  assert.equal(fallback.center.profile.value.items.find(item => item.key === 'mobile').editTarget, undefined)
})

test('部分账户加载失败保留可用数据，重试成功后清除错误', async t => {
  let failed = true
  const { center } = await mountCenter(t, {
    thirdAccountsRequest: () => failed ? Promise.reject(new Error('fixture failure')) : { result: [] },
  })
  assert.equal(center.loadError.value, true)
  assert.equal(center.loading.value, false)
  assert.equal(center.profile.value.name, '账户测试')
  assert.equal(center.profile.value.items.find(item => item.key === 'mobile').value, '139****1234')
  failed = false
  await center.loadAccount()
  assert.equal(center.loadError.value, false)
})

test('关闭详细编辑后重新读取绑定，卸载使迟到响应失效', async t => {
  const pending = deferred()
  let delaying = false
  const { center, calls, unmount } = await mountCenter(t, {
    identitiesRequest: () => delaying ? pending.promise : { result: [] },
  })
  center.openAccountInfo()
  center.closeAccountInfo()
  await flush()
  assert.equal(calls.identities, 2)
  delaying = true
  const request = center.loadAccount()
  unmount()
  pending.resolve({ result: [{ provider: 'mobile', identity: '13700006666' }] })
  await request
  assert.equal(center.profile.value.items.find(item => item.key === 'mobile').value, '138****9999')
})

test('社区版保持原账户能力边界，文案跟随语言切换', async t => {
  const { center, calls, context } = await mountCenter(t, { community: true })
  assert.equal(center.profile.value.canEdit, false)
  assert.equal(calls.support, 0)
  assert.equal(calls.thirdAccounts, 0)
  center.openAccountInfo()
  assert.equal(center.accountInfoVisible.value, false)
  assert.equal(center.activeTitle.value, 'zh:AccountCenter.messageCenter')
  context.language.value = 'en'
  assert.equal(center.activeTitle.value, 'en:AccountCenter.messageCenter')
})
