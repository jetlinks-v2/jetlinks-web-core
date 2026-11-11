import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import * as echarts from 'echarts'

const require = createRequire(import.meta.url)
const filename = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/history/useLinkedHistoryCharts.ts')
const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })

function workspace(t, initialRange = { from: 1000, to: 5000 }) {
  const activated = [], deactivated = [], changes = [], module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => id === 'vue' ? {
    ...vue, onActivated: callback => activated.push(callback), onDeactivated: callback => deactivated.push(callback),
  } : require(id), module, module.exports)
  const charts = vue.ref([]), range = vue.ref(initialRange), scope = vue.effectScope()
  const linked = scope.run(() => module.exports.useLinkedHistoryCharts(charts, range, value => changes.push(value)))
  t.after(() => scope.stop())
  return { ...linked, changes, charts, range, scope, activate: () => activated.forEach(callback => callback()), deactivate: () => deactivated.forEach(callback => callback()) }
}

function chart(t, width = 600, times = [1000, 2000, 3000, 4000, 5000]) {
  const instance = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width, height: 200 })
  instance.setOption({
    animation: false,
    grid: { left: 40, right: 10, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis', renderMode: 'richText' },
    legend: { data: ['JVM', 'System'] },
    xAxis: { type: 'time', min: 1000, max: 5000, axisPointer: { snap: false } },
    yAxis: { type: 'value', min: 0 },
    dataZoom: [{ id: 'window', type: 'inside', filterMode: 'none' }],
    series: ['JVM', 'System'].map((name, index) => ({ name, type: 'line', data: times.map((time, at) => [time, at + index + 1]) })),
  })
  t.after(() => instance.dispose())
  return instance
}

function hover(instance, timestamp) {
  instance.dispatchAction({ type: 'updateAxisPointer', x: instance.convertToPixel({ xAxisIndex: 0 }, timestamp), y: 100 })
}

test('late-ready charts align the actual timestamp across different widths and sample densities, then clear on leave', async t => {
  const linked = workspace(t)
  await vue.nextTick() // No instance exists on the original post-render tick.
  const cpu = chart(t), memory = chart(t, 340, [1000, 2800, 5000])
  linked.register('cpu', cpu)
  await vue.nextTick()
  linked.register('memory', memory)
  hover(cpu, 2500)
  const source = cpu.getOption().xAxis[0].axisPointer, target = memory.getOption().xAxis[0].axisPointer
  assert.equal(target.status, 'show')
  assert.equal(target.value, source.value)
  assert.ok(Math.abs(target.value - 2500) < 1, 'linking must not copy the nearest sample index')
  assert.notEqual(cpu.convertToPixel({ xAxisIndex: 0 }, source.value), memory.convertToPixel({ xAxisIndex: 0 }, target.value))
  cpu.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
  assert.equal(memory.getOption().xAxis[0].axisPointer.status, 'hide')
})

test('zoom aligns all ready and late-ready charts immediately and submits the final range once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const linked = workspace(t), cpu = chart(t), memory = chart(t)
  linked.register('cpu', cpu); linked.register('memory', memory)
  cpu.dispatchAction({ type: 'dataZoom', dataZoomId: 'window', start: 10, end: 90 })
  t.mock.timers.tick(100)
  cpu.dispatchAction({ type: 'dataZoom', dataZoomId: 'window', start: 25, end: 75 })
  assert.equal(memory.getOption().dataZoom[0].startValue, 2000)
  assert.equal(memory.getOption().dataZoom[0].endValue, 4000)
  const network = chart(t)
  linked.register('network', network)
  assert.equal(network.getOption().dataZoom[0].startValue, 2000)
  t.mock.timers.tick(179); assert.equal(linked.changes.length, 0)
  t.mock.timers.tick(1); assert.deepEqual(linked.changes, [{ from: 2000, to: 4000 }])
})

test('linked cursors keep each chart tooltip available in both directions and clear it on leave', t => {
  const linked = workspace(t), cpu = chart(t), memory = chart(t)
  linked.register('cpu', cpu); linked.register('memory', memory)
  const actions = t.mock.method(memory, 'dispatchAction'), sourceActions = t.mock.method(cpu, 'dispatchAction')
  hover(cpu, 2500)
  const mirrored = actions.mock.calls.map(call => call.arguments[0]).find(action => action.type === 'updateAxisPointer')
  assert.equal(mirrored.tooltipOption, undefined, 'the linked chart must display its own summary')
  assert.ok(actions.mock.calls.every(call => call.arguments[0].type !== 'hideTip'))
  assert.equal(memory.getOption().xAxis[0].axisPointer.status, 'show')
  assert.equal(memory.getOption().tooltip[0].showContent, true)
  hover(memory, 3500)
  const direct = actions.mock.calls.at(-1).arguments[0]
  assert.equal(direct.tooltipOption, undefined)
  const reversed = sourceActions.mock.calls.map(call => call.arguments[0])
  assert.equal(reversed.at(-1).type, 'updateAxisPointer')
  assert.equal(reversed.at(-1).tooltipOption, undefined)
  assert.ok(reversed.every(action => action.type !== 'hideTip'))
  assert.ok(Math.abs(cpu.getOption().xAxis[0].axisPointer.value - 3500) < 1)
  memory.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
  assert.equal(sourceActions.mock.calls.at(-1).arguments[0].type, 'hideTip')
  assert.equal(cpu.getOption().xAxis[0].axisPointer.status, 'hide')
})

