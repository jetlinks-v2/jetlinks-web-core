<template>
  <section class="aggregate-overview">
    <header class="aggregate-overview__tools">
      <div class="aggregate-overview__scope"><AIcon :type="scope.icon" /><span>{{ scope.label }}</span><a-button v-if="scope.tree" type="text" size="small" :class="{'is-active':descendants}" :aria-pressed="descendants" @click="descendants=!descendants"><AIcon type="BranchesOutlined" />{{ t(descendants ? 'descendants' : 'direct') }}</a-button></div>
      <MetricCollectionPicker :groups="choices" :value="selectedTemplates" templates @change="selectTemplates" />
      <MetricTimeRange v-model:range="range" v-model:custom-range="customRange" />
      <a-tooltip :title="t('refresh')"><a-button type="text" :loading="loading" :aria-label="t('refresh')" @click="refresh(true)"><AIcon type="ReloadOutlined" /></a-button></a-tooltip>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="t('failed')" :description="error"><template #action><a-button @click="refresh">{{ t('retry') }}</a-button></template></a-alert>
    <p class="aggregate-overview__note">{{ t('aggregateHint') }}<time v-if="result">{{ t('refreshed',{time:new Date(result.readTime).toLocaleTimeString(String(locale))}) }}</time></p>
    <a-spin :spinning="loading && !result">
      <a-empty v-if="!loading && !cards.length && !error" :description="t('aggregateEmpty')" />
      <ResponsiveGrid v-else-if="result" min="min(100%,340px)" :gap="16">
        <div v-for="card in cards" :key="card.id" :ref="element=>observe(card.id,element as Element | null)">
          <MetricAggregateCard :groups="card.groups" :variant-label="card.variant" :preference-key="cardPreferenceKey(card.id)" :bounds="[result!.from,result!.to]" :interval="result!.interval" :visible="isVisible(card.id)" @members="$emit('members',{templateId:card.groups[0].templateId})" />
        </div>
      </ResponsiveGrid>
    </a-spin>
  </section>
</template>
<script setup lang="ts">
import {computed,toRef} from 'vue'
import {useI18n} from 'vue-i18n'
import ResponsiveGrid from '../../ResponsiveGrid/index.vue'
import MetricTimeRange from '../MetricTimeRange.vue'
import MetricAggregateCard from './MetricAggregateCard.vue'
import MetricCollectionPicker from './MetricCollectionPicker.vue'
import {useMetricAggregate} from './useMetricAggregate'
import {aggregateCards,aggregateDirectory} from './aggregatePresentation'
import {collectionMessages} from './messages'
import type {MetricContext} from '../types'
import type {MetricCollectionSelection,MetricReadScopeOption} from './types'
const props=defineProps<{context:MetricContext;scope:MetricReadScopeOption}>()
defineEmits<{(event:'members',selection:MetricCollectionSelection):void}>()
const {t,locale}=useI18n({useScope:'local',messages:collectionMessages})
const {result,directory,selectedTemplates,selectTemplates,error,loading,range,customRange,descendants,refresh,observe,isVisible}=useMetricAggregate(toRef(props,'context'),toRef(props,'scope'))
const choices=computed(()=>directory.value || (result.value?.groups || []).map(group=>({...group,total:0})))
const cards=computed(()=>{
  const cards=aggregateCards(aggregateDirectory(result.value?.groups || [],directory.value || [])
    .filter(group=>!selectedTemplates.value || selectedTemplates.value.includes(group.templateId)))
  return cards.map(card=>{const group=card.groups[0],variants=cards.filter(item=>item.groups[0].templateId===group.templateId)
    return {...card,variant:variants.length>1 ? t('cardVariant',{version:group.version,revision:group.revision,index:variants.indexOf(card)+1}) : undefined}
  })
})
const cardPreferenceKey=(id:string)=>props.context.preferenceScope ? 'metric-aggregate-card:'+JSON.stringify([props.context.preferenceScope,props.context.ownerType,props.context.ownerId,props.scope.memberType,id]) : undefined
</script>
<style scoped>
.aggregate-overview{padding:16px;min-width:0}
.aggregate-overview__tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aggregate-overview__scope{display:flex;align-items:center;gap:8px;margin-right:auto;font-size:13px;color:var(--ink-2)}
.aggregate-overview__scope .is-active{color:var(--accent)}
.aggregate-overview__note{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;font-size:11px;color:var(--ink-3);margin:8px 0 16px}
</style>
