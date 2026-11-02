import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { build } from 'esbuild'
import { createRenderer, defineComponent, h, reactive } from 'vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const stubs = {
  'vue-i18n': 'import {ref} from "vue";const locale=ref("zh");export const useI18n=()=>({t:key=>key,locale})',
  'vue-router': 'export const useRoute=()=>globalThis.__notice.route',
  'ant-design-vue': 'export const Button={},notification={open:value=>globalThis.__notice.tips.push(value),close:()=>{}}',
  '@jetlinks-web-core/hooks': 'export const useWebSocket=options=>{globalThis.__notice.onMessage=options.onMessage;return {send:(...args)=>globalThis.__notice.subscriptions.push(args)}}',
  '@jetlinks-web-core/store/user': 'export const useUserStore=()=>globalThis.__notice.user',
  '@jetlinks-web-core/store/menu': 'export const useMenuStore=()=>({routerPush:(...args)=>globalThis.__notice.navigations.push(args)})',
  '@jetlinks-web-core/api/account/center': 'export const getReceivedNoticeProviders=()=>globalThis.__notice.channels()',
  '@jetlinks-web-core/api/account/notificationSubscription': 'export const getTypeList_api=()=>globalThis.__notice.types()',
  '@jetlinks-web-core/utils/components-registry': 'export const componentsRegistry={getRegistry:key=>key==="notification-provider:default"?globalThis.__notice.registrations:[]}',
  './noticeListHandler': `
    export const queryNoticeUnreadSummary=async(_providers,params)=>{const response=await globalThis.__notice.count(params);if(response?.success===false)return response;return {status:200,success:true,result:{total:response.result?.total || response.result}}};
    export const queryNoticeRecordsNoPaging=(_providers,params)=>globalThis.__notice.list(params);
    export const changeNoticeReadState=(...args)=>globalThis.__notice.mark(...args);
    export const useNoticeDataSourceChanges=()=>{};
    export const useNoticeDataSourceRealtime=()=>{};
  `,
  './noticeLoginHandler': 'export const runRegisteredLoginNoticeHandlers=async()=>{}',
  './noticeRealtimeHandler': 'export const handleRegisteredRealtimeNotice=async(payload,context)=>globalThis.__notice.handler?.(payload,context) ?? false',
}
const output = await build({
  entryPoints: [resolve(root, 'src/layout/components/useHeaderNotice.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  plugins: [{ name: 'notice-io', setup(builder) {
    builder.onResolve({filter: /.*/}, args => stubs[args.path] === undefined ? undefined : {path: args.path, namespace: 'io'})
    builder.onLoad({filter: /.*/, namespace: 'io'}, args => ({contents: stubs[args.path]}))
  }}]
})
const module = {exports: {}}
new Function('require', 'module', 'exports', output.outputFiles[0].text)(require, module, module.exports)
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, patchProp() {}, insert() {}, remove() {}, parentNode: () => null, nextSibling: () => null
})
const channelResult = {status: 200, result: [
  {type: {id: 'alarm', name: 'Alarm'}, provider: 'a'},
  {type: {id: 'alarm', name: 'Alarm'}, provider: 'b'}
]}
function fixture(t, overrides = {}, listProps) {
  const state = {user: reactive({alarmUpdateCount: 0, unreadNoticeCount: 0, other: {}, updateAlarm() {this.alarmUpdateCount++}}),
    tips: [], subscriptions: [], navigations: [], registrations: [], route: reactive({path: '/devices'}), actions: 0,
    channels: async () => channelResult, types: async () => ({result: []}), list: async () => ({result: []}),
    count: async () => ({result: {count: 42}}), mark: async () => ({status: 200}), ...overrides}
  globalThis.__notice = state
  let model
  const app = renderer.createApp(defineComponent({setup() {model = listProps ? module.exports.useNoticeInfo(listProps, () => state.actions++) : module.exports.useHeaderNotice(); return () => h('div')}}))
  app.mount({}); t.after(() => app.unmount())
  return {state, model}
}

test('channel failure is handled and retry restores real tabs, subscription and badge', async t => {
  const {state, model} = fixture(t, {channels: async () => {throw new Error('service unavailable')}})
  await setImmediate()
  assert.equal(model.error.value, true)
  assert.equal(model.loading.value, false)
  state.channels = async () => channelResult
  await model.retry()
  assert.equal(model.error.value, false)
  assert.deepEqual(model.tabs.value[0].type, ['a', 'b'])
  assert.equal(model.total.value, 42)
  assert.equal(state.subscriptions.length, 1)
})

