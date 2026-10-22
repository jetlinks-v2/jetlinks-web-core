import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { computed, createRenderer, defineComponent, Fragment, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { createReusableTemplate } from '@vueuse/core'
import { compileScript, parse } from 'vue/compiler-sfc'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const source = readFileSync(resolve(root, 'src/hooks/useEmptyCreateState.ts'), 'utf8')
const compiled = { exports: {} }
const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports)
const { useEmptyCreateState } = compiled.exports

test('only user filters affect empty creation while fixed query terms remain untouched', () => {
  const defaults = [{ column: 'parentId', value: 'parent-a' }]
  const submitted = ref([])
  const query = computed(() => ({ terms: [...defaults, ...submitted.value] }))
  const state = useEmptyCreateState(() => submitted.value)
  assert.equal(state.hasSearch.value, false)
  assert.equal(state.showEmptyCreate.value, true)

  submitted.value = [{ column: 'name', value: 'missing' }]
  assert.equal(state.hasSearch.value, true)
  assert.equal(state.showEmptyCreate.value, false)
  assert.deepEqual(query.value.terms, [...defaults, ...submitted.value])

  submitted.value = []
  assert.equal(state.showEmptyCreate.value, true)
  assert.deepEqual(query.value.terms, defaults)
})

test('keyword and boolean search sources support reactive clearing and ignore blank keywords', () => {
  const submitted = ref('  ')
  const keywordState = useEmptyCreateState(submitted)
  const explicitState = useEmptyCreateState(computed(() => submitted.value.trim().length > 0))
  for (const [keyword, expected] of [['  ', false], [' 温度 ', true], ['', false]]) {
    submitted.value = keyword
    assert.equal(keywordState.hasSearch.value, expected)
    assert.equal(explicitState.hasSearch.value, expected)
    assert.equal(keywordState.showEmptyCreate.value, !expected)
  }
})

test('public types accept search sources, expose readonly state and reject request wrappers', () => {
  const program = ts.createProgram([resolve(root, 'tests/emptyCreateState.type-test.ts')], {
    noEmit: true, strict: true, skipLibCheck: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler, types: [],
  })
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), [])
})

// 编译实际 SFC，通过 Vue 自定义渲染器验证插槽切换，不依赖后端或 DOM 环境。
const emptyFile = resolve(root, 'src/components/CloudEmpty/index.vue')
const { descriptor } = parse(readFileSync(emptyFile, 'utf8'), { filename: emptyFile })
const emptyScript = compileScript(descriptor, { id: 'empty-create-test', inlineTemplate: true })
const emptyModule = { exports: {} }
new Function('require', 'module', 'exports', transformSync(emptyScript.content, { loader: 'ts', format: 'cjs' }).code)(
  id => id.endsWith('.svg') ? id : id.endsWith('useEmptyCreateState') ? { useEmptyCreateState } : require(id),
  emptyModule,
  emptyModule.exports,
)
const CloudEmpty = emptyModule.exports.default

function mountEmptyView(component) {
  const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
  const renderer = createRenderer({
    createElement: type => node(type),
    createText: text => node('#text', text),
    createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text },
    setComment: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.text = text; target.children = [] },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
    patchProp: (target, key, _previous, value) => { target.props[key] = value },
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
      target.parent = parent
    },
    remove(target) {
      target.parent.children.splice(target.parent.children.indexOf(target), 1)
      target.parent = null
    },
  })
  const messages = Object.fromEntries(['zh', 'en'].map(locale => [locale, {
    'components.CloudEmpty.description': locale === 'zh' ? '暂无数据' : 'No data',
    'components.CloudEmpty.searchEmpty': JSON.parse(readFileSync(resolve(root, `src/locales/lang/${locale}.json`), 'utf8'))['components.CloudEmpty.searchEmpty'],
  }]))
  const i18n = createI18n({ legacy: false, locale: 'zh', messages, flatJson: true })
  const app = renderer.createApp(component)
  app.use(i18n)
  app.component('a-empty', defineComponent({
    props: ['description', 'image', 'imageStyle'],
    setup(props, { slots }) {
      return () => h('article', [h('p', slots.description?.() || props.description), slots.default?.()])
    },
  }))
  const container = node('root')
  app.mount(container)
  const find = (type, target = container) => [
    ...(target.type === type ? [target] : []),
    ...target.children.flatMap(child => find(type, child)),
  ]
  const text = (target = container) => target.type === '#comment' ? '' : target.text + target.children.map(text).join('')
  return { app, i18n, container, find, text }
}

test('CloudEmpty replaces description props and slots during search and restores creation after clearing', async () => {
  const search = ref([])
  const useDescriptionSlot = ref(false)
  const name = ref('设备')
  const view = mountEmptyView(defineComponent({
    setup: () => () => h(CloudEmpty, { search: search.value, searchName: name.value, description: '原空态描述' }, {
      ...(useDescriptionSlot.value ? { description: () => '原描述插槽' } : {}),
      default: () => h('button', '新增'),
    }),
  }))
  try {
    assert.equal(view.text(), '原空态描述新增')
    useDescriptionSlot.value = true
    await nextTick()
    assert.equal(view.text(), '原描述插槽新增')

    search.value = [{ column: 'name', value: 'missing' }]
    await nextTick()
    assert.equal(view.text(), '未找到匹配的设备')
    assert.equal(view.find('button').length, 0)

    view.i18n.global.locale.value = 'en'
    name.value = 'devices'
    await nextTick()
    assert.equal(view.text(), 'No matching devices found')

    search.value = []
    await nextTick()
    assert.equal(view.text(), '原描述插槽新增')
    useDescriptionSlot.value = false
    await nextTick()
    assert.equal(view.text(), '原空态描述新增')
  } finally {
    view.app.unmount()
  }
})

test('reused creation keeps the original handler, permission, disabled and loading states', async () => {
  const submitted = ref('')
  const draft = ref('')
  const allowed = ref(true)
  const disabled = ref(false)
  const loading = ref(false)
  let created = 0
  const create = () => { created += 1 }
  const view = mountEmptyView(defineComponent({
    setup() {
      const [DefineCreate, CreateButton] = createReusableTemplate()
      return () => h(Fragment, [
        h(DefineCreate, null, { default: () => allowed.value
          ? h('button', { disabled: disabled.value, loading: loading.value, onClick: create }, '新增')
          : null }),
        h(CreateButton),
        h(CloudEmpty, { search: submitted.value, searchName: '设备' }, { default: () => h(CreateButton) }),
      ])
    },
  }))
  try {
    draft.value = '尚未提交'
    await nextTick()
    assert.equal(view.find('button').length, 2, view.text())
    for (const button of view.find('button')) button.props.onClick()
    assert.equal(created, 2)

    disabled.value = true
    loading.value = true
    await nextTick()
    for (const button of view.find('button')) {
      assert.equal(button.props.disabled, true)
      assert.equal(button.props.loading, true)
    }

    submitted.value = draft.value
    await nextTick()
    assert.equal(view.find('button').length, 1)
    submitted.value = ''
    await nextTick()
    assert.equal(view.find('button').length, 2, view.text())
    allowed.value = false
    await nextTick()
    assert.equal(view.find('button').length, 0)
  } finally {
    view.app.unmount()
  }
})
