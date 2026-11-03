import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const root = fileURLToPath(new URL('../../', import.meta.url))
const core = resolve(root, 'jetlinks-web-core/src')
const device = resolve(root, 'modules/device-manager-ui')
const rule = resolve(root, 'modules/rule-engine-manager-ui')
const require = createRequire(import.meta.url)
globalThis.window ??= new EventTarget()
globalThis.CustomEvent ??= class extends Event {}
const storage = new Map()
globalThis.localStorage ??= {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
window.localStorage ??= globalThis.localStorage
let calls = []
let respond = () => { throw new Error('Unexpected business request') }
const request = Object.fromEntries(['get', 'post', 'put', 'remove'].map(method => [method, async (url, data) => {
  calls.push({ method, url, data })
  return { success: true, status: 200, result: respond(url, data) }
}]))
const cache = new Map()
const navigationRoutes = new Map()
const router = {
  currentRoute: vue.ref({ name: 'resources/Dashboard', path: '/resources/dashboard' }),
  push: async path => { calls.push({ method: 'navigate', path }) },
  hasRoute: name => navigationRoutes.has(name),
  resolve: location => {
    const params = location.params || {}
    const query = location.query || {}
    const template = location.path || navigationRoutes.get(location.name)
    assert.ok(template, `Unknown navigation route: ${location.name}`)
    const path = template.replace(/:([a-zA-Z]+)/g, (_, key) => encodeURIComponent(params[key]))
    const search = new URLSearchParams(query).toString()
    return { name: location.name, params, query, fullPath: `${path}${search ? `?${search}` : ''}` }
  },
}

// Execute production providers, registration declarations and loader. Only transport and browser integration are replaced.
const load = filename => {
  if (cache.has(filename)) return cache.get(filename)
  const exports = {}
  cache.set(filename, exports)
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.glob', '__glob').replaceAll('import.meta.env', '{}')
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText
  const glob = () => Object.fromEntries((filename.startsWith(device)
    ? ['device/Domain', 'device/DashBoard', 'device/Instance', 'device/Product']
    : ['DashBoard', 'Instance']).map(path => [`./views/${path}/homeAgentProvider.ts`, async () => load(resolve(dirname(filename), `views/${path}/homeAgentProvider.ts`))]))
  new Function('require', 'exports', '__glob', 'defineAsyncComponent', code)(id => {
    if (filename.endsWith('/register.ts') && id !== 'vue' && !id.includes('agentCapabilities/')) return {}
    if (id === '@jetlinks-web/core') return { request, ndJson: {}, createNdJson: () => ({}) }
    if (id === '@jetlinks-web/utils') return { getToken: () => undefined }
    if (id === '@jetlinks-web/constants') return {}
    if (id === '@jetlinks-web-core/locales') return { __esModule: true, default: { global: { t: key => key } } }
    if (id === '@jetlinks-web-core/utils' || id === '@jetlinks-web-core/utils/comm') return { getBaseApi: () => '/api', encodeQuery: value => value }
    if (id === '@jetlinks-web-core/utils/ai-client-tool-request') return { withAiClientToolSilentRequest: fn => fn() }
    if (id === '@jetlinks-web-core/router') return { __esModule: true, default: router }
    if (id === '@jetlinks-web-core/store/menu') return { useMenuStore: () => ({ siderMenus: [] }) }
    if (id === '@device-manager-ui/api/device') return {
      queryDevicePage_api: async args => (await request.post('/device/instance/detail/_query', args)).result,
      getDeviceDetail_api: async id => (await request.post('/device/instance/detail/_query', { id })).result,
      toDevice: record => record,
    }
    if (filename.endsWith('/views/device/Instance/homeAgentProvider.ts') && id === '../../../api/device') return {
      toDevice: record => record,
    }
    if (id === '@jetlinks-web-core/utils/project-runtime') return { normalizeProjectRuntimePath: value => value }
    if (id === '@jetlinks-web-core/utils/consts') return { isSubApp: false }
    if (id === '@jetlinks-web/vite/dist/dynamic-remote') return { dynamicRemoteManager: {} }
    if (id.endsWith('/homeAgentCapabilities')) return { ...ai('homeAgentRegistry'), ...ai('homeAgentHandoff') }
    if (id === './useHomeAgentFeatureEntry') return { openHomeAgentFeatureEntry: () => { throw new Error('Unexpected UI entry') } }
    let base
    if (id.startsWith('.')) base = resolve(dirname(filename), id)
    else if (id.startsWith('@jetlinks-web-core/')) base = resolve(core, id.slice('@jetlinks-web-core/'.length))
    else if (id.startsWith('@device-manager-ui/')) base = resolve(device, id.slice('@device-manager-ui/'.length))
    else if (id.startsWith('@rule-engine-manager-ui/')) base = resolve(rule, id.slice('@rule-engine-manager-ui/'.length))
    else return require(id)
    return load(existsSync(`${base}.ts`) ? `${base}.ts`
      : existsSync(base) && statSync(base).isFile() ? base : resolve(base, 'index.ts'))
  }, exports, glob, vue.defineAsyncComponent)
  return exports
}
const ai = name => load(resolve(core, `layout/components/AiChat/${name}.ts`))
const providers = Object.fromEntries(['Domain', 'DashBoard', 'Instance', 'Product'].map(name => [name, load(resolve(device, `views/device/${name}/homeAgentProvider.ts`)).default]))
const menu = (code, path) => ({ code, routeName: code, name: code, title: code, path, breadcrumb: [], keywords: [] })
const context = menus => ({
  currentRoute: router.currentRoute.value, menus, capabilities: [],
  findMenu: value => menus.find(item => item.code === value || item.path === value),
  navigateToMenu: () => { throw new Error('Unexpected navigation') },
  navigateToRoute: () => { throw new Error('Unexpected navigation') },
})
const toolsFor = ctx => Object.values(providers).flatMap(provider => provider.getClientTools(ctx))
const toolIds = ctx => toolsFor(ctx).map(tool => tool.id).sort()
const invoke = (tool, ctx, args = {}) => tool.execute(args, ctx, { id: `test-${tool.id}`, toolName: tool.id })
const entries = [
  menu('iot-user-device-list', '/resources/devices/list'),
  menu('iot-user/device/list', '/iot-user/device/list'),
  menu('device/Instance', '/iot/device/Instance'),
]
const product = menu('device/Product', '/resources/devices/products')
for (const entry of entries) navigationRoutes.set(`${entry.code}/Detail`, `${entry.path}/${entry.code === 'device/Instance' ? 'detail' : 'Detail'}/:id`)

for (const entry of entries) {
  test(`${entry.code}: query, history and statistics are available and links use the authorized entry`, async () => {
    const ctx = context([entry, product])
    const ids = toolIds(ctx)
    for (const id of ['device_instance_search', 'device_model_get', 'device_property_raw_records', 'device_dashboard_get_overview', 'device_dashboard_analyze_message_aggregation']) assert.ok(ids.includes(id), id)
    for (const name of ['Domain', 'Instance', 'DashBoard']) {
      const capabilities = providers[name].getCapabilities(ctx).filter(item => item.id !== 'device-domain:product-model')
      assert.ok(capabilities.length)
      assert.ok(capabilities.every(item => item.menuCode === entry.code && item.path === entry.path))
    }
    calls = []
    respond = () => ({ total: 1, data: [{ id: 'device-1', name: 'Device' }] })
    const result = await invoke(toolsFor(ctx).find(tool => tool.id === 'device_instance_search'), ctx)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, '/device-instance/detail/_query')
    assert.equal(result.summary.menu.path, entry.path)
    assert.equal(result.summary.menu.code, entry.code)
    const item = result.__clientToolOutputs.output1[0]
    assert.deepEqual(result.summary.items, [item])
    const link = new URLSearchParams(item.detailLink.slice(1))
    assert.equal(link.get('menu'), entry.code)
    assert.equal(link.get('route'), `${entry.code}/Detail`)
    assert.equal(item.detailRoute.routeName, `${entry.code}/Detail`)
  })
}

