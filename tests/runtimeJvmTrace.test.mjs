import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'
import { buildSync, transformSync } from 'esbuild'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
import { parse, compileScript } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2020' })
  new Function('require', 'module', 'exports', code)(id => id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const componentPath = name => resolve(root, `src/components/RuntimeDiagnostics/${name}.ts`)
const { buildFlameLayout, renderFlameSvg, classifyFlameFrame, captureFlameViewport, restoreFlameViewport } = load(componentPath('flameGraph'))
const { createFlameGraphHtml } = load(componentPath('flameGraphHtml'))
const { traceRows } = load(componentPath('utils'))
const { exceptionEvents, summarizeTrace, traceBar, traceDurationLabel, traceNanosecondDelta, traceSlowCalls, traceEvidence, defaultTraceEvidence, visibleTraceRows, nodeColorIndex, formatTraceDuration, traceEpochMillis, formatTraceTimestamp, groupTraceAttributes, formatTraceAttribute } = load(componentPath('tracePresentation'))
const frame = (className, samples, children = []) => ({ className, samples, children })
const sample = { flameGraph: [frame('java.lang.Thread', 100, [frame('org.jetlinks.Buffer', 70, [frame('reactor.core.Flux', 30)]), frame('io.netty.Channel', 20)])], objectAllocations: [] }

test('inclusive samples preserve denominator and parent-child paths under search/categories', () => {
  const all = buildFlameLayout(sample.flameGraph)
  assert.equal(all.total, 100); assert.equal(all.cells.length, 4)
  const filtered = buildFlameLayout(sample.flameGraph, { category: 'platform', search: 'Buffer' })
  assert.equal(filtered.total, 100); assert.equal(filtered.cells.length, 4); assert.equal(filtered.matched, 1)
  assert.equal(filtered.cells.find(cell => cell.name.includes('Buffer')).samples, 70)
  assert.ok(filtered.cells.every(cell => cell.x >= 0 && cell.x + cell.width <= 100.00001))
})
test('snapshot replacement never adds an earlier cumulative snapshot and focus follows identity', () => {
  const first = buildFlameLayout([frame('root', 10, [frame('a', 4), frame('b', 6)])])
  const focus = first.cells.find(cell => cell.name === 'a').key
  const next = buildFlameLayout([frame('root', 20, [frame('b', 12), frame('a', 8)])], { focus })
  assert.equal(next.total, 20); assert.equal(next.cells[0].name, 'a'); assert.equal(next.cells[0].width, 100); assert.equal(next.cells[0].samples, 8)
  assert.equal(buildFlameLayout([frame('other', 1)], { focus }).focus, undefined)
})
test('malformed weights cannot produce negative or overflowing geometry', () => {
  const result = buildFlameLayout([frame('root', 10, [frame('a', 12), frame('b', 8), frame('bad', NaN), frame('negative', -4)])])
  assert.equal(result.total, 10)
  assert.ok(result.cells.every(cell => Number.isFinite(cell.width) && cell.width >= 0 && cell.x + cell.width <= 100.00001))
  assert.equal(buildFlameLayout([frame('empty', NaN)]).total, 0)
})
test('categories identify package boundaries and configurable platform prefixes', () => {
  assert.equal(classifyFlameFrame('org.jetlinks.Buffer'), 'platform')
  assert.equal(classifyFlameFrame('org.jetlinksevil.Buffer'), 'other')
  assert.equal(classifyFlameFrame('custom.platform.Handler', ['custom.platform.']), 'platform')
  assert.equal(classifyFlameFrame('reactor.core.publisher.Flux'), 'reactive')
  assert.equal(classifyFlameFrame('io.netty.channel.EventLoop'), 'network')
  assert.equal(classifyFlameFrame('io.rsocket.core.SetupHandlingDuplexConnection'), 'network')
  assert.equal(classifyFlameFrame('io.rsocketextra.Handler'), 'other')
  assert.equal(classifyFlameFrame('jdk.internal.vm.gc.G1'), 'gc')
})
test('bottom-root viewport keeps a reading layer when cumulative snapshots grow or shrink', () => {
  const before = { scrollTop: 1050, scrollLeft: 86, scrollHeight: 1728, clientHeight: 480 }
  const anchor = captureFlameViewport(before)
  assert.deepEqual(anchor, { bottom: 198, left: 86 })
  assert.deepEqual(restoreFlameViewport({ ...before, scrollHeight: 2160 }, anchor), { top: 1482, left: 86 })
  assert.deepEqual(restoreFlameViewport({ ...before, scrollHeight: 60 }, anchor), { top: 0, left: 86 })
  assert.deepEqual(restoreFlameViewport(before), { top: 1248, left: 0 })
})
test('shared SVG renderer escapes all frame text and attributes', () => {
  const svg = renderFlameSvg(buildFlameLayout([frame('</text><script>alert(1)</script>"&', 1)]), { samples: '<samples>', platform: 'Platform' })
  assert.ok(!svg.includes('<script>')); assert.ok(!svg.includes('</text><script'))
  assert.ok(svg.includes('&lt;')); assert.ok(svg.includes('role="button"')); assert.ok(svg.includes('tabindex="0"'))
})
test('shared SVG uses the actual canvas width without scaling or vertically centering stack rows', () => {
  const layout = buildFlameLayout(sample.flameGraph)
  for (const width of [720, 980, 1396]) {
    const svg = renderFlameSvg(layout, { samples: 'samples', platform: 'platform' }, width)
    assert.ok(svg.includes(`viewBox="0 0 ${width} 81"`))
    assert.ok(svg.includes('preserveAspectRatio="xMinYMax meet"'))
    assert.ok(svg.includes(`width="${width - 1}" height="25"`), 'root fills the same physical width as the SVG viewport')
    assert.ok(svg.includes('y="54"'), 'the root is one 27px row above the graph bottom')
  }
})

function offlineDocument() {
  const elements = Object.fromEntries(['#search', '#reset', '#count', '#chart', '#groups', '#info', '#insights', '#hotspots', '.tools'].map(key => [key, { value: '', textContent: '', innerHTML: '', style: {}, listeners: {}, children: [], addEventListener(name, listener) { this.listeners[name] = listener }, append(child) { this.children.push(child) } }]))
  Object.assign(elements['#chart'], { clientHeight: 480, clientWidth: 980, scrollTop: 0, scrollLeft: 0 })
  Object.defineProperty(elements['#chart'], 'scrollHeight', { get() { return Math.max(this.clientHeight, Number(this.innerHTML.match(/height="(\d+)" role="img"/)?.[1] ?? 0)) } })
  const document = { querySelector: key => key === '#flame-export' ? document : elements[key], querySelectorAll: () => elements['#groups'].children, createElement: () => ({ dataset: {}, setAttribute(key, value) { this[key] = value } }) }
  return { document, elements }
}
test('HTML export executes offline from minified production bundle and escapes script terminators', () => {
  const result = buildSync({ entryPoints: [componentPath('flameGraphHtml')], bundle: true, format: 'cjs', platform: 'node', target: 'es2020', minify: true, write: false })
  const module = { exports: {} }; new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
  const hostile = '</script><script>globalThis.pwned=true</script><img src=x onerror=alert(1)>\u2028\u2029'
  const html = module.exports.createFlameGraphHtml({ nodeId: hostile, snapshot: { ...sample, flameGraph: [frame(hostile, 10)], startedAt: NaN, sampledAt: 1e20 }, labels: { search: hostile } })
  assert.equal((html.match(/<script>/g) ?? []).length, 1)
  assert.ok(html.includes('default-src')); assert.ok(!html.includes('https://')); assert.ok(!html.includes('token'))
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1]
  const dom = offlineDocument(), context = { document: dom.document }
  vm.runInNewContext(script, context)
  assert.equal(context.pwned, undefined)
  assert.ok(!dom.elements['#chart'].innerHTML.includes('<img'))
  assert.ok(dom.elements['#chart'].innerHTML.includes('&lt;'))
  assert.equal(dom.elements['#groups'].children.length, 6)
  dom.elements['#search'].value = 'no matches'; dom.elements['#search'].oninput()
  assert.ok(dom.elements['#count'].textContent.endsWith(' · 0'))
})
test('HTML missing and invalid timestamps remain exportable', () => {
  for (const value of [undefined, NaN, Infinity, -Infinity, 1e20]) assert.doesNotThrow(() => createFlameGraphHtml({ nodeId: 'node', snapshot: { ...sample, startedAt: value, sampledAt: value } }))
})
test('offline deep graph opens at its root and preserves search/category reading offsets', () => {
  let root = frame('io.rsocket.core.Connection', 10)
  for (let depth = 0; depth < 63; depth++) root = frame(`stack.Frame${depth}`, 10, [root])
  const bundle = buildSync({ entryPoints: [componentPath('flameGraphHtml')], bundle: true, format: 'cjs', platform: 'node', target: 'es2020', minify: true, write: false })
  const module = { exports: {} }; new Function('module', 'exports', bundle.outputFiles[0].text)(module, module.exports)
  const html = module.exports.createFlameGraphHtml({ nodeId: 'node', snapshot: { flameGraph: [root], objectAllocations: [] } })
  const dom = offlineDocument(), observers = []
  vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], { document: dom.document, ResizeObserver: class { constructor(callback) { observers.push(callback) } observe() {} } })
  const chart = dom.elements['#chart']
  dom.elements['.tools'].children.find(button => button['aria-label'] === 'Collapse library calls').onclick()
  assert.equal(chart.scrollTop, 1728 - 480)
  assert.match(chart.innerHTML, /viewBox="0 0 980 1728"/)
  chart.scrollTop -= 180; chart.scrollLeft = 70
  const before = chart.scrollTop
  chart.clientWidth = 1200; observers[0]()
  assert.match(chart.innerHTML, /viewBox="0 0 1200 1728"/)
  assert.equal(chart.scrollTop, before); assert.equal(chart.scrollLeft, 70)
  dom.elements['#search'].value = 'Connection'; dom.elements['#search'].oninput()
  assert.equal(chart.scrollTop, before); assert.equal(chart.scrollLeft, 70)
  dom.elements['#groups'].children[1].onclick()
  assert.equal(chart.scrollTop, before); assert.equal(chart.scrollLeft, 70)
  assert.match(chart.innerHTML, /fill="var\(--flame-network\)"/)
  const focusKey = buildFlameLayout([root]).cells[60].key
  chart.onclick({ type: 'click', preventDefault() {}, target: { closest: selector => selector === '[data-frame-key]' ? { dataset: { frameKey: focusKey }, getAttribute: () => 'focused' } : null } })
  assert.equal(chart.scrollTop, 0); assert.equal(chart.scrollLeft, 0)
  dom.elements['#reset'].onclick()
  assert.equal(chart.scrollTop, 1248)
})

