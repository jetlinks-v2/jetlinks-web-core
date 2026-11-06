<template>
  <div class="metric-value" :class="{ 'metric-value--compact': compact, 'metric-value--inline': inline, 'metric-value--summary': summary }">
    <div class="metric-value__main">
      <IconValueView v-if="renderable && appearance.icon" :value="appearance.icon" :size="inline ? 14 : 20" indicator :fallback-text="text" />
      <slot v-if="renderable" :text="text"><strong :title="text">{{ text }}</strong></slot>
      <strong v-else :title="text">{{ text }}</strong><span v-if="renderable && duration === undefined && (value?.unit || unit)">{{ value?.unit || unit }}</span>
    </div>
    <p v-if="summary && !disabled && issueCaption" class="metric-value__issue" :title="issueCaption"><AIcon type="ExclamationCircleOutlined" />{{ issueCaption }}</p>
    <span v-else-if="inline && !disabled && !['valid', 'unknownQuality', 'waiting', 'noValue'].includes(state.key)" class="metric-value__inline-issue" :title="issueCaption || t(state.key)">{{ t(state.tone === 'error' ? 'issueNoResult' : 'issuePartial') }}</span>
    <a-tag v-else-if="!inline && (!hideQuality || !['valid', 'unknownQuality'].includes(state.key))" :color="state.tone === 'default' ? undefined : state.tone">{{ !disabled && issueCaption || t(state.key) }}</a-tag>
    <MetricValueFields v-if="meaning && renderable && value?.value && typeof value.value === 'object' && !Array.isArray(value.value)" :value="value.value" :schema="meaning.schema" />
    <div v-if="!summary && !inline && compact && value && !disabled" class="metric-value__facts">
      <span v-if="hasTime(value.inputTimeStart) && hasTime(value.inputTimeEnd)">{{ t('inputRange') }} {{ time(value.inputTimeStart) }} — {{ time(value.inputTimeEnd) }}</span>
      <span v-else-if="hasTime(value.eventTime)">{{ t('sourceTime') }} {{ time(value.eventTime) }}</span>
      <span v-else>{{ t('inputTimeUnknown') }}</span>
    </div>
    <div v-if="!summary && !inline && !compact && value && !disabled" class="metric-value__facts">
      <span v-if="hasTime(value.eventTime)">{{ t('sourceTime') }} {{ time(value.eventTime) }}</span>
      <span v-if="hasTime(evaluated)">{{ t('updatedAt') }} {{ time(evaluated) }}</span>
      <span v-if="hasTime(value.inputTimeStart) && hasTime(value.inputTimeEnd)">
        {{ t('inputRange') }} {{ time(value.inputTimeStart) }} — {{ time(value.inputTimeEnd) }}
      </span>
      <span v-if="value.quality?.coverage != null">{{ t('coverage') }} {{ percentage(value.quality.coverage) }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from './messages'
import { metricDurationText, metricState, resultTime } from './presentation'
import { formatMetricValue } from './extensions/presentationSettings'
import type { MetricStateLabel, MetricTemplate, MetricTemplateOutput, MetricValue } from './types'
import { metricIssueCaption } from './sourceDiagnostics'
import { semanticValueText, type ValueSchema } from './valueSemantics'
import MetricValueFields from './MetricValueFields.vue'
import IconValueView from '../IconValue/IconValueView.vue'
import { stateAppearance, stateLabel } from './stateIntervals'
const props = defineProps<{ value?: MetricValue; template?:MetricTemplate; output?:MetricTemplateOutput; unit?: string; disabled?: boolean; compact?: boolean; inline?: boolean; summary?: boolean; hideQuality?: boolean; settings?: Record<string, unknown>; labels?:MetricStateLabel[]; meaning?:{ schema?:ValueSchema; labels?:MetricStateLabel[] } }>()
const { t, locale } = useI18n({ useScope: 'local', messages: metricMessages })
const state = computed(() => props.disabled ? { key: 'disabled', tone: 'default' } : metricState(props.value))
const issueCaption = computed(()=>metricIssueCaption(props.value,props.template,t))
const appearance = computed(() => stateAppearance(props.value?.value,props.meaning?.labels || props.labels))
const renderable = computed(() => !props.disabled && props.value?.status !== 'invalid' && props.value?.quality?.valid !== false)
const duration = computed(() => renderable.value ? metricDurationText(props.value?.value, props.value?.unit || props.unit, t) : undefined)
const text = computed(() => !renderable.value ? props.summary && !props.disabled ? t('issueNoResult') : '—' : props.meaning ? semanticValueText(props.value?.value,{ ...props.meaning, locale:String(locale.value), unit:props.value?.unit || props.unit },t)
  : props.labels?.some(item=>item.value===props.value?.value) ? stateLabel(props.value?.value,props.labels,String(locale.value))
    : duration.value ?? (typeof props.value?.value === 'boolean' ? t(props.value.value ? 'conditionTrue' : 'conditionFalse') : formatMetricValue(props.value?.value, props.settings, props.output)))
const evaluated = computed(() => props.value && resultTime(props.value))
// 后端原始时间字段为 long；0 表示尚无来源事实，不能反显为 epoch 日期。
const hasTime = (value?: number): value is number => value !== undefined && Number.isFinite(value) && value > 0
const time = (value: number) => new Date(value).toLocaleString()
const percentage = (value: number) => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(value)
</script>
<style scoped>
.metric-value__main { display:flex; align-items:baseline; flex-wrap:wrap; gap:var(--space-2, 8px) }
.metric-value__main>.icon-value-view { align-self:center }
.metric-value__main strong { font-size:var(--fs-20, 20px); font-weight:600; color:var(--ink-1); max-width:26rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.metric-value__main > span { color:var(--ink-2) }
.metric-value > .ant-tag { margin-top:var(--space-2,8px) }
.metric-value--compact .metric-value__main strong { font-size:var(--fs-24,24px) }
.metric-value--summary .metric-value__main { min-height:46px }
.metric-value--summary { display:flex; align-items:center; flex-wrap:wrap; gap:8px }
.metric-value--summary > .ant-tag { margin:0 }
.metric-value__issue { display:flex; align-items:baseline; gap:6px; flex-basis:100%; margin:0; color:var(--ink-2); font-size:var(--fs-12,12px); line-height:1.6; overflow-wrap:anywhere }
.metric-value__issue :deep(.anticon) { color:var(--color-warning,#faad14); flex:none }
.metric-value__inline-issue { font-size:var(--fs-12,12px); color:var(--ink-3) }
.metric-value--summary .metric-value__main strong { font-size:var(--fs-32,32px); letter-spacing:-.5px; max-width:100%; line-height:1.4 }
.metric-value__facts { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-4,16px); color:var(--ink-3); font-size:var(--fs-12,12px); margin-top:var(--space-1,4px) }
.metric-value--inline { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:6px }
.metric-value--inline .metric-value__main strong { font-size:var(--fs-14,14px); color:var(--ink-2) }
.metric-value--inline > .ant-tag { margin:0; font-size:var(--fs-12,12px) }
</style>
