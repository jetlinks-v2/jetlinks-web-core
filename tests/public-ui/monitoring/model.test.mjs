import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope } from 'vue'
import { useDeviceList } from './useDeviceList.ts'
import { queryNoPaging, queryDetails, countDevices } from './data.ts'

async function until(predicate) {
  const end = Date.now() + 6000
  while (!predicate()) {
    if (Date.now() > end) throw new Error('Timed out waiting for demonstration state')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
test('list arrives before its independent count; switching scope discards old work and batches append without duplicates', async () => {
  const scope = effectScope()
  const list = scope.run(useDeviceList)
  try {
    list.chooseGroup('all')
    await until(() => list.rows.value.length === 6 && !list.loading.value)
    assert.equal(list.countLoading.value, true)
    assert.equal(list.total.value, undefined)
    list.chooseGroup('cooling')
    await until(() => list.rows.value.length === 6 && !list.loading.value)
    assert.ok(list.rows.value.every(item => item.group === 'cooling'))
    await list.loadMore()
    assert.equal(new Set(list.rows.value.map(item => item.id)).size, 12)
    await until(() => !list.countLoading.value)
    assert.equal(list.total.value, 12)
    assert.deepEqual(list.counts.value, { total: 12, normal: 9, attention: 2, offline: 1 })
    assert.deepEqual(list.groupCounts.value, { all: 48, power: 12, cooling: 12, air: 12, environment: 12 })
    await list.loadMore()
    assert.equal(list.ended.value, true)
    await until(() => Object.keys(list.details.value).length === 12)
  } finally { scope.stop() }
})
test('an aborted list stream terminates before yielding any device', async () => {
  const controller = new AbortController()
  const iterator = queryNoPaging({ group: 'all', terms: [] }, 0, controller.signal)
  controller.abort()
  await assert.rejects(iterator.next(), { name: 'AbortError' })
})

test('composed conditions constrain both the stream and independent count, preserving the group scope', async () => {
  const query = { group: 'cooling', terms: [
    { column: 'model', termType: 'like', value: '%循环泵%' },
    { terms: [{ column: 'status', termType: 'eq', value: 'low' }, { column: 'status', termType: 'eq', value: 'high', type: 'or' }] },
  ] }
  const signal = new AbortController().signal, rows = []
  const count = countDevices(query, signal)
  for await (const point of queryNoPaging(query, 0, signal)) rows.push(point)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, '供水压力')
  assert.deepEqual(await count, { total: rows.length, normal: 0, attention: 1, offline: 0 })
})

test('status badges share the filter model, replace status without losing other conditions, and retain comparison counts', async () => {
  const scope = effectScope(), list = scope.run(useDeviceList)
  try {
    await until(() => !list.countLoading.value)
    const distribution = list.counts.value
    const groupDistribution = list.groupCounts.value
    list.chooseDistribution('attention'); list.applyTerms(list.terms.value)
    await until(() => !list.loading.value)
    assert.deepEqual(list.rows.value.map(point => point.status).sort(), ['high', 'low'])
    assert.equal(list.activeDistribution.value, 'attention')
    assert.equal(list.counts.value, distribution)
    assert.equal(list.countLoading.value, false)
    assert.equal(list.groupCounts.value, groupDistribution)
    list.chooseDistribution('normal'); list.applyTerms(list.terms.value)
    await until(() => !list.loading.value)
    assert.equal(list.terms.value.length, 1)
    assert.ok(list.rows.value.every(point => point.status === 'normal'))
    assert.equal(list.counts.value.normal, 9)

    list.terms.value.unshift({ column: 'name', termType: 'like', value: '回水' })
    list.chooseDistribution('attention')
    assert.equal(list.terms.value[0].column, 'name')
    list.applyTerms([{ column: 'name', termType: 'like', value: '%回水%' }, list.terms.value[1]])
    await until(() => !list.loading.value && !list.countLoading.value)
    assert.equal(list.rows.value[0].name, '回水温度')
    assert.deepEqual(list.counts.value, { total: 1, normal: 0, attention: 1, offline: 0 })
    assert.deepEqual(list.groupCounts.value, { all: 1, power: 0, cooling: 1, air: 0, environment: 0 })
    list.chooseDistribution('attention')
    assert.equal(list.activeDistribution.value, 'total')
    assert.equal(list.terms.value.length, 1)
    assert.equal(list.terms.value[0].value, '回水')
    list.terms.value = []; list.applyTerms([])
    await until(() => !list.countLoading.value)
    assert.equal(list.counts.value.total, 12)
  } finally { scope.stop() }
})

test('a shortcut intersects a mixed OR query without rewriting its meaning', async () => {
  const scope = effectScope(), list = scope.run(useDeviceList)
  try {
    const original = [{ column: 'name', termType: 'eq', value: '回水温度' }, { column: 'name', termType: 'eq', value: '供水压力', type: 'or' }]
    list.terms.value = original
    list.chooseDistribution('attention')
    assert.deepEqual(list.terms.value[0].terms, original)
    list.applyTerms(list.terms.value)
    await until(() => !list.loading.value && !list.countLoading.value)
    assert.equal(list.rows.value.length, 2)
    assert.equal(list.counts.value.total, 2)
    list.chooseDistribution('normal'); list.applyTerms(list.terms.value)
    await until(() => !list.loading.value)
    assert.equal(list.rows.value.length, 0)
    assert.equal(list.counts.value.attention, 2)
  } finally { scope.stop() }
})

test('the business reading and the final trend sample agree, including units and reference bounds', async () => {
  const data = await queryDetails(['PT-0013', 'PT-0014'], new AbortController().signal)
  assert.equal(data['PT-0013'].unit, '°C')
  assert.equal(data['PT-0013'].value, 38.6)
  assert.equal(data['PT-0013'].history.at(-1), 38.6)
  assert.ok(data['PT-0013'].value > data['PT-0013'].upper)
  assert.equal(data['PT-0014'].unit, 'MPa')
  assert.ok(data['PT-0014'].value < data['PT-0014'].lower)
})
