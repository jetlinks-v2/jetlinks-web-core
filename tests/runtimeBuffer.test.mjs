import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '..'), cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }, { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  const imports = id => id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  new Function('require', 'module', 'exports', code)(imports, module, module.exports); cache.set(filename, module.exports); return module.exports
}
const { bufferCounterText, bufferMonitorCounters, bufferCounterTotal } = load(resolve(root, 'src/components/RuntimeDiagnostics/buffer/counters.ts'))
const { bufferHistoryPoints, bufferThroughputPoints, bufferOverviewPoints, bufferTooltipHtml } = load(resolve(root, 'src/components/RuntimeDiagnostics/buffer/history.ts'))
const { normalizeBufferConfig, bufferPlotValue, bufferAxisValue, bufferColorIndex, bufferQuantityTotal } = load(resolve(root, 'src/components/RuntimeDiagnostics/buffer/presentation.ts'))
const { runtimeBeanOverview } = load(resolve(root, 'src/components/RuntimeDiagnostics/utils.ts'))
const queue = (objectName, written, attempted, extra = {}) => ({ objectName, written, attempted, ...extra })
const sample = (sampledAt, ...buffers) => ({ sampledAt, buffers })

test('real PersistenceBuffer Monitor format preserves long counters and labels out only as attempts', () => {
  const monitor = '\nqueue(in 9007199254740993,out 9223372036854775807,dropped 7);\nconsume(opt 8,cost 101 ms);\nwriter(pending 1,batches 2,requests 3,items 4,lastBatch 5,maxBatch 6,fallback 0,lastReason idle,maxObservedDrain 1 us);\ndist[0-50ms(8)]\n'
  assert.deepEqual(bufferMonitorCounters(monitor), { written: '9007199254740993', attempted: '9223372036854775807' })
  assert.deepEqual(bufferMonitorCounters('queue ( in 0003 , out 4 , dropped 0 ) ; consume(opt 99,cost 10 ms);'), { written: '3', attempted: '4' })
  const bean = { domain: 'org.jetlinks', type: 'PersistenceBuffer', name: 'queue', objectName: 'org.jetlinks:type=PersistenceBuffer,name=queue', operations: [], attributes: [{ name: 'Monitor', value: monitor, available: true }] }
  assert.equal(runtimeBeanOverview([bean]).buffers[0].written, '9007199254740993')
  assert.equal(runtimeBeanOverview([bean]).buffers[0].attempted, '9223372036854775807')
  assert.equal(runtimeBeanOverview([bean]).buffers[0].pending, undefined, 'in-out is never treated as backlog')
})

test('unknown Monitor, nil, malformed sections and unsafe nontext counts remain unknown', () => {
  for (const value of [undefined, null, 'nil', '', 'writer(in 2,out 1,dropped 0);', 'queue(in -1,out 0,dropped 0);', 'queue(in 1,out missing,dropped 0);', 'x'.repeat(16385)]) assert.deepEqual(bufferMonitorCounters(value), {})
  for (const value of [0, 9007199254740993, '-1', '1.5', '1e3', '9223372036854775808']) assert.equal(bufferCounterText(value), undefined)
  assert.equal(bufferCounterText('0'), '0')
  assert.equal(bufferMonitorCounters('queue(in 9223372036854775808,out 7,dropped 0);').written, undefined)
})

test('all-queue totals require every exact field and can exceed the safe integer and individual long range', () => {
  const queues = [queue('a', '9223372036854775807', '5'), queue('b', '9223372036854775807', '9')]
  assert.equal(bufferCounterTotal(queues, 'written'), '18446744073709551614')
  assert.equal(bufferCounterTotal(queues, 'attempted'), '14')
  assert.equal(bufferCounterTotal([...queues, { objectName: 'missing' }], 'written'), undefined)
  assert.equal(bufferCounterTotal([], 'written'), undefined)
  assert.equal(bufferCounterTotal([queue('a', '0', '0')], 'written'), '0')
})

