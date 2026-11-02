import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { transformSync } from 'esbuild'

const source = readFileSync(new URL('../src/layout/components/noticeUtils.ts', import.meta.url), 'utf8')
const module = { exports: {} }
new Function('module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs' }).code)(module, module.exports)
const { createTabCountMap } = module.exports

test('multiple channel configurations for one topic count its unread messages once', () => {
  const tabs = [{ key: 'bulletin', type: ['SystemBulletin', 'SystemBulletin'] }]
  assert.deepEqual(createTabCountMap(tabs, {
    topics: [{ topicProvider: 'SystemBulletin', count: 60, overflow: false }],
  }), { bulletin: { count: 60, overflow: false } })
})

test('unique topics still add together and retain capped overflow', () => {
  const tabs = [{ key: 'messages', type: ['a', 'a', 'b'] }]
  assert.deepEqual(createTabCountMap(tabs, {
    topics: [{ topicProvider: 'a', count: 60 }, { topicProvider: 'b', count: 50 }],
  }), { messages: { count: 99, overflow: true } })
  assert.deepEqual(createTabCountMap(tabs, {
    topics: [{ topicProvider: 'a', count: 99, overflow: true }],
  }), { messages: { count: 99, overflow: true } })
})

test('category tabs deduplicate providers and use registered metadata for announcements', () => {
  assert.deepEqual(module.exports.createNoticeCategoryTabs(['a', 'b', 'a', 'bulletin'], ['bulletin', 'bulletin']), [
    {key: 'notification', tab: 'PersonalCenter.messageNotification', type: ['a', 'b']},
    {key: 'announcement', tab: 'PersonalCenter.messageAnnouncement', type: ['bulletin']},
  ])
})

test('registered announcement inbox remains without channels; absent capability adds no fake announcement tab', () => {
  assert.deepEqual(module.exports.createNoticeCategoryTabs([], ['bulletin'])[1].type, ['bulletin'])
  assert.deepEqual(module.exports.createNoticeCategoryTabs([], []), [
    {key: 'notification', tab: 'PersonalCenter.messageNotification', type: []},
  ])
})
