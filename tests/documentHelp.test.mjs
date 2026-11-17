import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import { createRenderer, defineComponent, effectScope, getCurrentInstance, h, nextTick, ref, watch } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createI18n, useI18n } from 'vue-i18n'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
function evaluate(source, dependencies = {}) {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(
    id => dependencies[id] ?? require(id), module, module.exports,
  )
  return module.exports
}
const hook = evaluate(readFileSync(resolve(root, 'src/hooks/useDocumentHelp.ts'), 'utf8'))
const { descriptor } = parse(readFileSync(resolve(root, 'src/components/DocumentHelp/index.vue'), 'utf8'))
const script = compileScript(descriptor, { id: 'document-help-test', inlineTemplate: true })
let configuredCalls = []
let configuredResponse = async () => ({ success: true, result: { content: '' } })
const documentHelpContent = evaluate(readFileSync(resolve(root, 'src/utils/documentHelpContent.ts'), 'utf8'))
const configuredHook = evaluate(readFileSync(resolve(root, 'src/hooks/useConfiguredDocumentHelp.ts'), 'utf8'), {
  '@jetlinks-web-core/api/document': { getDocumentHelpContent: (...args) => { configuredCalls.push(args); return configuredResponse(...args) } },
  '@jetlinks-web-core/utils/documentHelpContent': documentHelpContent,
  'vue-i18n': { useI18n: () => getCurrentInstance() ? useI18n() : { locale: ref('zh') } },
})
const component = evaluate(script.content, {
  '@jetlinks-web-core/hooks/useDocumentHelp': hook,
  '@jetlinks-web-core/hooks/useConfiguredDocumentHelp': configuredHook,
  './MarkdownPreview.vue': { __esModule: true, default: defineComponent({ props: ['content'], setup: props => () => h('markdown-preview', props.content) }) },
  vue: { ...require('vue'), defineAsyncComponent: () => defineComponent({ props: ['content'], setup: props => () => h('markdown-preview', props.content) }) },
}).default

function mountHelp(props = {}, slots = {}) {
  let popover
  const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
  const renderer = createRenderer({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.text = text; target.children = [] },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
    patchProp: (target, key, _previous, value) => { target.props[key] = value },
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
      target.parent = parent
    },
    remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
  })
  const app = renderer.createApp({ setup: () => () => h(component, { description: '功能说明', document: '/doc/device-access', ...props }, slots) })
  const messages = Object.fromEntries(['zh', 'en', 'ja'].map(locale => [locale,
    JSON.parse(readFileSync(resolve(root, `src/locales/lang/${locale}.json`), 'utf8')),
  ]))
  const i18n = createI18n({ legacy: false, locale: 'zh', flatJson: true, messages })
  app.use(i18n)
  app.component('a-popover', defineComponent({
    props: ['open', 'trigger', 'placement'], emits: ['update:open'],
    setup(props, context) {
      popover = { props, ...context }
      return () => h('popover', [context.slots.default?.(), props.open ? context.slots.content?.() : null])
    },
  }))
  app.component('a-button', defineComponent({ setup: (_, { attrs, slots }) => () => h('button', attrs, slots.default?.()) }))
  app.component('AIcon', defineComponent({ setup: (_, { attrs }) => () => h('icon', attrs) }))
  const container = node('root')
  app.mount(container)
  const find = (type, target = container) => [ ...(target.type === type ? [target] : []), ...target.children.flatMap(child => find(type, child)) ]
  const text = (target = container) => target.type === '#comment' ? '' : target.text + target.children.map(text).join('')
  return { app, i18n, find, text, get popover() { return popover } }
}
const invoke = (handler, event) => (Array.isArray(handler) ? handler : [handler]).forEach(fn => fn?.(event))

test('hover/focus/click entry renders localized description and closes after opening exact document', async t => {
  const view = mountHelp()
  t.after(() => view.app.unmount())
  assert.deepEqual(view.popover.props.trigger, ['hover', 'focus', 'click'])
  assert.equal(view.popover.props.placement, 'top')
  const trigger = view.find('button')[0]
  assert.equal(trigger.props['aria-label'], '功能说明')
  view.popover.emit('update:open', true); await nextTick()
  assert.equal(view.text(), '功能说明帮助文档')
  let stopped = false
  view.find('button')[1].props.onClick({ stopPropagation() { stopped = true } })
  await nextTick()
  assert.equal(stopped, true)
  assert.equal(hook.documentRequest.value.url, '/doc/device-access')
  assert.equal(view.popover.props.open, false)
  assert.equal(view.find('button')[0].props['aria-expanded'], false)
})

