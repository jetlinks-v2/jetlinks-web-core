import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')

function setup(t) {
  const calls = [], timers = new Map()
  let sequence = 0
  const oldSet = globalThis.setTimeout, oldClear = globalThis.clearTimeout
  globalThis.setTimeout = (callback) => { const id = ++sequence; timers.set(id, callback); return id }
  globalThis.clearTimeout = id => timers.delete(id)
  t.after(() => { globalThis.setTimeout = oldSet; globalThis.clearTimeout = oldClear })
  const source = readFileSync(new URL('../src/components/Upload/utils.ts', import.meta.url), 'utf8')
  const module = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(id => {
    if (id === '@jetlinks-web/core') return { request: { post(url, data, config) {
      let resolve, reject
      const promise = new Promise((yes, no) => { resolve = yes; reject = no })
      calls.push({ url, data, config, resolve, reject }); return promise
    } } }
    if (id.endsWith('/api/comm')) return { FileStatic: '/file/upload' }
    if (id.endsWith('/locales')) return { __esModule: true, default: { global: { t: key => key } } }
    throw new Error(`Unexpected dependency ${id}`)
  }, module, module.exports)
  return { ...module.exports, calls, timers }
}

const options = () => ({ file: new Blob(['jar']), filename: 'file', onProgress() {}, onSuccess() {}, onError() {} })
const flush = () => Promise.resolve().then(() => Promise.resolve())

test('real byte advances renew the idle deadline; equal counters do not', async t => {
  const { createUploadCustomRequest, calls, timers } = setup(t)
  const progress = [], errors = []
  createUploadCustomRequest({ idleTimeout: 1000 })({ ...options(), onProgress: value => progress.push(value), onError: error => errors.push(error) })
  const first = [...timers.keys()][0]
  calls[0].config.onUploadProgress({ loaded: 10, total: 100 })
  const next = [...timers.keys()][0]
  assert.notEqual(next, first)
  calls[0].config.onUploadProgress({ loaded: 10, total: 100 })
  assert.equal([...timers.keys()][0], next)
  assert.equal(progress[0].percent, 10)
  assert.equal(calls[0].config.timeout, 0)
  timers.get(next)()
  assert.equal(calls[0].config.signal.aborted, true)
  assert.equal(errors[0].code, 'UPLOAD_IDLE')
  calls[0].resolve({ success: true }); await flush()
})

test('abort cancels the request and ignores late success and failure', async t => {
  const { createUploadCustomRequest, calls, timers } = setup(t)
  let successes = 0, errors = 0
  const handle = createUploadCustomRequest({ idleTimeout: 1000 })({ ...options(), onSuccess: () => successes++, onError: () => errors++ })
  handle.abort(); assert.equal(calls[0].config.signal.aborted, true); assert.equal(timers.size, 0)
  calls[0].resolve({ success: true }); await flush()
  assert.equal(successes, 0); assert.equal(errors, 0)
})

test('ordinary uploads preserve the platform URL and default total-timeout policy', async t => {
  const { createUploadCustomRequest, calls, timers } = setup(t)
  let response
  createUploadCustomRequest()({ ...options(), onSuccess: value => response = value })
  assert.equal(calls[0].url, '/file/upload'); assert.equal('timeout' in calls[0].config, false); assert.equal(timers.size, 0)
  calls[0].resolve({ result: { id: 'file' } }); await flush()
  assert.equal(response.result.id, 'file')
})

test('public file access is opt-in and the flag matches its request option', async t => {
  const { createFileUploadCustomRequest, calls } = setup(t)
  for (const publicAccess of [undefined, false, true]) {
    createFileUploadCustomRequest(publicAccess)(options())
    const call = calls.at(-1)
    assert.equal(call.url, publicAccess ? '/file/upload?options=publicAccess' : '/file/upload')
    call.resolve({ result: { id: 'file' } }); await flush()
  }
})
