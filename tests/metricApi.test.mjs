import assert from 'node:assert/strict'
import test from 'node:test'
import { createMetricLoader } from './helpers/metricRuntime.mjs'
const calls = []; let status = 200
const request = Object.fromEntries(['get','post','put','remove'].map(method => [method, async (...args) => { calls.push([method,...args]); return { status, result: [], message: 'Denied' } }]))
const { metricApi } = createMetricLoader({ '@jetlinks-web/core': { request } })('components/Metric/api.ts')
test('指标API和新增草稿删除使用既有请求上下文、编码ID并拒绝业务失败响应', async () => {
  await metricApi.getConfig('a/b'); await metricApi.byOwner('line', 'a/b'); await metricApi.selectable(); await metricApi.configTemplate('a/b')
  await metricApi.saveConfig({}); await metricApi.removeConfig('a/b'); await metricApi.latest(['a']); await metricApi.history('a/b', {})
  await metricApi.queryTemplates({}); await metricApi.saveTemplate({}); await metricApi.releaseTemplate('a/b'); await metricApi.setAvailable('a/b', false)
  await metricApi.removeTemplate('a/b'); await metricApi.simulate({})
  assert.deepEqual(calls.find(call => call[0] === 'remove' && call[1].includes('/templates')), ['remove','/metric/templates/a%2Fb',undefined,{ hiddenError: true }])
  assert.ok(calls.some(call => call[1] === '/metric/configs/owner/line/a%2Fb'))
  status = 403; await assert.rejects(metricApi.removeTemplate('denied'), /Denied/)
})