test('trigger and popup keyboard/click events do not reach sortable headers or row actions', async t => {
  const view = mountHelp()
  t.after(() => view.app.unmount())
  const trigger = view.find('button')[0]
  for (const key of ['Enter', ' ', 'Escape']) {
    let stops = 0
    invoke(trigger.props.onKeydown, { key, stopPropagation() { stops++ } })
    assert.ok(stops > 0, key)
    invoke(trigger.props.onKeyup, { key, stopPropagation() { stops++ } })
    assert.ok(stops > 1, key)
  }
  let clicked = false
  trigger.props.onClick({ stopPropagation() { clicked = true } })
  assert.equal(clicked, true)
  view.popover.emit('update:open', true); await nextTick()
  invoke(trigger.props.onKeydown, { key: 'Escape', stopPropagation() {} })
  await nextTick()
  assert.equal(view.popover.props.open, false)
})

test('content and trigger slots support a wide table while keeping the common document action', async t => {
  const view = mountHelp({ width: 600, placement: 'bottom' }, {
    default: () => h('span', '接入方式说明'),
    content: () => h('table', [h('tr', [h('td', '设备直连'), h('td', '网关接入')])]),
  })
  t.after(() => view.app.unmount())
  view.popover.emit('update:open', true); await nextTick()
  assert.equal(view.popover.props.placement, 'bottom')
  assert.equal(view.find('table').length, 1)
  assert.equal(view.find('div')[0].props.style.width, '600px')
  assert.match(view.text(), /接入方式说明设备直连网关接入帮助文档/)
  view.i18n.global.locale.value = 'en'; await nextTick()
  assert.match(view.text(), /Documentation/)
  view.i18n.global.locale.value = 'ja'; await nextTick()
  assert.match(view.text(), /ヘルプドキュメント/)
})

test('omitted and blank documents leave pure explanation without a link or footer; duplicate opens emit twice', async t => {
  const previous = hook.documentRequest.value
  for (const document of [undefined, '  ']) {
    const view = mountHelp({ document })
    t.after(() => view.app.unmount())
    view.popover.emit('update:open', true); await nextTick()
    assert.equal(view.text(), '功能说明')
    assert.equal(view.find('button').length, 1)
    assert.ok(view.find('div').every(item => !item.props.class?.includes('document-help__action')))
  }
  assert.equal(hook.documentRequest.value, previous)
  const seen = []
  const stop = watch(hook.documentRequest, value => seen.push(value.url), { flush: 'sync' })
  hook.openDocument('/doc/repeat')
  hook.openDocument('/doc/repeat')
  stop()
  assert.deepEqual(seen, ['/doc/repeat', '/doc/repeat'])
})

test('content slot opens an inline document and exposes close without requiring a footer document', async t => {
  const view = mountHelp({ document: undefined }, {
    content: ({ openDocument, close }) => [
      h('button', { onClick: () => openDocument(' /doc/inline-help ') }, '查看说明'),
      h('button', { onClick: close }, '关闭'),
      h('a', { href: 'https://example.com/help', target: '_blank', rel: 'noopener noreferrer' }, '外部链接'),
    ],
  })
  t.after(() => view.app.unmount())
  view.popover.emit('update:open', true); await nextTick()
  assert.equal(view.find('button').length, 3)
  assert.doesNotMatch(view.text(), /帮助文档/)
  assert.equal(view.find('a')[0].props.href, 'https://example.com/help')
  view.find('button')[1].props.onClick(); await nextTick()
  assert.equal(hook.documentRequest.value.url, '/doc/inline-help')
  assert.equal(view.popover.props.open, false)
  view.popover.emit('update:open', true); await nextTick()
  const previous = hook.documentRequest.value
  view.find('button')[2].props.onClick(); await nextTick()
  assert.equal(view.popover.props.open, false)
  assert.equal(hook.documentRequest.value, previous)
})

