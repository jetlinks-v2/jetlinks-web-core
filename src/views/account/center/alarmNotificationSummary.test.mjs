import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { transform } from 'esbuild'
import { createSSRApp, h, ref, computed } from 'vue'
import { renderToString } from 'vue/server-renderer'
import dayjs from 'dayjs'
import { parse, compileScript } from 'vue/compiler-sfc'

const base = new URL('./components/StationMessage/components/NotificationRecord/components/', import.meta.url)
const require = createRequire(import.meta.url)
const model = require(fileURLToPath(new URL('alarmNotificationSummary.ts', base)))
const { buildAlarmNotificationSummary, isAlarmNotification, readNotificationDetail } = model

const build = (topicProvider, detail, record = {}) =>
  buildAlarmNotificationSummary({ topicProvider, detail, ...record })
const values = summary => Object.fromEntries(summary.fields.map(field => [field.key, field.value]))
const reasons = summary => Object.fromEntries(summary.reasons.map(row => [row.key, row.value]))

// 截图中的设备属性阈值告警：描述只存在于 termSpec 内
const deviceDetail = {
  targetType: 'device', targetId: '2118293209975816192', targetName: 'docs_verify_20261105_mqtt',
  sourceType: 'device', sourceId: '2118293209975816192', sourceName: 'docs_verify_20261105_mqtt',
  productId: 'p1', productName: 'docs_verify_20261105',
  alarmConfigName: 'docs_verify_20261105_temperature', level: 4, alarmTime: 1793876487000, event: 'trigger',
  property: 'temperature', propertyName: '测试温度', propertyValue: 51, propertyValueText: '51',
  termSpec: { column: 'temperature', termType: 'gt', children: [{}], triggerDesc: '测试温度大于50', actualDesc: '测试温度 = 51' },
  bindings: [{ type: 'org', id: 'o1' }], relations: [], message: { deviceId: 'x', properties: { temperature: 51 } },
}

test('设备告警展示对象、产品及 termSpec 内的触发原因，不带出底层字段', () => {
  const summary = build('alarm-device', deviceDetail)
  assert.equal(summary.kind, 'device')
  assert.equal(summary.name, 'docs_verify_20261105_temperature')
  assert.equal(summary.level, 4)
  assert.equal(summary.relieved, false)
  assert.equal(summary.time, 1793876487000)
  assert.deepEqual(reasons(summary), { condition: '测试温度大于50', actual: '测试温度 = 51' })
  assert.deepEqual(values(summary), {
    deviceName: 'docs_verify_20261105_mqtt', deviceId: '2118293209975816192', ownerProduct: 'docs_verify_20261105',
  })
  assert.equal(summary.fields.find(field => field.key === 'deviceId').format, 'mono')
})

test('顶层触发描述优先于 termSpec；缺少实际描述时用属性读数补足', () => {
  const top = build('alarm-device', { ...deviceDetail, triggerDesc: '顶层条件', actualDesc: '顶层实际' })
  assert.deepEqual(reasons(top), { condition: '顶层条件', actual: '顶层实际' })

  const reading = build('alarm-device', { ...deviceDetail, termSpec: { triggerDesc: '温度大于50' }, propertyUnit: '℃' })
  assert.deepEqual(reasons(reading), { condition: '温度大于50', actual: '测试温度 = 51 ℃' })

  const formatted = build('alarm-device', { ...deviceDetail, termSpec: {}, propertyValueText: '51℃', propertyUnit: '℃' })
  assert.deepEqual(reasons(formatted), { actual: '测试温度 = 51℃' })

  const none = build('alarm-device', { ...deviceDetail, termSpec: null, property: null, propertyName: null, propertyValue: null, propertyValueText: '' })
  assert.deepEqual(none.reasons, [])
})

test('零值是有效读数', () => {
  const summary = build('alarm-device', { ...deviceDetail, termSpec: {}, propertyValue: 0, propertyValueText: '' })
  assert.deepEqual(reasons(summary), { actual: '测试温度 = 0' })
})

test('设备告警解除展示解除时间与恢复值', () => {
  const byEvent = build('alarm-device', { ...deviceDetail, event: 'relieve', relieveTime: 1793876999000, propertyValueText: '42' })
  assert.equal(byEvent.relieved, true)
  assert.deepEqual(reasons(byEvent), { condition: '测试温度大于50', recovery: '测试温度 = 42', originalTime: deviceDetail.alarmTime })
  assert.equal(byEvent.time, 1793876999000)
  assert.equal(byEvent.timeLabelKey, 'components.ViewDialog.alarm.relieveTime')

  const byProvider = build('alarm-device-relieve', { targetType: 'device', targetName: 'd1', alarmConfigName: 'a' })
  assert.equal(byProvider.relieved, true)
  assert.equal(byProvider.fields.some(field => field.key === 'relieveTime'), false)
})

