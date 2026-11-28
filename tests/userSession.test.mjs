import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { createPinia, defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { pick } from 'lodash-es'

const source = readFileSync(new URL('../src/store/user.ts', import.meta.url), 'utf8')
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const profile = (id, username, type = 'user') => ({
  success: true, result: { id, username, name: username, type: { id: type } },
})

// Execute the production Pinia store; isolate HTTP completion and browser credential storage.
const fixture = (t) => {
  let token = 'admin-token'
  let reloads = 0
  const listeners = new Set()
  if (t) {
    const previous = globalThis.window
    globalThis.window = {
      addEventListener: (event, callback) => { if (event === 'storage') listeners.add(callback) },
      removeEventListener: (event, callback) => listeners.delete(callback),
      location: { reload: () => { reloads++ } },
    }
    t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous })
  }
  const requests = [], saved = new Map()
  const dependencies = {
    pinia: { defineStore },
    vue: { onScopeDispose },
    '@jetlinks-web-core/api/system/user': {
      detail: () => {
        const response = deferred()
        requests.push(response)
        return response.promise
      },
    },
    '@jetlinks-web-core/views/account/center/data': { tabList: [{ key: 'HomeView' }] },
    '@jetlinks-web/utils': {
      getToken: () => token,
      LocalStore: { set: (key, value) => saved.set(key, value), remove: key => saved.delete(key) },
    },
    'lodash-es': { pick },
  }
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'ref', 'computed', code)(name => {
    assert.ok(Object.hasOwn(dependencies, name), name)
    return dependencies[name]
  }, module, module.exports, ref, computed)
  return {
    store: module.exports.useUserStore(createPinia()), requests, saved,
    setToken: value => { token = value },
    storageChanged: () => { for (const callback of listeners) callback() },
    get reloads() { return reloads },
  }
}

test('a late response from the previous account cannot replace the current account', async () => {
  const f = fixture()
  const oldLogin = f.store.getUserInfo()
  f.setToken('member-token')
  const currentLogin = f.store.getUserInfo()
  f.requests[1].resolve(profile('member-id', 'test-member'))
  await currentLogin
  f.requests[0].resolve(profile('admin-id', 'admin'))
  await oldLogin
  assert.equal(f.store.userInfo.username, 'test-member')
  assert.equal(f.store.isAdmin, false)
  assert.equal(f.saved.get('userId'), 'member-id')
  assert.equal(f.saved.get('user_info').username, 'test-member')
})

test('a pending user response cannot restore the account after session reset', async () => {
  const f = fixture()
  const pending = f.store.getUserInfo()
  f.store.init()
  f.requests[0].resolve(profile('admin-id', 'admin'))
  await pending
  assert.deepEqual(f.store.userInfo, {})
  assert.equal(f.store.isAdmin, false)
  assert.equal(f.saved.has('userId'), false)
  assert.equal(f.saved.has('user_info'), false)
})

test('concurrent requests for the same session preserve the current account', async () => {
  const f = fixture()
  const first = f.store.getUserInfo()
  const second = f.store.getUserInfo()
  f.requests[1].resolve(profile('admin-id', 'admin'))
  await second
  f.requests[0].resolve(profile('admin-id', 'admin'))
  await first
  assert.equal(f.store.userInfo.username, 'admin')
  assert.equal(f.store.isAdmin, true)
  assert.equal(f.saved.get('userId'), 'admin-id')
})

test('another tab changing or removing the active credential reloads the stale session', t => {
  for (const token of ['member-token', undefined]) {
    const f = fixture(t)
    f.setToken(token)
    f.storageChanged()
    assert.equal(f.reloads, 1)
  }
})

test('unrelated storage and same credential changes preserve the current page', t => {
  const f = fixture(t)
  f.storageChanged()
  f.setToken('admin-token')
  f.storageChanged()
  assert.equal(f.reloads, 0)
})

test('a login handled in the current tab updates its session without reloading', async t => {
  const f = fixture(t)
  f.setToken('member-token')
  f.store.init()
  const pending = f.store.getUserInfo()
  f.requests[0].resolve(profile('member-id', 'test-member'))
  await pending
  f.storageChanged()
  assert.equal(f.reloads, 0)
  assert.equal(f.store.userInfo.username, 'test-member')
})
