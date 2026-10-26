import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'
import { buildSync, transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics'), cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2020' }).code)(id => id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const { buildFlameLayout } = load(resolve(root, 'flameGraph.ts'))
const { analyzeFlameLayout, selectFlameHotspots, flameEvidence } = load(resolve(root, 'flame/analysis.ts'))
const { flameSymbol, defaultFlameLabels, renderFlameHotspotsHtml, renderFlameInsightsHtml } = load(resolve(root, 'flame/presentation.ts'))
const frame = (className, samples, children = [], extra = {}) => ({ className, samples, children, ...extra })
const analyze = (frames, minimum) => analyzeFlameLayout(buildFlameLayout(frames), minimum)
const rows = (analysis, keys = analysis.nodes.map(node => node.key)) => selectFlameHotspots(analysis, new Set(keys))
const sample = [frame('java.lang.Thread', 120, [frame('org.jetlinks.Service', 80, [frame('reactor.core.Flux', 80, [], { method: 'subscribe', line: 42 })]), frame('io.netty.Channel', 30)])]

test('equal-weight linear paths collapse once, with full evidence and distinct repeated-method identities', () => {
  const analysis = analyze([frame('root', 100, [frame('branch.a', 50, [frame('same.Method', 50)]), frame('branch.b', 50, [frame('same.Method', 50)])])])
  const selected = rows(analysis)
  assert.equal(selected.length, 3)
  const repeated = selected.filter(row => row.name === 'same.Method')
  assert.equal(repeated.length, 2); assert.notEqual(repeated[0].key, repeated[1].key)
  for (const row of repeated) {
    assert.equal(row.members.length, 2)
    assert.equal(flameEvidence(analysis, row).path.length, 3)
    assert.equal(row.selfSamples, 50)
  }
  let deep = frame('org.jetlinks.Bottom', 120, [], { method: 'execute' })
  for (let index = 0; index < 64; index++) deep = frame(`stack.Layer${index}`, 120, [deep])
  const compact = analyze([deep]), compactRows = rows(compact)
  assert.equal(compactRows.length, 1); assert.equal(compactRows[0].members.length, 65)
  assert.equal(compactRows[0].name, 'org.jetlinks.Bottom.execute')
  assert.equal(flameEvidence(compact, compactRows[0]).path.length, 65)
})

test('self samples require complete reliable direct children, and useful self samples precede inclusive roots', () => {
  const analysis = analyze(sample), selected = rows(analysis)
  assert.equal(selected[0].name, 'reactor.core.Flux.subscribe:42'); assert.equal(selected[0].selfSamples, 80)
  assert.equal(analysis.byKey.get(analysis.nodes[0].key).selfSamples, 10)
  for (const children of [undefined, [frame('over', 121)], [frame('unknown', NaN)], [frame('negative', -1)], [frame('fraction', 1.5)], [frame('unsafe', Number.MAX_SAFE_INTEGER + 1)]]) {
    const invalid = analyze([{ className: 'root', samples: 120, children }])
    assert.equal(invalid.nodes[0].selfSamples, undefined)
    assert.equal(invalid.complete, false)
    assert.deepEqual(invalid.insights.map(value => value.kind), ['invalid'])
  }
  for (const samples of [NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(analyze([frame('root', samples)]).nodes[0].selfSamples, undefined)
})

test('full-snapshot notes and denominator stay stable across view filters, focus and a configurable low-sample rule', () => {
  const analysis = analyze(sample), before = renderFlameInsightsHtml(analysis, defaultFlameLabels)
  for (const options of [{ search: 'Flux' }, { category: 'network' }, { focus: analysis.nodes.at(-1).key }]) {
    const visible = buildFlameLayout(sample, options), selected = rows(analysis, visible.cells.filter(cell => cell.matched).map(cell => cell.key))
    assert.ok(selected.length); assert.equal(analysis.total, 120)
    assert.equal(renderFlameInsightsHtml(analysis, defaultFlameLabels), before)
    assert.ok(selected.every(row => row.samples <= analysis.total))
  }
  const small = analyze([frame('SystemMonitor.collect', 17)])
  assert.deepEqual(small.insights.map(value => value.kind), ['limited']); assert.equal(small.insights[0].count, 17)
  assert.match(renderFlameInsightsHtml(small, defaultFlameLabels), /Continue sampling while the issue occurs/)
  assert.equal(analyze([frame('root', 17)], 10).insights[0].kind, 'self')
  for (const threshold of [0, -1, NaN, Infinity, 1.2]) assert.equal(analyze(sample, threshold).minimum, 100)
  assert.equal(analyze([]).insights.length, 0)
  assert.ok(analysis.insights.length <= 3)
  for (const insight of analysis.insights) if (insight.frameKey) assert.ok(analysis.byKey.has(insight.frameKey))
  assert.match(defaultFlameLabels.selfBoundary, /filtered or truncated/)
  assert.match(defaultFlameLabels.selfBoundary, /not CPU time/)
})

test('symbol labels retain class identity, method tails and reliable source lines without claiming unknown lines', () => {
  const symbol = (className, method = 'longMethod', line) => flameSymbol(buildFlameLayout([frame(className, 1, [], { method, line })]).cells[0])
  assert.deepEqual(symbol('org.jetlinks.deep.Service', 'execute', 42), { primary: 'Service.execute:42', secondary: 'org.jetlinks.deep', raw: 'org.jetlinks.deep.Service.execute:42' })
  for (const suffix of ['$$Lambda.0x0000000800b45000', '$$Lambda/0x0000000800b45000']) {
    const parsed = symbol(`org.jetlinks.Service${suffix}`, 'apply')
    assert.equal(parsed.primary, `Service${suffix}.apply`); assert.equal(parsed.secondary, 'org.jetlinks')
  }
  for (const line of [-1, 0, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(symbol('java.lang.Thread', 'run', line).primary, 'Thread.run')
  const strange = symbol('<unknown symbol>', 'run')
  assert.equal(strange.primary, '<unknown symbol>.run'); assert.equal(strange.secondary, '')
  const hostile = analyze([frame('</script><img onerror="x">', 100)])
  const html = renderFlameHotspotsHtml({ rows: rows(hostile), total: 100, category: 'all', labels: defaultFlameLabels, categories: [] })
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;'))
})

function componentHarness(analysis) {
  const module = { exports: {} }, filename = resolve(root, 'flame/FlameHotspots.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const script = compileScript(descriptor, { id: 'flame-hotspots-test', inlineTemplate: true })
  new Function('require', 'module', 'exports', transformSync(script.content, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.startsWith('.')) return load(resolve(dirname(filename), `${id}.ts`))
    return require(id)
  }, module, module.exports)
  const make = (tag, text = '') => ({ tag, text, children: [], props: {}, parent: undefined })
  const renderer = vue.createRenderer({
    createElement: tag => make(tag), createText: text => make('#text', text), createComment: text => make('#comment', text),
    setText: (node, text) => { node.text = text }, setElementText: (node, text) => { node.text = text; node.children = [] },
    parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1],
    patchProp: (node, key, _previous, value) => { node.props[key] = value },
    insert(node, parent, anchor) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = parent; const index = parent.children.indexOf(anchor); parent.children.splice(index < 0 ? parent.children.length : index, 0, node) },
    remove(node) { node.parent?.children.splice(node.parent.children.indexOf(node), 1) },
  })
  const container = make('root'), events = [], props = vue.reactive({ analysis, rows: rows(analysis), category: 'all' })
  const app = renderer.createApp({ render: () => vue.h(module.exports.default, { ...props, onFocus: key => events.push(key) }) })
  for (const [name, tag] of [['a-button', 'button'], ['a-tag', 'span'], ['a-typography-text', 'copy']]) app.component(name, { inheritAttrs: false, setup: (_, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
  app.mount(container)
  const all = (predicate, node = container) => [ ...(predicate(node) ? [node] : []), ...node.children.flatMap(child => all(predicate, child)) ]
  return { container, all, events, props, stop: () => app.unmount() }
}
const textOf = node => node.text + node.children.map(textOf).join('')
test('production hotspot rows expose method/package, copy the original and expand one complete path in place', async () => {
  const analysis = analyze(sample), h = componentHarness(analysis)
  try {
    assert.match(textOf(h.container), /Flux.subscribe:42/); assert.match(textOf(h.container), /reactor.core/)
    const copies = h.all(node => node.tag === 'copy')
    assert.equal(copies[0].props.copyable.text, rows(analysis)[0].name)
    const expand = () => h.all(node => node.tag === 'button' && 'aria-expanded' in node.props)
    expand()[0].props.onClick(); await vue.nextTick()
    assert.equal(h.all(node => node.props.class === 'flame-evidence').length, 1)
    assert.match(textOf(h.container), /java.lang/)
    expand()[1].props.onClick(); await vue.nextTick()
    assert.equal(h.all(node => node.props.class === 'flame-evidence').length, 1)
    assert.equal(expand()[0].props['aria-expanded'], false); assert.equal(expand()[1].props['aria-expanded'], true)
    const focus = h.all(node => node.tag === 'button' && node.props.title === rows(analysis)[0].name)[0]
    focus.props.onClick(); assert.equal(h.events.at(-1), rows(analysis)[0].key)
    h.props.rows = [...h.props.rows]; await vue.nextTick()
    assert.equal(expand()[1].props['aria-expanded'], true, 'stream updates retain the expanded evidence')
    h.props.rows = [h.props.rows[0]]; await vue.nextTick()
    assert.equal(h.all(node => node.props.class === 'flame-evidence').length, 0)
  } finally { h.stop() }
  const source = readFileSync(resolve(root, 'flame/FlameHotspots.vue'), 'utf8')
  assert.match(source, /white-space:normal/); assert.match(source, /overflow-wrap:anywhere/)
  assert.ok(!source.includes('text-overflow:ellipsis')); assert.ok(!source.includes('310px'))
})

function offline(snapshot, options = {}) {
  const result = buildSync({ entryPoints: [resolve(root, 'flameGraphHtml.ts')], bundle: true, format: 'cjs', platform: 'node', target: 'es2020', minify: true, write: false })
  const module = { exports: {} }; new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
  const html = module.exports.createFlameGraphHtml({ nodeId: 'node', snapshot, ...options })
  const elements = Object.fromEntries(['#search', '#reset', '#count', '#chart', '#groups', '#info', '#insights', '#hotspots'].map(key => [key, { value: '', textContent: '', innerHTML: '', children: [], append(child) { this.children.push(child) } }]))
  Object.assign(elements['#chart'], { clientHeight: 340, clientWidth: 980, scrollTop: 0, scrollLeft: 0 })
  Object.defineProperty(elements['#chart'], 'scrollHeight', { get() { return Math.max(this.clientHeight, Number(this.innerHTML.match(/height="(\d+)" role="img"/)?.[1] ?? 0)) } })
  const copied = [], document = { querySelector: key => elements[key], querySelectorAll: () => elements['#groups'].children, createElement: () => ({ dataset: {}, setAttribute(key, value) { this[key] = value } }) }
  vm.runInNewContext(html.match(/<script>([\s\S]*)<\/script>/)[1], { document, navigator: { clipboard: { writeText: async text => { copied.push(text) } } } })
  const click = (area, attribute, value) => elements[area].onclick({ target: { closest: selector => selector === `[${attribute}]` ? { dataset: { [attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]: value } } : null } })
  return { elements, copied, html, click }
}

test('minified offline HTML shares compact rows, stable full-snapshot notes and working inline evidence/focus/copy', async () => {
  const analysis = analyze(sample), selected = rows(analysis), h = offline({ flameGraph: sample, objectAllocations: [] })
  const { elements } = h
  assert.match(elements['#hotspots'].innerHTML, /Flux.subscribe:42/)
  assert.match(elements['#hotspots'].innerHTML, /reactor.core/)
  assert.match(elements['#chart'].innerHTML, /◆/)
  const notes = elements['#insights'].innerHTML
  elements['#search'].value = 'Flux'; elements['#search'].oninput()
  assert.equal(elements['#insights'].innerHTML, notes); assert.match(elements['#hotspots'].innerHTML, /80 \/ 120/)
  elements['#search'].value = ''; elements['#search'].oninput()
  await h.click('#hotspots', 'data-hotspot-evidence', selected[0].key)
  assert.equal((elements['#hotspots'].innerHTML.match(/class="flame-evidence"/g) ?? []).length, 1)
  assert.match(elements['#hotspots'].innerHTML, /java.lang/)
  assert.match(elements['#hotspots'].innerHTML, /flame-platform/, 'expanded compact path retains the platform frame marker')
  await h.click('#hotspots', 'data-hotspot-evidence', selected[1].key)
  assert.equal((elements['#hotspots'].innerHTML.match(/class="flame-evidence"/g) ?? []).length, 1)
  await h.click('#hotspots', 'data-hotspot-copy', selected[0].key)
  assert.equal(h.copied[0], selected[0].name)
  const clue = analysis.insights.find(insight => insight.frameKey)
  elements['#search'].value = 'no match'; elements['#search'].oninput()
  await h.click('#insights', 'data-insight-focus', clue.frameKey)
  assert.equal(elements['#search'].value, '')
  assert.equal((elements['#chart'].innerHTML.match(/<g role="button"/g) ?? []).length, 1)
  assert.equal(elements['#insights'].innerHTML, notes)
  const small = offline({ flameGraph: [frame('org.jetlinks.Worker', 17)], objectAllocations: [] })
  assert.match(small.elements['#insights'].innerHTML, /Only 17 execution samples/)
  const hostile = '</script><script>bad()</script><img onerror="x">'
  const escaped = offline({ flameGraph: [frame(hostile, 120)], objectAllocations: [] })
  assert.equal((escaped.html.match(/<script>/g) ?? []).length, 1)
  assert.ok(!escaped.elements['#hotspots'].innerHTML.includes('<img')); assert.ok(escaped.elements['#hotspots'].innerHTML.includes('&lt;'))
})
