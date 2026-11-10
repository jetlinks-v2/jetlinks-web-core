import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import { composeStreamOption } from './echartsStreamFixture.mjs'

const require = createRequire(import.meta.url)
function harness(t, visible = false) {
  const mounted = [], unmounted = [], activated = [], deactivated = [], frames = new Map(), instances = [], observers = []
  let nextFrame = 0, prepares = 0, ready = 0, reads = 0, width = 600, resize
  const original = { window: globalThis.window, ResizeObserver: globalThis.ResizeObserver, IntersectionObserver: globalThis.IntersectionObserver }
  globalThis.window = { addEventListener() {}, removeEventListener() {}, requestAnimationFrame(cb) { frames.set(++nextFrame, cb); return nextFrame }, cancelAnimationFrame(id) { frames.delete(id) } }
  globalThis.ResizeObserver = class { constructor(cb) { resize = cb } observe() {} disconnect() {} }
  globalThis.IntersectionObserver = class { constructor(cb) { this.callback = cb; observers.push(this) } observe(target) { this.target = target } disconnect() { this.disconnected = true } }
  const element = { get clientWidth() { reads++; return width }, get clientHeight() { reads++; return width ? 240 : 0 } }
  const chart = { use() {}, init() {
    const instance = { writes: [], option: {}, resizes: [], setOption(option) { this.writes.push(option); this.option = composeStreamOption(this.option, JSON.parse(JSON.stringify(option))) },
      getOption() { return this.option }, getDataURL() { return this.option }, resize(size) { this.resizes.push(size) }, dispose() { this.disposed = true } }
    instances.push(instance); return instance
  } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(new URL('../src/hooks/Echarts/useEcharts.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return { ...vue, onMounted: cb => mounted.push(cb), onUnmounted: cb => unmounted.push(cb), onActivated: cb => activated.push(cb), onDeactivated: cb => deactivated.push(cb) }
    if (id === './library') return { __esModule: true, default: chart }
    if (id === './streamOption') return { composeStreamOption }
    if (id === './pixelRatio') return { ECHARTS_PIXEL_RATIO_KEY: Symbol('echarts-pixel-ratio') }
    if (id === './measuredLayout') return { createMeasuredEchartsLayout: () => ({ prepare() { prepares++ }, apply() {}, dispose() {}, setEnabled() {} }) }
    return require(id)
  }, module, module.exports)
  const props = vue.reactive({ deferOffscreen: true, option: { animation: false, legend: { selected: { a: true } }, dataZoom: [{ start: 0, end: 100 }], xAxis: { type: 'time' }, series: [{ id: 'a', type: 'line', itemStyle: { color: 'blue' } }] }, dataOption: { xAxis: { min: 1, max: 2 }, series: [{ id: 'a', data: [1, 2] }] } })
  const scope = vue.effectScope(), api = scope.run(() => module.exports.useEcharts(vue.shallowRef(element), props, { onReady() { ready++ } }))
  const visibility = value => observers.at(-1).callback([{ target: element, isIntersecting: value }])
  mounted.forEach(cb => cb()); if (visible) visibility(true)
  t.after(() => { unmounted.forEach(cb => cb()); scope.stop(); Object.assign(globalThis, original) })
  return { props, api, frames, instances, observers, unmounted, deactivated, activated, visibility,
    paint() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb()) },
    dimensions(value) { width = value; resize() }, get prepares() { return prepares }, get ready() { return ready }, get reads() { return reads } }
}

test('stream snapshots merge once on initialization, then submit only latest data and retain interactions', async t => {
  const h = harness(t, true), instance = h.instances[0], reads = h.reads
  assert.equal(h.ready, 1); assert.equal(h.prepares, 1)
  assert.equal(instance.option.series[0].type, 'line'); assert.deepEqual(instance.option.series[0].data, [1, 2])
  instance.option.legend.selected.a = false; instance.option.dataZoom[0].start = 30
  for (let i = 3; i <= 5; i++) { h.props.dataOption = { xAxis: { min: i - 1, max: i }, series: [{ id: 'a', data: [i] }] }; await vue.nextTick() }
  assert.equal(h.frames.size, 1); assert.equal(instance.writes.length, 1)
  h.paint(); assert.equal(instance.writes.length, 2); assert.equal(h.prepares, 1)
  assert.deepEqual(Object.keys(instance.writes[1]).sort(), ['series', 'xAxis'])
  assert.equal(instance.writes[1].series[0].type, undefined, 'samples do not replay authored metadata')
  assert.equal(instance.option.legend.selected.a, false); assert.equal(instance.option.dataZoom[0].start, 30)
  assert.equal(h.reads, reads, 'samples do not trigger layout reads')
  h.props.dataOption.series[0].data.push(6); await vue.nextTick(); assert.equal(h.frames.size, 0, 'stream input is shallow-watched')
  h.props.option = { ...h.props.option, textStyle: { color: 'white' } }
  h.props.dataOption = { series: [{ id: 'a', data: [7] }] }; await vue.nextTick(); h.paint()
  assert.equal(instance.writes.length, 3); assert.equal(h.prepares, 2)
  assert.equal(instance.writes[2].textStyle.color, 'white'); assert.deepEqual(instance.writes[2].series[0].data, [7])
})

