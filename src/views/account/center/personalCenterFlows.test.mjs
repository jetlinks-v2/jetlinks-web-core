import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Subject } from 'rxjs'
import dayjs from 'dayjs'
import { createRenderer, h, nextTick, reactive, ref } from 'vue'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
const source = [
  "export {useSecuritySettings} from './components/useSecuritySettings'",
  "export {useSsoBindings} from './components/BindThirdAccount/useSsoBindings'",
  "export {useNotificationSettings} from './components/Subscribe/useNotificationSettings'",
  "export {useIdentityBinding} from './components/ContactDialog/useIdentityBinding'",
  "export {useBasicProfile} from './components/useBasicProfile'",
  "export {useStationMessage} from './components/StationMessage/useStationMessage'",
  "export {useNotificationRecords} from './components/StationMessage/components/NotificationRecord/useNotificationRecords'",
  "export {buildQueryFilter} from '../../../components/ConditionFilter/utils'",
  "export {tokenStatus,tokenDate,permissionCount} from './components/PersonalToken/tokenPresentation'",
].join('\n')
const contextKey = '__personalCenterFlowTest'
const stubs = {
  '@jetlinks-web/constants': 'export const BASE_API="/api"',
  '@jetlinks-web-core/assets/notice': 'export const DingTalk="";export const WeixinCorp=""',
  '@jetlinks-web-core/assets/apply': 'export const InternalStandalone="";export const ThirdParty=""',
  'vue-i18n': 'export const useI18n=()=>({t:key=>key,locale:ctx.locale})',
  '@jetlinks-web/utils': 'export const onlyMessage=(...args)=>ctx.messages.push(args);export const randomString=()=>"fixture"',
  '@jetlinks-web-core/locales': 'export default {global:{t:key=>key}}',
  '@jetlinks-web-core/store/user': 'export const useUserStore=()=>ctx.user',
  '@jetlinks-web-core/store': 'export const useSystemStore=()=>({language:"zh"});export const useUserStore=()=>ctx.user',
  '@jetlinks-web/hooks': 'export const useRouterParams=()=>({params:ctx.params,clear:()=>{ctx.params.value={}}})',
  '@jetlinks-web-core/utils/components-registry': 'export const componentsRegistry={getRegistry:()=>ctx.registeredProviders}',
  '@jetlinks-web-core/layout/components/noticeTextResolver': 'export const resolveNoticeTexts=async records=>records',
  '@jetlinks-web-core/api/account/notificationRecord': ['getList_api','changeStatus_api','changeAllStatus','getUnreadSummary_api'].map(name => 'export const '+name+'=(...args)=>ctx.request('+JSON.stringify(name)+',args)').join('\n'),
  '@jetlinks-web-core/api/account/center': [
    'getSelfLoginRecords_api', 'getPasswordChangeSetting_api', 'getAllNotice', 'getSsoBinds_api', 'unBind_api', 'getSelfIdentities_api', 'requestIdentityValidation_api',
    'confirmIdentityValidation_api', 'unbindIdentity_api', 'updateMeInfo_api',
  ].map(name => 'export const '+name+'=(...args)=>ctx.request('+JSON.stringify(name)+',args)').join('\n') +
    '\nexport const getSsoBindingEvents_api=id=>{ctx.calls.push({method:"binding.start",args:[id]});const stream=ctx.newStream();return stream}',
  '@jetlinks-web-core/api/account/notificationSubscription': [
    'getNoticeList_api', 'getIsBindThird', 'save_api', 'getTypeList_api', 'getNotificationChannelDefinitions_api',
  ].map(name => 'export const '+name+'=(...args)=>ctx.request('+JSON.stringify(name)+',args)').join('\n'),
}
const bundle = await build({
  stdin: { contents: source, resolveDir: directory, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', 'dayjs'],
  plugins: [{ name: 'flow-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@jetlinks-web-core\/layout\/components\/noticeUtils$/ }, () => ({ path: fileURLToPath(new URL('../../../layout/components/noticeUtils.ts', import.meta.url)) }))
    builder.onResolve({ filter: /^@jetlinks-web-core\/components\/ConditionFilter\/utils$/ }, () => ({ path: fileURLToPath(new URL('../../../components/ConditionFilter/utils.ts', import.meta.url)) }))
    builder.onResolve({ filter: /^(?:@jetlinks-web|vue-i18n)/ }, ({ path }) => stubs[path] ? { path, namespace: 'fixture' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
      contents: 'const ctx=globalThis.'+contextKey+';\n'+stubs[path],
    }))
  }}],
})
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
})
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const channel = { id: 'site', name: '站内信', channelProvider: 'inside-mail' }
const mail = { id: 'mail', name: '邮箱', channelProvider: 'notifier-email', channelConfiguration: { templateId: 'mail-template' } }
const row = { provider: 'alarm', name: '告警', channels: [channel, mail], defaultSubscribed: true, defaultNotifyChannels: ['site'], type: { id: 'alarm', name: '告警' } }
async function mount(t, name, args = [], overrides = {}) {
  const calls = [], messages = []
  const user = reactive({
    userInfo: { username: 'tester', name: 'Tester', email: 'test@example.test', type: { id: 'projectOwner', name: '项目所有者' } },
    other: { tabKey: '' }, messageInfo: {}, unreadNoticeCount: 7, alarmUpdateCount: 0, isSubAccount: false,
    getUserInfo: async () => {},
    updateAlarm() { this.alarmUpdateCount += 1 },
  })
  const responses = {
    getSelfLoginRecords_api: () => ({ data: [] }),
    getPasswordChangeSetting_api: () => ({ content: "" }),
    getAllNotice: () => [row],
    getTypeList_api: () => [],
    getNotificationChannelDefinitions_api: () => [
      'inside-mail', 'notifier-dingTalk', 'notifier-weixin', 'notifier-email',
      'notifier-voice', 'notifier-sms', 'notifier-webhook',
    ].map(id => ({ id, receiverPolicy: id === 'notifier-webhook' ? 'explicit' : 'subscriber' })),
    getUnreadSummary_api: () => ({ topics: [] }),
    getList_api: () => ({ data: [], total: 0 }),
    changeStatus_api: () => true,
    changeAllStatus: () => true,
    getSsoBinds_api: () => [{id:'wechat',name:'微信',provider:'wechat-official-account',bound:false,features:['ssoUnsupportedRedirect']}],
    unBind_api: () => true,
    getNoticeList_api: () => ({ data: [] }),
    getSelfIdentities_api: () => [],
    getIsBindThird: () => [],
    requestIdentityValidation_api: () => ({ requestId: 'challenge', token: 'test-only', intervalSeconds: 0 }),
    confirmIdentityValidation_api: () => true,
    unbindIdentity_api: () => true,
    updateMeInfo_api: data => { user.userInfo = { ...data }; return data },
    save_api: data => data,
    ...overrides,
  }
  const ctx = {
    user, calls, messages, params: ref(overrides.__params || {}), locale: ref('zh'), streams: [],
    registeredProviders: overrides.__registeredProviders ?? [{ code: 'bulletin', props: { messageCategory: 'announcement' } }],
    newStream() { const stream = new Subject(); this.streams.push(stream); return stream },
    window: { addEventListener() {}, removeEventListener() {}, open() {} },
    storage: { setItem() {} },
    async request(method, args) {
      calls.push({ method, args })
      return { success: true, status: 200, result: await responses[method](...args) }
    },
  }
  globalThis[contextKey] = ctx
  const mod = new Module(directory+'flows.cjs')
  mod.filename = directory+'flows.cjs'
  mod.paths = require.resolve.paths('vue')
  mod._compile('const window=globalThis.'+contextKey+'.window;const localStorage=globalThis.'+contextKey+'.storage;\n'+bundle.outputFiles[0].text, mod.filename)
  delete globalThis[contextKey]
  let hook
  const app = renderer.createApp({ setup() { hook = mod.exports[name](...args); return () => h('div') } })
  app.mount({})
  t.after(() => app.unmount())
  await flush()
  return { hook, ctx, exports: mod.exports }
}