test('failed unread refresh preserves the last badge and a later retry clears the error', async t => {
  const {state, model} = fixture(t)
  await setImmediate()
  state.count = async () => {throw new Error('count failed')}
  state.user.alarmUpdateCount++
  await setImmediate()
  assert.equal(model.error.value, true)
  assert.equal(model.total.value, 42)
  assert.equal(model.loading.value, false)
  state.count = async () => ({result: {count: 3}})
  await model.retry()
  assert.equal(model.total.value, 3)
  assert.equal(model.error.value, false)
})

test('no configured channels is an empty state without a count query or subscription', async t => {
  const {state, model} = fixture(t, {channels: async () => ({status: 200, result: []}), count: () => assert.fail('unexpected count query')})
  await setImmediate()
  assert.equal(model.error.value, false)
  assert.equal(model.total.value, 0)
  assert.equal(state.subscriptions.length, 0)
})

test('failed mark-read is handled without navigating as though it succeeded', async t => {
  const {state, model} = fixture(t, {mark: async () => {throw new Error('read failed')}})
  await setImmediate()
  await state.onMessage({payload: {id: 'notice', topicName: 'Alarm', message: 'Test'}})
  await state.tips[0].onClick()
  assert.equal(model.error.value, true)
  assert.deepEqual(state.navigations, [])
})


test('opening the dropdown and receiving a notification refresh its list as well as the badge', async t => {
  const {state, model} = fixture(t)
  await setImmediate()
  let refreshes = 0
  model.noticeInfoRef.value = {refresh: () => {refreshes++}}
  model.visible.value = true
  await setImmediate()
  assert.equal(refreshes, 1)
  state.count = async () => ({result: {count: 7}})
  await state.onMessage({payload: {id: 'new-notice', topicName: 'Alarm', message: 'New'}})
  await setImmediate()
  assert.equal(refreshes, 2)
  assert.equal(model.total.value, 7)
  await state.onMessage({payload: {message: 'missing id'}})
  assert.equal(refreshes, 2)
})

test('header groups real types and registered announcements even without delivery channels', async t => {
  const {state, model} = fixture(t, {
    channels: async () => ({result: []}),
    types: async () => ({result: [{id: 'security', name: 'Security', type: {id: 'system', name: 'System'}}]}),
    registrations: [{code: 'bulletin', props: {messageCategory: 'announcement'}}],
  })
  await setImmediate()
  assert.deepEqual(model.tabs.value.map(tab => [tab.key, tab.type]), [
    ['notification', ['security']], ['announcement', ['bulletin']],
  ])
  assert.equal(model.providerNames.value.security, 'System')
  assert.equal(model.providerNames.value.bulletin, 'PersonalCenter.messageAnnouncement')
  assert.equal(state.subscriptions.length, 1)
  await model.retry()
  assert.equal(state.subscriptions.length, 1)
})

test('partial catalog failure keeps its error and preserves already known providers', async t => {
  const {state, model} = fixture(t)
  await setImmediate()
  state.channels = async () => {throw Error('channels unavailable')}
  await model.retry()
  assert.equal(model.error.value, true)
  assert.deepEqual(model.tabs.value[0].type, ['a', 'b'])
  assert.equal(model.total.value, 42)
})

test('failed count envelopes retain the badge instead of changing it to zero', async t => {
  const {state, model} = fixture(t)
  await setImmediate()
  state.count = async () => ({success: false})
  state.user.alarmUpdateCount++
  await setImmediate()
  assert.equal(model.total.value, 42)
  assert.equal(model.error.value, true)
})

const listProps = () => reactive({tabs: [
  {key: 'notification', tab: 'Notifications', type: ['security']},
  {key: 'announcement', tab: 'Announcements', type: ['bulletin']},
]})

test('list failure is retryable and is distinct from a successful empty result', async t => {
  const {state, model} = fixture(t, {list: async () => {throw Error('list unavailable')}}, listProps())
  await setImmediate()
  assert.equal(model.failed.value, true)
  assert.equal(model.loading.value, false)
  state.list = async () => ({result: []})
  await model.refresh()
  assert.equal(model.failed.value, false)
  assert.deepEqual(model.list.value, [])
})

