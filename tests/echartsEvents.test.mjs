import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)

test('optional ECharts events replace listeners once and release them on renderer replacement, render failure and disposal', async t => {
  const mounted = [], unmounted = [], instances = []
  const previousWindow = globalThis.window, previousObserver = globalThis.ResizeObserver
  globalThis.window = { addEventListener() {}, removeEventListener() {} }
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }
  t.after(() => { globalThis.window = previousWindow; globalThis.ResizeObserver = previousObserver })
  const chart = { use() {}, init() {
    const listeners = new Map()
    const instance = {
      listeners, option: undefined,
      on(event, handler) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(handler) },
      off(event, handler) { listeners.get(event)?.delete(handler) },
      fire(event, value) { for (const handler of listeners.get(event) ?? []) handler(value) },
      setOption(option) { if (option.invalid) throw new Error('render failed'); this.option = option },
      getOption() { return this.option }, resize() {}, dispose() { this.disposed = true },
    }
    instances.push(instance); return instance
  } }
  const filename = new URL('../src/hooks/Echarts/useEcharts.ts', import.meta.url), module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return { ...vue, onMounted: callback => mounted.push(callback), onUnmounted: callback => unmounted.push(callback), onActivated() {}, onDeactivated() {} }
    if (id === './library') return { __esModule: true, default: chart }
    if (id === './measuredLayout') return { createMeasuredEchartsLayout: () => ({ prepare() {}, apply() {}, setEnabled() {}, dispose() {} }) }
    return require(id)
  }, module, module.exports)
  const calls = [], errors = [], scope = vue.effectScope()
  const first = value => calls.push(['first', value]), second = value => calls.push(['second', value])
  const props = vue.reactive({ option: {}, events: { legendselectchanged: first } })
  const hook = scope.run(() => module.exports.useEcharts(vue.ref({ clientWidth: 600, clientHeight: 240 }), props, { onError: (...error) => errors.push(error) }))
  try {
    mounted.forEach(callback => callback())
    instances[0].fire('legendselectchanged', 1)
    props.events = { legendselectchanged: second, legendselectall: second }; await vue.nextTick()
    instances[0].fire('legendselectchanged', 2)
    assert.deepEqual(calls, [['first', 1], ['second', 2]])
    props.renderer = 'svg'; await vue.nextTick()
    assert.equal(instances[0].listeners.get('legendselectchanged').size, 0); assert.equal(instances[0].disposed, true)
    instances[0].fire('legendselectchanged', 'stale'); instances[1].fire('legendselectchanged', 3)
    assert.deepEqual(calls.at(-1), ['second', 3]); assert.equal(calls.length, 3)
    assert.equal(hook.setOption({ invalid: true }), false)
    assert.equal(instances[1].listeners.get('legendselectchanged').size, 0); assert.equal(instances[1].listeners.get('legendselectall').size, 0)
    assert.equal(errors[0][1], 'setOption')
    hook.setOption({}); instances[2].fire('legendselectall', 4)
    assert.deepEqual(calls.at(-1), ['second', 4])
    props.events = undefined; await vue.nextTick()
    instances[2].fire('legendselectall', 'removed'); assert.equal(calls.length, 4)
    props.events = { legendselectchanged: first }; await vue.nextTick()
  } finally { unmounted.forEach(callback => callback()); scope.stop() }
  assert.equal(instances[2].listeners.get('legendselectchanged').size, 0); assert.equal(instances[2].disposed, true)
})
