import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const cache = new Map()
const load = filename => {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  const imports = id => id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  new Function('require', 'module', 'exports', code)(imports, module, module.exports)
  cache.set(filename, module.exports)
  return module.exports
}
const { useDiagnosticQuery } = load(resolve(root, 'src/hooks/useDiagnosticQuery.ts'))
const { traceRows, nanosBetween, nanosText, runtimeBeanOverview } = load(resolve(root, 'src/components/RuntimeDiagnostics/utils.ts'))
const { registerMBeanRenderer, resolveMBeanRenderer } = load(resolve(root, 'src/components/RuntimeDiagnostics/registry.ts'))
const { supportsMBeanSummary } = load(resolve(root, 'src/components/RuntimeDiagnostics/registry.ts'))
const { mbeanCatalogEntry, compareMBeanDomain, isJetLinksDomain } = load(resolve(root, 'src/components/RuntimeDiagnostics/mbean/catalog.ts'))
const { mbeanInvocationArguments } = load(resolve(root, 'src/components/RuntimeDiagnostics/mbean/arguments.ts'))
const { logHighlight, logPresentation, logTimeLabel, nextLogMatchId } = load(resolve(root, 'src/components/RuntimeDiagnostics/logs/presentation.ts'))
const { bufferHistoryPoints, bufferObjectLabel, bufferTooltipHtml } = load(resolve(root, 'src/components/RuntimeDiagnostics/buffer/history.ts'))
const deferred = () => { let resolve; const promise = new Promise(yes => resolve = yes); return { promise, resolve } }

test('MBean overview keeps identity, unknown counts and failures ahead of ordinary backlog', () => {
  const bean = (domain, type, name, values) => ({ domain, type, name, objectName: `${domain}:type=${type},name=${name}`, operations: [],
    attributes: Object.entries(values).map(([name, value]) => ({ name, value, readable: true, available: true, type: 'long' })) })
  const data = [bean('java.lang', 'Runtime', 'runtime', { StartTime: 1700000000000, Uptime: 120000 }),
    bean('org.jetlinks', 'PersistenceBuffer', 'busy', { Remainder: 5000, DeadSize: 0 }),
    bean('org.jetlinks', 'PersistenceBuffer', 'failed', { Remainder: 3, DeadSize: 2, Wip: -1 }),
    bean('other', 'PersistenceBuffer', 'foreign', { Remainder: 999999, DeadSize: 99 })]
  const view = runtimeBeanOverview(data)
  assert.equal(view.startTime, 1700000000000)
  assert.equal(view.uptime, 120000)
  assert.deepEqual(view.buffers.map(buffer => buffer.name), ['failed', 'busy'])
  assert.equal(view.buffers[0].wip, undefined)
  assert.equal(view.buffers[0].writerPending, undefined)
  assert.equal(supportsMBeanSummary(data[3]), false)
  assert.equal(supportsMBeanSummary(bean('org.jetlinks', 'ReactiveSqlExecutor', 'sql', { PendingSize: 8 })), true)
})

test('PersistenceBuffer nil sentinel clears the error while preserving real error text', () => {
  const overview = lastError => runtimeBeanOverview([{
    domain: 'org.jetlinks', type: 'PersistenceBuffer', name: 'buffer', objectName: 'org.jetlinks:type=PersistenceBuffer,name=buffer', operations: [],
    attributes: [{ name: 'LastError', value: lastError, readable: true, available: true, type: 'java.lang.String' }],
  }]).buffers[0]
  for (const value of ['nil', '  nil\n', '', '  ']) assert.equal(overview(value).error, '')
  for (const value of [null, undefined]) assert.equal(overview(value).error, undefined)
  const error = 'Connection refused\n\tat buffer.Writer.flush(Writer.java:42)\n'
  assert.equal(overview(error).error, error)
  assert.equal(overview('NIL').error, 'NIL')
})

