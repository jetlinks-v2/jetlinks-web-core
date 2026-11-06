<template>
  <div class="aggregate-trend">
    <MetricChartTools :controls="zoom.controls" :hint="t('aggregateHistoryHint')" />
    <Echarts :option="option" :library="library" :events="zoom.events" :style="{height:zoom.controls.overview.value ? '184px' : '160px'}" @ready="zoom.ready" @dispose="zoom.dispose" />
  </div>
</template>
<script setup lang="ts">
import { computed,toRef } from 'vue'
import { theme } from 'ant-design-vue'
import { LineChart,BarChart } from 'echarts/charts'
import { useI18n } from 'vue-i18n'
import Echarts from '../../Echarts'
import MetricChartTools from '../history/MetricChartTools.vue'
import { useTimeZoom } from '../../../hooks/Echarts/useTimeZoom'
import { stateAppearance,stateLabel } from '../stateIntervals'
import { aggregateValue } from './aggregatePresentation'
import { collectionMessages } from './messages'
import type { MetricAggregateGroup,ReadOperation } from './types'
const props=defineProps<{group:MetricAggregateGroup;operation:ReadOperation;bounds:[number,number];interval:number;view?:[number,number]}>()
const emit=defineEmits<{(event:'update:view',value:[number,number] | undefined):void}>()
const { t,locale }=useI18n({useScope:'local',messages:collectionMessages})
const {token}=theme.useToken()
const zoom=useTimeZoom(toRef(props,'bounds'),toRef(props,'view'),value=>emit('update:view',value),t,true)
const library=[LineChart,BarChart,...zoom.library]
const label=(key:string)=>stateLabel(props.group.stateLabels?.find(item=>String(item.value)===key)?.value ?? key,props.group.stateLabels || [],String(locale.value))
const color=(key:string)=>{
  const value=stateAppearance(props.group.stateLabels?.find(item=>String(item.value)===key)?.value ?? key,props.group.stateLabels).color
  return value.startsWith('var(--accent') ? token.value.colorPrimary : value.startsWith('var(--ink') ? token.value.colorTextTertiary : value.startsWith('var(--jet-theme-success') ? token.value.colorSuccess : value
}
const option=computed(()=>{
  const points=new Map(props.group.points.map(point=>[point.time,point]))
  const times=Array.from({length:Math.ceil((props.bounds[1]-props.bounds[0])/props.interval)},(_,index)=>props.bounds[0]+index*props.interval)
  const states=[...new Set(props.group.points.flatMap(point=>Object.keys(point.distribution)))]
  return {...zoom.option.value,animation:false,
    grid:{left:38,right:12,top:12,bottom:zoom.controls.overview.value ? 52 : 28},
    tooltip:{trigger:'axis',confine:true,renderMode:'richText'},
    xAxis:{type:'time',min:zoom.extent.value?.[0],max:zoom.extent.value?.[1],splitNumber:3,axisLabel:{hideOverlap:true,color:token.value.colorTextTertiary}},
    yAxis:{type:'value',min:props.operation==='distribution' ? 0 : undefined,minInterval:props.operation==='distribution' ? 1 : undefined,splitNumber:3,axisLabel:{color:token.value.colorTextTertiary},splitLine:{lineStyle:{color:token.value.colorSplit}}},
    series:props.operation==='distribution' ? [...states.map(key=>({id:'state:'+key,name:label(key),type:'bar',stack:'states',barMaxWidth:12,itemStyle:{color:color(key)},data:times.map(time=>[time,points.has(time) ? points.get(time)!.distribution[key] || 0 : null])})),
      {id:'unknown',name:t('unknown'),type:'bar',stack:'states',barMaxWidth:12,itemStyle:{color:token.value.colorTextQuaternary},data:times.map(time=>[time,points.has(time) ? points.get(time)!.observed-points.get(time)!.valid : null])}]
      : [{id:'aggregate',name:t(props.operation),type:'line',showSymbol:false,connectNulls:false,lineStyle:{width:2,color:token.value.colorPrimary},itemStyle:{color:token.value.colorPrimary},data:times.map(time=>[time,points.has(time) ? aggregateValue(points.get(time)!,props.operation) ?? null : null])}],
  }
})
</script>
