<template>
  <main class="execution-preview">
    <header><h1>本次计算数据 · 固定测试数据</h1><a-button @click="locale=locale==='zh'?'en':'zh'">中文 / English</a-button></header>
    <nav><a-button @click="switchScene">{{ multiple ? '数值公式' : '同源不同读取' }}</a-button><a-button @click="anonymous=!anonymous">{{ anonymous ? '切换稳定结果' : '切换匿名结果' }}</a-button><a-button @click="current={...current,resultId:'new'}">模拟新结果</a-button><a-button @click="observation.snapshot={...observation.snapshot,truncated:!observation.snapshot.truncated}">切换记录不完整</a-button></nav>
    <section><MetricExecutionProcess :template="template" :output="template.outputs[0]" :value="shownCurrent" :observation="shownObservation" /></section>
  </main>
</template>
<script setup lang="ts">
import { computed,reactive,ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricExecutionProcess from '../src/components/Metric/MetricExecutionProcess.vue'
import { metricSourceTemplate } from '../src/components/Metric/valueSemantics'
import type { MetricExecutionSnapshot,MetricTemplate,MetricValue } from '../src/components/Metric/types'
const {locale}=useI18n({useScope:'global'})
const numericTemplate:MetricTemplate={id:'preview',name:'资源压力',version:'1',parameterDefinitions:[],parameters:{},
  inputDefinitions:[{id:'cpu',name:'CPU使用率'},{id:'memory',name:'内存使用率'},{id:'temperature',name:'温度'}],
  definitions:[{id:'load',name:'资源压力',inputs:[{id:'cpu',metricId:'cpu'},{id:'memory',metricId:'memory'}],expression:'cpu * 0.5 + memory * 0.5'},
    {id:'high',name:'压力持续偏高',inputs:[{id:'load',metricId:'load'}],expression:'load == null ? false : load > 80 ? true : false'},
    {id:'unused',name:'温度异常',sourceMetric:'temperature',expression:'value > 60'}],
  outputs:[{metricId:'high',label:'压力持续偏高',valueType:'boolean'}]}
const time=Date.UTC(2026,10,6,14)
const load:MetricValue={metricId:'load',resultId:'load-result',value:62.5,evaluationTime:time,evidence:{
  inputs:['cpu','memory'].map(inputId=>({inputId,metricId:inputId,count:1,inputTimeStart:time-1000,inputTimeEnd:time-1000})),
  execution:{truncated:false,values:[{kind:'input',id:'cpu',path:'/value',type:'number',value:'50',state:'available'},
    {kind:'input',id:'memory',path:'/value',type:'number',value:'75',state:'available'}]}}}
const high:MetricValue={metricId:'high',resultId:'result',value:false,evaluationTime:time,evidence:{
  inputs:[{inputId:'load',metricId:'load',count:1,inputTimeStart:time,inputTimeEnd:time}],
  execution:{truncated:false,values:[{kind:'input',id:'load',path:'/value',type:'number',value:'62.5',state:'available'}]}}}
const snapshot:MetricExecutionSnapshot={resultId:'result',evaluationTime:time,truncated:false,steps:[
  {id:0,definitionId:'load',name:'资源压力',state:'produced',value:load,outputs:[load]},
  {id:1,definitionId:'high',name:'压力持续偏高',state:'produced',value:high,outputs:[high]}]}
const current=ref(high)
const observation=reactive({loading:false,snapshot,refresh(){observation.snapshot={...snapshot,resultId:current.value.resultId!}}})
const anonymous=ref(false)
const shownCurrent=computed(()=>anonymous.value ? {...current.value,resultId:undefined,executionId:`round-${current.value.resultId}`} : current.value)
const shownObservation=computed(()=>{
  if (!anonymous.value) return observation
  const executionId=`round-${observation.snapshot.resultId}`
  const project=(value:MetricValue):MetricValue=>({...value,resultId:undefined,executionId})
  return {...observation,snapshot:{...observation.snapshot,resultId:undefined,executionId,
    steps:observation.snapshot.steps.map(step=>({...step,value:project(step.value),outputs:step.outputs.map(project)}))}}
})
const multiple=ref(false)
const connectionTemplate:MetricTemplate={id:'readings',name:'连接状态',version:'1',parameterDefinitions:[],parameters:{},
  inputDefinitions:[{id:'online',name:'平台连接状态',valueType:{type:'enum',elements:[{value:0,text:'离线'},{value:1,text:'在线'}]}},{id:'sampledAt',name:'采样时刻',valueType:{type:'long'}},{id:'latency',name:'确认延迟',unit:'ms'}],
  definitions:[{id:'current',name:'当前连接状态',inputs:[{id:'state',metricId:'online'}],expression:'state'},
    {id:'history',name:'历史连接状态',inputs:[{id:'state',metricId:'online'}],expression:'state'},
    {id:'sampledAt',name:'采样时刻',inputs:[{id:'stamp',metricId:'sampledAt'}],expression:'stamp'},
    {id:'delay',name:'确认延迟',inputs:[{id:'delay',metricId:'latency'}],expression:'delay'}],outputs:[{metricId:'current',label:'当前连接状态'}]}
const connectionSnapshot:MetricExecutionSnapshot={resultId:'connection',evaluationTime:time,truncated:false,steps:[
  ['current','state','online',0,time],['history','state','online',1,time-86400000],['sampledAt','stamp','sampledAt',time,time],['delay','delay','latency',500,time],
].map(([id,alias,metricId,reading,at],index)=>{
  const value:MetricValue={metricId:String(id),resultId:index === 0 ? 'connection' : `connection-${index}`,value:reading,evaluationTime:time,evidence:{
    inputs:[{inputId:String(alias),metricId:String(metricId),count:1,cutoff:time,inputTimeStart:Number(at),inputTimeEnd:Number(at)}],
    execution:{truncated:false,values:[{kind:'input',id:String(alias),path:'/value',type:'number',value:String(reading),state:'available'}]}}}
  return {id:index,definitionId:String(id),name:String(connectionTemplate.definitions[index].name),state:'produced',value,outputs:[value]}
})}
const template=computed(()=>multiple.value ? metricSourceTemplate(connectionTemplate,{sampledAt:{valueType:{type:'date'}}}) : numericTemplate)
function switchScene() { multiple.value=!multiple.value; observation.snapshot=multiple.value ? connectionSnapshot : snapshot; current.value=multiple.value ? connectionSnapshot.steps[0].value : high }
</script>
<style>
body { margin:0;background:var(--bg-2);color:var(--ink-1);font-family:system-ui,sans-serif }
.execution-preview { max-width:920px;margin:24px auto;padding:0 20px 32px }
.execution-preview > header,.execution-preview > nav { display:flex;gap:12px;align-items:center;margin-bottom:16px }
.execution-preview h1 { font-size:17px;margin:0;flex:1 }
.execution-preview > section { padding:20px;background:var(--bg);border:1px solid var(--line);border-radius:8px }
</style>
