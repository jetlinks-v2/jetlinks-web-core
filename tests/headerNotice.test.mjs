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
  'vue-i18n': 'export const useI18n=()=>({t:key=>key})',
  'ant-design-vue': 'export const Button={},notification={open:value=>globalThis.__notice.tips.push(value),close:()=>{}}',
  '@jetlinks-web-core/hooks': 'export const useWebSocket=options=>{globalThis.__notice.onMessage=options.onMessage;return {send:(...args)=>globalThis.__notice.subscriptions.push(args)}}',
  '@jetlinks-web-core/store/user': 'export const useUserStore=()=>globalThis.__notice.user',
  '@jetlinks-web-core/store/menu': 'export const useMenuStore=()=>({routerPush:(...args)=>globalThis.__notice.navigations.push(args)})',
  '@jetlinks-web-core/api/account/center': 'export const getReceivedNoticeProviders=()=>globalThis.__notice.channels()',
  './noticeListHandler': 'export const useNoticeDataSourceChanges=(providers,listener)=>{globalThis.__notice.sourceChange=listener};export const queryNoticeUnreadSummary=async(providers,params)=>({result:{total:(await globalThis.__notice.count(params)).result}}),changeNoticeReadState=(providers,...args)=>globalThis.__notice.mark(...args)',
  './noticeRealtimeHandler': 'export const handleRegisteredRealtimeNotice=async()=>false'
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
function fixture(t, overrides = {}) {
  const state = {user: reactive({alarmUpdateCount: 0}), tips: [], subscriptions: [], navigations: [],
    channels: async () => channelResult, count: async () => ({result: {count: 42}}), mark: async () => ({status: 200}), ...overrides}
  globalThis.__notice = state
  let model
  const app = renderer.createApp(defineComponent({setup() {model = module.exports.useHeaderNotice(); return () => h('div')}}))
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


test('a registered source change refreshes the header without server state writes', async t => {
  const {state, model} = fixture(t, {mark: () => assert.fail('source change must not mark notifications')})
  await setImmediate()
  state.count = async () => ({result: {count: 6}})
  state.sourceChange()
  await setImmediate()
  assert.equal(model.total.value, 6)
})


test('a slow badge response cannot overwrite a later local confirmation refresh', async t => {
  const {state, model} = fixture(t)
  await setImmediate()
  let resolveOld
  state.count = () => new Promise(resolve => resolveOld = resolve)
  state.sourceChange()
  state.count = async () => ({result: {count: 1}})
  state.sourceChange()
  await setImmediate()
  resolveOld({result: {count: 9}})
  await setImmediate()
  assert.equal(model.total.value, 1)
})

test('the latest account classification wins even when the old request arrives last', async t => {
  const {state, model} = fixture(t)
  await setImmediate()
  let resolveOld
  state.channels = () => new Promise(resolve => resolveOld = resolve)
  const old = model.retry()
  state.channels = async () => ({status: 200, result: [{provider: 'business', type: {id: 'business', name: 'Business'}}]})
  await model.retry()
  resolveOld(channelResult)
  await old
  assert.equal(model.tabs.value[0].key, 'business')
})