test('产品、组织、场景、采集器按对象类型取字段', () => {
  const product = build('alarm-product', { targetType: 'product', targetId: 'p1', targetName: '温控器',
    sourceType: 'device', sourceId: 'd1', sourceName: '1 号温控器', alarmConfigName: 'a' })
  assert.deepEqual(values(product), { productName: '温控器', productId: 'p1', source: '1 号温控器' })

  const org = build('alarm-org', { targetType: 'organization', targetId: 'o1', targetName: '研发部',
    sourceType: 'device', sourceId: 'd1', sourceName: '研发部' })
  assert.deepEqual(values(org), { orgName: '研发部' })

  const scene = build('alarm-other', { targetType: 'scene', targetId: 's1', targetName: '夜间巡检', description: '  需现场确认  ' })
  assert.equal(scene.kind, 'scene')
  assert.deepEqual(values(scene), { sceneName: '夜间巡检' })
  assert.equal(scene.description, '需现场确认')

  const collector = build('alarm-collector', { targetType: 'collector', targetId: 'c1', targetName: 'PLC-1' })
  assert.deepEqual(values(collector), { collectorName: 'PLC-1', collectorId: 'c1' })
})

test('通用告警按 targetType 归类，未知类型显示告警对象', () => {
  assert.equal(build('alarm', { targetType: 'device', targetName: 'd' }).kind, 'device')
  const other = build('alarm', { targetType: 'custom', targetName: '自定义对象', alarmName: '名称优先', alarmConfigName: 'x' })
  assert.equal(other.kind, 'other')
  assert.equal(other.name, '名称优先')
  assert.deepEqual(values(other), { target: '自定义对象' })
  // 历史数据缺少 targetType 时按 provider 兜底
  assert.equal(build('alarm-org', { targetName: '研发部' }).kind, 'organization')
})

test('AI 告警从 alarmInfo 白名单字段补空间与视频通道', () => {
  const alarmInfo = JSON.stringify({ mediaDeviceName: '东门摄像头', mediaChannelName: '通道 1',
    headers: { spaceName: '一号厂房' }, results: [{ secret: 1 }] })
  const summary = build('aiSecurityAlarm', { targetType: 'aiTaskMediaTarget', targetName: '未戴安全帽',
    sourceType: 'media', sourceId: 'm1', sourceName: '东门摄像头', alarmConfigName: '安全帽检测', level: 1, alarmInfo })
  assert.equal(summary.kind, 'ai')
  assert.deepEqual(values(summary), { target: '未戴安全帽', space: '一号厂房', mediaDevice: '东门摄像头', mediaChannel: '通道 1' })
  assert.equal(build('aiComplianceAlarm', {}).kind, 'ai')
})

test('损坏的历史 JSON 不抛错，并回退到可用数据', () => {
  const record = { topicProvider: 'alarm-device', detailJson: '{broken', notifyTime: 1700000000000, targetName: 'x' }
  assert.equal(readNotificationDetail(record), record)
  const summary = buildAlarmNotificationSummary(record)
  assert.equal(summary.time, 1700000000000)
  assert.equal(summary.level, undefined)
  assert.doesNotThrow(() => build('alarm-device', { ...deviceDetail, alarmInfo: '{oops', termSpec: 'nope' }))
  assert.deepEqual(readNotificationDetail({ detailJson: '{"a":1}', detail: { b: 2 } }), { a: 1 })
  assert.deepEqual(readNotificationDetail({ detail: { b: 2 } }), { b: 2 })
  assert.deepEqual(readNotificationDetail(null), {})
})

test('告警识别不只依赖 alarm- 前缀，非告警通知不受影响', () => {
  assert.equal(isAlarmNotification('alarm', {}), true)
  assert.equal(isAlarmNotification('alarm-device-relieve', {}), true)
  assert.equal(isAlarmNotification('aiSecurityAlarm', {}), true)
  assert.equal(isAlarmNotification('custom-provider', { alarmConfigId: 'a1' }), true)
  assert.equal(isAlarmNotification('system-bulletin', { title: '公告' }), false)
  assert.equal(isAlarmNotification(undefined, undefined), false)
})

const messages = Object.fromEntries(['zh', 'en', 'ja'].map(lang => [lang,
  JSON.parse(readFileSync(new URL(`../../../locales/lang/${lang}.json`, import.meta.url), 'utf8')),
]))

async function compileComponent(name, imports, onMounted) {
  const file = fileURLToPath(new URL(name, base))
  const { descriptor, errors } = parse(readFileSync(file, 'utf8'), { filename: file })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: name, inlineTemplate: true })
  const { code } = await transform(script.content, { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', 'ref', 'computed', 'onMounted', code)(
    imports, module, module.exports, ref, computed, onMounted,
  )
  return module.exports.default
}

