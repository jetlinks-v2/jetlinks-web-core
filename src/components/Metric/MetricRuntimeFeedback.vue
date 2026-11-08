<template>
  <div v-if="!disabled && (!compact || !hasValue || runtime?.state !== 'loaded')" class="metric-runtime">
    <div class="metric-runtime__state">
      <a-tag :color="runtime?.state === 'failed' ? 'error' : runtime?.state === 'degraded' ? 'warning' : undefined">{{ t(stateKey) }}</a-tag>
      <small v-if="runtime?.replicas != null && !compact">{{ t(runtime.complete === false ? 'runtimeReplicasKnown' : 'runtimeReplicas', { count: runtime.replicas }) }}</small>
      <small v-if="hasValue && runtime?.state !== 'loaded'">{{ t('lastResult') }}</small>
    </div>
    <div v-if="runtime && !compact" class="metric-runtime__facts">
      <span v-if="runtime.lastCalculationTime != null">{{ t('runtimeLastCalculation') }} {{ time(runtime.lastCalculationTime) }}</span>
      <span v-if="runtime.lastCalculationFailureTime != null">{{ t('runtimeLastCalculationFailure') }} {{ time(runtime.lastCalculationFailureTime) }}</span>
      <span v-if="runtime.complete === false">{{ t('runtimeIncomplete') }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from './messages'
import type { MetricRuntime } from './types'
const props = defineProps<{ runtime?: MetricRuntime; disabled?: boolean; compact?: boolean; hasValue?: boolean }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
// 就绪和执行事实独立于结果质量；未执行过不显示为计算成功。
const stateKey = computed(() => props.runtime ? { pending: 'runtimePending', loaded: 'runtimeLoaded', failed: 'runtimeFailed', degraded: 'runtimeDegraded', unknown: 'runtimeUnknown' }[props.runtime.state] : 'runtimeUnknown')
const time = (value: number) => new Date(value).toLocaleString()
</script>
<style scoped>
.metric-runtime__state { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-1,4px); margin-top:var(--space-1,4px) }
.metric-runtime__state small, .metric-runtime__facts { color:var(--ink-3); font-size:var(--fs-12,12px) }
.metric-runtime__facts { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-4,16px); margin-top:var(--space-1,4px) }
</style>
