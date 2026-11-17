import test from 'node:test'
import assert from 'node:assert/strict'
import { routeScrollBehavior } from '../src/router/scrollBehavior.ts'

const route = (path, query = {}, hash = '') => ({ path, query, hash })

test('selecting dates or updating same-page filters preserves document scroll', () => {
  const before = route('/patrol/workbench', { inspectionDay: '2026-11-16' })
  const after = route('/patrol/workbench', { inspectionDay: '2026-11-19', inspectionCalendar: 'month' })
  assert.equal(routeScrollBehavior(after, before, null), false)
  assert.equal(routeScrollBehavior(route('/patrol/tasks', { inspectionStatus: 'completed' }), route('/patrol/tasks'), null), false)
})

test('browser back/forward saved positions take precedence even for query-only navigation', () => {
  const position = { left: 12, top: 320 }
  assert.equal(routeScrollBehavior(route('/patrol/workbench'), route('/patrol/workbench'), position), position)
  assert.equal(routeScrollBehavior(route('/patrol/workbench'), route('/patrol/tasks'), position), position)
})

test('navigating to a different page or hash keeps the existing reset behavior', () => {
  assert.deepEqual(routeScrollBehavior(route('/patrol/tasks'), route('/patrol/workbench'), null), { top: 0 })
  assert.deepEqual(routeScrollBehavior(route('/patrol/workbench', {}, '#next'), route('/patrol/workbench'), null), { top: 0 })
})