test('product-only and shared-home-only accounts do not gain device queries', () => {
  assert.deepEqual(toolIds(context([product])), ['device_metadata_search', 'device_model_get', 'device_product_search'])
  assert.deepEqual(toolIds(context([menu('resources/Dashboard', '/resources/dashboard')])), [])
})

test('device-only accounts keep device statistics without product queries or overview', async () => {
  const ctx = context([entries[0]])
  const tools = toolsFor(ctx)
  assert.equal(tools.some(tool => ['device_product_search', 'device_dashboard_get_product_stats', 'device_dashboard_get_overview'].includes(tool.id)), false)
  assert.equal(providers.DashBoard.getCapabilities(ctx).some(item => ['device-dashboard:overview', 'device-dashboard:product-stats'].includes(item.id)), false)
  calls = []
  respond = () => 3
  const result = await invoke(tools.find(tool => tool.id === 'device_dashboard_get_device_stats'), ctx)
  assert.equal(result.summary.device.total, 3)
  assert.equal(calls.length, 3)
  assert.ok(calls.every(call => call.url === '/device/instance/_count'))
})

test('retained statistics and search definitions reject revoked menu permissions before HTTP', async () => {
  const tools = toolsFor(context([entries[0], product]))
  calls = []
  for (const tool of tools.filter(tool => tool.id.startsWith('device_dashboard_'))) await assert.rejects(async () => invoke(tool, context([])))
  const search = tools.find(tool => tool.id === 'device_instance_search')
  assert.equal((await invoke(search, context([]))).success, false)
  assert.equal(calls.length, 0)
})

