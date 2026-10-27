import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const component = relative => {
  const filename = resolve(import.meta.dirname, '../src', relative)
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const compiled = compileScript(descriptor, { id: 'runtime-diagnostics-host-test' })
  const { code } = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  const imports = id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === '../../ConditionFilter/value-editors' || id.startsWith('@ant-design/icons-vue')) return {}
    return require(id)
  }
  new Function('require', 'module', 'exports', code)(imports, module, module.exports)
  return module.exports.default
}

test('history presets and shared range editor submit each valid selection exactly once', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000000 })
  const props = vue.reactive({ range: { from: 6400000, to: 10000000, relativeSeconds: 3600 } }), events = [], scope = vue.effectScope()
  const state = scope.run(() => component('components/RuntimeDiagnostics/history/HistoryRangeControl.vue').setup(props, { expose() {}, emit: (...event) => events.push(event) }))
  try {
    assert.equal(state.preset.value, 3600)
    t.mock.timers.tick(120000); assert.equal(state.preset.value, 3600, 'relative labels retain their meaning while time passes')
    state.selectPreset(900); assert.deepEqual(events.at(-1), ['change', { from: 9220000, to: 10120000, relativeSeconds: 900 }])
    state.selectDates([120000, 240000]); state.selectDates([120000, 240000])
    assert.equal(events.length, 2, 'duplicate editor change/ok does not issue another request')
    props.range = { from: 120000, to: 240000 }; await vue.nextTick()
    state.selectDates([120000, 240000]); assert.equal(events.length, 2)
    for (const value of [null, [], [null, 100], [NaN, 100], [200, 100]]) state.selectDates(value)
    assert.equal(events.length, 2)
    state.selectDates([300000, 500000]); assert.equal(events.length, 3)
    assert.equal(state.open.value, false)
    props.range = { from: 0, to: 3600000 }; await vue.nextTick(); assert.equal(state.preset.value, undefined, 'historical custom hour is not labelled as the last hour')
    for (const seconds of [900, 3600, 21600, 86400]) {
      state.selectPreset(seconds); assert.equal(events.at(-1)[1].to - events.at(-1)[1].from, seconds * 1000); assert.equal(events.at(-1)[1].relativeSeconds, seconds)
    }
    props.range = { from: Date.now() - 3600000, to: Date.now(), relativeSeconds: 3600 }; await vue.nextTick()
    state.selectDates([props.range.from, props.range.to]); assert.deepEqual(events.at(-1)[1], { from: props.range.from, to: props.range.to }, 'explicit dates pin a range even when equal to the latest preset window')
  } finally { scope.stop() }
})

