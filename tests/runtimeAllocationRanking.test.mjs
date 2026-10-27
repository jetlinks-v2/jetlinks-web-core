import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics'), cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const source = readFileSync(filename, 'utf8')
  const script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'allocation-ranking', inlineTemplate: true }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs', target: 'es2020' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: (key, values) => `${key}${values ? JSON.stringify(values) : ''}` }) }
    if (id.startsWith('.')) { const file = resolve(dirname(filename), id); return load(existsSync(file) ? file : `${file}.ts`) }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const { allocationRanking, formatAllocationBytes } = load(resolve(root, 'allocationPresentation.ts'))
const item = (className, allocationSize) => ({ className, allocationSize })

test('allocation ranking uses the whole current snapshot as denominator while filtering', () => {
  const source = [item('org.jetlinks.Small', 10), item('java.lang.Byte[]', 90)]
  const filtered = allocationRanking(source, 'JETLINKS')
  assert.equal(filtered.totalBytes, 100); assert.equal(filtered.classCount, 2)
  assert.deepEqual(filtered.rows, [{ ...source[0], rank: 2, share: 10 }])
  assert.deepEqual(source, [item('org.jetlinks.Small', 10), item('java.lang.Byte[]', 90)], 'sorting must not mutate a caller-owned cumulative snapshot')
  const later = allocationRanking([item('org.jetlinks.Small', 20), item('java.lang.Byte[]', 180)])
  assert.equal(later.totalBytes, 200, 'replacement snapshots are not added to prior values')
  assert.equal(later.rows[1].share, 10)
  assert.equal(allocationRanking(source, 'absent').totalBytes, 100)
})

test('empty, zero and invalid allocation values never produce invalid shares or totals', () => {
  assert.deepEqual(allocationRanking(), { totalBytes: 0, classCount: 0, rows: [] })
  const values = [item('zero', 0), item('negative', -1), item('nan', NaN), item('infinity', Infinity), item('fraction', 1.5), item('unsafe', Number.MAX_SAFE_INTEGER + 1), item('', 42), item(' ', 10)]
  assert.deepEqual(allocationRanking(values), { totalBytes: 0, classCount: 1, rows: [{ ...values[0], rank: 1, share: 0 }] })
  assert.equal(formatAllocationBytes(0), '0 B'); assert.equal(formatAllocationBytes(1024), '1 KB')
  assert.equal(formatAllocationBytes(NaN), ''); assert.equal(formatAllocationBytes(-10), '')
})

test('all ranked classes are rendered without pagination and names remain unabridged and escaped', async () => {
  const allocations = Array.from({ length: 18 }, (_, index) => item(`org.jetlinks.long.package.Type${index}`, index + 1))
  allocations.push(item('<script>dangerous</script>', 3))
  const app = vue.createSSRApp({ render: () => vue.h(load(resolve(root, 'AllocationRanking.vue')).default, { allocations }) })
  const wrap = tag => ({ setup: (_, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
  app.component('a-input-search', wrap('input')); app.component('a-tooltip', wrap('span')); app.component('a-empty', wrap('div'))
  app.component('a-progress', { props: ['percent'], setup: props => () => vue.h('div', { 'data-share': props.percent }) })
  const html = await renderToString(app)
  assert.equal((html.match(/class="allocation-row"/g) ?? []).length, 19)
  assert.ok(html.includes('org.jetlinks.long.package.Type17')); assert.ok(html.includes('org.jetlinks.long.package.Type0'))
  assert.ok(html.includes('&lt;script&gt;dangerous&lt;/script&gt;')); assert.ok(!html.includes('<script>dangerous'))
  assert.ok(!html.includes('pagination'))
})

test('empty allocation evidence keeps its JFR source explanation and performance navigation with real Ant Empty', async () => {
  const { Empty, Button } = require('ant-design-vue')
  const app = vue.createSSRApp({ render: () => vue.h(load(resolve(root, 'AllocationRanking.vue')).default) })
  app.component('a-empty', Empty); app.component('a-button', Button); app.component('a-tooltip', { setup: (_, { slots }) => () => vue.h('span', slots.default?.()) })
  const html = await renderToString(app)
  for (const key of ['runtimeDiagnostics.noAllocationEvents', 'runtimeDiagnostics.allocationEmptyHint', 'runtimeDiagnostics.goToPerformance']) assert.ok(html.includes(key), key)
})

test('allocation and panel templates and styles compile', () => {
  for (const name of ['AllocationRanking.vue', 'JvmDiagnosticPanel.vue']) {
    const filename = resolve(root, name), descriptor = parse(readFileSync(filename, 'utf8'), { filename }).descriptor
    assert.doesNotThrow(() => compileScript(descriptor, { id: 'allocation-ranking', inlineTemplate: true }))
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ source: style.content, filename, id: 'allocation-ranking', scoped: style.scoped }).errors, [])
  }
})