test('legacy dashboard permission continues to provide its five statistics tools', () => {
  assert.equal(providers.DashBoard.getClientTools(context([menu('device/DashBoard', '/iot/device/DashBoard')])).length, 5)
})

test('dashboard trends distinguish bucket count from message quantity and publish reusable records', async () => {
  const ctx = context([entries[0]])
  for (const id of ['device_dashboard_analyze_message_aggregation', 'device_dashboard_get_online_trend']) {
    const tool = toolsFor(ctx).find(candidate => candidate.id === id)
    respond = (url, data) => data.slice(0, 1).flatMap(query => [
      { group: query.group, data: { timeString: '2026-11-02 10:00:00', value: 1000 } },
      { group: query.group, data: { timeString: '2026-11-02 09:00:00', value: 7 } },
    ])
    const result = await invoke(tool, ctx, { timeRange: 'custom', startTime: '2026-11-02 09:00:00', endTime: '2026-11-02 11:00:00' })
    assert.equal(result.success, true)
    assert.equal(result.complete, true)
    assert.equal(result.evidence.cardinality.kind, 'aggregate-series')
    assert.equal(result.evidence.cardinality.bucketCount, 2)
    assert.equal(result.evidence.cardinality.measurementCount, 2)
    const binding = result.outputBindings[0]
    assert.equal(binding.recordPath, '$')
    assert.equal(binding.recordCount, 2)
    assert.ok(binding.fields.some(field => field.name === 'value' && field.role === 'measure'))
    assert.equal(binding.ordering.keys[0].field, 'timestamp')
    assert.deepEqual(binding.requestedRange, {
      start: new Date('2026-11-02 09:00:00').getTime(), end: new Date('2026-11-02 11:00:00').getTime(),
    })
    assert.ok(binding.fields.some(field => field.name === 'timestamp' && field.role === 'temporal_dimension' && field.encoding === 'epoch-millis'))
    const rows = result.__clientToolOutputs.output0
    assert.deepEqual(Object.keys(rows[0]).sort(), ['timestamp', 'value'])
    assert.deepEqual(rows.map(row => row.value), [7, 1000])
    assert.equal(result.summary.series, undefined)
    if (id.includes('message')) assert.equal(result.summary.total, 1007)
    respond = () => []
    const empty = await invoke(tool, ctx, { timeRange: 'today' })
    assert.equal(empty.success, true)
    assert.equal(empty.evidence.cardinality.bucketCount, 0)
    assert.deepEqual(empty.__clientToolOutputs.output0, [])
  }
})

