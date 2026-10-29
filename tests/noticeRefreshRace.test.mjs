import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { parse, compileScript } from 'vue/compiler-sfc'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve } }
const loadModule = (code, dependency, globals = {}) => {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), transformSync(code, { loader: 'ts', format: 'cjs' }).code)(dependency, module, module.exports, ...Object.values(globals))
  return module.exports
}
const utils = loadModule(readFileSync(new URL('../src/layout/components/noticeUtils.ts', import.meta.url), 'utf8'), () => ({}))
const category = [{ key: 'business', tab: 'Business', type: ['business'] }]
const summary = count => ({ result: { total: { count }, topics: [{ topicProvider: 'business', count }] } })

function fixture(t, filename) {
  const state = { summary: async () => summary(0), list: async () => [], channels: async () => ({status: 200, result: []}) }
  const user = vue.reactive({ userInfo: { id: 'u1' } })
  const handlers = { queryNoticeUnreadSummary: (...args) => state.summary(...args), loadRegisteredNoticeList: (...args) => state.list(...args), useNoticeDataSourceChanges() {}, useNoticeDataSourceRealtime() {} }
  const dependencies = name => {
    if (name === 'vue') return vue
    if (name === './noticeListHandler') return handlers
    if (name === './noticeUtils') return utils
    if (name === 'lodash-es') return { flatten: values => values.flat() }
    if (name === 'vue-i18n') return {useI18n: () => ({t: key => key, locale: vue.ref('zh')})}
    if (name === '@jetlinks-web-core/store/user') return {useUserStore: () => user}
    if (name === '@jetlinks-web-core/store/menu') return {useMenuStore: () => ({})}
    if (name === '@jetlinks-web-core/hooks') return {useWebSocket: () => ({send() {}})}
    if (name === '@jetlinks-web-core/api/account/center') return {getReceivedNoticeProviders: () => state.channels()}
    return {}
  }
  if (filename === 'Notice.vue') {
    const source = readFileSync(new URL('../src/layout/components/useHeaderNotice.ts', import.meta.url), 'utf8')
      .replace('return { visible,', 'return { getList, queryTypeList, visible,')
    const scope = vue.effectScope()
    const injected = name => name === 'vue' ? {...vue, onMounted() {}} : dependencies(name)
    const hook = loadModule(source, injected)
    const model = scope.run(() => hook.useHeaderNotice())
    t.after(() => scope.stop())
    return {state, model}
  }
  const { descriptor } = parse(readFileSync(new URL('../src/layout/components/' + filename, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: filename })
  const component = loadModule(script.content, dependencies, {ref: vue.ref, computed: vue.computed, watch: vue.watch, onMounted() {}, useRoute: () => ({path: '/'})}).default
  const props = vue.reactive({tabs: category})
  const scope = vue.effectScope()
  const model = scope.run(() => component.setup(props, {expose() {}, emit() {}}))
  t.after(() => scope.stop())
  return {state, props, model}
}

test('a slow unread summary cannot overwrite a later source refresh', async t => {
  const {state, model} = fixture(t, 'NoticeInfo.vue')
  const old = deferred(), current = deferred()
  state.summary = () => old.promise
  model.refreshSummary()
  state.summary = () => current.promise
  model.refreshSummary()
  current.resolve(summary(1))
  await setImmediate()
  old.resolve(summary(9))
  await setImmediate()
  assert.equal(model.tabCountMap.value.business.count, 1)
})

test('clearing categories invalidates a pending dropdown list and count', async t => {
  const {state, props, model} = fixture(t, 'NoticeInfo.vue')
  const rows = deferred(), count = deferred()
  state.list = () => rows.promise
  state.summary = () => count.promise
  model.getData(['business'])
  model.refreshSummary()
  props.tabs = []
  model.getData([])
  model.refreshSummary()
  rows.resolve([{id: 'old'}])
  count.resolve(summary(9))
  await setImmediate()
  assert.deepEqual(model.list.value, [])
  assert.deepEqual(model.tabCountMap.value, {})
  assert.equal(model.loading.value, false)
})

test('a slow badge query cannot overwrite the result after confirmation', async t => {
  const {state, model} = fixture(t, 'Notice.vue')
  model.tabs.value = category
  const old = deferred(), current = deferred()
  state.summary = () => old.promise
  model.getList()
  state.summary = () => current.promise
  model.getList()
  current.resolve(summary(1))
  await setImmediate()
  old.resolve(summary(9))
  await setImmediate()
  assert.equal(model.total.value, 1)
})


test('the latest account classification wins when the old runtime request arrives last', async t => {
  const {state, model} = fixture(t, 'Notice.vue')
  const old = deferred()
  state.channels = () => old.promise
  const pending = model.queryTypeList()
  state.channels = async () => ({status: 200, result: [{provider: 'business', type: {id: 'business', name: 'Business'}}]})
  await model.queryTypeList()
  old.resolve({status: 200, result: [{provider: 'alarm', type: {id: 'alarm', name: 'Alarm'}}]})
  await pending
  assert.equal(model.tabs.value[0].key, 'business')
})