test('icon and color are configurable while a custom trigger slot replaces the icon', t => {
  const defaultView = mountHelp()
  const customView = mountHelp({ icon: 'InfoCircleOutlined', iconColor: 'var(--jet-theme-primary-color)' })
  const slotView = mountHelp({ icon: 'InfoCircleOutlined' }, { default: () => h('span', '详细说明') })
  t.after(() => [defaultView, customView, slotView].forEach(view => view.app.unmount()))
  assert.equal(defaultView.find('icon')[0].props.type, 'QuestionCircleOutlined')
  assert.equal(customView.find('icon')[0].props.type, 'InfoCircleOutlined')
  assert.equal(customView.find('icon')[0].props.style.color, 'var(--jet-theme-primary-color)')
  assert.equal(slotView.find('icon').length, 0)
  assert.equal(slotView.text(), '详细说明')
})

const flush = async () => { await nextTick(); await Promise.resolve(); await nextTick() }
test('registered points include unopened pages, resolve current labels and deduplicate only code/key pairs', () => {
  const registry = evaluate(readFileSync(resolve(root, 'src/utils/documentHelpRegistry.ts'), 'utf8'))
  let label = '配置设备'
  registry.registerDocumentHelpPoints([
    { code: 'overview', key: 'device', name: () => label, page: '概览' },
    { code: 'settings', key: 'device', name: '设备设置', page: '设置' },
  ])
  assert.equal(registry.getDocumentHelpPoints().length, 2)
  label = 'Configure devices'
  assert.equal(registry.getDocumentHelpPoints()[0].name, label)
  registry.registerDocumentHelpPoints([{ code: 'overview', key: 'device', name: '最新标签', page: '概览' }])
  assert.equal(registry.getDocumentHelpPoints().length, 2)
  assert.equal(registry.getDocumentHelpPoints()[0].name, '最新标签')
  assert.notEqual(registry.documentHelpPointId('a/b', 'c'), registry.documentHelpPointId('a', 'b/c'))
})

test('configured help preloads before showing its trigger and hover does not reload or resize content', async t => {
  configuredCalls = []
  let resolveContent
  configuredResponse = () => new Promise(resolve => { resolveContent = resolve })
  const view = mountHelp({ code: 'overview', helpKey: 'device' })
  t.after(() => view.app.unmount())
  assert.equal(configuredCalls.length, 1)
  assert.equal(view.find('button').length, 0, 'no premature question mark while loading')
  resolveContent({ success: true, result: { content: '**新的帮助说明**', enabled: true } }); await flush()
  assert.equal(view.find('button').length, 1)
  assert.deepEqual(configuredCalls[0][0], { code: 'overview', key: 'device' })
  view.popover.emit('update:open', true); await flush()
  assert.equal(configuredCalls.length, 1, 'hover uses prepared content')
  assert.equal(view.find('markdown-preview').length, 1)
  assert.match(view.text(), /新的帮助说明/)
  assert.doesNotMatch(view.text(), /加载|帮助文档/)
  view.popover.emit('update:open', false); await flush()
  view.popover.emit('update:open', true); await flush()
  assert.equal(configuredCalls.length, 1)
  assert.match(view.text(), /新的帮助说明/)
})

test('document content resolves all three languages and regional locales without changing Markdown or legacy fallback', () => {
  const { resolveDocumentHelpContent, hasDocumentHelpContent } = documentHelpContent
  const configuration = { content: '**默认正文**\n', i18nMessages: { content: { zh: '中文', en: 'English', ja: '日本語', 'en-gb': 'British English' } } }
  assert.equal(resolveDocumentHelpContent(configuration, 'zh'), '中文')
  assert.equal(resolveDocumentHelpContent(configuration, 'ZH_CN'), '中文')
  assert.equal(resolveDocumentHelpContent(configuration, 'en-US'), 'English')
  assert.equal(resolveDocumentHelpContent(configuration, 'en_GB'), 'British English')
  assert.equal(resolveDocumentHelpContent(configuration, 'ja-JP'), '日本語')
  assert.equal(resolveDocumentHelpContent(configuration, 'fr'), configuration.content)
  assert.equal(resolveDocumentHelpContent({ content: '旧正文' }, 'ja'), '旧正文')
  assert.equal(resolveDocumentHelpContent({ content: '保留默认', i18nMessages: { content: { en: '   ' } } }, 'en'), '保留默认')
  assert.equal(resolveDocumentHelpContent(undefined, 'zh'), '')
  assert.equal(hasDocumentHelpContent(configuration), true)
  assert.equal(hasDocumentHelpContent({ content: '', i18nMessages: { content: { ja: '日本語' } } }), true)
  assert.equal(hasDocumentHelpContent({ content: ' ', i18nMessages: { content: { zh: '', en: ' ', ja: '\n' } } }), false)
  assert.equal(hasDocumentHelpContent(undefined), false)
})

