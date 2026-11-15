<template>
  <section class="metric-bindings">
    <a-alert v-if="error" type="error" show-icon :message="t(state.pendingAdd.value ? 'addFailed' : 'failed')" :description="error"><template #action><template v-if="state.pendingAdd.value"><a-button :loading="state.busy.value" @click="state.retryAdd">{{ t('retryAdd') }}</a-button><a-button :disabled="state.busy.value" @click="state.cancelAdd">{{ t('cancel') }}</a-button></template><a-button v-else @click="refresh">{{ t('retry') }}</a-button></template></a-alert>
    <a-skeleton v-if="state.page.state.value.status==='loading' && !state.page.data.value || results.query.state.value.status==='loading' && !results.query.data.value" active :paragraph="{rows:3}" />
    <div v-else class="metric-bindings__grid"><MetricBindingCard v-for="card in visibleCards" :key="card.key" :card="card" :context="context" :busy="state.busy.value" :managing="managing" @inspect="selected=$event" @remove="state.remove" @manage-location="$emit('manageLocation',$event)" /></div>
    <a-button v-if="state.page.data.value?.nextCursor" :loading="state.page.state.value.status==='loading'" @click="state.refresh(state.page.data.value!.nextCursor)">{{ t('more') }}</a-button>
    <details v-if="state.types.value.length" class="metric-bindings__summary" @toggle="summaryOpen=($event.target as HTMLDetailsElement).open">
      <summary>{{ t('summary') }}<small>{{ t('summaryHint') }}</small></summary>
      <template v-if="summaryOpen">
        <div class="metric-bindings__tools"><a-select v-if="targetOptions.length>1" v-model:value="state.targetType.value" :aria-label="t('targetType')" :options="targetOptions" /><span v-else>{{ targetOptions[0]?.label }}</span><MetricTimeRange v-model:range="state.range.value" v-model:custom-range="state.customRange.value" /><a-button type="text" :aria-label="t('refresh')" @click="state.summarize"><AIcon type="ReloadOutlined" /></a-button></div>
        <a-alert v-if="state.aggregate.state.value.status==='error'" type="warning" :message="state.aggregate.state.value.message" />
        <a-skeleton v-else-if="state.aggregate.state.value.status==='loading'" active />
        <ResponsiveGrid v-else-if="state.aggregate.data.value?.groups.length" min="min(100%,340px)" :gap="12"><MetricAggregateCard v-for="card in aggregateCards" :key="card.id" :groups="card.groups" :bounds="[state.aggregate.data.value!.from,state.aggregate.data.value!.to]" :interval="state.aggregate.data.value!.interval" :visible="true" hide-members /></ResponsiveGrid>
        <p v-else-if="state.aggregate.data.value" class="metric-bindings__empty">{{ t(state.aggregate.data.value.availability==='unsupported' ? 'unsupportedAggregate' : 'noAggregate') }}</p>
      </template>
    </details>
    <JlDrawerShell :open="!!selected" :title="t('detail')" :width="860" @update:open="!$event && (selected=undefined)"><MetricResult v-if="selected" :key="JSON.stringify(selected)" :reference="{configId:selected.configId,outputId:selected.outputId,targetType:selected.targetType,targetId:selected.targetId}" /></JlDrawerShell>
  </section>
</template>
<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useI18n} from 'vue-i18n'
import ResponsiveGrid from '../../ResponsiveGrid/index.vue'
import JlDrawerShell from '../../JlDrawerShell/index.vue'
import MetricTimeRange from '../MetricTimeRange.vue'
import MetricResult from '../MetricResult.vue'
import MetricAggregateCard from '../collection/MetricAggregateCard.vue'
import MetricBindingCard from './MetricBindingCard.vue'
import {aggregateCards as presentAggregateCards} from '../collection/aggregatePresentation'
import {bindingMessages} from './messages'
import {collectMetricResources} from '../extensions/registry'
import {useMetricBindingResults} from './useMetricBindingResults'
import type {useMetricBindings} from './useMetricBindings'
import type {MetricContext,MetricObjectBinding,MetricReference,MetricWorkspaceSelection} from '../types'
const props=defineProps<{context:MetricContext;state:ReturnType<typeof useMetricBindings>;managing?:boolean;exclude?:MetricReference[]}>()
defineEmits<{(event:'manageLocation',value:MetricWorkspaceSelection):void}>()
const {t,locale}=useI18n({useScope:'local',messages:bindingMessages})
const results=useMetricBindingResults(computed(()=>props.state.page.data.value?.items || []),computed(()=>String(locale.value)))
// 查看结果时去重；管理时仍须能移除重复添加的关系，不能把隐藏卡片当作事实不存在。
const visibleCards=computed(()=>{const excluded=new Set(props.exclude?.map(ref=>JSON.stringify([ref.configId,ref.outputId,ref.targetType,ref.targetId])));return results.cards.value.filter(card=>props.managing || !excluded.has(card.key))})
const selected=ref<MetricObjectBinding>(),summaryOpen=ref(false)
const error=computed(()=>props.state.mutationError.value || (props.state.page.state.value.status==='error' ? props.state.page.state.value.message : ''))
const aggregateCards=computed(()=>presentAggregateCards(props.state.aggregate.data.value?.groups || []))
const targetOptions=computed(()=>props.state.types.value.map(value=>{
  const provider=collectMetricResources().dimensions.find(item=>item.provider.ownerType===value)?.provider
  const label=props.context.readScopes?.find(scope=>scope.memberType===value)?.label || (typeof provider?.label==='function' ? provider.label() : provider?.label)
  return {value,label:label || t('sourceObject')}
}))
function refresh(){void props.state.refresh();if(summaryOpen.value)void props.state.summarize()}
watch(()=>[props.context.ownerType,props.context.ownerId],()=>{selected.value=undefined;summaryOpen.value=false})
watch(summaryOpen,value=>{props.state.summaryActive.value=value})
defineExpose({refresh})
</script>
<style scoped>
.metric-bindings{display:grid;gap:12px;min-width:0}.metric-bindings__tools{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--ink-3)}
.metric-bindings__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.metric-bindings__summary{border-top:1px solid var(--line);padding-top:12px;min-width:0}
.metric-bindings__summary summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;cursor:pointer;font-size:13px;margin-bottom:12px}.metric-bindings__summary summary small,.metric-bindings__empty{color:var(--ink-3);font-size:12px}
.metric-bindings__summary :deep(.ant-select){min-width:120px}@container metric-panel (max-width:580px){.metric-bindings__grid{grid-template-columns:minmax(0,1fr)}}
</style>
