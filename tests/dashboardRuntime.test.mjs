import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

const require = createRequire(import.meta.url)

// Execute the production composables with real Vue reactivity/lifecycle and bounded service doubles.
function load(relative, dependencies = {}, globals = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8')
    .replaceAll('import.meta.env.VITE_PERSONAL_TOKEN_KEY', "'personal'")
    .replaceAll('import.meta.env.VITE_PERSONAL_TOKEN_URL_KEY', "'personalToken'")
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  new Function('exports', 'require', ...Object.keys(globals), output)(exports, id => dependencies[id] ?? require(id), ...Object.values(globals))
  return exports
}

function mount(setup) {
  let value
  const renderer = vue.createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp({ setup() { value = setup(); return () => null } })
  app.mount({})
  return { value, unmount: () => app.unmount() }
}

function eventBus() {
  const callbacks = new Map()
  const removed = []
  return { callbacks, removed, window: { $viewDataEventBus: {
    subscribe(id, callback) { callbacks.set(id, callback); return () => { removed.push(id); callbacks.delete(id) } },
  } } }
}

test('dashboard data retains configuration precedence, zero values and subscription cleanup', async () => {
  const bus = eventBus()
  const { useDashboardData } = load('../src/components/DashBoardCanvas/runtime/useDashboardData.ts', {}, { window: bus.window })
  const props = vue.reactive({ info: { componentProps: { metric: { color: 'blue', size: 2 } }, extraProps: { options: [] }, dataSourceProps: [] } })
  const { value, unmount } = mount(() => useDashboardData(props, 'metric'))
  assert.equal(value.dataSourceList.value[0].isMock, true)
  assert.equal(value.dataSourceList.value[0].value, 50)
  const record = { sourceId: 'source', deviceId: 'device', mappingId: 'temperature', mappingName: 'Temperature', independence: true, config: { color: 'red', unit: 'C' }, metric: { color: 'green' } }
  props.info.extraProps.options = [record]
  props.info.dataSourceProps = [{ id: 'source_device_temperature', mapping: { temperature: {} } }]
  await vue.nextTick()
  assert.deepEqual(value.dataSourceList.value[0].config, { color: 'green', size: 2, unit: 'C' })
  bus.callbacks.get('source_device_temperature')({ temperature: 0 })
  assert.equal(value.getValue(record), 0)
  value.setValue(record, false)
  assert.equal(value.getValue(record), false)
  props.info.dataSourceProps = [{ id: 'replacement', mapping: { temperature: {} } }]
  await vue.nextTick()
  assert.deepEqual(bus.removed, ['source_device_temperature'])
  unmount()
  assert.deepEqual(bus.removed, ['source_device_temperature', 'replacement'])
})

test('grid layout preserves empty styles and switches width only above its threshold', () => {
  const { useGridLayout } = load('../src/components/DashBoardCanvas/runtime/useGridLayout.ts')
  const data = vue.ref([])
  const { containerStyle } = useGridLayout(data, () => ({ color: 'red' }), { minWidth: '160px', maxWidthForFew: '320px' })
  assert.deepEqual(containerStyle.value, { color: 'red' })
  data.value = [1, 2, 3]
  assert.equal(containerStyle.value.gridTemplateColumns, 'repeat(auto-fit, minmax(min(100%, 160px), 320px))')
  data.value.push(4)
  assert.equal(containerStyle.value.gridTemplateColumns, 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))')
})

test('dashboard images stay synchronous and preserve local, project and personal-token URLs', () => {
  let token = 'system'
  let storage
  const { getDashboardImageUrl } = load('../src/components/DashBoardCanvas/runtime/dashboardImage.ts', {
    '@jetlinks-web/utils': { getImage: path => `static:${path}`, getToken: () => token, LocalStore: { get: key => key === 'personal_release-1' ? 'personal-value' : null } },
    '@jetlinks-web/constants': { TOKEN_KEY_URL: 'token' },
    '@jetlinks-web-core/utils': { getBaseApi: () => '/api', getProjectIdFromLocation: () => 'project-1', getProjectStorage: () => storage, isProjectStorageEnabled: () => !!storage },
  }, { window: { location: { search: '?releaseId=release-1' } } })
  const url = (thumbnailUrl, thumb) => getDashboardImageUrl('thumbnail', { thumbnailUrl, thumb })
  assert.equal(url(''), '/images/login/login.png')
  assert.equal(url('localhost/images/icon.png'), 'static:/images/icon.png')
  assert.equal(url('file-id', '100_100'), '/api/file/file-id?token=system&thumb=100_100')
  assert.equal(url('vis/image'), '/api/ui/vis/image?token=system')
  storage = { apiUrl: '/project-api', token: 'project-token' }
  assert.equal(url('file-id'), '/project-api/file/file-id?token=project-token')
  storage = undefined
  token = undefined
  assert.equal(url('file-id'), '/api/file/file-id?personalToken=personal-value')
})
