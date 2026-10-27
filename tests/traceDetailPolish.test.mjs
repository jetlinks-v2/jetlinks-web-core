import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '..')
const directory = resolve(root, 'src/components/RuntimeDiagnostics')
const helpFile = resolve(root, '../modules/device-manager-ui/views/link/Tracing/TraceInputHelp.vue')
const dictionaries = ['zh', 'en'].map(lang => ({
  ...JSON.parse(readFileSync(resolve(root, `src/locales/lang/${lang}.json`), 'utf8')),
  ...JSON.parse(readFileSync(resolve(root, `../modules/device-manager-ui/locales/lang/${lang}.json`), 'utf8')),
}))
const cache = new Map()
function load(filename, inlineTemplate = false) {
  const cacheKey = `${filename}:${inlineTemplate}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  const source = readFileSync(filename, 'utf8')
  const content = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'trace-detail-test', inlineTemplate }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(content, { loader: 'ts', format: 'cjs', target: 'es2020' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ locale: vue.ref('zh-CN'), t: (key, args = {}) => (dictionaries[0][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => args[name] ?? `{${name}}`) }) }
    if (id.startsWith('.')) { const file = resolve(dirname(filename), id); return load(existsSync(file) ? file : `${file}.ts`, inlineTemplate) }
    return require(id)
  }, module, module.exports)
  cache.set(cacheKey, module.exports)
  return module.exports
}
const runtime = load(resolve(directory, 'tracePresentation.ts')), { traceRows } = load(resolve(directory, 'utils.ts'))
const span = (attributes = {}, events = []) => ({ id: '2222222222222222', traceId: '11111111111111111111111111111111', name: '/java/Example/query', nodeId: 'service:8200', startNanos: '1790000000000000001', endNanos: '1790000000000100001', attributes, events })
const values = { 'request.action': '示例管理-查询', 'user.name': '示例用户', 'user.username': 'example', 'request.ip': '192.0.2.4', 'user.id': 'private-user-id', token: 'private-token', 'flux-next-count': 1 }
const flush = async () => { await vue.nextTick(); await vue.nextTick() }

const table = vue.defineComponent({
  props: ['columns', 'dataSource', 'customRow', 'expandedRowKeys'],
  setup(props, { slots }) { return () => vue.h('table', {}, [vue.h('thead', {}, vue.h('tr', {}, props.columns.map(column => vue.h('th', {}, slots.headerCell?.({ column }) ?? column.title)))), vue.h('tbody', {}, props.dataSource.flatMap(record => [vue.h('tr', props.customRow?.(record), props.columns.map(column => vue.h('td', {}, slots.bodyCell?.({ column, record })))), ...(props.expandedRowKeys?.includes(record.key) ? [vue.h('tr', {}, vue.h('td', {}, slots.expandedRowRender?.({ record })))] : [])]))]) },
})
const wrapper = (tag = 'span') => vue.defineComponent({ setup(_, { slots, attrs }) { return () => vue.h(tag, attrs, slots.default?.()) } })
const typography = vue.defineComponent({ props: ['copyable'], setup(props, { slots }) { return () => vue.h('span', { 'data-copy-text': props.copyable?.text }, slots.default?.()) } })
const popover = vue.defineComponent({ setup(_, { slots }) { return () => vue.h('aside', {}, [slots.default?.(), slots.title?.(), slots.content?.()]) } })
function appFor(component, props = {}) {
  const app = vue.createSSRApp({ render: () => vue.h(component, props) })
  return configure(app)
}
function configure(app, tooltip = wrapper()) {
  for (const name of ['a-spin', 'a-space', 'a-tag', 'a-collapse', 'a-collapse-panel', 'a-descriptions', 'a-descriptions-item']) app.component(name, wrapper('div'))
  for (const name of ['a-button', 'a-input-search']) app.component(name, wrapper('button'))
  for (const name of ['a-empty', 'a-result', 'a-alert', 'AIcon']) app.component(name, wrapper())
  app.component('a-table', table); app.component('a-tooltip', tooltip); app.component('a-popover', popover); app.component('a-typography-text', typography)
  return app
}
async function rendered(name, props = {}) { return renderToString(appFor(load(resolve(directory, name), true).default, props)) }
function setup(name, initial) {
  const props = vue.reactive(initial), events = [], scope = vue.effectScope()
  const view = scope.run(() => load(resolve(directory, name)).default.setup(props, { expose() {}, emit: (...args) => events.push(args) }))
  return { props, view, events, stop: () => scope.stop() }
}

test('context summaries use declared fields, combine and deduplicate actors, omit missing and private values', () => {
  assert.deepEqual(runtime.traceContextSummary(span(values)), [
    { type: 'action', text: '示例管理-查询', attributeKey: 'request.action', shortText: '查询' },
    { type: 'actor', text: '示例用户 (example)', attributeKey: 'user.name', shortText: '示例用户' },
    { type: 'sourceIp', text: '192.0.2.4', attributeKey: 'request.ip' },
  ])
  assert.deepEqual(runtime.traceContextSummary(span({ 'user.name': ' example ', 'user.username': 'example' })), [{ type: 'actor', text: 'example', attributeKey: 'user.name' }])
  assert.deepEqual(runtime.traceContextSummary(span({ 'user.id': 'id', token: 'secret', 'request.action': {}, 'request.ip': ' ' })), [])
  assert.equal(runtime.traceContextSummary(span({ 'client.address': '192.0.2.8' }))[0].attributeKey, 'client.address')
  assert.equal(runtime.traceContextSummary(span({ 'request.action': '示例应用-示例目录-查询项目列表（分页）' }))[0].shortText, '查询项目列表（分页）', 'multilevel action names retain the final operation')
  for (const action of ['查询项目列表', '示例应用--查询', '示例应用-']) assert.equal(runtime.traceContextSummary(span({ 'request.action': action }))[0].shortText, undefined, 'unsplit or incomplete action names remain unchanged')
  const long = runtime.traceContextSummary(span({ 'request.action': 'x'.repeat(1000) }))[0]
  assert.equal(long.text.length, 97); assert.equal(long.attributeKey, 'request.action')
})

test('production waterfall renders readable context and existing evidence, while escaping untrusted values', async () => {
  const hostile = '<img src=x onerror=alert(1)>'
  const rows = traceRows([span({ ...values, 'request.action': hostile, 'http.response.status_code': 503 }, [{ name: 'exception', attributes: { 'exception.message': 'example failure' } }])])
  const html = await rendered('TraceWaterfall.vue', { rows, allRows: rows, summary: runtime.summarizeTrace(rows), collapsed: new Set(), matchedKeys: new Set() })
  assert.match(html, /service:8200/); assert.match(html, /示例用户 \(example\)/); assert.match(html, /192.0.2.4/)
  assert.match(html, /输出 1 项/); assert.match(html, /HTTP 503/); assert.match(html, /example failure/)
  assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<img')); assert.ok(!html.includes('private-token')); assert.ok(!html.includes('private-user-id'))
  assert.match(html, /trace-meta/); assert.ok(!html.includes('trace-context')); assert.ok(!html.includes('trace-evidence'))
  assert.ok(html.indexOf('trace-summary-item--exception') < html.indexOf('trace-summary-item--action'))
  const visibleText = html.replace(/<[^>]+>/g, '')
  assert.ok(!visibleText.includes('示例用户 (example)')); assert.ok(visibleText.includes('示例用户'))
  assert.ok(!visibleText.includes('输出 1 项')); assert.ok(html.includes('aria-label="输出 1 项"'))
  assert.match(html, /<svg/)
  const longAction = '完整动作'.repeat(70)
  const longRows = traceRows([span({ 'request.action': longAction })])
  const longHtml = await rendered('TraceWaterfall.vue', { rows: longRows, allRows: longRows, summary: runtime.summarizeTrace(longRows), collapsed: new Set(), matchedKeys: new Set() })
  assert.ok(longHtml.includes(`aria-label="动作: ${longAction}"`))
  const empty = traceRows([span()]); delete empty[0].nodeId
  const emptyHtml = await rendered('TraceWaterfall.vue', { rows: empty, allRows: empty, summary: runtime.summarizeTrace(empty), collapsed: new Set(), matchedKeys: new Set() })
  assert.ok(!emptyHtml.includes('trace-summary-item')); assert.ok(!emptyHtml.includes('未知节点'))
  const fullAction = '示例应用-项目管理-查询项目列表（分页）', operation = '/java/ExampleProjectController/queryProjectPaging', service = 'visualization-service:7510'
  const project = traceRows([{ ...span({ 'request.action': fullAction }), name: operation, nodeId: service }])
  const projectHtml = await rendered('TraceWaterfall.vue', { rows: project, allRows: project, summary: runtime.summarizeTrace(project), collapsed: new Set(), matchedKeys: new Set() })
  assert.ok(projectHtml.includes(`title="${operation}"`)); assert.ok(projectHtml.includes(`title="${service}"`))
  assert.ok(projectHtml.includes(`aria-label="动作: ${fullAction}"`)); assert.ok(projectHtml.includes('>查询项目列表（分页）</span>'))
  const { descriptor } = parse(readFileSync(resolve(directory, 'TraceWaterfall.vue'), 'utf8'))
  assert.match(descriptor.styles[0].content, /\.trace-name\s*\{[^}]*overflow:hidden;[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/)
  assert.match(descriptor.styles[0].content, /\.trace-name--selected\s*\{[^}]*white-space:normal;[^}]*overflow-wrap:anywhere;/)
  assert.match(descriptor.styles[0].content, /\.trace-time--selected \.trace-bar\s*\{[^}]*top:10px;/)
  assert.match(descriptor.styles[0].content, /\.trace-node\s*\{[^}]*max-width:min\(28ch,100%\)/)
})

test('production viewer forwards summary selection to its precise original attribute without losing revision', async () => {
  const rows = traceRows([span(values)]), h = setup('TraceViewer.vue', { active: false, spans: rows, selectedId: '', state: { status: 'ready' }, logAccess: { allowed: false }, nodeAccess: { allowed: false } })
  try {
    h.view.choose(rows[0], 'attributes', 'request.action')
    assert.equal(h.view.detailFocus.value.attributeKey, 'request.action'); assert.equal(h.events.at(-1)[0], 'select')
    const first = h.view.detailFocus.value.revision
    h.view.choose(rows[0], 'attributes', 'request.ip')
    assert.equal(h.view.detailFocus.value.attributeKey, 'request.ip'); assert.ok(h.view.detailFocus.value.revision > first)
    h.view.choose(traceRows([span({ sql: 'select '.repeat(60) })])[0], 'database')
    assert.equal(h.view.detailFocus.value.attributeKey, 'sql', 'long SQL still opens directly from its evidence button')
    await flush()
  } finally { h.stop() }
})

const collectNodes = target => [target, ...target.children.flatMap(collectNodes)]
function renderHarness(t) {
  const originals = { document: globalThis.document, ResizeObserver: globalThis.ResizeObserver, getComputedStyle: globalThis.getComputedStyle }
  const observers = []
  globalThis.document = { createElement: () => ({ getContext: () => null }) }
  globalThis.ResizeObserver = class { constructor(callback) { observers.push(callback) } observe() {} disconnect() {} }
  globalThis.getComputedStyle = () => ({ fontSize: '12px', fontFamily: 'sans-serif' })
  t.after(() => Object.assign(globalThis, originals))
  const node = (tag, text = '') => ({
    tag, text, children: [], props: {}, clientWidth: 500, scrollTop: 0,
    get dataset() { return Object.fromEntries(Object.entries(this.props).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase()), value])) },
    getBoundingClientRect: () => ({ top: 0 }), scrollIntoView() {},
    querySelectorAll(selector) { const key = selector.includes('[data-trace-attribute]') ? 'data-trace-attribute' : selector.includes('[data-span-key]') ? 'data-span-key' : undefined; return key ? collectNodes(this).filter(item => item.props[key] !== undefined) : [] },
    querySelector() { return undefined },
  })
  const renderer = vue.createRenderer({
    createElement: tag => node(tag), createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
    patchProp: (target, key, _, value) => { target.props[key] = value }, parentNode: target => target.parent,
    nextSibling: target => { const siblings = target.parent?.children ?? []; return siblings[siblings.indexOf(target) + 1] },
    insert: (target, parent, anchor) => { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, target); target.parent = parent },
    remove: target => { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1) },
  })
  return { renderer, container: node('root'), observers }
}

test('the production waterfall summary button emits its exact attribute target from the compiled template', async t => {
  const { renderer, container } = renderHarness(t)
  const rows = traceRows([span(values)]), events = []
  const app = configure(renderer.createApp(load(resolve(directory, 'TraceWaterfall.vue'), true).default, { rows, allRows: rows, summary: runtime.summarizeTrace(rows), collapsed: new Set(), matchedKeys: new Set(), onEvidence: (...args) => events.push(args) }))
  app.mount(container)
  try {
    const action = collectNodes(container).find(target => target.tag === 'button' && target.props['aria-label'] === '动作: 示例管理-查询')
    assert.ok(action)
    action.props.onClick({ stopPropagation() {} })
    assert.equal(events.length, 1); assert.equal(events[0][0].key, rows[0].key); assert.equal(events[0][1], 'attributes'); assert.equal(events[0][2], 'request.action')
    assert.ok(!events.some(event => event[0] === 'toggle'))
    await flush()
  } finally { app.unmount() }
})

test('the mounted production waterfall displays short-span durations inside its track and keeps exact bar geometry', async t => {
  const { renderer, container, observers } = renderHarness(t)
  const rows = traceRows([
    { ...span(), id: 'root', startNanos: '1', endNanos: '1000001' },
    { ...span(), id: 'early', parentId: 'root', startNanos: '1001', endNanos: '2001' },
    { ...span(), id: 'late', parentId: 'root', startNanos: '999001', endNanos: '1000001' },
    { ...span(), id: 'zero', parentId: 'root', startNanos: '500001', endNanos: '500001' },
    { ...span(), id: 'middle', parentId: 'root', startNanos: '250001', endNanos: '650001' },
  ])
  const current = vue.ref(rows), waterfall = load(resolve(directory, 'TraceWaterfall.vue'), true).default
  const app = configure(renderer.createApp({ render: () => vue.h(waterfall, { rows: current.value, allRows: current.value, summary: runtime.summarizeTrace(current.value), collapsed: new Set(), matchedKeys: new Set() }) }))
  app.mount(container)
  try {
    await flush()
    const labels = collectNodes(container).filter(target => target.props.class === 'trace-time-text')
    assert.equal(labels.length, 5, 'short and zero-duration spans remain readable beside their bars')
    assert.equal(labels.filter(target => target.text === '1 µs').length, 2)
    assert.ok(labels.some(target => target.text === '0 ms'))
    for (const label of labels) assert.ok(parseFloat(label.props.style.left) >= 0 && parseFloat(label.props.style.left) + label.text.length * 7 <= 500)
    const bars = collectNodes(container).filter(target => target.props.class === 'trace-bar')
    assert.equal(bars[0].props.style.width, '100%')
    assert.ok(bars.some(target => target.props.style.width === '0.1%')); assert.ok(bars.some(target => target.props.style.left === '99.9%'))
    assert.ok(bars.some(target => target.props.style.width === '0%'))
    collectNodes(container).find(target => target.props.class === 'trace-axis').clientWidth = 84
    observers.forEach(callback => callback()); await flush()
    const narrow = collectNodes(container).filter(target => target.props.class === 'trace-time-text')
    assert.equal(narrow.length, 5)
    for (const label of narrow) assert.ok(parseFloat(label.props.style.left) >= 0 && parseFloat(label.props.style.left) + label.text.length * 7 <= 84)
    assert.ok(collectNodes(container).some(target => String(target.props.class).includes('trace-time--stacked')), 'crowded labels use a separate layer inside the track')
    current.value = traceRows([{ ...span(), id: 'all-zero', startNanos: '1', endNanos: '1' }]); await flush()
    const allZero = collectNodes(container).filter(target => target.props.class === 'trace-time-text')
    assert.equal(allZero.length, 1); assert.equal(allZero[0].text, '0 ms')
    assert.equal(collectNodes(container).find(target => target.props.class === 'trace-bar').props.style.width, '0%')
  } finally { app.unmount() }
})

test('repeated real summary and SQL clicks reopen the same manually collapsed long field through the full viewer', async t => {
  const { renderer, container } = renderHarness(t), selectedId = vue.ref('')
  const source = span({ ...values, 'request.action': '示例操作'.repeat(60), sql: 'select example from synthetic_table where '.repeat(8) })
  const viewer = load(resolve(directory, 'TraceViewer.vue'), true).default
  const app = configure(renderer.createApp({ render: () => vue.h(viewer, { active: true, spans: [source], selectedId: selectedId.value, onSelect: row => { selectedId.value = row?.key ?? '' } }) }))
  app.mount(container)
  try {
    for (const [key, label] of [['request.action', '动作: '], ['sql', 'SQL · ']]) {
      const summary = () => collectNodes(container).find(target => target.tag === 'button' && target.props['aria-label']?.startsWith(label))
      const detail = () => collectNodes(container).find(target => target.props['data-trace-attribute'] === key)
      const expanded = () => collectNodes(detail()).some(target => target.tag === 'pre')
      summary().props.onClick({ stopPropagation() {} }); await flush()
      assert.ok(expanded(), `${key} opens on the first summary click`)
      collectNodes(detail()).find(target => target.tag === 'button').props.onClick(); await flush()
      assert.ok(!expanded(), `${key} remains manually collapsible`)
      summary().props.onClick({ stopPropagation() {} }); await flush()
      assert.ok(expanded(), `${key} opens again when the same outer summary is clicked`)
    }
  } finally { app.unmount() }
})

test('a production output summary opens and highlights its exact technical attribute through the viewer chain', async t => {
  const { renderer, container } = renderHarness(t), selectedId = vue.ref('')
  const viewer = load(resolve(directory, 'TraceViewer.vue'), true).default
  const app = configure(renderer.createApp({ render: () => vue.h(viewer, { active: true, spans: [span({ 'flux-next-count': 1 })], selectedId: selectedId.value, onSelect: row => { selectedId.value = row?.key ?? '' } }) }))
  app.mount(container)
  try {
    const output = collectNodes(container).find(target => target.tag === 'button' && target.props['aria-label'] === '输出 1 项')
    output.props.onClick({ stopPropagation() {} }); await flush()
    assert.ok(selectedId.value)
    assert.equal(collectNodes(container).find(target => target.props['data-trace-group'] === 'runtime').props.open, true)
    assert.ok(collectNodes(container).find(target => target.props['data-trace-attribute'] === 'flux-next-count').props.class.includes('trace-attribute-focused'))
  } finally { app.unmount() }
})

const nodeText = target => `${target.text}${target.children.map(nodeText).join('')}`
test('the mounted viewer cycles slow children, reveals only ancestors, and keeps search and exception navigation independent', async t => {
  const { renderer, container } = renderHarness(t), selectedId = vue.ref('')
  const timed = (id, nanos, extra = {}) => ({ ...span(), id, name: id, startNanos: '1', endNanos: String(1 + nanos), ...extra })
  const spans = [timed('entry', 100000000, { events: [{ name: 'exception', attributes: { 'exception.message': 'recorded entry failure' } }] }),
    timed('first', 50000000, { parentId: 'entry' }), timed('nested', 40000000, { parentId: 'first' }),
    timed('other', 10000000, { parentId: 'entry' }), timed('other-child', 1000000, { parentId: 'other' }),
    timed('orphan', 900000000, { parentId: 'absent' })]
  const viewer = load(resolve(directory, 'TraceViewer.vue'), true).default
  const app = configure(renderer.createApp({ render: () => vue.h(viewer, { active: true, spans, selectedId: selectedId.value, onSelect: row => { selectedId.value = row?.key ?? '' } }) }))
  const button = label => collectNodes(container).find(target => target.tag === 'button' && nodeText(target) === label)
  const row = id => collectNodes(container).find(target => target.props['data-span-key'] === `service:8200:${id}`)
  app.mount(container)
  try {
    button(dictionaries[0]['runtimeDiagnostics.collapseAll']).props.onClick(); await flush()
    assert.ok(!row('first')); assert.ok(row('orphan'))
    collectNodes(container).find(target => target.tag === 'button' && target.props['aria-label'] === dictionaries[0]['runtimeDiagnostics.traceFind']).props.onClick(); await flush()
    const input = collectNodes(container).find(target => target.props.placeholder === dictionaries[0]['runtimeDiagnostics.traceFind'])
    input.props['onUpdate:value']('orphan'); await flush()
    const slowLabel = dictionaries[0]['runtimeDiagnostics.traceSlowCalls']
    button(slowLabel).props.onClick(); await flush()
    assert.equal(selectedId.value, 'service:8200:first'); assert.ok(row('first')); assert.ok(!row('nested')); assert.ok(!row('other-child'))
    button(slowLabel).props.onClick(); await flush()
    assert.equal(selectedId.value, 'service:8200:nested'); assert.ok(row('nested')); assert.ok(!row('other-child'))
    assert.equal(input.props.value, 'orphan', 'slow-call navigation keeps the local search value')
    assert.ok(row('orphan').props.class.includes('trace-row-match'), 'search still highlights the same row without filtering timing candidates')
    button(dictionaries[0]['runtimeDiagnostics.nextException']).props.onClick(); await flush()
    assert.equal(selectedId.value, 'service:8200:entry', 'the independent exception action can still select an entry call')
    button(slowLabel).props.onClick(); await flush()
    assert.equal(selectedId.value, 'service:8200:first', 'starting from a root resets the cycle to the longest child')
    row('first').props.onClick(); await flush(); assert.equal(selectedId.value, '', 'ordinary click still toggles the original inline details')
    const first = row('first'), event = { target: first, currentTarget: first, key: 'Enter', preventDefault() {} }
    first.props.onKeydown(event); await flush(); assert.equal(selectedId.value, 'service:8200:first')
    row('first').props.onKeydown({ ...event, target: row('first'), currentTarget: row('first'), key: ' ' }); await flush(); assert.equal(selectedId.value, '', 'keyboard selection still toggles details once')
    for (const id of ['first', 'nested', 'other', 'other-child', 'first']) {
      button(slowLabel).props.onClick(); await flush(); assert.equal(selectedId.value, `service:8200:${id}`)
    }
    const hint = collectNodes(container).find(target => target.props['aria-label']?.startsWith(dictionaries[0]['runtimeDiagnostics.traceInclusiveDuration']))
    assert.ok(hint); assert.ok(hint.props['aria-label'].includes('ns'))
  } finally { app.unmount() }
})

test('single-span and all-zero traces expose a keyboard-reachable disabled slow-call explanation', async () => {
  for (const spans of [[span()], [span(), { ...span(), id: 'zero', parentId: span().id, startNanos: '1', endNanos: '1' }]]) {
    const html = await rendered('TraceViewer.vue', { spans })
    const label = dictionaries[0][spans.length === 1 ? 'runtimeDiagnostics.traceOnlySpanHint' : 'runtimeDiagnostics.traceNoSlowChildrenHint']
    assert.ok(html.includes(`class="trace-slow-action" tabindex="0" aria-label="${label}"`))
    assert.ok(html.includes(`disabled>${dictionaries[0]['runtimeDiagnostics.traceSlowCalls']}`))
    assert.ok(!html.includes(`>${dictionaries[0]['runtimeDiagnostics.longestSpan']}</button>`))
  }
})

test('slow-call tooltip focus targets the enabled button or the disabled wrapper without relying on native focus bubbling', async t => {
  const { renderer, container } = renderHarness(t), focused = [], spans = vue.ref([span(), { ...span(), id: 'child', parentId: span().id }])
  const tooltip = vue.defineComponent({
    props: ['title', 'trigger'], setup(props, { slots }) { return () => {
      const anchor = slots.default?.()[0]
      // Ant Trigger 把原生 focus 监听挂到直接子节点；原生 focus 不会从内部按钮冒泡给包装层。
      return anchor && vue.cloneVNode(anchor, { onFocus: () => { if (props.trigger?.includes('focus')) focused.push(props.title) } })
    } },
  })
  const viewer = load(resolve(directory, 'TraceViewer.vue'), true).default
  const app = configure(renderer.createApp({ render: () => vue.h(viewer, { spans: spans.value }) }), tooltip)
  app.mount(container)
  try {
    const action = () => collectNodes(container).find(target => target.tag === 'button' && nodeText(target) === dictionaries[0]['runtimeDiagnostics.traceSlowCalls'])
    assert.equal(collectNodes(container).filter(target => target.props.class === 'trace-slow-action').length, 0, 'enabled action has no extra wrapper Tab stop')
    assert.equal(typeof action().props.onFocus, 'function', 'native button focus reaches its direct tooltip trigger')
    action().props.onFocus(); assert.equal(focused.at(-1), dictionaries[0]['runtimeDiagnostics.traceSlowCallsHint'])
    spans.value = [span()]; await flush()
    const wrapper = collectNodes(container).find(target => target.props.class === 'trace-slow-action')
    assert.equal(wrapper.props.tabindex, '0'); assert.ok('disabled' in action().props)
    assert.equal(action().props.onFocus, undefined, 'disabled button does not add a second focus target')
    wrapper.props.onFocus(); assert.equal(focused.at(-1), dictionaries[0]['runtimeDiagnostics.traceOnlySpanHint'])
    assert.equal(focused.length, 2)
  } finally { app.unmount() }
})

test('production attribute groups keep compact aligned values and expand/copy complete JSON or multiline evidence', async () => {
  const json = { output: ['item'.repeat(60)], ok: true }, attributes = { ...values, payload: json, multiline: 'first\nsecond' }
  const h = setup('trace/TraceAttributeGroups.vue', { attributes, focusedKey: 'payload' })
  try {
    assert.ok(h.view.expanded.value.has('payload'))
    h.view.toggle('payload'); assert.ok(!h.view.expanded.value.has('payload'))
    h.view.toggle('multiline'); assert.ok(h.view.expanded.value.has('multiline'))
    h.props.focusedKey = 'multiline'; await flush(); assert.ok(h.view.expanded.value.has('multiline'))
    const html = await rendered('trace/TraceAttributeGroups.vue', { attributes, focusedKey: 'payload' })
    assert.match(html, /trace-attribute-grid/); assert.match(html, /<dt title="request.action">业务动作<\/dt>/)
    assert.match(html, /<details class="trace-attribute-group trace-attribute-group--technical"/)
    assert.match(html, /data-trace-attribute="payload"/); assert.match(html, /trace-attribute-content/)
    assert.ok(html.includes('&quot;output&quot;')); assert.ok(html.includes('data-copy-text="{'))
    assert.ok(!html.includes('code-block')); assert.ok(!html.includes('ant-descriptions'))
  } finally { h.stop() }
})

test('span details expose readable HTTP evidence and one technical disclosure containing both runtime fields and identity', async () => {
  for (const attributes of [{ 'http.response.status_code': 200, 'flux-next-count': 0 }, {}]) {
    const value = span(attributes)
    const html = await rendered('TraceSpanDetails.vue', { span: value, logAccess: { allowed: false }, nodeAccess: { allowed: false } })
    assert.equal((html.match(/<summary\b/g) ?? []).length, 1)
    assert.match(html, /<summary[^>]*>技术信息/)
    assert.ok(!html.includes('>技术属性'))
    const technical = html.match(/<details\b[\s\S]*?<\/details>/)?.[0]
    assert.ok(technical?.includes(value.traceId)); assert.ok(technical?.includes(value.id))
    if (attributes['http.response.status_code']) {
      assert.match(html, /<dt title="http.response.status_code">响应状态<\/dt>/)
      assert.ok(technical.includes('输出数量'))
      assert.ok(!technical.includes('响应状态'))
    }
  }
  const unknown = 'custom.field.with.a.very.long.name'
  const html = await rendered('trace/TraceAttributeGroups.vue', { attributes: { [unknown]: '<raw>' } })
  assert.ok(html.includes(`<dt title="${unknown}">${unknown}</dt>`))
  assert.ok(html.includes('&lt;raw&gt;'))
})

test('production span details locates a summary field by exact data value without interpolating attribute selectors', async () => {
  const h = setup('TraceSpanDetails.vue', { span: span(values), focus: { kind: 'attributes', revision: 1, attributeKey: 'request.action' }, logAccess: { allowed: false }, nodeAccess: { allowed: false }, closable: true })
  const element = { dataset: { traceAttribute: 'request.action' }, getBoundingClientRect: () => ({ top: 250 }) }
  h.view.body.value = { scrollTop: 12, querySelectorAll: () => [element], getBoundingClientRect: () => ({ top: 50 }) }
  try {
    await flush(); assert.equal(h.view.body.value.scrollTop, 212)
    h.props.focus = { kind: 'attributes', revision: 2, attributeKey: 'missing["key"]' }; await flush()
    assert.equal(h.view.body.value.scrollTop, 212)
  } finally { h.stop() }
})

test('production help shows the real acquisition positions without copying synthetic IDs into a query', async () => {
  const html = await renderToString(appFor(load(helpFile, true).default))
  assert.match(html, /F12/); assert.match(html, /Network/); assert.match(html, /Response Headers/)
  assert.match(html, /Chrome DevTools 示意/); assert.match(html, /合成示例/); assert.match(html, /不是 Trace ID/)
  assert.match(html, /请复制实际请求中的值/); assert.match(html, /关闭获取指导/)
  assert.ok(html.includes('&quot;headers&quot;')); assert.ok(html.includes('&quot;traceparent&quot;'))
  const { parseTraceInput } = load(resolve(dirname(helpFile), 'parseTraceInput.ts'))
  assert.ok(!html.includes('data-copy-text='), 'illustrative IDs must not be offered as real query values')
  assert.deepEqual(parseTraceInput('2222222222222222'), { valid: false })
})

test('switching help sources ignores a late close event from the previous source', () => {
  const scope = vue.effectScope()
  const view = scope.run(() => load(helpFile).default.setup({}, { expose() {} }))
  try {
    view.setOpen('Browser', true)
    view.setOpen('Device', true)
    view.setOpen('Browser', false)
    assert.equal(view.activeSource.value, 'Device')
    view.setOpen('Device', false)
    assert.equal(view.activeSource.value, undefined)
  } finally { scope.stop() }
})

test('help close keeps one controlled popover and delegates focus restoration to its source trigger', async () => {
  const scope = vue.effectScope()
  const view = scope.run(() => load(helpFile).default.setup({}, { expose() {} }))
  try {
    view.setOpen('Logs', true)
    view.close('Logs')
    await flush()
    assert.equal(view.activeSource.value, undefined)
    const source = readFileSync(helpFile, 'utf8')
    assert.match(source, /@keydown\.esc\.stop\.prevent="close\(source\)"/)
    assert.match(source, /void nextTick\(\(\) => triggers\.get\(source\)\?\.focus\(\)\)/)
  } finally { scope.stop() }
})

test('changed SFC styles compile and all new visible labels exist in Chinese and English', () => {
  for (const filename of [...['TraceViewer.vue', 'TraceWaterfall.vue', 'TraceSpanDetails.vue', 'trace/TraceAttributeGroups.vue'].map(name => resolve(directory, name)), helpFile]) {
    const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: 'trace-detail-polish', source: style.content, filename, scoped: style.scoped }).errors, [])
  }
  for (const key of ['runtimeDiagnostics.traceContext.action', 'runtimeDiagnostics.traceContext.actor', 'runtimeDiagnostics.traceContext.sourceIp', 'runtimeDiagnostics.expandAttribute', 'runtimeDiagnostics.collapseAttribute', 'runtimeDiagnostics.traceAttributeGroup.business', 'runtimeDiagnostics.traceNodeUnavailable', 'Tracing.helpSyntheticExample', 'Tracing.helpChromeExample', 'Tracing.helpClose', 'Tracing.helpPasteActual', 'Tracing.helpTraceparentKey', 'Tracing.helpTraceIdKey', 'Tracing.helpMore', 'runtimeDiagnostics.traceExceptionShort', 'runtimeDiagnostics.traceSlowCalls', 'runtimeDiagnostics.traceSlowCallsHint', 'runtimeDiagnostics.traceNoSlowChildrenHint', 'runtimeDiagnostics.traceOnlySpanHint', 'runtimeDiagnostics.traceInclusiveDuration']) {
    for (const dictionary of dictionaries) assert.ok(dictionary[key], key)
  }
})

test('focused technical evidence opens only its collapsed group and preserves the exact attribute highlight', async () => {
  const h = setup('trace/TraceAttributeGroups.vue', { attributes: { 'flux-next-count': 1, 'user.id': 'operator-1' }, focusedKey: 'flux-next-count', focusRevision: 1 })
  try {
    assert.equal(h.view.technicalOpen.value, true)
    const html = await rendered('trace/TraceAttributeGroups.vue', { attributes: h.props.attributes, focusedKey: 'flux-next-count', focusRevision: 1 })
    assert.match(html, /<details class="trace-attribute-group trace-attribute-group--technical" data-trace-group="runtime" open>/)
    assert.match(html, /data-trace-attribute="flux-next-count" class="trace-attribute-focused"/)
  } finally { h.stop() }
})
