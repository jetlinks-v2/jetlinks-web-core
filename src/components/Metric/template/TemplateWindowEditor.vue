<template>
  <div class="window-editor">
    <div class="window-editor__sentence">
      <AIcon type="ClockCircleOutlined" />
      {{ t('sentenceTakeFrom') }} <slot name="source" />
      <Editable class="window-editor__range" type="select" :value="mode" :component-props="{ disabled, bordered:false, defaultOpen:true, 'aria-label':t('windowRange'), options:modes, dropdownMatchSelectWidth:false }" @change="changeMode($event as TemplateWindow['mode'])">{{ t(mode === 'none' ? 'sentenceLatestWindow' : mode === 'time' ? 'sentenceTimeWindow' : 'sentenceCountWindow') }}</Editable>
      <TemplateDuration v-if="mode === 'time'" :model-value="window?.size" :min="1" :disabled="disabled" @update:model-value="patchWindow({ size: $event })" />
      <Editable v-else-if="mode === 'latestN'" class="window-editor__amount" type="number" :value="Number(window?.size) || undefined" :component-props="{ min:1, precision:0, disabled, bordered:false, controls:false, 'aria-label':t('sampleCount') }" @change="patchWindow({ size:$event == null ? undefined : String($event) })" />
      <span v-if="mode === 'latestN'">{{ t('sentenceReadings') }}</span>
      <span v-else-if="mode === 'time'">{{ t('sentenceHistory') }}</span>
      <template v-if="mode !== 'none'">
        {{ t('sentenceForStatistic') }}
        <Editable class="window-editor__statistic" type="select" :value="rule.aggregation || 'avg'" :component-props="{ disabled, bordered:false, defaultOpen:true, 'aria-label':t('statistic'), options:statistics, dropdownMatchSelectWidth:false }" @change="setAggregation($event as string)" />
      </template>{{ t('sentenceEnd') }}
    </div>
    <small>{{ t(mode === 'latestN' ? 'countWindowHint' : mode === 'none' ? 'latestWindowHint' : 'rollingWindowHint') }}</small>
    <details v-if="mode !== 'none'" class="window-editor__settings">
      <summary>{{ t('moreSettings') }}</summary>
        <TemplateClause icon="ClockCircleOutlined" :title="t('timeBasis')"><Editable class="window-editor__choice" type="select" :value="window?.timeMode || 'processing'" :component-props="{ disabled, bordered:false, defaultOpen:true, 'aria-label':t('timeBasis'), options:timeModes }" @change="patchWindow({ timeMode:$event as TemplateWindow['timeMode'] })" /></TemplateClause>
        <TemplateClause icon="PercentageOutlined" :title="t('expectedCount')" :hint="t('coverageHint')"><Editable class="window-editor__amount" type="number" :value="rule.qualityPolicy?.expectedCount ?? window?.expectedCount" :component-props="{ disabled, min:1, precision:0, controls:false, bordered:false, 'aria-label':t('expectedCount') }" @change="setExpectedCount($event as number | null)" /></TemplateClause>
        <TemplateClause v-if="mode === 'time'" icon="DatabaseOutlined" :title="t('windowCapacity')"><Editable class="window-editor__amount" type="number" :value="window?.maxEntries" :component-props="{ disabled, min:1, precision:0, controls:false, bordered:false, 'aria-label':t('windowCapacity') }" @change="patchWindow({ maxEntries:($event ?? undefined) as number | undefined })" /></TemplateClause>
    </details>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TemplateDuration from './TemplateDuration.vue'
import TemplateClause from './TemplateClause.vue'
import Editable from '../../Editable/index.vue'
import { aggregations, windowFields, type TemplateWindow } from './window'
import type { TemplateRule } from './designer'
import { metricMessages } from '../messages'
const props = defineProps<{ rule: TemplateRule; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'patch', value: Partial<TemplateRule>): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const window = computed(() => props.rule.window)
const mode = computed(() => window.value?.mode || 'none')
const modes = computed(() => [
  { value:'time', label:t('window_time'), icon:'ClockCircleOutlined', description:t('rollingWindowHint') },
  { value:'latestN', label:t('window_latestN'), icon:'BarsOutlined', description:t('countWindowHint') },
  { value:'none', label:t('window_none'), icon:'ThunderboltOutlined', description:t('latestWindowHint') },
])
const statistics = computed(() => aggregations.map(value => ({ value, label:t(`statistic_${value}`), icon:'BarChartOutlined', description:t(`statistic${value[0].toUpperCase()}${value.slice(1)}Hint`) })))
const timeModes = computed(() => ['event', 'processing', 'hybrid'].map(value => ({ value, label:t(`time_${value}`), icon:'ClockCircleOutlined', description:t(`time${value[0].toUpperCase()}${value.slice(1)}Hint`) })))
function patchWindow(fields: Partial<TemplateWindow>) { if (!props.disabled) emit('patch', { window: { ...window.value, ...fields } }) }
function setAggregation(value: string) { if (!props.disabled) emit('patch', { aggregation:value }) }
function setExpectedCount(value: number | null) {
  if (!props.disabled) emit('patch', { qualityPolicy: { ...props.rule.qualityPolicy, expectedCount: value ?? undefined }, window: { ...window.value, expectedCount: undefined } })
}
function changeMode(value: TemplateWindow['mode']) {
  if (!props.disabled) emit('patch', { type: value === 'none' ? 'raw' : 'feature', aggregation: value === 'none' ? undefined : props.rule.aggregation || 'avg', window: windowFields(window.value, value) })
}
</script>
<style scoped>
.window-editor { display:grid; gap:var(--space-3,12px) }
.window-editor__sentence { min-height:32px; line-height:2.6; font-size:13px; overflow-wrap:anywhere }
.window-editor__sentence > :first-child { color:var(--ink-3); margin-right:6px }
.window-editor__sentence :deep(.template-duration) { width:auto }
.window-editor__sentence :deep(.template-duration__amount) { width:auto; min-width:28px; flex:0 1 auto }
.window-editor__sentence :deep(.template-duration__unit) { width:auto; min-width:40px }
.window-editor__range,.window-editor__statistic { min-width:40px; max-width:100%; color:var(--accent) }
.window-editor__choice { width:140px; max-width:100%; color:var(--accent) }
.window-editor__amount { min-width:40px; color:var(--accent) }
.window-editor :deep(.template-clause__content)>.ant-select { width:100%; min-width:0 }
.window-editor small { display:block; color:var(--ink-3) }
.window-editor__settings > summary { color:var(--ink-3); font-size:12px; cursor:pointer; padding:4px 0 }
</style>
