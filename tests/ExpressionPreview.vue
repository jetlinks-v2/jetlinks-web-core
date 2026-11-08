<template>
  <main class="expression-preview">
    <header><h1>数学公式验收</h1><a-button @click="reset">恢复示例</a-button><a-button @click="disabled=!disabled">{{ disabled ? '开启编辑' : '只读' }}</a-button><a-button @click="narrow=!narrow">窄栏</a-button><a-button @click="dark=!dark">主题</a-button></header>
    <nav><a-button v-for="(_,name) in scenes" :key="name" @click="select(name)">{{ name }}</a-button></nav>
    <section :style="narrow ? {width:'360px',maxWidth:'100%'} : {}"><h2>编辑</h2><ExpressionWorkspace :node="node" :context="context" :editable="!disabled" stationary><TemplateMathEditor model-value="" :tree="{version:1,root:node}" :references="references" :functions="context.functions" :result-labels="context.resultLabels" :disabled="disabled" conditions hide-mode @change="node=$event.expressionTree!.root;changes++" @invalid="invalid=$event" /></ExpressionWorkspace><p role="status">{{ invalid ? '未完成输入，不能试算' : '可试算' }} · 已修改 {{ changes }} 次</p></section>
    <section><h2>反显</h2><ExpressionView :node="node" :context="context" /></section>
    <section><h2>记录的数据</h2><ExpressionWorkspace :node="scenes['条件与函数']" :context="context" :explanation="explanation" :format="format"><ExpressionView :node="scenes['条件与函数']" :context="context" :explanation="explanation" :format="format" /></ExpressionWorkspace></section>
    <details><summary>保存契约（测试数据）</summary><pre>{{ JSON.stringify(node,null,2) }}</pre></details>
  </main>
</template>
<script setup lang="ts">
import { computed,ref,shallowRef,watchEffect } from 'vue'
import TemplateMathEditor from '../src/components/Metric/template/TemplateMathEditor.vue'
import ExpressionView from '../src/components/Expression/ExpressionView.vue'
import ExpressionWorkspace from '../src/components/Expression/ExpressionWorkspace.vue'
import type { ExpressionNode,ExpressionExplanation } from '../src/components/Expression/types'
const literal=(value:unknown,valueType:'int'|'long'|'decimal'='int'):ExpressionNode=>({type:'literal',valueType,value})
const reading:ExpressionNode={type:'reference',id:'reading',path:[]}
const scenes:Record<string,ExpressionNode>={
  '条件与函数':{type:'conditional',condition:{type:'binary',operator:'gt',left:reading,right:literal('20')},whenTrue:{type:'call',function:'math.max',arguments:[{type:'binary',operator:'subtract',left:reading,right:literal('20')},literal('3')]},whenFalse:literal('0')},
  '精确长整数':literal('9007199254740993','long'),
  '精确小数':literal('12345678901234567890.123456789','decimal'),
  '三项逻辑':{type:'logical',operator:'or',operands:[{type:'literal',valueType:'boolean',value:false},{type:'literal',valueType:'boolean',value:false},{type:'literal',valueType:'boolean',value:true}]},
  '函数与权重':{type:'call',function:'math.max',arguments:[{type:'binary',operator:'multiply',left:reading,right:{type:'reference',id:'params',path:['weight']}},literal('0')]},
  '长名称与分支':{type:'conditional',condition:{type:'binary',operator:'eq',left:{type:'reference',id:'stats',path:[]},right:{type:'literal',valueType:'null',value:null}},whenTrue:{type:'literal',valueType:'null',value:null},whenFalse:{type:'binary',operator:'divide',left:{type:'reference',id:'stats',path:['onlineDuration']},right:{type:'binary',operator:'add',left:{type:'reference',id:'stats',path:['onlineDuration']},right:{type:'reference',id:'stats',path:['offlineDuration']}}}},
  '多分支状态':{type:'conditional',condition:{type:'binary',operator:'eq',left:reading,right:{type:'literal',valueType:'null',value:null}},whenTrue:literal('5'),whenFalse:{type:'conditional',condition:{type:'binary',operator:'eq',left:reading,right:literal('0')},whenTrue:literal('1'),whenFalse:{type:'conditional',condition:{type:'binary',operator:'gt',left:reading,right:literal('20')},whenTrue:literal('3'),whenFalse:literal('0')}}},
}
const scene=ref('条件与函数'),node=shallowRef(scenes['条件与函数']),disabled=ref(false),invalid=ref(false),changes=ref(0),narrow=ref(false),dark=ref(false)
watchEffect(()=>document.documentElement.dataset.previewTheme=dark.value ? 'dark' : 'light')
const context=computed(()=>({disabled:disabled.value,references:[{id:'reading',path:[],label:'测量值',schema:{type:'double'}},{id:'backup',path:[],label:'备用测量值',schema:{type:'double'}},{id:'params',path:['weight'],label:'CPU权重',schema:{type:'decimal'}},{id:'stats',path:[],label:'近1小时连接统计',schema:{type:'object'}},{id:'stats',path:['onlineDuration'],label:'近1小时连接统计 · 在线持续时间',schema:{type:'long'},unit:'ms'},{id:'stats',path:['offlineDuration'],label:'近1小时连接统计 · 离线持续时间',schema:{type:'long'},unit:'ms'}],
  functions:[...['max','min','floor'].map((id,index)=>({id:`math.${id}`,name:['最大值','最小值','向下取整'][index],description:['取参与数据中的最大值','取参与数据中的最小值','返回不大于输入值的整数'][index],returnType:'number',parameters:[{id:'value',name:'数据',valueType:'number'}],minimumArguments:1,maximumArguments:id==='floor' ? 1 : 16})),{id:'stats.avg',name:'数据均值',description:'数值或数值集合的算术平均值；空数据返回0',returnType:'number',parameters:[{id:'values',name:'数值或数值集合',valueType:'any'}],minimumArguments:1,maximumArguments:16}],
  resultLabels:scene.value==='多分支状态' ? [{value:5,label:'待判断'},{value:1,label:'离线'},{value:3,label:'通信静默'},{value:0,label:'连接正常'}] : undefined}))
