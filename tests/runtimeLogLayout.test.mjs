import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..'), directory = resolve(root, 'src/components/RuntimeDiagnostics')
const { Spin, Alert, Empty, Result, Switch } = require('ant-design-vue')
const filename = resolve(directory, 'LogViewer.vue'), source = readFileSync(filename, 'utf8')
const style = compileStyle({ source: parse(source).descriptor.styles[0].content, id: 'data-v-log-layout', scoped: true })
assert.deepEqual(style.errors, [])
const cache = new Map()
function load(filename) {
  if (cache.has(filename)) return cache.get(filename)
  const source = readFileSync(filename, 'utf8')
  const script = filename.endsWith('.vue') ? compileScript(parse(source, { filename }).descriptor, { id: 'log-layout', inlineTemplate: true }).content : source
  const module = { exports: {} }
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id.endsWith('LogEntryLine.vue')) return { __esModule: true, default: vue.defineComponent({ render: () => vue.h('span', 'log evidence') }) }
    if (id.startsWith('.')) { const file = resolve(dirname(filename), id); return load(existsSync(file) ? file : `${file}.ts`) }
    return require(id)
  }, module, module.exports)
  cache.set(filename, module.exports)
  return module.exports
}
const wrapper = (tag = 'div') => vue.defineComponent({ setup(_, { slots, attrs }) { return () => vue.h(tag, attrs, slots.default?.()) } })
async function rendered(state, props = {}, slots = {}, options = {}) {
  const app = vue.createSSRApp({ render: () => vue.h(load(filename).default, { state, fileId: 'server.log', files: [{ id: 'server.log', name: 'server.log' }], entries: [{ id: 'first', text: 'evidence' }], ...props }, { 'console-actions': () => vue.h('span', { class: 'test-console-actions' }, 'Start receiving'), ...slots }) })
  // Spin and its state siblings are actual Ant components; attribute-forwarding stubs hide the original bug.
  app.component('a-spin', Spin); app.component('a-alert', Alert); app.component('a-empty', Empty); app.component('a-result', Result)
  for (const name of ['a-select', 'a-tooltip', 'a-space-compact', 'a-checkbox', 'a-input-search', 'a-menu', 'a-menu-item']) app.component(name, wrapper())
  app.component('a-popover', options.renderPopoverContent ? vue.defineComponent({ setup(_, { slots }) { return () => vue.h('div', [slots.default?.(), slots.content?.()]) } }) : wrapper())
  app.component('a-switch', Switch)
  app.component('a-button', wrapper('button'))
  const html = await renderToString(app)
  const ast = parse(`<template>${html}</template>`).descriptor.template.ast
  return { html, ast }
}
const children = node => node.children?.filter(child => child.type === 1) ?? []
const classes = node => node.props?.find(prop => prop.type === 6 && prop.name === 'class')?.value?.content.split(/\s+/) ?? []
function find(node, name) { if (classes(node).includes(name)) return node; for (const child of children(node)) { const match = find(child, name); if (match) return match } }
const direct = (node, name) => children(node).find(child => classes(child).includes(name))
// Match the compiled component rules against the real rendered ancestry, rather than assuming class forwarding.
function declarations(path) {
  const result = {}
  style.rawResult.root.walkRules(rule => {
    for (const selector of rule.selectors) {
      const parts = selector.replace(/\[data-v-log-layout\]/g, '').split(/\s*>\s*/)
      if (parts.some(part => !/^\.[\w-]+$/.test(part))) continue
      const chain = path.slice(-parts.length)
      if (chain.length === parts.length && parts.every((part, index) => classes(chain[index]).includes(part.slice(1)))) {
        rule.walkDecls(declaration => { result[declaration.prop] = declaration.value })
      }
    }
  })
  return result
}

