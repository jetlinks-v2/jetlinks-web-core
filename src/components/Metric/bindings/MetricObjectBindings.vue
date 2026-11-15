<template>
  <section class="metric-bindings">
    <header><p>{{ t('hint') }}</p><a-button v-if="context.editable && pickSource" :loading="state.busy.value" @click="state.add(t('concrete'))"><AIcon type="LinkOutlined" />{{ t('add') }}</a-button><a-button type="text" :aria-label="t('refresh')" @click="refresh"><AIcon type="ReloadOutlined" /></a-button></header>
    <a-alert v-if="error" type="error" show-icon :message="t('failed')" :description="error"><template #action><a-button @click="refresh">{{ t('retry') }}</a-button></template></a-alert>
    <a-skeleton v-if="state.page.state.value.status==='loading' && !state.page.data.value" active :paragraph="{rows:3}" />
    <a-empty v-else-if="!state.page.data.value?.items.length && !error" :description="t('empty')" />
    <a-list v-else :data-source="state.page.data.value?.items || []" size="small">
      <template #renderItem="{item}"><a-list-item><a-list-item-meta :title="item.configName || item.reference.outputId" :description="`${item.reference.targetType} · ${item.reference.targetId} / ${item.reference.outputId}`"><template #avatar><AIcon type="NodeIndexOutlined" /></template></a-list-item-meta><template #actions><a-tag v-if="item.pending">{{ t('pending') }}</a-tag><a-button type="link" size="small" @click="selected=item.reference">{{ t('detail') }}</a-button><a-popconfirm v-if="context.editable" :title="t('removeConfirm')" @confirm="state.remove(item.id)"><a-button type="text" size="small" :disabled="state.busy.value" :aria-label="t('remove')"><AIcon type="DeleteOutlined" /></a-button></a-popconfirm></template></a-list-item></template>
    </a-list>
    <a-button v-if="state.page.data.value?.nextCursor" :loading="state.page.state.value.status==='loading'" @click="state.refresh(state.page.data.value!.nextCursor)">{{ t('more') }}</a-button>
    <div v-if="state.types.value.length" class="metric-bindings__summary"><strong>{{ t('summary') }}</strong><a-select v-model:value="state.targetType.value" :aria-label="t('targetType')" :options="targetOptions" /><MetricTimeRange v-model:range="state.range.value" v-model:custom-range="state.customRange.value" /></div>
    <a-alert v-if="state.aggregate.state.value.status==='error'" type="warning" :message="state.aggregate.state.value.message" />
    <a-skeleton v-else-if="state.aggregate.state.value.status==='loading' && !state.aggregate.data.value" active />
    <ResponsiveGrid v-if="state.aggregate.data.value?.groups.length" min="min(100%,340px)" :gap="16"><MetricAggregateCard v-for="card in cards" :key="card.id" :groups="card.groups" :bounds="[state.aggregate.data.value!.from,state.aggregate.data.value!.to]" :interval="state.aggregate.data.value!.interval" :visible="true" hide-members /></ResponsiveGrid>
    <p v-else-if="state.aggregate.data.value" class="metric-bindings__empty">{{ t('noAggregate') }}</p>
    <JlDrawerShell :open="!!selected" :title="t('detail')" :width="860" @update:open="!$event && (selected=undefined)"><MetricResult v-if="selected" :key="JSON.stringify(selected)" :reference="{configId:selected.configId,outputId:selected.outputId,targetType:selected.targetType,targetId:selected.targetId}" /></JlDrawerShell>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,toRef} from 'vue'
import {useI18n} from 'vue-i18n'
import ResponsiveGrid from '../../ResponsiveGrid/index.vue'
import JlDrawerShell from '../../JlDrawerShell/index.vue'
import MetricTimeRange from '../MetricTimeRange.vue'
import MetricResult from '../MetricResult.vue'
import MetricAggregateCard from '../collection/MetricAggregateCard.vue'
import {aggregateCards} from '../collection/aggregatePresentation'
import {bindingMessages} from './messages'
import {useMetricBindings} from './useMetricBindings'
import {collectMetricResources} from '../extensions/registry'
import type {MetricContext,MetricObjectBinding,MetricSourcePicker} from '../types'
const props=defineProps<{context:MetricContext;pickSource?:MetricSourcePicker}>()
const {t}=useI18n({useScope:'local',messages:bindingMessages})
const state=useMetricBindings(toRef(props,'context'),toRef(props,'pickSource'))
const selected=ref<MetricObjectBinding>()
const error=computed(()=>state.mutationError.value || (state.page.state.value.status==='error' ? state.page.state.value.message : ''))
const cards=computed(()=>aggregateCards(state.aggregate.data.value?.groups || []))
const targetOptions=computed(()=>state.types.value.map(value=>{
  const provider=collectMetricResources().dimensions.find(item=>item.provider.ownerType===value)?.provider
  const label=contextLabel(value) || (typeof provider?.label==='function' ? provider.label() : provider?.label)
  return {value,label:label || value}
}))
function contextLabel(type:string){return props.context.readScopes?.find(scope=>scope.memberType===type)?.label}
function refresh(){void state.refresh();if(state.targetType.value)void state.summarize()}
</script>
<style scoped>
.metric-bindings{display:grid;gap:16px;padding:16px;min-width:0}
.metric-bindings>header,.metric-bindings__summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.metric-bindings>header p{flex:1;min-width:180px;color:var(--ink-3);font-size:12px;margin:0}
.metric-bindings__summary strong{font-weight:500;margin-right:auto}
.metric-bindings__summary :deep(.ant-select){min-width:120px}
.metric-bindings__empty{color:var(--ink-3);font-size:12px;margin:0}
</style>
