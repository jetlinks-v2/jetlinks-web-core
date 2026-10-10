import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { effectScope, watch } from 'vue'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const source = readFileSync(resolve(root, 'src/hooks/useCaptchaVerify.ts'), 'utf8')
const compiled = { exports: {} }
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
// Execute the real hook with Vue; no verification lifecycle is replaced by a test double.
new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports)
const { useCaptchaVerify } = compiled.exports

const createFixture = () => {
  const scope = effectScope()
  const hook = scope.run(useCaptchaVerify)
  return { scope, hook }
}

test('generic success preserves results and clears context before resolution', async () => {
  for (const result of ['captcha-id', true, { proof: 'one-time-proof', expiresAt: 123 }]) {
    const { scope, hook } = createFixture()
    try {
      const context = { requestId: 'operation' }
      const promise = hook.openCaptcha({ context })
      assert.equal(hook.captchaOpen.value, true)
      assert.equal(hook.context.value, context)
      hook.onCaptchaSuccess(result)
      assert.equal(hook.captchaOpen.value, false)
      assert.equal(hook.context.value, undefined)
      assert.equal(await promise, result)
      hook.onCaptchaSuccess('ignored')
      hook.closeCaptcha()
    } finally { scope.stop() }
  }
})

test('repeated opens reject without overwriting the original caller', async () => {
  const { scope, hook } = createFixture()
  try {
    const first = hook.openCaptcha({ context: 'first' })
    await assert.rejects(hook.openCaptcha({ context: 'second' }), /already pending/)
    assert.equal(hook.context.value, 'first')
    hook.onCaptchaSuccess('first-result')
    assert.equal(await first, 'first-result')
  } finally { scope.stop() }
})

test('closing from v-model rejects the caller and permits a fresh verification', async () => {
  const { scope, hook } = createFixture()
  try {
    const first = hook.openCaptcha()
    const cancelled = assert.rejects(first, /closed/)
    hook.captchaOpen.value = false
    await cancelled
    assert.equal(hook.context.value, undefined)
    const second = hook.openCaptcha()
    hook.onCaptchaSuccess('success')
    hook.captchaOpen.value = false
    assert.equal(await second, 'success')
  } finally { scope.stop() }
})

test('abort settles the caller and an old signal cannot close the next session', async () => {
  const { scope, hook } = createFixture()
  try {
    const firstController = new AbortController()
    const first = hook.openCaptcha({ context: 'first', signal: firstController.signal })
    hook.onCaptchaSuccess('first-result')
    await first
    const secondController = new AbortController()
    const second = hook.openCaptcha({ context: 'second', signal: secondController.signal })
    const cancelled = assert.rejects(second, /closed/)
    firstController.abort()
    assert.equal(hook.context.value, 'second')
    secondController.abort()
    await cancelled
    assert.equal(hook.captchaOpen.value, false)
  } finally { scope.stop() }
})

test('pre-aborted requests do not open a window or mutate an active session', async () => {
  const { scope, hook } = createFixture()
  try {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(hook.openCaptcha({ signal: controller.signal }), /cancelled/)
    assert.equal(hook.captchaOpen.value, false)
    const active = hook.openCaptcha({ context: 'active' })
    await assert.rejects(hook.openCaptcha({ context: 'aborted', signal: controller.signal }), /cancelled/)
    assert.equal(hook.context.value, 'active')
    hook.onCaptchaSuccess('active-result')
    await active
  } finally { scope.stop() }
})

test('scope disposal rejects pending waits and permanently prevents reopening', async () => {
  const { scope, hook } = createFixture()
  const active = hook.openCaptcha({ context: 'active' })
  const cancelled = assert.rejects(active, /closed/)
  scope.stop()
  await cancelled
  hook.onCaptchaSuccess('late')
  await assert.rejects(hook.openCaptcha(), /cancelled/)
  assert.equal(hook.captchaOpen.value, false)
  assert.equal(hook.context.value, undefined)
})

test('every terminal path removes the registered abort listener', async () => {
  for (const terminal of ['success', 'close', 'abort', 'dispose']) {
    const { scope, hook } = createFixture()
    const controller = new AbortController()
    const signal = controller.signal
    const add = signal.addEventListener.bind(signal)
    const remove = signal.removeEventListener.bind(signal)
    let added = 0
    let removed = 0
    signal.addEventListener = (...args) => { added++; add(...args) }
    signal.removeEventListener = (...args) => { removed++; remove(...args) }
    try {
      const pending = hook.openCaptcha({ signal })
      const settled = terminal === 'success' ? pending : assert.rejects(pending, /closed/)
      if (terminal === 'success') hook.onCaptchaSuccess('result')
      else if (terminal === 'close') hook.closeCaptcha()
      else if (terminal === 'abort') controller.abort()
      else scope.stop()
      await settled
      assert.equal(added, 1, terminal)
      assert.equal(removed, 1, terminal)
    } finally { scope.stop() }
  }
})

test('verification instances are independent and preserve custom cancellation errors', async () => {
  const first = createFixture()
  const second = createFixture()
  try {
    const error = new Error('verification expired')
    const cancelled = first.hook.openCaptcha({ context: 'first' })
    const rejected = assert.rejects(cancelled, value => value === error)
    const success = second.hook.openCaptcha({ context: 'second' })
    first.hook.closeCaptcha(error)
    await rejected
    assert.equal(second.hook.context.value, 'second')
    second.hook.onCaptchaSuccess('result')
    assert.equal(await success, 'result')
  } finally { first.scope.stop(); second.scope.stop() }
})

test('synchronous UI watchers cannot let old cleanup erase a newer session', async () => {
  const { scope, hook } = createFixture()
  try {
    const first = hook.openCaptcha({ context: 'first' })
    let second
    const stop = scope.run(() => watch(hook.captchaOpen, open => {
      if (!open && !second) second = hook.openCaptcha({ context: 'second' })
    }, { flush: 'sync' }))
    hook.onCaptchaSuccess('first-result')
    await first
    assert.equal(hook.context.value, 'second')
    stop()
    hook.onCaptchaSuccess('second-result')
    assert.equal(await second, 'second-result')
  } finally { scope.stop() }
})

test('public hook export exists without importing business or provider code', () => {
  const index = readFileSync(resolve(root, 'src/hooks/index.ts'), 'utf8')
  assert.match(index, /export \* from ['"]\.\/useCaptchaVerify['"];/)
  assert.doesNotMatch(source, /@saas-manager-ui|@jetlinks-web-core\/api|Altcha|login\./)
})

test('Core login consumes the public hook and keeps its v-model and success wiring', () => {
  const filename = resolve(root, 'src/views/login/components/Login.vue')
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'core-captcha-test' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'core-captcha-test',
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  assert.match(template.code, /"onUpdate:open"/)
  assert.match(template.code, /onSuccess:.*onCaptchaSuccess/)
  const loginHook = readFileSync(resolve(root, 'src/views/login/hooks/useLogin.ts'), 'utf8')
  assert.match(loginHook, /import \{ useCaptchaVerify \} from '@jetlinks-web-core\/hooks'/)
})

test('result and context types pass strict checks, including rejected incompatible values', () => {
  const program = ts.createProgram([resolve(root, 'tests/captchaVerify.type-test.ts')], {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), [])
})
