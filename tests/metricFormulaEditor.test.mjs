import assert from 'node:assert/strict'
import test from 'node:test'
import { defineComponent, h, reactive } from 'vue'
import { createMetricLoader, createMetricRenderer, flush, walk } from './helpers/metricRuntime.mjs'

const FormulaEditor = createMetricLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) } })('components/Metric/template/TemplateFormulaEditor.vue').default
test('表达式模式复用变量浮窗，在原选区替换并恢复光标；取消与只读不改表达式', async () => {
  const { renderer, root } = createMetricRenderer(); const changes = []
  const props = reactive({ modelValue: '#a > 10 ? 1 : 0', references: [{ key:'a', label:'温度', expression:'#a' }, { key:'b', label:'湿度', expression:'#b' }], disabled:false,
    onChange: value => { changes.push(value); props.modelValue = value.expression } })
  const app = renderer.createApp({ setup: () => () => h(FormulaEditor, props) })
  for (const type of ['a-button', 'a-select', 'a-textarea']) app.component(type, defineComponent({ inheritAttrs:false, setup: (_props, { attrs, slots, expose }) => {
    expose({ focus() {} }); return () => h(type, attrs, Object.entries(slots).flatMap(([name,slot]) => name === 'option' ? [] : slot?.()))
  } }))
  app.config.warnHandler = () => {}; app.mount(root)
  const find = predicate => walk(root, predicate)[0]
  find(node => node.props.class === 'formula-editor__canvas').getBoundingClientRect = () => ({ left:0, top:0, bottom:112 })
  const source = () => find(node => node.type === 'a-textarea')
  const picker = () => find(node => node.props.class === 'formula-editor__picker')
  const open = async () => { find(node => node.props['aria-label'] === 'insertVariable').props.onClick(); await flush() }
  const textarea = { selectionStart:0, selectionEnd:2, focus() { this.focused = true }, setSelectionRange(start,end) { this.range = [start,end] } }
  try {
    source().props.onSelect({ target:textarea }); await open()
    picker().props.onSelect(1); await flush()
    assert.equal(props.modelValue, '#b > 10 ? 1 : 0'); assert.deepEqual(textarea.range, [2,2]); assert.equal(textarea.focused, true)
    await open(); picker().props.onKeydown({ key:'Escape', stopPropagation() {}, preventDefault() {} }); await flush()
    assert.equal(picker(), undefined); assert.equal(changes.length, 1)
    await open(); const pendingSelect = picker().props.onSelect; props.disabled = true; await flush(); pendingSelect(0); await flush()
    assert.equal(props.modelValue, '#b > 10 ? 1 : 0'); assert.equal(changes.length, 1)
  } finally { app.unmount() }
})
test('真实公式组件保留高级原文；只切换模式不改源码；禁用期间不接受编辑', async () => {
  const changes = []; const invalid = []
  const props = reactive({ modelValue: '  #t > 80 ? 1 : 0  ', references: [{ key: 'temperature', label: '温度', expression: '#t' }], disabled: false,
    onChange(value) { changes.push(value); props.modelValue = value.expression }, onInvalid(value) { invalid.push(value) } })
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup: () => () => h(FormulaEditor, props) })
  for (const type of ['a-radio-group', 'a-radio-button', 'a-button', 'a-select', 'a-textarea', 'a-alert']) {
    app.component(type, defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots }) => () => h(type, attrs, Object.entries(slots).flatMap(([name,slot]) => name === 'option' ? [] : slot?.())) }))
  }
  app.config.warnHandler = () => {}; app.mount(root)
  const find = type => walk(root, node => node.type === type)[0]
  try {
    assert.equal(find('a-textarea').props.value, props.modelValue)
    const modeButton = () => walk(root, x => x.type === 'a-button' && ['editExpression', 'backToFormula'].includes(x.props['aria-label']))[0]
    assert.equal(modeButton().props.disabled, true)
    modeButton().props.onClick(); await flush()
    assert.equal(changes.length, 0); assert.ok(find('a-textarea'))
    find('a-textarea').props['onUpdate:value']('#t + 1'); await flush()
    assert.deepEqual(changes, [{ expression: '#t + 1' }]); assert.equal(invalid.at(-1), false)
    modeButton().props.onClick(); await flush()
    assert.equal(find('a-textarea'), undefined); assert.equal(changes.length, 1)
    modeButton().props.onClick(); await flush()
    assert.equal(find('a-textarea').props.value, '#t + 1'); assert.equal(changes.length, 1)
    props.disabled = true; await flush()
    find('a-textarea').props['onUpdate:value']('99'); modeButton().props.onClick(); await flush()
    assert.equal(props.modelValue, '#t + 1'); assert.equal(changes.length, 1); assert.ok(find('a-textarea'))
    props.modelValue = '#unknown.run()'; await flush()
    assert.equal(find('a-textarea').props.value, '#unknown.run()')
  } finally { app.unmount() }
})

