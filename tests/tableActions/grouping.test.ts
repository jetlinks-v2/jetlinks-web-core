import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Comment, Fragment, Text, defineComponent, h } from 'vue'
import { groupTableActionItems } from '../../src/components/TableActions/useTableActions'

const Item = defineComponent({ props: ['common'] })
const group = (nodes: ReturnType<typeof h>[]) => groupTableActionItems(nodes, Item)

test('five actions keep two common items inline in declaration order', () => {
  const nodes = [false, true, false, true, false].map((common, key) => h(Item, { key, common, id: key }))
  const result = group(nodes)
  assert.deepEqual(result.inline.map(node => node.props?.id), [1, 3])
  assert.deepEqual(result.more.map(node => node.props?.id), [0, 2, 4])
  assert.equal(nodes[1].key, 1, 'grouping must not modify original VNodes')
})

test('bare Boolean attribute, default folded state, and all-inline/all-folded', () => {
  assert.equal(group([h(Item, { common: '' })]).inline.length, 1)
  assert.equal(group([h(Item)]).more.length, 1)
  assert.equal(group([h(Item, { common: false })]).more.length, 1)
  assert.equal(group([h(Item, { common: true }), h(Item, { common: true })]).more.length, 0)
  assert.equal(group([h(Item), h(Item)]).inline.length, 0)
})

test('template fragments and v-if comments do not create phantom actions', () => {
  const result = group([
    h(Comment), h(Text, ' '),
    h(Fragment, [h(Item, { common: true }), h(Fragment, [h(Comment), h(Item)])]),
  ])
  assert.equal(result.inline.length, 1)
  assert.equal(result.more.length, 1)
  assert.deepEqual(group([h(Comment), h(Text, '\n')]), { inline: [], more: [] })
})

test('v-for keys remain stable across reordering without colliding across fragments', () => {
  const fragment = (keys: string[]) => h(Fragment, { key: 'loop' }, keys.map(key => h(Item, { key, id: key })))
  const before = group([fragment(['a', 'b'])]).more
  const after = group([fragment(['b', 'a'])]).more
  assert.equal(before[0].key, after[1].key)
  assert.equal(before[1].key, after[0].key)
  const siblings = group([
    h(Fragment, { key: 'one' }, [h(Item, { key: 'a' })]),
    h(Fragment, { key: 'two' }, [h(Item, { key: 'a' })]),
  ]).more
  assert.notEqual(siblings[0].key, siblings[1].key)
})

test('fresh slot render updates additions, removals and common flags', () => {
  assert.equal(group([h(Item, { common: false })]).more.length, 1)
  assert.equal(group([h(Item, { common: true })]).more.length, 0)
  assert.equal(group([h(Item), h(Item)]).more.length, 2)
  assert.deepEqual(group([]), { inline: [], more: [] })
})

test('only explicit items are collected, without traversing business component internals', () => {
  const Wrapper = defineComponent({ render: () => h(Item) })
  assert.deepEqual(group([h(Wrapper), h('span', [h(Item)])]), { inline: [], more: [] })
})
