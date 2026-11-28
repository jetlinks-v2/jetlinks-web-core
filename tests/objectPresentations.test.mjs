import assert from 'node:assert/strict'
import test from 'node:test'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
const { objectPresentationRegistry, objectPresentation, objectMemberPresentation } = createDashboardLoader()('object-capability/presentations.ts')
const ref = { providerId: 'source', kind: 'query', id: 'result' }
const source = { ref, component: { name: 'source' } }, root = { ref, component: { name: 'root' } }, target = { ref, component: { name: 'target' } }

test('member resolution uses the selected target type, with source defaults for unregistered types', () => {
  const registry = objectPresentationRegistry([
    { typeId: '*', fields: [], members: [source] },
    { typeId: 'root', fields: [], members: [root] },
    { typeId: 'target', fields: [], members: [target] }
  ])
  assert.equal(objectMemberPresentation({ ...ref, type: 'target' }, registry), target)
  assert.equal(objectMemberPresentation({ ...ref, type: 'root' }, registry), root)
  assert.equal(objectMemberPresentation({ ...ref, type: 'other' }, registry), source)
})

test('contributions preserve directory and detail ownership while merging independent fields and queries', () => {
  const directory = { mode: 'tree', load() {} }, detail = { component: {} }, record = { component: {} }
  const registry = objectPresentationRegistry([
    { typeId: 'asset', fields: [{ key: 'state' }], directory, detail },
    { typeId: 'asset', fields: [{ key: 'alarmCount' }], queries: { alarms: {} }, record }
  ])
  const merged = objectPresentation('asset', registry)
  assert.equal(merged.directory, directory)
  assert.equal(merged.detail, detail)
  assert.equal(merged.record, record)
  assert.deepEqual(merged.fields.map(field => field.key), ['state', 'alarmCount'])
  assert.deepEqual(Object.keys(merged.queries), ['alarms'])
})

test('equal contributions fail independently of loading order instead of silently replacing an owner', () => {
  const a = { typeId: 'asset', fields: [{ key: 'name' }], record: { component: {} }, members: [root] }
  const b = { typeId: 'asset', fields: [{ key: 'name' }], record: { component: {} }, members: [target] }
  for (const entries of [[a, b], [b, a]]) {
    const merged = objectPresentation('asset', objectPresentationRegistry(entries))
    assert.deepEqual(merged.fields, [])
    assert.equal(merged.record, undefined)
    assert.deepEqual(merged.members, [])
  }
})