test('queue selection scopes backlog and adjacent counters use actual elapsed time after exact subtraction', () => {
  const history = [sample(1000, queue('a', '9007199254740993', '100', { pending: 6, dead: 0 }), queue('b', '3', '4', { pending: 9, dead: 2 })),
    sample(3500, queue('a', '9007199254741003', '105', { pending: 7, dead: 1 }), queue('b', '8', '9', { pending: 0, dead: 0 }))]
  assert.deepEqual(bufferHistoryPoints(history, 'a').map(point => point.pending), [6, 7])
  assert.deepEqual(bufferHistoryPoints(history).map(point => point.pending), [15, 7])
  assert.deepEqual(bufferThroughputPoints(history, 'a'), [{ sampledAt: 1000, writtenRate: undefined, attemptedRate: undefined }, { sampledAt: 3500, writtenRate: 4, attemptedRate: 2 }])
  assert.equal(bufferThroughputPoints(history).at(-1).writtenRate, 6)
  assert.equal(bufferThroughputPoints(history, 'b').at(-1).attemptedRate, 2)
})

test('reset epochs and per-queue counter rollback break rates even when another queue grows', () => {
  const history = [sample(1000, queue('a', '100', '100', { counterEpoch: 0 }), queue('b', '10', '10', { counterEpoch: 0 })),
    sample(2000, queue('a', '0', '0', { counterEpoch: 1 }), queue('b', '1000', '1000', { counterEpoch: 0 })),
    sample(3000, queue('a', '7', '3', { counterEpoch: 1 }), queue('b', '1010', '1002', { counterEpoch: 0 }))]
  assert.equal(bufferThroughputPoints(history)[1].writtenRate, undefined)
  assert.equal(bufferThroughputPoints(history, 'a')[2].writtenRate, 7)
  assert.equal(bufferThroughputPoints(history)[2].attemptedRate, 5)
  history[1].buffers[0].counterEpoch = 0
  assert.equal(bufferThroughputPoints(history)[1].attemptedRate, undefined, 'an unannounced counter decrease is still a gap')
})

test('missing fields, missing samples and changed queue sets never bridge a throughput gap', () => {
  const history = [sample(1000, queue('a', '10', '5')), sample(2000), sample(3000, queue('a', '30', '15')),
    sample(4000, queue('a', undefined, '20')), sample(5000, queue('a', '50', '25')),
    sample(6000, queue('a', '60', '30'), queue('new', '2', '1')),
    sample(7000, queue('a', '70', '35'), queue('new', '4', '2'))]
  assert.deepEqual(bufferThroughputPoints(history).map(point => point.writtenRate), [undefined, undefined, undefined, undefined, undefined, undefined, 12])
  assert.equal(bufferThroughputPoints(history, 'a')[5].writtenRate, 10, 'another queue appearing does not invalidate the selected queue')
  assert.equal(bufferThroughputPoints([sample(1000, queue('a', '0', '0')), sample(2000, queue('a', '9007199254740993', '2'))])[1].writtenRate, undefined)
})

test('throughput tooltip obeys queue selection and escapes identity, labels and units', () => {
  const name = 'org.jetlinks:type=PersistenceBuffer,name="<unsafe>"'
  const history = [sample(1000, queue(name, '10', '5')), sample(2000, queue(name, '13', '7'))]
  const html = bufferTooltipHtml(history, 2000, { queue: '<Queue>', pending: 'Pending', dead: 'Dead', items: 'items', writtenRate: '<Written>', attemptedRate: 'Attempts', itemsPerSecond: '<items/s>' }, { objectName: name, view: 'throughput' })
  assert.match(html, /&lt;Written&gt;/); assert.match(html, /3 &lt;items\/s&gt;/); assert.match(html, /&lt;unsafe&gt;/)
  assert.doesNotMatch(html, /<unsafe>|<Written>/)
})

