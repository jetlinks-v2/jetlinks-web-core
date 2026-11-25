import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/api/notificationRecipients.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node',
  external: ['@jetlinks-web/core'],
})

function loadRecipients(request = {}) {
  const module = { exports: {} }
  const require = specifier => {
    assert.equal(specifier, '@jetlinks-web/core')
    return { request }
  }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

test('Webhook 和钉钉机器人使用固定目标', () => {
  const { notificationRecipientCapabilities } = loadRecipients()
  assert.deepEqual(notificationRecipientCapabilities({ type: 'webhook' }), { fixedRecipient: true })
  assert.deepEqual(notificationRecipientCapabilities({ type: 'dingTalk', provider: 'dingTalkRobotWebHook' }), { fixedRecipient: true })
})

test('钉钉工作通知与企业微信分别声明组织和角色能力', () => {
  const { notificationRecipientCapabilities } = loadRecipients()
  assert.deepEqual(notificationRecipientCapabilities({ type: 'dingTalk', provider: 'dingTalkMessage' }), { recipientTypes: ['org'] })
  assert.deepEqual(notificationRecipientCapabilities({ type: 'weixin', provider: 'corpMessage' }), { recipientTypes: ['org', 'role'] })
})

test('缺少凭据、未知类型和不匹配的 Provider 不推断范围能力', () => {
  const { notificationRecipientCapabilities } = loadRecipients()
  for (const config of [undefined, {}, { type: 'dingTalk' }, { type: 'email' },
    { type: 'dingTalk', provider: 'corpMessage' }, { type: 'weixin', provider: 'dingTalkRobotWebHook' }]) {
    assert.deepEqual(notificationRecipientCapabilities(config), {})
  }
})

test('凭据查询编码 ID 并返回服务端配置', async () => {
  const config = { type: 'dingTalk', provider: 'dingTalkMessage' }
  const { queryNotificationRecipientNotifier } = loadRecipients({
    get: async url => {
      assert.equal(url, '/notifier/config/team%2F%E9%80%9A%E7%9F%A5%3F')
      return { success: true, result: config }
    },
  })
  assert.deepEqual(await queryNotificationRecipientNotifier('team/通知?'), config)
})

test('凭据查询兼容 data 响应而不接受业务失败中的配置', async () => {
  const config = { type: 'weixin', provider: 'corpMessage' }
  const success = loadRecipients({ get: async () => ({ data: config }) })
  assert.deepEqual(await success.queryNotificationRecipientNotifier('wechat'), config)
  const failure = loadRecipients({ get: async () => ({ success: false, result: config }) })
  assert.equal(await failure.queryNotificationRecipientNotifier('denied'), undefined)
})

test('凭据不可访问时降级为未确认能力，不阻断渠道目录', async () => {
  const { queryNotificationRecipientNotifier } = loadRecipients({
    get: async () => { throw new Error('Forbidden') },
  })
  assert.equal(await queryNotificationRecipientNotifier('denied'), undefined)
})

test('组织目录保留完整路径、清理 ID 并忽略无效节点', async () => {
  const { queryNotificationRecipientDirectory } = loadRecipients({
    post: async (url, body) => {
      assert.equal(url, '/organization/_all/tree')
      assert.deepEqual(body, {})
      return { success: true, result: [null, false, 'invalid', {
        id: ' root ', name: '总公司', children: [null, { id: 'engineering', name: '研发部' },
          { id: 'team', name: '项目组', children: [{ id: 'leaf' }] }],
      }, { id: '   ', name: '无效组织' }] }
    },
  })
  assert.deepEqual(await queryNotificationRecipientDirectory('org'), [
    { id: 'root', name: '总公司' },
    { id: 'engineering', name: '总公司 / 研发部' },
    { id: 'team', name: '总公司 / 项目组' },
    { id: 'leaf', name: '总公司 / 项目组 / leaf' },
  ])
})

test('组织目录兼容分页包装并对同 ID 去重', async () => {
  const { queryNotificationRecipientDirectory } = loadRecipients({
    post: async () => ({ result: { data: [
      { id: 'shared', name: '旧名称' }, { id: 'shared', name: '新名称' },
    ] } }),
  })
  assert.deepEqual(await queryNotificationRecipientDirectory('org'), [{ id: 'shared', name: '新名称' }])
})

test('角色目录使用非分页接口且不展开角色 children', async () => {
  const { queryNotificationRecipientDirectory } = loadRecipients({
    get: async url => {
      assert.equal(url, '/role/_query/no-paging?paging=false')
      return { data: { data: [{ id: 'duty', name: '值班组', children: [{ id: 'ignored' }] }] } }
    },
  })
  assert.deepEqual(await queryNotificationRecipientDirectory('role'), [{ id: 'duty', name: '值班组' }])
})

test('空目录仍是成功响应且支持 data 数组', async () => {
  const { queryNotificationRecipientDirectory } = loadRecipients({ get: async () => ({ data: [] }) })
  assert.deepEqual(await queryNotificationRecipientDirectory('role'), [])
})

test('目录业务失败和非数组响应保留错误供界面重试', async () => {
  for (const response of [{ success: false, result: [] }, { result: {} }, {}]) {
    const { queryNotificationRecipientDirectory } = loadRecipients({
      get: async () => response, post: async () => response,
    })
    await assert.rejects(queryNotificationRecipientDirectory('org'), /directory unavailable/)
    await assert.rejects(queryNotificationRecipientDirectory('role'), /directory unavailable/)
  }
})

test('目录网络失败不会被转换为空候选', async () => {
  const { queryNotificationRecipientDirectory } = loadRecipients({
    get: async () => { throw new Error('Network unavailable') },
  })
  await assert.rejects(queryNotificationRecipientDirectory('role'), /Network unavailable/)
})
