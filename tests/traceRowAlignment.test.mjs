import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..'), directory = resolve(root, 'src/components/RuntimeDiagnostics')
const cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const source = readFileSync(filename, 'utf8')
  const content = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'trace-row-alignment', inlineTemplate: true }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(content, { loader: 'ts', format: 'cjs', target: 'es2020' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key, locale: vue.ref('en') }) }
    if (id.startsWith('.')) { const next = resolve(dirname(filename), id); return load(existsSync(next) ? next : `${next}.ts`) }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports)
  return module.exports
}
const waterfall = load(resolve(directory, 'TraceWaterfall.vue')).default
const table = vue.defineComponent({
  props: ['columns', 'dataSource', 'customRow', 'expandedRowKeys'],
  setup(props, { slots }) { return () => vue.h('table', {}, vue.h('tbody', {}, props.dataSource.flatMap(record => [
    vue.h('tr', props.customRow(record), props.columns.map(column => vue.h('td', {}, slots.bodyCell({ column, record })))),
    ...(props.expandedRowKeys.includes(record.key) ? [vue.h('tr', { class: 'ant-table-expanded-row' }, vue.h('td', { colspan: 2 }, slots.expandedRowRender({ record })))] : []),
  ]))) },
})
const wrapper = vue.defineComponent({ setup(_, { slots }) { return () => vue.h('span', {}, slots.default?.()) } })
const row = depth => ({ key: `node:span-${depth}`, id: `span-${depth}`, traceId: '1'.repeat(32), name: 'operation', nodeId: 'node', depth, startNanos: '1', endNanos: '1001', duration: .001, attributes: {}, events: [] })

test('expanded evidence shares the selected operation tree offset at every supported depth', async () => {
  for (const [depth, indent] of [[0, 0], [1, 12], [4, 48], [20, 144]]) {
    const current = row(depth), app = vue.createSSRApp({ render: () => vue.h(waterfall, {
      rows: [current], allRows: [current], summary: { start: '1', duration: .001 }, collapsed: new Set(), matchedKeys: new Set(), selectedKey: current.key,
    }, { details: ({ span }) => vue.h('section', { 'data-evidence-owner': span.key }, 'evidence') }) })
    app.component('a-table', table)
    for (const name of ['a-tooltip', 'a-button', 'a-tag']) app.component(name, wrapper)
    const html = await renderToString(app)
    assert.ok(html.includes('class="trace-row-selected"'), `depth ${depth}: selected row remains identifiable`)
    assert.ok(html.includes(`class="trace-operation" style="--trace-tree-indent:${indent}px;"`))
    assert.ok(html.includes(`class="trace-inline-details" style="--trace-tree-indent:${indent}px;" data-span-details="${current.key}"`))
    assert.ok(html.includes(`data-evidence-owner="${current.key}"`), 'details belong to the same selected span')
    assert.ok(html.indexOf('data-span-key=') < html.indexOf('ant-table-expanded-row'), 'details follow their selected data row')
  }
})

test('the joined trace surface and compact identity styles compile', () => {
  for (const name of ['TraceWaterfall.vue', 'TraceSpanDetails.vue']) {
    const filename = resolve(directory, name), { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: 'trace-row-alignment', source: style.content, filename, scoped: style.scoped }).errors, [])
  }
})

test('expanded cell padding wins over the installed Ant size rules without depending on stylesheet order', () => {
  const filename = resolve(directory, 'TraceWaterfall.vue'), { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const css = compileStyle({ id: 'trace-row-alignment', source: descriptor.styles[0].content, filename, scoped: true }).code
  const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selector, declarations]) => selector.includes('ant-table-expanded-row') && /(?:^|;)\s*padding\s*:\s*0\s*;/.test(declarations))
  assert.ok(rule, 'the expanded cell explicitly removes the Ant padding before applying the shared content offset')
  // These selectors contain only classes, attributes, type selectors and combinators.
  const specificity = selector => {
    assert.ok(!/[#:]/.test(selector), 'extend the specificity evaluator before adding ids or pseudo selectors')
    const attributes = selector.match(/\[[^\]]*\]/g)?.length ?? 0
    const withoutAttributes = selector.replace(/\[[^\]]*\]/g, '')
    return ((withoutAttributes.match(/\.[\w-]+/g)?.length ?? 0) + attributes) * 100 + (withoutAttributes.match(/(?:^|[\s>+~])([a-z][\w-]*)/gi)?.length ?? 0)
  }
  const sizes = require('ant-design-vue/lib/table/style/size').default({ componentCls: '.ant-table', tablePaddingVerticalSmall: 8, tablePaddingHorizontalSmall: 8, tablePaddingVerticalMiddle: 12, tablePaddingHorizontalMiddle: 8 })['.ant-table-wrapper']
  for (const [size, rules] of Object.entries(sizes)) {
    const paddingRule = Object.entries(rules).find(([, declaration]) => declaration?.padding)
    const cell = paddingRule[0].split(',').map(selector => selector.trim()).find(selector => selector === '.ant-table-tbody > tr > td')
    assert.ok(cell)
    const antSelector = `.ant-table-wrapper ${size} ${cell}`
    assert.ok(specificity(rule[1].trim()) > specificity(antSelector), `${size} padding must not add a second inset to expanded evidence`)
  }
})
