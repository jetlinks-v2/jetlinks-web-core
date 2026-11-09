import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRoot = resolve(coreRoot, '..')
const chromeBinary = process.env.AUTO_TREE_CHROME ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync)
assert.ok(chromeBinary, 'Set AUTO_TREE_CHROME to a Chrome or Chromium executable')
const require = createRequire(join(runtimeRoot, 'package.json'))
const { build } = require('esbuild')
const { parse, compileScript, compileStyleAsync } = require('vue/compiler-sfc')
const viewStyles = []
const source = `
import { createApp, defineComponent, h, reactive, ref, nextTick, Suspense } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd, { ConfigProvider, Select, Spin } from 'ant-design-vue'
import AutoTree from ${JSON.stringify(join(coreRoot, 'src/components/AutoTree'))}
import FullPage from ${JSON.stringify(join(coreRoot, 'src/layout/FullPage.vue'))}
import EqualHeightColumns from ${JSON.stringify(join(coreRoot, 'src/components/EqualHeightColumns/index.vue'))}
const parameters = new URLSearchParams(location.search)
const makeRows = (count = 10000) => Array.from({length: count}, (_, index) => ({ key: 'node-' + index, id: 'node-' + index, label: 'Node ' + index }))
const state = reactive({
  mode: 'flex', frameHeight: 480, footerHeight: 36, epoch: 0,
  selected: [], checked: [], expanded: [], events: [], data: makeRows(parameters.has('small') ? 2 : 10000),
  explicit: undefined, virtual: undefined, providerVirtual: undefined,
  treeStyle: { color: 'rgb(12, 34, 56)' }, pageVisible: true, revisit: false, optionValue: undefined,
})
globalThis.apiState = state
globalThis.makeRows = makeRows
const tree = ref()
globalThis.apiTree = tree
globalThis.treeFlush = async () => { await nextTick(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) }
const styles = () => ({
  display: state.mode === 'flex' ? 'flex' : state.mode === 'grid' ? 'grid' : 'block',
  flexDirection: 'column', gridTemplateRows: '44px minmax(0, 1fr) ' + state.footerHeight + 'px',
  gap: '10px', height: ['flex', 'grid'].includes(state.mode) ? state.frameHeight + 'px' : 'auto',
  maxHeight: state.mode === 'max' ? state.frameHeight + 'px' : undefined,
})
const renderTree = () => h(AutoTree, {
    key: state.epoch, ref: tree, treeData: state.data, fieldNames: { key: 'id', title: 'label', children: 'nodes' },
    checkable: true, selectedKeys: state.selected, checkedKeys: state.checked, expandedKeys: state.expanded,
    'onUpdate:selectedKeys': value => { state.selected = value },
    'onUpdate:checkedKeys': value => { state.checked = value },
    'onUpdate:expandedKeys': value => { state.expanded = value },
    onSelect: (...args) => state.events.push(['select', ...args]),
    onCheck: (...args) => state.events.push(['check', ...args]),
    onExpand: (...args) => state.events.push(['expand', ...args]),
    onLoad: (...args) => state.events.push(['load', ...args]),
    loadData: async node => {
      if (node.key !== 'lazy') return
      state.events.push(['loadData', node.key])
      await new Promise(resolve => setTimeout(resolve, 30))
      state.data[0].nodes = [{ key: 'loaded-child', id: 'loaded-child', label: 'Loaded child', isLeaf: true }]
    },
    height: state.explicit, virtual: state.virtual,
    id: 'consumer-tree', class: 'consumer-tree', style: state.treeStyle,
    'aria-label': 'Existing aria label', 'data-consumer': 'original',
  }, { title: node => h('span', { 'data-node': node.key }, node.label) })
const renderTreePage = () => h(ConfigProvider, { virtual: state.providerVirtual }, { default: () => h('div', { class: 'frame', style: styles() }, [
  h('div', { class: 'header', style: { height: '44px', flex: 'none' } }, 'Header'),
  renderTree(),
  h('div', { class: 'footer', style: { height: state.footerHeight + 'px', flex: 'none' } }, 'Footer'),
]) })
const box = (className, style, children) => h('div', { class: className, style }, children)
// 保留设备页的真实布局组件及侧栏高度链，覆盖 FullPage 延迟定高与插槽下的异步挂载。
const renderDevicePage = () => box('content-panel', { width: '1000px', marginTop: '100px' }, [
  h(FullPage, { flex: true }, { default: () => h(EqualHeightColumns, {
    leftWidth: '240px', rightWidth: '1fr', style: { flex: '1 1 0', minHeight: 0 },
  }, {
    left: () => h(Spin, { spinning: false, style: { height: '100%', minHeight: 0 } }, { default: () =>
      box('device-scope', { display: 'grid', gridTemplateRows: 'auto auto minmax(0, 1fr)', gap: '16px', minHeight: 0, height: '100%', overflow: 'hidden' }, [
        box('tabs', { height: '32px' }, 'Tabs'), box('search', { height: '32px' }, 'Search'),
        box('scope-body', { display: 'flex', flexDirection: 'column', minHeight: 0 }, [
          box('scope-scroll', { minHeight: 0, flex: 1, overflow: 'auto' }, [renderTree()]),
        ]),
      ]),
    }),
    right: () => h('div', 'Device table'),
  }) }),
])
const renderSelectPage = () => h('div', { class: 'frame' }, [
  h(Select, {
    open: true, virtual: true, listHeight: 180, style: { width: '240px' },
    value: state.optionValue, onChange: value => { state.optionValue = value },
    options: Array.from({ length: 300 }, (_, index) => ({ value: 'option-' + index, label: 'Option ' + index })),
  }),
])
const renderPage = parameters.get('consumer') === 'select' ? renderSelectPage : parameters.has('async') ? renderDevicePage : renderTreePage
const Page = defineComponent({ setup: () => renderPage })
// 在真实 pending Suspense 下创建页面；返回时使用相同视图的已解析入口。
const AsyncPage = defineComponent({ async setup() {
  await new Promise(resolve => setTimeout(resolve, 30))
  return renderPage
} })
const app = createApp({ setup() { return () => state.pageVisible
  ? parameters.has('async') ? h(Suspense, null, { default: () => h(state.revisit ? Page : AsyncPage) }) : h(Page)
  : h('div', 'Another page')
} })
app.use(Antd)
app.use(AutoTree)
app.use(createI18n({ legacy: false, locale: 'zh', messages: { zh: { components: { EqualHeightColumns: { expand: 'Expand', collapse: 'Collapse' } } } } }))
app.component('AIcon', { render: () => null })
globalThis.peakTreeNodes = 0
new MutationObserver(() => {
  globalThis.peakTreeNodes = Math.max(globalThis.peakTreeNodes, document.querySelectorAll('.ant-tree-list-holder-inner .ant-tree-treenode').length)
}).observe(document.body, { childList: true, subtree: true })
app.mount('#app')
`
const bundled = await build({
  absWorkingDir: runtimeRoot, stdin: { contents: source, resolveDir: runtimeRoot, loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'real-tree-harness', setup(context) {
    context.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const { descriptor } = parse(await readFile(path, 'utf8'))
      for (const style of descriptor.styles) {
        const result = await compileStyleAsync({ source: style.content, filename: path, id: 'auto-tree-harness', scoped: false, preprocessLang: style.lang })
        assert.deepEqual(result.errors, [])
        viewStyles.push(result.code)
      }
      const imports = path.endsWith('/FullPage.vue') ? "import { ref, computed, onMounted, onBeforeUnmount } from 'vue'\n" : ''
      return { contents: imports + compileScript(descriptor, { id: 'auto-tree-harness', inlineTemplate: true }).content, loader: 'ts' }
    })
  } }],
})
const resetStyle = await readFile(require.resolve('ant-design-vue/dist/reset.css'), 'utf8')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>${resetStyle}\n${viewStyles.join('\n')}\n:root{--space-8:32px;--jet-theme-stroke-width:1px;--line-strong:#ccc}.ant-spin-container{height:100%;min-height:0}html,body{margin:0}#app{width:360px}.frame{margin:20px;padding:12px;border:2px solid #ccc;box-sizing:border-box;width:320px}.header,.footer{box-sizing:border-box}</style></head><body><div id="app"></div><script src="/tree.js"></script></body></html>`
const server = createServer((request, response) => { response.setHeader('content-type', request.url === '/tree.js' ? 'text/javascript' : 'text/html'); response.end(request.url === '/tree.js' ? bundled.outputFiles[0].text : html) })
server.listen(0, '127.0.0.1')
await once(server, 'listening')
const port = server.address().port
const profile = await mkdtemp(join(tmpdir(), 'auto-tree-chrome-'))
const chrome = spawn(chromeBinary, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=0', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
let socket
try {
  const endpoint = await new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000)
    chrome.stderr.on('data', chunk => { buffer += chunk; const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]) } })
    chrome.once('error', reject)
  })
  socket = new WebSocket(endpoint)
  await once(socket, 'open')
  let id = 0
  const pending = new Map()
  const browserErrors = []
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data)
    if (data.id && pending.has(data.id)) { const { resolve, reject } = pending.get(data.id); pending.delete(data.id); data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result) }
    if (data.method === 'Runtime.exceptionThrown') browserErrors.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description ?? ''))
  })
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const nextId = ++id; pending.set(nextId, { resolve, reject }); socket.send(JSON.stringify({ id: nextId, method, params, ...(sessionId ? { sessionId } : {}) })) })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const command = (method, params) => send(method, params, sessionId)
  await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false })
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async (expression, description) => {
    const deadline = Date.now() + 12000
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 80)) }
    throw new Error('Timed out: ' + description + '; browser errors: ' + JSON.stringify(browserErrors))
  }
  /** 使用真实输入验证滚轮绑定、单次位移与滚动归属，程序化 scrollTo 无法发现漏绑。 */
  const wheel = async (selector, deltaY = 120) => {
    const before = await evaluate(`(() => { const holder = document.querySelector(${JSON.stringify(selector)}), rect = holder.getBoundingClientRect(); return { top: holder.scrollTop, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } })()`)
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: before.x, y: before.y })
    await command('Input.dispatchMouseEvent', { type: 'mouseWheel', x: before.x, y: before.y, deltaX: 0, deltaY })
    await waitFor(`document.querySelector(${JSON.stringify(selector)})?.scrollTop > ${before.top}`, 'wheel scroll for ' + selector)
    await evaluate('treeFlush()')
    const top = await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollTop`)
    assert.ok(Math.abs(top - before.top - deltaY) <= 1, 'one wheel input must scroll once: ' + JSON.stringify({ before: before.top, top, deltaY }))
    assert.equal(await evaluate('document.scrollingElement.scrollTop'), 0, 'wheel must stay inside the list')
    return { before: before.top, top, deltaY }
  }
  await command('Page.navigate', { url: 'http://127.0.0.1:' + port })
  await waitFor('globalThis.apiState && document.querySelector(".ant-tree-list-holder")?.clientHeight > 100', 'mounted tree')
  const metrics = () => evaluate(`(() => {
    const root = document.querySelector('.consumer-tree'), holder = root.querySelector('.ant-tree-list-holder');
    const frame = document.querySelector('.frame'), footer = document.querySelector('.footer');
    const box = root.getBoundingClientRect(), bottom = footer.getBoundingClientRect();
    return { mode: apiState.mode, height: holder.clientHeight, maxHeight: parseFloat(holder.style.maxHeight), nodes: root.querySelectorAll('.ant-tree-list-holder-inner .ant-tree-treenode').length, treeTop: box.top, treeBottom: box.bottom, footerTop: bottom.top, frameBottom: frame.getBoundingClientRect().bottom, bodyHeight: document.documentElement.scrollHeight, viewport: innerHeight }
  })()`)
  const results = []
  const validateLayout = async scenario => {
    await evaluate('treeFlush()')
    const value = await metrics()
    assert.ok(value.nodes > 0 && value.nodes < 100, JSON.stringify(value))
    assert.ok(value.maxHeight > 100, JSON.stringify(value))
    assert.ok(value.treeBottom <= value.footerTop + 1, JSON.stringify(value))
    assert.ok(value.frameBottom <= value.viewport + 1, JSON.stringify(value))
    results.push({ scenario, ...value })
    return value
  }
  const flex = await validateLayout('direct flex container')
  assert.equal(flex.maxHeight, 352)
  results.push({ scenario: 'synchronous tree handles native wheel exactly once', ...await wheel('.ant-tree-list-holder') })
  await evaluate('apiTree.value.scrollTo({ top: 0 }); treeFlush()')
  assert.ok(await evaluate('peakTreeNodes < 100'), '10000 rows must remain virtual during first render')
  results.push({ scenario: '10000 nodes remain virtual during initial render', peakNodes: await evaluate('peakTreeNodes') })
  assert.deepEqual(await evaluate(`(() => { const root = document.querySelector('.consumer-tree'), attrs = document.querySelector('[data-consumer]'); return { direct: root.parentElement.className, className: root.classList.contains('consumer-tree'), color: getComputedStyle(attrs).color, aria: attrs.getAttribute('aria-label'), data: attrs.dataset.consumer, exposed: typeof apiTree.value.scrollTo, ref: !!apiTree.value.treeRef } })()`), { direct: 'frame', className: true, color: 'rgb(12, 34, 56)', aria: 'Existing aria label', data: 'original', exposed: 'function', ref: true })
  results.push({ scenario: 'root DOM attributes and original public instance preserved' })

  await evaluate(`apiState.frameHeight = 340; treeFlush()`)
  await waitFor(`document.querySelector('.ant-tree-list-holder').clientHeight <= 213`, 'container resize')
  const resized = await validateLayout('container height changes without window resize')
  assert.equal(resized.maxHeight, 212)
  await evaluate(`apiState.footerHeight = 80; treeFlush()`)
  await waitFor(`document.querySelector('.ant-tree-list-holder').clientHeight <= 169`, 'sibling resize')
  assert.equal((await validateLayout('sibling consumes additional space')).maxHeight, 168)
  await evaluate(`apiState.frameHeight = 480; apiState.footerHeight = 36; apiState.mode = 'grid'; treeFlush()`)
  await waitFor(`document.querySelector('.ant-tree-list-holder').clientHeight >= 350`, 'grid layout')
  assert.equal((await validateLayout('direct grid container')).maxHeight, 352)

  await evaluate(`apiState.mode = 'natural'; apiState.epoch++; treeFlush()`)
  const natural = await validateLayout('natural document flow uses viewport bound')
  assert.ok(natural.maxHeight > flex.maxHeight)
  await evaluate(`apiState.mode = 'max'; apiState.frameHeight = 360; apiState.epoch++; treeFlush()`)
  const capped = await validateLayout('CSS max-height container')
  assert.ok(capped.frameBottom <= 380)
  assert.equal(capped.maxHeight, 252)

  await evaluate(`apiState.mode = 'flex'; apiState.frameHeight = 480; apiState.treeStyle = { maxHeight: '180px', overflowY: 'auto' }; apiState.epoch++; treeFlush()`)
  assert.equal((await metrics()).maxHeight, 180)
  results.push({ scenario: 'native style max-height remains the scroll viewport bound' })
  await evaluate(`apiState.treeStyle = {}; apiState.mode = 'natural'; treeFlush()`)
  assert.ok((await metrics()).maxHeight > 600)
  results.push({ scenario: 'layout constraint removed without remounting the tree' })
  await evaluate(`apiState.mode = 'flex'; apiState.epoch++; treeFlush()`)
  await evaluate(`apiTree.value.scrollTo({ key: 'node-9999', align: 'bottom' }); treeFlush()`)
  await waitFor(`document.querySelector('[data-node="node-9999"]')`, 'public scrollTo final key')
  await evaluate(`document.querySelector('[data-node="node-9999"]').click(); treeFlush()`)
  assert.deepEqual(await evaluate('Array.from(apiState.selected)'), ['node-9999'])
  assert.deepEqual(await evaluate(`apiState.events.filter(event => event[0] === 'select').map(event => ({ keys: Array.from(event[1]), key: event[2].node.key, selected: event[2].selected }))`), [{ keys: ['node-9999'], key: 'node-9999', selected: true }])
  await evaluate(`document.querySelector('[data-node="node-9999"]').closest('.ant-tree-treenode').querySelector('.ant-tree-checkbox').click(); treeFlush()`)
  assert.deepEqual(await evaluate('Array.from(apiState.checked)'), ['node-9999'])
  assert.equal(await evaluate(`apiState.events.filter(event => event[0] === 'check').length`), 1)
  results.push({ scenario: 'real scrollTo, custom fieldNames, title slot, selection and checking with v-model and original event payloads' })

  await evaluate(`apiState.selected = []; apiState.checked = []; apiState.expanded = []; apiState.data = [{ key: 'lazy', id: 'lazy', label: 'Lazy root' }]; treeFlush()`)
  await evaluate(`document.querySelector('.ant-tree-switcher').click(); treeFlush()`)
  await waitFor(`document.querySelector('[data-node="loaded-child"]')`, 'lazy-loaded child')
  assert.deepEqual(await evaluate('Array.from(apiState.expanded)'), ['lazy'])
  assert.equal(await evaluate(`apiState.events.filter(event => event[0] === 'loadData').length`), 1)
  assert.equal(await evaluate(`apiState.events.filter(event => event[0] === 'load').length`), 1)
  results.push({ scenario: 'real loadData, onLoad and controlled expansion' })

  await evaluate(`apiState.data = makeRows(80); apiState.explicit = 123; treeFlush()`)
  assert.equal((await metrics()).maxHeight, 123)
  await evaluate(`apiState.virtual = false; treeFlush()`)
  assert.equal((await metrics()).nodes, 80)
  results.push({ scenario: 'virtual=false preserves native scrolling', ...await wheel('.ant-tree-list-holder') })
  await evaluate(`apiState.virtual = undefined; apiState.providerVirtual = false; treeFlush()`)
  assert.equal((await metrics()).nodes, 80)
  await evaluate(`apiState.virtual = true; treeFlush()`)
  assert.ok((await metrics()).nodes < 30)
  results.push({ scenario: 'explicit height and virtual preserve Tree and ConfigProvider behavior' })

  /** 每次导航重新加载脚本，确保测试覆盖冷启动，而非已经解析的异步模块缓存。 */
  const navigateTree = async query => {
    await command('Page.navigate', { url: 'http://127.0.0.1:' + port + query })
    await waitFor('globalThis.apiState && parseFloat(document.querySelector(".ant-tree-list-holder")?.style.maxHeight) > 100', 'async tree viewport')
    await evaluate('treeFlush()')
  }
  await navigateTree('?async')
  results.push({ scenario: 'cold Suspense mount binds wheel with all rows present', ...await wheel('.ant-tree-list-holder') })
  assert.ok(await evaluate('peakTreeNodes < 100'), 'cold async mount must remain virtual')
  await evaluate('globalThis.reloadPending = true')
  await command('Page.reload', { ignoreCache: true })
  await waitFor('!globalThis.reloadPending && globalThis.apiState && document.querySelector(".ant-tree-list-holder")?.clientHeight > 100', 'refreshed async tree')
  results.push({ scenario: 'refreshing the async page binds wheel again', ...await wheel('.ant-tree-list-holder') })

  await navigateTree('?async&small')
  assert.equal(await evaluate('apiState.data.length'), 2)
  await evaluate('apiState.data = makeRows(); treeFlush()')
  await waitFor('document.querySelector(".ant-tree-list-holder")?.clientHeight > 100', 'asynchronous data fills the viewport')
  results.push({ scenario: 'two initial scope nodes followed by asynchronous data retain wheel support', ...await wheel('.ant-tree-list-holder') })
  await evaluate('apiState.data = makeRows(2); treeFlush()')
  await evaluate('apiState.data = makeRows(); treeFlush()')
  await waitFor('document.querySelector(".ant-tree-list-holder")?.scrollTop === 0', 'filter clamps scroll position')
  results.push({ scenario: 'filtering and clearing data preserve the existing wheel binding', ...await wheel('.ant-tree-list-holder') })
  await evaluate('apiState.pageVisible = false; apiState.revisit = true; treeFlush()')
  await waitFor('!document.querySelector(".ant-tree-list-holder")', 'leaving the page unmounts the tree')
  await evaluate('apiState.pageVisible = true; treeFlush()')
  await waitFor('document.querySelector(".ant-tree-list-holder")?.clientHeight > 100', 'returning to the cached page')
  results.push({ scenario: 'returning to the resolved page binds wheel once', ...await wheel('.ant-tree-list-holder') })

  await command('Page.navigate', { url: 'http://127.0.0.1:' + port + '?async&consumer=select' })
  const optionsHolder = '.ant-select-dropdown .rc-virtual-list-holder'
  // 弹层首次展开时 clientHeight 已就绪，但可视尺寸仍可能为零，滚轮须等待实际绘制。
  await waitFor(`document.querySelector(${JSON.stringify(optionsHolder)})?.getBoundingClientRect().height > 100`, 'shared virtual list in Select')
  await evaluate('treeFlush()')
  results.push({ scenario: 'Select shares the patched virtual list and preserves wheel scrolling', ...await wheel(optionsHolder) })
  const option = await evaluate(`(() => { const option = document.querySelector('.ant-select-item-option-content'); const label = option.textContent; option.click(); return label.replace('Option ', 'option-') })()`)
  await waitFor('apiState.optionValue === ' + JSON.stringify(option), 'selecting an option after scrolling')
  results.push({ scenario: 'Select selection still works after scrolling' })

  assert.deepEqual(browserErrors, [])
  const report = { passed: results.length, results, browserErrors }
  console.log(JSON.stringify(report, null, 2))

} finally {
  socket?.close()
  if (chrome.exitCode === null && chrome.signalCode === null) {
    chrome.kill('SIGTERM')
    await once(chrome, 'exit').catch(() => {})
  }
  await new Promise(resolve => server.close(resolve))
  await rm(profile, { recursive: true, force: true })
}
