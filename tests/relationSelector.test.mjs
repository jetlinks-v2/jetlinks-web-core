import assert from 'node:assert/strict'
import test from 'node:test'
import * as vue from 'vue'
import { Observable } from 'rxjs'
import { createModuleLoader } from './helpers/moduleRuntime.mjs'

const flush = async () => { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }
function createRelationRenderer() {
  const node = () => ({ children: [] })
  const renderer = vue.createRenderer({
    createElement: node, createText: node, createComment: node,
    insert: (child, parent) => { child.parent = parent; parent.children.push(child) },
    remove: child => { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1) },
    setText() {}, setElementText() {}, patchProp() {},
    parentNode: child => child.parent, nextSibling: () => null,
  })
  return { renderer, root: node() }
}

const origin = { key: 'trigger', label: '触发设备', root: { objectType: 'device', objectSource: { source: 'upper', upperKey: 'input.id' } } }
const manager = { relation: 'manager', name: '负责人', targetType: 'user' }
const org = { relation: 'owner', name: '所属组织', targetType: 'org' }
const catalog = () => ({
  types: async () => [{ id: 'device', name: '设备' }, { id: 'org', name: '组织' }, { id: 'user', name: '人员' }],
  relations: async type => type === 'device' ? [manager, org] : type === 'org' ? [manager] : [{ relation: 'managed', name: '负责人', reverseName: '负责的设备', reverse: true, targetType: 'device' }],
})
const load = createModuleLoader({ '@jetlinks-web-core/utils/ndjson': { createRuntimeNdJson: () => ({}) },
  '@jetlinks-web/core': { request: {} },
  [new URL('../src/utils/ndjson.ts', import.meta.url).pathname]: { createRuntimeNdJson: () => ({}) },
})
const path = load('components/RelationSelector/path.ts')
const { useRelationSelector } = load('components/RelationSelector/useRelationSelector.ts')

function selector(extra = {}, api = catalog()) {
  const scope = vue.effectScope()
  const props = vue.reactive({ options: { origins: [origin], targetTypes: ['user'] }, ...extra })
  const updates = []
  const language = vue.ref('zh')
  const state = scope.run(() => useRelationSelector(props, value => updates.push(value), language, api))
  return { props, updates, language, state, stop: () => scope.stop() }
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }

test('协议往返保留动态根、任意 options 和有限同类型重复，且不修改原值', () => {
  const steps = [
    { objectType: 'user', relation: 'manager', options: { reverse: false, custom: 'retained' } },
    { objectType: 'device', relation: 'managed', options: { reverse: true } },
    { objectType: 'user', relation: 'creator' },
  ]
  const value = path.relationValue(origin, steps)
  assert.deepEqual(path.relationSteps(value), steps)
  assert.equal(value.related.next.options.reverse, true)
  assert.equal(value.related.next.next.next, undefined)
  value.related.options.custom = 'edited'
  assert.equal(steps[0].options.custom, 'retained')
  assert.deepEqual(path.relationValue({ key: 'fixed', label: '固定对象', root: { objectType: 'user', objectId: 'u1' } }, []), { objectType: 'user', objectId: 'u1' })
  assert.notEqual(path.relationStepKey(steps[0]), path.relationStepKey({ ...steps[0], options: { reverse: true } }))
})

test('单跳直接提交；多跳中途关闭不提交，重开后可完成', async () => {
  const fixture = selector()
  const { state, updates } = fixture
  state.setOpen(true); await flush()
  assert.equal(state.rows.value[0].label, '负责人')
  state.select(state.rows.value.find(row => row.info.targetType === 'org').key); await flush()
  assert.equal(state.open.value, true)
  assert.equal(updates.length, 0)
  state.setOpen(false); state.setOpen(true); await flush()
  assert.equal(state.prefix.value.length, 0)
  state.select(state.rows.value.find(row => row.info.targetType === 'org').key); await flush()
  state.select(state.rows.value[0].key)
  assert.equal(updates[0].related.objectType, 'org')
  assert.equal(updates[0].related.next.objectType, 'user')
  assert.equal(state.open.value, false)
  fixture.stop()
})

