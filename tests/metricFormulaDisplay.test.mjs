import assert from 'node:assert/strict'
import test from 'node:test'
import { h, reactive } from 'vue'
import { createI18n } from 'vue-i18n'
import { convertLatexToMarkup } from 'mathlive/ssr'
import { createMetricLoader, createMetricRenderer, flush, walk, textContent } from './helpers/metricRuntime.mjs'

function mount(expression, render = convertLatexToMarkup) {
  const Display = createMetricLoader({ mathlive: { convertLatexToMarkup: render }, 'mathlive/static.css': {} })('components/Metric/template/formula/TemplateFormulaDisplay.vue').default
  const rule = { id: 'unitEnergy', expression, inputs: [{ id: 'a', metricId: 'energyA' }] }
  const props = reactive({ expression, rule, semanticOnly:false, template: {
    id: 'energy', version: '1', name: '单位能耗', parameters: {},
    inputDefinitions: [{ id: 'energyA', name: '产线A耗电' }, { id: 'energyB', name: '产线B耗电' }, { id: 'quantityA', name: '产线A产量' }, { id: 'quantityB', name: '产线B产量' }],
    definitions: [rule], outputs: [{ metricId: 'unitEnergy', label: '单位产量耗电' }], parameterDefinitions: [{ id: 'factor', name: '修正系数' }],
  } })
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup: () => () => h(Display, props) }); app.use(createI18n({ legacy:false,locale:'zh' })); app.mount(root)
  return { props, root, html: () => walk(root, item => item.props.class === 'template-formula__math')[0]?.props.innerHTML,
    close: () => app.unmount() }
}

test('单位产量耗电以真实MathLive静态分式展示，中文别名/参数变更响应且不创建编辑控件', async () => {
  const view = mount('12.0 * (a + energyB) / (quantityA + quantityB)')
  try {
    const before = JSON.stringify(view.props)
    await flush()
    assert.match(view.html(), /ML__mfrac/); assert.match(view.html(), /产线A耗电/); assert.match(view.html(), /产线B产量/)
    assert.match(view.html(), /×/); assert.equal(walk(view.root, item => item.type === 'math-field').length, 0)
    assert.equal(JSON.stringify(view.props), before)
    assert.match(walk(view.root, item => item.props.role === 'math')[0].props['aria-label'], /产线A耗电/)
    view.props.template.inputDefinitions[0].name = '车间耗电'; await flush(); assert.match(view.html(), /车间耗电/)
    view.props.expression = 'a / quantityA * params.factor'; await flush(); assert.match(view.html(), /修正系数/)
  } finally { view.close() }
})

test('适用条件展示比较关系；高级表达式保持可读原文，切回公式恢复数学回显', async () => {
  const view = mount('quantityA + quantityB > 0')
  try {
    await flush(); assert.match(view.html(), /产线A产量/); assert.match(view.html(), /&gt;/)
    view.props.expression = "a > 0 ? unknown('energyB') : 0"; await flush()
    assert.equal(view.html(), undefined); assert.equal(textContent(view.root), "产线A耗电 > 0 ? unknown('energyB') : 0")
    assert.equal(view.props.expression, "a > 0 ? unknown('energyB') : 0")
    view.props.expression = 'a / quantityA'; await flush(); assert.match(view.html(), /ML__mfrac/)
  } finally { view.close() }
})

test('显示名与不支持的表达式不会作为HTML注入；资源/渲染失败保留原文', async () => {
  const view = mount('a / quantityA')
  try {
    view.props.template.inputDefinitions[0].name = '<img src=x onerror=alert(1)>\\htmlClass{bad}'; await flush()
    assert.equal(view.html().includes('<img'), false); assert.match(view.html(), /&lt;img/)
    view.props.expression = '<img src=x onerror=alert(1)>'; await flush()
    assert.equal(view.html(), undefined); assert.equal(textContent(view.root), view.props.expression)
  } finally { view.close() }
  const unavailable = mount('a / quantityA', () => { throw new Error('renderer unavailable') })
  try { await flush(); assert.equal(unavailable.html(), undefined); assert.equal(textContent(unavailable.root), '产线A耗电 / 产线A产量') }
  finally { unavailable.close() }
})

test('卸载后资源完成不会进行渲染，也不创建后台编辑实例', async () => {
  let calls = 0
  const view = mount('a / quantityA', () => { calls++; return '' })
  view.close(); await flush(); assert.equal(calls, 0)
})

test('编辑器语义摘要共用分支展示；普通公式和未知语法不重复显示', async () => {
  const view = mount('a > 0 ? true : false')
  try {
    view.props.semanticOnly = true
    const before = JSON.stringify(view.props.rule)
    await flush()
    assert.ok(walk(view.root,item => item.props.role === 'group').length)
    assert.match(textContent(view.root),/产线A耗电/)
    assert.doesNotMatch(textContent(view.root),/\? true/)
    assert.equal(JSON.stringify(view.props.rule),before)
    for (const expression of ['a + energyB', 'unknown(a)']) {
      view.props.expression = expression; await flush()
      assert.equal(textContent(view.root),'')
    }
    view.props.semanticOnly = false; await flush()
    assert.match(textContent(view.root),/unknown/)
  } finally { view.close() }
})
