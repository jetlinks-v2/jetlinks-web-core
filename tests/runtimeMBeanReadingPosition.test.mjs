import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const flush = async () => { await vue.nextTick(); await vue.nextTick() }
const bean = name => ({ objectName: `org.jetlinks:name=${name},type=PersistenceBuffer`, domain: 'org.jetlinks', type: 'PersistenceBuffer', name, attributes: [], operations: [] })
function harness(t) {
  const hooks = { activated: [], deactivated: [], beforeUpdate: [] }, frames = new Map(), events = []
  const width = vue.ref(1000)
  let sequence = 0
  const previousFrame = globalThis.requestAnimationFrame, previousCancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence }
  globalThis.cancelAnimationFrame = id => frames.delete(id)
  t.after(() => { globalThis.requestAnimationFrame = previousFrame; globalThis.cancelAnimationFrame = previousCancel })
  const vueBindings = { ...vue, provide() {}, onActivated: callback => hooks.activated.push(callback), onDeactivated: callback => hooks.deactivated.push(callback), onBeforeUpdate: callback => hooks.beforeUpdate.push(callback) }
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    const module = { exports: {} }, code = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' }).code
    new Function('require', 'module', 'exports', code)(id => id === 'vue' ? vueBindings : id.startsWith('.') ? load(resolve(dirname(filename), `${id}.ts`)) : require(id), module, module.exports)
    cache.set(filename, module.exports); return module.exports
  }
  const retained = { exports: {} }, retainedCode = transformSync(readFileSync(resolve(import.meta.dirname, '../src/hooks/useRetainedScroll.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  new Function('require', 'module', 'exports', retainedCode)(() => vueBindings, retained, retained.exports)
  const filename = resolve(import.meta.dirname, '../src/components/RuntimeDiagnostics/MBeanBrowser.vue')
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename }), compiled = compileScript(descriptor, { id: 'mbean-reading-position' })
  const { code } = transformSync(compiled.content, { loader: 'ts', format: 'cjs' }), module = { exports: {} }
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'vue') return vueBindings
    if (id === '../../hooks/useRetainedScroll') return retained.exports
    if (id === './useDiagnosticWidth') return { useDiagnosticWidth: () => width }
    if (id === './mbean/context' || id === './mbean/selectionVisibility') return load(resolve(dirname(filename), `${id}.ts`))
    if (id === 'vue-i18n') return { useI18n: () => ({ t: key => key }) }
    if (id === 'ant-design-vue') return { Empty: {} }
    if (id === '@ant-design/icons-vue') return {}
    if (id.endsWith('.vue')) return {}
    if (id === './registry') return { compareMBeanDomain: (left, right) => left.localeCompare(right), isJetLinksDomain: value => value === 'org.jetlinks', mbeanCatalogEntry: () => undefined, mbeanGroupKey: (...parts) => parts.join('/'), resolveMBeanRenderer: () => undefined, supportsMBeanSummary: () => false }
    return require(id)
  }, module, module.exports)
  const props = vue.reactive({ active: true, busy: false, invokeAccess: { allowed: true }, resultState: { status: 'ready' }, detailState: { status: 'ready' }, beans: [bean('a'), bean('b')], state: { status: 'ready' }, selectedObject: bean('a').objectName, target: 'notify-service', config: { expandedKeys: [], section: 'attributes' } })
  const scope = vue.effectScope(), view = scope.run(() => module.exports.default.setup(props, { expose() {}, emit: (...args) => events.push(args) }))
  const element = () => ({ isConnected: true, clientWidth: 248, clientHeight: 300, scrollTop: 0, scrollLeft: 0, querySelectorAll: () => [] })
  const navigation = element(), detail = element(); view.navigation.value = navigation; view.detail.value = detail
  return { props, view, width, navigation, detail, events, frames,
    lifecycle: name => hooks[name].forEach(callback => callback()),
    frame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) },
    stop: () => scope.stop(),
  }
}