test('通知矩阵使用默认订阅，保存单个渠道并保留其他渠道', async t => {
  const { hook, ctx } = await mount(t, 'useNotificationSettings')
  assert.deepEqual(hook.selected(row), ['site'])
  await hook.toggle(row, mail, true)
  assert.deepEqual(hook.selected(row), ['site', 'mail'])
  await hook.toggle(row, channel, false)
  assert.deepEqual(hook.selected(row), ['mail'])
  assert.equal(ctx.calls.filter(call => call.method === 'save_api').length, 2)
})
test('停用订阅不显示已开通，失败不改变开关且允许重试', async t => {
  let failed = true
  const { hook } = await mount(t, 'useNotificationSettings', [], {
    getNoticeList_api: () => ({ data: [{ topicProvider: 'alarm', state: { value: 'disabled' }, notifyChannels: ['site', 'mail'] }] }),
    save_api: data => { if (failed) throw Error('network'); return data },
  })
  assert.deepEqual(hook.selected(row), [])
  await hook.toggle(row, channel, true)
  assert.equal(hook.failed.value, true)
  assert.deepEqual(hook.selected(row), [])
  failed = false
  await hook.toggle(row, channel, true)
  assert.deepEqual(hook.selected(row), ['site', 'mail'])
  assert.equal(hook.failed.value, false)
})
test('订阅保存串行，重复点击不会发出冲突请求', async t => {
  const pending = deferred()
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], { save_api: () => pending.promise })
  const saving = hook.toggle(row, mail, true)
  await flush()
  await hook.toggle(row, channel, false)
  assert.equal(ctx.calls.filter(call => call.method === 'save_api').length, 1)
  pending.resolve({ topicProvider: 'alarm', notifyChannels: ['site', 'mail'] })
  await saving
  assert.equal(hook.saving.value, '')
})
test('未绑定接收地址先打开既有绑定引导，绑定完成才保存订阅', async t => {
  const { hook, ctx } = await mount(t, 'useNotificationSettings')
  ctx.user.userInfo.email = ''
  await hook.toggle(row, mail, true)
  assert.equal(hook.pendingBinding.value.channel.id, 'mail')
  assert.equal(ctx.calls.some(call => call.method === 'save_api'), false)
  await hook.bindingComplete()
  assert.equal(hook.pendingBinding.value, undefined)
  assert.deepEqual(hook.selected(row), ['site', 'mail'])
})
test('通知设置只显示已启用类型，按模板顺序展示个人订阅渠道并保留关闭的类型行', async t => {
  const enabled = { ...row, state: 'enabled' }
  const disabled = { ...row, provider: 'disabled-topic', state: { value: 'disabled' } }
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], {
    getAllNotice: () => [enabled, disabled],
    getNoticeList_api: () => ({ data: [{ topicProvider: 'alarm', state: 'disabled', notifyChannels: ['site', 'mail'] }] }),
    getTypeList_api: () => [{ id: 'unconfigured-topic', name: '未启用类型' }],
  })
  assert.deepEqual(hook.providers.value.map(item => item.provider), ['alarm'])
  assert.deepEqual(hook.channelTypes.value, [
    'notifier-dingTalk', 'notifier-weixin', 'notifier-email', 'notifier-voice', 'notifier-sms',
  ])
  assert.deepEqual(hook.selected(hook.providers.value[0]), [])
  assert.equal(ctx.calls.some(call => call.method === 'getTypeList_api'), false)
  await hook.toggle(enabled, channel, true)
  assert.equal(hook.providers.value.length, 1)
  await hook.toggle(enabled, mail, false)
  assert.equal(hook.providers.value.length, 1)
})

