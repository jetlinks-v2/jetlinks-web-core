import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { createMetricLoader, createMetricRenderer, flush } from './helpers/metricRuntime.mjs'

const load = createMetricLoader({ './api': { metricApi: {} } })
const { intervalDuration, stateIntervalHistory, stateIntervalSummary, stateIntervalSegments, tracksStateIntervals, stateLabel } = load('components/Metric/stateIntervals.ts')
const { newerMetricValue } = load('components/Metric/service.ts')
const { metricDurationText } = load('components/Metric/presentation.ts')
const { metricHistoryRequest, useMetricTrends } = load('components/Metric/useMetricTrends.ts')
const minute = 60000, start = 1700000000000
const interval = (id, from, to, extra = {}) => ({ id, value: 'running', startTime: start + from * minute,
  ...(to === undefined ? {} : { endTime: start + to * minute }), startKnown: true, endKnown: to !== undefined,
  observedUntil: start + (to ?? from) * minute, validUntil: start + 200 * minute, ...extra })
const value = (time, state) => ({ metricId: 'running', value:'running', status:'success', quality:{ valid:true }, evaluationTime:start + time * minute, state:{ duration:state.currentInterval ? (start + time * minute - state.currentInterval.startTime) / 1000 : null, ...state } })

test('后端当前视图推进同一快照，迟到推送不回退；客户端时间不参与计时', () => {
  const original = value(85, { currentInterval:interval('current', 70) })
  const first = { ...original, state:{ ...original.state, readView:{ time:start + 86 * minute, duration:16 * 60 } } }
  const next = { ...original, state:{ ...original.state, readView:{ time:start + 86 * minute + 5000, duration:16 * 60 + 5 } } }
  assert.equal(stateIntervalSummary(original).duration, 15 * minute)
  assert.equal(stateIntervalSummary(first).duration, 16 * minute)
  assert.equal(stateIntervalSummary(newerMetricValue(first, next)).duration, 16 * minute + 5000)
  assert.strictEqual(newerMetricValue(next, original), next)
  assert.strictEqual(newerMetricValue(next, first), next)
  assert.strictEqual(newerMetricValue(next, { ...next }), next)
  const changed = value(87, { currentInterval:interval('stopped', 87, undefined, { value:'standby' }) })
  assert.strictEqual(newerMetricValue(next, changed), changed)
  assert.equal(stateIntervalSummary(changed).duration, 0)
  const unknown = { ...next, state:{ ...next.state, readView:{ time:start + 200 * minute, duration:null } } }
  assert.equal(stateIntervalSummary(unknown).state, 'unknown')
  assert.equal(stateIntervalSummary(unknown).duration, undefined)
  assert.equal(stateIntervalSummary({ ...next, quality:{ valid:true, stale:true } }).state, 'unknown')
  assert.equal(original.state.duration, 15 * 60)
})

test('起点未知仍展示已确认状态，完整时长保持未知，过期与坏质量仍停止展示', () => {
  const observed = value(85, { currentInterval:interval('observed', 70, undefined, { value:0, startKnown:false }), readView:{ time:start + 86 * minute, duration:null } })
  const summary = stateIntervalSummary(observed)
  assert.equal(summary.state, 'known')
  assert.equal(summary.interval.value, 0)
  assert.equal(summary.duration, undefined)
  assert.equal(stateIntervalSummary({ ...observed, quality:{ valid:false } }).state, 'unknown')
  assert.equal(stateIntervalSummary({ ...observed, quality:{ valid:true, stale:true } }).state, 'unknown')
  assert.equal(stateIntervalSummary({ ...observed, state:{ ...observed.state, readView:{ time:start + 200 * minute, duration:null } } }).state, 'unknown')
})

test('时间带共用查询时间轴，裁剪边界并保留空隙，不按业务状态或标识特调', () => {
  const rows = [value(30, { closedInterval:interval('a', 0, 20, { value:'standby' }) }), value(60, { closedInterval:interval('b', 40, 60, { value:2 }) })]
  const current = value(85, { currentInterval:interval('c', 70), readView:{ time:start + 90 * minute, duration:20 * 60 } })
  const segments = stateIntervalSegments(rows, current, [start + 10 * minute, start + 100 * minute])
  assert.equal(segments.length, 3)
  const first = segments.find(segment => segment.interval.id === 'a')
  assert.equal(first.left, 0); assert.equal(first.width, 10 / 90 * 100)
  const last = segments.find(segment => segment.interval.id === 'c')
  assert.equal(last.width, 20 / 90 * 100)
  assert.ok(segments.reduce((sum, segment) => sum + segment.width, 0) < 100)
  assert.deepEqual(stateIntervalSegments([], undefined, [100, 100]), [])
  assert.deepEqual(stateIntervalSegments([]), [])
})

