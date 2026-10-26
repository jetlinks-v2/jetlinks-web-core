import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { transformSync } from 'esbuild'

const source = readFileSync(new URL('../src/layout/components/noticeListHandler.ts', import.meta.url), 'utf8')
const load = (registrations, api = {}) => {
  const module = { exports: {} }
  const dependency = (name) => name.endsWith('components-registry')
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