test('回显多起点和反向名称；搜索当前层，继续多跳允许类型重复', async () => {
  const another = { ...origin, key: 'another', label: '另一个设备', root: { ...origin.root, objectSource: { source: 'upper', upperKey: 'other.id' } } }
  const value = path.relationValue(another, [{ objectType: 'user', relation: 'manager' }])
  const fixture = selector({ value, options: { origins: [origin, another], targetTypes: ['user', 'device'] } })
  const { state, props, updates } = fixture
  await flush(); state.setOpen(true); await flush()
  assert.equal(state.originKey.value, 'another')
  assert.equal(state.labels.value[0], '另一个设备')
  state.continueFromSaved(); await flush()
  state.keyword.value = '负责的设备'
  assert.equal(state.rows.value.length, 1)
  state.select(state.rows.value[0].key)
  assert.equal(updates[0].related.next.options.reverse, true)
  props.value = updates[0]; await flush()
  assert.deepEqual(state.labels.value, ['另一个设备', '负责人', '负责的设备'])
  fixture.stop()
})

test('零跳、空终点集、禁用与只读边界', async () => {
  const fixture = selector({ options: { origins: [origin], targetTypes: ['device'] } })
  fixture.state.setOpen(true); await flush()
  fixture.state.useSelf()
  assert.deepEqual(fixture.updates[0], origin.root)
  fixture.props.options = { origins: [origin], targetTypes: [] }; await flush()
  fixture.state.setOpen(true); await flush()
  assert.equal(fixture.state.canUseSelf.value, false)
  assert.ok(fixture.state.rows.value.every(row => row.more))
  fixture.props.disabled = true; await flush()
  fixture.state.setOpen(true); fixture.state.clear()
  assert.equal(fixture.state.open.value, false)
  assert.equal(fixture.updates.length, 1)
  fixture.props.disabled = false; fixture.props.readonly = true; await flush()
  fixture.state.setOpen(true)
  assert.equal(fixture.state.open.value, false)
  fixture.stop()
})

test('返回旧层时迟到响应不覆盖当前位置；每层搜索可恢复', async () => {
  const pending = deferred()
  const api = catalog(); const read = api.relations
  api.relations = type => type === 'org' ? pending.promise : read(type)
  const fixture = selector({}, api)
  const { state } = fixture
  state.setOpen(true); await flush()
  state.keyword.value = '组织'
  state.select(state.rows.value[0].key)
  state.navigate(0); await flush()
  assert.equal(state.keyword.value, '组织')
  assert.equal(state.rows.value[0].info.targetType, 'org')
  pending.resolve([manager]); await flush()
  assert.equal(state.rows.value[0].info.targetType, 'org')
  assert.equal(state.loading.value, false)
  fixture.stop()
})

test('目录失效与网络失败不同，重试恢复；切换语言丢弃旧目录', async () => {
  let english = false, unavailable = true
  const api = catalog()
  api.relations = async () => { if (unavailable) throw new Error('offline'); return [{ ...manager, name: english ? 'Manager' : '负责人' }] }
  const fixture = selector({ value: path.relationValue(origin, [{ objectType: 'user', relation: 'manager', options: { custom: 'keep' } }]) }, api)
  await flush()
  assert.equal(fixture.state.displayFailed.value, true)
  assert.equal(fixture.state.invalid.value, false)
  fixture.state.setOpen(true); await flush()
  assert.equal(fixture.state.failed.value, true)
  unavailable = false; fixture.state.retry(); await flush()
  assert.equal(fixture.state.invalid.value, false)
  english = true; fixture.language.value = 'en'; await flush()
  assert.equal(fixture.state.rows.value[0].label, 'Manager')
  fixture.state.select(fixture.state.rows.value[0].key)
  assert.equal(fixture.updates[0].related.options.custom, 'keep')
  fixture.props.value = path.relationValue(origin, [{ objectType: 'user', relation: 'removed' }]); await flush()
  assert.equal(fixture.state.invalid.value, true)
  fixture.stop()
})

test('真实查询适配使用原接口、分页样例搜索、有限流读取并在截断时退订', async () => {
  const calls = []; let unsubscribed = false
  const apiLoad = createModuleLoader({
    '@jetlinks-web/core': { request: { post: async (...args) => { calls.push(args); return { result: [{ id: 'd1', name: 'Sample' }] } } } },
    [new URL('../src/utils/ndjson.ts', import.meta.url).pathname]: { createRuntimeNdJson: () => ({ post: (url, body) => {
      calls.push([url, body]); return new Observable(subscriber => {
        for (let i = 0; i < 100 && !subscriber.closed; i++) subscriber.next({ result: { id: String(i), type: 'user', properties: { name: `User ${i}` } } })
        return () => { unsubscribed = true }
      })
    } }) },
  })
  const { relationApi } = apiLoad('api/relations.ts')
  await relationApi.objects('device', 'pump', 2)
  assert.deepEqual(calls[0][1].query, { paging: true, pageIndex: 2, pageSize: 20, terms: [{ column: 'name', termType: 'like', value: '%pump%' }] })
  const preview = await relationApi.preview({ objectType: 'device', objectId: 'd1' }, new AbortController().signal)
  assert.equal(preview.data.length, 20)
  assert.equal(preview.limited, true)
  assert.equal(unsubscribed, true)
  assert.equal(calls[1][0], '/relation/_parse')
  assert.deepEqual(calls[1][1].properties, ['name'])
})

