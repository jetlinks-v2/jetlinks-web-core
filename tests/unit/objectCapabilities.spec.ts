import assert from 'node:assert/strict'
import { lastValueFrom, toArray } from 'rxjs'
import { DefaultDataCapabilityRegistry } from '../../src/data-capability/internal/provider-registry'
import { createObjectCapabilityProvider } from '../../src/object-capability/provider'
import { objectMembers, objectCapabilityId, objectValueSchema } from '../../src/object-capability/metadata'
import { currentObjectSelection, objectDashboardHeight, objectDefaultDashboard } from '../../src/object-capability/dashboard'
import type { DataCapabilityRequest, PersistedDataBinding, PersistedOperationBinding } from '../../src/data-capability/types'
import type { ObjectProviderModel } from '../../src/object-capability/types'

const models: ObjectProviderModel[] = [
  { providerId: 'identity', name: 'Identity', identity: true, metadata: { properties: [{ id: 'state', name: 'State', valueType: { type: 'enum', elements: [{ value: 1, text: 'On' }] } }],
    functions: [{ id: 'apply', name: 'Apply', expands: { functionKind: 'action' }, inputs: [{ id: 'value', valueType: { type: 'double', unit: '℃' } }], output: { type: 'boolean' } }] } },
  { providerId: 'monitor', name: 'Monitor', identity: false, metadata: { properties: [{ id: 'state', name: 'Health', valueType: { type: 'boolean' } }], functions: [{ id: 'internal', output: { type: 'string' } }] } },
]
const members = objectMembers('sample', models)
assert.equal(members.length, 3, 'unclassified internal commands are not callable')
assert.notEqual(objectCapabilityId(members[0].ref), objectCapabilityId(members[2].ref))
assert.equal(objectCapabilityId(members[0].ref), objectCapabilityId({ id: members[0].ref.id, kind: members[0].ref.kind,
  providerId: members[0].ref.providerId, type: members[0].ref.type }), 'member identity is independent of JSON field order')
assert.deepEqual(objectValueSchema(models[0].metadata.properties![0].valueType), { type: 'number', enum: [1], description: undefined })
assert.equal(objectDefaultDashboard(members, { data: 'Data', actions: 'Actions' }).components.length, 2)
assert.equal(objectDashboardHeight({ canvas: {}, components: [] }), 0, 'an empty overview reserves no dashboard space')
assert.equal(objectDashboardHeight({ canvas: { gridLayout: { rowHeight: 20, marginVertical: 10 } }, components: [
  { id: 'visible', type: 'object-data', componentProps: { gridItem: { y: 2, h: 3 } } },
  { id: 'hidden', type: 'object-data', visible: false, componentProps: { gridItem: { y: 100, h: 10 } } },
] }), 140, 'height follows normalized visible grid rows, including saved gaps')

const reads: Array<{ caller: string; url: string; data?: unknown; config?: any }> = []
let writes = 0, target = 'A', multiple = false
function request(caller: string): DataCapabilityRequest {
  return {
    async get(url: string) { reads.push({ caller, url }); return { status: 200, result: models } },
    async post(url: string, data: unknown, config: unknown) {
      reads.push({ caller, url, data, config })
      if (url.endsWith('_resolve')) return { status: 200, result: { objects: multiple ? [{ type: 'sample', id: 'A' }, { type: 'sample', id: 'B' }] : [{ type: 'sample', id: target }], limited: false } }
      if (url.endsWith('properties/_query')) return { status: 200, result: [{ property: 'state', value: caller, providerId: 'monitor' }] }
      writes++; return { status: 200, result: [true] }
    },
  } as DataCapabilityRequest
}
const registry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
registry.registerProvider(createObjectCapabilityProvider())
const first = registry.createRuntime({ runtimeId: 'first', request: request('alice'), attributes: { object: { type: 'sample', id: 'A' } }, parameters: { object: { type: 'sample', id: 'A' } } })
const second = registry.createRuntime({ runtimeId: 'second', request: request('bob'), attributes: { object: { type: 'sample', id: 'B' } }, parameters: { object: { type: 'sample', id: 'B' } } })
const selection = currentObjectSelection(members[2])
const resultA = await first.query<any>(selection.binding as PersistedDataBinding)
const resultB = await second.query<any>(selection.binding as PersistedDataBinding)
assert.equal(resultA.data.values[0].value, 'alice')
assert.equal(resultB.data.values[0].value, 'bob')
assert.ok(reads.filter(read => read.url.endsWith('properties/_query')).every(read => read.config.params.providerId === 'monitor'))
const action = currentObjectSelection(members[1]).binding as PersistedOperationBinding
const prepared = await first.prepareOperation({ ...action, input: { value: 25 } })
assert.equal(writes, 0, 'preparation and selection are read-only')
target = 'changed-after-confirmation'
const events = await lastValueFrom(first.executeOperation(first.confirmOperation(prepared.id, { method: 'ui' })).events$.pipe(toArray()))
assert.equal(writes, 1)
assert.ok(reads.some(read => read.url === '/relation/objects/sample/A/commands/apply'))
assert.ok(events.some(event => event.type === 'result'))
multiple = true
await assert.rejects(first.prepareOperation({ ...action, input: {} }), error => /请选择一个对象/.test((error as Error).message))
assert.equal(writes, 1, 'multi-target actions are never dispatched implicitly')
await first.dispose(); await second.dispose()
console.log('objectCapabilities: source identity, original value types, caller isolation, saved bindings and confirmed target snapshots passed')