test('dashboard declares the shared time alternatives and rejects invalid ranges before HTTP', async () => {
  const ctx = context([entries[0]])
  for (const tool of toolsFor(ctx).filter(tool => ['device_dashboard_get_online_trend', 'device_dashboard_analyze_message_aggregation'].includes(tool.id))) {
    const wire = ai('clientToolRouting').toAiClientToolSessionDefinition(tool)
    assert.deepEqual(wire.inputs.map(input => input.id), ['timeRange', 'startTime', 'endTime'])
    assert.equal(wire.expands._schema.oneOf.length, 2)
    for (const args of [
      { from: '2026-10-01 00:00:00' }, { to: '2026-10-01 00:00:00' },
      { shortcut: 'yesterday' }, { timeRange: 'yesterday' },
      { timeRange: 'custom', startTime: '2026-11-01 00:00:00' },
      { timeRange: 'today', startTime: '2026-11-01 00:00:00', endTime: '2026-11-02 00:00:00' },
      { timeRange: 'custom', startTime: 'bad', endTime: '2026-11-02 00:00:00' },
      { timeRange: 'custom', startTime: '2026-11-02 00:00:00', endTime: '2026-11-01 00:00:00' },
      { timeRange: 'custom', startTime: '2026-01-01 00:00:00', endTime: '2026-11-01 00:00:00' },
    ]) {
      calls = []
      await assert.rejects(async () => invoke(tool, ctx, args), error => error.code?.startsWith('TIME_RANGE_'))
      assert.equal(calls.length, 0)
    }
  }
})

test('home catalog has no legacy tools and trend measures distinguish online counts from message quantities', async () => {
  const ctx = context([entries[0], product])
  const tools = toolsFor(ctx)
  const report = ai('clientToolCatalog').createAiClientToolCatalogReport(tools, { requireRouting: true, requireResultBindings: true })
  assert.deepEqual(report.issues, [])
  assert.ok(report.tools.every(tool => tool.authoringStatus === 'facade'))
  respond = (url, data) => [{ group: data[0].group, data: { timeString: '2026-11-02 09:00:00', value: 7 } }]
  for (const [id, measure, aggregation] of [
    ['device_dashboard_get_online_trend', 'online_devices', 'avg'],
    ['device_dashboard_analyze_message_aggregation', 'uplink_messages', 'sum'],
  ]) {
    const result = await invoke(tools.find(tool => tool.id === id), ctx, { timeRange: 'today' })
    const field = result.outputBindings[0].fields.find(field => field.role === 'measure')
    assert.deepEqual(result.outputBindings[0].fields.map(field => field.name), ['timestamp', 'value'])
    assert.equal(field.measure, measure)
    assert.equal(field.aggregation, aggregation)
    assert.equal(field.unit, 'count')
    assert.ok(field.label && field.unitLabel)
  }
})

test('all canonical presets and valid legacy parameters retain bounded query and evidence ranges', async () => {
  const ctx = context([entries[0]])
  const tool = toolsFor(ctx).find(tool => tool.id === 'device_dashboard_analyze_message_aggregation')
  respond = () => []
  for (const args of [
    {}, ...['today', '24h', '7d', '30d'].map(timeRange => ({ timeRange })),
    ...['day', 'week', 'month'].map(shortcut => ({ shortcut })),
    { from: '2026-11-01 00:00:00', to: '2026-11-02 00:00:00' },
    { timeRange: { from: '2026-11-01 00:00:00', to: '2026-11-02 00:00:00' } },
  ]) {
    calls = []
    const result = await invoke(tool, ctx, args)
    const range = result.outputBindings[0].requestedRange
    assert.equal(result.complete, true)
    assert.equal(typeof range.start, 'number')
    assert.ok(range.end > range.start)
    assert.equal(calls[0].data[0].params.from, range.start)
    assert.equal(calls[0].data[0].params.to, range.end)
  }
})