test('history controls stay compact and charts reveal the native zoom toolbox only on pointer or keyboard entry', () => {
  const range = readFileSync(resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/history/HistoryRangeControl.vue'), 'utf8')
  const charts = readFileSync(resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/history/HistoryMetricCharts.vue'), 'utf8')
  assert.match(range, /class="history-range-trigger" type="text"/)
  assert.match(charts, /@mouseenter="activeToolboxChart = chart.key"/)
  assert.match(charts, /@focusin="activeToolboxChart = chart.key"/)
  assert.match(charts, /toolbox: \{ show: activeToolboxChart\.value === chart\.key/)
  assert.match(charts, /connectNulls: false/)
})

test('ECharts defaults to canvas and optional renderer replacement preserves the current option', async t => {
  const mounted = [], unmounted = [], instances = [], ready = [], released = [], observer = { observe() {}, disconnect() {} }
  const previousWindow = globalThis.window, previousObserver = globalThis.ResizeObserver
  globalThis.window = { addEventListener() {}, removeEventListener() {} }; globalThis.ResizeObserver = class { constructor() { return observer } }
  t.after(() => { globalThis.window = previousWindow; globalThis.ResizeObserver = previousObserver })
  const filename = resolve(import.meta.dirname, '../src/hooks/Echarts/useEcharts.ts'), module = { exports: {} }
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  const chart = { use() {}, init(element, theme, options) {
    const instance = { options, option: undefined, setOption(option) { this.option = option }, getOption() { return this.option }, dispose() { this.disposed = true }, resize() {} }
    instances.push(instance); return instance
  } }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return { ...vue, onMounted: callback => mounted.push(callback), onUnmounted: callback => unmounted.push(callback) }
    if (id === './library') return { __esModule: true, default: chart }
    if (id === './measuredLayout') return { createMeasuredEchartsLayout: () => ({ prepare() {}, apply() {}, setEnabled() {}, dispose() {} }) }
    return require(id)
  }, module, module.exports)
  const props = vue.reactive({ option: { dataZoom: [{ start: 20, end: 80 }], legend: { selected: { hidden: false } } } }), scope = vue.effectScope()
  scope.run(() => module.exports.useEcharts(vue.ref({ clientWidth: 600, clientHeight: 240, getBoundingClientRect: () => ({ width: 1200, height: 480 }) }), props, { onReady: instance => ready.push(instance), onDispose: instance => released.push(instance) }))
  try {
    mounted.forEach(callback => callback()); assert.equal(instances[0].options.renderer, 'canvas'); assert.equal(instances[0].options.width, 600); assert.equal(instances[0].options.height, 240)
    assert.equal(ready[0], instances[0]); assert.ok(ready[0].option, 'ready follows the initial option')
    props.renderer = 'svg'; await vue.nextTick()
    assert.equal(instances[0].disposed, true); assert.equal(instances[1].options.renderer, 'svg')
    assert.deepEqual(instances[1].option.dataZoom, [{ start: 20, end: 80 }])
    assert.deepEqual(instances[1].option.legend.selected, { hidden: false })
    assert.equal(ready[1], instances[1]); assert.equal(released[0], instances[0])
    props.option = { dataZoom: [{ start: 0, end: 100 }] }; await vue.nextTick()
    assert.deepEqual(instances[1].option.dataZoom, [{ start: 0, end: 100 }])
    assert.equal(ready.length, 2, 'ordinary option updates do not re-register the same instance')
  } finally { unmounted.forEach(callback => callback()); scope.stop() }
  assert.equal(instances[1].disposed, true)
  assert.equal(released[1], instances[1])
})


test('hidden charts defer initialization, skip zero-size resize and restore immediately without recreating interactions', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const mounted = [], unmounted = [], activated = [], deactivated = [], instances = [], ready = []
  let observe
  const previousWindow = globalThis.window, previousObserver = globalThis.ResizeObserver
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.ResizeObserver = class { constructor(callback) { observe = callback } observe() {} disconnect() {} }
  t.after(() => { globalThis.window = previousWindow; globalThis.ResizeObserver = previousObserver })
  const filename = resolve(import.meta.dirname, '../src/hooks/Echarts/useEcharts.ts'), module = { exports: {} }
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  const chart = { use() {}, init(element, theme, options) {
    const instance = { options, resizes: [], option: undefined, setOption(option) { this.option = option }, getOption() { return this.option }, dispose() { this.disposed = true }, resize(option) { this.resizes.push(option) } }
    instances.push(instance); return instance
  } }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return { ...vue, onMounted: callback => mounted.push(callback), onUnmounted: callback => unmounted.push(callback), onActivated: callback => activated.push(callback), onDeactivated: callback => deactivated.push(callback) }
    if (id === './library') return { __esModule: true, default: chart }
    if (id === './measuredLayout') return { createMeasuredEchartsLayout: () => ({ prepare() {}, apply() {}, setEnabled() {}, dispose() {} }) }
    return require(id)
  }, module, module.exports)
  const element = { clientWidth: 0, clientHeight: 0, getBoundingClientRect: () => ({ width: 1600, height: 600 }) }
  const scope = vue.effectScope(), props = vue.reactive({ option: { dataZoom: [{ start: 25, end: 70 }] } })
  const hook = scope.run(() => module.exports.useEcharts(vue.shallowRef(element), props, { onReady: instance => ready.push(instance) }))
  try {
    mounted.forEach(callback => callback()); assert.equal(instances.length, 0, 'display:none must not create a default-size chart')
    assert.equal(ready.length, 0)
    element.clientWidth = 800; element.clientHeight = 300; observe()
    assert.equal(instances.length, 1); assert.equal(instances[0].options.width, 800, 'visual transform dimensions never size the canvas')
    assert.equal(ready[0], instances[0]); assert.ok(ready[0].option)
    const chart = instances[0]
    element.clientWidth = 0; element.clientHeight = 0; observe(); t.mock.timers.tick(1000)
    assert.equal(chart.resizes.length, 0, 'hidden charts keep their last valid geometry')
    element.clientWidth = 700; element.clientHeight = 280; observe()
    assert.deepEqual(chart.resizes.at(-1), { width: 700, height: 280, animation: { duration: 0 } }, 'restoration resizes synchronously, before the old debounce')
    assert.deepEqual(chart.option.dataZoom, [{ start: 25, end: 70 }]); assert.equal(instances.length, 1)
    const count = chart.resizes.length
    element.clientWidth = 680; observe(); deactivated.forEach(callback => callback()); t.mock.timers.tick(1000)
    assert.equal(chart.resizes.length, count, 'deactivation cancels a pending normal resize')
    assert.equal(hook.setOption({ dataZoom: [{ start: 40, end: 60 }] }), false)
    assert.deepEqual(chart.option.dataZoom, [{ start: 25, end: 70 }], 'inactive option updates are deferred')
    await Promise.all(activated.map(callback => callback()))
    assert.equal(chart.resizes.at(-1).width, 680); assert.deepEqual(chart.option.dataZoom, [{ start: 40, end: 60 }])
    assert.equal(instances.length, 1); assert.equal(chart.disposed, undefined)
    assert.equal(ready.length, 1, 'restoring a retained instance does not duplicate ready registration')
  } finally { unmounted.forEach(callback => callback()); scope.stop() }
})