test('样例仅替换试查根，查询取消或输入变化后不展示迟到结果', async () => {
  const { useRelationSelectorLab, sampleSpec } = load('views/relation-selector/lab/useRelationSelectorLab.ts')
  const value = path.relationValue(origin, [{ objectType: 'user', relation: 'manager' }])
  assert.deepEqual(sampleSpec(value, 'd1'), { objectType: 'device', objectId: 'd1', related: value.related })
  assert.equal(value.objectSource.upperKey, 'input.id')
  const pending = deferred(); let signal
  const { renderer, root } = createRelationRenderer()
  let state
  const app = renderer.createApp({ setup() {
    state = useRelationSelectorLab(vue.ref('zh'), {
      ...catalog(), objects: async () => [], preview: async (_value, input) => { signal = input; return pending.promise },
    })
    return () => null
  } })
  app.mount(root)
  await flush()
  state.value.value = value; state.sampleId.value = 'd1'; await flush()
  void state.query(); await flush()
  assert.equal(state.queryState.value, 'loading')
  state.cancel()
  assert.equal(signal.aborted, true)
  pending.resolve({ data: [{ id: 'u1', type: 'user' }], limited: false }); await flush()
  assert.equal(state.queryState.value, 'cancelled')
  assert.deepEqual(state.data.value, [])
  app.unmount()
})

test('同类型切换起点保留已到达的层；不同类型从新根开始', async () => {
  const fixture = selector({ options: { origins: [origin,
    { key: 'second', label: '另一个设备', root: { objectType: 'device', objectId: 'second' } },
    { key: 'user', label: '人员', root: { objectType: 'user', objectId: 'u1' } }], targetTypes: ['user'] } })
  fixture.state.setOpen(true); await flush()
  fixture.state.select(fixture.state.rows.value.find(row => row.info.targetType === 'org').key); await flush()
  fixture.state.changeOrigin('second'); await flush()
  assert.equal(fixture.state.prefix.value.length, 1)
  fixture.state.select(fixture.state.rows.value[0].key)
  assert.equal(fixture.updates[0].objectId, 'second')
  assert.equal(fixture.updates[0].related.next.objectType, 'user')
  fixture.state.setOpen(true); await flush()
  fixture.state.changeOrigin('user'); await flush()
  assert.equal(fixture.state.prefix.value.length, 0)
  fixture.stop()
})

test('试查错误不显示为空结果，重新查询成功后可以按名称筛选', async () => {
  const { useRelationSelectorLab } = load('views/relation-selector/lab/useRelationSelectorLab.ts')
  let fail = true
  const { renderer, root } = createRelationRenderer()
  let state
  const app = renderer.createApp({ setup() {
    state = useRelationSelectorLab(vue.ref('zh'), {
      ...catalog(), objects: async () => [], preview: async () => {
        if (fail) throw new Error('access denied')
        return { data: [{ id: 'u1', type: 'user', properties: { name: '张三' } }, { id: 'u2', type: 'user', properties: { name: '李四' } }], limited: false }
      },
    })
    return () => null
  } })
  app.mount(root); await flush()
  state.value.value = path.relationValue(origin, [{ objectType: 'user', relation: 'manager' }])
  state.sampleId.value = 'd1'; await flush()
  await state.query()
  assert.equal(state.queryState.value, 'error')
  assert.equal(state.queryError.value, 'access denied')
  fail = false; await state.query()
  assert.equal(state.queryState.value, 'loaded')
  state.resultKeyword.value = '李四'
  assert.deepEqual(state.results.value.map(item => item.id), ['u2'])
  state.sampleId.value = 'another'; await flush()
  assert.equal(state.queryState.value, 'idle')
  assert.deepEqual(state.data.value, [])
  app.unmount()
})
