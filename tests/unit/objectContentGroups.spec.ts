import assert from 'node:assert/strict'
import { objectMembers } from '../../src/object-capability/metadata'
import { objectMemberContentGroup } from '../../src/object-capability/content'
import {
  addObjectDashboardSelection,
  currentObjectSelection,
  objectReadingDashboard,
  objectDefaultDashboard,
  objectWidgetSelections,
  dashboardSelections,
  addObjectDashboardGroup
} from '../../src/object-capability/dashboard'
import type { ObjectPropertyMetadata, ObjectProviderModel } from '../../src/object-capability/types'

const field = (id: string, expands?: ObjectPropertyMetadata['expands']) => ({
  id,
  valueType: { type: 'double', unit: '%' },
  expands
})
const providers: ObjectProviderModel[] = [
  {
    providerId: 'identity',
    name: 'Facts',
    identity: true,
    metadata: {
      properties: [
        field('id', { semanticRole: 'identity' }),
        field('name'),
        field('cpu'),
        field('state', { semanticRole: 'status' }),
        field('product', { reference: { targetType: 'product' } }),
        field('custom', { semanticRole: 'domain:custom' })
      ]
    }
  },
  {
    providerId: 'arbitrary-name',
    name: 'Source',
    identity: false,
    metadata: {
      expands: { semanticTypes: ['observation', 'domain:reading'] },
      properties: [
        ...Array.from({ length: 8 }, (_, i) => field(`reading-${i}`)),
        field('state', { semanticRole: 'status' }),
        field('target', { reference: { targetType: 'space' } })
      ]
    }
  },
  {
    providerId: 'other',
    name: 'Other',
    identity: false,
    metadata: {
      properties: [
        field('calculated', { semanticRole: 'result' }),
        field('legacy', { semanticRole: 'value' }),
        field('typed', { semanticTypes: ['observation'] })
      ],
      functions: [
        { id: 'history', expands: { functionKind: 'query' } },
        { id: 'inspect', expands: { functionKind: 'action' } }
      ]
    }
  }
]
const members = objectMembers('resource', providers)
const find = (id: string, providerId = 'identity') =>
  members.find((m) => m.ref.id === id && m.ref.providerId === providerId)!
assert.equal(
  objectMemberContentGroup(find('cpu')),
  'data',
  'a numeric CPU-looking name with a unit is not a reading declaration'
)
assert.equal(objectMemberContentGroup(find('custom')), 'data', 'unknown vocabulary is retained, not guessed')
assert.equal(objectMemberContentGroup(find('reading-0', 'arbitrary-name')), 'observations')
assert.deepEqual(find('reading-0', 'arbitrary-name').sourceSemanticTypes, ['observation', 'domain:reading'])
assert.equal(
  objectMemberContentGroup(find('state', 'arbitrary-name')),
  'status',
  'field meaning takes precedence over source classification'
)
assert.equal(objectMemberContentGroup(find('target', 'arbitrary-name')), 'references')
for (const id of ['calculated', 'legacy', 'typed'])
  assert.equal(objectMemberContentGroup(find(id, 'other')), 'observations')
const labels = {
  data: 'Facts',
  status: 'Status',
  references: 'Links',
  observations: 'Readings',
  related: 'Other data',
  actions: 'Actions'
}
const snapshot = structuredClone(providers)
const dashboard = objectDefaultDashboard(members, labels)
assert.deepEqual(providers, snapshot, 'projection does not mutate original metadata')
const groups = dashboard.components
assert.deepEqual(
  groups.map((g) => g.name),
  ['Facts', 'Status', 'Links', 'Readings', 'Actions']
)
assert.equal(
  objectWidgetSelections(groups.find((g) => g.name === 'Readings')!, members).length,
  6,
  'each group remains bounded'
)
assert.ok(dashboardSelections(dashboard, members).every(selection => selection.member.id !== 'id'))
assert.ok(
  !dashboardSelections(dashboard, members).some(selection => selection.member.kind === 'query'),
  'default rendering never executes arbitrary queries'
)
assert.equal(objectDefaultDashboard([], labels).components.length, 0)
function assertNoOverlap(items: typeof groups) {
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].componentProps.gridItem!,
        b = items[j].componentProps.gridItem!
      assert.ok(
        a.x! + a.w! <= b.x! || b.x! + b.w! <= a.x! || a.y! + a.h! <= b.y! || b.y! + b.h! <= a.y!,
        'content groups never overlap, including after adding another reading'
      )
    }
}
assertNoOverlap(groups)
const readingSnapshot = structuredClone(dashboard)
const measured = objectReadingDashboard(dashboard, { [groups[0].id]: 320 })
assertNoOverlap(measured.components)
assert.ok(measured.components[0].componentProps.gridItem!.h! > groups[0].componentProps.gridItem!.h!)
assert.equal(measured.components[1].componentProps.gridItem!.x, groups[1].componentProps.gridItem!.x)
assert.deepEqual(dashboard, readingSnapshot, 'measured reading layout never changes saved coordinates or names')
const narrow = objectReadingDashboard(dashboard, { [groups[0].id]: 320 }, true)
assertNoOverlap(narrow.components)
assert.ok(narrow.components.every(item => item.componentProps.gridItem!.w === 12 && item.componentProps.gridItem!.x === 0))
const addition = currentObjectSelection(find('reading-7', 'arbitrary-name'))
const added = addObjectDashboardSelection(dashboard, addition, members, labels)
assertNoOverlap(added.components)
assert.ok(dashboardSelections(added, members).some(selection => selection.member.id === 'reading-7'))
assert.equal(dashboardSelections(dashboard, members).some(selection => selection.member.id === 'reading-7'), false)
assert.equal(addObjectDashboardSelection(added, addition, members, labels), added, 'duplicate insertion is a no-op')
const template = addObjectDashboardGroup({ canvas: {}, components: [] }, 'observations', labels)
const serialized = JSON.stringify(template)
assert.equal(serialized.includes('reading-'), false, 'public templates store no sample-specific property or object ID')
const other = [find('typed', 'other')]
assert.deepEqual(dashboardSelections(template, other).map(item => item.member.id), ['typed'], 'the same template resolves the next instance model')
assert.equal(addObjectDashboardGroup(template, 'observations', labels), template)
const secondPage = objectWidgetSelections(template.components[0], members, 1)
assert.ok(secondPage.length > 0 && secondPage.length <= 6)
assert.ok(secondPage.every(item => !dashboardSelections(template, members).some(first => first.member.id === item.member.id)))
const mixed = {
  canvas: {},
  components: [
    {
      id: 'custom',
      type: 'object-data',
      name: 'Saved mix',
      componentProps: {
        gridItem: { x: 2, y: 4, w: 8, h: 5 },
        selections: [currentObjectSelection(find('name')), currentObjectSelection(find('reading-0', 'arbitrary-name'))]
      }
    }
  ]
}
const saved = structuredClone(mixed)
const appended = addObjectDashboardSelection(mixed, addition, members, labels)
assert.deepEqual(appended.components[0], saved.components[0], 'saved mixed selections and coordinates are not migrated')
assert.equal(appended.components[1].name, 'Readings')
const query = currentObjectSelection(find('history', 'other'))
assert.equal(
  addObjectDashboardSelection(mixed, query, [], labels).components[1].name,
  'Other data',
  'an unloaded query cannot be placed among basic fields'
)
console.log(
  'objectContentGroups: semantic precedence, unknown fields, bounds, stable layout and saved-view preservation passed'
)
