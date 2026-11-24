import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import axios from 'axios'
import { transformSync } from 'esbuild'

test('share config, captcha and token exchange preserve gateway routing without the signed-in identity', async () => {
  const calls = []
  let nextResponseData = { status: 200, result: 'fixture' }
  const storage = new Map([
    ['Accept-Language', 'zh'],
    ['X-Access-Token', 'test-account'],
    ['X-Personal-Token', 'test-other-share'],
  ])
  const dependencies = {
    axios: {
      create: options => axios.create({
        ...options,
        adapter: async config => {
          calls.push(config)
          return { config, headers: {}, status: 200, data: nextResponseData }
        },
      }),
    },
    '@jetlinks-web-core/utils/consts': { langKey: 'Accept-Language' },
    '@jetlinks-web-core/utils/request-context': {
      getBaseApi: () => '/test-gateway',
      getRequestTenantDomain: () => 'test-project',
      stripEdgeRequestHeaders() {},
    },
  }
  const file = new URL('../src/api/share-authorization.ts', import.meta.url)
  const { code } = transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'localStorage', code)(
    name => dependencies[name], module, module.exports, { getItem: key => storage.get(key) },
  )
  const { getTokenConfig, getTokenRedirect, getShareCaptcha } = module.exports
  await getTokenConfig('link')
  assert.equal((await getShareCaptcha()).success, true)
  await getTokenRedirect('link', { authParameters: { password: 'fixture' } })
  assert.deepEqual(calls.map(({ method, url }) => [method, url.split('?')[0]]), [
    ['get', '/personal/token/link/_config'],
    ['get', '/authorize/captcha/image'],
    ['post', '/personal/token/link/_redirect'],
  ])
  assert.deepEqual(JSON.parse(calls[2].data), { authParameters: { password: 'fixture' } })
  for (const config of calls) {
    assert.equal(config.baseURL, '/test-gateway')
    assert.equal(config.headers.get('X-Tenant-Domain'), 'test-project')
    assert.equal(config.headers.get('Accept-Language'), 'zh')
    assert.equal(config.headers.has('X-Access-Token'), false)
    assert.equal(config.headers.has('X-Personal-Token'), false)
  }

  for (const nonObject of [null, '']) {
    nextResponseData = nonObject
    assert.deepEqual(await getTokenConfig('link'), { success: false })
  }
})