test('只有默认站内信的已启用类型仍展示，可个人订阅渠道不补造配置', async t => {
  const configured = { ...row, id: 'announcement-provider', provider: 'bulletin', channels: [channel] }
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], { getAllNotice: () => [configured] })
  assert.equal(hook.providers.value.length, 1)
  assert.deepEqual(hook.providers.value[0].channels.map(item => item.channelProvider), ['inside-mail'])
  assert.equal(hook.channelTypes.value.length, 5)
  assert.equal(hook.channelTypes.value.includes('inside-mail'), false)
  assert.equal(ctx.calls.some(call => call.method === 'save_api'), false)
})

test('通知渠道查询失败保留旧状态并支持重试，不用类型目录补入未启用项', async t => {
  const { hook, ctx } = await mount(t, 'useNotificationSettings')
  const request = ctx.request
  ctx.request = async (method, args) => method === 'getAllNotice' ? Promise.reject(Error('channels unavailable')) : request(method, args)
  await hook.load()
  assert.equal(hook.failed.value, true)
  assert.deepEqual(hook.providers.value.map(item => item.provider), ['alarm'])
  ctx.request = request
  await hook.load()
  assert.equal(hook.failed.value, false)
})

test('WebHook 的统一发送策略不允许伪装个人订阅或触发账号绑定', async t => {
  const webhook = { id: 'webhook', name: 'WebHook', channelProvider: 'notifier-webhook', channelConfiguration: { templateId: 'webhook-template' } }
  const configured = { ...row, channels: [channel, webhook] }
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], {
    getAllNotice: () => [configured],
    getNoticeList_api: () => ({ data: [{ topicProvider: 'alarm', state: 'enabled', notifyChannels: ['site', 'webhook'] }] }),
  })
  assert.equal(hook.channelTypes.value.includes('notifier-webhook'), false)
  assert.equal(hook.channelUnavailable(webhook), 'PersonalCenter.notificationPersonalSubscriptionUnsupported')
  assert.equal(hook.channelChecked(configured, webhook), false)
  await hook.toggle(configured, webhook, true)
  assert.equal(ctx.calls.some(call => call.method === 'save_api'), false)
  assert.equal(ctx.calls.some(call => call.method === 'getIsBindThird'), false)
  assert.equal(hook.pendingBinding.value, undefined)
})

test('任意渠道均按后端接收策略决定是否显示，支持但未配置的渠道仍保留', async t => {
  const { hook } = await mount(t, 'useNotificationSettings', [], {
    getAllNotice: () => [{ ...row, channels: [channel] }],
    getNotificationChannelDefinitions_api: () => [
      { id: 'notifier-weixin', receiverPolicy: 'explicit' },
      { id: 'notifier-email', receiverPolicy: { value: 'subscriber' } },
      { id: 'notifier-sms', receiverPolicy: 'subscriber' },
      { id: 'notifier-webhook', receiverPolicy: 'explicit' },
    ],
  })
  assert.deepEqual(hook.channelTypes.value, ['notifier-email', 'notifier-sms'])
  assert.deepEqual(hook.providers.value[0].channels.map(item => item.channelProvider), ['inside-mail'])
})

test('渠道接收策略查询失败时禁用无法确认的外部开关，重试后恢复', async t => {
  let failing = true
  const definitions = [
    { id: 'notifier-email', receiverPolicy: 'subscriber' },
    { id: 'inside-mail', receiverPolicy: 'subscriber' },
  ]
  const { hook } = await mount(t, 'useNotificationSettings', [], {
    getNotificationChannelDefinitions_api: () => {
      if (failing) throw Error('channel metadata unavailable')
      return definitions
    },
  })
  assert.equal(hook.failed.value, true)
  assert.equal(hook.channelUnavailable(mail), 'PersonalCenter.notificationChannelInfoUnavailable')
  failing = false
  await hook.load()
  assert.equal(hook.failed.value, false)
  assert.equal(hook.channelUnavailable(mail), '')
})

test('通知保存保留原条件和订阅名称，并从通道所属 Provider 回填标识', async t => {
  const configured = { ...row, id: 'configured-provider' }
  const existing = {
    id: 'subscription-1', topicProvider: 'alarm', subscribeName: '原订阅',
    state: 'enabled', notifyChannels: ['site'], topicConfig: { alarmConfigId: 'rule-1', level: [1, 2] },
  }
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], {
    getAllNotice: () => [configured],
    getNoticeList_api: () => ({ data: [existing] }),
    save_api: data => [{ ...data, id: existing.id }],
  })
  const record = hook.providers.value[0]
  await hook.toggle(record, record.channels.find(item => item.id === 'mail'), true)
  const saved = ctx.calls.find(call => call.method === 'save_api').args[0]
  assert.equal(saved.providerId, configured.id)
  assert.equal(saved.subscribeName, existing.subscribeName)
  assert.deepEqual(saved.topicConfig, existing.topicConfig)
  assert.deepEqual(saved.notifyChannels, ['site', 'mail'])
  assert.deepEqual(hook.selected(record), ['site', 'mail'])
  await hook.toggle(record, record.channels.find(item => item.id === 'site'), false)
  assert.equal(ctx.calls.filter(call => call.method === 'save_api').at(-1).args[0].id, existing.id)
})