test('offscreen charts retain one snapshot and flush on visibility, export, renderer replacement and activation', async t => {
  const h = harness(t)
  assert.equal(h.instances.length, 0); assert.equal(h.ready, 0)
  for (let i = 3; i <= 5; i++) { h.props.dataOption = { series: [{ id: 'a', data: [i] }] }; await vue.nextTick() }
  assert.equal(h.frames.size, 0); assert.equal(h.instances.length, 0)
  h.visibility(true)
  const instance = h.instances[0]
  assert.equal(instance.writes.length, 1); assert.deepEqual(instance.option.series[0].data, [5])
  h.props.dataOption = { series: [{ id: 'a', data: [6] }] }; await vue.nextTick(); h.visibility(false)
  assert.equal(h.frames.size, 0)
  h.props.dataOption = { series: [{ id: 'a', data: [7] }] }; await vue.nextTick()
  assert.deepEqual(h.api.getDataURL().series[0].data, [7]); assert.equal(instance.writes.length, 2)
  instance.option.legend.selected.a = false; instance.option.dataZoom[0].start = 35
  h.props.renderer = 'svg'; await vue.nextTick(); assert.equal(instance.disposed, true)
  assert.equal(h.instances.length, 1, 'renderer recreation is deferred while offscreen')
  h.visibility(true); assert.equal(h.instances.length, 2)
  const replacement = h.instances[1]
  assert.equal(replacement.option.legend.selected.a, false); assert.equal(replacement.option.dataZoom[0].start, 35)
  h.dimensions(0); h.props.dataOption = { series: [{ id: 'a', data: [8] }] }; await vue.nextTick()
  assert.equal(h.frames.size, 0); h.dimensions(700); assert.deepEqual(replacement.option.series[0].data, [8])
  h.deactivated.forEach(cb => cb()); h.props.dataOption = { series: [{ id: 'a', data: [9] }] }; await vue.nextTick()
  assert.equal(h.frames.size, 0); await Promise.all(h.activated.map(cb => cb())); assert.deepEqual(replacement.option.series[0].data, [9])
  h.props.dataOption = { series: [{ id: 'a', data: [10] }] }; await vue.nextTick(); h.unmounted.forEach(cb => cb())
  assert.equal(h.frames.size, 0); assert.equal(h.observers[0].disconnected, true); assert.equal(replacement.disposed, true)
  h.visibility(true); assert.equal(h.instances.length, 2, 'late observer callbacks cannot resurrect disposed charts')
})

test('stream composition respects component identity and replaces data arrays without mutating source', () => {
  const source = { series: [{ id: 'a', type: 'line', data: [1, 2] }, { id: 'b', type: 'line' }], xAxis: { type: 'time', axisLabel: { color: 'blue' } } }
  const result = composeStreamOption(source, { series: [{ id: 'b', data: [3] }, { id: 'a', data: [] }], xAxis: { min: 0 } })
  assert.deepEqual(result.series.map(s => [s.id, s.type, s.data]), [['a', 'line', []], ['b', 'line', [3]]])
  assert.equal(result.xAxis.axisLabel.color, 'blue'); assert.equal(result.xAxis.min, 0); assert.deepEqual(source.series[0].data, [1, 2])
})

test('real ECharts preserves zoom, legend, mark lines and media while replacing streamed arrays', () => {
  const echarts = require('echarts'), chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width: 400, height: 240 })
  const configuration = { baseOption: { animation: false, legend: { data: ['Queue'] }, xAxis: { type: 'value' }, yAxis: {},
    dataZoom: [{ id: 'zoom', type: 'inside', start: 0, end: 100 }], series: [{ id: 'queue', name: 'Queue', type: 'line', markLine: { data: [{ xAxis: 2 }] } }] },
    media: [{ query: { maxWidth: 480 }, option: { xAxis: { splitNumber: 2 } } }] }
  try {
    chart.setOption(composeStreamOption(configuration, { xAxis: { min: 1, max: 3 }, series: [{ id: 'queue', data: [[1, 10], [2, 20], [3, 30]] }] }))
    assert.equal(chart.getOption().series[0].data.length, 3, 'initial data is composed into explicit baseOption')
    chart.dispatchAction({ type: 'dataZoom', start: 20, end: 80 }); chart.dispatchAction({ type: 'legendUnSelect', name: 'Queue' })
    chart.setOption({ xAxis: { min: 2, max: 4 }, series: [{ id: 'queue', data: [[2, 20], [4, 40]] }] })
    const current = chart.getOption()
    assert.deepEqual(current.series[0].data, [[2, 20], [4, 40]], 'shorter snapshots replace prior data')
    assert.equal(current.legend[0].selected.Queue, false); assert.equal(current.dataZoom[0].start, 20); assert.equal(current.dataZoom[0].end, 80)
    assert.equal(current.series[0].type, 'line'); assert.equal(current.series[0].markLine.data[0].xAxis, 2)
    assert.equal(chart.getModel().getComponent('xAxis').get('splitNumber'), 2, 'responsive media still applies')
  } finally { chart.dispose() }
})

test('disabling viewport deferral flushes the latest snapshot and ignores a disconnected observer', async t => {
  const h = harness(t), observer = h.observers[0]
  h.props.dataOption = { series: [{ id: 'a', data: [8] }] }; h.props.deferOffscreen = false; await vue.nextTick()
  assert.equal(h.instances.length, 1); assert.equal(observer.disconnected, true)
  observer.callback([{ target: observer.target, isIntersecting: false }])
  h.props.dataOption = { series: [{ id: 'a', data: [9] }] }; await vue.nextTick(); h.paint()
  assert.deepEqual(h.instances[0].option.series[0].data, [9])
})
