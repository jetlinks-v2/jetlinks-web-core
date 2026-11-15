<template>
  <section class="aggregate-overview">
    <header class="aggregate-overview__tools">
      <div class="aggregate-overview__filters">
        <div class="aggregate-overview__field"><span>{{ t('summaryObjects') }}</span>
          <a-select v-if="(context.readScopes?.length || 0)>1" :value="scope.memberType" :aria-label="t('summaryObjects')" :dropdown-match-select-width="false" @change="$emit('scope',String($event))">
            <a-select-option v-for="item in context.readScopes" :key="item.memberType" :value="item.memberType" :label="item.label"><SelectOption :label="item.label" :icon="item.icon" /></a-select-option>
            <template #suffixIcon><AIcon type="DownOutlined" /></template>
          </a-select>
          <strong v-else><AIcon :type="scope.icon" />{{ scope.label }}</strong>
          <a-dropdown v-if="scope.tree" :trigger="['click']"><a-button type="text" size="small"><AIcon type="BranchesOutlined" />{{ depthLabel(descendants) }}<AIcon type="DownOutlined" /></a-button><template #overlay><a-menu :selected-keys="[String(descendants)]" @click="descendants=$event.key==='true'"><a-menu-item v-for="value in [false,true]" :key="String(value)"><SelectOption :label="depthLabel(value)" icon="BranchesOutlined" /></a-menu-item></a-menu></template></a-dropdown>
        </div>
        <div class="aggregate-overview__field"><span>{{ t('metric') }}</span><MetricCollectionPicker :groups="choices" :value="selectedTemplates" templates @change="selectTemplates" /></div>
      </div>
      <div class="aggregate-overview__period"><MetricTimeRange v-model:range="range" v-model:custom-range="customRange" compact /><a-tooltip :title="t('refresh')"><a-button type="text" size="small" shape="circle" :loading="loading" :aria-label="t('refresh')" @click="refresh(true)"><AIcon type="ReloadOutlined" /></a-button></a-tooltip></div>
    </header>
    <div class="aggregate-overview__note"><span>{{ t('aggregateHint') }}<a-tooltip :title="t('aggregateHistoryHint')"><AIcon type="InfoCircleOutlined" tabindex="0" :aria-label="t('aggregateHistoryHint')" /></a-tooltip></span><time v-if="result">{{ error ? t('previousResults')+' · ' : '' }}{{ t('refreshed',{time:new Date(result.readTime).toLocaleTimeString(String(locale))}) }}</time></div>
    <a-alert v-if="error" type="error" show-icon :message="t('overviewFailed')" :description="error"><template #action><a-button @click="refresh(true)">{{ t('retry') }}</a-button></template></a-alert>
    <a-skeleton v-if="loading && !result" active :paragraph="{rows:5}" />
    <template v-else>
      <a-empty v-if="emptyReason && !error" class="aggregate-overview__empty" :image="simpleImage" :description="t(emptyReason)">
        <a-button v-if="emptyReason==='aggregateNoMatch'" @click="selectTemplates()">{{ t('resetAll') }}</a-button>
        <a-button v-else-if="canViewCurrent" @click="openCurrent()">{{ t('viewCurrent') }}</a-button>
      </a-empty>
      <ResponsiveGrid v-else-if="result" min="min(100%,340px)" :gap="16">
        <div v-for="card in cards" :key="card.id" :ref="element=>observe(card.id,element as Element | null)">
          <MetricAggregateCard :groups="card.groups" :variant-label="card.variant" :hide-members="!canViewCurrent" :preference-key="cardPreferenceKey(card.id)" :bounds="[result!.from,result!.to]" :interval="result!.interval" :visible="isVisible(card.id)" @members="openCurrent(card.groups[0].templateId)" />
        </div>
      </ResponsiveGrid>
    </template>
  </section>
