import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, ref } from 'vue'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
import { createComponentLoader as createMetricLoader, flush, sourceRoot } from './helpers/componentRuntime.mjs'
if (!globalThis.crypto) globalThis.crypto = webcrypto
const { useProcessTemplates } = createMetricLoader()('components/Process/useProcessTemplates.ts')

test('未预选对象时仍加载对象类型和目录，选择对象后回传真实类型',async()=>{
  const calls = [], selections = []
  const api = {types:async()=>[{id:'device',name:'设备'}],objects:async(type)=>{calls.push(type);return [{id:'D1',name:'一号送风机'}]}}
  const load = createMetricLoader({
    [resolve(sourceRoot,'api/relations.ts')]:{relationApi:api},
    [resolve(sourceRoot,'data-capability/request.ts')]:{useDataCapabilityRequest:()=>({})},
    [resolve(sourceRoot,'object-capability/api.ts')]:{objectCapabilitiesApi:()=>({objects:async()=>[]})},
  })
  const scope = effectScope()
  const state = scope.run(()=>load('components/Process/useProcessObjects.ts').useProcessObjects(ref(),object=>selections.push(object)))
  await flush()
  assert.equal(state.type.value,'device')
  assert.ok(calls.length > 0)
  assert.deepEqual(state.objects.value,[{type:'device',id:'D1',name:'一号送风机'}])
  state.choose(state.objects.value[0])
  assert.deepEqual(selections.at(-1),{type:'device',id:'D1',name:'一号送风机'})
  scope.stop()
})

test('目录初始不打开编辑器；关闭草稿不重置目录，重新打开恢复已保存内容', async () => {
  const scope = effectScope()
  const state = scope.run(() => useProcessTemplates({ templates:async()=>({data:[],total:0}) }))
  await flush()
  assert.equal(state.draft.value,undefined)
  state.create()
  assert.equal(state.dirty.value,false)
  state.draft.value = {...state.draft.value,name:'送风机启动'}
  assert.equal(state.dirty.value,true)
  const template = state.draft.value
  const row = {id:'entity',templateId:template.id,version:template.version,name:template.name,revision:1,published:false,draftJson:JSON.stringify(template)}
  state.rows.value = [row]; state.total.value = 21; state.page.value = 1
  state.simulationOpen.value = true
  state.close()
  assert.equal(state.draft.value,undefined)
  assert.equal(state.simulationOpen.value,false)
  assert.equal(state.dirty.value,false)
  assert.equal(state.page.value,1)
  assert.deepEqual(state.rows.value,[row])
  state.open(row)
  state.draft.value = {...state.draft.value,name:'未保存名称'}
  state.close(); state.open(row)
  assert.equal(state.draft.value.name,'送风机启动')
  assert.equal(state.dirty.value,false)
  scope.stop()
})

test('保存期间阻止关闭；保存失败保留编辑和错误，重试成功后保持编辑器打开', async () => {
  let fail
  const scope = effectScope()
  const api = {templates:async()=>({data:[],total:0}),saveTemplate:()=>new Promise((_,reject)=>{fail=reject})}
  const state = scope.run(() => useProcessTemplates(api))
  await flush(); state.create()
  state.draft.value = {...state.draft.value,name:'双阀启动'}
  const pending = state.action('save')
  state.close()
  assert.equal(state.busy.value,true)
  assert.equal(state.draft.value.name,'双阀启动')
  fail(new Error('网络中断')); assert.equal(await pending,false)
  assert.equal(state.error.value,'网络中断')
  assert.equal(state.dirty.value,true)
  api.saveTemplate = async template => ({id:'entity',templateId:template.id,version:template.version,name:template.name,revision:1,published:false,draftJson:JSON.stringify(template)})
  assert.equal(await state.action('save'),true)
  assert.equal(state.draft.value.name,'双阀启动')
  assert.equal(state.selected.value.id,'entity')
  assert.equal(state.error.value,'')
  assert.equal(state.dirty.value,false)
  scope.stop()
})
