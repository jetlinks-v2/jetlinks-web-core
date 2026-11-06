import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
function load(source) {
  const exports = {}
  new Function('exports', 'require', transpile(source))(exports, require)
  return exports
}
const { useDashboardPlaceholder } = load(readFileSync(new URL('../src/components/DashBoardCanvas/composables/useDashboardPlaceholder.ts', import.meta.url), 'utf8'))
const base = new URL('../node_modules/vue3-grid-layout-next/src/', import.meta.url)
const utils = load(readFileSync(new URL('helpers/utils.ts', base), 'utf8'))
const source = readFileSync(new URL('components/Grid/GridLayout.vue', base), 'utf8')
const functions = source.slice(source.indexOf('function dragEvent('), source.indexOf('// finds or generates new layouts'))

// Execute the installed GridLayout event handlers, including their real move/compact helpers.
function setup(items) {
  const layout = vue.ref(items)
  const placeholder = vue.ref({ i: -1, x: 0, y: 0, w: 0, h: 0 })
  const isDragging = vue.ref(false)
  const grid = vue.ref(vue.reactive({ placeholder, isDragging }))
  const scope = vue.effectScope()
  scope.run(() => useDashboardPlaceholder(grid, layout))
  const props = { get layout() { return layout.value }, verticalCompact: true, preventCollision: false, restoreOnDrag: false, responsive: false }
  const factory = new Function('props', 'placeholder', 'isDragging', 'positionsBeforeDrag', 'width', 'eventBus', 'nextTick', 'emit', 'updateHeight', 'getLayoutItem', 'moveElement', 'compact', 'getAllCollisions', 'responsiveGridLayout', transpile(functions + '\nreturn { dragEvent, resizeEvent }'))
  const events = factory(props, placeholder, isDragging, vue.ref(), vue.ref(1200), { emit() {} }, vue.nextTick, () => {}, () => {}, utils.getLayoutItem, utils.moveElement, utils.compact, utils.getAllCollisions, () => {})
  return { layout, placeholder, isDragging, scope, ...events }
}
const item = (i, x, y, w = 2, h = 2) => ({ i, x, y, w, h })
const rect = ({ x, y, w, h }) => ({ x, y, w, h })
async function settle() { await vue.nextTick(); await vue.nextTick() }

test('placeholder follows installed grid drag and compaction, and stops after interaction', async () => {
  const g = setup([item('a', 0, 0), item('b', 2, 0), item('c', 2, 2)])
  g.dragEvent('dragstart', 'a', 0, 0, 2, 2); await settle()
  g.dragEvent('dragmove', 'a', 4, 0, 2, 2); await settle()
  assert.deepEqual(rect(g.placeholder.value), rect(g.layout.value[0]))
  g.dragEvent('dragmove', 'a', 2, 2, 2, 2); await settle()
  assert.deepEqual(rect(g.placeholder.value), { x: 2, y: 2, w: 2, h: 2 })
  assert.equal(g.layout.value.find(x => x.i === 'c').y, 4)
  g.dragEvent('dragend', 'a', 2, 2, 2, 2); await settle()
  assert.equal(g.isDragging.value, false)
  assert.deepEqual(rect(g.placeholder.value), rect(g.layout.value[0]))
  const before = rect(g.placeholder.value)
  g.layout.value[0].x = 6; await settle()
  assert.deepEqual(rect(g.placeholder.value), before)
  g.scope.stop()
})

test('resize, missing target and disposed scope have bounded effects', async () => {
  const g = setup([item('a', 0, 0)])
  g.resizeEvent('resizestart', 'a', 0, 0, 2, 2); await settle()
  g.resizeEvent('resizemove', 'a', 0, 0, 3, 4); await settle()
  assert.deepEqual(rect(g.placeholder.value), { x: 0, y: 0, w: 4, h: 3 })
  g.placeholder.value.i = 'missing'
  const before = rect(g.placeholder.value)
  g.layout.value[0].x = 2; await settle()
  assert.deepEqual(rect(g.placeholder.value), before)
  g.placeholder.value.i = 'a'
  g.scope.stop()
  g.layout.value[0].x = 3; await settle()
  assert.deepEqual(rect(g.placeholder.value), before)
})