const references=computed(()=>context.value.references.map(item=>({key:item.id === 'params' ? `parameter:${item.path[0]}` : item.id+item.path.join('.'),label:item.label,metricId:item.id === 'params' ? undefined : item.id,group:item.id === 'params' ? 'parameter' as const : 'data' as const,path:item.path,expression:item.id+item.path.map(key=>`['${key}']`).join(''),schema:item.schema})))
function select(name:string) {scene.value=name;node.value=scenes[name];changes.value=0}
function reset() {scene.value='条件与函数';node.value=structuredClone(scenes['条件与函数']);changes.value=0}
const read=():ExpressionExplanation=>({kind:'read',state:'available',value:25,path:['reading'],children:[]})
const fact=(value:number):ExpressionExplanation=>({kind:'literal',state:'available',value,path:[],children:[]})
const explanation:ExpressionExplanation={kind:'condition',state:'available',value:5,path:[],children:[
  {kind:'operator',operation:'>',state:'available',value:true,path:[],children:[read(),fact(20)]},
  {kind:'call',operation:'math.max',state:'available',value:5,path:[],children:[{kind:'operator',operation:'-',state:'available',value:5,path:[],children:[read(),fact(20)]},fact(3)]},
  {kind:'unsupported',state:'skipped',value:null,path:[],children:[]},
]}
const format=(record:ExpressionExplanation)=>({text:String(record.value)})
</script>
<style>
:root { --ink-1:#1f2937;--ink-2:#475569;--ink-3:#8b95a5;--line:#e5e7eb;--accent:#1677ff;--accent-soft:#e8f2ff;--bg:#fff;--bg-secondary:#f2f4f7 }
:root[data-preview-theme=dark] { --ink-1:#edf0f5;--ink-2:#c2cad7;--ink-3:#8e9ab0;--line:#354052;--accent:#6ea8ff;--accent-soft:#223750;--bg:#1e2735;--bg-secondary:#18212d }
body { margin:0;background:#f6f7f9;color:var(--ink-1);font-family:system-ui,sans-serif }
.expression-preview { max-width:760px;margin:32px auto;padding:0 20px }
.expression-preview header,.expression-preview nav { display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap }
.expression-preview h1 { font-size:20px;flex:1;margin:0 }
.expression-preview h2 { font-size:12px;color:var(--ink-3);font-weight:400;margin:0 0 8px }
.expression-preview>section { box-sizing:border-box;padding:16px;background:var(--bg);border:1px solid var(--line);border-radius:8px;margin-bottom:12px }
.expression-workspace-modal .ant-modal-content { background:var(--bg);color:var(--ink-1) }
.expression-workspace-modal .ant-modal-header { background:var(--bg) }
.expression-workspace-modal .ant-modal-title,.expression-workspace-modal .ant-modal-close { color:var(--ink-1) }
.expression-preview p { color:var(--ink-3);font-size:12px;margin:10px 7px 0 }
.expression-preview pre { font-size:11px;max-height:220px;overflow:auto }
</style>