test('combined tooltip shows counts and rates together without changing legacy two-metric calls', () => {
  const labels = { queue: 'Queue', aggregate: 'All selected', pending: 'Pending', dead: 'Retained failures', items: 'items', writtenRate: 'Write rate', attemptedRate: 'Attempts', itemsPerSecond: 'items/s' }
  const history = [sample(1000, queue('a', '9007199254740993', '100', { pending: 6, dead: 2 }), queue('b', '10', '10', { pending: 4, dead: 0 })), sample(2000, queue('a', '9007199254741003', '103', { pending: 3, dead: 0 }), queue('b', '15', '12', { pending: 2, dead: 0 }))]
  const combined = bufferTooltipHtml(history, 2000, labels, { grouping: 'aggregate', visibleObjectNames: ['a', 'b'], combined: true })
  for (const heading of ['Pending', 'Retained failures', 'Write rate', 'Attempts']) assert.ok(combined.includes(`<b>${heading}</b>`))
  for (const reading of ['5 items', '0 items', '15 items/s', '5 items/s']) assert.ok(combined.includes(`<span>${reading}</span>`))
  assert.ok(!combined.includes('title="a"'), 'aggregate tooltip uses the same aggregate scope as the chart')
  const selected = bufferTooltipHtml(history, 2000, labels, { visibleObjectNames: ['a'], combined: true })
  assert.match(selected, /title="a"/); assert.doesNotMatch(selected, /title="b"/)
  assert.match(selected, /10 items\/s/); assert.match(selected, /3 items\/s/)
  const first = bufferOverviewPoints(history, ['a', 'b'])[0]
  assert.deepEqual(first, { sampledAt: 1000, pending: 10, dead: 2, writtenRate: undefined, attemptedRate: undefined })
  const legacyBacklog = bufferTooltipHtml(history, 2000, labels, { visibleObjectNames: ['a'] })
  assert.match(legacyBacklog, /<b>Pending<\/b>/); assert.doesNotMatch(legacyBacklog, /<b>Write rate<\/b>/)
  const legacyRates = bufferTooltipHtml(history, 2000, labels, { visibleObjectNames: ['a'], view: 'throughput' })
  assert.match(legacyRates, /<b>Write rate<\/b>/); assert.doesNotMatch(legacyRates, /<b>Pending<\/b>/)
})

function chartHarness(config = {}, initialQueues = ['a', 'b']) {
  const filename = resolve(root, 'src/components/RuntimeDiagnostics/buffer/BufferOverviewChart.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename }), compiled = compileScript(descriptor, { id: 'runtime-buffer-test' })
  const { code } = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === 'ant-design-vue') return { theme: { useToken: () => ({ token: vue.ref({ colorPrimary: 'blue', colorSuccess: 'green', colorWarning: 'gold', colorError: 'red', purple: 'purple', cyan: 'cyan' }) }) } }
    if (id.endsWith('.vue') || id.startsWith('echarts/') || id.startsWith('@ant-design/icons')) return {}
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }, module, module.exports)
  const props = vue.reactive({ queues: initialQueues.map(name => ({ objectName: name, name, written: '10', attempted: '9', pending: 1, dead: 0 })), history: [sample(1000, queue('a', '10', '9', { pending: 1, dead: 0 }))], config: { filter: 'pending', grouping: 'queues', ...config }, resetAccess: { allowed: true }, resetState: { status: 'ready' } }), events = [], scope = vue.effectScope()
  const chart = scope.run(() => module.exports.default.setup(props, { expose() {}, emit: (...event) => events.push(event) }))
  return { scope, chart, props, events }
}

test('native queue legend restores old single selection and limits display to currently available queues', async () => {
  const h = chartHarness({ objectName: 'a', view: 'throughput' })
  try {
    assert.equal(h.chart.hasData.value, true)
    h.chart.selectScale('compressed'); assert.equal(h.events.at(-1)[1].filter, 'pending')
    assert.equal(h.events.at(-1)[1].objectName, 'a'); assert.equal(h.events.at(-1)[1].view, 'throughput')
    h.chart.selectLegend({ selected: { a: false, b: true } }); await vue.nextTick(); assert.equal(h.chart.visibleQueues.value[0].objectName, 'b')
    assert.deepEqual(h.events.at(-1)[1].visibleObjectNames, ['b'])
    h.props.queues = [h.props.queues[0]]; await vue.nextTick(); assert.equal(h.chart.visibleQueues.value.length, 0)
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['b']); assert.equal(h.chart.visibleQueues.value.length, 0)
    h.props.config = { filter: 'failed', grouping: 'queues', objectName: 'invalid' }; await vue.nextTick(); assert.equal(h.chart.visibleQueues.value.length, 0)
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['invalid'])
  } finally { h.scope.stop() }
})

