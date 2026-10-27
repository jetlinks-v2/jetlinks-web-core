import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url), cache = new Map()
const root = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/logs')
const dictionary = JSON.parse(readFileSync(resolve(import.meta.dirname, '../src/locales/lang/en.json'), 'utf8'))
const translate = (key, params = {}) => (dictionary[key] ?? key).replace(/\{(\w+)\}/g, (_, field) => params[field] ?? '')
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const source = readFileSync(filename, 'utf8')
  const script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'log-record-presentation', inlineTemplate: true }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: translate }) }
    if (id.endsWith('CodeBlock/index.vue')) return { __esModule: true, default: vue.defineComponent({ props: ['content'], setup: props => () => vue.h('pre', { class: 'test-raw-code' }, props.content) }) }
    if (id.startsWith('.')) { const file = resolve(dirname(filename), id); return load(existsSync(file) ? file : `${file}.ts`) }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports); return module.exports
}
const component = load(resolve(root, 'LogEntryLine.vue')).default
const wrapper = tag => vue.defineComponent({ setup(_, { attrs, slots }) { return () => vue.h(tag, attrs, slots.default?.()) } })
async function render(entry, props = {}) {
  const app = vue.createSSRApp({ render: () => vue.h(component, { entry, wrap: true, ...props }) })
  app.component('a-tooltip', wrapper('span')); app.component('a-button', wrapper('button'))
  return renderToString(app)
}

test('ordinary multiline body is one entry with one timestamp and no invented stack control', async () => {
  const message = 'received packet\nmessageId: 7\ndup: false\nretain: false\nwill: false\n\n<released>'
  const html = await render({ id: 'one', time: '2026-10-24 12:34:56.789', level: 'INFO', text: message, message })
  assert.equal((html.match(/<time\b/g) ?? []).length, 1)
  assert.ok(html.includes('messageId: 7\ndup: false\nretain: false\nwill: false\n\n&lt;released&gt;'))
  assert.ok(!html.includes('log-stack-toggle')); assert.ok(!html.includes('Stack'))
})

test('long body folds independently from exceptions and a search hit expands the complete message', async () => {
  const message = Array.from({ length: 12 }, (_, index) => `body line ${index}`).join('\n')
  const entry = { id: 'long', text: message, message }
  const collapsed = await render(entry)
  assert.ok(collapsed.includes(dictionary['runtimeDiagnostics.expandMessage'])); assert.ok(!collapsed.includes('body line 11'))
  const found = await render(entry, { query: 'body line 11', activeMatch: true })
  assert.ok(found.includes(dictionary['runtimeDiagnostics.collapseMessage'])); assert.ok(found.includes('body line 11'))
  assert.ok(!found.includes('log-stack-nowrap'))
})

test('real exception evidence stays in its own stack and expanded original text remains lossless', async () => {
  const message = 'received request\nmethod: POST\npath: /api'
  const stack = 'java.lang.IllegalStateException: failed\n\tat app.Worker.run(Worker.java:12)'
  const raw = `original header ${message}\n${stack}`
  const html = await render({ id: 'failed', level: 'ERROR', text: raw, message, stack, raw }, { expanded: true, activeMatch: true, query: 'Worker' })
  assert.ok(html.includes('log-stack')); assert.ok(html.includes('received request\nmethod: POST\npath: /api'))
  assert.ok(html.includes('test-raw-code')); assert.ok(html.includes(raw))
})

test('changed log record styles compile and new actions are bilingual', () => {
  for (const name of ['LogEntryLine.vue', 'LogEntryDetails.vue']) {
    const filename = resolve(root, name), { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ id: 'log-record', source: style.content, filename, scoped: style.scoped }).errors, [])
  }
  for (const language of ['zh', 'en']) {
    const messages = JSON.parse(readFileSync(resolve(import.meta.dirname, `../src/locales/lang/${language}.json`), 'utf8'))
    for (const key of ['expandMessage', 'collapseMessage']) assert.ok(messages[`runtimeDiagnostics.${key}`])
  }
})
