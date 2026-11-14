import assert from 'node:assert/strict'
import test from 'node:test'
import { createMetricLoader, sourceRoot } from './helpers/metricRuntime.mjs'
import { resolve } from 'node:path'

const load=createMetricLoader({'@jetlinks-web/core':{request:{}},[resolve(sourceRoot,'utils/ndjson.ts')]:{createRuntimeNdJson:()=>({})}})
const {algorithmGuideModel}=load('components/Metric/template/algorithmGuide.ts')
const {algorithmParameterValue}=load('components/Metric/template/algorithm.ts')
const {algorithmGuideMessages}=load('components/Metric/template/algorithmGuideMessages.ts')
const {metricMessages}=load('components/Metric/messages.ts')
const {durationUnitText}=load('components/Metric/template/durationPresentation.ts')
const translate=locale=>(key,values={})=>{
  const message={...metricMessages[locale],...algorithmGuideMessages[locale]}[key]
  assert.equal(typeof message,'string',`missing ${locale} ${key}`)
  return message.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]))
}
const spec=(provider,operation,parameters={})=>({provider,providerVersion:'1',parameters:{operation,...parameters}})
const state=()=>({...spec('state','duration',{duration:'PT1H',maxHold:'PT2M',activeValue:1,inactiveValue:0}),inputTypes:{state:{type:'array',elementType:{type:'int'}}}})
const model=(value,descriptor,labels=[],locale='zh')=>algorithmGuideModel(value,descriptor,labels,locale,translate(locale))
function freeze(value) {if(value && typeof value === 'object'){Object.freeze(value);Object.values(value).forEach(freeze)}return value}

test('11种已知算法提供双语教学图例，保持原配置且不输出计算结果',()=>{
  const examples=[state(),spec('measurement','increase',{negativeDelta:'reject',multiplier:1}),spec('measurement','integral',{integration:'left',timeUnit:'PT1H',multiplier:1}),
    ...['rms','mad','rate','difference','ewma','align','hampel','spectrum'].map(operation=>spec('signal',operation,{alpha:.2,step:'PT5S',duration:'PT1M',windowSize:3,sigma:3,tolerance:0,replace:false}))]
  for(const locale of ['zh','en'])for(const example of examples) {
    const original=JSON.stringify(example), result=model(freeze(example),undefined,[],locale)
    assert.ok(result.note);assert.ok(result.facts.length || ['rms','mad','rate','difference'].includes(result.kind))
    assert.ok(result.state || result.samples.length); assert.equal(result.warning,undefined)
    assert.equal('result' in result,false);assert.equal(JSON.stringify(example),original)
    for(const point of result.samples)assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y))
  }
  for(const unknown of [{...state(),provider:'external'},{...state(),providerVersion:'2'},spec('signal','future')])assert.equal(model(unknown),undefined)
  assert.deepEqual(Object.keys(algorithmGuideMessages.zh).sort(),Object.keys(algorithmGuideMessages.en).sort())
})

test('共用时长单位按实际数量选择单复数，中文保持原单位名称',()=>{
  for(const [key,one,many] of [['seconds','second','seconds'],['minutes','minute','minutes'],['hours','hour','hours'],['days','day','days']]) {
    assert.equal(durationUnitText(key,1,translate('en')),one)
    assert.equal(durationUnitText(key,2,translate('en')),many)
    assert.equal(durationUnitText(key,1,translate('zh')),durationUnitText(key,2,translate('zh')))
  }
})