</template>
<script setup lang="ts">
import {computed,toRef} from 'vue'
import {Empty} from 'ant-design-vue'
import {useI18n} from 'vue-i18n'
import ResponsiveGrid from '../../ResponsiveGrid/index.vue'
import SelectOption from '../../SelectOption/index.vue'
import MetricTimeRange from '../MetricTimeRange.vue'
import MetricAggregateCard from './MetricAggregateCard.vue'
import MetricCollectionPicker from './MetricCollectionPicker.vue'
import {useMetricAggregate} from './useMetricAggregate'
import {aggregateCards,aggregateDirectory} from './aggregatePresentation'
import {collectionMessages} from './messages'
import type {MetricContext} from '../types'
import type {MetricCollectionSelection,MetricReadScopeOption} from './types'
const props=defineProps<{context:MetricContext;scope:MetricReadScopeOption}>()
const emit=defineEmits<{(event:'members',selection:MetricCollectionSelection):void;(event:'scope',memberType:string):void}>()
const {t,locale}=useI18n({useScope:'local',messages:collectionMessages})
const simpleImage=Empty.PRESENTED_IMAGE_SIMPLE
const {result,catalog,directory,selectedTemplates,selectTemplates,error,loading,range,customRange,descendants,refresh,observe,isVisible}=useMetricAggregate(toRef(props,'context'),toRef(props,'scope'))
const depthLabel=(value:boolean)=>t(props.scope.memberType===props.context.ownerType ? value ? 'allChildren' : 'directChildren' : value ? 'descendants' : 'direct')
const choices=computed(()=>directory.value || (result.value?.groups || []).map(group=>({...group,total:0})))
const cards=computed(()=>{
  const cards=aggregateCards(aggregateDirectory(result.value?.groups || [],directory.value || [])
    .filter(group=>!selectedTemplates.value || selectedTemplates.value.includes(group.templateId)))
  return cards.map(card=>{const group=card.groups[0],variants=cards.filter(item=>item.groups[0].templateId===group.templateId)
    return {...card,variant:variants.length>1 ? t('cardVariant',{index:variants.indexOf(card)+1}) : undefined}
  })
})
const hasRecordedResults=computed(()=>cards.value.some(card=>card.groups.some(group=>!group.availability)))
const canViewCurrent=computed(()=>hasRecordedResults.value || (catalog.value ? catalog.value.visibleMembers>0 : !!result.value?.groups.length))
// 只用已授权目录和历史可用性区分空态，不把记录数量当作成员总数。
const emptyReason=computed(()=>{
  if(!result.value)return undefined
  // 历史查询比目录新，新增成员的真实结果不能被旧的空目录遮住。
  if(hasRecordedResults.value)return undefined
  if(catalog.value?.visibleMembers===0)return 'aggregateNoMembers'
  if(!cards.value.length){
    if(selectedTemplates.value)return 'aggregateNoMatch'
    return catalog.value && !catalog.value.groups.length ? 'aggregateNoMetrics' : result.value.availability==='unsupported' ? 'aggregateUnsupported' : 'aggregateEmpty'
  }
  const groups=cards.value.flatMap(card=>card.groups)
  if(groups.every(group=>group.availability==='unsupported'))return 'aggregateUnsupported'
  if(groups.every(group=>!!group.availability))return 'aggregateEmpty'
  return undefined
})
function openCurrent(templateId?:string){emit('members',{templateId,descendants:props.scope.tree ? descendants.value : false})}
const cardPreferenceKey=(id:string)=>props.context.preferenceScope ? 'metric-aggregate-card:'+JSON.stringify([props.context.preferenceScope,props.context.ownerType,props.context.ownerId,props.scope.memberType,id]) : undefined
</script>
<style scoped>
.aggregate-overview{padding:16px;min-width:0}
.aggregate-overview__tools{display:flex;align-items:center;justify-content:space-between;gap:12px 20px;flex-wrap:wrap}
.aggregate-overview__filters{display:flex;align-items:center;flex-wrap:wrap;gap:12px 24px;min-width:0;max-width:100%}
.aggregate-overview__field{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0;max-width:100%;font-size:12px}
.aggregate-overview__field>span{color:var(--ink-3);flex:none}.aggregate-overview__field>strong{display:flex;align-items:center;gap:6px;font-weight:500}
.aggregate-overview__field :deep(.ant-select){min-width:100px;max-width:100%}.aggregate-overview__field :deep(.ant-btn){color:var(--ink-2)}
.aggregate-overview__period{display:flex;align-items:center;gap:4px;min-width:0;max-width:100%;margin-left:auto}.aggregate-overview__period>.ant-btn{flex:none}
.aggregate-overview__note{display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:space-between;font-size:11px;color:var(--ink-3);margin:10px 0 20px}
.aggregate-overview__note>span{display:flex;align-items:center;gap:6px}.aggregate-overview__note time{white-space:nowrap}
.aggregate-overview__empty{padding:40px 0}
@media(max-width:600px){.aggregate-overview__period{margin-left:0}.aggregate-overview__note{margin-bottom:16px}}
</style>