test('变量浮窗恢复原生选区替换；取消、外部更新、引用变化和只读清除待选内容', async () => {
  const previousDocument = globalThis.document
  globalThis.document = {}
  let field
  const changes = []
  class Mathfield {
    constructor() { field = this; this.selection = { ranges: [[3, 3]] }; this.position = 3; this.inserts = [] }
    setAttribute() {} addEventListener() {} removeEventListener() {} remove() {}
    focus() { this.focused = true } blur() { this.focused = false }
    getValue() { return this.value }
    getOffsetFromPoint(_x, _y, { bias }) { return bias === -1 ? 1 : 7 }
    getElementInfo() { return { latex: '\\JLa', bounds: { left: 20, right: 80, top: 10, bottom: 30 } } }
    insert(latex, options) { this.inserts.push({ latex, options, selection: this.selection }); this.value = '\\mathord{\\JLb}' }
  }
  const formulaLoader = createMetricLoader({ 'vue-i18n': { useI18n: () => ({ t: key => key }) },
    mathlive: { MathfieldElement: Mathfield }, 'mathlive/fonts.css': {} })
  const Editor = formulaLoader('components/Metric/template/TemplateFormulaEditor.vue').default
  const props = reactive({ modelValue: '#a', references: [{ key: 'a', label: '温度', expression: '#a', metricId:'temperature' }, { key: 'b', label: '湿度', expression: '#b' }], disabled: false,
    onChange(value) { changes.push(value); props.modelValue = value.expression } })
  const { renderer, root } = createMetricRenderer()
  const app = renderer.createApp({ setup: () => () => h(Editor, props) })
  const previews = []
  const { templateReferenceKey } = formulaLoader('components/Metric/template/templateReference.ts')
  app.provide(templateReferenceKey, { preview:id => previews.push(id), locate() {} })
  for (const type of ['a-radio-group', 'a-radio-button', 'a-button', 'a-select', 'a-textarea', 'a-alert']) {
    app.component(type, defineComponent({ inheritAttrs: false, setup: (_props, { attrs, slots, expose }) => {
      expose({ focus() {} }); return () => h(type, attrs, Object.entries(slots).flatMap(([name,slot]) => name === 'option' ? [] : slot?.()))
    } }))
  }
  app.config.warnHandler = () => {}; app.mount(root)
  const findClass = name => walk(root, node => node.props.class === name)[0]
  findClass('formula-editor__field').appendChild = () => {}
  findClass('formula-editor__canvas').getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, bottom: 64 })
  const picker = () => findClass('formula-editor__picker')
  const clickVariable = () => findClass('formula-editor__canvas').props.onPointerdownCapture({ button: 0, clientX: 40, clientY: 20,
    composedPath: () => [field], preventDefault() {}, stopPropagation() {} })
  try {
    await flush()
    const canvas = findClass('formula-editor__canvas')
    canvas.props.onPointermove({ clientX:40, clientY:20, composedPath:() => [field] })
    assert.equal(previews.at(-1), 'temperature')
    canvas.props.onKeyup(); assert.equal(previews.at(-1), 'temperature')
    canvas.props.onPointermove({ clientX:0, clientY:0, composedPath:() => [field] }); assert.equal(previews.at(-1), undefined)
    canvas.props.onPointermove({ clientX:40, clientY:20, composedPath:() => [] }); assert.equal(previews.at(-1), undefined)
    clickVariable(); await flush()
    assert.ok(picker())
    assert.deepEqual(picker().props.options.map(item => item.label), ['formulaData'])
    assert.deepEqual(picker().props.options.flatMap(item => item.options).map(item => item.label), ['温度', '湿度'])
    props.references[1].group = 'parameter'; await flush()
    clickVariable(); await flush()
    assert.deepEqual(picker().props.options.map(item => item.label), ['formulaData', 'formulaParameters'])
    assert.deepEqual(picker().props.options.flatMap(item => item.options).map(item => item.value), [0, 1])
    globalThis.document.activeElement = field
    picker().props.onDropdownVisibleChange(false); await flush(); assert.ok(picker())
    globalThis.document.activeElement = undefined
    field.selection = { ranges: [[99, 99]] }
    picker().props.onSelect(1); await flush()
    assert.deepEqual(field.inserts[0].selection, { ranges: [[1, 7]] })
    assert.equal(field.inserts[0].latex, '\\JLb')
    assert.equal(props.modelValue, '#b'); assert.equal(picker(), undefined)
    clickVariable(); await flush()
    picker().props.onKeydown({ key: 'Escape', stopPropagation() {}, preventDefault() {} }); await flush()
    assert.equal(picker(), undefined); assert.equal(changes.length, 1)
    clickVariable(); await flush(); props.modelValue = '#a + 2'; await flush()
    assert.equal(picker(), undefined)
    clickVariable(); await flush(); props.references[0].label = '进水温度'; await flush()
    assert.equal(picker(), undefined)
    clickVariable(); await flush(); const staleSelect = picker().props.onSelect
    props.disabled = true; await flush(); staleSelect(0); clickVariable(); await flush()
    assert.equal(picker(), undefined); assert.equal(field.readOnly, true); assert.equal(changes.length, 1)
  } finally { app.unmount(); globalThis.document = previousDocument }
})