test('MBean navigation and detail keep independent double-axis positions through node and tool returns', async t => {
  const h = harness(t)
  try {
    h.navigation.scrollTop = 70; h.navigation.scrollLeft = 90; h.view.navigationReading.onScroll()
    h.detail.scrollTop = 260; h.detail.scrollLeft = 42; h.view.detailReading.onScroll()
    for (const element of [h.navigation, h.detail]) { element.isConnected = false; element.clientWidth = 0; element.scrollTop = 0; element.scrollLeft = 0 }
    h.lifecycle('deactivated')
    for (const element of [h.navigation, h.detail]) { element.isConnected = true; element.clientWidth = 248 }
    h.lifecycle('activated'); h.lifecycle('beforeUpdate'); await flush(); h.frame()
    assert.equal(h.navigation.scrollTop, 70); assert.equal(h.navigation.scrollLeft, 90)
    assert.equal(h.detail.scrollTop, 260); assert.equal(h.detail.scrollLeft, 42)
    h.props.active = false
    for (const element of [h.navigation, h.detail]) { element.clientHeight = 0; element.scrollTop = 0; element.scrollLeft = 0 }
    h.view.navigationReading.onScroll(); h.view.detailReading.onScroll()
    h.props.active = true
    for (const element of [h.navigation, h.detail]) element.clientHeight = 300
    await flush(); h.frame()
    assert.equal(h.navigation.scrollTop, 70); assert.equal(h.navigation.scrollLeft, 90)
    assert.equal(h.detail.scrollTop, 260); assert.equal(h.detail.scrollLeft, 42)
  } finally { h.stop() }
})

test('compact directory closes after selecting the current object and restores search, expansion, axes and keyboard focus', async t => {
  const h = harness(t)
  try {
    h.width.value = 640
    assert.equal(h.view.navigationVisible.value, false, 'the selected object detail has the first screen')
    let focused = 0
    h.view.directoryEntry.value = { querySelector: () => ({ focus: () => focused++ }) }
    h.view.directoryOpen.value = true
    await flush(); h.frame()
    h.view.search.value = 'Persistence'
    h.props.config = { expandedKeys: ['org.jetlinks/PersistenceBuffer'], section: 'attributes' }
    h.navigation.scrollTop = 110; h.navigation.scrollLeft = 170; h.view.navigationReading.onScroll()
    h.detail.scrollTop = 210; h.detail.scrollLeft = 24; h.view.detailReading.onScroll()
    // Ant Tree can emit an empty selectedKeys array when its current leaf is clicked again.
    h.view.select([])
    assert.equal(h.view.navigationVisible.value, false)
    h.navigation.clientHeight = 0; h.navigation.scrollTop = 0; h.navigation.scrollLeft = 0
    h.view.navigationReading.onScroll(); h.lifecycle('beforeUpdate')
    await flush(); h.frame()
    assert.equal(focused, 1)
    h.view.directoryOpen.value = true; h.navigation.clientHeight = 300
    await flush(); h.frame()
    assert.equal(h.navigation.scrollTop, 110); assert.equal(h.navigation.scrollLeft, 170)
    assert.equal(h.detail.scrollTop, 210); assert.equal(h.detail.scrollLeft, 24)
    assert.equal(h.view.search.value, 'Persistence')
    assert.deepEqual(h.props.config.expandedKeys, ['org.jetlinks/PersistenceBuffer'])
    h.props.active = false; h.props.active = true; await flush(); h.frame()
    assert.equal(h.view.directoryOpen.value, true, 'returning to the tool preserves the user-opened directory')
    await h.view.closeDirectory(); h.navigation.clientHeight = 0
    h.width.value = 1100; h.navigation.clientHeight = 300
    await flush(); h.frame()
    assert.equal(h.view.navigationVisible.value, true, 'wide layouts always show the tree')
    assert.equal(h.navigation.scrollTop, 110); assert.equal(h.navigation.scrollLeft, 170)
    h.width.value = 640
    assert.equal(h.view.navigationVisible.value, false, 'returning to compact keeps its prior closed state')
  } finally { h.stop() }
})