test('configured help uses the current locale and switches cached translations without another request', async t => {
  configuredCalls = []
  configuredResponse = async () => ({ success: true, result: {
    content: '默认说明', enabled: true, i18nMessages: { content: { zh: '中文说明', en: 'English help', ja: '日本語の説明' } },
  } })
  const view = mountHelp({ code: 'overview', helpKey: 'device' })
  t.after(() => view.app.unmount())
  await flush()
  view.popover.emit('update:open', true); await flush()
  assert.match(view.text(), /中文说明/)
  for (const [locale, content] of [['en-US', 'English help'], ['ja_JP', '日本語の説明'], ['fr', '默认说明']]) {
    view.i18n.global.locale.value = locale; await flush()
    assert.equal(view.find('button').length, 1)
    assert.equal(view.find('markdown-preview')[0].text, content)
  }
  assert.equal(configuredCalls.length, 1)
})

test('translation-only help stays hidden when the current language has no content and appears in its configured language', async t => {
  configuredCalls = []
  configuredResponse = async () => ({ success: true, result: {
    content: '', enabled: true, i18nMessages: { content: { ja: '日本語のみ' } },
  } })
  const view = mountHelp({ code: 'overview', helpKey: 'device' })
  t.after(() => view.app.unmount())
  await flush()
  assert.equal(view.find('button').length, 0)
  view.i18n.global.locale.value = 'ja'; await flush()
  assert.equal(view.find('button').length, 1)
  view.popover.emit('update:open', true); await flush()
  assert.equal(view.find('markdown-preview')[0].text, '日本語のみ')
  view.i18n.global.locale.value = 'en'; await flush()
  assert.equal(view.find('button').length, 0)
  assert.equal(configuredCalls.length, 1)
})

test('empty, disabled and failed configuration hide triggers while draft slots still preview', async t => {
  for (const result of [{ content: '', enabled: false }, { content: '已禁用的说明', enabled: false }, { content: '   ', enabled: true }, { content: '', enabled: false, i18nMessages: { content: { zh: '已禁用的翻译' } } }]) {
    configuredResponse = async () => ({ success: true, result })
    const view = mountHelp({ code: 'overview', helpKey: 'device' })
    await flush()
    assert.equal(view.find('button').length, 0)
    view.app.unmount()
  }
  configuredResponse = async () => { throw new Error('Unavailable') }
  const failed = mountHelp({ code: 'overview', helpKey: 'device' })
  t.after(() => failed.app.unmount())
  await flush()
  assert.equal(failed.find('button').length, 0)
  const calls = configuredCalls.length
  const custom = mountHelp({ code: 'overview', helpKey: 'device' }, { content: () => h('p', '管理页面草稿') })
  t.after(() => custom.app.unmount())
  custom.popover.emit('update:open', true); await flush()
  assert.equal(configuredCalls.length, calls)
  assert.match(custom.text(), /管理页面草稿/)
})

test('saved configuration refreshes mounted helpers; disabled or cleared help disappears', async t => {
  configuredResponse = async () => ({ success: true, result: { content: '旧版配置兼容说明' } })
  const view = mountHelp({ code: 'overview', helpKey: 'device' })
  t.after(() => view.app.unmount())
  await flush()
  assert.equal(view.find('button').length, 1)
  view.popover.emit('update:open', true); await flush()
  configuredResponse = async () => ({ success: true, result: { content: '兼容默认正文', enabled: true, i18nMessages: { content: { zh: '保存后的说明' } } } })
  configuredHook.notifyDocumentHelpConfigurationChanged(); await flush()
  assert.equal(view.find('button').length, 1)
  view.popover.emit('update:open', true); await flush()
  assert.match(view.text(), /保存后的说明/)
  configuredResponse = async () => ({ success: true, result: { content: '禁用保留的说明', enabled: false } })
  configuredHook.notifyDocumentHelpConfigurationChanged(); await flush()
  assert.equal(view.find('button').length, 0)
  assert.doesNotMatch(view.text(), /禁用保留/)
  configuredResponse = async () => ({ success: true, result: { content: '', enabled: false } })
  configuredHook.notifyDocumentHelpConfigurationChanged(); await flush()
  assert.equal(view.find('button').length, 0)
})

