import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const source = readFileSync(new URL('../src/layout/components/noticeListHandler.ts', import.meta.url), 'utf8')
const load = (registrations, api = {}) => {
  const module = { exports: {} }
  const dependency = name => name === 'vue' ? vue : name.endsWith('components-registry')
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

test('optional capabilities filter disabled providers and preserve ordinary notifications', async () => {
  let supported = false
  const source = { isSupported: async () => supported }
  const { filterSupportedNoticeProviders } = load([provider(source)])
  assert.deepEqual(await filterSupportedNoticeProviders(['business', 'alarm', 'business']), ['alarm'])
  supported = true
  assert.deepEqual(await filterSupportedNoticeProviders(['business', 'alarm']), ['business', 'alarm'])
})

test('a failed capability probe only excludes that provider and is retried on the next load', async () => {
  let attempt = 0
  const { filterSupportedNoticeProviders } = load([provider({ isSupported: async () => {
    if (++attempt === 1) throw Error('network')
    return true
  } })])
  assert.deepEqual(await filterSupportedNoticeProviders(['business', 'alarm']), ['alarm'])
  assert.deepEqual(await filterSupportedNoticeProviders(['business', 'alarm']), ['business', 'alarm'])
})

test('registered reception metadata supplies its category without channel configurations', () => {
  const { mergeRegisteredNoticeProviders } = load([provider({})])
  const expected = [{ provider: 'business', name: 'Business', type: { id: 'business', name: 'Business' } }]
  assert.deepEqual(mergeRegisteredNoticeProviders([]), expected)
  assert.deepEqual(mergeRegisteredNoticeProviders([{ ...expected[0], name: 'Channel label' }]), expected)
})

test('registered lists and read changes use their own source; ordinary notifications keep existing APIs', async () => {
  const calls = []
  const dataSource = {
    query: async params => { calls.push(['source-query', params]); return { result: { data: [{ id: 'intent-1' }] } } },
    changeState: async (state, ids) => { calls.push(['source-state', state, ids]); return { status: 200 } },
  }
  const api = {
    getList_api: async params => { calls.push(['default-query', params]); return { result: { data: [] } } },
    changeStatus_api: async (state, ids) => { calls.push(['default-state', state, ids]); return { status: 200 } },
  }
  const { queryNoticeRecords, changeNoticeReadState } = load([provider(dataSource)], api)
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

test('mixed unread totals exclude registered topics and deduplicate providers', async () => {
  const calls = []
  const dataSource = {
    unreadCount: async params => { calls.push(['source', params]); return { result: { count: 99, overflow: true } } },
  }
  const api = { getUnreadSummary_api: async params => {
    calls.push(['default', params])
    return { result: { topics: [{ topicProvider: 'alarm', count: 2 }] } }
  } }
  const { queryNoticeUnreadSummary } = load([provider(dataSource)], api)
  const response = await queryNoticeUnreadSummary(['alarm', 'business', 'business'], { pageSize: 99, terms: [] })
  assert.deepEqual(response.result.topics, [
    { topicProvider: 'alarm', count: 2 },
    { topicProvider: 'business', count: 99, overflow: true },
  ])
  assert.deepEqual(response.result.total, { count: 99, overflow: true })
  assert.deepEqual(calls.find(call => call[0] === 'default')[1].terms.at(-1).value, ['alarm'])
  assert.deepEqual(calls.find(call => call[0] === 'source')[1].terms.at(-1).value, ['business'])
})

test('each unread source replaces nested provider routing and preserves other query conditions', async () => {
  const calls = []
  const {queryNoticeUnreadSummary} = load([provider({unreadCount: async params => {
    calls.push(['business', params]); return {result: {count: 1}}
  }})], {getUnreadSummary_api: async params => {
    calls.push(['ordinary', params]); return {result: {topics: [{topicProvider: 'alarm', count: 2}]}}
  }})
  const filters = [{type: 'or', column: 'topicName', termType: 'like', value: 'release'},
    {type: 'or', column: 'message', termType: 'like', value: 'maintenance'}]
  const params = {pageIndex: 0, pageSize: 99, sorts: [{name: 'notifyTime', order: 'desc'}], terms: [
    {type: 'and', terms: [{type: 'and', column: 'topicProvider', termType: 'in', value: ['alarm', 'business']}]},
    {type: 'and', terms: filters},
    {type: 'and', column: 'topic_provider', termType: 'in', value: ['alarm', 'business']},
  ]}
  const original = structuredClone(params)
  await queryNoticeUnreadSummary(['alarm', 'business'], params)
  const providerValues = terms => terms.flatMap(term => ['topicProvider', 'topic_provider'].includes(term.column)
    ? term.value : providerValues(term.terms || []))
  for (const [source, query] of calls) {
    assert.deepEqual(providerValues(query.terms), [source === 'ordinary' ? 'alarm' : 'business'])
    assert.deepEqual(query.terms[0], {type: 'and', terms: [{type: 'and', terms: filters}]})
    assert.deepEqual(query.sorts, params.sorts)
    assert.equal(query.pageSize, 99)
    assert.equal(query.terms.at(-1).type, 'and', 'OR filters cannot escape source routing')
  }
  assert.deepEqual(params, original, 'routing must not mutate shared query parameters')
})

test('legacy announcement counts never contribute to the badge, including after confirmation', async () => {
  for (const ordinaryCount of [0, 3]) {
    let unread = 1
    const {queryNoticeUnreadSummary, changeNoticeReadState} = load([provider({
      unreadCount: async () => ({result: {count: unread, overflow: false}}),
      changeState: async () => { unread = 0; return {status: 200} },
    })], {getUnreadSummary_api: async () => ({result: {
      total: {count: ordinaryCount + 1},
      topics: [
        {topicProvider: 'alarm', count: ordinaryCount},
        {topicProvider: 'business', count: 1, overflow: true},
        {topicProvider: 'unrequested', count: 50},
      ],
    }})})
    const summary = () => queryNoticeUnreadSummary(['alarm', 'business'], {pageSize: 99})
    assert.deepEqual((await summary()).result.total, {count: ordinaryCount + 1, overflow: false})
    await changeNoticeReadState(['business'], '_read', ['announcement:1'])
    const confirmed = await summary()
    assert.deepEqual(confirmed.result.total, {count: ordinaryCount, overflow: false})
    assert.deepEqual(confirmed.result.topics.map(topic => topic.topicProvider), ['alarm', 'business'])
  }
})

test('duplicate ordinary topics are counted once and empty provider sets make no requests', async () => {
  const {queryNoticeUnreadSummary} = load([], {getUnreadSummary_api: async () => ({result: {topics: [
    {topicProvider: 'alarm', count: 3}, {topicProvider: 'alarm', count: 3},
  ]}})})
  assert.equal((await queryNoticeUnreadSummary(['alarm', 'alarm'], {})).result.total.count, 3)
  const empty = load([], {getUnreadSummary_api: () => assert.fail('unexpected unscoped request')})
  assert.deepEqual((await empty.queryNoticeUnreadSummary([], {})).result, {topics: [], total: {count: 0, overflow: false}})
})

test('ordinary-only and independent-only summaries preserve capped totals and overflow', async () => {
  for (const [ordinary, business, expected] of [[99, 0, false], [98, 1, false], [99, 1, true], [0, 100, true]]) {
    const {queryNoticeUnreadSummary} = load([provider({unreadCount: async () => ({result: {
      count: Math.min(business, 99), overflow: business > 99,
    }})})], {getUnreadSummary_api: async () => ({result: {topics: [{topicProvider: 'alarm', count: ordinary}]}})})
    const providers = [...(ordinary ? ['alarm'] : []), ...(business ? ['business'] : [])]
    assert.deepEqual((await queryNoticeUnreadSummary(providers, {pageSize: 99})).result.total,
      {count: Math.min(ordinary + business, 99), overflow: expected})
  }
})

test('failed or malformed unread responses reject instead of reporting a partial successful total', async () => {
  for (const failed of [undefined, {success: false, result: {count: 0, topics: []}},
    {status: 500, result: {count: 0, topics: []}}, {}, {result: null}]) {
    for (const failingSource of ['ordinary', 'business']) {
      const {queryNoticeUnreadSummary} = load([provider({unreadCount: async () => failingSource === 'business'
        ? failed : {result: {count: 1}}})], {getUnreadSummary_api: async () => failingSource === 'ordinary'
        ? failed : {result: {topics: [{topicProvider: 'alarm', count: 2}]}}})
      await assert.rejects(queryNoticeUnreadSummary(['alarm', 'business'], {}))
    }
  }
  for (const result of [{}, {topics: null}, {topics: {}}, {total: {count: 5}}]) {
    const {queryNoticeUnreadSummary} = load([], {getUnreadSummary_api: async () => ({result})})
    await assert.rejects(queryNoticeUnreadSummary(['alarm'], {}))
  }
  for (const source of ['ordinary', 'business']) {
    const fail = async () => { throw new Error('unread unavailable') }
    const {queryNoticeUnreadSummary} = load([provider({unreadCount: fail})], {getUnreadSummary_api: fail})
    await assert.rejects(queryNoticeUnreadSummary([source === 'ordinary' ? 'alarm' : 'business'], {}), /unread unavailable/)
  }
})

test('invalid count values reject for either source instead of becoming zero or NaN', async () => {
  for (const value of [{}, {count: -1}, {count: 0.5}, {count: '1'}, {count: NaN}, {count: Infinity},
    {count: Number.MAX_SAFE_INTEGER + 1}, {count: 1, overflow: 'false'}]) {
    const {queryNoticeUnreadSummary} = load([provider({unreadCount: async () => ({result: value})})], {
      getUnreadSummary_api: async () => ({result: {topics: [{...value, topicProvider: 'alarm'}]}}),
    })
    await assert.rejects(queryNoticeUnreadSummary(['business'], {}))
    await assert.rejects(queryNoticeUnreadSummary(['alarm'], {}))
  }
})

test('mark all read calls each source once and ordinary providers keep their original endpoint', async () => {
  const calls = []
  const dataSource = { readAll: async () => { calls.push(['source']); return { status: 200 } } }
  const { markNoticeProvidersRead } = load([provider(dataSource)], {
    changeAllStatus: async (state, ids) => { calls.push(['default', state, ids]); return { status: 200 } },
  })
  assert.equal((await markNoticeProvidersRead(['business', 'business', 'alarm'])).status, 200)
  assert.deepEqual(calls, [['default', '_read', ['alarm']], ['source']])
})

test('a registered loader failure never falls back to the ordinary inbox', async () => {
  const registration = provider({}, { listHandler: async () => { throw new Error('source failed') } })
  const { loadRegisteredNoticeList } = load([registration])
  await assert.rejects(loadRegisteredNoticeList(['business'], 12), /source failed/)
})

const loadCenter = (get, mergeRegisteredNoticeProviders) => {
  const centerSource = readFileSync(new URL('../src/api/account/center.ts', import.meta.url), 'utf8')
  const module = { exports: {} }
  const dependency = name => name === '@jetlinks-web/core'
    ? { request: { get } }
    : { mergeRegisteredNoticeProviders }
  new Function('require', 'module', 'exports', transformSync(centerSource, { loader: 'ts', format: 'cjs' }).code)(dependency, module, module.exports)
  return module.exports
}

test('reception classification survives a channel failure while subscription settings retain the error', async () => {
  const get = async () => { throw new Error('channel denied') }
  const { getReceivedNoticeProviders, getAllNotice } = loadCenter(get, () => [{ provider: 'business' }])
  assert.deepEqual((await getReceivedNoticeProviders()).result, [{ provider: 'business' }])
  await assert.rejects(getAllNotice(), /channel denied/)
  await assert.rejects(loadCenter(get, () => []).getReceivedNoticeProviders(), /channel denied/)
})

test('source changes refresh subscribers and category switches release listeners', async () => {
  const listeners = new Set()
  let subscriptions = 0
  let releases = 0
  const dataSource = { subscribe(listener) {
    subscriptions++
    listeners.add(listener)
    return () => { releases++; listeners.delete(listener) }
  } }
  const { useNoticeDataSourceChanges } = load([provider(dataSource)])
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
  providers.value = ['business']
  await vue.nextTick()
  listeners.forEach(listener => listener())
  assert.equal(refreshes, 2)
  scope.stop()
  assert.equal(releases, 2)
})

test('realtime source binds once per category and releases when the header unmounts', async () => {
  const calls = []
  let receive
  const dataSource = {
    subscribeRealtime(listener) { calls.push('sub'); receive = listener; return () => calls.push('unsub') },
  }
  const { useNoticeDataSourceRealtime } = load([provider(dataSource)])
  const providers = vue.ref(['business', 'business'])
  const scope = vue.effectScope()
  scope.run(() => useNoticeDataSourceRealtime(() => providers.value, payload => calls.push(payload.id)))
  receive({ id: 'batch' })
  assert.deepEqual(calls, ['sub', 'batch'])
  providers.value = ['alarm']
  await vue.nextTick()
  assert.deepEqual(calls, ['sub', 'batch', 'unsub'])
  providers.value = ['business']
  await vue.nextTick()
  scope.stop()
  assert.deepEqual(calls, ['sub', 'batch', 'unsub', 'sub', 'unsub'])
})

test('top dropdown requests unread records from registered sources before applying the page limit', async () => {
  for (const noPaging of [true, false]) {
    let received
    const records = [
      {id: 'read-batch', state: {value: 'read'}},
      {id: 'unread-batch', state: {value: 'unread'}},
    ]
    const query = async params => {
      received = params
      const unreadOnly = params.terms?.some(term => term.column === 'state' && term.termType === 'eq' && term.value === 'unread')
      return {result: (unreadOnly ? records.filter(record => record.state.value === 'unread') : records).slice(0, params.pageSize)}
    }
    const dataSource = noPaging ? {queryNoPaging: query, query: () => assert.fail('unexpected paged query')} : {query}
    const {queryNoticeRecordsNoPaging} = load([provider(dataSource)], {
      getUnreadNoPagingList_api: () => assert.fail('unexpected ordinary inbox fallback'),
    })
    const params = {pageIndex: 0, pageSize: 1, sorts: [{name: 'notifyTime', order: 'desc'}],
      terms: [{column: 'topicName', termType: 'like', value: 'release', type: 'or'}]}
    const original = structuredClone(params)
    const response = await queryNoticeRecordsNoPaging(['business'], params)
    assert.deepEqual(response.result.map(record => record.id), ['unread-batch'])
    assert.deepEqual(received, {...params, terms: [
      {type: 'and', terms: params.terms},
      {column: 'state', termType: 'eq', value: 'unread', type: 'and'},
    ]})
    assert.deepEqual(params, original, 'the dropdown must not mutate shared query parameters')
  }
})

test('ordinary dropdown queries retain the effective unread endpoint and its original conditions', async () => {
  const params = {pageSize: 12, terms: [{column: 'topicProvider', termType: 'in', value: ['alarm']}]}
  const {queryNoticeRecordsNoPaging} = load([], {
    getUnreadNoPagingList_api: async query => {
      assert.equal(query, params)
      return {result: [{id: 'ordinary-unread'}]}
    },
    getList_api: () => assert.fail('unexpected history query'),
  })
  assert.deepEqual((await queryNoticeRecordsNoPaging(['alarm'], params)).result, [{id: 'ordinary-unread'}])
})