test('Escape from the directory entry, search or tree closes only an open compact directory and restores its reading position', async t => {
  const h = harness(t)
  try {
    h.width.value = 640
    let focused = 0
    h.view.toolbar.value = {}
    h.view.directoryEntry.value = { querySelector: () => ({ focus: () => focused++ }) }
    const keyEvent = origin => ({ composedPath: () => origin, prevented: 0, stopped: 0,
      preventDefault() { this.prevented++ }, stopPropagation() { this.stopped++ } })
    for (const source of ['entry', 'search', 'tree']) {
      h.view.directoryOpen.value = true; h.navigation.clientHeight = 300
      await flush(); h.frame()
      h.navigation.scrollTop = 90; h.navigation.scrollLeft = 160; h.view.navigationReading.onScroll()
      const region = source === 'tree' ? h.view.navigation.value : h.view.toolbar.value
      const event = keyEvent([{ source }, region, h.view.browser.value])
      h.view.onDirectoryEscape(event)
      assert.equal(h.view.directoryOpen.value, false, source)
      assert.equal(event.prevented, 1); assert.equal(event.stopped, 1)
      h.navigation.clientHeight = 0; h.navigation.scrollTop = 0; h.navigation.scrollLeft = 0
      h.view.navigationReading.onScroll(); await flush()
      h.view.directoryOpen.value = true; h.navigation.clientHeight = 300
      await flush(); h.frame()
      assert.equal(h.navigation.scrollTop, 90); assert.equal(h.navigation.scrollLeft, 160)
    }
    assert.equal(focused, 3)
    const detailEvent = keyEvent([h.view.detail.value, h.view.browser.value])
    h.view.onDirectoryEscape(detailEvent)
    assert.equal(h.view.directoryOpen.value, true, 'detail form Escape remains local')
    assert.equal(detailEvent.prevented, 0); assert.equal(detailEvent.stopped, 0)
    h.view.directoryOpen.value = false
    const closedEvent = keyEvent([h.view.toolbar.value]); h.view.onDirectoryEscape(closedEvent)
    assert.equal(closedEvent.prevented, 0); assert.equal(closedEvent.stopped, 0)
    h.view.directoryOpen.value = true; h.width.value = 1000
    const wideEvent = keyEvent([h.view.navigation.value]); h.view.onDirectoryEscape(wideEvent)
    assert.equal(h.view.directoryOpen.value, true, 'wide navigation is not collapsed by Escape')
    assert.equal(wideEvent.prevented, 0); assert.equal(wideEvent.stopped, 0)
  } finally { h.stop() }
})

test('new selection clears only detail position; permission or target changes clear both reading positions', async t => {
  const h = harness(t)
  try {
    h.navigation.scrollTop = 70; h.navigation.scrollLeft = 90; h.view.navigationReading.onScroll()
    h.detail.scrollTop = 260; h.detail.scrollLeft = 42; h.view.detailReading.onScroll()
    h.props.selectedObject = bean('b').objectName; await flush(); h.frame()
    assert.equal(h.navigation.scrollTop, 70); assert.equal(h.navigation.scrollLeft, 90)
    assert.equal(h.detail.scrollTop, 0); assert.equal(h.detail.scrollLeft, 0)
    h.props.active = false; h.props.state = { status: 'forbidden' }; h.lifecycle('beforeUpdate')
    h.props.active = true; h.props.state = { status: 'ready' }; await flush(); h.frame()
    assert.equal(h.navigation.scrollTop, 0); assert.equal(h.navigation.scrollLeft, 0)
    h.navigation.scrollTop = 50; h.navigation.scrollLeft = 30; h.view.navigationReading.onScroll()
    h.props.target = 'different-node'; await flush(); h.frame()
    assert.equal(h.navigation.scrollTop, 0); assert.equal(h.navigation.scrollLeft, 0)
  } finally { h.stop() }
})

test('summary responses never appear as generic method results while awaiting a new receipt', async t => {
  const h = harness(t)
  try {
    const operation = { name: 'getSession', signature: ['java.lang.String'], parameters: [{ name: 'deviceId', type: 'java.lang.String' }], returnType: 'DeviceSessionInfo' }
    const session = { objectName: 'org.jetlinks:name=PersistenceDeviceSessionManager,type=DeviceSessionManager', domain: 'org.jetlinks', type: 'DeviceSessionManager', name: 'PersistenceDeviceSessionManager', attributes: [], operations: [operation] }
    h.props.beans = [session]; h.props.selectedObject = session.objectName
    h.props.executeInvocation = async () => {
      h.props.result = 'summary-result'; h.props.resultState = { status: 'ready' }
      return { state: { status: 'ready' }, result: 'summary-result' }
    }
    await flush()
    await h.view.queryContext.query('deviceSession', ['device']); await flush()
    assert.equal(h.view.genericResult.value, undefined)
    h.view.invokeGeneric({ bean: session, operation, args: [{ name: 'deviceId', value: 'device' }] })
    assert.equal(h.view.genericResult.value, undefined, 'old shared props cannot leak into the generic result')
    assert.equal(h.view.genericState.value.status, 'ready', 'an event rejected before host execution cannot leave a local loading state')
    h.props.resultState = { status: 'loading' }; await flush()
    assert.equal(h.view.genericResult.value, undefined); assert.equal(h.view.genericState.value.status, 'loading')
    h.props.result = 'generic-result'; h.props.resultState = { status: 'ready' }; await flush()
    assert.equal(h.view.genericResult.value, 'generic-result')
    await h.view.queryContext.query('deviceSession', ['device']); await flush()
    assert.equal(h.view.genericResult.value, undefined)
    h.props.state = { status: 'forbidden' }; await flush()
    assert.equal(h.view.queryContext.snapshot.value, undefined)
  } finally { h.stop() }
})
