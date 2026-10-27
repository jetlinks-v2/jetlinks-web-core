import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/mbean')
const filename = resolve(root, 'MBeanSemanticMetrics.vue')
const source = readFileSync(filename, 'utf8'), { descriptor } = parse(source, { filename })
const semanticModule = { exports: {} }
new Function('require', 'module', 'exports', transformSync(readFileSync(resolve(root, 'semantic.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code)(require, semanticModule, semanticModule.exports)
const { groupMBeanSemanticMetrics, mbeanSemanticMetrics, formatSemanticValue } = semanticModule.exports
const zh = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/locales/lang/zh.json'), 'utf8'))
const translate = (key, fallback) => zh[key] ?? fallback ?? key
const bean = (type, values) => ({ domain: 'org.jetlinks', type, attributes: Object.entries(values).map(([name, value]) => ({ name, value, available: true })) })

const tooltip = vue.defineComponent({ props: ['title', 'trigger'], setup: (props, { slots }) => () => vue.h('span', { 'data-tooltip-trigger': props.trigger?.join(',') }, slots.default?.()) })
const icon = vue.defineComponent({ setup: (_props, { attrs }) => () => vue.h('span', { ...attrs, 'data-info-icon': '' }) })
const progress = vue.defineComponent({ props: ['percent'], setup: props => () => vue.h('span', { 'data-progress-percent': props.percent }) })
const compiled = compileScript(descriptor, { id: 'semantic-metric-typography', inlineTemplate: true }), componentModule = { exports: {} }
new Function('require', 'module', 'exports', transformSync(compiled.content, { loader: 'ts', format: 'cjs' }).code)(id => {
  if (id === 'vue') return vue
  if (id === 'vue-i18n') return { useI18n: () => ({ t: translate, te: key => key in zh, locale: vue.ref('zh-CN') }) }
  if (id === '@ant-design/icons-vue') return { InfoCircleOutlined: icon }
  if (id === './semantic') return semanticModule.exports
  return require(id)
}, componentModule, componentModule.exports)

async function render(metrics) {
  const app = vue.createSSRApp(componentModule.exports.default, { metrics })
  app.component('a-tooltip', tooltip); app.component('a-progress', progress)
  return renderToString(app)
}
function groupMarkup(html, kind) {
  return html.match(new RegExp(`<dl[^>]*bean-semantic-group--${kind}[^>]*>([\\s\\S]*?)<\\/dl>`))?.[1] ?? ''
}

test('semantic grouping emphasizes numeric business metrics and preserves every original reading', () => {
  const metrics = [
    { key: 'when', format: 'timestamp', value: 1792981800000 },
    { key: 'total', format: 'count', value: '9223372036854775807' },
    { key: 'duration', format: 'milliseconds', value: 25 },
    { key: 'bytes', format: 'bytes', value: 1048576 },
    { key: 'state', format: 'boolean', value: false },
    { key: 'ratio', format: 'ratio', value: 0.5 },
    { key: 'label', format: 'text', value: 'unchanged metadata' },
    { key: 'qps', format: 'rate', value: 2 },
    { key: 'unknown', format: 'count', value: undefined },
  ]
  const groups = groupMBeanSemanticMetrics(metrics)
  assert.deepEqual(groups.map(group => [group.kind, group.metrics.map(metric => metric.key)]), [
    ['primary', ['total', 'bytes', 'ratio', 'qps', 'unknown']],
    ['secondary', ['when', 'duration', 'state', 'label']],
  ])
  assert.equal(groups.flatMap(group => group.metrics).length, metrics.length)
  assert.ok(groups.flatMap(group => group.metrics).every(metric => metrics.includes(metric)), 'values and metric objects are retained')
  assert.equal(metrics[0].key, 'when', 'source order is not mutated')
  assert.deepEqual(groupMBeanSemanticMetrics([]), [])
  assert.equal(groupMBeanSemanticMetrics([{ key: 'last', value: null, format: 'timestamp' }])[0].kind, 'secondary')
})

test('DeviceMessageMonitor keeps all sixteen values with complete dates below the numeric metrics', async () => {
  const values = { StartTime: 1792981800000, SnapshotTime: 1792981802000, ReceivedBytesTotal: 1048576, SentBytesTotal: 0, UpstreamMessagesTotal: '9223372036854775807', PropertyReportsTotal: 4, PropertyValuesTotal: 12, EventReportsTotal: 2, ReceivedPacketsTotal: '9007199254740993', SentPacketsTotal: 0, ReceivedQps: 17, SentQps: 5, CommunicationQps: 22, QpsSampleTime: 1792981801000, QpsWindowMillis: 1000, QpsReady: true }
  const metrics = mbeanSemanticMetrics(bean('DeviceMessageMonitor', values)), html = await render(metrics)
  const primary = groupMarkup(html, 'primary'), secondary = groupMarkup(html, 'secondary')
  assert.equal((html.match(/class="bean-semantic-metric"/g) ?? []).length, 16)
  assert.match(primary, /9223372036854775807/); assert.match(primary, /9007199254740993/); assert.match(primary, /22 \/s/)
  assert.ok(!primary.includes('data-format="timestamp"'))
  for (const key of ['StartTime', 'SnapshotTime', 'QpsSampleTime']) {
    const value = formatSemanticValue(values[key], 'timestamp', 'zh-CN')
    assert.ok(secondary.includes(value), `${key} remains visible in full`)
    assert.ok(secondary.includes(`title="${value}"`), `${key} retains the full accessible value`)
  }
  assert.ok(secondary.includes(translate('runtimeDiagnostics.mbeanSummary.qpsReady')))
  assert.match(secondary, /1000 ms/)
  assert.ok(html.indexOf('bean-semantic-group--primary') < html.indexOf('bean-semantic-group--secondary'))
})

test('other MBean summaries preserve scopes, zero values, status labels and memory progress', async () => {
  const session = await render(mbeanSemanticMetrics(bean('DeviceSessionManager', { Sessions: 0, KeepOnlineSize: 3, History: 2, DataBytes: '2.3MB' })))
  assert.ok(groupMarkup(session, 'primary').includes(translate('runtimeDiagnostics.mbeanSummary.Sessions')))
  assert.match(groupMarkup(session, 'primary'), />0\s*</)
  assert.match(groupMarkup(session, 'secondary'), /2\.3MB/)
  const event = await render(mbeanSemanticMetrics(bean('EventBus', { TotalSubscribers: 7, StructuredLastSuccessfulSyncTime: 1792981800000 })))
  assert.ok(groupMarkup(event, 'primary').includes(translate('runtimeDiagnostics.mbeanSummary.TotalSubscribers')))
  assert.ok(groupMarkup(event, 'secondary').includes(formatSemanticValue(1792981800000, 'timestamp', 'zh-CN')))
  const collector = await render(mbeanSemanticMetrics(bean('SystemMonitorCollector', { Running: false, SuccessCount: 0, LastDurationMillis: 20 })))
  assert.ok(groupMarkup(collector, 'secondary').includes(translate('runtimeDiagnostics.mbeanSummary.idle')))
  const allocator = await render(mbeanSemanticMetrics(bean('NettyAllocator', { Metrics: { allocatorType: 'pooled', jvmDirectUsed: 2, jvmDirectMax: 8 } })))
  assert.match(groupMarkup(allocator, 'primary'), /data-progress-percent="25"/)
  assert.match(groupMarkup(allocator, 'secondary'), /pooled/)
  const unknown = await render([{ key: 'UnrecognizedState', format: 'boolean', value: true }, { key: 'UnknownCount', format: 'count', value: null }])
  assert.match(groupMarkup(unknown, 'secondary'), /UnrecognizedState/); assert.match(groupMarkup(unknown, 'secondary'), />true\s*</)
  assert.match(groupMarkup(unknown, 'primary'), /—/)
})

test('metric hints can open on keyboard focus and retain descriptive accessible names', async () => {
  const html = await render([{ key: 'StartTime', format: 'timestamp', value: 1792981800000 }])
  assert.match(html, /data-tooltip-trigger="hover,focus"/)
  assert.match(html, /tabindex="0"/)
  assert.ok(html.includes(`aria-label="${translate('runtimeDiagnostics.mbeanSummary.StartTimeHint')}"`))
})