test('persisted and legacy queue selections survive empty load, partial snapshots and delayed return', async () => {
  for (const config of [{ visibleObjectNames: ['a'] }, { objectName: 'a' }]) {
    const h = chartHarness(config, [])
    try {
      assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['a'])
      assert.equal(h.chart.visibleQueues.value.length, 0)
      h.props.queues = ['a', 'b'].map(name => ({ objectName: name, name, pending: 1, dead: 0 })); await vue.nextTick()
      assert.deepEqual(h.chart.visibleQueues.value.map(queue => queue.objectName), ['a'])
      h.props.queues = [{ objectName: 'b', name: 'b', pending: 4, dead: 0 }]
      await vue.nextTick()
        assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['a'])
      assert.equal(h.chart.tooltip([{ axisValue: 1000 }]), '', 'a missing selected queue is not presented as available data')
      h.props.queues = []; await vue.nextTick()
      h.props.config = { filter: 'pending', grouping: 'queues', ...config, scale: 'compressed' }; await vue.nextTick()
      h.props.queues = ['a', 'b'].map(name => ({ objectName: name, name, pending: 2, dead: 0 })); await vue.nextTick()
      assert.deepEqual(h.chart.visibleQueues.value.map(queue => queue.objectName), ['a'])
      assert.equal(h.chart.selection.value.scale, 'compressed')
      assert.equal(h.events.length, 0, 'loading, losing and restoring snapshots never writes an empty preference or invokes reset')
    } finally { h.scope.stop() }
  }
  const h = chartHarness({ visibleObjectNames: [] }, [])
  try {
    h.props.queues = [{ objectName: 'a', name: 'a', pending: 1 }]; await vue.nextTick()
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, []); assert.equal(h.chart.visibleQueues.value.length, 0)
    assert.equal(h.events.length, 0)
  } finally { h.scope.stop() }
})

const { useBufferQueueReset } = load(resolve(root, 'src/components/RuntimeDiagnostics/buffer/useBufferQueueReset.ts'))
function resetHarness() {
  const context = { queues: vue.ref([{ objectName: 'a' }, { objectName: 'b' }]), active: vue.ref(true), scope: vue.ref('aggregate'), access: vue.ref({ allowed: true }), state: vue.ref({ status: 'ready' }) }, events = [], scope = vue.effectScope()
  return { context, events, scope, reset: scope.run(() => useBufferQueueReset(context, objectName => events.push(objectName))) }
}

test('queue-details reset confirms one canonical target and invalidates hidden, missing, reselected, denied and busy targets', () => {
  const h = resetHarness(), { context, reset, events } = h
  try {
    reset.request('missing'); reset.confirm(); assert.deepEqual(events, [])
    for (const invalidate of [() => context.access.value.allowed = false, () => context.state.value.status = 'loading', () => context.scope.value = 'queues:a', () => context.active.value = false, () => context.queues.value = [{ objectName: 'b' }]]) {
      context.access.value.allowed = true; context.state.value.status = 'ready'; context.active.value = true; context.queues.value = [{ objectName: 'a' }, { objectName: 'b' }]; context.scope.value = 'aggregate'
      reset.request('a'); assert.equal(reset.resetTarget.value, 'a'); invalidate(); reset.confirm()
      assert.equal(reset.resetOpen.value, false); assert.deepEqual(events, [])
    }
    context.queues.value = [{ objectName: 'b' }]; context.active.value = true
    reset.request('b'); reset.confirm(); reset.confirm()
    assert.deepEqual(events, ['b'])
    reset.request('b'); reset.cancel(); reset.confirm(); assert.deepEqual(events, ['b'])
  } finally { h.scope.stop() }
})

test('reset focus returns only to the connected trigger, with a connected details fallback', () => {
  const h = resetHarness(), focused = []
  try {
    const trigger = { isConnected: true, focus: () => focused.push('trigger') }, fallback = { isConnected: true, focus: () => focused.push('details') }
    h.reset.request('a', trigger); h.reset.cancel(); h.reset.restoreFocus(fallback)
    h.reset.request('b', trigger); trigger.isConnected = false; h.reset.cancel(); h.reset.restoreFocus(fallback)
    fallback.isConnected = false; h.reset.restoreFocus(fallback)
    assert.deepEqual(focused, ['trigger', 'details'])
  } finally { h.scope.stop() }
})