test('通知接收账号只匹配对应通知器，表头绑定成功不自动开启订阅', async t => {
  const ding = { id: 'ding', name: '总部钉钉', channelProvider: 'notifier-dingTalk', channelConfiguration: { notifierId: 'ding-notifier', templateId: 'ding-template' } }
  const configured = { ...row, channels: [ding, mail] }
  let bindings = [{ provider: 'unrelated-notifier', providerName: '其他账号' }]
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], {
    getAllNotice: () => [configured],
    getIsBindThird: () => bindings,
  })
  assert.equal(hook.receiverSummary('notifier-email'), 'test@example.test')
  assert.equal(hook.receiverSummary('notifier-dingTalk'), 'PersonalCenter.notificationUnboundReceiver')
  assert.equal(hook.canBindReceiver('notifier-dingTalk'), true)
  hook.beginReceiverBinding('notifier-dingTalk')
  assert.equal(hook.pendingBinding.value.subscribeAfterBinding, false)
  bindings = [...bindings, { provider: 'ding-notifier', providerName: '总部钉钉账号' }]
  await hook.bindingComplete()
  assert.equal(hook.receiverSummary('notifier-dingTalk'), '总部钉钉账号')
  assert.equal(hook.canBindReceiver('notifier-dingTalk'), false)
  assert.equal(ctx.calls.some(call => call.method === 'save_api'), false)
  await hook.toggle(configured, ding, true)
  assert.deepEqual(ctx.calls.find(call => call.method === 'save_api').args[0].notifyChannels, ['site', 'ding'])
})

test('通知接收账号查询失败不冒充未绑定，重试成功后允许继续操作', async t => {
  const ding = { id: 'ding', name: '钉钉', channelProvider: 'notifier-dingTalk', channelConfiguration: { notifierId: 'ding-notifier', templateId: 'ding-template' } }
  const configured = { ...row, channels: [ding] }
  let failed = true
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], {
    getAllNotice: () => [configured],
    getIsBindThird: () => {
      if (failed) throw Error('recipient unavailable')
      return [{ provider: 'ding-notifier', providerName: '钉钉接收账号' }]
    },
  })
  assert.equal(hook.recipientsFailed.value, true)
  assert.equal(hook.receiverSummary('notifier-dingTalk'), 'PersonalCenter.notificationReceiverUnavailable')
  await hook.toggle(configured, ding, true)
  assert.equal(hook.pendingBinding.value, undefined)
  assert.equal(ctx.calls.some(call => call.method === 'save_api'), false)
  failed = false
  assert.equal(await hook.loadRecipients(), true)
  assert.equal(hook.recipientsFailed.value, false)
  assert.equal(hook.receiverSummary('notifier-dingTalk'), '钉钉接收账号')
})

test('停用或缺少通知器配置的渠道不发起保存或无效绑定', async t => {
  const disabled = { ...mail, state: { value: 'disabled', text: '已停用' } }
  const incomplete = { id: 'ding', name: '钉钉', channelProvider: 'notifier-dingTalk' }
  const configured = { ...row, channels: [disabled, incomplete] }
  const { hook, ctx } = await mount(t, 'useNotificationSettings', [], { getAllNotice: () => [configured] })
  assert.equal(hook.channelUnavailable(disabled), 'PersonalCenter.notificationChannelDisabled')
  assert.equal(hook.channelUnavailable(incomplete), 'PersonalCenter.notificationChannelIncomplete')
  await hook.toggle(configured, disabled, true)
  await hook.toggle(configured, incomplete, true)
  hook.beginReceiverBinding('notifier-dingTalk')
  assert.equal(hook.pendingBinding.value, undefined)
  assert.equal(ctx.calls.some(call => call.method === 'save_api'), false)
})

test('通知查询或保存显式失败时保留已有渠道与开关，重试后可恢复', async t => {
  const { hook, ctx } = await mount(t, 'useNotificationSettings')
  const request = ctx.request
  ctx.request = async (method, args) => method === 'getAllNotice'
    ? { success: false, status: 200, result: [] }
    : request(method, args)
  await hook.load()
  assert.equal(hook.failed.value, true)
  assert.equal(hook.providers.value[0].provider, 'alarm')
  ctx.request = async (method, args) => method === 'save_api'
    ? { success: false, status: 200, result: true }
    : request(method, args)
  await hook.toggle(row, mail, true)
  assert.equal(hook.failed.value, true)
  assert.deepEqual(hook.selected(row), ['site'])
  ctx.request = request
  await hook.load()
  assert.equal(hook.failed.value, false)
})