test('production LogViewer passes remaining height through real Ant Spin wrappers in ready, loading and stale states', async () => {
  for (const status of ['ready', 'loading', 'stale']) {
    const { html, ast } = await rendered({ status, message: 'Retained evidence is stale' })
    assert.ok(html.includes('log evidence'))
    const reader = find(ast, 'log-reader'), owner = direct(reader, 'log-reader-state')
    assert.ok(owner, `${status}: an owned DOM element carries the layout class`)
    assert.equal(owner.tag, 'div')
    const spin = direct(owner, 'ant-spin-nested-loading'), container = spin && direct(spin, 'ant-spin-container')
    assert.ok(spin); assert.ok(container)
    const window = direct(container, 'log-reader-window'), stream = window && direct(window, 'log-stream')
    assert.ok(window); assert.ok(stream)
    const path = [reader, owner, spin, container, window, stream]
    for (let index = 1; index < path.length; index++) {
      const css = declarations(path.slice(0, index + 1))
      assert.equal(css.flex, '1', `${status}: ${classes(path[index])[0]} receives remaining height`)
      assert.equal(css['min-height'], '0', `${status}: ${classes(path[index])[0]} can shrink`)
    }
    assert.equal(declarations(path.slice(0, 4))['flex-direction'], 'column')
    assert.equal(declarations(path).overflow, 'auto')
    assert.equal(!!direct(container, 'ant-alert'), status === 'stale', 'stale notice shares the flex column above the retained window')
    assert.equal(classes(container).includes('ant-spin-blur'), status === 'loading')
  }
})

test('production LogViewer keeps real error, forbidden and empty states inside the scrollable height chain', async () => {
  for (const status of ['error', 'forbidden', 'empty', 'unsupported']) {
    const { ast } = await rendered({ status, message: 'Retry this file' })
    const owner = find(ast, 'log-reader-state'), spin = owner && direct(owner, 'ant-spin-nested-loading'), container = spin && direct(spin, 'ant-spin-container')
    assert.ok(container, status)
    assert.equal(declarations([owner, spin, container]).overflow, 'auto', `${status}: a small available height does not clip state actions`)
    assert.ok(find(container, status === 'error' || status === 'forbidden' ? 'ant-result' : 'ant-empty'))
    assert.equal(find(container, 'log-reader-window'), undefined, 'unavailable states do not expose previous log rows')
  }
})

test('real compiled Vue template keeps file controls and console controls in their own explicit source mode', async () => {
  const file = await rendered({ status: 'ready' }, { isConsole: false })
  assert.ok(file.html.includes('runtimeDiagnostics.selectFile')); assert.ok(file.html.includes('runtimeDiagnostics.logMoreOptions'))
  assert.ok(!file.html.includes('test-console-actions')); assert.ok(file.html.includes('runtimeDiagnostics.continuousUpdate'))
  const live = await rendered({ status: 'ready' }, { isConsole: true })
  assert.ok(!live.html.includes('runtimeDiagnostics.selectFile')); assert.ok(!live.html.includes('runtimeDiagnostics.continuousUpdate'))
  assert.ok(live.html.includes('test-console-actions')); assert.ok(live.html.includes('runtimeDiagnostics.consoleResumeScroll'))
})

function byAttribute(node, name, value) {
  if (node.props?.some(prop => prop.type === 6 && prop.name === name && prop.value?.content === value)) return node
  for (const child of children(node)) { const match = byAttribute(child, name, value); if (match) return match }
}
const disabled = node => !!node?.props?.some(prop => prop.type === 6 && prop.name === 'disabled')

test('file-selector slot replaces only selection while embedded reader keeps file actions and a footer update action', async () => {
  const { html, ast } = await rendered({ status: 'ready' }, { embedded: true, exportAccess: { allowed: true } }, {
    'file-selector': () => vue.h('strong', { class: 'current-file' }, 'application.log'),
  })
  assert.ok(find(ast, 'current-file')); assert.ok(classes(find(ast, 'log-reader')).includes('log-reader--embedded'))
  assert.ok(!html.includes('placeholder="runtimeDiagnostics.selectFile"'), 'host file identity replaces the default select')
  assert.equal(disabled(byAttribute(ast, 'aria-label', 'runtimeDiagnostics.refresh')), false)
  assert.ok(html.includes('runtimeDiagnostics.continuousUpdate'))
  assert.equal((html.match(/role="switch"/g) ?? []).length, 0)
  const footer = find(ast, 'log-window-toolbar')
  assert.equal(children(footer).filter(node => node.tag === 'button').length, 1, 'following is controlled once in the footer')
})