// 挂载真实弹窗和摘要；只替换 UI 外壳、注册中心和 HTTP 边界。
async function createDetailRenderer({ registered = [], onLevel = () => {} } = {}) {
  const mounted = []
  let summary
  const imports = id => {
    if (id === './alarmNotificationSummary') return model
    if (id === './StationNotificationSummary.vue') return summary
    if (id.includes('components-registry')) return { componentsRegistry: { getRegistry: () => registered } }
    if (id.includes('RegisterComponents')) return { render: () => h('span', 'registered-detail') }
    if (id.includes('StatusTag')) return { props: ['text'], render() { return h('span', this.text) } }
    if (id.includes('/api/account/')) return { queryLevel: async () => { onLevel(); return { status: 200, result: { levels: [] } } } }
    if (id === 'vue3-json-viewer') return { JsonViewer: () => h('pre', 'raw-json') }
    if (id === 'vue' || id === 'dayjs') return require(id)
    return {}
  }
  summary = await compileComponent('StationNotificationSummary.vue', imports)
  const dialog = await compileComponent('ViewDialog.vue', imports, callback => mounted.push(callback))
  return async function open(record, lang = 'zh') {
    const app = createSSRApp(dialog, { visible: true, type: 'notification', data: record })
    app.config.globalProperties.$t = (key, params = {}) => {
      assert.ok(messages[lang][key], `${lang} 缺少 ${key}`)
      return messages[lang][key].replace(/\{(\w+)\}/g, (_, name) => params[name])
    }
    app.component('a-modal', { props: ['title'], render() { return h('div', [h('header', this.title), this.$slots.default?.(), this.$slots.footer?.()]) } })
    for (const tag of ['a-descriptions', 'a-descriptions-item', 'j-ellipsis', 'j-scrollbar', 'a-empty', 'a-button']) {
      app.component(tag, (_props, { slots }) => slots.default?.())
    }
    const html = await renderToString(app)
    for (const callback of mounted.splice(0)) callback()
    return html
  }
}

test('兼容详情在不同时刻打开同一条通知，只展示记录里的有效时间', async t => {
  const open = await createDetailRenderer()
  const notifyTime = 1700000000000
  const alarmTime = notifyTime - 60000
  const cases = [
    [{}, String(notifyTime), notifyTime],
    [{ alarmTime: String(alarmTime) }, notifyTime, alarmTime],
    [{ alarmTime: dayjs(alarmTime).toISOString() }, notifyTime, alarmTime],
    [{ alarmTime: 'invalid' }, notifyTime, notifyTime],
    [{ alarmTime: null }, 'invalid', undefined],
    [{}, undefined, undefined],
  ]
  t.mock.timers.enable({ apis: ['Date'], now: notifyTime + 86400000 })
  for (const [detail, storedTime, expected] of cases) {
    const record = { topicProvider: 'legacy', detailJson: JSON.stringify(detail), notifyTime: storedTime }
    const first = await open(record)
    t.mock.timers.tick(60000)
    assert.equal(await open(record), first)
    if (expected) assert.ok(first.includes(dayjs(expected).format('YYYY-MM-DD HH:mm:ss')))
    else assert.doesNotMatch(first, /\d{4}-\d{2}-\d{2}|Invalid Date/)
  }
})

const sceneRecord = {
  topicProvider: 'scene', code: 'scene', topicName: '场景联动', message: '场景 1 已执行', notifyTime: 1795253239049,
  detailJson: '{"sceneName":"1","sceneId":"2124072110920404992","triggerType":"手动触发"}',
}

test('场景执行渲染真实站内信字段，不推断结果、不走告警请求；损坏详情仍展示正文与时间', async () => {
  let levelCalls = 0
  const open = await createDetailRenderer({ onLevel: () => levelCalls++ })
  const html = await open(sceneRecord)
  for (const expected of ['场景联动通知', '场景 1 已执行', '场景名称', '手动触发', '2124072110920404992', '通知时间', dayjs(sceneRecord.notifyTime).format('YYYY-MM-DD HH:mm:ss')]) {
    assert.ok(html.includes(expected), expected)
  }
  assert.doesNotMatch(html, /raw-json|告警|成功|失败|已触发|执行时间/)
  const broken = await open({ ...sceneRecord, detailJson: '{broken', id: 'private-inbox-id' })
  assert.match(broken, /场景 1 已执行/)
  assert.doesNotMatch(broken, /private-inbox-id|场景 ID|触发方式|场景信息|raw-json/)
  const collision = await open({ ...sceneRecord, detailJson: undefined, detail: { alarmName: 'unrelated', sceneName: '对象形式' } })
  assert.match(collision, /对象形式/)
  assert.doesNotMatch(collision, /unrelated|已触发/)
  assert.equal(levelCalls, 0)
  const alarm = await open({ topicProvider: 'alarm-other', detail: { targetName: '巡检', sceneId: 's' } })
  assert.match(alarm, /场景告警详情/)
  assert.match(alarm, /已触发/)
  assert.equal(levelCalls, 1)
  assert.match(await open({ topicProvider: 'alarm-device', detail: { level: 2 } }), /2 级告警/)
})