test('状态图随范围和有效期联动，并保留枚举编码、名称国际化与图标色',()=>{
  const value=state(),labels=[{value:'1',name:'错误字符串'},{value:1,name:'在线',nameI18n:{en:'Online'},icon:'color:#22c55e'},{value:0,name:'离线',nameI18n:{en:'Offline'},icon:'font:PoweroffOutlined'}]
  const result=model(value,undefined,labels,'en')
  assert.equal(result.state.span,'8m');assert.equal(result.state.labels[0].name,'Online (1)')
  assert.equal(result.state.labels[0].color,'#22c55e');assert.equal(result.state.labels[1].icon,'font:PoweroffOutlined');assert.equal(result.state.labels[1].color,undefined)
  assert.ok(result.state.segments.some(segment=>segment.kind === 'unknown'))
  const shorter=model({...value,parameters:{...value.parameters,duration:'PT30S'}})
  assert.equal(shorter.state.span,'30秒');assert.equal(shorter.state.segments.some(segment=>segment.kind === 'unknown'),false)
  const longerHold=model({...value,parameters:{...value.parameters,maxHold:'PT10M'}})
  assert.equal(longerHold.state.span,'40分')
  const range=model({...value,inputTypes:{...value.inputTypes,from:{type:'date'},to:{type:'date'}}})
  assert.equal(range.facts.filter(fact=>fact.name === '统计范围').length,1)
  assert.equal(range.facts[0].value,'由起止时间输入决定')
  const bool=model({...value,parameters:{...value.parameters,activeValue:true,inactiveValue:false}},undefined,[{value:true,name:'运行'},{value:false,name:'停止'}])
  assert.equal(bool.state.labels[0].name,'运行 (true)')
})

test('缺失或极端状态参数不生成无效坐标，类型派生值不套用描述默认值',()=>{
  const definition={id:'activeValue',expands:{typeFromInput:'state',defaultValue:1}}
  const descriptor={configuration:state(),parameterDefinitions:[definition]}
  const missing=state();delete missing.parameters.activeValue
  assert.equal(algorithmParameterValue(definition,missing,descriptor),undefined)
  assert.ok(model(missing,descriptor).warning)
  for(const patch of [{maxHold:'invalid'},{maxHold:'PT0S'},{duration:'PT0S'},{activeValue:0},{maxHold:'PT99999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999S'}]) {
    const result=model({...state(),parameters:{...state().parameters,...patch}})
    assert.ok(result.warning);assert.equal(result.state,undefined)
  }
  const inherited={id:'maxHold',expands:{defaultValue:'PT5M'}}
  assert.equal(algorithmParameterValue(inherited,{parameters:{}},{configuration:{parameters:{}},parameterDefinitions:[]}), 'PT5M')
  assert.equal(algorithmParameterValue(inherited,{parameters:{maxHold:'PT1M'}},descriptor),'PT1M')
})

test('增量策略、积分方式、平滑系数和高级参数均以当前配置生成说明',()=>{
  const notes=new Set()
  for(const negativeDelta of ['reject','resetToZero','rollover','signed']) {
    const result=model(spec('measurement','increase',{negativeDelta,modulus:200,multiplier:2}))
    notes.add(result.note)
    assert.equal(result.facts.some(fact=>fact.name === '满量程'),negativeDelta === 'rollover')
    if(negativeDelta === 'rollover')assert.deepEqual(result.samples.map(point=>point.label),['120','170','20','60'])
  }
  assert.equal(notes.size,4)
  assert.equal(model(spec('measurement','integral',{integration:'left'})).leftIntegral,true)
  assert.equal(model(spec('measurement','integral',{integration:'trapezoid'})).leftIntegral,false)
  const ewma=model(spec('signal','ewma',{alpha:.7}))
  assert.ok(ewma.steps.every(step=>!step.includes('undefined')));assert.ok(ewma.steps[0].includes('0.7'))
  assert.ok(model(spec('signal','ewma',{alpha:0})).warning)
  const align=model(spec('signal','align',{step:'PT5S'}))
  assert.deepEqual(align.grid.map(tick=>tick.label),['0 seconds','5 seconds','10 seconds','15 seconds'].map(label=>label.replace('seconds','秒')))
  assert.ok(model(spec('signal','hampel',{windowSize:8,replace:true})).steps[2].includes('替换'))
  assert.equal(model(spec('signal','hampel',{windowSize:8})).samples.length,9)
  assert.ok(model(spec('signal','hampel',{windowSize:100000})).samples.length<=13)
})
