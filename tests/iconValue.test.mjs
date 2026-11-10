import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const directory = resolve(import.meta.dirname, '../src/components/IconValue')
const evaluate = (source, dependencies = {}) => {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(
    id => dependencies[id] ?? require(id), module, module.exports,
  )
  return module.exports
}
const component = (name, dependencies) => {
  const filename = resolve(directory, name)
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  return evaluate(compileScript(descriptor, { id: name, inlineTemplate: true }).content, dependencies).default
}
const values = evaluate(readFileSync(resolve(directory, 'iconValue.ts'), 'utf8'))
const { parseIconValue } = values
const View = component('IconValueView.vue', { './iconValue': values })
const AIcon = require('@jetlinks-web/components/lib/Icon/icon.js').default

async function renderView(value) {
  const app = createSSRApp(View, { value, fallbackText: '基础服务' })
  app.component('AIcon', AIcon)
  return renderToString(app)
}

test('存量裸图标值支持实际的 Outlined、Filled 和 TwoTone 图标', () => {
  for (const iconType of ['StepBackwardOutlined', 'StepBackwardFilled', 'AppstoreTwoTone']) {
    assert.deepEqual(parseIconValue(` ${iconType} `), { kind: 'font', iconType })
    assert.deepEqual(parseIconValue(`font:${iconType}`), { kind: 'font', iconType })
  }
})

test('普通文本、未知图标及非图标导出保持文本缩写', () => {
  for (const [value, text] of [
    ['Service', 'SE'], ['UnknownOutlined', 'UN'], ['UnknownFilled', 'UN'],
    ['UnknownTwoTone', 'UN'], ['getTwoToneColor', 'GE'], ['constructor', 'CO'],
  ]) {
    assert.deepEqual(parseIconValue(value), { kind: 'text', text })
  }
  assert.deepEqual(parseIconValue('基础服务'), { kind: 'text', text: '基础' })
})

test('已有颜色、图片、显式字体和空值格式保持原语义', () => {
  assert.deepEqual(parseIconValue('color:#1677ff:服务'), { kind: 'color', color: '#1677ff', label: '服务' })
  assert.deepEqual(parseIconValue('#abc'), { kind: 'color', color: '#abc' })
  assert.deepEqual(parseIconValue('rgba(0,0,0,0.5)'), { kind: 'color', color: 'rgba(0,0,0,0.5)' })
  for (const url of ['https://example.com/icon.png', '//example.com/icon.png', '/files/icon.png', 'data:image/png;base64,AA==']) {
    assert.deepEqual(parseIconValue(url), { kind: 'image', url })
    assert.deepEqual(parseIconValue(`img:${url}`), { kind: 'image', url })
  }
  assert.deepEqual(parseIconValue('font:icon-guanji'), { kind: 'font', iconType: 'icon-guanji' })
  for (const value of ['', ' ', null, undefined]) assert.deepEqual(parseIconValue(value), { kind: 'none' })
})

test('卡片展示组件将新旧两种图标值渲染为真实 SVG，不再展示 ST', async () => {
  for (const value of ['StepBackwardOutlined', 'font:StepBackwardOutlined']) {
    const html = await renderView(value)
    assert.match(html, /data-icon="step-backward"/)
    assert.match(html, /<svg/)
    assert.doesNotMatch(html, /icon-value-view__fallback/)
  }
  assert.match(await renderView('服务'), /icon-value-view__fallback/)
  assert.match(await renderView('服务'), /服务/)
})

test('编辑器回显存量裸图标，图标库再次选择后输出带 font: 前缀的存储值', async () => {
  const emitted = []
  let selectedIcon
  const Library = defineComponent({
    props: ['type'],
    emits: ['update:type'],
    setup(props, { emit }) {
      selectedIcon = props.type
      emit('update:type', 'StepForwardOutlined')
      return () => null
    },
  })
  const Editor = component('IconValueEditor.vue', {
    './iconValue': values,
    './IconValueView.vue': { __esModule: true, default: View },
    '../IconLibrary/index.vue': { __esModule: true, default: Library },
    '../Upload/Image/ImageUpload.vue': { __esModule: true, default: {} },
    'vue-i18n': { useI18n: () => ({ t: key => key }) },
  })
  const app = createSSRApp(Editor, {
    modelValue: 'StepBackwardOutlined',
    enableCropUpload: false,
    'onUpdate:modelValue': value => emitted.push(value),
  })
  const slotComponent = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  for (const name of ['ATabs', 'ATabPane', 'AInput', 'AButton']) app.component(name, slotComponent)
  app.component('AIcon', AIcon)
  await renderToString(app)
  assert.equal(selectedIcon, 'StepBackwardOutlined')
  assert.deepEqual(emitted, ['font:StepForwardOutlined'])
  assert.deepEqual(parseIconValue(emitted[0]), { kind: 'font', iconType: 'StepForwardOutlined' })
})
