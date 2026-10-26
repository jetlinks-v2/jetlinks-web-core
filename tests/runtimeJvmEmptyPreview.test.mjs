import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url), file = resolve(import.meta.dirname, 'RuntimeJvmEmptyPreview.vue')

function fixture() {
  const { descriptor } = parse(readFileSync(file, 'utf8'), { filename: file })
  const code = compileScript(descriptor, { id: 'jvm-empty-preview' }).content, module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(code, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vue
    if (id.endsWith('RuntimeDiagnostics')) return { JvmDiagnosticPanel: {}, ThreadViewer: {} }
    return require(id)
  }, module, module.exports)
  return module.exports.default
}

function sampleCount(snapshot) { return snapshot?.flameGraph.reduce((sum, frame) => sum + frame.samples, 0) ?? 0 }

test('JVM empty preview preserves received frames and does not synthesize them during stop/restart transitions', () => {
  const priorWindow = globalThis.window; let tick
  globalThis.window = { setInterval: callback => { tick = callback; return 1 }, clearInterval() {} }
  const scope = vue.effectScope(), view = scope.run(() => fixture().setup({}, { expose() {} }))
  try {
    view.selectScenario('stopped')
    assert.equal(sampleCount(view.snapshot.value), 8, 'manual stopped preview intentionally demonstrates retained data')
    const stoppedElapsed = view.elapsed.value, stoppedAt = view.samplingState.value.sampledAt
    tick()
    assert.equal(view.elapsed.value, stoppedElapsed, 'stopped previews do not keep advancing elapsed time')
    assert.equal(view.samplingState.value.sampledAt, stoppedAt, 'stopped previews retain the actual final frame time')

    view.start(); assert.equal(view.elapsed.value, 0, 'a new run resets elapsed time'); tick(); assert.equal(view.elapsed.value, 1)
    view.stop()
    assert.equal(view.scenario.value, 'stopped')
    assert.equal(view.snapshot.value, undefined, 'stopping before a frame keeps the production empty state')

    view.start(); view.receiveFrame(); const received = view.snapshot.value
    assert.equal(view.scenario.value, 'receiving'); assert.equal(sampleCount(received), 8)
    view.stop()
    assert.equal(view.snapshot.value, received, 'stopping retains the frame that was actually received')

    view.start()
    assert.equal(view.snapshot.value, undefined, 'a new sampling run clears prior evidence before a new frame')
    view.receiveFrame()
    assert.equal(view.scenario.value, 'receiving'); assert.equal(sampleCount(view.snapshot.value), 8)

    view.selectScenario('permission-denied'); view.selectScenario('idle')
    assert.equal(view.snapshot.value, undefined)
    view.activeTab.value = 'threads'; view.selectScenario('idle'); assert.equal(view.activeTab.value, 'performance', 'scenario selection returns the fixture to the diagnostic tab')
    view.start(); view.receiveFrame()
    assert.equal(view.scenario.value, 'receiving'); assert.equal(sampleCount(view.snapshot.value), 8)
  } finally {
    scope.stop()
    if (priorWindow === undefined) delete globalThis.window
    else globalThis.window = priorWindow
  }
})
