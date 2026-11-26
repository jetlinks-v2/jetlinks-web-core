import assert from 'node:assert/strict'
import { createRenderer, shallowRef } from 'vue'
import {
  defaultObjectMembers,
  propertyReference,
  referenceValue,
  resolveReferenceNames
} from '../../src/object-capability/references'
import { objectCapabilityId, objectMembers } from '../../src/object-capability/metadata'
import { useObjectCapabilities } from '../../src/object-capability/useObjectCapabilities'
import { objectCapabilitiesApi } from '../../src/object-capability/api'
import type { ObjectProviderModel } from '../../src/object-capability/types'
import type { DataCapabilityRequest } from '../../src/data-capability/types'

// Work orders use the same protocol as devices, without any field-name inference.
const models: ObjectProviderModel[] = [
  {
    providerId: 'identity',
    name: 'Work orders',
    identity: true,
    metadata: {
      properties: [
        { id: 'key', valueType: { type: 'string' }, expands: { semanticRole: 'identity' } },
        { id: 'number', valueType: { type: 'string' }, expands: { semanticRole: 'identifier' } },
        {
          id: 'project',
          valueType: { type: 'string' },
          expands: {
            semanticRole: 'modelId',
            reference: { targetType: 'project', relationId: 'belongsTo', labelProperty: 'projectTitle' }
          }
        },
        { id: 'projectTitle', valueType: { type: 'string' } },
        { id: 'productId', valueType: { type: 'string' } },
        {
          id: 'reviewers',
          valueType: { type: 'array', elementType: { type: 'string' } },
          expands: { reference: { targetType: 'person', reverse: true } }
        }
      ]
    }
  },
  {
    providerId: 'audit',
    name: 'Audit',
    identity: false,
    metadata: {
      properties: [
        { id: 'key', valueType: { type: 'string' }, expands: { semanticRole: 'identity' } },
        { id: 'projectTitle', valueType: { type: 'string' } }
      ]
    }
  }
]
const members = objectMembers('workOrder', models)
const defaults = defaultObjectMembers(members)
assert.deepEqual(
  defaults.map((item) => [item.ref.providerId, item.ref.id]),
  [
    ['identity', 'number'],
    ['identity', 'project'],
    ['identity', 'productId'],
    ['identity', 'reviewers'],
    ['audit', 'key'],
    ['audit', 'projectTitle']
  ],
  'only the current identity and the same-source companion name are omitted'
)
assert.equal(propertyReference(members[4]), undefined, 'an Id suffix does not imply a reference')
const properties = new Map<string, unknown>([
  ['project', 'P1'],
  ['projectTitle', 'Water supply']
])
const project = referenceValue(members[2], 'P1', properties)!
assert.deepEqual(project.items, [{ type: 'project', id: 'P1', name: 'Water supply' }])
assert.equal(properties.get('project'), 'P1', 'display projection does not replace the calculation value')
assert.equal(
  referenceValue(members[2], { id: 'P1' }, properties),
  undefined,
  'unsupported data is not misreported as no association'
)
assert.deepEqual(referenceValue(members[2], null, properties)?.items, [])
assert.deepEqual(
  referenceValue(members[2], '', properties)?.items,
  [],
  'an unset scalar reference is not a target with an empty ID'
)
const many = referenceValue(
  members[5],
  Array.from({ length: 23 }, (_, index) => String(index)),
  new Map()
)!
assert.equal(many.items.length, 20)
assert.equal(many.limited, true)
const calls: Array<{ type: string; ids: string[] }> = []
const resolved = await resolveReferenceNames(
  [
    project,
    {
      items: [
        { type: 'person', id: 'P1' },
        { type: 'person', id: 'P1' },
        { type: 'person', id: 'missing' }
      ],
      limited: false
    }
  ],
  async (type, ids) => {
    calls.push({ type, ids })
    return [{ id: 'P1', name: 'Alice' }]
  }
)
assert.deepEqual(
  calls,
  [{ type: 'person', ids: ['P1', 'missing'] }],
  'snapshot names need no redundant lookup and IDs are deduplicated within a type'
)
assert.equal(resolved[0].items[0].name, 'Water supply')
assert.equal(resolved[1].items[0].name, 'Alice', 'equal IDs of different types remain different objects')
assert.equal(resolved[1].items[2].unavailable, true)
const failure = await resolveReferenceNames([{ items: [{ type: 'project', id: 'P1' }], limited: false }], async () => {
  throw Error('source denied')
})
assert.equal(failure[0].items[0].id, 'P1')
assert.equal(failure[0].items[0].unavailable, true)
const batches: number[] = []
await resolveReferenceNames(
  [{ items: Array.from({ length: 260 }, (_, index) => ({ type: 'person', id: String(index) })), limited: false }],
  async (_type, ids) => {
    batches.push(ids.length)
    return ids.map((id) => ({ id }))
  }
)
assert.deepEqual(batches, [128, 128, 4])