test('验证码对应原始身份，改地址后不能用旧验证码确认', async t => {
  const { hook, ctx } = await mount(t, 'useIdentityBinding', ['email', true])
  hook.identity.value = 'first@example.test'
  await hook.sendCode()
  assert.equal(hook.validation.value.identity, 'first@example.test')
  hook.code.value = '123456'
  hook.identity.value = 'second@example.test'
  await flush()
  await hook.confirm()
  assert.equal(ctx.calls.some(call => call.method === 'confirmIdentityValidation_api'), false)
  await hook.sendCode()
  hook.code.value = '123456'
  await hook.confirm()
  assert.equal(ctx.calls.filter(call => call.method === 'confirmIdentityValidation_api').length, 1)
  assert.equal(hook.validation.value, undefined)
})
test('验证码请求失败后保留输入并支持重试', async t => {
  let failed = true
  const { hook } = await mount(t, 'useIdentityBinding', ['mobile', true], {
    requestIdentityValidation_api: () => { if (failed) throw Error('network'); return { requestId: 'new', token: 'test-only', intervalSeconds: 0 } },
  })
  hook.identity.value = 'invalid'
  await hook.sendCode()
  assert.equal(hook.validation.value, undefined)
  hook.identity.value = '13800001234'
  await hook.sendCode()
  assert.equal(hook.failed.value, true)
  assert.equal(hook.identity.value, '13800001234')
  failed = false
  await hook.sendCode()
  assert.equal(hook.failed.value, false)
  assert.equal(hook.validation.value.requestId, 'new')
})
test('资料编辑保留其他字段，失败可重新保存并支持恢复默认头像', async t => {
  let failed = true
  const profile = () => ({ canEdit: true, items: [], name: 'Tester' })
  const { hook, ctx } = await mount(t, 'useBasicProfile', [profile], {
    updateMeInfo_api: data => { if (failed) throw Error('network'); return data },
  })
  await hook.saveName(' Updated ')
  assert.equal(hook.saveError.value, true)
  failed = false
  await hook.saveName(' Updated ')
  const payload = ctx.calls.filter(call => call.method === 'updateMeInfo_api').at(-1).args[0]
  assert.equal(payload.name, 'Updated')
  assert.equal(payload.email, 'test@example.test')
  await hook.saveAvatar('')
  assert.equal(ctx.calls.at(-1).args[0].avatar, '')
})
test('消息按实际 provider 分为通知和公告，顶部定位与手动切换互不覆盖', async t => {
  const second = { ...row, provider: 'task', type: { id: 'task', name: '任务' } }
  const bulletin = { ...row, provider: 'bulletin', type: { id: 'bulletin', name: '公告' } }
  const { hook, ctx } = await mount(t, 'useStationMessage', [], {
    getAllNotice: () => [row, second, bulletin],
    getUnreadSummary_api: () => ({ topics: [
      { topicProvider: 'alarm', count: 2 }, { topicProvider: 'task', count: 1 }, { topicProvider: 'bulletin', count: 4 },
    ] }),
  })
  assert.deepEqual(hook.tabs.value.map(tab => [tab.key, tab.children.map(item => item.provider)]), [
    ['notification', ['alarm', 'task']], ['announcement', ['bulletin']],
  ])
  assert.equal(hook.countFor('notification'), 3)
  assert.equal(hook.countFor('announcement'), 4)
  ctx.user.messageInfo = { id: 'notice', topicProvider: 'bulletin' }
  await flush()
  assert.equal(hook.activeKey.value, 'announcement')
  hook.selectCategory('notification')
  await flush()
  assert.equal(hook.activeKey.value, 'notification')
  ctx.user.other.tabKey = 'bulletin'
  await flush()
  assert.equal(hook.activeKey.value, 'announcement')
  assert.equal(hook.requestedType.value.id, 'bulletin')
  hook.clearRequestedType(hook.requestedType.value.sequence)
  ctx.user.other.tabKey = 'task'
  await flush()
  assert.equal(hook.activeKey.value, 'notification')
  assert.equal(hook.requestedType.value.id, 'task')
  assert.equal(await hook.markAllRead(), true)
  assert.deepEqual(ctx.calls.find(call => call.method === 'changeAllStatus').args, [
    '_read', ['alarm', 'task', 'bulletin'],
  ])
})

test('没有通知通道时用真实类型目录补齐候选，筛选与表头都叫类型', async t => {
  const catalog = [
    { id: 'alarm-device', name: '设备告警', type: { id: 'alarm', name: '告警通知' } },
    { id: 'alarm-product', name: '产品告警', type: { id: 'alarm', name: '告警通知' } },
    { id: 'task-export', name: '导出任务', type: { id: 'task', name: '任务通知' } },
    { id: 'system-event', name: '系统事件', type: { id: 'system', name: '系统通知' } },
    { id: 'bulletin', name: '系统公告', type: { id: 'bulletin', name: '系统公告' } },
  ]
  const center = await mount(t, 'useStationMessage', [], {
    getAllNotice: () => [],
    getTypeList_api: () => catalog,
  })
  assert.equal(center.hook.failed.value, false)
  const notification = center.hook.tabs.value.find(tab => tab.key === 'notification')
  assert.deepEqual(notification.children.map(item => item.provider), ['alarm-device', 'alarm-product', 'task-export', 'system-event'])
  assert.deepEqual(center.hook.tabs.value.find(tab => tab.key === 'announcement').children.map(item => item.provider), ['bulletin'])
  const { hook, exports: model } = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: notification.children }, () => {},
  ])
  const field = hook.filterFields.value.find(item => item.dataIndex === 'topicProvider')
  assert.equal(field.title, hook.columns.value.find(item => item.dataIndex === 'topicProvider').title)
  assert.deepEqual(field.search.options, [
    { label: '告警通知', value: 'alarm' },
    { label: '任务通知', value: 'task' },
    { label: '系统通知', value: 'system' },
  ])
  assert.deepEqual(model.buildQueryFilter([{ column: 'topicProvider', termType: 'eq', value: 'alarm' }], hook.filterFields.value).terms, [
    { column: 'topicProvider', termType: 'in', value: ['alarm-device', 'alarm-product'] },
  ])
})

test('类型目录与通道来源合并时不重复，目录失败仍保留现有来源并可重试', async t => {
  let failing = false
  const { hook } = await mount(t, 'useStationMessage', [], {
    getAllNotice: () => [row],
    getTypeList_api: () => {
      if (failing) throw new Error('catalog unavailable')
      return [{ id: 'alarm', name: '目录告警', type: row.type }]
    },
  })
  assert.equal(hook.tabs.value.find(tab => tab.key === 'notification').children.length, 1)
  assert.equal(hook.tabs.value.find(tab => tab.key === 'notification').children[0].name, row.name)
  failing = true
  await hook.load()
  assert.equal(hook.failed.value, true)
  assert.deepEqual(hook.tabs.value.find(tab => tab.key === 'notification').children.map(item => item.provider), ['alarm'])
  failing = false
  await hook.load()
  assert.equal(hook.failed.value, false)
})

test('顶部查看更多的原分类参数优先定位对应消息类型', async t => {
  const task = { ...row, provider: 'task', type: { id: 'task', name: '任务' } }
  const { hook } = await mount(t, 'useStationMessage', [], {
    __params: { other: { tabKey: 'task' } },
    getAllNotice: () => [row, task],
  })
  assert.equal(hook.activeKey.value, 'notification')
  assert.equal(hook.requestedType.value.id, 'task')
})

