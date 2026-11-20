import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transform } from 'esbuild'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'

const base = new URL('./components/StationMessage/components/NotificationRecord/components/', import.meta.url)
const source = readFileSync(new URL('alarmNotificationSummary.ts', base), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { buildAlarmNotificationSummary, isAlarmNotification, readNotificationDetail } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))

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
  assert.deepEqual(reasons(byEvent), { condition: '测试温度大于50', recovery: '测试温度 = 42' })
  const relieve = byEvent.fields.find(field => field.key === 'relieveTime')
  assert.deepEqual([relieve.value, relieve.format], [1793876999000, 'time'])

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
  assert.deepEqual(values(scene), { sceneName: '夜间巡检', description: '需现场确认' })
  assert.equal(scene.fields.at(-1).wide, true)

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

test('展示组件可编译，使用到的文案在中英日资源中齐全', () => {
  const file = fileURLToPath(new URL('AlarmNotificationSummary.vue', base))
  const { descriptor, errors } = parse(readFileSync(file, 'utf8'), { filename: file })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'alarm-summary' })
  const template = compileTemplate({ source: descriptor.template.content, filename: file, id: 'alarm-summary',
    compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])

  const used = new Set([...source.matchAll(/LABEL \+ '(\w+)'/g)].map(match => match[1]))
  for (const match of source.matchAll(/push\('(\w+)'/g)) used.add(match[1])
  for (const match of descriptor.template.content.matchAll(/components\.ViewDialog\.alarm\.(\w+)/g)) used.add(match[1])
  assert.ok(used.size >= 20)
  for (const lang of ['zh', 'en', 'ja']) {
    const messages = JSON.parse(readFileSync(new URL(`../../../locales/lang/${lang}.json`, import.meta.url), 'utf8'))
    for (const key of used) assert.ok(messages[`components.ViewDialog.alarm.${key}`], `${lang} 缺少 ${key}`)
  }
})
