import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive,h } from 'vue'
import { createMetricLoader,createMetricRenderer,flush } from './helpers/metricRuntime.mjs'
const {useExpressionTrial}=createMetricLoader()('components/Expression/useExpressionTrial.ts')
test('试算仅传结构树与模拟数据；编辑期间的迟到结果失效',async()=>{
  let trial,resolve,received
  const props=reactive({modelValue:{version:1,root:{type:'reference',id:'value',path:[]}},context:{references:[{id:'value',path:[],label:'Value',schema:{type:'long'}}],functions:[]},numeric:true,
    evaluate:request=>{received=request;return new Promise(done=>resolve=done)}})
  const {renderer,root}=createMetricRenderer(),app=renderer.createApp({setup(){trial=useExpressionTrial(props);return()=>h('div')}})
  app.mount(root)
  try {
    trial.values.value='9007199254740993'
    const first=trial.run()
    assert.equal(received.variables.value,'9007199254740993')
    assert.equal(received.variableTypes.value,'long')
    assert.deepEqual(received.expression,JSON.parse(JSON.stringify(props.modelValue)))
    assert.equal(trial.loading.value,true)
    trial.values.value='2'
    resolve({value:'old',explanation:{}});await first
    assert.equal(trial.result.value,undefined)
    const second=trial.run();resolve({value:'2',explanation:{}});await second
    assert.equal(trial.result.value.value,'2')
    props.disabled=true;assert.equal(trial.result.value,undefined)
  } finally {app.unmount()}
})
test('对象字段共用一次根对象模拟输入，不静默丢弃字段引用',async()=>{
  let trial,received
  const props=reactive({modelValue:{version:1,root:{type:'reference',id:'input',path:['temperature']}},context:{references:[{id:'input',path:['temperature'],label:'Temperature',schema:{type:'double'}}],functions:[]},
    evaluate:async request=>{received=request;return {value:'3',explanation:{}}}})
  const {renderer,root}=createMetricRenderer(),app=renderer.createApp({setup(){trial=useExpressionTrial(props);return()=>h('div')}})
  app.mount(root)
  try {trial.values.input='{"temperature":3}';await trial.run();assert.deepEqual(received.variables.input,{temperature:3})}
  finally {app.unmount()}
})

test('自动试算合并连续输入，公式变更失效，卸载后不再发送',async()=>{
  let trial,requests=[]
  const props=reactive({automatic:true,modelValue:{version:1,root:{type:'reference',id:'value',path:[]}},context:{references:[{id:'value',path:[],label:'Value',schema:{type:'double'}}],functions:[]},
    evaluate:async request=>{requests.push(request);return {value:request.variables.value,explanation:{}}}})
  const {renderer,root}=createMetricRenderer(),app=renderer.createApp({setup(){trial=useExpressionTrial(props);return()=>h('div')}})
  app.mount(root)
  try {
    await new Promise(done=>setTimeout(done,380));assert.equal(requests.length,0)
    trial.values.value='1';await flush();trial.values.value='12';await flush();trial.values.value='12.5';await flush()
    await new Promise(done=>setTimeout(done,380))
    assert.equal(requests.length,1);assert.equal(trial.result.value.value,'12.5')
    props.modelValue={version:1,root:{type:'literal',valueType:'decimal',value:'2'}}
    assert.equal(trial.result.value,undefined);await flush()
  } finally {app.unmount()}
  await new Promise(done=>setTimeout(done,380));assert.equal(requests.length,1)
})
