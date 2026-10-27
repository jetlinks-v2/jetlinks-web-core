import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { compileScript, parse } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics')
function load(filename) {
  const source = readFileSync(filename, 'utf8')
  const script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'thread-viewer' }).content : source
  const module = { exports: {} }, { code } = transformSync(script, { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.endsWith('.vue')) return {}
    return id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id)
  }, module, module.exports)
  return module.exports
}
const component = load(resolve(root, 'ThreadViewer.vue')).default
const { threadStackDepth } = load(resolve(root, 'utils.ts'))
const thread = (id, name, state, depth) => ({ id, name, state, stack: Array.from({ length: depth }, (_, index) => `example.Worker.frame${index}(Worker.java:${index})`).join('\n'), sampledAt: 1000 })

test('stack depth counts collected frames and ignores blank lines and CRLF separators', () => {
  assert.equal(threadStackDepth(''), 0)
  assert.equal(threadStackDepth('  \n\r\n'), 0)
  assert.equal(threadStackDepth('example.A.run(A.java:1)\r\n\r\nexample.B.run(B.java:2)\n'), 2)
})

test('threads default to numeric stack-depth descending while search and state tags retain original snapshot evidence', async () => {
  const snapshots = [thread('1', 'short-worker', 'RUNNABLE', 2), thread('2', 'deep-worker', 'WAITING', 12), thread('3', 'empty-worker', 'RUNNABLE', 0)]
  const props = vue.reactive({ threads: snapshots, state: { status: 'ready' }, sampleAccess: { allowed: true } })
  const scope = vue.effectScope(), view = scope.run(() => component.setup(props, { emit() {}, expose() {} }))
  try {
    const column = view.columns.value.find(column => column.key === 'stackDepth')
    assert.equal(column.defaultSortOrder, 'descend')
    assert.deepEqual([...view.filtered.value].sort((left, right) => -column.sorter(left, right)).map(row => row.id), ['2', '1', '3'])
    assert.deepEqual(snapshots.map(row => row.id), ['1', '2', '3'], 'sorting must not reorder the source snapshot')
    view.filter.value = 'RUNNABLE'
    assert.deepEqual(view.filtered.value.map(row => row.stackDepth), [2, 0])
    view.search.value = 'short'
    assert.deepEqual(view.filtered.value.map(row => row.id), ['1'])
    assert.equal(view.filtered.value[0].stack, snapshots[0].stack, 'expanded details keep the complete original stack')
    props.threads = [thread('4', 'new-worker', 'WAITING', 5)]
    await vue.nextTick()
    assert.equal(view.filter.value, 'all', 'a vanished state restores the all-state filter')
    view.search.value = ''
    assert.equal(view.filtered.value[0].stackDepth, 5)
  } finally { scope.stop() }
})
