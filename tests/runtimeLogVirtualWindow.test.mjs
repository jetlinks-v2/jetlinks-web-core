import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const entries = (count, prefix = 'row') => Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, text: `line ${index}` }))
const tick = async () => { await vue.nextTick(); await vue.nextTick() }

function harness(t, data = entries(2500)) {
  const frames = new Map(), observers = [], lifecycle = { activated: [], deactivated: [] }
  let sequence = 0
  const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, ResizeObserver: globalThis.ResizeObserver }
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  globalThis.ResizeObserver = class {
    observed = new Set()
    observations = 0
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe(element) { this.observed.add(element); this.observations++ }
    unobserve(element) { this.observed.delete(element) }
    disconnect() { this.observed.clear() }
  }
  t.after(() => Object.assign(globalThis, previous))
  const module = { exports: {} }, { code } = transformSync(readFileSync(new URL('../src/components/RuntimeDiagnostics/logs/useLogVirtualWindow.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(() => ({ ...vue, onActivated: callback => lifecycle.activated.push(callback), onDeactivated: callback => lifecycle.deactivated.push(callback) }), module, module.exports)
  const element = vue.shallowRef({ isConnected: true, clientWidth: 600, clientHeight: 400, scrollTop: 0, scrollHeight: data.length * 34, scrollLeft: 0 })
  const loaded = vue.ref(data), active = vue.ref(true), wrap = vue.ref(true), scope = vue.effectScope()
  const view = scope.run(() => module.exports.useLogVirtualWindow(element, loaded, active, wrap))
  const box = (target, height, width = 600) => ({ target, contentRect: { height, width }, borderBoxSize: [{ blockSize: height }] })
  const measure = changes => observers[0].callback(changes)
  const rows = new Map()
  function row(id) { if (!rows.has(id)) rows.set(id, { dataset: { logId: id } }); return rows.get(id) }
  async function settle() {
    await tick()
    for (let index = 0; index < 3 && frames.size; index++) {
      const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); await tick()
    }
  }
  function scroll(top) { view.readIntent(); element.value.scrollTop = top; assert.equal(view.onScroll(), false) }
  return { view, element, loaded, active, wrap, scope, observers, frames, row, box, measure, settle, scroll,
    hooks: name => lifecycle[name].forEach(callback => callback()),
    measureRows: sizes => {
      const changes = []
      for (const [id, size] of sizes) { view.setRow(id, row(id)); changes.push(box(row(id), size)) }
      measure(changes)
    },
    api: module.exports,
  }
}

test('2500 records mount a bounded window even before layout; first and last remain reachable', async t => {
  const h = harness(t)
  try {
    assert.ok(h.view.items.value.length < 30)
    h.measure([h.box(h.element.value, 400)]); await h.settle()
    assert.equal(h.view.items.value[0].entry.id, 'row-0')
    assert.ok(h.view.items.value.length < 30)
    h.view.bottom(); await h.settle()
    assert.equal(h.view.items.value.at(-1).entry.id, 'row-2499')
    assert.equal(h.element.value.scrollTop, 84600)
    h.element.value.scrollTop -= 120
    assert.equal(h.view.onScroll(), true, 'programmatic bottom is identifiable without user intent')
    h.element.value.scrollHeight += 300
    h.measureRows([['row-2499', 334]]); await h.settle()
    assert.equal(h.element.value.scrollTop, 84900, 'browser clamping during DOM updates cannot cancel the follow target')
    h.scroll(0)
    assert.equal(h.view.items.value[0].entry.id, 'row-0')
    const offsets = h.api.logRowOffsets([], new Map())
    assert.deepEqual(h.api.logWindowRange(offsets, 500, 0), { start: 0, end: 0, before: 0, after: 0 })
  } finally { h.scope.stop() }
})

test('measured mixed heights preserve the visible record through prepend, append and bounded-window eviction', async t => {
  const h = harness(t, entries(100))
  try {
    h.measure([h.box(h.element.value, 400)])
    h.measureRows([['row-0', 80], ['row-1', 120]])
    await h.settle(); h.scroll(220) // row-2 +20
    h.loaded.value = [...entries(2, 'older'), ...h.loaded.value]
    await h.settle(); assert.equal(h.element.value.scrollTop, 288)
    h.measureRows([['older-0', 90], ['older-1', 70]])
    await h.settle(); assert.equal(h.element.value.scrollTop, 380, 'new real heights retain row-2 +20')
    h.loaded.value = [...h.loaded.value, ...entries(5, 'newer')]
    await h.settle(); assert.equal(h.element.value.scrollTop, 380)
    h.loaded.value = h.loaded.value.slice(3)
    await h.settle(); assert.equal(h.element.value.scrollTop, 140, 'evicting earlier records retains row-2 +20')
    h.loaded.value = h.loaded.value.filter(entry => entry.id !== 'row-2')
    await h.settle(); assert.equal(h.element.value.scrollTop, 120, 'an evicted anchor falls forward to a surviving neighbor')
  } finally { h.scope.stop() }
})

test('search reaches an unmounted row and stays there as earlier visible estimates become real heights', async t => {
  const h = harness(t)
  try {
    h.measure([h.box(h.element.value, 400)]); await h.settle()
    assert.ok(!h.view.items.value.some(item => item.entry.id === 'row-2200'))
    h.view.scrollTo('row-2200'); await h.settle()
    assert.ok(h.view.items.value.some(item => item.entry.id === 'row-2200'))
    h.measureRows([['row-2198', 300], ['row-2199', 90], ['row-2200', 800]])
    await h.settle()
    assert.equal(h.element.value.scrollTop, 2200 * 34 + 300 - 34 + 90 - 34)
    h.scroll(h.element.value.scrollTop + 210)
    h.view.invalidate(['row-2200']); h.measureRows([['row-2200', 1000]])
    await h.settle()
    assert.equal(h.element.value.scrollTop, 2200 * 34 + 300 - 34 + 90 - 34 + 210, 'reading inside a tall expanded row retains its within-row offset')
  } finally { h.scope.stop() }
})

test('wrap and width changes reobserve mounted rows, prune stale sizes and retain identity', async t => {
  const h = harness(t, entries(100))
  try {
    h.measure([h.box(h.element.value, 400)])
    h.measureRows([['row-0', 80], ['row-1', 120], ['row-2', 100]])
    await h.settle(); h.scroll(220)
    const observed = h.observers[0].observations
    h.wrap.value = false; await tick()
    assert.ok(h.observers[0].observations > observed, 'unchanged-height mounted rows must also be remeasured')
    h.measureRows([['row-0', 34], ['row-1', 34], ['row-2', 100]])
    await h.settle(); assert.equal(h.element.value.scrollTop, 88)
    h.measure([h.box(h.element.value, 400, 300)])
    h.measureRows([['row-0', 60], ['row-1', 70], ['row-2', 100]])
    await h.settle(); assert.equal(h.element.value.scrollTop, 150)
  } finally { h.scope.stop() }
})

test('hidden incoming records, delayed layout and stale restoration frames preserve a reading anchor', async t => {
  const h = harness(t, entries(100))
  try {
    h.measure([h.box(h.element.value, 400)]); await h.settle(); h.scroll(350)
    h.active.value = false
    h.element.value.clientHeight = 0; h.element.value.scrollTop = 0; h.view.onScroll()
    h.loaded.value = [...entries(3, 'older'), ...h.loaded.value]; await h.settle()
    assert.equal(h.element.value.scrollTop, 0)
    h.active.value = true; await h.settle()
    assert.equal(h.element.value.scrollTop, 0, 'zero-sized layout waits')
    h.element.value.clientHeight = 400; h.measure([h.box(h.element.value, 400)])
    await h.settle(); assert.equal(h.element.value.scrollTop, 452)
    h.hooks('deactivated'); h.element.value.scrollTop = 0
    h.hooks('activated'); await tick(); h.active.value = false
    assert.equal(h.frames.size, 0, 'hiding again cancels a queued restoration')
    h.active.value = true; await h.settle(); assert.equal(h.element.value.scrollTop, 452)
    h.view.reset(); h.loaded.value = entries(20, 'file'); await h.settle()
    assert.equal(h.element.value.scrollTop, 0)
    h.scope.stop(); assert.equal(h.frames.size, 0); assert.equal(h.observers[0].observed.size, 0)
  } finally { h.scope.stop() }
})