test('legend selection is per canonical identity, survives sampling and does not expand after an explicit choice', async () => {
  const h = chartHarness()
  try {
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['a', 'b'])
    h.props.queues.push({ objectName: 'c', name: 'a', pending: 1, dead: 0 }); await vue.nextTick()
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['a', 'b', 'c'], 'implicit default includes newly discovered queues')
    h.chart.chartEvents.legendselectchanged({ selected: { a: true, b: false, c: false } })
    const originalSeries = h.chart.option.value.series.find(series => series.name === 'a')
    h.props.history.push(sample(2000, queue('a', '12', '10', { pending: 2, dead: 0 }))); await vue.nextTick()
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['a'])
    assert.equal(h.chart.option.value.series.find(series => series.name === 'a').id, originalSeries.id)
    assert.equal(h.chart.option.value.series.find(series => series.name === 'a').itemStyle.color, originalSeries.itemStyle.color)
    h.props.queues.push({ objectName: 'd', name: 'new', pending: 1 }); await vue.nextTick()
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['a'], 'explicit comparison is not expanded by new queues')
    h.chart.chartEvents.legendselectall({ selected: { a: true, b: true, c: true, d: true } })
    assert.equal(h.chart.selection.value.objectName, undefined)
    h.chart.chartEvents.legendinverseselect({ selected: { a: false, b: false, c: false, d: false } })
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, []); assert.equal(h.chart.hasData.value, false)
    h.chart.configure({ view: 'backlog' }); h.chart.selectScale('compressed')
    assert.deepEqual(h.events.at(-1)[1].visibleObjectNames, [], 'view and scale changes do not reset an empty selection')
    assert.equal(h.events.at(-1)[1].scale, 'compressed')
    assert.deepEqual(h.chart.option.value.legend.data, ['a', 'b', 'c', 'd'])
    assert.equal(h.chart.option.value.legend.type, 'scroll')
  } finally { h.scope.stop() }
})

test('more-menu selection helpers preserve canonical legend preferences without weakening reset confirmation', async () => {
  const h = chartHarness({ visibleObjectNames: ['a'] })
  try {
    h.chart.selectAll()
    assert.deepEqual(h.events.at(-1)[1].visibleObjectNames, ['a', 'b'])
    h.chart.invertSelection()
    assert.deepEqual(h.events.at(-1)[1].visibleObjectNames, [])
    h.chart.selectAll(); await vue.nextTick(); const before = h.chart.selectionKey.value
    h.chart.invertSelection(); assert.notEqual(h.chart.selectionKey.value, before, 'detail reset scope changes with legend selection')
  } finally { h.scope.stop() }
})