const requests: Array<{ url: string; data: unknown; config: unknown }> = []
const controller = new AbortController()
const http = {
  async post(url: string, data: unknown, config: unknown) {
    requests.push({ url, data, config })
    return { status: 200, result: { data: [{ id: 'P1', name: 'Project' }] } }
  }
} as unknown as DataCapabilityRequest
await objectCapabilitiesApi({ request: http, attributes: { tenant: 'current' } }).objects(
  'project',
  ['P1'],
  controller.signal
)
assert.deepEqual(requests[0], {
  url: '/relation/objects/_query',
  data: {
    type: 'project',
    query: { paging: true, pageIndex: 0, pageSize: 1, terms: [{ column: 'id', termType: 'in', value: ['P1'] }] }
  },
  config: { signal: controller.signal, hiddenError: true }
})

// Exercise the real hook: companion reads share the original provider request; late target lookups cannot overwrite the next object.
const renderer = createRenderer<object, object>({
  patchProp() {},
  insert() {},
  remove() {},
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText() {},
  setElementText() {},
  parentNode: () => null,
  nextSibling: () => null
})
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const object = shallowRef({ type: 'workOrder', id: 'W1' })
const selected = shallowRef([objectCapabilityId(members[2].ref), objectCapabilityId(members[5].ref)])
let lookup!: (data: unknown) => void, oldSignal: AbortSignal | undefined
const reads: Array<{ keys: string[]; provider: string }> = []
const request = {
  async get() {
    return { status: 200, result: models }
  },
  post(url: string, body: { keys?: string[] }, config: { params?: { providerId: string }; signal: AbortSignal }) {
    if (url === '/relation/objects/_query') {
      oldSignal = config.signal
      return new Promise((resolve) => {
        lookup = resolve
      })
    }
    reads.push({ keys: body.keys!, provider: config.params!.providerId })
    const values: Record<string, unknown> = { project: 'P1', projectTitle: 'Water supply', reviewers: ['P1'] }
    return Promise.resolve({
      status: 200,
      result: body.keys!.map((property) => ({ property, value: values[property], providerId: 'identity' }))
    })
  }
} as unknown as DataCapabilityRequest
let capability!: ReturnType<typeof useObjectCapabilities>
const app = renderer.createApp({
  setup() {
    capability = useObjectCapabilities(object, { request, selected })
    return () => null
  }
})
app.mount({})
await flush()
await flush()
assert.deepEqual(reads, [{ keys: ['project', 'projectTitle', 'reviewers'], provider: 'identity' }])
assert.equal(capability.values.value[objectCapabilityId(members[2].ref)].value, 'P1')
selected.value = []
object.value = { type: 'workOrder', id: 'W2' }
await flush()
await flush()
assert.equal(oldSignal?.aborted, true)
lookup({ status: 200, result: { data: [{ id: 'P1', name: 'Late name' }] } })
await flush()
assert.deepEqual(capability.values.value, {}, 'previous object reference results are discarded')
app.unmount()
console.log(
  'objectReferences: semantic defaults, non-device references, original values, batches, request context and stale lookup lifetime passed'
)