test('注册详情优先于内置场景和告警摘要', async () => {
  const registered = [{ code: 'scene' }, { code: 'alarm-device' }]
  const open = await createDetailRenderer({ registered, onLevel: () => assert.fail('注册详情不应加载告警级别') })
  for (const { code } of registered) {
    const html = await open({ ...sceneRecord, topicProvider: code })
    assert.match(html, /registered-detail/)
    assert.doesNotMatch(html, /notice-summary|raw-json/)
  }
})

test('对象缺名称时用业务 ID 而非收件箱标识；优先名称且零值有效', () => {
  const record = { sourceId: 'inbox-id', message: '只有通知正文' }
  const cases = [
    ['alarm', { targetId: 'o1' }, { id: 'o1' }],
    ['alarm-org', { targetId: 'o1' }, { orgId: 'o1' }],
    ['alarm-other', { targetId: 's1' }, { sceneId: 's1' }],
    ['alarm-device', { productId: 'p1', targetId: 'd1' }, { productId: 'p1', deviceId: 'd1' }],
    ['aiComplianceAlarm', { targetId: 0, spaceId: 's1', headers: { mediaDeviceId: 'd1', mediaChannelId: 'c1' }, mediaChannelName: '北门' },
      { id: '0', spaceId: 's1', mediaDeviceId: 'd1', mediaChannel: '北门' }],
    ['alarm', {}, {}],
  ]
  for (const [provider, detail, expected] of cases) {
    const summary = build(provider, detail, record)
    assert.deepEqual(values(summary), expected)
    assert.equal(summary.name, record.message)
  }
})

test('缺少解除时间不将通知时间误标；原告警时间只来自有效 alarmTime', () => {
  const a = 1700000000000, n = a + 60000
  for (const [detail, notifyTime, expected, label, original] of [
    [{ alarmTime: a, relieveTime: n }, n, n, 'relieveTime', a],
    [{ alarmTime: a, relieveTime: 'invalid' }, n, n, 'notifyTime', a],
    [{ alarmTime: a }, undefined, a, 'originalTime', undefined],
    [{}, n, n, 'notifyTime', undefined],
    [{ relieveTime: n }, a, n, 'relieveTime', undefined],
  ]) {
    const summary = build('alarm-device-relieve', detail, { notifyTime })
    assert.equal(summary.time, expected)
    assert.equal(summary.timeLabelKey, `components.ViewDialog.alarm.${label}`)
    assert.equal(reasons(summary).originalTime, original)
  }
})

test('各类型弹窗按中英日实际渲染，通用告警标识只标 ID', async () => {
  const open = await createDetailRenderer()
  const objects = { targetName: 'target', targetId: 'target-id', sourceName: 'from', sourceId: 'source', description: 'desc' }
  const alarm = (topicProvider, detail = {}) => ({ topicProvider, detail: { ...objects, ...detail }, notifyTime: 1795253239049 })
  const records = [sceneRecord, alarm('alarm-device', deviceDetail), alarm('alarm-device-relieve', { ...deviceDetail, relieveTime: 1795253239049 }),
    alarm('alarm-product'), alarm('alarm-org'), alarm('alarm-org', { targetName: '' }), alarm('alarm-other'), alarm('alarm-other', { targetName: '' }), alarm('alarm-collector'),
    alarm('aiSecurityAlarm', { spaceName: 'a', mediaChannelName: 'b', mediaDeviceName: 'c' }), alarm('aiComplianceAlarm', { spaceId: 's', mediaChannelId: 'c', mediaDeviceId: 'd' }),
    alarm('alarm', { targetName: '', targetId: 'PUMP-GROUP-07' }), alarm('alarm', { targetType: 'aiTaskMediaTarget' }), alarm('alarm-device', { productId: 'p1' })]
  for (const lang of Object.keys(messages)) for (const record of records) {
    const html = await open(record, lang)
    assert.match(html, /notice-summary__head/)
    assert.doesNotMatch(html, /components\.ViewDialog|raw-json/)
    if (record.detail?.targetId === 'PUMP-GROUP-07') assert.match(html, /<dt>ID<\/dt>/)
  }
})
