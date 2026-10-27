import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const deferred = () => { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve } }
function harness(config) {
  const deactivated = [], module = { exports: {} }
  const { code } = transformSync(readFileSync(new URL('../src/hooks/useDiagnosticQuery.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(() => ({ ...vue, getCurrentInstance: () => ({}), onDeactivated: callback => deactivated.push(callback) }), module, module.exports)
  const scope = vue.effectScope(), query = scope.run(() => module.exports.useDiagnosticQuery(config))
  return { scope, query, deactivate: () => deactivated.forEach(callback => callback()) }
}

test('retained queries cancel pending updates and preserve the last settled evidence without remaining loading', async () => {
  const h = harness({ retainOnDeactivate: true }), pending = deferred()
  try {
    await h.query.run(async () => ['cached'], true)
    const before = h.query.data.value, settled = h.query.state.value
    let signal
    const refresh = h.query.run(value => { signal = value; return pending.promise }, true, { retainData: true })
    assert.equal(h.query.data.value, before); assert.equal(h.query.state.value.status, 'loading')
    h.deactivate(); assert.equal(signal.aborted, true)
    assert.equal(h.query.data.value, before); assert.equal(h.query.state.value, settled)
    pending.resolve(['late']); await refresh
    assert.equal(h.query.data.value, before)
    await h.query.run(async () => { throw new Error('offline') }, true, { retainData: true })
    assert.equal(h.query.data.value, before); assert.equal(h.query.state.value.status, 'error')
  } finally { h.scope.stop() }
  assert.equal(h.query.data.value, undefined)
})

test('default queries still clear on deactivation and retained refusals remove sensitive evidence', async () => {
  const h = harness()
  try {
    await h.query.run(async () => 'cached', true); h.deactivate()
    assert.equal(h.query.data.value, undefined); assert.equal(h.query.state.value.status, 'ready')
    for (const status of ['forbidden', 'unsupported']) {
      await h.query.run(async () => 'sensitive', true)
      await h.query.run(async () => { throw new Error(status) }, true, { retainData: true, errorState: () => ({ status }) })
      assert.equal(h.query.data.value, undefined); assert.equal(h.query.state.value.status, status)
    }
    await h.query.run(async () => 'sensitive', true)
    let called = false
    await h.query.run(async () => { called = true }, false, { retainData: true })
    assert.equal(called, false); assert.equal(h.query.data.value, undefined)
  } finally { h.scope.stop() }
})
