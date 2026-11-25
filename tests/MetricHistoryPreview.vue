<template>
  <main class="history-preview">
    <header><h1>指标历史组件验收 · 固定测试数据</h1><button @click="locale=locale==='zh'?'en':'zh'">中文 / English</button></header>
    <nav><button v-for="item in ['interval','boolean','number'] as const" :key="item" :aria-pressed="mode===item" @click="mode=item">{{ item }}</button><button @click="refresh++">重渲染记录</button><button @click="advance(3600000)">推进查询范围 1 小时</button><button :aria-pressed="live" @click="live=!live">模拟实时刷新</button><button v-if="mode==='boolean'" @click="allFalse=!allFalse">全未成立 / 混合</button></nav>
    <section class="history-preview__comparison"><h2>卡片</h2><MetricStateHistory v-if="mode==='interval'" :values="intervals" :bounds="bounds" :labels="labels" compact /><MetricTrend v-else :key="mode" :values="values" :bounds="bounds" :labels="booleanLabels" compact /></section>
    <section><h2>详情</h2><MetricStateHistory v-if="mode==='interval'" :values="intervals" :bounds="bounds" :labels="labels" /><MetricTrend v-else :key="mode" :values="values" :bounds="bounds" :labels="booleanLabels" /></section>
    <section v-if="mode==='interval'"><h2>平台外观编辑（仅当前夹具）</h2><IconValueEditor :model-value="labels[0]!.icon" :preview-size="28" @update:model-value="labels[0]!.icon=$event" /></section>
  </main>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricTrend from '../src/components/Metric/MetricTrend.vue'
import MetricStateHistory from '../src/components/Metric/MetricStateHistory.vue'
import IconValueEditor from '../src/components/IconValue/IconValueEditor.vue'
import type { MetricStateLabel, MetricValue } from '../src/components/Metric/types'
const { locale }=useI18n({useScope:'global'})
const mode=ref<'interval'|'boolean'|'number'>('interval'),refresh=ref(0),allFalse=ref(false)
const from=Date.UTC(2026,10,4,8),hour=3600000,shift=ref(0),live=ref(false)
const bounds=computed<[number,number]>(()=>[from+shift.value,from+24*hour+shift.value])
function advance(millis:number) { shift.value+=millis;refresh.value++ }
let timer:ReturnType<typeof setInterval> | undefined
const stop=()=>{if(timer)clearInterval(timer);timer=undefined}
watch(live,value=>{stop();if(value)timer=setInterval(()=>advance(1000),1000)})
onScopeDispose(stop)
const labels=ref<MetricStateLabel[]>([
  {value:1,name:'在线',nameI18n:{en:'Online'},icon:'color:#1677ff'},
  {value:0,name:'离线',nameI18n:{en:'Offline'},icon:'font:DisconnectOutlined'},
  {value:'maintenance',name:'维护',nameI18n:{en:'Maintenance'},icon:'img:data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24"%3E%3Cpath fill="%238b79c6" d="M3 3h18v18H3z"/%3E%3C/svg%3E'},
])
const booleanLabels:MetricStateLabel[]=[{value:true,name:'成立',nameI18n:{en:'True'},icon:'color:#cf6b32'},{value:false,name:'未成立',nameI18n:{en:'False'},icon:'color:#1677ff'}]
const intervals=computed<MetricValue[]>(()=>{ void refresh.value;return [
  {id:'online',startTime:from+hour,endTime:from+12*hour,value:1},
  {id:'offline',startTime:from+12*hour,endTime:from+12*hour+24000,value:0},
  {id:'online2',startTime:from+12*hour+24000,endTime:from+18*hour,value:1},
  {id:'maintenance',startTime:from+19*hour,endTime:from+20*hour,value:'maintenance'},
].map(item=>({metricId:'state',evaluationTime:item.endTime,value:item.value,state:{closedInterval:{...item,validUntil:item.endTime,startKnown:true,endKnown:true,observedUntil:item.endTime}}}))})
const values=computed<MetricValue[]>(()=>{ void refresh.value;return Array.from({length:24},(_,index)=>({metricId:'result',resultId:`record-${index}`,evaluationTime:from+index*hour,value:mode.value==='boolean' ? allFalse.value ? false : index%3===0 : index===8 ? null : 30+Math.sin(index/3)*20,quality:{valid:true}}))})
</script>
<style>
body { margin:0; background:var(--bg-2); color:var(--ink-1); font-family:system-ui,sans-serif }
.history-preview { max-width:880px; margin:24px auto; padding:0 20px 32px }
.history-preview header,.history-preview nav { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px }
.history-preview h1 { font-size:17px; margin:0; flex:1 }
.history-preview h2 { font-size:13px; margin:0 0 8px; color:var(--ink-3) }
.history-preview>section { padding:16px 20px; border:1px solid var(--line); border-radius:8px; background:var(--bg); margin-bottom:16px }
.history-preview button { cursor:pointer }
.history-preview__comparison { max-width:380px }
</style>
