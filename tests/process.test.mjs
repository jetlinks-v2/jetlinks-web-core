import assert from 'node:assert/strict'
import test from 'node:test'
import { ref, effectScope } from 'vue'
import { createMetricLoader, flush, sourceRoot } from './helpers/metricRuntime.mjs'
import { resolve } from 'node:path'
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto
const load = createMetricLoader()
const {newProcess,newProcessStep,insertProcessStep,removeProcessStep,processLanes,findProcessStep,processReferences} = load('components/Process/model.ts')

test('过程图自由嵌套分支并行循环退出，删除作用域同步清理子节点名称且不修改原值',()=>{
  const initial = newProcess()
  let value = insertProcessStep(initial,initial.root.id,'body',0,'parallel')
  const parallel = value.root.body[0]
  value = insertProcessStep(value,parallel.id,'0',0,'repeat')
  value = insertProcessStep(value,parallel.id,'1',0,'branch')
  const repeat = findProcessStep(value.root,value.root.body[0].branches[0][0].id)
  value = insertProcessStep(value,repeat.id,'body',0,'wait')
  const wait = findProcessStep(value.root,repeat.id).body[0]
  value.stepNames[wait.id] = '等待到位'
  value = insertProcessStep(value,value.root.id,'onStop',0,'action')
  assert.equal(initial.root.body.length,0)
  assert.equal(processLanes(findProcessStep(value.root,wait.id)).length,2)
  assert.equal(value.root.onStop.length,1)
  const next = removeProcessStep(value,parallel.id)
  assert.equal(next.root.body.length,0)
  assert.deepEqual(next.stepNames,{})
  assert.equal(value.root.body.length,1)
  assert.equal(newProcessStep('wait').onTimeout[0].outcome,'failed')
})

test('声明和表达式只引用逻辑输入与参数，不保存设备来源',()=>{
  const value = newProcess()
  value.inputs.pressure = {name:'风压到位',type:'boolean'}
  value.parameters.threshold = 20
  assert.deepEqual(processReferences(value).map(item=>({id:item.id,path:item.path,label:item.label})),[{id:'pressure',path:[],label:'风压到位'},{id:'threshold',path:[],label:'threshold'}])
  assert.equal(JSON.stringify(value).includes('thingId'),false)
})

test('模拟到期和动作回执不会伪造新的设备上报，提交失败保留之前事件',async()=>{
  const {useProcessSimulation} = load('components/Process/useProcessSimulation.ts')
  const template = ref(newProcess()); template.value.inputs.pressure = {name:'风压',type:'boolean'}
  const calls = [], api = {simulate:async(_,events)=>{calls.push(events);return {state:{nextDueAt:60000,status:'active',pendingOperations:{}},trace:[]}}}
  const scope = effectScope(), state = scope.run(()=>useProcessSimulation(template,api))
  state.values.value.pressure = true
  await state.advance()
  assert.equal(calls[0][0].observations.pressure.value,true)
  await state.advance(undefined,true)
  assert.deepEqual(calls[1][1].observations,{})
  await state.advance({id:'operation',state:'unknown'})
  assert.deepEqual(calls[2][2].observations,{})
  assert.equal(calls[2][2].operations.operation.state,'unknown')
  api.simulate = async()=>{throw new Error('offline')}
  await state.advance()
  assert.equal(state.events.value.length,3)
  assert.equal(state.error.value,'offline')
  scope.stop()
})

test('同一发起网络失败后沿用请求身份；对象切换隔离迟到列表',async()=>{
  const {useProcessManagement} = load('components/Process/useProcessManagement.ts')
  const owner = ref({type:'device',id:'one'}), ids = []; let reject = true
  const api = {configurations:async()=>({data:[],total:0}),assignments:async()=>[],runs:async()=>[],start:async(_,__,id)=>{ids.push(id);if(reject)throw new Error('response lost');return {runId:'original'}}}
  const scope = effectScope(), state = scope.run(()=>useProcessManagement(owner,api))
  await flush()
  await state.execute('start','air')
  reject = false; await state.execute('start','air')
  assert.equal(ids[0],ids[1]); assert.equal(state.runId.value,'original')
  let finish
  api.configurations = ()=>new Promise(resolve=>{finish=resolve})
  const pending = state.load(); await flush()
  owner.value = undefined; await flush()
  finish({data:[{id:'secret-from-old-object'}],total:1}); await pending
  assert.deepEqual(state.configurations.value,[])
  scope.stop()
})

test('状态来源同时发现属性事件和分页指标，选择时固定指标数据版本',async()=>{
  const object = ref({type:'device',id:'one'}), calls = []
  const request = {get:async(url,params)=>{calls.push({url,params});return {status:200,result:{dataVersion:'version-1'}}}}
  const api = {models:async()=>[
    {providerId:'readings',name:'设备读数',metadata:{properties:[{id:'temperature',name:'温度',valueType:{type:'double'}}],events:[{id:'finished',name:'作业完成',valueType:{type:'object'}}]}},
    {providerId:'metrics',name:'指标',metadata:{}}
  ],command:async(_,__,___,{cursor})=>[{items:[{configId:cursor ? 'second' : 'first',name:'舒适度',state:'enabled',outputs:['score'],template:{outputs:[{metricId:'score',label:'评分',valueType:'double'}]}}],nextCursor:cursor ? undefined : 'd:next'}]}
  const local = createMetricLoader({
    [resolve(sourceRoot,'data-capability/request.ts')]:{useDataCapabilityRequest:()=>request,getDataCapabilityRequest:()=>request},
    [resolve(sourceRoot,'object-capability/api.ts')]:{objectCapabilitiesApi:()=>api}
  })
  const scope = effectScope(), state = scope.run(()=>local('components/Process/useProcessMembers.ts').useProcessMembers(object))
  await flush()
  assert.deepEqual(state.members.value.map(item=>item.ref.kind),['property','event','metric'])
  assert.equal(state.nextCursor.value,'d:next')
  await state.more(); assert.equal(state.members.value.filter(item=>item.ref.kind === 'metric').length,2)
  assert.equal(state.nextCursor.value,undefined)
  const selected = await state.resolve(state.members.value.find(item=>item.ref.kind === 'metric'))
  assert.equal(selected.source.configuration.configId,'first'); assert.equal(selected.source.configuration.dataVersion,'version-1')
  assert.deepEqual(calls[0].params,{targetType:'device',targetId:'one'})
  scope.stop()
})
