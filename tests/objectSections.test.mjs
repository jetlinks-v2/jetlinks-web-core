import assert from 'node:assert/strict'
import test from 'node:test'
import { createDashboardLoader } from './helpers/dashboardRuntime.mjs'
const load = createDashboardLoader()
const { objectSectionPresentations, objectMemberPresentations, objectMemberSection } = load('object-capability/sections.ts')
const { objectDefaultDashboard, objectWidgetSelections, currentObjectSelection, addObjectDashboardSelection } = load('object-capability/dashboard.ts')
const member = (id, kind = 'property') => ({ ref: { type: 'asset', providerId: 'source', kind, id }, name: id, sourceName: 'Source', metadata: { id, valueType: { type: 'double' }, expands: { semanticRole: 'result' } } })
const section = (id, binding) => ({ id, label: () => id, members: [binding] })
const binding = { providerId: 'source', kind: 'property' }
const contribution = (typeId, sections, members = []) => ({ typeId, fields: [], sections, members })

test('exact types override source defaults and equal registrations fall back independently of loading order', () => {
  const shared = section('readings', binding), exact = { ...shared, label: () => 'exact' }
  assert.deepEqual(objectSectionPresentations('asset', [contribution('*', [shared]), contribution('asset', [exact])]), [exact])
  for (const entries of [[shared, exact], [exact, shared]]) {
    assert.deepEqual(objectSectionPresentations('asset', entries.map(item => contribution('asset', [item]))), [])
    const duplicate = { ref: { providerId: 'source', kind: 'property', id: 'value' }, component: {} }
    assert.deepEqual(objectMemberPresentations('asset', [contribution('asset', [], [duplicate]), contribution('asset', [], [duplicate])]), [])
  }
})
test('precise member bindings win over a source group, while ambiguous or unrelated declarations remain generic', () => {
  const broad = section('source', binding), exact = section('value', { ...binding, id: 'reading' })
  assert.equal(objectMemberSection(member('reading'), [broad, exact]), exact)
  assert.equal(objectMemberSection(member('other'), [broad, exact]), broad)
  assert.equal(objectMemberSection(member('reading'), [exact, { ...exact, id: 'conflict' }]), undefined)
  assert.equal(objectMemberSection(member('reading', 'query'), [broad]), undefined)
})
test('default sections retain source bindings for generic fallback and never implicitly run queries', () => {
  const definition = section('readings', binding), members = [member('reading'), member('extra'), member('analysis', 'query')]
  const labels = { data: 'Facts', actions: 'Actions', observations: 'Readings' }
  const value = objectDefaultDashboard(members, labels, [definition])
  assert.equal(value.components.length, 1)
  assert.equal(value.components[0].componentProps.sectionId, 'readings')
  assert.deepEqual(objectWidgetSelections(value.components[0], members).map(item => item.member.id), ['reading', 'extra'])
  const querySection = section('analysis', { providerId: 'source', kind: 'query', id: 'analysis' })
  const selected = currentObjectSelection(members[2])
  const edited = addObjectDashboardSelection(value, selected, members, labels, [definition, querySection])
  assert.equal(edited.components.length, 2)
  assert.deepEqual(objectWidgetSelections(edited.components[1], members), [selected])
  const corrupted = { ...value.components[0], componentProps: { sectionId: 'readings', sectionMembers: { providerId: 'source' } } }
  assert.deepEqual(objectWidgetSelections(corrupted, members), [])
  corrupted.componentProps.sectionMembers = [null, {}, { providerId: 'source', kind: 'execute' }]
  assert.deepEqual(objectWidgetSelections(corrupted, members), [])
})
