<template>
  <EntityCard :title="group.output.label || group.output.metricId" :subtitle="group.templateName" :interactive="false" class="aggregate-card">
    <template #title><MetricOutputSwitch :outputs="groups.map(item=>item.output)" :output="group.output" :output-id="group.output.metricId" @change="selectOutput" /></template>
    <template #icon><AIcon :type="metricOutputPresentation(group.output,{labels:group.stateLabels}).icon" /></template>
    <template #action><a-dropdown :trigger="['click']"><a-button type="text" size="small">{{ t(operation) }}<AIcon type="DownOutlined" /></a-button><template #overlay><a-menu :selected-keys="[operation]" @click="operation=$event.key as ReadOperation"><a-menu-item v-for="item in group.operations" :key="item">{{ t(item) }}</a-menu-item></a-menu></template></a-dropdown></template>
    <template #body>
      <div v-if="operation==='distribution'" class="aggregate-card__states">
        <span v-for="(count,key) in group.latest.distribution" :key="key"><IconValueView v-if="appearance(String(key)).icon" :value="appearance(String(key)).icon" :size="14" indicator /><i v-else :style="{background:appearance(String(key)).color}" />{{ label(String(key)) }}<strong>{{ count }}</strong></span>
        <span v-if="group.latest.observed>group.latest.valid"><AIcon type="QuestionCircleOutlined" />{{ t('unknown') }}<strong>{{ group.latest.observed-group.latest.valid }}</strong></span>
      </div>
      <div v-else class="aggregate-card__value">{{ duration ?? formatMetricValue(value,undefined,group.output) }}<small v-if="duration===undefined">{{ group.output.unit }}</small></div>
      <p class="aggregate-card__coverage">{{ t('valid',{valid:group.latest.valid,total:group.latest.observed}) }}<span v-if="group.latest.observed>group.latest.valid"> · {{ t('missing',{count:group.latest.observed-group.latest.valid}) }}</span></p>
      <div v-if="highlights.length" class="aggregate-card__highlights"><span v-for="item in highlights" :key="item.id">{{ item.output.label || item.output.metricId }}<strong>{{ formatMetricValue(aggregateValue(item.latest,item.defaultOperation),undefined,item.output) }}</strong><small>{{ item.output.unit }}</small></span></div>
      <MetricAggregateTrend v-if="visible" :key="group.id" v-model:view="views[group.id]" :group="group" :operation="operation" :bounds="bounds" :interval="interval" />
      <div v-else class="aggregate-card__placeholder" />
    </template>
    <template #footer><span>{{ t('aggregateStored') }}</span><a-button type="link" size="small" @click="$emit('members')">{{ t('viewMembers') }}<AIcon type="RightOutlined" /></a-button></template>
  </EntityCard>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useI18n} from 'vue-i18n'
import EntityCard from '../../EntityCard/index.vue'
import IconValueView from '../../IconValue/IconValueView.vue'
import MetricAggregateTrend from './MetricAggregateTrend.vue'
import MetricOutputSwitch from '../MetricOutputSwitch.vue'
import {formatMetricValue} from '../extensions/presentationSettings'
import {metricDurationText} from '../presentation'
import {metricMessages} from '../messages'
import {metricOutputPresentation} from '../outputPresentation'
import {stateAppearance,stateLabel} from '../stateIntervals'
import {aggregateValue} from './aggregatePresentation'
import {collectionMessages} from './messages'
import type {MetricAggregateGroup,ReadOperation} from './types'
const props=defineProps<{groups:MetricAggregateGroup[];bounds:[number,number];interval:number;visible:boolean}>()
defineEmits<{(event:'members'):void}>()
const {t,locale}=useI18n({useScope:'local',messages:{zh:{...metricMessages.zh,...collectionMessages.zh},en:{...metricMessages.en,...collectionMessages.en}}})
const selected=ref(props.groups.find(item=>item.output.metricId===item.displaySettings?.primaryOutput)?.output.metricId || props.groups[0].output.metricId)
// Retain user zoom when an offscreen chart is disposed or another output is inspected.
const views=ref<Record<string,[number,number] | undefined>>({})
const group=computed(()=>props.groups.find(item=>item.output.metricId===selected.value) || props.groups[0])
const operation=ref<ReadOperation>(group.value.defaultOperation)
watch(()=>group.value.id,()=>{operation.value=group.value.defaultOperation})
watch(()=>group.value.operations,value=>{if(!value.includes(operation.value))operation.value=group.value.defaultOperation})
function selectOutput(id:string){selected.value=id}
const highlights=computed(()=>{
  const ids=group.value.displaySettings?.summaryOutputs
  return Array.isArray(ids) ? ids.flatMap(id=>props.groups.filter(item=>item.output.metricId===id && item.id!==group.value.id && item.defaultOperation!=='distribution')).slice(0,2) : []
})
const value=computed(()=>aggregateValue(group.value.latest,operation.value))
const duration=computed(()=>metricDurationText(value.value,group.value.output.unit,t))
const raw=(key:string)=>group.value.stateLabels?.find(item=>String(item.value)===key)?.value ?? key
const label=(key:string)=>stateLabel(raw(key),group.value.stateLabels || [],String(locale.value))
const appearance=(key:string)=>stateAppearance(raw(key),group.value.stateLabels)
</script>
<style scoped>
.aggregate-card {height:100%;min-width:0}
.aggregate-card :deep(.ec-body){border:0;padding:4px 0 8px}
.aggregate-card :deep(.ec-footer){font-size:11px;color:var(--ink-3);min-height:36px}
.aggregate-card__value {font-size:32px;font-weight:600;line-height:48px;font-variant-numeric:tabular-nums;color:var(--ink-1)}
.aggregate-card__value small{font-size:12px;font-weight:400;color:var(--ink-3);margin-left:6px}
.aggregate-card__coverage{font-size:11px;color:var(--ink-3);margin:4px 0 0;min-height:18px}
.aggregate-card__states{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;min-height:48px}
.aggregate-card__states>span{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2)}
.aggregate-card__states strong{font-size:24px;color:var(--ink-1);font-variant-numeric:tabular-nums}
.aggregate-card__states i{width:7px;height:7px;border-radius:50%}
.aggregate-card__highlights{display:flex;gap:6px 14px;flex-wrap:wrap;min-height:22px;font-size:11px;color:var(--ink-3)}
.aggregate-card__highlights span{display:flex;align-items:baseline;gap:4px}
.aggregate-card__highlights strong{color:var(--ink-2);font-weight:500;font-variant-numeric:tabular-nums}
.aggregate-card__placeholder{height:200px}
</style>
