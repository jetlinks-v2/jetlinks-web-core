import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { transformSync } from 'esbuild'

function fixture() {
  let response
  const calls = []
  const source = readFileSync(new URL('../src/api/commandSupports.ts', import.meta.url), 'utf8')
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(
    () => ({ request: { get: async (...args) => {
      calls.push(args)
      if (response instanceof Error) throw response
      return response
    } } }), module, module.exports,
  )
  return { ...module.exports, calls, respond: value => { response = value } }
}

test('command modules use the canonical exists endpoint and accept only successful true responses', async () => {
  const api = fixture()
  for (const [response, expected] of [
    [{ success: true, result: true }, true],
    [{ success: true, result: false }, false],
    [{ success: false, result: true }, false],
    [{ success: true, result: 'true' }, false],
  ]) {
    api.respond(response)
    assert.equal(await api.hasCommandSupport('mediaService:device'), expected)
  }
  assert.deepEqual(api.calls[0], [
    '/command-supports/service/mediaService%3Adevice/exists', undefined,
    { applicationScope: false, hiddenError: true },
  ])
})

test('registered dynamic services are found by their template without requesting a device or its commands', async () => {
  const api = fixture()
  for (const id of ['agentService', 'agentService:{agentId}@{agentType}@{serviceId}']) {
    api.respond({ success: true, result: [{ id }] })
    assert.equal(await api.hasCommandService('agentService'), true)
  }
  assert.equal(api.calls.length, 2)
  assert.ok(api.calls.every(([url]) => url === '/command-supports/services'))
  assert.deepEqual(api.calls[0][2], { applicationScope: false, hiddenError: true })
})

test('missing services and similar names do not enable the module', async () => {
  const api = fixture()
  for (const response of [
    { success: true, result: [] },
    { success: true, result: [{ id: 'agentServiceExtra:device' }, { id: 'deviceService:device' }] },
  ]) {
    api.respond(response)
    assert.equal(await api.hasCommandService('agentService'), false)
  }
})

test('service discovery rejects unsuccessful or malformed responses instead of treating them as absent', async () => {
  const api = fixture()
  for (const response of [
    { success: false, result: [{ id: 'agentService' }] },
    { success: true },
    { success: true, result: null },
    { success: true, result: {} },
  ]) {
    api.respond(response)
    await assert.rejects(api.hasCommandService('agentService'))
  }
})

test('request failures propagate to the existing page capability guards', async () => {
  const api = fixture()
  api.respond(new Error('unavailable'))
  await assert.rejects(api.hasCommandSupport('mediaService:channel'), /unavailable/)
  await assert.rejects(api.hasCommandService('agentService'), /unavailable/)
})