test('系统已注册公告时，通知通道为空也保留公告页签和真实查询范围', async t => {
  const center = await mount(t, 'useStationMessage', [], { getAllNotice: () => [] })
  assert.deepEqual(center.hook.tabs.value.map(tab => tab.key), ['notification', 'announcement'])
  const announcement = center.hook.tabs.value.find(tab => tab.key === 'announcement')
  assert.deepEqual(announcement.children.map(item => item.provider), ['bulletin'])
  assert.equal(center.hook.countFor('announcement'), 0)
  center.hook.selectCategory('announcement')
  assert.equal(center.hook.activeKey.value, 'announcement')

  const items = [{ id: 'announcement-1', topicProvider: 'bulletin', state: { value: 'unread' }, message: '公告内容' }]
  const records = await mount(t, 'useNotificationRecords', [
    { category: 'announcement', children: announcement.children }, () => {},
  ], { getList_api: () => ({ data: items, total: 1 }) })
  const response = await records.hook.requestNotifications({
    pageIndex: 0, pageSize: 12,
    terms: [...records.hook.defaultParams.value.terms, ...records.hook.queryParams.value.terms],
  })
  assert.deepEqual(response.result.data, items)
  assert.deepEqual(records.ctx.calls.find(call => call.method === 'getList_api').args[0].terms[0], {
    column: 'topicProvider', termType: 'in', value: ['bulletin'],
  })
})

test('通知通道查询失败时保留已注册的公告入口并报告错误', async t => {
  const { hook } = await mount(t, 'useStationMessage', [], {
    getAllNotice: () => { throw new Error('channels unavailable') },
  })
  assert.equal(hook.failed.value, true)
  assert.deepEqual(hook.tabs.value.map(tab => tab.key), ['notification', 'announcement'])
})

test('没有可访问消息来源时保留空列表，且不发出无范围查询或全部已读', async t => {
  const center = await mount(t, 'useStationMessage', [], { getAllNotice: () => [], __registeredProviders: [] })
  assert.deepEqual(center.hook.tabs.value.map(tab => tab.key), ['notification'])
  assert.equal(center.hook.hasProviders.value, false)
  assert.equal(await center.hook.markAllRead(), false)
  assert.equal(center.ctx.calls.some(call => call.method === 'changeAllStatus'), false)

  const records = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [] }, () => {},
  ])
  assert.deepEqual(records.hook.filterFields.value.find(field => field.dataIndex === 'topicProvider').search.options, [])
  const response = await records.hook.requestNotifications({ pageIndex: 0, pageSize: 12 })
  assert.deepEqual(response.result.data, [])
  assert.equal(response.result.total, 0)
  assert.equal(records.ctx.calls.some(call => call.method === 'getList_api'), false)
})

test('平台筛选默认清空，支持显式条件回填和主动清除', async t => {
  const second = { ...row, provider: 'alarm-device' }
  const saved = []
  const { hook, exports: model } = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [row, second] }, state => saved.push(state),
  ])
  assert.deepEqual(hook.filterFields.value.map(field => field.dataIndex), ['message', 'topicProvider', 'state', 'notifyTime'])
  const time = hook.filterFields.value.find(field => field.dataIndex === 'notifyTime')
  assert.deepEqual(time.search.options.map(item => item.value), ['today', '7', '30'])
  assert.deepEqual(hook.queryParams.value.terms, [])
  assert.deepEqual(hook.filterTerms.value, [])
  const terms = [
    { column: 'state', termType: 'eq', value: 'read' },
    { column: 'topicProvider', termType: 'eq', value: 'alarm', type: 'and' },
  ]
  const filter = model.buildQueryFilter(terms, hook.filterFields.value)
  assert.deepEqual(filter.terms, [
    { column: 'state', termType: 'eq', value: 'read' },
    { column: 'topicProvider', termType: 'in', value: ['alarm', 'alarm-device'], type: 'and' },
  ])
  hook.filterTerms.value = terms
  hook.onFilterChange({ terms, filter, where: '' })
  const snapshot = saved.at(-1)
  const restored = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [row, second], savedFilter: snapshot }, () => {},
  ])
  assert.deepEqual(restored.hook.filterTerms.value, terms)
  assert.deepEqual(restored.hook.queryParams.value, filter)
  const freshCategory = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [row, second] }, () => {},
  ])
  assert.deepEqual(freshCategory.hook.filterTerms.value, [])
  assert.deepEqual(freshCategory.hook.queryParams.value.terms, [])
  hook.filterTerms.value = []
  hook.onFilterChange({ terms: [], filter: { terms: [] }, where: '' })
  assert.deepEqual(hook.queryParams.value.terms, [])
})

test('原型时间选项通过平台筛选映射为自然日范围，内容包含查询保持转义和分页', async t => {
  const { hook, ctx, exports: model } = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [row] }, () => {},
  ])
  for (const [value, days] of [['today', 1], ['7', 7], ['30', 30]]) {
    const query = model.buildQueryFilter([{ column: 'notifyTime', termType: 'eq', value }], hook.filterFields.value)
    const today = dayjs().startOf('day')
    assert.deepEqual(query.terms, [{
      column: 'notifyTime', termType: 'btw',
      value: [today.subtract(days - 1, 'day').valueOf(), today.endOf('day').valueOf()],
    }])
  }
  const query = model.buildQueryFilter([{ column: 'message', termType: 'like', value: '50%' }], hook.filterFields.value)
  assert.deepEqual(query.terms, [
    { column: 'message', termType: 'like', value: '%50' + String.fromCharCode(92) + '%%' },
  ])
  await hook.requestNotifications({ pageIndex: 2, pageSize: 20, terms: query.terms })
  assert.equal(ctx.calls.find(call => call.method === 'getList_api').args[0].pageIndex, 2)
})

test('顶部通知分类跳转只回填来源，不附加未读条件', async t => {
  const second = { ...row, provider: 'alarm-device' }
  const saved = [], consumed = []
  const { hook } = await mount(t, 'useNotificationRecords', [
    {
      category: 'notification', children: [row, second],
      requestedType: { category: 'notification', id: 'alarm', sequence: 3 },
    },
    state => saved.push(state),
    sequence => consumed.push(sequence),
  ])
  assert.deepEqual(hook.queryParams.value.terms, [
    { column: 'topicProvider', termType: 'in', value: ['alarm', 'alarm-device'], type: 'and' },
  ])
  assert.equal(hook.filterTerms.value[0].value, 'alarm')
  assert.deepEqual(consumed, [3])
  assert.deepEqual(saved[0].params.terms, hook.queryParams.value.terms)
})

