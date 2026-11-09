import { composeStreamOption } from './echartsStreamFixture.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)

test('streaming options coalesce per frame without layout reads, and deferred work respects lifecycle', async t => {
  const mounted = [], unmounted = [], activated = [], deactivated = [], frames = new Map(), instances = []
  let frameId = 0, reads = 0, observe, width = 600
  const previousWindow = globalThis.window, previousObserver = globalThis.ResizeObserver
  globalThis.window = {
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId },
    cancelAnimationFrame(id) { frames.delete(id) },
  }
  globalThis.ResizeObserver = class { constructor(callback) { observe = callback } observe() {} disconnect() {} }
  t.after(() => { globalThis.window = previousWindow; globalThis.ResizeObserver = previousObserver })
  const chart = { use() {}, init() {
    const instance = { writes: [], resizes: [], option: {},
      setOption(option) { this.writes.push(option); this.option = { ...this.option, ...option } },
      getOption() { return this.option }, getDataURL() { return JSON.stringify(this.option) }, resize(size) { this.resizes.push(size) }, dispose() { this.disposed = true },
    }
    instances.push(instance); return instance
  } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(new URL('../src/hooks/Echarts/useEcharts.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return { ...vue, onMounted: cb => mounted.push(cb), onUnmounted: cb => unmounted.push(cb), onActivated: cb => activated.push(cb), onDeactivated: cb => deactivated.push(cb) }
    if (id === './streamOption') return { composeStreamOption }
    if (id === './library') return { __esModule: true, default: chart }
    if (id === './measuredLayout') return { createMeasuredEchartsLayout: () => ({ prepare() {}, apply() {}, dispose() {}, setEnabled() {} }) }
    return require(id)
  }, module, module.exports)
  const scope = vue.effectScope(), props = vue.reactive({ option: { series: [{ data: [0] }] } })
  const element = { get clientWidth() { reads++; return width }, get clientHeight() { reads++; return width ? 240 : 0 } }
  const hook = scope.run(() => module.exports.useEcharts(vue.shallowRef(element), props))
  const paint = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(cb => cb()) }
  try {
    assert.equal(hook.setOption(props.option), true, 'explicit pre-mount calls preserve their synchronous contract')
    mounted.forEach(cb => cb()); const instance = instances[0], initialWrites = instance.writes.length, initialReads = reads
    for (let i = 1; i <= 3; i++) { props.option = { series: [{ data: [i] }] }; await vue.nextTick() }
    assert.equal(frames.size, 1); assert.equal(instance.writes.length, initialWrites)
    paint(); assert.equal(instance.writes.length, initialWrites + 1); assert.deepEqual(instance.option.series[0].data, [3])
    assert.equal(reads, initialReads, 'streaming updates never read client geometry')
    props.option = { series: [{ data: [30] }] }; await vue.nextTick()
    assert.deepEqual(JSON.parse(hook.getDataURL()).series[0].data, [30]); assert.equal(frames.size, 0, 'export flushes the latest frame')
    props.option = { series: [{ data: [4] }] }; await vue.nextTick()
    hook.setOption({ legend: { selected: { a: false } }, dataZoom: [{ start: 25, end: 75 }] })
    assert.equal(frames.size, 0, 'explicit writes cancel superseded scheduled options')
    observe(); assert.equal(instance.resizes.length, 0, 'unchanged observer geometry does not resize')
    width = 0; observe(); props.option = { series: [{ data: [5] }] }; await vue.nextTick(); assert.equal(frames.size, 0)
    width = 700; observe(); assert.equal(instance.resizes.at(-1).width, 700); assert.deepEqual(instance.option.series[0].data, [5])
    assert.deepEqual(instance.option.dataZoom, [{ start: 25, end: 75 }]); assert.deepEqual(instance.option.legend.selected, { a: false })
    props.option = { series: [{ data: [6] }] }; await vue.nextTick(); deactivated.forEach(cb => cb()); assert.equal(frames.size, 0)
    await Promise.all(activated.map(cb => cb())); assert.deepEqual(instance.option.series[0].data, [6]); assert.equal(instances.length, 1)
    props.option = { series: [{ data: [7] }] }; await vue.nextTick(); unmounted.forEach(cb => cb()); assert.equal(frames.size, 0); assert.equal(instance.disposed, true)
  } finally { unmounted.forEach(cb => cb()); scope.stop() }
})