test('node switch and disposal invalidate late responses and signal cancellation', async () => {
  const scope = vue.effectScope()
  const query = scope.run(() => useDiagnosticQuery())
  const first = deferred(); let signal
  const old = query.run(value => { signal = value; return first.promise }, true)
  await query.run(async () => 'node-b', true)
  assert.equal(signal.aborted, true)
  first.resolve('node-a'); await old
  assert.equal(query.data.value, 'node-b')
  const last = deferred(); const pending = query.run(() => last.promise, true)
  scope.stop(); last.resolve('after-unmount'); await pending
  assert.equal(query.data.value, undefined)
})
test('denied actions never call transport and remove old data', async () => {
  const scope = vue.effectScope(); const query = scope.run(() => useDiagnosticQuery())
  await query.run(async () => 'sensitive', true)
  let calls = 0
  await query.run(async () => { calls++; return 'forbidden' }, false)
  assert.equal(calls, 0); assert.equal(query.data.value, undefined); assert.equal(query.state.value.status, 'forbidden'); scope.stop()
})
test('host classifies empty and transport failures without leaking previous query data', async () => {
  const scope = vue.effectScope(); const query = scope.run(() => useDiagnosticQuery())
  await query.run(async () => [], true, { isEmpty: value => !value.length })
  assert.equal(query.state.value.status, 'empty')
  assert.deepEqual(query.data.value, [])
  const forbidden = new Error('forbidden')
  await query.run(async () => { throw forbidden }, true, { errorState: error => ({ status: error === forbidden ? 'forbidden' : 'error' }) })
  assert.equal(query.state.value.status, 'forbidden')
  assert.equal(query.data.value, undefined)
  query.clear({ status: 'unsupported', message: 'missing capability' })
  assert.equal(query.state.value.status, 'unsupported')
  scope.stop()
})
test('nanoseconds preserve exact text and reject unsafe numeric timestamps', () => {
  assert.equal(nanosText(1790000000000000001), undefined)
  assert.equal(nanosText(1790000000000000001, '1790000000000000001'), '1790000000000000001')
  assert.equal(nanosText(1234), '1234')
  assert.equal(nanosText(1234n), '1234')
  assert.equal(nanosText(' 001234 '), '001234')
  for (const value of ['', ' ', '-1', '1.2', '1e3', NaN, Infinity, -1, null, undefined]) assert.equal(nanosText(value), undefined)
})
test('nanosecond differences and orphan/cyclic spans remain visible', () => {
  assert.equal(nanosBetween('1790000000000000001', '1790000000000000101'), 0.0001)
  assert.equal(nanosBetween('bad', '3'), undefined)
  assert.equal(nanosBetween('4', '3'), undefined)
  const span = (id, parentId, nodeId = 'a') => ({ id, parentId, nodeId, name: id, traceId: 'trace', startNanos: '1', endNanos: '5' })
  const rows = traceRows([span('a', 'b'), span('b', 'a'), span('orphan', 'missing'), span('orphan', 'missing')])
  assert.equal(rows.length, 4)
  assert.equal(new Set(rows.map(row => row.key)).size, 4)
  assert.ok(rows.filter(row => row.id === 'orphan').every(row => row.missingParent && row.duplicate))
  assert.ok(rows.filter(row => ['a', 'b'].includes(row.id)).every(row => row.cyclic && row.depth === 0 && !row.parentKey))
})
test('trace tree attaches across nodes but refuses ambiguous parent ids', () => {
  const span = (id, parentId, nodeId, startNanos = '1') => ({ id, parentId, nodeId, name: id, traceId: 'trace', startNanos, endNanos: '10' })
  const rows = traceRows([span('child', 'parent', 'b', '2'), span('parent', undefined, 'a')])
  assert.deepEqual(rows.map(row => row.id), ['parent', 'child'])
  assert.equal(rows[1].parentKey, rows[0].key)
  assert.equal(rows[1].depth, 1)
  const conflict = traceRows([span('parent', undefined, 'a'), span('parent', undefined, 'b'), span('child', 'parent', 'c')])
  assert.equal(conflict.find(row => row.id === 'child').ambiguousParent, true)
  assert.equal(conflict.find(row => row.id === 'child').parentKey, undefined)
  assert.deepEqual(conflict.map(row => row.key), traceRows([span('parent', undefined, 'a'), span('parent', undefined, 'b'), span('child', 'parent', 'c')]).map(row => row.key))
})
test('unknown times, root sentinel and deeply nested spans stay readable', () => {
  const spans = Array.from({ length: 2000 }, (_, index) => ({ id: String(index + 1), parentId: String(index), name: String(index), traceId: 'deep', startNanos: '', endNanos: 'bad' }))
  const rows = traceRows(spans)
  assert.equal(rows.length, 2000)
  assert.equal(rows[0].missingParent, false)
  assert.equal(rows.at(-1).depth, 1999)
  assert.ok(rows.every(row => row.duration === undefined))
  assert.equal(nanosBetween('', '3'), undefined)
  assert.equal(nanosBetween('1', '9'.repeat(400)), undefined)
})
test('renderer registration falls back after matcher errors and supports disposal', () => {
  const good = {}; const removeGood = registerMBeanRenderer({ id: 'good', component: good, match: () => true })
  const removeBad = registerMBeanRenderer({ id: 'bad', component: {}, match: () => { throw new Error('version mismatch') } })
  assert.equal(resolveMBeanRenderer({}), good)
  removeGood(); removeBad(); assert.equal(resolveMBeanRenderer({}), undefined)
})
test('MBean catalog matches exact domain and type and keeps the JetLinks family first', () => {
  assert.ok(mbeanCatalogEntry({ domain: 'org.jetlinks', type: 'PersistenceBuffer' }))
  assert.equal(mbeanCatalogEntry({ domain: 'other', type: 'PersistenceBuffer' }), undefined)
  assert.ok(mbeanCatalogEntry({ domain: 'org.jetlinks.pro.event.delivery', type: 'EventDeliveryManager' }))
  assert.equal(mbeanCatalogEntry({ domain: 'org.jetlinks', type: 'EventDeliveryManager' }), undefined)
  assert.equal(isJetLinksDomain('org.jetlinks-copy'), false)
  assert.deepEqual(['other', 'java.lang', 'org.jetlinks.pro.event.delivery', 'org.jetlinks'].sort(compareMBeanDomain), ['org.jetlinks', 'org.jetlinks.pro.event.delivery', 'java.lang', 'other'])
})
test('replacement renderer cleanup cannot remove its newer registration', () => {
  const previous = {}, current = {}
  const disposePrevious = registerMBeanRenderer({ id: 'same', match: () => true, component: previous })
  const disposeCurrent = registerMBeanRenderer({ id: 'same', match: () => true, component: current })
  disposePrevious()
  assert.equal(resolveMBeanRenderer({}), current)
  disposeCurrent()
  assert.equal(resolveMBeanRenderer({}), undefined)
})
test('MBean arguments preserve signature order, duplicate names and long integer text', () => {
  const operation = { name: 'test', signature: ['long', 'java.lang.String', 'java.util.Map'], returnType: 'void', parameters: [{ name: 'value', type: 'long' }, { name: 'value', type: 'java.lang.String' }, { name: 'options', type: 'java.util.Map' }] }
  assert.deepEqual(mbeanInvocationArguments(operation, ['9223372036854775807', '', '{"enabled":true}']), [
    { name: 'value', value: '9223372036854775807' }, { name: 'value', value: '' }, { name: 'options', value: { enabled: true } },
  ])
  assert.throws(() => mbeanInvocationArguments(operation, [undefined, '', '{}']), /required/)
  assert.throws(() => mbeanInvocationArguments(operation, ['1', '', '{bad}']))
})
test('log highlighting is literal and preserves script-like and multiline evidence', () => {
  const text = '<script>throw new Error("a.b")</script> a.b'
  const parts = logHighlight(text, 'a.b')
  assert.equal(parts.filter(part => part.match).length, 2)
  assert.equal(parts.map(part => part.text).join(''), text)
  assert.deepEqual(logHighlight('a[A]a', '[A]'), [{ text: 'a', match: false }, { text: '[A]', match: true }, { text: 'a', match: false }])
  const unknown = { id: '1', text: 'unknown text\n  more unknown text' }
  assert.deepEqual(logPresentation(unknown), { raw: unknown.text, message: unknown.text, stack: '' }, 'ordinary newlines are message content, not evidence of a Java exception')
  assert.deepEqual(logPresentation({ id: '2', text: 'prefix msg\nstack', message: 'msg', stack: 'stack', raw: 'original' }), { raw: 'original', message: 'msg', stack: 'stack' })
})
test('log time gutter shortens only explicit date-time values and retains unknown text', () => {
  assert.equal(logTimeLabel('2026-10-22T19:50:14.588+08:00'), '19:50:14.588')
  assert.equal(logTimeLabel('2026-10-22 19:50:14,588'), '19:50:14,588')
  assert.equal(logTimeLabel('2026-10-22T19:50:14Z'), '19:50:14')
  assert.equal(logTimeLabel('19:50:14 custom'), '19:50:14 custom')
  assert.equal(logTimeLabel('invalid time'), 'invalid time')
})
test('log match navigation starts at the correct end and loops across changed windows', () => {
  const entries = ['first', 'middle', 'last'].map(id => ({ id }))
  assert.equal(nextLogMatchId(entries, '', -1), 'last')
  assert.equal(nextLogMatchId(entries, '', 1), 'first')
  assert.equal(nextLogMatchId(entries, 'first', -1), 'last')
  assert.equal(nextLogMatchId(entries, 'last', 1), 'first')
  assert.equal(nextLogMatchId(entries, 'last', -1), 'middle')
  assert.equal(nextLogMatchId(entries, 'removed', -1), 'last')
  assert.equal(nextLogMatchId([{ id: 'only' }], 'only', -1), 'only')
  assert.equal(nextLogMatchId([], 'removed', 1), '')
})
test('Buffer trends retain actual zeroes and gaps for missing queues or fields', () => {
  const points = bufferHistoryPoints([
    { sampledAt: 1000, buffers: [{ objectName: 'a', pending: 3, dead: 0 }, { objectName: 'b', pending: 2, dead: 1 }] },
    { sampledAt: 2000, buffers: [{ objectName: 'a', pending: 1, dead: 0 }] },
    { sampledAt: 3000, buffers: [{ objectName: 'a', pending: 0, dead: 0 }, { objectName: 'b', pending: 0 }] },
    { sampledAt: 4000, buffers: [{ objectName: 'a', pending: 0, dead: 0 }, { objectName: 'b', pending: 0, dead: 0 }] },
  ])
  assert.deepEqual(points, [
    { sampledAt: 1000, pending: 5, dead: 1 },
    { sampledAt: 2000, pending: undefined, dead: undefined },
    { sampledAt: 3000, pending: 0, dead: undefined },
    { sampledAt: 4000, pending: 0, dead: 0 },
  ])
})
test('Buffer history sorts and replaces real timestamps within the last five minutes', () => {
  const sample = (sampledAt, pending, objectName = 'a') => ({ sampledAt, buffers: [{ objectName, pending, dead: 0 }] })
  assert.deepEqual(bufferHistoryPoints([sample(400000, 4), sample(1, 99, 'expired'), sample(200000, 2), sample(400000, 3), sample(NaN, 5)]), [
    { sampledAt: 200000, pending: 2, dead: 0 }, { sampledAt: 400000, pending: 3, dead: 0 },
  ])
  assert.deepEqual(bufferHistoryPoints([sample(1000, -1), sample(2000, Infinity)]).map(point => point.pending), [undefined, undefined])
  assert.deepEqual(bufferHistoryPoints([{ sampledAt: 1000, buffers: [] }]), [{ sampledAt: 1000, pending: undefined, dead: undefined }])
  assert.deepEqual(bufferHistoryPoints([]), [])
})
test('Buffer tooltip lists every observed queue at the hovered sample without inventing values', () => {
  const history = [
    { sampledAt: 1000, buffers: [{ objectName: 'org.jetlinks:name=present,type=PersistenceBuffer', pending: 0, dead: 2 }] },
    { sampledAt: 2000, buffers: [{ objectName: 'org.jetlinks:name=present,type=PersistenceBuffer', pending: 3 }, { objectName: 'org.jetlinks:name=missing,type=PersistenceBuffer', pending: 9, dead: 0 }] },
  ]
  const labels = { queue: 'Queue', pending: 'Pending', dead: 'Failed', items: 'items' }
  const html = bufferTooltipHtml(history, 1000, labels)
  assert.match(html, />present<.*>0 items<.*>2 items</)
  assert.match(html, />missing<.*>—<.*>—</)
  assert.doesNotMatch(html, /9 items/)
  assert.match(bufferTooltipHtml(history, 2000, labels), />3 items<.*>—</)
  assert.equal(bufferTooltipHtml(history, 3000, labels), '')
})
test('Buffer ObjectName labels and HTML tooltip keep quoted identities safe', () => {
  assert.equal(bufferObjectLabel('org.jetlinks:name="one,two",type=PersistenceBuffer'), 'one,two')
  assert.equal(bufferObjectLabel('org.jetlinks:type=PersistenceBuffer,name="a\\"b"'), 'a"b')
  assert.equal(bufferObjectLabel('org.jetlinks:type=PersistenceBuffer'), 'org.jetlinks:type=PersistenceBuffer')
  const objectName = 'org.jetlinks:name="<img src=x onerror=alert(1)>",type=PersistenceBuffer'
  const html = bufferTooltipHtml([{ sampledAt: 1000, buffers: [{ objectName, pending: 1, dead: 0 }] }], 1000, { queue: '<Queue>', pending: 'Pending', dead: 'Failed', items: '<items>' })
  assert.doesNotMatch(html, /<img|<Queue>|<items>/)
  assert.match(html, /&lt;img/)
  assert.match(html, /&quot;&lt;img/)
  assert.match(html, /1 &lt;items&gt;/)
})