test('消息所选批量标记只提交选中 ID，失败保留选择并提示', async t => {
  const { hook, ctx } = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [row] }, () => {},
  ])
  assert.equal(await hook.markSelected('_read'), false)
  assert.equal(ctx.calls.filter(call => call.method === 'changeStatus_api').length, 0)
  hook.rowSelection.value.onChange(['one', 'two'])
  const request = ctx.request
  ctx.request = async (method, args) => method === 'changeStatus_api'
    ? { success: false, status: 200 }
    : request(method, args)
  assert.equal(await hook.markSelected('_read'), false)
  assert.equal(hook.failed.value, true)
  assert.deepEqual(hook.selectedIds.value, ['one', 'two'])
  ctx.request = request
  assert.equal(await hook.markSelected('_unread'), true)
  assert.deepEqual(ctx.calls.filter(call => call.method === 'changeStatus_api').at(-1).args, ['_unread', ['one', 'two']])
  assert.deepEqual(hook.selectedIds.value, [])
  assert.equal(ctx.user.alarmUpdateCount, 1)
})

test('顶部通知定位打开真实详情，不重复更改已读状态', async t => {
  const { hook, ctx } = await mount(t, 'useNotificationRecords', [
    { category: 'notification', children: [row] }, () => {},
  ])
  ctx.user.messageInfo = { id: 'incoming', topicProvider: 'alarm', state: { value: 'unread' }, message: '测试消息' }
  await flush()
  assert.equal(hook.viewVisible.value, true)
  assert.equal(hook.viewItem.value.id, 'incoming')
  assert.equal(ctx.calls.some(call => call.method === 'changeStatus_api'), false)
  assert.deepEqual(ctx.user.messageInfo, {})
})
test('令牌状态包含永久、临期、过期与缺失日期，不显示虚构使用记录', async t => {
  const { exports: model } = await mount(t, 'useNotificationSettings')
  const now = 1700000000000
  assert.equal(model.tokenStatus({ expires: -1 }, now).key, 'PersonalCenter.valid')
  assert.equal(model.tokenStatus({ expires: now + 86400000 }, now).key, 'PersonalCenter.expiring')
  assert.equal(model.tokenStatus({ expires: now - 1 }, now).key, 'PersonalCenter.expired')
  assert.equal(model.tokenStatus({}, now).key, 'comm.table.empty')
  assert.equal(model.tokenDate(null), '—')
})

test('扫码绑定必须等待绑定记录读回，成功事件本身不代表绑定完成', async t => {
  let bound = false
  const { hook, ctx } = await mount(t, 'useSsoBindings', [], {
    getSsoBinds_api: () => [{ id: 'wechat', name: '微信', provider: 'wechat-official-account', bound, features: ['ssoUnsupportedRedirect'] }],
  })
  assert.equal(hook.bindings.value.length, 1)
  hook.bind(hook.bindings.value[0])
  ctx.streams[0].next({ type: 'init', result: 'https://example.test/authorization' })
  assert.equal(hook.bindingState.value, 'active')
  ctx.streams[0].next({ type: 'success', result: { bound: true } })
  await flush()
  assert.equal(hook.bindingState.value, 'failed')
  hook.bind(hook.bindings.value[0])
  bound = true
  ctx.streams[1].next({ type: 'success', result: { bound: true } })
  await flush()
  assert.equal(hook.binding.value, undefined)
  assert.equal(ctx.streams[1].observed, false)
})
test('取消扫码绑定会清理订阅，旧事件不能影响重试', async t => {
  const { hook, ctx } = await mount(t, 'useSsoBindings')
  const item = hook.bindings.value[0]
  hook.bind(item)
  const previous = ctx.streams[0]
  hook.closeBinding()
  assert.equal(previous.observed, false)
  hook.bind(item)
  previous.next({ type: 'success', result: { bound: true } })
  assert.equal(hook.bindingState.value, 'loading')
  ctx.streams[1].complete()
  assert.equal(hook.bindingState.value, 'expired')
  hook.closeBinding()
})

test('基本信息展示接口最近登录时间，不用活跃时间或空值冒充', async t => {
  const { hook, ctx, exports: model } = await mount(t, 'useBasicProfile', [() => ({ canEdit: true, items: [] })])
  ctx.user.userInfo.lastRequestTime = 1800000000000
  assert.equal(hook.fields.value.some(field => field.key === 'loginTime'), false)
  ctx.user.userInfo.loginInfo = { loginTime: 1700000000000 }
  const field = hook.fields.value.find(item => item.key === 'loginTime')
  assert.equal(field.label, 'PersonalCenter.latestLogin')
  assert.ok(field.value.startsWith(model.tokenDate(1700000000000)))
  ctx.user.userInfo.loginInfo = { loginTime: 0 }
  assert.equal(hook.fields.value.some(item => item.key === 'loginTime'), false)
  ctx.user.userInfo.loginInfo = { loginTime: NaN }
  assert.equal(hook.fields.value.some(item => item.key === 'loginTime'), false)
})

