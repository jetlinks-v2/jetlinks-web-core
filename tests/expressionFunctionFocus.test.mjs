import assert from 'node:assert/strict'
import test from 'node:test'
import { h } from 'vue'
import { createMetricLoader, createMetricRenderer, flush } from './helpers/metricRuntime.mjs'

for (const [id, count] of [['math.abs', 1], ['math.min', 2]]) {
  test(`函数菜单接管焦点后仍在原选区插入 ${id}`, async () => {
    let field, editor
    const previousDocument = globalThis.document
    globalThis.document = {}
    class Field {
      constructor() { field = this; this.value = '0'; this.selection = { ranges: [[1, 1]] }; this.inserts = [] }
      get lastOffset() { return 1 }
      getValue(start, end) { return typeof start === 'number' ? start === end ? '' : this.value : this.value }
      getElementInfo(offset) { return { latex: offset ? this.value : '', depth: 0 } }
      setAttribute() {}
      addEventListener() {}
      removeEventListener() {}
      focus() {}
      remove() {}
      executeCommand() { return true }
      insert(latex) { this.inserts.push({ latex, selection: structuredClone(this.selection) }); this.value = latex; return true }
    }
    const changes = []
    const load = createMetricLoader({
      'vue-i18n': { useI18n: () => ({ t: key => key }) },
      '@vueuse/core': { onClickOutside() {} },
      'mathlive': { MathfieldElement: Field },
      'mathlive/fonts.css': {},
      './math-semantic.css?inline': { __esModule: true, default: '' },
    })
    const { useMathEditor } = load('components/Expression/useMathEditor.ts')
    const { renderer, root } = createMetricRenderer()
    const app = renderer.createApp({ setup() {
      editor = useMathEditor({
        modelValue: { version: 1, root: { type: 'literal', valueType: 'int', value: '0' } },
        context: { references: [], functions: [{ id, name: id, returnType: 'number', minimumArguments: count, maximumArguments: count, parameters: [] }] },
      }, (...args) => changes.push(args))
      editor.host.value = { appendChild() {} }
      return () => h('div')
    } })
    try {
      app.mount(root)
      await flush()
      assert.equal(editor.ready.value, true)
      editor.functionMenuVisibilityChanged(true)
      editor.blurCommit() // Native focusout runs before the menu item's click.
      assert.equal(editor.functionMenuOpen.value, true, '菜单获得焦点不能被失焦提交关闭')
      assert.deepEqual(changes, [], '内部焦点转移不提交或清空草稿')
      field.selection = { ranges: [[0, 0]] }
      editor.chooseFunction({ key: id })
      assert.equal(field.inserts.length, 1)
      assert.deepEqual(field.inserts[0].selection.ranges, [[0, 1]], '使用打开菜单时保存的选区')
      assert.equal(field.inserts[0].latex.match(/#\?/g)?.length, count)
      assert.equal(editor.functionMenuOpen.value, false)
      field.value = '0'
      editor.blurCommit()
      assert.ok(changes.some(([event]) => event === 'update:modelValue'), '普通失焦仍提交有效公式')
    } finally {
      app.unmount()
      if (previousDocument === undefined) delete globalThis.document
      else globalThis.document = previousDocument
    }
  })
}
