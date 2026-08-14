import assert from 'node:assert/strict'
import {
  getApplicationScopeFromLocation,
  isBusinessApplicationEndpointMissing,
  normalizeBusinessApplications,
  resolveMenuApplicationScope,
  selectApplicationScope,
  setApplicationScope,
} from '../src/utils/application-scope.ts'

const applications = [
  { id: 'application-a' },
  { id: 'application-b' },
]

assert.equal(selectApplicationScope(applications, 'application-b')?.id, 'application-b')
assert.equal(selectApplicationScope(applications, 'removed-application')?.id, 'application-a')
assert.equal(selectApplicationScope([], 'application-a'), undefined)

const values = new Map()
const storage = {
  getItem: key => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: key => values.delete(key),
}

setApplicationScope('application-a', storage)
assert.equal(getApplicationScopeFromLocation({ search: '' }, storage), 'application-a')
assert.equal(
  getApplicationScopeFromLocation({ search: '?applicationScope=application-b' }, storage),
  'application-b',
)
assert.equal(getApplicationScopeFromLocation({ search: '' }, storage), 'application-b')
setApplicationScope(undefined, storage)
assert.equal(getApplicationScopeFromLocation({ search: '' }, storage), undefined)

setApplicationScope('application-a', storage)
assert.equal(resolveMenuApplicationScope(undefined, { search: '' }, storage), 'application-a')
assert.equal(resolveMenuApplicationScope('application-b', { search: '' }, storage), 'application-b')
assert.equal(resolveMenuApplicationScope(false, { search: '' }, storage), undefined)

assert.equal(isBusinessApplicationEndpointMissing({ status: 404 }), true)
assert.equal(isBusinessApplicationEndpointMissing({ response: { status: 404 } }), true)
assert.equal(isBusinessApplicationEndpointMissing({ response: { data: { status: 404 } } }), true)
assert.equal(isBusinessApplicationEndpointMissing({ status: 500 }), false)
assert.equal(isBusinessApplicationEndpointMissing({ success: true, result: applications }), false)

assert.deepEqual(normalizeBusinessApplications({ success: true, result: applications }), applications)
assert.deepEqual(normalizeBusinessApplications({ success: true, result: { data: applications } }), applications)
assert.deepEqual(normalizeBusinessApplications({ success: true, result: applications[0] }), [applications[0]])
assert.deepEqual(normalizeBusinessApplications(applications), applications)
assert.deepEqual(normalizeBusinessApplications({ success: true, result: [] }), [])

console.log('business application context tests passed')
