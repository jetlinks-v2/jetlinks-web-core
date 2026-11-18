<template>
  <div class="metric-history-view">
    <div class="metric-history-view__tools">
      <slot name="tools" />
      <a-select v-if="available" :value="aggregate.operation.value" :aria-label="t('historyAggregation')" :loading="aggregate.loading.value" :bordered="false" :dropdown-match-select-width="false" :virtual="false" :list-height="320" size="small" @keydown.esc.stop @dropdownVisibleChange="($event:boolean) => $event && aggregate.describe()" @change="aggregate.operation.value = $event">
        <a-select-option value="" :label="t('historyRaw')"><SelectOption icon="HistoryOutlined" :label="t('historyRaw')" :description="t('historyRawHint')" /></a-select-option>
        <a-select-option v-for="option in aggregate.operations.value" :key="option.id" :value="option.id" :label="option.name"><SelectOption :icon="option.icon" :label="option.name" :description="t('historyOperationHint_'+option.id)" /></a-select-option>
      </a-select>
      <a-select v-if="aggregate.operation.value" v-model:value="aggregate.interval.value" :aria-label="t('historyBucket')" :bordered="false" :dropdown-match-select-width="false" :virtual="false" :list-height="320" size="small" @keydown.esc.stop>
        <a-select-option :value="0" :label="t('historyBucketAuto')"><SelectOption icon="CompressOutlined" :label="t('historyBucketAuto')" :description="t('historyBucketAutoHint')" /></a-select-option>
        <a-select-option v-for="option in intervals" :key="option.value" :value="option.value" :label="t('historyBucketEvery',{value:t(option.label)})" :disabled="!bounds || option.value > bounds[1]-bounds[0] || Math.ceil((bounds[1]-bounds[0])/option.value)>256"><SelectOption icon="ClockCircleOutlined" :label="t('historyBucketEvery',{value:t(option.label)})" :description="t('historyBucketHint')" /></a-select-option>
      </a-select>
    </div>
    <a-alert v-if="aggregate.error.value" type="error" show-icon :message="t('readFailed')" :description="aggregate.error.value"><template #action><a-button size="small" @click="aggregate.refresh">{{ t('retry') }}</a-button></template></a-alert>
    <template v-if="aggregate.operation.value">
      <a-skeleton v-if="aggregate.loading.value" active :paragraph="{rows:4}" />
      <template v-else-if="!aggregate.error.value"><small class="metric-history-view__caption">{{ t('historyAggregatedValid') }}</small><MetricTrend aggregated integrated :values="aggregate.values.value" :output="output" :bounds="aggregate.bounds.value" :sample-interval="aggregate.width.value" /></template>
    </template>
    <slot v-else />
  </div>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricTrend from '../MetricTrend.vue'
import SelectOption from '../../SelectOption/index.vue'
import { metricMessages } from '../messages'
import { metricOutputPresentation } from '../outputPresentation'
import { useMetricHistoryAggregate } from './useMetricHistoryAggregate'
import type { MetricReference, MetricTemplateOutput } from '../types'
const props = defineProps<{reference:MetricReference;output?:MetricTemplateOutput;bounds?:[number,number];inaccessible?:boolean;stateOutput?:boolean;dataVersion?:string;queryKey?:string}>()
const {t} = useI18n({useScope:'local',messages:metricMessages})
const available = computed(() => !props.inaccessible && !props.stateOutput && metricOutputPresentation(props.output).history === 'number' && props.output?.persist !== false && !props.output?.latestOnly)
const aggregate = useMetricHistoryAggregate(toRef(props,'reference'),toRef(props,'bounds'),available,undefined,toRef(props,'dataVersion'),toRef(props,'queryKey'))
const intervals = [{value:60000,label:'historyOneMinute'},{value:300000,label:'historyFiveMinutes'},{value:3600000,label:'historyOneHour'}]
defineExpose({refresh:() => { if (aggregate.operation.value) void aggregate.refresh() }})
</script>
<style scoped>
.metric-history-view { min-width:0 }
.metric-history-view__tools { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px }
.metric-history-view__tools :deep(.ant-select) { min-width:104px; font-size:12px }
.metric-history-view__caption { display:block; color:var(--ink-3); font-size:12px; margin:4px 0 }
</style>