test('单点登录保留接口返回的全部绑定状态，仅允许支持的入口发起绑定', async t => {
  const getBindings = () => [
    { id: 'legacy-bound', name: '旧账号', provider: 'legacy', bound: true, features: ['ssoUnsupportedRedirect'] },
    { id: 'legacy-unbound', name: '旧入口', provider: 'legacy', bound: false, features: ['ssoUnsupportedRedirect'] },
    { id: 'wechat', name: '微信', provider: 'wechat-official-account', bound: false, features: ['ssoUnsupportedRedirect'] },
    { id: 'dingtalk', name: '钉钉', provider: 'dingtalk-ent-app', bound: false, features: ['ssoUnsupportedRedirect'] },
    { id: 'oauth', name: '标准入口', provider: 'oauth', bound: false, features: [] },
  ]
  const { hook, ctx } = await mount(t, 'useSsoBindings', [], { getSsoBinds_api: getBindings })
  assert.deepEqual(hook.bindings.value.map(item => [item.id, item.bound]), [
    ['legacy-bound', true], ['legacy-unbound', false], ['wechat', false], ['dingtalk', false], ['oauth', false],
  ])
  assert.equal(hook.boundCount.value, 1)
  const item = id => hook.bindings.value.find(binding => binding.id === id)
  assert.equal(hook.canBindSso(item('legacy-unbound')), false)
  assert.equal(hook.canBindSso(item('wechat')), true)
  assert.equal(hook.canBindSso(item('dingtalk')), true)
  assert.equal(hook.canBindSso(item('oauth')), true)
  let redirects = 0
  ctx.window.open = () => { redirects += 1 }
  hook.bind(item('legacy-unbound'))
  assert.equal(redirects, 0)
  assert.equal(ctx.calls.filter(call => call.method === 'binding.start').length, 0)
  hook.bind(item('dingtalk'))
  assert.equal(ctx.calls.filter(call => call.method === 'binding.start').length, 1)
  hook.closeBinding()
})

test('单点登录接口返回空数组时不标记为查询失败', async t => {
  const { hook } = await mount(t, 'useSsoBindings', [], { getSsoBinds_api: () => [] })
  assert.deepEqual(hook.bindings.value, [])
  assert.equal(hook.failed.value, false)
})

test('单点绑定接口失败时报告错误并可恢复，不能误报未绑定', async t => {
  let failing = false
  const rows = [{ id: 'one', name: '账号', provider: 'oauth', bound: true, features: [] }]
  const { hook } = await mount(t, 'useSsoBindings', [], {
    getSsoBinds_api: () => {
      if (failing) throw new Error('network')
      return rows
    },
  })
  assert.equal(hook.bindings.value[0].bound, true)
  failing = true
  await hook.load()
  assert.equal(hook.failed.value, true)
  assert.equal(hook.bindings.value[0].bound, true)
  failing = false
  await hook.load()
  assert.equal(hook.failed.value, false)
})

test('绑定查询返回失败或无效数据时保留已有状态并提供重试', async t => {
  const { hook, ctx } = await mount(t, 'useSsoBindings', [], {
    getSsoBinds_api: () => [{ id: 'one', name: '账号', provider: 'oauth', bound: true, features: [] }],
  })
  const request = ctx.request
  ctx.request = async (method, args) => method === 'getSsoBinds_api'
    ? { success: false, status: 200, result: [] }
    : request(method, args)
  await hook.load()
  assert.equal(hook.failed.value, true)
  assert.equal(hook.bindings.value[0].bound, true)
  ctx.request = async (method, args) => method === 'getSsoBinds_api'
    ? { success: true, status: 200, result: null }
    : request(method, args)
  await hook.load()
  assert.equal(hook.failed.value, true)
  assert.equal(hook.bindings.value[0].bound, true)
  ctx.request = request
  await hook.load()
  assert.equal(hook.failed.value, false)
})

test('单点绑定列表兼容接口直接返回的数组', async t => {
  const { hook, ctx } = await mount(t, 'useSsoBindings')
  const request = ctx.request
  ctx.request = async (method, args) => method === 'getSsoBinds_api'
    ? [{ id: 'direct', name: '直接返回', provider: 'oauth', bound: true, features: [] }]
    : request(method, args)
  await hook.load()
  assert.equal(hook.failed.value, false)
  assert.equal(hook.bindings.value[0].id, 'direct')
  assert.equal(hook.bindings.value[0].bound, true)
})

test('安全设置读取登录记录与真实密码更新时间，结果缺失不猜成功', async t => {
  const { hook } = await mount(t, 'useSecuritySettings', [], {
    getSelfLoginRecords_api: () => ({ data: [
      { id: 'ok', createTime: 1700000000000, ip: '192.0.2.1', exception: '' },
      { id: 'failed', createTime: 1690000000000, exception: 'Authentication failed' },
      { id: 'legacy', createTime: 1680000000000 },
    ] }),
    getPasswordChangeSetting_api: () => ({ content: '1700000000000' }),
  })
  assert.equal(hook.records.value.length, 3)
  assert.equal(hook.resultOf(hook.records.value[0]), 'success')
  assert.equal(hook.resultOf(hook.records.value[1]), 'failure')
  assert.equal(hook.resultOf(hook.records.value[2]), 'unknown')
  assert.match(hook.passwordChangedAt.value, /^\d{4}-\d{2}-\d{2} /)
  assert.equal(hook.formatTime(undefined), '—')
})
test('日志与密码信息独立失败、保留旧值并可重试，迟到响应不覆盖新结果', async t => {
  let fail = false
  let pending
  const { hook } = await mount(t, 'useSecuritySettings', [], {
    getSelfLoginRecords_api: () => {
      if (pending) { const result = pending; pending = undefined; return result.promise }
      if (fail) throw Error('unavailable')
      return { data: [{ id: 'latest', exception: '' }] }
    },
    getPasswordChangeSetting_api: () => ({ content: '1700000000000' }),
  })
  fail = true
  await hook.load()
  assert.equal(hook.recordsFailed.value, true)
  assert.equal(hook.records.value[0].id, 'latest')
  assert.notEqual(hook.passwordChangedAt.value, '')
  fail = false
  pending = deferred()
  const old = pending
  const first = hook.load()
  await hook.load()
  old.resolve({ data: [{ id: 'old', exception: '' }] })
  await first
  assert.equal(hook.records.value[0].id, 'latest')
  assert.equal(hook.recordsFailed.value, false)
})