test('same-name legends, other node workspaces and unregistered near-realtime charts stay independent', t => {
  const linked = workspace(t), other = workspace(t), cpu = chart(t), memory = chart(t), otherCpu = chart(t), buffer = chart(t)
  linked.register('cpu', cpu); linked.register('memory', memory); other.register('cpu', otherCpu)
  cpu.dispatchAction({ type: 'legendToggleSelect', name: 'JVM' })
  assert.equal(cpu.getOption().legend[0].selected.JVM, false)
  assert.notEqual(memory.getOption().legend[0].selected.JVM, false)
  hover(cpu, 2500)
  assert.equal(memory.getOption().xAxis[0].axisPointer.status, 'show')
  assert.notEqual(otherCpu.getOption().xAxis[0].axisPointer.status, 'show')
  assert.notEqual(buffer.getOption().xAxis[0].axisPointer.status, 'show')
  assert.ok(!cpu.group && !memory.group, 'no global ECharts connection may synchronize unrelated action types')
})

test('KeepAlive pauses listeners and pending range changes, then restores the selected window without duplication', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const linked = workspace(t), cpu = chart(t), memory = chart(t)
  linked.register('cpu', cpu); linked.register('memory', memory)
  cpu.dispatchAction({ type: 'dataZoom', dataZoomId: 'window', start: 25, end: 75 })
  linked.deactivate(); t.mock.timers.tick(1000)
  assert.equal(linked.changes.length, 0)
  hover(cpu, 3000)
  assert.notEqual(memory.getOption().xAxis[0].axisPointer.status, 'show')
  linked.activate(); linked.activate(); linked.register('cpu', cpu)
  assert.equal(memory.getOption().dataZoom[0].startValue, 2000)
  assert.equal(memory.getOption().dataZoom[0].endValue, 4000)
  hover(cpu, 3000); assert.equal(memory.getOption().xAxis[0].axisPointer.status, 'show')
  t.mock.timers.tick(180); assert.deepEqual(linked.changes, [{ from: 2000, to: 4000 }])
})

test('renderer replacement releases the old instance and a late dispose cannot unregister its replacement', t => {
  const linked = workspace(t), oldCpu = chart(t), memory = chart(t), newCpu = chart(t)
  linked.register('cpu', oldCpu); linked.register('memory', memory)
  linked.register('cpu', newCpu)
  linked.unregister('cpu', oldCpu)
  hover(oldCpu, 2000)
  assert.notEqual(memory.getOption().xAxis[0].axisPointer.status, 'show')
  hover(newCpu, 3000)
  assert.equal(memory.getOption().xAxis[0].axisPointer.value, 3000)
  linked.scope.stop()
  memory.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' })
  hover(newCpu, 4000)
  assert.equal(memory.getOption().xAxis[0].axisPointer.status, 'hide')
})

test('refreshing the same range preserves zoom; selecting a different range clears stale pending changes', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const linked = workspace(t), cpu = chart(t), memory = chart(t)
  linked.register('cpu', cpu); linked.register('memory', memory)
  cpu.dispatchAction({ type: 'dataZoom', dataZoomId: 'window', start: 25, end: 75 })
  linked.range.value = { from: 1000, to: 5000 }
  linked.charts.value = [{ key: 'cpu', label: 'CPU', series: [{ key: 'cpu', label: 'CPU', samples: [{ timestamp: 3000, value: 10 }] }] }]
  await vue.nextTick()
  assert.equal(memory.getOption().dataZoom[0].startValue, 2000)
  linked.range.value = { from: 1000, to: 9000 }
  for (const instance of [cpu, memory]) instance.setOption({ xAxis: { min: 1000, max: 9000 } })
  await vue.nextTick(); t.mock.timers.tick(1000)
  for (const instance of [cpu, memory]) {
    assert.equal(instance.getOption().dataZoom[0].start, 0)
    assert.equal(instance.getOption().dataZoom[0].end, 100)
  }
  assert.equal(linked.changes.length, 0)
})