test('device and product searches publish records, IDs and truthful pagination for first, last and empty pages', async () => {
  const ctx = context([entries[0], product])
  for (const [id, recordName] of [['device_instance_search', 'device-records'], ['device_product_search', 'product-records']]) {
    const tool = toolsFor(ctx).find(tool => tool.id === id)
    for (const page of [
      { total: 3, pageIndex: 0, data: [{ id: 'one' }, { id: 'two' }], complete: false, exhaustive: false },
      { total: 3, pageIndex: 1, data: [{ id: 'three' }], complete: true, exhaustive: false },
      { total: 0, pageIndex: 0, data: [], complete: true, exhaustive: true },
    ]) {
      respond = () => page
      const result = await invoke(tool, ctx, { limit: 2, pageIndex: page.pageIndex })
      assert.equal(result.complete, page.complete)
      assert.equal(result.exhaustive, page.exhaustive)
      assert.equal(result.evidence.cardinality.totalCount, page.total)
      assert.equal(result.evidence.cardinality.returnedCount, page.data.length)
      assert.equal(result.outputBindings.find(binding => binding.name === recordName).recordCount, page.data.length)
      assert.deepEqual(result.__clientToolOutputs.output0, page.data.map(item => item.id))
      assert.equal(result.summary.nextPage, page.complete ? undefined : 1)
    }
  }
})

test('organization ambiguity cannot become a proven empty device population', async () => {
  const orgMenu = menu('system/Department', '/system/Department')
  const ctx = context([entries[0], orgMenu])
  const tool = toolsFor(ctx).find(tool => tool.id === 'device_instance_search')
  respond = () => ({ total: 2, data: [{ id: 'org-a', name: 'Factory A' }, { id: 'org-b', name: 'Factory B' }] })
  const result = await invoke(tool, ctx, { organizationKeyword: 'Factory' })
  assert.equal(result.complete, false)
  assert.equal(result.exhaustive, false)
  assert.equal(result.summary.needsOrganizationSelection, true)
  assert.equal(result.summary.organizationCandidates.length, 2)
  assert.equal(result.evidence.supportsAbsenceClaim, false)
})

test('general query and detail navigation follow all authorized menu aliases and reject revoked access', async () => {
  const query = load(resolve(device, 'agentCapabilities/deviceAnalysis/deviceQuery.service.ts')).deviceQueryService
  const navigation = load(resolve(device, 'agentCapabilities/deviceAnalysis/deviceNavigation.service.ts')).deviceNavigationService
  for (const entry of entries) {
    const ctx = context([entry])
    respond = () => ({ total: 1, data: [{ id: 'device/a', name: 'Device' }] })
    const result = await query.search({}, ctx)
    const path = `${entry.path}/${entry.code === 'device/Instance' ? 'detail' : 'Detail'}/device%2Fa`
    assert.equal(result.navigation[0].menuCode, entry.code)
    assert.equal(result.navigation[0].path, path)
    respond = () => ({ id: 'device/a', name: 'Device' })
    const opened = await navigation.openDetail({ deviceId: 'device/a', tab: 'data' }, ctx)
    assert.equal(opened.navigation[0].menuCode, entry.code)
    assert.equal(opened.navigation[0].path, `${path}?tab=data`)
    assert.equal(calls.at(-1).path, `${path}?tab=data`)
  }
  calls = []
  assert.equal((await query.search({}, context([]))).failureDisposition, 'permission/user')
  assert.equal((await navigation.openDetail({ deviceId: 'device' }, context([]))).failureDisposition, 'permission/user')
  assert.equal(calls.length, 0)
})

test('menu selection preserves known path aliases and prefers the active nested entry', () => {
  const resolver = load(resolve(device, 'agentCapabilities/deviceMenus.ts'))
  const pathEntry = menu('runtime-device-list', '/resources/devices/list')
  assert.equal(resolver.findDeviceAgentMenu(context([pathEntry]), 'instance'), pathEntry)
  const nested = menu('iot-user/device/list', '/resources/devices/list/device')
  const ctx = context([entries[0], nested])
  ctx.currentRoute = { path: '/resources/devices/list/device/Detail/one' }
  assert.equal(resolver.findDeviceAgentMenu(ctx, 'instance'), nested)
})