test('file feedback only renders the real request state and hides updates for read-only sources', async () => {
  const active = await rendered({ status: 'ready' }, { loading: true, updatedAt: 1792840000000 })
  assert.ok(active.html.includes('runtimeDiagnostics.updating'))
  assert.ok(active.html.includes('runtimeDiagnostics.updatedAt'))
  const archive = await rendered({ status: 'ready' }, { followAccess: { allowed: false } })
  assert.ok(!archive.html.includes('runtimeDiagnostics.continuousUpdate'))
})

test('compiled refresh and footer update actions disable while reading, forbidden or without a selected file', async () => {
  for (const [state, props] of [[{ status: 'ready' }, { fileBusy: true }], [{ status: 'loading' }, {}], [{ status: 'forbidden' }, {}], [{ status: 'ready' }, { fileId: '' }]]) {
    const { ast } = await rendered(state, { exportAccess: { allowed: true }, ...props })
    assert.equal(disabled(byAttribute(ast, 'aria-label', 'runtimeDiagnostics.refresh')), true, `${state.status} ${JSON.stringify(props)}: refresh`)
  }
  for (const [props, reason] of [[{ exportAccess: { allowed: false } }, 'runtimeDiagnostics.forbidden'], [{ exportAccess: { allowed: true }, fileBusy: true }, 'runtimeDiagnostics.updating'], [{ exportAccess: { allowed: true }, fileId: '' }, 'runtimeDiagnostics.selectFile']]) {
    const { ast } = await rendered({ status: 'ready' }, props, {}, { renderPopoverContent: true })
    const blocked = find(ast, 'log-disabled-action')
    assert.ok(blocked, `${reason}: disabled export exposes a focusable reason`)
    assert.equal(blocked.tag, 'span'); assert.ok(disabled(children(blocked)[0]), `${reason}: export cannot dispatch`)
  }
  const allowed = await rendered({ status: 'ready' }, { exportAccess: { allowed: true } }, {}, { renderPopoverContent: true })
  assert.equal(find(allowed.ast, 'log-disabled-action'), undefined, 'available export uses its enabled action branch')
  const { ast } = await rendered({ status: 'ready' }, { exportAccess: { allowed: false } })
  assert.equal(disabled(byAttribute(ast, 'aria-label', 'runtimeDiagnostics.refresh')), false, 'export permission is independent from reading')
})

test('portal level and More menus focus their first action and Escape returns to the matching trigger', () => {
  const source = readFileSync(filename, 'utf8')
  assert.match(source, /@open-change="setLevelMenuOpen"/)
  assert.match(source, /@open-change="setMoreMenuOpen"/)
  assert.match(source, /ref="levelMenuPopover"/)
  assert.match(source, /ref="moreMenuPopover"/)
  assert.match(source, /@keydown\.arrow-down\.prevent="setLevelMenuOpen\(true\)" @keydown\.tab="focusOpenedLevelMenu\(\$event\)"/)
  assert.match(source, /@keydown\.arrow-down\.prevent="setMoreMenuOpen\(true\)" @keydown\.tab="focusOpenedMoreMenu\(\$event\)"/)
  assert.match(source, /@keydown\.esc\.stop="closeMenus\(true\)"/)
  assert.match(source, /import \{ createVisiblePopupFocus \} from '\.\/popupFocus'/)
  assert.match(source, /const menuFocus = createVisiblePopupFocus\(\)/)
  assert.match(source, /onDeactivated\(closeMenus\)\n?onBeforeUnmount\(closeMenus\)/)
  assert.match(source, /getPopupDomNode\?: \(\) => HTMLElement \| undefined/)
  assert.match(source, /function scheduleMenuFocus\(popover: typeof levelMenuPopover, isActive: \(\) => boolean\) \{ menuFocus\.focus\(\{ getPopup: \(\) => popover\.value\?\.getPopupDomNode\?\.\(\), isActive \}\) \}/)
  assert.match(source, /if \(levelOpen\) focusTrigger\(levelMenuTrigger\); else if \(moreOpen\) focusTrigger\(moreMenuTrigger\)/)
})
