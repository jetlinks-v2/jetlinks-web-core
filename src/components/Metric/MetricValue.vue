<template>
  <div class="metric-value" :class="{ 'metric-value--compact': compact }">
    <div class="metric-value__main">
      <slot v-if="renderable" :text="text"><strong :title="text">{{ text }}</strong></slot>
      <strong v-else :title="text">{{ text }}</strong><span v-if="value?.unit || unit">{{ value?.unit || unit }}</span>
    </div>
    <a-tag :color="state.tone === 'default' ? undefined : state.tone">{{ t(state.key) }}</a-tag>
    <div v-if="compact && value && !disabled" class="metric-value__facts">
      <span v-if="value.inputTimeStart != null && value.inputTimeEnd != null">{{ t('inputRange') }} {{ time(value.inputTimeStart) }} — {{ time(value.inputTimeEnd) }}</span>
      <span v-else-if="value.eventTime != null">{{ t('sourceTime') }} {{ time(value.eventTime) }}</span>
      <span v-else>{{ t('inputTimeUnknown') }}</span>
    </div>
    <div v-if="!compact && value && !disabled" class="metric-value__facts">
      <span v-if="value.eventTime != null">{{ t('sourceTime') }} {{ time(value.eventTime) }}</span>
      <span v-if="evaluated != null">{{ t('updatedAt') }} {{ time(evaluated) }}</span>
      <span v-if="value.inputTimeStart != null && value.inputTimeEnd != null">
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
import { metricState, resultTime } from './presentation'
import { formatMetricValue } from './extensions/presentationSettings'
import type { MetricValue } from './types'
const props = defineProps<{ value?: MetricValue; unit?: string; disabled?: boolean; compact?: boolean; settings?: Record<string, unknown> }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const state = computed(() => props.disabled ? { key: 'disabled', tone: 'default' } : metricState(props.value))
const renderable = computed(() => !props.disabled && props.value?.status !== 'invalid' && props.value?.quality?.valid !== false)
const text = computed(() => renderable.value ? formatMetricValue(props.value?.value, props.settings) : '—')
const evaluated = computed(() => props.value && resultTime(props.value))
const time = (value: number) => new Date(value).toLocaleString()
const percentage = (value: number) => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }).format(value)
</script>
<style scoped>
.metric-value__main { display:flex; align-items:baseline; flex-wrap:wrap; gap:var(--space-2, 8px) }
.metric-value__main strong { font-size:var(--fs-20, 20px); font-weight:600; color:var(--ink-1); max-width:26rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.metric-value__main > span { color:var(--ink-3) }
.metric-value > .ant-tag { margin-top:var(--space-2,8px) }
.metric-value--compact .metric-value__main strong { font-size:var(--fs-24,24px) }
.metric-value__facts { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-4,16px); color:var(--ink-3); font-size:var(--fs-12,12px); margin-top:var(--space-1,4px) }
</style>