test('buffer options expose the frozen collection-settings event while keeping ECharts as the queue legend owner', () => {
  const source = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/buffer/BufferOverviewChart.vue'), 'utf8')
  assert.match(source, /event: 'settings'/)
  assert.match(source, /legendselectchanged: selectLegend/)
  assert.match(source, /@click="selectAll"/)
  assert.match(source, /@click="invertSelection"/)
  assert.doesNotMatch(source, /selector:\s*\[/)
  assert.match(source, /onDeactivated\(\(\) => closeOptions\(\)\)/)
  assert.match(source, /@keydown\.esc\.stop="closeOptions\(true\)"/)
  assert.match(source, /optionsTrigger\.value\?\.\$el\.focus\(\)/)
})

test('opening collection settings closes local floating controls before the host opens its settings panel', () => {
  const h = chartHarness({ objectName: 'a' })
  try {
    h.chart.optionsOpen.value = true
    h.chart.openSettings()
    assert.equal(h.chart.optionsOpen.value, false)
    assert.deepEqual(h.events.at(-1), ['settings'])
  } finally { h.scope.stop() }
})

test('each queue keeps counts and rates on separate axes while compression preserves zero, gaps and raw tooltip values', async () => {
  const h = chartHarness({ visibleObjectNames: ['a', 'b'] })
  try {
    h.props.history = [sample(1000, queue('a', '0', '0', { pending: 0, dead: 0 }), queue('b', '0', '0', { pending: 1000000, dead: 0 })),
      sample(2000, queue('a', '1', '0', { pending: 1, dead: 0 })),
      sample(3000, queue('a', '2', '1', { pending: 2, dead: 0 }), queue('b', '10000', '8000', { pending: 999000, dead: 10 }))]
    await vue.nextTick(); h.chart.selectScale('compressed')
    const series = h.chart.option.value.series
    const metric = (name, key) => series.find(item => item.id === JSON.stringify([name, key]))
    assert.equal(series.length, 7)
    assert.equal(metric('a', 'pending').itemStyle.color, metric('a', 'writtenRate').itemStyle.color)
    assert.equal(metric('a', 'pending').yAxisIndex, 0); assert.equal(metric('a', 'writtenRate').yAxisIndex, 1); assert.equal(metric('a', 'attemptedRate').yAxisIndex, 1)
    assert.equal(metric('b', 'dead').yAxisIndex, 0); assert.equal(metric('b', 'dead').itemStyle.color, 'red')
    assert.deepEqual(metric('a', 'pending').data[0], [1000, 0]); assert.equal(metric('b', 'pending').data[1][1], null)
    assert.ok(Math.abs(metric('b', 'pending').data[0][1] - Math.log1p(1000000)) < 1e-10)
    assert.equal(metric('b', 'pending').connectNulls, false)
    const tooltip = h.chart.tooltip([{ axisValue: 1000 }])
    assert.match(tooltip, /1000000 runtimeDiagnostics.items/); assert.doesNotMatch(tooltip, /13\.815/)
    h.chart.selectLegend({ selected: { a: true, b: false } })
    assert.doesNotMatch(h.chart.tooltip([{ axisValue: 1000 }]), /1000000|title="b"/)
    assert.equal(metric('b', 'writtenRate').data[2][1], null, 'rate never bridges the missing queue')
    assert.equal(metric('b', 'dead').showSymbol, true)
    assert.ok(metric('b', 'dead').symbolSize([3000, 10]) > 0, 'an isolated real failure remains visible')
    assert.equal(metric('b', 'dead').symbolSize([1000, 0]), 0, 'a real zero is not marked as a positive failure')
  } finally { h.scope.stop() }
})

test('queue colors are distinct within the palette and stable across reordering, refresh and legend changes', async () => {
  const names = ['org.jetlinks:name=e,type=PersistenceBuffer', 'org.jetlinks:name=d,type=PersistenceBuffer', 'org.jetlinks:name=c,type=PersistenceBuffer', 'org.jetlinks:name=b,type=PersistenceBuffer', 'org.jetlinks:name=a,type=PersistenceBuffer']
  const h = chartHarness({ grouping: 'queues' }, names)
  try {
    const colors = () => Object.fromEntries(h.chart.option.value.series.filter(series => JSON.parse(series.id)[1] === 'pending').map(series => [series.name, series.itemStyle.color]))
    const before = colors()
    assert.equal(new Set(Object.values(before)).size, names.length)
    h.props.queues.reverse(); await vue.nextTick(); assert.deepEqual(colors(), before)
    h.props.queues = h.props.queues.map(queue => ({ ...queue, pending: 7 })); await vue.nextTick(); assert.deepEqual(colors(), before)
    h.chart.selectLegend({ selected: Object.fromEntries(names.map((name, index) => [name, index === 0])) })
    assert.deepEqual(colors(), before, 'selecting one queue does not recolor other identities')
    h.props.queues.push({ objectName: 'org.jetlinks:name=z,type=PersistenceBuffer', pending: 0 }); await vue.nextTick()
    assert.equal(new Set(Object.values(colors())).size, 5, 'additional identities cycle only after the palette is exhausted')
  } finally { h.scope.stop() }
})

test('display normalization treats old single, default all and empty selection distinctly; log1p is reversible', () => {
  assert.equal(normalizeBufferConfig(undefined, ['a', 'b']).grouping, 'aggregate')
  assert.deepEqual(normalizeBufferConfig(undefined, ['a', 'b']).visibleObjectNames, ['a', 'b'])
  assert.deepEqual(normalizeBufferConfig({ filter: 'all', objectName: 'a' }, ['a', 'b']).visibleObjectNames, ['a'])
  assert.deepEqual(normalizeBufferConfig({ filter: 'all', objectName: 'a', visibleObjectNames: [] }, ['a', 'b']).visibleObjectNames, [])
  assert.equal(normalizeBufferConfig({ filter: 'all', visibleObjectNames: ['a', 'b'] }, ['a', 'b']).objectName, undefined)
  for (const value of [0, 0.01, 1, 100, 1e9]) {
    const restored = bufferAxisValue(bufferPlotValue(value, 'compressed'), 'compressed')
    assert.ok(Math.abs(restored - value) <= Math.max(1, value) * 1e-12)
  }
  assert.equal(bufferPlotValue(undefined, 'compressed'), null); assert.equal(bufferPlotValue(-1, 'linear'), null)
  assert.equal(bufferColorIndex('org.jetlinks:name=a,type=PersistenceBuffer', 6), bufferColorIndex('org.jetlinks:name=a,type=PersistenceBuffer', 6))
  assert.equal(bufferTooltipHtml([sample(1000, queue('a', '1', '1'))], 1000, { queue: 'Queue', pending: 'Pending', dead: 'Failed', items: 'items' }, { visibleObjectNames: [] }), '')
})

test('default aggregate uses all current identities across summary, history and tooltip while preserving queue preferences', async () => {
  const h = chartHarness({ grouping: undefined, visibleObjectNames: ['a'] })
  try {
    h.props.history = [sample(1000, queue('a', '9007199254740993', '2', { pending: 4, dead: 0 }), queue('b', '10', '4', { pending: 6, dead: 0 })), sample(2000, queue('a', '9007199254740996', '4', { pending: 5, dead: 0 }), queue('b', '15', '8', { pending: 7, dead: 0 }))]
    h.props.queues[0].pending = 5; h.props.queues[1].pending = 7
    assert.equal(h.chart.selection.value.grouping, 'aggregate'); assert.equal(h.chart.option.value.legend.show, false)
    assert.equal(h.chart.option.value.series.length, 3, 'count, write and attempt rates coexist; zero retained failures add no curve')
    assert.deepEqual(h.chart.option.value.series[0].data, [[1000, 10], [2000, 12]])
    assert.equal(h.chart.pending.value, 12); assert.equal(h.chart.currentRate.value.writtenRate, 8); assert.equal(h.chart.currentRate.value.attemptedRate, 6)
    assert.match(h.chart.tooltip([{ axisValue: 2000 }]), /12 runtimeDiagnostics.items/)
    assert.doesNotMatch(h.chart.tooltip([{ axisValue: 2000 }]), /title="a"|title="b"/)
    h.chart.selectGrouping('queues'); assert.equal(h.chart.option.value.legend.show, true); assert.equal(h.chart.pending.value, 5)
    assert.equal(h.chart.currentRate.value.writtenRate, 3); assert.deepEqual(h.chart.scopeNames.value, ['a'])
    assert.match(h.chart.tooltip([{ axisValue: 2000 }]), /title="a"/); assert.doesNotMatch(h.chart.tooltip([{ axisValue: 2000 }]), /title="b"/)
    h.chart.selectLegend({ selected: { a: false, b: false } }); h.chart.selectGrouping('aggregate')
    assert.equal(h.chart.pending.value, 12); assert.deepEqual(h.chart.selection.value.visibleObjectNames, [])
    h.chart.selectGrouping('queues'); assert.equal(h.chart.pending.value, undefined); assert.equal(h.chart.hasData.value, false)
  } finally { h.scope.stop() }
})

test('aggregate membership never substitutes partial values or bridges missing members, fields, reset epochs or identity changes', async () => {
  const history = [sample(1000, queue('a', '1', '1', { pending: 0, dead: 0 })), sample(2000, queue('a', '2', '2', { pending: 2, dead: 0 }), queue('b', '2', '2', { pending: 4, dead: 0 })), sample(3000, queue('a', '3', '3', { pending: 3, dead: 0 })), sample(4000, queue('a', '4', '4', { pending: 4, dead: 0 }), queue('b', '5', '4', { pending: 5, dead: 0 }))]
  assert.deepEqual(bufferHistoryPoints(history, ['a', 'b']).map(point => point.pending), [undefined, 6, undefined, 9])
  assert.deepEqual(bufferThroughputPoints(history, ['a', 'b']).map(point => point.writtenRate), [undefined, undefined, undefined, undefined])
  assert.equal(bufferQuantityTotal([{ pending: 3 }, {}], 'pending'), undefined)
  assert.equal(bufferQuantityTotal([{ pending: 3 }, { pending: 0 }], 'pending'), 3)
  const h = chartHarness({ grouping: 'aggregate', visibleObjectNames: [] })
  try {
    h.props.history = history; h.props.queues[1].pending = undefined
    assert.equal(h.chart.pending.value, undefined)
    assert.deepEqual(h.chart.option.value.series[0].data.map(point => point[1]), [null, 6, null, 9])
    assert.match(h.chart.tooltip([{ axisValue: 3000 }]), /<span>—<\/span>/)
    h.props.queues.push({ objectName: 'new', name: 'new', pending: 0, dead: 0 }); await vue.nextTick()
    assert.ok(h.chart.option.value.series[0].data.every(point => point[1] === null), 'new current identity is required throughout aggregate history')
  } finally { h.scope.stop() }
})

test('switching grouping retains implicit all and legacy view; temporary missing identities survive every legend operation', async () => {
  const h = chartHarness({ grouping: 'aggregate', view: 'throughput' })
  try {
    const before = h.chart.option.value.series.map(series => series.id)
    h.chart.configure({ view: 'backlog' })
    assert.deepEqual(h.chart.option.value.series.map(series => series.id), before, 'old view preferences never remove metrics from the combined chart')
    h.chart.selectGrouping('queues')
    assert.equal(h.events.at(-1)[1].visibleObjectNames, undefined)
    assert.equal(h.events.at(-1)[1].view, 'backlog', 'the legacy preference still survives unrelated settings')
    h.props.queues.push({ objectName: 'c', name: 'c', pending: 0 }); await vue.nextTick()
    assert.deepEqual(h.chart.scopeNames.value, ['a', 'b', 'c'])
    h.props.config = { filter: 'all', grouping: 'queues', visibleObjectNames: ['a', 'missing'] }; await vue.nextTick()
    h.chart.selectLegend({ selected: { a: false, b: true, c: false } })
    assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['missing', 'b'])
    h.chart.selectAll(); assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['missing', 'a', 'b', 'c'])
    h.chart.invertSelection(); assert.deepEqual(h.chart.selection.value.visibleObjectNames, ['missing'])
  } finally { h.scope.stop() }
})

