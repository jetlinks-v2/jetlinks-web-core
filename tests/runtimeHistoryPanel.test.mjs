import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const filename = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/history/HistoryMetricChart.vue')
const compiled = compileScript(parse(readFileSync(filename, 'utf8'), { filename }).descriptor, { id: 'history-panel-test' })
const module = { exports: {} }
new Function('require', 'module', 'exports', transformSync(compiled.content, { loader: 'ts', format: 'cjs' }).code)(id => {
  if (id === 'vue') return vue
  if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
  if (id === 'ant-design-vue') return { Empty: {}, theme: { useToken: () => ({ token: vue.ref({ colorPrimary: 'blue' }) }) } }
  if (id.endsWith('.vue') || id.startsWith('echarts/') || id.startsWith('@ant-design/icons')) return {}
  return require(id)
}, module, module.exports)

function harness(t) {
  const props = vue.reactive({ chart: { key: 'cpu', label: 'CPU', unit: '%', series: [{ key: 'jvm', label: 'JVM', color: 'blue', samples: [{ timestamp: 1000, value: 0 }, { timestamp: 2000, value: 10 }] }] }, compact: true, range: { from: 1000, to: 2000 } })
  const scope = vue.effectScope()
  const view = scope.run(() => module.exports.default.setup(props, { expose() {}, emit() {} }))
  t.after(() => scope.stop())
  return { props, view }
}

test('compact capacity reveals existing charts without toggling manual expansion or requesting data', async t => {
  const filename = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/RuntimeMetricsPanel.vue')
  const compiled = compileScript(parse(readFileSync(filename, 'utf8'), { filename }).descriptor, { id: 'metrics-panel-capacity-test' })
  const target = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(compiled.content, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.endsWith('.vue') || id.startsWith('@ant-design/icons')) return {}
    return require(id)
  }, target, target.exports)
  const charts = ['cpu', 'memory', 'hostTraffic', 'traffic', 'quality', 'tcpConnections'].map(key => ({ key, label: key, series: [] }))
  const props = vue.reactive({ charts, compact: true, initialChartKeys: ['cpu', 'memory'], expanded: undefined, chartCapacity: undefined })
  const events = [], scope = vue.effectScope()
  const panel = scope.run(() => target.exports.default.setup(props, { expose() {}, emit: (...args) => events.push(args) }))
  t.after(() => scope.stop())
  assert.equal(panel.displayCharts.value.length, 2)
  props.chartCapacity = 4; await vue.nextTick()
  assert.equal(panel.displayCharts.value.length, 4)
  props.chartCapacity = 6; await vue.nextTick()
  assert.equal(panel.displayCharts.value.length, 6)
  assert.equal(panel.expanded.value, false); assert.deepEqual(events, [])
  panel.toggleExpanded(); props.chartCapacity = 2; await vue.nextTick()
  assert.equal(panel.expanded.value, true); assert.equal(panel.displayCharts.value.length, 6)
  panel.toggleExpanded(); await vue.nextTick()
  assert.equal(panel.displayCharts.value.length, 2)
  assert.deepEqual(events, [['update:expanded', true], ['update:expanded', false]])
  props.compact = false; assert.equal(panel.displayCharts.value.length, 6)
})

test('sampling submits only data while static options and series identity stay stable', async t => {
  const { props, view } = harness(t), option = view.option.value, data = view.dataOption.value
  const topology = view.topology.value
  props.chart = { ...props.chart, series: props.chart.series.map(series => ({ ...series, samples: [...series.samples, { timestamp: 3000, value: 20 }] })) }
  props.range = { from: 2000, to: 3000 }
  await vue.nextTick()
  assert.equal(view.option.value, option)
  assert.equal(view.topology.value, topology)
  assert.notEqual(view.dataOption.value, data)
  assert.deepEqual(view.dataOption.value.series[0].data.at(-1), [3000, 20])
  assert.equal(view.dataOption.value.xAxis.min, 2000)
  assert.equal(view.option.value.series[0].data, undefined)
})

test('missing endpoints remain null and unknown, while zero is a valid reading', async t => {
  const { props, view } = harness(t)
  props.chart.series[0].samples.push({ timestamp: 3000 })
  await vue.nextTick()
  assert.deepEqual(view.dataOption.value.series[0].data.at(-1), [3000, null])
  assert.equal(view.reading(undefined), '—')
  assert.equal(view.reading(0), '0')
  assert.equal(view.hasData.value, true)
  props.chart.series[0].samples = [{ timestamp: 3000 }]
  assert.equal(view.hasData.value, false)
})

test('style changes update options without recreating series; topology tracks removed series', async t => {
  const { props, view } = harness(t), initial = view.option.value, topology = view.topology.value
  props.chart.series[0].color = 'red'
  await vue.nextTick()
  assert.notEqual(view.option.value, initial)
  assert.equal(view.topology.value, topology)
  assert.equal(view.option.value.series[0].itemStyle.color, 'red')
  props.chart.series = []
  assert.notEqual(view.topology.value, topology)
  assert.deepEqual(view.dataOption.value.series, [])
})

test('single samples remain visible with a usable axis and node time formatting', t => {
  const { props, view } = harness(t)
  const format = timestamp => `node:${timestamp}`
  props.chart.formatTime = format
  props.range = { from: 1000, to: 1000 }
  props.chart.series[0].samples = [{ timestamp: 1000, value: 0 }]
  assert.equal(view.option.value.xAxis.axisLabel.formatter(1000), 'node:1000')
  assert.equal(view.option.value.xAxis.axisPointer.label.formatter({ value: 1000 }), 'node:1000', 'native tooltips retain the node timezone')
  assert.ok(view.dataOption.value.xAxis.max > view.dataOption.value.xAxis.min)
  assert.equal(view.dataOption.value.series[0].showSymbol, true)
  assert.deepEqual(view.dataOption.value.series[0].data, [[1000, 0]])
})

test('compact tooltips stay within the plot while custom detail formatters remain available', async t => {
  const { props, view } = harness(t)
  assert.equal(view.option.value.tooltip.confine, true)
  assert.notEqual(view.option.value.tooltip.enterable, true, 'a read-only tooltip must not intercept the pointer')
  assert.equal(view.option.value.tooltip.hideDelay, 0)
  assert.match(view.option.value.tooltip.extraCssText, /max-width:min\(260px,100%\)/)
  assert.match(view.option.value.tooltip.extraCssText, /max-height:100%;overflow:hidden/)
  assert.equal(view.option.value.tooltip.formatter, undefined, 'compact charts use their own series tooltip')
  assert.equal(view.option.value.tooltip.valueFormatter(0), '0%')
  const formatter = () => 'full detail'
  props.compact = false
  props.tooltipFormatter = formatter
  await vue.nextTick()
  assert.equal(view.option.value.tooltip.formatter, formatter)
  assert.equal(view.option.value.tooltip.hideDelay, undefined)
  assert.equal(view.option.value.tooltip.extraCssText, undefined)
})
