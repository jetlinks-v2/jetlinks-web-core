import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'

const root = resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
const cache = new Map()
const calls = []
let response = { status: 200 }
const boundary = {
  '@jetlinks-web/core': { request: { post: async (...args) => { calls.push(args); return response } } },
  '@jetlinks-web/vite/dist/dynamic-remote': { dynamicRemoteManager: {} },
  '@jetlinks-web-core/utils/consts': { isSubApp: false }
}
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  const { code } = transformSync(readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(id => {
    if (boundary[id]) return boundary[id]
    if (id.startsWith('.')) return load(resolve(dirname(filename), id + '.ts'))
    return require(id)
  }, module, module.exports)
  return module.exports
}
const { moduleRegistry } = load(resolve(root, 'src/utils/module-registry.ts'))
const { createAssetRelationBinding, resolveAssetRelationBinding, onAssetRelationBindingsChange } =
  load(resolve(root, 'src/utils/asset-relation-binding.ts'))
// Execute the real business-owned registration, using the same core factory as production.
boundary['@jetlinks-web-core/utils/asset-relation-binding'] = load(resolve(root, 'src/utils/asset-relation-binding.ts'))
const { deviceAssetRelationBindings } = load(resolve(root, '../modules/device-manager-ui/assetRelationBindings.ts'))
const source = { assetType: 'device', dimensionType: 'org', assetIdProperty: 'id', relation: 'owner', source: 'direct' }

test('business registration matches actual source and role, conflicts and unload stop resolution', () => {
  assert.equal(resolveAssetRelationBinding(source), undefined)
  let changes = 0
  const unsubscribe = onAssetRelationBindingsChange(() => changes++)
  moduleRegistry.register('device-binding', { assetRelationBindings: deviceAssetRelationBindings })
  assert.equal(resolveAssetRelationBinding(source)?.multiple, false)
  for (const variation of [{ source: 'permission' }, { relation: 'share' }, { assetType: 'product' }, { dimensionType: 'tenant' }])
    assert.equal(resolveAssetRelationBinding({ ...source, ...variation }), undefined)
  moduleRegistry.register('conflict', { assetRelationBindings: deviceAssetRelationBindings })
  assert.equal(resolveAssetRelationBinding(source), undefined)
  moduleRegistry.unregister('conflict')
  assert.ok(resolveAssetRelationBinding(source))
  moduleRegistry.handleModuleUnload('device-binding')
  assert.equal(resolveAssetRelationBinding(source), undefined)
  assert.equal(changes, 4)
  unsubscribe()
})

test('registered direct and shared adapters call the original endpoints with their own request roles', async () => {
  calls.length = 0
  await deviceAssetRelationBindings.device[0].change(source, ['d1'], ['o1'], false)
  await deviceAssetRelationBindings.device[0].change(source, ['d1'], ['o1'], true)
  const shared = createAssetRelationBinding({ source: 'permission', dimensionType: 'org', relation: 'share',
    multiple: true, requestRelation: 'share' })
  await shared.change({ ...source, source: 'permission', relation: 'share' }, ['d1'], ['o2', 'o3'], false)
  assert.deepEqual(calls, [
    ['/assets/bind/device', [{ assetIdList: ['d1'], targetType: 'org', targetId: 'o1' }]],
    ['/assets/unbind/device', [{ assetIdList: ['d1'], targetType: 'org', targetId: 'o1' }]],
    ['/assets/bind/device', ['o2', 'o3'].map(targetId => ({ assetIdList: ['d1'], targetType: 'org', targetId, relation: 'share' }))]
  ])
  response = { status: 403, message: 'source-denied' }
  await assert.rejects(deviceAssetRelationBindings.device[0].change(source, ['d1'], ['o1'], false), /source-denied/)
  response = { status: 200 }
})
