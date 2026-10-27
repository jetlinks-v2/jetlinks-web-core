import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const flush = async () => { await vue.nextTick(); await vue.nextTick() }
function harness(t) {
  const hooks = { activated: [], deactivated: [], beforeUpdate: [] }, frames = new Map(), observers = []
  let sequence = 0
  const previous = { requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame, ResizeObserver: globalThis.ResizeObserver }
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  globalThis.ResizeObserver = class { constructor(callback) { this.callback = callback; observers.push(this) } observe() {} disconnect() { this.disconnected = true } }
  t.after(() => Object.assign(globalThis, previous))
  const module = { exports: {} }, { code } = transformSync(readFileSync(new URL('../src/hooks/useRetainedScroll.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(() => ({ ...vue, onActivated: callback => hooks.activated.push(callback), onDeactivated: callback => hooks.deactivated.push(callback), onBeforeUpdate: callback => hooks.beforeUpdate.push(callback) }), module, module.exports)
  const active = vue.ref(true), element = vue.shallowRef(), scope = vue.effectScope()
  const view = scope.run(() => module.exports.useRetainedScroll(element, active))
  element.value = { isConnected: true, clientWidth: 248, clientHeight: 300, scrollTop: 0, scrollLeft: 0 }
  return { scope, active, element, view, frames, observers,
    lifecycle: name => hooks[name].forEach(callback => callback()),
    frame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) },
  }
}

test('retained scroll keeps independent axes through hidden zeroes, stale frames and delayed visible layout', async t => {
  const h = harness(t)
  try {
    h.element.value.scrollTop = 70; h.element.value.scrollLeft = 90; assert.equal(h.view.onScroll(), true)
    h.active.value = false
    h.element.value.clientWidth = 0; h.element.value.scrollTop = 0; h.element.value.scrollLeft = 0
    assert.equal(h.view.onScroll(), false); h.lifecycle('beforeUpdate')
    h.active.value = true; await flush(); h.frame()
    assert.equal(h.element.value.scrollTop, 0, 'a hidden layout is never force-scrolled')
    h.lifecycle('beforeUpdate'); h.view.onScroll()
    h.element.value.clientWidth = 248
    h.observers.at(-1)?.callback()
    assert.equal(h.frames.size, 1, 'the explicit container observer resumes a restoration that waited for layout')
    h.frame()
    assert.equal(h.element.value.scrollTop, 70); assert.equal(h.element.value.scrollLeft, 90)
    h.active.value = false; h.active.value = true; await flush(); assert.equal(h.frames.size, 1)
    h.active.value = false; assert.equal(h.frames.size, 0)
    h.scope.stop(); assert.equal(h.frames.size, 0)
  } finally { h.scope.stop() }
})

test('reset while hidden or waiting for a frame cannot resurrect previous object positions', async t => {
  const h = harness(t)
  try {
    h.element.value.scrollTop = 180; h.element.value.scrollLeft = 120; h.view.onScroll()
    h.active.value = false; h.view.reset(); h.lifecycle('beforeUpdate')
    h.element.value.scrollTop = 0; h.element.value.scrollLeft = 0; h.active.value = true
    await flush(); h.view.onScroll(); h.frame()
    assert.equal(h.element.value.scrollTop, 0); assert.equal(h.element.value.scrollLeft, 0)
    h.element.value.scrollTop = 240; h.view.onScroll()
    h.view.restore(); await flush(); h.view.reset(); await flush(); h.frame()
    assert.equal(h.element.value.scrollTop, 0, 'old object restoration was cancelled before the reset')
    h.scope.stop(); assert.ok(h.observers.every(observer => observer.disconnected))
  } finally { h.scope.stop() }
})
