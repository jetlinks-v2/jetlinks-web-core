<template>
  <MetricCardShell :title="group.templateName" :icon="metricOutputPresentation(group.output,{labels:group.stateLabels}).icon" class="aggregate-card">
    <template #actions><small v-if="variantLabel" class="aggregate-card__variant">{{ variantLabel }}</small></template>
    <div class="aggregate-card__body">
      <div class="aggregate-card__output"><MetricOutputSwitch :outputs="groups.map(item=>item.output)" :output="group.output" :output-id="group.output.metricId" @change="selectOutput" />
        <a-dropdown v-if="group.operations.length>1" :trigger="['click']"><a-button type="text" size="small"><AIcon :type="readOperationPresentation(operation).icon" />{{ t(operation) }}<AIcon type="DownOutlined" /></a-button><template #overlay><a-menu :selected-keys="[operation]" @click="selectOperation($event.key as ReadOperation)"><a-menu-item v-for="item in group.operations" :key="item"><SelectOption :label="t(item)" :icon="readOperationPresentation(item).icon" :description="t(readOperationPresentation(item).description)" /></a-menu-item></a-menu></template></a-dropdown><small v-else-if="group.operations.length"><AIcon :type="readOperationPresentation(operation).icon" /> {{ t(operation) }}</small>
      </div>
      <div v-if="group.availability" class="aggregate-card__missing"><strong>—</strong><span>{{ t(group.availability==='unsupported' ? 'noAggregationPolicy' : 'noAggregateRecords') }}</span></div>
      <div v-else-if="operation==='distribution'" class="aggregate-card__states">
        <span v-for="(count,key) in group.latest.distribution" :key="key"><IconValueView v-if="appearance(String(key)).icon" :value="appearance(String(key)).icon" :size="14" indicator /><i v-else :style="{background:appearance(String(key)).color}" />{{ label(String(key)) }}<strong>{{ count }}</strong></span>
        <span v-if="group.latest.observed>group.latest.valid"><AIcon type="QuestionCircleOutlined" />{{ t('unknown') }}<strong>{{ group.latest.observed-group.latest.valid }}</strong></span>
      </div>
      <div v-else class="aggregate-card__value">{{ duration ?? formatMetricValue(value,undefined,group.output) }}<small v-if="duration===undefined">{{ group.output.unit }}</small></div>
      <p v-if="!group.availability" class="aggregate-card__coverage">{{ t('valid',{valid:group.latest.valid,total:group.latest.observed}) }}<span v-if="group.latest.observed>group.latest.valid"> · {{ t('missing',{count:group.latest.observed-group.latest.valid}) }}</span></p>
      <div class="aggregate-card__trend"><MetricAggregateTrend v-if="visible && !group.availability" :key="group.id" v-model:view="views[group.id]" :group="group" :operation="operation" :bounds="bounds" :interval="interval" compact /><span v-else-if="group.availability">{{ t('memberValuesAvailable') }}</span></div>
    </div>
    <footer class="aggregate-card__footer"><div class="aggregate-card__highlights"><span v-for="item in highlights" :key="item.id">{{ item.output.label || item.output.metricId }}<strong>{{ formatMetricValue(aggregateValue(item.latest,item.defaultOperation),undefined,item.output) }}</strong><small>{{ item.output.unit }}</small></span></div><a-button type="link" size="small" @click="$emit('members')">{{ t('viewMembers') }}<AIcon type="RightOutlined" /></a-button></footer>
  </MetricCardShell>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useI18n} from 'vue-i18n'