test('a late response cannot replace the active message category', async t => {
  let release
  const {model} = fixture(t, {list: params => params.terms[0].terms[0].value.includes('security')
    ? new Promise(resolve => {release = resolve})
    : Promise.resolve({result: [{id: 'announcement', topicProvider: 'bulletin'}]})}, listProps())
  await setImmediate()
  model.activeKey.value = 'announcement'
  await setImmediate()
  release({result: [{id: 'old-security'}]})
  await setImmediate()
  assert.deepEqual(model.list.value.map(item => item.id), ['announcement'])
})

test('empty provider groups invalidate pending requests and never query all notifications', async t => {
  let release
  let queries = 0
  const props = listProps()
  const {model} = fixture(t, {list: () => {queries++;return new Promise(resolve => {release=resolve})}}, props)
  await setImmediate()
  props.tabs = [{key: 'notification', tab: 'Notifications', type: []}]
  await setImmediate()
  release({result: [{id: 'late'}]})
  await setImmediate()
  assert.equal(queries, 1)
  assert.deepEqual(model.list.value, [])
  assert.equal(model.loading.value, false)
})

test('row and footer navigation retain the active category and close the panel', async t => {
  const {state, model} = fixture(t, {}, listProps())
  await setImmediate()
  model.activeKey.value = 'announcement'
  await setImmediate()
  const record = {id: 'bulletin-1', topicProvider: 'bulletin'}
  await model.selectNotice(record)
  assert.deepEqual(state.navigations[0], ['account/center', {params: {
    tabKey: 'StationMessage', other: {tabKey: 'announcement'}, row: record,
  }}])
  model.openMessageCenter()
  assert.deepEqual(state.navigations[1][1].params, {tabKey: 'StationMessage', other: {tabKey: 'announcement'}})
  assert.equal(state.actions, 2)
  state.route.path = '/account/center'
  model.openMessageCenter()
  assert.equal(state.user.tabKey, 'StationMessage')
  assert.equal(state.user.other.tabKey, 'announcement')
  assert.deepEqual(state.user.messageInfo, {})
})

test('registered details keep their handler and a failed read never falls through to navigation', async t => {
  const {state, model} = fixture(t, {
    handler: async (_record, context) => {try {await context.markRead();return true}catch{return false}},
    mark: async () => {throw Error('read rejected')},
  }, listProps())
  await setImmediate()
  await model.selectNotice({id: 'announcement', topicProvider: 'bulletin'})
  assert.equal(model.failed.value, true)
  assert.deepEqual(state.navigations, [])
  assert.equal(state.actions, 0)
  state.mark = async () => ({status: 200})
  await model.selectNotice({id: 'announcement', topicProvider: 'bulletin'})
  assert.equal(state.user.alarmUpdateCount, 1)
  assert.equal(state.actions, 1)
  assert.deepEqual(state.navigations, [])
})

test('announcement dropdown queries effective unread records without appending registered read history', async t => {
  let historyQueries = 0
  const queries = []
  const unread = [
    {id: 'new-bulletin', topicProvider: 'bulletin', state: {value: 'unread'}, notifyTime: 2},
    {id: 'older-unread-bulletin', topicProvider: 'bulletin', state: 'unread', notifyTime: 1},
  ]
  const {state, model} = fixture(t, {
    registrations: [{code: 'bulletin', props: {listHandler: async () => {
      historyQueries++
      return [...unread, {id: 'read-bulletin', topicProvider: 'bulletin', state: 'read'}]
    }}}],
    list: async params => {
      queries.push(params)
      return {result: params.terms[0].terms[0].value.includes('bulletin') ? unread : []}
    },
  }, listProps())
  await setImmediate()
  model.activeKey.value = 'announcement'
  await setImmediate()
  assert.equal(historyQueries, 0)
  assert.deepEqual(model.list.value, unread)
  assert.deepEqual(queries.at(-1), {
    pageIndex: 0, pageSize: 12,
    sorts: [{name: 'notifyTime', order: 'desc'}],
    terms: [{type: 'and', terms: [{type: 'and', value: ['bulletin'], termType: 'in', column: 'topicProvider'}]}],
  })
  state.list = async () => ({result: []})
  await model.refresh()
  assert.deepEqual(model.list.value, [])
  assert.equal(historyQueries, 0)
  assert.equal(model.failed.value, false)
})
