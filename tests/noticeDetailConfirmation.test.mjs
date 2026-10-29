import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { parse, compileScript } from 'vue/compiler-sfc'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const source = readFileSync(new URL('../src/views/account/center/components/StationMessage/components/NotificationRecord/components/ViewDialog.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const code = transformSync(compileScript(descriptor, { id: 'notice-confirmation' }).content, { loader: 'ts', format: 'cjs' }).code
const module = { exports: {} }
new Function('require', 'module', 'exports', 'ref', 'computed', 'onMounted', code)(
  name => name === 'vue' ? vue : {}, module, module.exports, vue.ref, vue.computed, () => {},
)
const setup = (confirm) => {
  const events = []
  const scope = vue.effectScope()
  const state = scope.run(() => module.exports.default.setup({ data: {}, type: 'business', visible: true, confirm }, {
    expose() {}, emit: (...event) => events.push(event),
  }))
  return { state, events, scope }
}

test('the existing confirmation button waits for its source before closing and ignores duplicate clicks', async () => {
  let calls = 0, complete
  const { state, events } = setup(() => { calls++; return new Promise(resolve => complete = resolve) })
  const pending = state.confirmDetail()
  assert.equal(state.confirming.value, true)
  assert.deepEqual(events, [])
  await state.confirmDetail()
  assert.equal(calls, 1)
  complete()
  await pending
  assert.equal(state.confirming.value, false)
  assert.deepEqual(events, [['update:visible', false]])
})

test('a failed confirmation keeps the detail open for retry', async () => {
  const { state, events } = setup(async () => { throw new Error('confirmation failed') })
  await assert.rejects(state.confirmDetail(), /confirmation failed/)
  assert.equal(state.confirming.value, false)
  assert.deepEqual(events, [])
})

test('ordinary notification details keep the existing close-only button behavior', async () => {
  const { state, events } = setup()
  await state.confirmDetail()
  assert.deepEqual(events, [['update:visible', false]])
})


test('a confirmation completing after the detail was dismissed cannot close a newly opened detail', async () => {
  let complete
  const {state, events, scope} = setup(() => new Promise(resolve => complete = resolve))
  const pending = state.confirmDetail()
  scope.stop()
  complete()
  await pending
  assert.deepEqual(events, [])
})