import MetricCardShell from '../MetricCardShell.vue'
import IconValueView from '../../IconValue/IconValueView.vue'
import SelectOption from '../../SelectOption/index.vue'
import MetricAggregateTrend from './MetricAggregateTrend.vue'
import MetricOutputSwitch from '../MetricOutputSwitch.vue'
import {formatMetricValue} from '../extensions/presentationSettings'
import {metricDurationText} from '../presentation'
import {metricMessages} from '../messages'
import {metricOutputPresentation} from '../outputPresentation'
import {stateAppearance,stateLabel} from '../stateIntervals'
import {aggregateValue} from './aggregatePresentation'
import {readOperationPresentation} from './aggregationPolicy'
import {collectionMessages} from './messages'
import type {MetricAggregateGroup,ReadOperation} from './types'
const props=defineProps<{groups:MetricAggregateGroup[];bounds:[number,number];interval:number;visible:boolean;preferenceKey?:string;variantLabel?:string}>()
defineEmits<{(event:'members'):void}>()
const {t,locale}=useI18n({useScope:'local',messages:{zh:{...metricMessages.zh,...collectionMessages.zh},en:{...metricMessages.en,...collectionMessages.en}}})
const selected=ref(props.groups.find(item=>item.output.metricId===item.displaySettings?.primaryOutput)?.output.metricId || props.groups[0].output.metricId)
// Retain user zoom when an offscreen chart is disposed or another output is inspected.
const views=ref<Record<string,[number,number] | undefined>>({})
const group=computed(()=>props.groups.find(item=>item.output.metricId===selected.value) || props.groups[0])
const operations=ref<Record<string,ReadOperation>>({})
const operation=computed(()=>group.value.operations.includes(operations.value[group.value.output.metricId]) ? operations.value[group.value.output.metricId] : group.value.defaultOperation)
// Browser preferences never modify template policies, and stale options cannot enable a disallowed reducer.
watch(()=>props.preferenceKey,key=>{
  selected.value=props.groups.find(item=>item.output.metricId===item.displaySettings?.primaryOutput)?.output.metricId || props.groups[0].output.metricId
  operations.value={}
  try {const saved=key ? JSON.parse(localStorage.getItem(key) || 'null') : null
    if(saved && typeof saved==='object') {
      if(props.groups.some(item=>item.output.metricId===saved.output))selected.value=saved.output
      for(const item of props.groups)if(item.operations.includes(saved.operations?.[item.output.metricId]))operations.value[item.output.metricId]=saved.operations[item.output.metricId]
    }
  } catch { /* Preferences are optional. */ }
},{immediate:true})
function savePreference(){try {if(props.preferenceKey)localStorage.setItem(props.preferenceKey,JSON.stringify({output:selected.value,operations:operations.value}))} catch { /* Preferences are optional. */ }}
function selectOutput(id:string){if(props.groups.some(item=>item.output.metricId===id)){selected.value=id;savePreference()}}
function selectOperation(value:ReadOperation){if(group.value.operations.includes(value)){operations.value={...operations.value,[group.value.output.metricId]:value};savePreference()}}
const highlights=computed(()=>{
  const ids=group.value.displaySettings?.summaryOutputs
  return Array.isArray(ids) ? ids.flatMap(id=>props.groups.filter(item=>item.output.metricId===id && item.id!==group.value.id && !item.availability && item.defaultOperation!=='distribution')).slice(0,2) : []
})
const value=computed(()=>aggregateValue(group.value.latest,operation.value))
const duration=computed(()=>metricDurationText(value.value,group.value.output.unit,t))
const raw=(key:string)=>group.value.stateLabels?.find(item=>String(item.value)===key)?.value ?? key
const label=(key:string)=>stateLabel(raw(key),group.value.stateLabels || [],String(locale.value))
const appearance=(key:string)=>stateAppearance(raw(key),group.value.stateLabels)
</script>
<style scoped>
.aggregate-card__body{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0;padding:8px 16px 12px}
.aggregate-card__variant{font-size:10px;color:var(--ink-3);flex:none}
.aggregate-card__output{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;color:var(--ink-2)}
.aggregate-card__output small{font-size:11px;color:var(--ink-3);flex:none}
.aggregate-card__value {font-size:28px;font-weight:600;line-height:46px;font-variant-numeric:tabular-nums;color:var(--ink-1)}
.aggregate-card__value small{font-size:12px;font-weight:400;color:var(--ink-3);margin-left:6px}
.aggregate-card__coverage{font-size:11px;color:var(--ink-3);margin:4px 0 0;min-height:18px}
.aggregate-card__states{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;min-height:48px}
.aggregate-card__states>span{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2)}
.aggregate-card__states strong{font-size:24px;color:var(--ink-1);font-variant-numeric:tabular-nums}
.aggregate-card__states i{width:7px;height:7px;border-radius:50%}
.aggregate-card__footer{display:flex;gap:12px;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding:8px 16px;min-height:60px}
.aggregate-card__highlights{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:11px;color:var(--ink-3)}
.aggregate-card__highlights span{display:flex;align-items:baseline;gap:4px}
.aggregate-card__highlights strong{color:var(--ink-2);font-weight:500;font-variant-numeric:tabular-nums}
.aggregate-card__trend{height:86px;flex:none;margin-top:auto;color:var(--ink-3);font-size:11px;display:grid;align-items:center}
.aggregate-card__missing{display:flex;align-items:center;gap:12px;color:var(--ink-2);font-size:12px;min-height:46px}
.aggregate-card__missing strong{font-size:28px;color:var(--ink-1)}
</style>