test('production Buffer wiring forwards inspect and details owns cumulative fields, single-target confirmation and unpaginated table', () => {
  const overview = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/RuntimeMBeanOverview.vue'), 'utf8')
  const chart = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/buffer/BufferOverviewChart.vue'), 'utf8')
  const details = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/buffer/BufferQueueDetails.vue'), 'utf8')
  assert.match(overview, /@inspect="value => emit\('inspect', value\)"/)
  assert.match(overview, /props\.resetAccess\.allowed && props\.resetState\.status !== 'loading' && view\.value\.buffers\.some/)
  assert.match(chart, /@inspect="value => emit\('inspect', value\)"/)
  assert.match(chart, /renderer="svg"/); assert.match(chart, /height:240px/)
  assert.doesNotMatch(chart.split('<script')[0], /bufferWritten|bufferAttempted|bufferResetConfirm/)
  assert.match(details, /:pagination="false"/); assert.match(details, /v-if="expanded"/)
  assert.match(details, /bufferWritten/); assert.match(details, /bufferAttempted/); assert.match(details, /@cancel="cancel"/); assert.match(details, /@after-close="restoreFocus/)
  const zh = JSON.parse(readFileSync(resolve(root, 'src/locales/lang/zh.json'), 'utf8')), en = JSON.parse(readFileSync(resolve(root, 'src/locales/lang/en.json'), 'utf8'))
  const used = [...`${chart}\n${details}`.matchAll(/runtimeDiagnostics\.buffer[A-Za-z]+/g)].map(match => match[0])
  for (const key of new Set(used)) { assert.equal(typeof zh[key], 'string', key); assert.equal(typeof en[key], 'string', key) }
  const keys = dictionary => Object.keys(dictionary).filter(key => key.startsWith('runtimeDiagnostics.buffer')).sort()
  assert.deepEqual(keys(zh), keys(en))
})

test('empty and first samples avoid an epoch axis, insufficient rates wait, and repeated zero backlog stays valid', () => {
  const h = chartHarness({ grouping: 'aggregate' })
  try {
    h.props.history = []; assert.equal(h.chart.hasData.value, false); assert.equal(h.chart.option.value.xAxis.show, false); assert.ok(h.chart.option.value.yAxis.every(axis => !axis.show))
    h.props.history = [sample(1000, queue('a', '0', '0', { pending: 0, dead: 0 }), queue('b', '0', '0', { pending: 0, dead: 0 }))]
    assert.equal(h.chart.hasData.value, true); assert.equal(h.chart.hasLine.value, false); assert.equal(h.chart.points.value.length, 1); assert.equal(h.chart.option.value.xAxis.show, false)
    assert.equal(h.chart.currentRate.value.writtenRate, undefined); assert.equal(h.chart.option.value.xAxis.show, false)
    assert.ok(h.chart.option.value.series.filter(series => series.yAxisIndex === 1).every(series => series.data[0][1] === null))
    h.props.history.push(sample(2000, queue('a', '0', '0', { pending: 0, dead: 0 }), queue('b', '0', '0', { pending: 0, dead: 0 })))
    assert.equal(h.chart.hasData.value, true); assert.equal(h.chart.hasLine.value, true); assert.equal(h.chart.currentRate.value.writtenRate, 0)
    assert.equal(h.chart.option.value.xAxis.show, true)
    assert.deepEqual(h.chart.option.value.series[0].data, [[1000, 0], [2000, 0]]); assert.equal(h.chart.hasLine.value, true)
    assert.equal(h.chart.option.value.series[0].showSymbol, false); assert.equal(h.chart.option.value.animation, false)
    assert.equal(h.chart.option.value.legend.icon, 'rect'); assert.equal(h.chart.option.value.legend.itemHeight, 2)
  } finally { h.scope.stop() }
})
