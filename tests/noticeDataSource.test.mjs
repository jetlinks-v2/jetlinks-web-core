import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const source = readFileSync(new URL('../src/layout/components/noticeListHandler.ts', import.meta.url), 'utf8')
const load = (registrations, api = {}) => {
  const module = { exports: {} }
  const dependency = (name) => name === 'vue' ? vue : name.endsWith('components-registry')
    ? { componentsRegistry: { getRegistry: () => registrations } }
    : api
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(dependency, module, module.exports)
  return module.exports
}

const provider = (dataSource, extra = {}) => ({ code: 'business', props: {
  dataSource,
  metadata: () => ({ provider: 'business', name: 'Business', type: { id: 'business', name: 'Business' } }),
  ...extra,
} })

test('registered reception metadata supplies its category without channel configurations', () => {
  const { mergeRegisteredNoticeProviders } = load([provider({})])
  const expected = [{ provider: 'business', name: 'Business', type: { id: 'business', name: 'Business' } }]
  assert.deepEqual(mergeRegisteredNoticeProviders([]), expected)
  assert.deepEqual(mergeRegisteredNoticeProviders([{ ...expected[0], name: 'Channel label' }]), expected)
})

test('registered lists and read changes use their own source; ordinary notifications keep existing APIs', async () => {
  const calls = []
  const source = {
    query: async params => { calls.push(['source-query', params]); return { result: { data: [{ id: 'intent-1' }] } } },
    changeState: async (state, ids) => { calls.push(['source-state', state, ids]); return { status: 200 } },
  }
  const api = {
    getList_api: async params => { calls.push(['default-query', params]); return { result: { data: [] } } },
    changeStatus_api: async (state, ids) => { calls.push(['default-state', state, ids]); return { status: 200 } },
  }
  const { queryNoticeRecords, changeNoticeReadState } = load([provider(source)], api)
  assert.equal((await queryNoticeRecords(['business'], { pageSize: 20 })).result.data[0].id, 'intent-1')
  await changeNoticeReadState(['business'], '_unread', ['intent-1'])
  await queryNoticeRecords(['alarm'], { pageSize: 5 })
  await changeNoticeReadState(['alarm'], '_read', ['inbox-1'])
  assert.deepEqual(calls, [
    ['source-query', { pageSize: 20 }],
    ['source-state', '_unread', ['intent-1']],
    ['default-query', { pageSize: 5 }],
    ['default-state', '_read', ['inbox-1']],
  ])
})

test('mixed unread totals exclude registered topics from ordinary counts and deduplicate providers', async () => {
  const calls = []
  const source = { unreadCount: async params => { calls.push(['source', params]); return { result: { count: 99, overflow: true } } } }
  const api = { getUnreadSummary_api: async params => {
    calls.push(['default', params])
    return { result: { topics: [{ topicProvider: 'alarm', count: 2 }] } }
  } }
  const { queryNoticeUnreadSummary } = load([provider(source)], api)
  const response = await queryNoticeUnreadSummary(['alarm', 'business', 'business'], { pageSize: 99, terms: [] })
  assert.deepEqual(response.result.topics, [{ topicProvider: 'alarm', count: 2 }, { topicProvider: 'business', count: 99, overflow: true }])
  assert.deepEqual(response.result.total, { count: 99, overflow: true })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.find(call => call[0] === 'default')[1].terms.at(-1).value, ['alarm'])
  assert.deepEqual(calls.find(call => call[0] === 'source')[1].terms.at(-1).value, ['business'])
})

test('mark all read calls each source once and ordinary provider IDs stay on their original endpoint', async () => {
  const calls = []
  const source = { readAll: async () => { calls.push(['source']); return { status: 200 } } }
  const { markNoticeProvidersRead } = load([provider(source)], {
    changeAllStatus: async (state, ids) => { calls.push(['default', state, ids]); return { status: 200 } },
  })
  assert.equal((await markNoticeProvidersRead(['business', 'business', 'alarm'])).status, 200)
  assert.deepEqual(calls, [['default', '_read', ['alarm']], ['source']])
})

test('a registered loader failure never silently falls back to the ordinary inbox', async () => {
  const { loadRegisteredNoticeList } = load([provider({}, { listHandler: async () => { throw new Error('source failed') } })])
  await assert.rejects(loadRegisteredNoticeList(['business'], 12), /source failed/)
})

const loadCenter = (get, mergeRegisteredNoticeProviders) => {
  const source = readFileSync(new URL('../src/api/account/center.ts', import.meta.url), 'utf8')
  const module = { exports: {} }
  const dependency = (name) => name === '@jetlinks-web/core'
    ? { request: { get } }
    : { mergeRegisteredNoticeProviders }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(dependency, module, module.exports)
  return module.exports
}

test('reception classification survives a channel failure while subscription settings retain the error', async () => {
  const get = async () => { throw new Error('channel denied') }
  const { getReceivedNoticeProviders, getAllNotice } = loadCenter(get, () => [{ provider: 'business' }])
  assert.deepEqual((await getReceivedNoticeProviders()).result, [{ provider: 'business' }])
  await assert.rejects(getAllNotice(), /channel denied/)
  const ordinaryOnly = loadCenter(get, () => [])
  await assert.rejects(ordinaryOnly.getReceivedNoticeProviders(), /channel denied/)
})


test('source changes refresh all subscribers and category switches release listeners', async () => {
  const listeners = new Set()
  let subscriptions = 0
  let releases = 0
  const source = { subscribe(listener) {
    subscriptions++
    listeners.add(listener)
    return () => { releases++; listeners.delete(listener) }
  } }
  const { useNoticeDataSourceChanges } = load([provider(source)])
  const providers = vue.ref(['business', 'business'])
  let refreshes = 0
  const scope = vue.effectScope()
  scope.run(() => useNoticeDataSourceChanges(() => providers.value, () => refreshes++))
  assert.equal(subscriptions, 1)
  listeners.forEach(listener => listener())
  assert.equal(refreshes, 1)
  providers.value = ['alarm']
  await vue.nextTick()
  assert.equal(releases, 1)
  assert.equal(listeners.size, 0)
  providers.value = ['business']
  await vue.nextTick()
  listeners.forEach(listener => listener())
  assert.equal(refreshes, 2)
  scope.stop()
  assert.equal(releases, 2)
  assert.equal(listeners.size, 0)
})

test('a shared source signals every mounted entry and disposing one retains the other', () => {
  const listeners = new Set()
  const source = { subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) } }
  const { useNoticeDataSourceChanges } = load([provider(source)])
  let header = 0, center = 0
  const headerScope = vue.effectScope(), centerScope = vue.effectScope()
  headerScope.run(() => useNoticeDataSourceChanges(() => ['business'], () => header++))
  centerScope.run(() => useNoticeDataSourceChanges(() => ['business'], () => center++))
  listeners.forEach(listener => listener())
  assert.deepEqual([header, center], [1, 1])
  headerScope.stop()
  listeners.forEach(listener => listener())
  assert.deepEqual([header, center], [1, 2])
  centerScope.stop()
  assert.equal(listeners.size, 0)
})