test('switching a configured point ignores old responses and disposal cancels preloading', async () => {
  configuredCalls = []
  const pending = []
  configuredResponse = () => new Promise(resolve => pending.push(resolve))
  const scope = effectScope()
  const open = ref(false)
  const point = ref({ code: 'overview', key: 'first' })
  const state = scope.run(() => configuredHook.useConfiguredDocumentHelp(open, () => point.value))
  assert.equal(configuredCalls.length, 1)
  point.value = { code: 'overview', key: 'second' }; await flush()
  assert.equal(configuredCalls[0][1].aborted, true)
  pending[1]({ success: true, result: { content: '新点位说明', enabled: true } }); await flush()
  pending[0]({ success: true, result: { content: '旧点位说明', enabled: true } }); await flush()
  assert.equal(state.content.value, '新点位说明')
  open.value = true; await flush()
  open.value = false; await flush()
  assert.equal(state.content.value, '新点位说明', 'closing retains prepared content')
  assert.equal(state.failed.value, false)
  point.value = { code: 'overview', key: 'third' }; await flush()
  scope.stop()
  assert.equal(configuredCalls[2][1].aborted, true)
  pending[2]({ success: true, result: { content: '卸载后响应', enabled: true } }); await flush()
  assert.equal(state.content.value, '')
})

test('KeepAlive first activation does not duplicate preloading and returning reloads enabled state', async () => {
  const lifecycle = {}, calls = []
  const response = { content: '说明', enabled: true }
  const keepAliveHook = evaluate(readFileSync(resolve(root, 'src/hooks/useConfiguredDocumentHelp.ts'), 'utf8'), {
    vue: { ...require('vue'), getCurrentInstance: () => ({}), onActivated: callback => { lifecycle.activate = callback }, onDeactivated: callback => { lifecycle.deactivate = callback } },
    '@jetlinks-web-core/api/document': { getDocumentHelpContent: async (...args) => { calls.push(args); return { success: true, result: { ...response } } } },
    '@jetlinks-web-core/utils/documentHelpContent': documentHelpContent,
    'vue-i18n': { useI18n: () => ({ locale: ref('zh') }) },
  })
  const scope = effectScope(), open = ref(false)
  const state = scope.run(() => keepAliveHook.useConfiguredDocumentHelp(open, () => ({ code: 'overview', key: 'device' })))
  lifecycle.activate(); await flush()
  assert.equal(calls.length, 1)
  assert.equal(state.visible.value, true)
  open.value = true
  lifecycle.deactivate(); await flush()
  assert.equal(open.value, false)
  assert.equal(calls[0][1].aborted, true)
  assert.equal(state.visible.value, false)
  response.enabled = false
  lifecycle.activate(); await flush()
  assert.equal(calls.length, 2)
  assert.equal(state.visible.value, false)
  scope.stop()
})

test('configured API reads existing system config without project or tenant context', async () => {
  const calls = []
  const configuration = { code: 'overview', key: 'device', content: '', enabled: true, i18nMessages: { content: { zh: '中文', en: 'English', ja: '日本語' } } }
  const api = evaluate(readFileSync(resolve(root, 'src/api/document.ts'), 'utf8'), {
    '@jetlinks-web/core': { request: { get: (...args) => { calls.push(args); return Promise.resolve({ success: true, result: { legacy: configuration } }) } } },
  })
  const signal = new AbortController().signal
  const response = await api.getDocumentHelpContent({ code: 'overview', key: 'device' }, signal)
  assert.deepEqual(response.result, configuration)
  assert.deepEqual(calls, [['/system/config/document-help', {}, {
    signal, hiddenError: true, projectContext: false, tenantDomain: false,
  }]])
})