test('秒数只在显示时换算；分钟历史保留声明单位，非时间值不转换', () => {
  const t = (key, { count }) => `${count}${({ intervalDays:'d', intervalHours:'h', intervalMinutes:'m', intervalSeconds:'s' })[key]}`
  for (const [seconds, text] of [[0,'0s'], [45,'45s'], [59.9,'59s'], [60,'1m'], [200,'3m 20s'], [8100,'2h 15m'], [90000,'1d 1h']]) assert.equal(metricDurationText(seconds, 's', t), text)
  assert.equal(metricDurationText(2.5, 'min', t), '2m 30s')
  assert.equal(metricDurationText(2.5, 'h', t), '2h 30m')
  for (const [value, unit] of [[5,'kW'], [null,'s'], [true,'s'], ['60','s'], [NaN,'s'], [-1,'s']]) assert.equal(metricDurationText(value, unit, t), undefined)
})

test('本次15分钟与上次40分钟分别表达，累计和查询范围不改变连续时长', () => {
  const current = value(85, { currentInterval: interval('current', 70), previousInterval: interval('last', 0, 40) })
  const summary = stateIntervalSummary(current)
  assert.equal(summary.state, 'known')
  assert.equal(summary.duration, 15 * minute)
  assert.equal(intervalDuration(summary.last, summary.cutoff), 40 * minute)
  assert.equal(stateIntervalHistory([], current, [start + 80 * minute, start + 86 * minute])[0].interval.startTime, start + 70 * minute)
})

test('待机显示本次时长，数据过期或坏质量不继续推算', () => {
  const last = interval('last', 0, 40)
  const stopped = value(85, { currentInterval: interval('stopped', 40, undefined, { value:'standby' }), previousInterval: last })
  assert.equal(stateIntervalSummary(stopped).state, 'known')
  assert.equal(stateIntervalSummary(stopped).duration, 45 * minute)
  const expired = value(85, { currentInterval: interval('expired', 70, undefined, { validUntil: start + 80 * minute }) })
  assert.equal(stateIntervalSummary(expired).state, 'unknown')
  assert.equal(stateIntervalSummary(expired).duration, undefined)
  assert.equal(stateIntervalSummary({ ...stopped, status: 'invalid' }).state, 'unknown')
  assert.equal(stateIntervalSummary().state, 'waiting')
})

test('历史按稳定区间去重，保留未知边界，不把重复快照当作多次运行', () => {
  const run = interval('a', 0, 40, { startKnown: false, endKnown: false })
  const records = stateIntervalHistory([value(40, { closedInterval: run }), value(41, { closedInterval: run }), value(42, {})])
  assert.equal(records.length, 1)
  assert.equal(records[0].interval.startKnown, false)
  assert.equal(records[0].interval.endKnown, false)
  assert.equal(stateIntervalHistory([value(40, { closedInterval: run })], undefined, [start + 10 * minute, start + 20 * minute]).length, 1)
  assert.equal(stateIntervalHistory([value(40, { closedInterval: run })], undefined, [start + 40 * minute, start + 50 * minute]).length, 0)
})

test('能力来自声明，不识别模板ID；历史在存储侧按完整区间交集筛选', () => {
  const template = { id: 'anything', definitions: [{ id: 'x', stateTracking:{ maxNoData:'PT20M' } }] }
  assert.equal(tracksStateIntervals(template, 'x'), true)
  assert.equal(tracksStateIntervals(template, 'other'), false)
  const request = metricHistoryRequest(['x'], [100, 200], true)
  assert.equal(request.intervalsOnly, true)
  assert.deepEqual(request.query.terms, [{ column: 'intervalStart', termType: 'lt', value: 200 }, { column: 'intervalEnd', termType: 'gt', value: 100 }])
  assert.equal(request.query.pageSize, 200)
})

test('累计快照与区间历史分开分页，但概览与详情仍共享结果', async () => {
  const calls = [], targets = ref([{ id: 'a', key: 'v1', outputs: ['total', 'running'], intervalOutputs: ['running'] }])
  const renderer = createMetricRenderer()
  let trends
  const app = renderer.renderer.createApp({ setup() {
    trends = useMetricTrends(targets, ref(), ref({}), { history: async (id, request) => {
      calls.push(request)
      return [request.intervalsOnly ? value(40, { closedInterval: interval('a', 0, 40) }) : { metricId: 'total', value: 55 }]
    } })
    return () => null
  } })
  app.mount(renderer.root)
  try {
    trends.observe('a', {}); await flush()
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[0].outputs, ['total'])
    assert.deepEqual(calls[1].outputs, ['running'])
    assert.equal(calls[1].intervalsOnly, true)
    assert.equal(trends.entries.value.a.values.length, 2)
  } finally { app.unmount() }
})

test('任意状态历史与名称国际化；数值编码和文字编码不混淆', () => {
  const labels = [{ value:1, name:'运行', nameI18n:{ en:'Running' } }, { value:'1', name:'文字状态' }]
  assert.equal(stateLabel(1, labels, 'en'), 'Running')
  assert.equal(stateLabel('1', labels, 'en'), '文字状态')
  assert.equal(stateLabel('maintenance', labels, 'en'), 'maintenance')
  const records = ['running', 'standby', 'fault', 'maintenance'].map((state,index) =>
    value((index + 1) * 10, { closedInterval:interval(state, index * 10, (index + 1) * 10, { value:state }) }))
  assert.equal(stateIntervalHistory(records).length, 4)
  assert.equal(stateIntervalHistory(records)[0].interval.value, 'maintenance')
})