test('home and general navigation reuse registered device types, route parameters and real paths', async () => {
  const registry = load(resolve(core, 'utils/module-registry.ts')).moduleRegistry
  const query = load(resolve(device, 'agentCapabilities/deviceAnalysis/deviceQuery.service.ts')).deviceQueryService
  const navigation = load(resolve(device, 'agentCapabilities/deviceAnalysis/deviceNavigation.service.ts')).deviceNavigationService
  const routeName = 'type-test/NodeDetail'
  const ctx = context([entries[0]])
  const record = { id: 'node/a', name: 'Node', accessProvider: 'registered-node' }
  navigationRoutes.set(routeName, '/registered/nodes/:nodeId')
  registry.register('navigation-type-test', { deviceListProviders: { node: {
    id: 'node', menuCode: entries[0].code,
    matches: value => value.accessProvider === 'registered-node',
    detailRoute: routeName, detailParam: 'nodeId',
  } } })
  try {
    respond = () => ({ total: 1, data: [record] })
    const home = await invoke(toolsFor(ctx).find(tool => tool.id === 'device_instance_search'), ctx)
    const item = home.__clientToolOutputs.output1[0]
    assert.equal(item.detailRoute.routeName, routeName)
    assert.deepEqual(item.detailRoute.params, { nodeId: record.id })
    assert.deepEqual(item.detailRoute.query, { type: 'node' })
    assert.equal(home.summary.items[0].markdownLink, item.markdownLink)
    const link = new URLSearchParams(item.detailLink.slice(1))
    assert.deepEqual(JSON.parse(link.get('params')), { nodeId: record.id })
    const result = await query.search({}, ctx)
    assert.equal(result.navigation[0].path, '/registered/nodes/node%2Fa?type=node')
    respond = () => record
    const opened = await navigation.openDetail({ deviceId: record.id, tab: 'data' }, ctx)
    assert.equal(opened.data.path, '/registered/nodes/node%2Fa?type=node&tab=data')
    assert.equal(calls.at(-1).path, opened.data.path)
    registry.register('navigation-type-test', { deviceListProviders: { node: {
      id: 'node', menuCode: 'revoked-owner', matches: () => true, detailRoute: routeName,
    } } }, { override: true })
    respond = () => ({ total: 1, data: [record] })
    const revoked = await invoke(toolsFor(ctx).find(tool => tool.id === 'device_instance_search'), ctx)
    assert.equal(revoked.__clientToolOutputs.output1[0].detailLink, undefined)
    assert.equal((await query.search({}, ctx)).navigation, undefined)
    respond = () => record
    calls = []
    assert.equal((await navigation.openDetail({ deviceId: record.id }, ctx)).failureDisposition, 'permission/user')
    assert.equal(calls.some(call => call.method === 'navigate'), false)
  } finally {
    registry.unregister('navigation-type-test')
    navigationRoutes.delete(routeName)
  }
})

test('general trend definitions publish only time and measurement while retaining rate and count semantics', async t => {
  const definitions = load(resolve(device, 'agentCapabilities/deviceAnalysis/tools.ts')).createDeviceAnalysisTools()
  const metrics = load(resolve(device, 'agentCapabilities/deviceAnalysis/deviceMetrics.service.ts')).deviceMetricsService
  const domain = ai('domainAgentTools')
  for (const [id, method, measure, unit] of [
    ['device_query_online_rate_trend', 'onlineRateTrend', 'online_rate', 'percent'],
    ['device_query_message_trend', 'messageTrend', 'uplink_messages', 'count'],
  ]) {
    const original = metrics[method]
    t.after(() => { metrics[method] = original })
    metrics[method] = async () => domain.createDomainAgentToolResult({
      domain: 'device', timeRange: { start: 1793462400000, end: 1793469600000 },
      data: { points: [{ timestamp: 1793462400000, label: '2026-11-01 00:00:00', value: 7 }] },
      cardinality: { kind: 'aggregate-series', bucketCount: 1, populatedBucketCount: 1, measurementCount: 1 },
      requestSatisfied: true, exhaustive: true,
    })
    const definition = definitions.find(tool => tool.id === id).build()
    const result = await invoke(definition, context([entries[0]]), { timeRange: 'today' })
    assert.deepEqual(result.__clientToolOutputs.output0, [{ timestamp: 1793462400000, value: 7 }])
    const fields = result.outputBindings[0].fields
    assert.deepEqual(fields.map(field => field.name), ['timestamp', 'value'])
    assert.equal(fields[1].measure, measure)
    assert.equal(fields[1].unit, unit)
  }
})