const span = (id, startNanos, endNanos, extra = {}) => ({ id, traceId: 'trace', name: id, startNanos, endNanos, ...extra })
test('trace summary counts observed nodes even with unknown time; exceptions require exact events', () => {
  const rows = traceRows([span('a', '', '', { nodeId: 'node-a', error: true }), span('b', '1790000000000000001', '1790000000100000001', { nodeId: 'node-b', events: [{ name: 'exception', attributes: { 'exception.message': 'failed' } }] }), span('c', 'bad', 'bad', { events: [{ name: 'ExceptionMetric' }] })])
  const summary = summarizeTrace(rows)
  assert.equal(summary.nodes, 2); assert.equal(summary.exceptions, 1); assert.equal(summary.duration, 100)
  assert.equal(exceptionEvents(rows.find(row => row.id === 'a')).length, 0)
  assert.equal(traceBar(rows.find(row => row.id === 'a'), summary), undefined)
})
test('waterfall uses exact relative nanoseconds and collapse keeps malformed roots visible', () => {
  const rows = traceRows([span('root', '1790000000000000001', '1790000000200000001', { nodeId: 'a' }), span('child', '1790000000050000001', '1790000000100000001', { parentId: 'root', nodeId: 'b' }), span('orphan', '', '', { parentId: 'missing' })])
  const root = rows.find(row => row.id === 'root'), child = rows.find(row => row.id === 'child')
  assert.deepEqual(traceBar(child, summarizeTrace(rows)), { left: 25, width: 25 })
  assert.deepEqual(visibleTraceRows(rows, new Set([root.key])).map(row => row.id), ['root', 'orphan'])
  assert.equal(nodeColorIndex('node-a'), nodeColorIndex('node-a'))
})
test('trace time presentation scales exact deltas and rejects malformed dates or reversed durations', () => {
  assert.equal(formatTraceDuration(0.000001), '0.001 µs')
  assert.equal(formatTraceDuration(0.4), '400 µs')
  assert.equal(formatTraceDuration(140), '140 ms')
  assert.equal(formatTraceDuration(2100), '2.1 s')
  assert.equal(formatTraceDuration(0), '0 ms')
  for (const value of [undefined, -1, NaN, Infinity]) assert.equal(formatTraceDuration(value), undefined)
  assert.equal(traceEpochMillis('1790000000000999999'), 1790000000000)
  assert.equal(traceEpochMillis('8640000000000000999999'), 8640000000000000)
  for (const value of ['8640000000000001000000', 'bad', '', '-1', 1790000000000999999]) {
    assert.equal(traceEpochMillis(value), undefined); assert.equal(formatTraceTimestamp(value), undefined)
  }
  assert.ok(formatTraceTimestamp('1790000000000999999', 'en').endsWith('.000'))
  const reversed = traceRows([span('bad', '1790000000100000001', '1790000000000000001')])[0]
  assert.equal(formatTraceDuration(reversed.duration), undefined)
})
test('trace attribute groups preserve unknown fields and long identifiers while formatting only numeric values', () => {
  const identifier = '9223372036854775807', object = { nested: [1, 2] }
  const attributes = { 'http.response.status_code': 503, 'db.system': 'postgresql', 'messaging.operation': 'send', 'thread.id': identifier, 'exception.message': 'failed', custom: object, timeout: 0.0000001 }
  const groups = groupTraceAttributes(attributes)
  assert.deepEqual(groups.map(group => group.key), ['exception', 'network', 'database', 'messaging', 'runtime', 'other'])
  assert.equal(groups.find(group => group.key === 'other').entries.find(entry => entry.key === 'custom').value, object)
  assert.equal(formatTraceAttribute(identifier), identifier)
  assert.equal(formatTraceAttribute(1234567, 'en'), '1,234,567')
  assert.equal(formatTraceAttribute(0.0000001, 'en'), '0.0000001')
  assert.deepEqual(groupTraceAttributes(), [])
})
test('trace attribute groups put declared business context ahead of technical evidence without changing raw values', () => {
  const action = 'device-manager-query', attributes = {
    'flux-next-count': 12,
    'net.peer.ip': '198.51.100.3',
    'user.username': 'operator',
    'request.action': action,
    'request.ip': '192.0.2.5',
    'user.name': 'Operator',
    'client.address': '198.51.100.2',
    custom: { retained: true },
  }
  const groups = groupTraceAttributes(attributes)
  assert.deepEqual(groups.map(group => [group.key, group.entries.map(entry => entry.key)]), [
    ['business', ['request.action', 'user.name', 'user.username', 'request.ip', 'client.address', 'net.peer.ip']],
    ['runtime', ['flux-next-count']],
    ['other', ['custom']],
  ])
  assert.equal(groups[0].entries[0].value, action)
  assert.deepEqual(groups[2].entries[0].value, { retained: true })
})
test('duration labels use inner, following, preceding or separate space without stretching a bar or leaving its track', () => {
  assert.deepEqual(traceDurationLabel({ left: 20, width: 60 }, 400, 56), { left: 86, position: 'inside' })
  assert.deepEqual(traceDurationLabel({ left: 20, width: 0.01 }, 400, 56), { left: 86.04, position: 'after' })
  assert.deepEqual(traceDurationLabel({ left: 99, width: 1 }, 400, 56), { left: 334, position: 'before' })
  assert.deepEqual(traceDurationLabel({ left: 100, width: 0 }, 400, 56), { left: 338, position: 'before' })
  assert.deepEqual(traceDurationLabel({ left: 0, width: 0 }, 400, 56), { left: 6, position: 'after' })
  assert.deepEqual(traceDurationLabel({ left: 25, width: 50 }, 120, 80), { left: 30, position: 'above' })
  for (const axis of [80, 120, 280, 640]) for (const width of [0, 0.000001, 1, 10, 100]) for (const left of [0, 1, 50, 99, 100]) {
    const bar = { left, width: Math.min(width, 100 - left) }, label = traceDurationLabel(bar, axis, 80)
    const start = bar.left / 100 * axis, end = (bar.left + bar.width) / 100 * axis
    assert.notEqual(label.position, 'hidden')
    assert.ok(label.left >= 0 && label.left + 80 <= axis + 0.000001, 'all labels stay inside the time column')
    if (label.position === 'inside') { assert.equal(label.left, start + 6); assert.ok(label.left + 80 <= end - 6 + 0.000001) }
    if (label.position === 'after') assert.ok(label.left >= end + 6 - 0.000001)
    if (label.position === 'before') assert.ok(label.left + 80 <= start - 6 + 0.000001)
  }
  for (const bar of [undefined, { left: NaN, width: 1 }, { left: 0, width: -1 }, { left: 100, width: 2 }]) assert.deepEqual(traceDurationLabel(bar, 300, 80), { left: 0, position: 'hidden' })
  assert.deepEqual(traceDurationLabel({ left: 0, width: 1 }, 0, 80), { left: 0, position: 'hidden' })
})
test('precise timing evidence keeps nanosecond differences without converting epoch values to Number', () => {
  assert.equal(traceNanosecondDelta('1790000000000000001', '1790000000000000002'), '1')
  assert.equal(traceNanosecondDelta('1790000000000000001', '1790000000001032516'), '1032515')
  assert.equal(traceNanosecondDelta('1', '1'), '0')
  for (const pair of [['2', '1'], ['', '1'], ['bad', '1'], [1790000000000000001, '1790000000000000002']]) assert.equal(traceNanosecondDelta(...pair), undefined)
})
test('slow-call navigation ranks inclusive child timing exactly and preserves tree order for ties', () => {
  const start = 1790000000000000001n, timed = (id, nanos, extra = {}) => span(id, String(start), String(start + nanos), extra)
  const rows = traceRows([
    timed('entry', 90071992547410000n),
    timed('rounded-smaller', 9007199254740992n, { parentId: 'entry' }),
    timed('rounded-larger', 9007199254740993n, { parentId: 'entry' }),
    timed('equal-first', 100n, { parentId: 'entry' }),
    timed('equal-second', 100n, { parentId: 'entry' }),
    timed('orphan', 900719925474100000n, { parentId: 'absent' }),
    timed('nested', 20n, { parentId: 'equal-first' }),
    timed('another-entry', 100000n), timed('another-child', 500n, { parentId: 'another-entry' }),
  ])
  const original = rows.map(row => row.key)
  assert.deepEqual(traceSlowCalls(rows).map(row => row.id), ['rounded-larger', 'rounded-smaller', 'another-child', 'equal-first', 'equal-second', 'nested'])
  assert.deepEqual(rows.map(row => row.key), original, 'ranking never changes the shared tree or time-axis order')
})
test('slow-call navigation excludes unknown, zero and unlinked timings while preserving their rows as evidence', () => {
  const rows = traceRows([
    span('entry', '1', '101'), span('zero', '1', '1', { parentId: 'entry' }),
    span('unknown', 'bad', 'bad', { parentId: 'entry' }), span('reversed', '5', '1', { parentId: 'entry' }),
    span('unsafe', 1790000000000000001, '1790000000000000010', { parentId: 'entry' }),
    span('overflow', '1', '9'.repeat(400), { parentId: 'entry' }),
    span('missing', '1', '1001', { parentId: 'absent' }),
    span('duplicate-parent', '1', '10'), span('duplicate-parent', '1', '10'),
    span('ambiguous', '1', '1001', { parentId: 'duplicate-parent' }),
    span('cycle-a', '1', '1001', { parentId: 'cycle-b' }), span('cycle-b', '1', '1001', { parentId: 'cycle-a' }),
    span('self-cycle', '1', '1001', { parentId: 'self-cycle' }),
  ])
  assert.deepEqual(traceSlowCalls(rows), [])
  assert.equal(rows.length, 13, 'navigation does not remove malformed or zero-duration evidence')
  assert.deepEqual(traceSlowCalls(traceRows([span('only', '1', '1001')])), [])
  assert.deepEqual(traceSlowCalls(traceRows([span('entry', '1', '1001'), span('only-child', '1', '501', { parentId: 'entry' })])).map(row => row.id), ['only-child'])
  assert.deepEqual(traceSlowCalls([]), [])
})
test('trace presentation keeps specialized empty guidance and compact, accessible evidence controls', () => {
  const viewer = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/TraceViewer.vue'), 'utf8')
  const details = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/TraceSpanDetails.vue'), 'utf8')
  const waterfall = readFileSync(resolve(root, 'src/components/RuntimeDiagnostics/TraceWaterfall.vue'), 'utf8')
  assert.match(viewer, /runtimeDiagnostics\.noTraceRecords/)
  assert.match(viewer, /runtimeDiagnostics\.noTraceRecordsHint/)
  assert.match(viewer, /InfoCircleOutlined/)
  assert.match(viewer, /searchOpen/)
  assert.match(viewer, /v-if="search"/)
  assert.match(viewer, /@keydown\.esc\.stop\.prevent="closeSearch"/)
  assert.match(viewer, /type="text" size="small" :disabled="!summary\.exceptions"/)
  assert.match(viewer, /<div v-if="rows\.length" class="trace-controls">/)
  assert.match(details, /type="link" size="small"/)
  assert.match(details, /CloseOutlined/)
  assert.match(details, /runtimeDiagnostics\.traceNodeUnavailable/)
  assert.match(waterfall, /RightOutlined : DownOutlined/)
  assert.match(waterfall, /trace-name--selected/)
  assert.match(waterfall, /trace-time--selected/)
})
test('empty TraceViewer renders exactly one real Ant Empty description', async () => {
  const filename = resolve(root, 'src/components/RuntimeDiagnostics/TraceViewer.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const { code } = transformSync(compileScript(descriptor, { id: 'trace-empty-render', inlineTemplate: true }).content, { loader: 'ts', format: 'cjs', target: 'es2020' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ locale: vue.ref('zh-CN'), t: key => ({ 'runtimeDiagnostics.noTraceRecords': '此 Trace ID 暂无链路记录', 'runtimeDiagnostics.noTraceRecordsHint': '请检查 Trace ID 是否正确，或确认已开启链路采集。' })[key] ?? key }) }
    if (id.endsWith('.vue')) return { __esModule: true, default: vue.defineComponent({ setup: (_, { slots }) => () => slots.default?.() }) }
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }, module, module.exports)
  const app = vue.createSSRApp({ render: () => vue.h(module.exports.default, { spans: [], state: { status: 'empty' } }) })
  app.component('a-empty', require('ant-design-vue').Empty)
  const html = await renderToString(app)
  assert.equal((html.match(/class="ant-empty(?:\s|\")/g) ?? []).length, 1)
  assert.match(html, /此 Trace ID 暂无链路记录/)
  assert.match(html, /确认已开启链路采集/)
})
test('direct evidence recognizes platform SQL, exact exception events and explicit HTTP status without guessing', () => {
  const sql = 'select id, name from device where id = ?'
  const platform = span('sql', '1', '2', { attributes: { sql, 'flux-next-count': '1', updated: '2' } })
  assert.deepEqual(traceEvidence(platform), [{ kind: 'database', type: 'sql', text: sql, attributeKey: 'sql' }, { kind: 'runtime', type: 'output', count: 1, attributeKey: 'flux-next-count' }])
  assert.equal(defaultTraceEvidence(platform), 'database')
  assert.deepEqual(groupTraceAttributes(platform.attributes).map(group => [group.key, group.entries.map(entry => entry.key)]), [['database', ['sql', 'updated']], ['runtime', ['flux-next-count']]])
  const failed = { ...platform, attributes: { ...platform.attributes, 'http.response.status_code': 503 }, events: [{ name: 'exception', attributes: { 'exception.type': 'Timeout', 'exception.message': 'timed out', 'exception.stacktrace': 'at org.jetlinks.Service' } }] }
  assert.deepEqual(traceEvidence(failed).map(value => value.type), ['exception', 'sql', 'http']); assert.equal(defaultTraceEvidence(failed), 'exception')
  const http = span('http', '1', '2', { attributes: { uri: 'http://service.local/api', method: 'POST', status: 500, responseHeaders: 'content-type: text/plain' } })
  assert.deepEqual(traceEvidence(http), [{ kind: 'network', type: 'http', text: 'HTTP 500' }])
  assert.deepEqual(groupTraceAttributes(http.attributes).map(group => group.key), ['network'])
  for (const attributes of [{ status: 500 }, { 'exception.message': 'error' }, { sql: { invalid: true } }, { uri: 'custom-resource', method: 'POST', status: 500 }]) {
    const unknown = span('unknown', '1', '2', { error: true, attributes, events: [{ name: 'ExceptionMetric' }] })
    assert.deepEqual(traceEvidence(unknown).map(value => value.type), ['attributes', 'events'])
  }
  for (const value of [-1, NaN, 1.5, '', 'abc', '9007199254740992']) assert.equal(traceEvidence(span('unknown', '1', '2', { attributes: { 'flux-next-count': value } }))[0].type, 'attributes')
  assert.deepEqual(traceEvidence(span('zero', '1', '2', { attributes: { 'flux-next-count': 0 } })), [{ kind: 'runtime', type: 'output', count: 0, attributeKey: 'flux-next-count' }])
})
