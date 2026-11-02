<template>
  <Echarts v-if="hasNumeric" :option="option" class="metric-trend" />
  <div v-else-if="values.length" class="metric-trend__history">
    <MetricValueView v-for="(value, index) in values" :key="value.resultId || index" :value="value" :unit="unit" />
  </div>
  <a-empty v-else :description="t('noHistory')" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Echarts from '../Echarts'
import MetricValueView from './MetricValue.vue'
import { metricChartPoints } from './presentation'
import { metricMessages } from './messages'
import type { MetricValue } from './types'
const props = defineProps<{ values: MetricValue[]; unit?: string }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const hasNumeric = computed(() => metricChartPoints(props.values).some(point => point[1] !== null))
const option = computed(() => ({
  grid: { left: 60, right: 24, top: 28, bottom: 38 },
  tooltip: { trigger: 'axis' as const, confine: true },
  xAxis: { type: 'time' as const },
  yAxis: { type: 'value' as const, name: props.unit || '', scale: true },
  series: [{ type: 'line' as const, showSymbol: false, connectNulls: false, data: metricChartPoints(props.values) }]
}))
</script>
<style scoped>
.metric-trend { height:280px; width:100% }
.metric-trend__history { display:grid; gap:var(--space-3,12px); max-height:320px; overflow:auto }
</style>