test('product, alarm and rule capabilities use current menu paths', () => {
  assert.equal(providers.Product.getCapabilities(context([product]))[0].path, product.path)
  for (const [page, code, path] of [['DashBoard', 'rule-engine/DashBoard', '/alarms/dashboard'], ['Instance', 'rule-engine/Instance', '/rule-engine/Instance']]) {
    const provider = load(resolve(rule, `views/${page}/homeAgentProvider.ts`)).default
    assert.ok(provider.getCapabilities(context([menu(code, path)])).every(item => item.path === path))
    assert.deepEqual(provider.getClientTools(context([])), [])
  }
})

test('rule draft creation still requires confirmation and cancellation performs no write', async () => {
  const provider = load(resolve(rule, 'views/Instance/homeAgentProvider.ts')).default
  const ctx = context([menu('rule-engine/Instance', '/rule-engine/Instance')])
  const runtime = ai('clientTools').createAiClientToolRuntime(provider.getClientTools(ctx), {
    includeHelpTool: false, getContext: () => ctx,
  })
  calls = []
  let confirmations = 0
  try {
    await runtime.handleClientToolCall({
      id: 'cancel-rule-draft', toolName: 'rule_engine_create_rule_draft', arguments: { name: 'Test draft' },
      requestConfirmation: async () => { confirmations += 1; return { approved: false } },
    })
    assert.equal(confirmations, 1)
    assert.equal(calls.length, 0)
  } finally {
    runtime.dispose()
  }
})

test('all seven home registrations have valid activation and load by menu, route and path', async t => {
  const registry = load(resolve(core, 'utils/module-registry.ts')).moduleRegistry
  const loader = ai('routeCapabilityLoader')
  const homes = ai('homeAgentRegistry').homeAgentCapabilityRegistry
  const registrations = [load(resolve(device, 'register.ts')).default, load(resolve(rule, 'register.ts')).default]
  t.after(() => {
    loader.unloadHomeAgentCapabilityProviders()
    for (const registration of registrations) registry.unregister(registration.moduleId)
  })
  for (const registration of registrations) registry.register(registration.moduleId, registration)
  assert.equal(registrations.reduce((sum, registration) => sum + Object.keys(registration.homeAgentProviders).length, 0), 7)
  for (const registration of registrations) for (const resource of Object.values(registration.homeAgentProviders)) {
    assert.equal(typeof resource.loader, 'function')
    assert.equal(resource.activation.version, 'general-agent-provider-activation/v1')
    assert.ok(resource.activation.scopes.every(scope => scope.values.length))
  }
  for (const options of [{ menuCode: entries[0].code }, { routeName: entries[1].code }, { path: entries[2].path }]) {
    loader.unloadHomeAgentCapabilityProviders()
    const result = await loader.loadHomeAgentCapabilityProviders(options)
    assert.ok(result.matched >= 3)
    assert.deepEqual(result.rejected, [])
    assert.ok(homes.getProviders().some(provider => provider.id === 'device-dashboard'))
  }
  loader.unloadHomeAgentCapabilityProviders()
  const result = await loader.loadHomeAgentCapabilityProviders({ loadAll: true })
  assert.equal(result.matched, 7)
  assert.deepEqual(result.rejected, [])
  assert.equal(homes.getProviders().length, 7)
  const again = await loader.loadHomeAgentCapabilityProviders({ loadAll: true })
  assert.equal(again.loaded.length, 0)
  assert.equal(again.skipped.length, 7)
  assert.equal(homes.getProviders().length, 7)
})
