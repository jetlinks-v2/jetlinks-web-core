<template>
  <div class="bean-semantic-metrics">
    <dl v-for="group in groups" :key="group.kind" class="bean-semantic-group" :class="`bean-semantic-group--${group.kind}`">
      <div v-for="metric in group.metrics" :key="metric.key" class="bean-semantic-metric" :data-format="metric.format">
        <dt class="bean-semantic-label">
          <span>{{ t(`runtimeDiagnostics.mbeanSummary.${metric.key}`, metric.key) }}</span>
          <a-tooltip v-if="te(`runtimeDiagnostics.mbeanSummary.${metric.key}Hint`)" :title="t(`runtimeDiagnostics.mbeanSummary.${metric.key}Hint`)" :trigger="['hover', 'focus']"><InfoCircleOutlined class="bean-semantic-info" tabindex="0" :aria-label="t(`runtimeDiagnostics.mbeanSummary.${metric.key}Hint`)" /></a-tooltip>
        </dt>
        <dd class="bean-semantic-value" :title="displayValue(metric)">
          {{ displayValue(metric) }}
          <a-progress v-if="metric.max && nonnegativeNumber(metric.value) !== undefined" :percent="Math.min(100, nonnegativeNumber(metric.value)! / metric.max * 100)" :show-info="false" size="small" />
        </dd>
      </div>
    </dl>
  </div>
</template>
<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { formatSemanticValue, groupMBeanSemanticMetrics, nonnegativeNumber, type MBeanSemanticMetric } from './semantic'
const props = defineProps({ metrics: { type: Array as PropType<MBeanSemanticMetric[]>, required: true } })
const { t, te, locale } = useI18n()
const groups = computed(() => groupMBeanSemanticMetrics(props.metrics))
function displayValue(metric: MBeanSemanticMetric) {
  if (metric.format === 'boolean' && typeof metric.value === 'boolean') {
    const label = metric.key === 'QpsReady' ? metric.value ? 'qpsReady' : 'qpsWaiting'
      : metric.key === 'Running' ? metric.value ? 'collecting' : 'idle' : undefined
    if (label) return t(`runtimeDiagnostics.mbeanSummary.${label}`)
  }
  return formatSemanticValue(metric.value, metric.format, locale.value)
}
</script>
<style scoped>
.bean-semantic-metrics { display:flex; flex-direction:column; gap:12px; margin-block:8px 16px; }
.bean-semantic-group { margin:0; min-width:0; }
.bean-semantic-group--primary { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,145px),1fr)); gap:12px 20px; }
.bean-semantic-metric { min-width:0; display:flex; flex-direction:column; gap:4px; }
.bean-semantic-label { color:var(--ink-3); font-size:var(--fs-caption,12px); display:flex; gap:6px; align-items:center; }
.bean-semantic-info { flex:none; font-size:14px; }
.bean-semantic-info:focus-visible { outline:2px solid var(--primary-color); outline-offset:2px; border-radius:50%; }
.bean-semantic-value { margin:0; color:var(--ink); font-size:16px; font-weight:600; font-variant-numeric:tabular-nums; overflow-wrap:break-word; }
.bean-semantic-group--secondary { display:flex; flex-wrap:wrap; gap:8px 24px; }
.bean-semantic-group--secondary .bean-semantic-metric { flex-direction:row; flex-wrap:wrap; align-items:baseline; gap:4px 8px; max-width:100%; }
.bean-semantic-group--secondary .bean-semantic-value { font-size:14px; font-weight:400; }
.bean-semantic-metric[data-format="timestamp"] .bean-semantic-value { overflow-wrap:normal; word-break:normal; }
.bean-semantic-metric :deep(.ant-progress) { margin:0; line-height:1; }
</style>
