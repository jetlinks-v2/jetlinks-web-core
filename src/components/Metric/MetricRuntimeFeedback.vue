<template>
  <div v-if="!disabled && (!compact || !hasValue || runtime?.state !== 'loaded')" class="metric-runtime">
    <div class="metric-runtime__state">
      <a-tag :color="runtime?.state === 'failed' ? 'error' : undefined">{{ t(stateKey) }}</a-tag>
      <small v-if="hasValue && runtime?.state !== 'loaded'">{{ t('lastResult') }}</small>
    </div>
    <div v-if="runtime && !compact" class="metric-runtime__facts">
      <span>{{ t('runtimeNode') }} {{ runtime.nodeId }}</span>
      <span v-if="runtime.lastSuccessTime != null">{{ t('runtimeLastSuccess') }} {{ time(runtime.lastSuccessTime) }}</span>
      <span v-if="runtime.lastFailureTime != null">{{ t('runtimeLastFailure') }} {{ time(runtime.lastFailureTime) }}</span>
      <span v-if="runtime.state === 'failed' && runtime.errorCode">{{ t('runtimeErrorCode') }} {{ runtime.errorCode }}</span>
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
// 装载状态单独呈现，不能覆盖已有结果的质量、数值或真实时间。
const stateKey = computed(() => props.runtime ? { pending: 'runtimePending', loaded: 'runtimeLoaded', failed: 'runtimeFailed' }[props.runtime.state] : 'runtimeUnknown')
const time = (value: number) => new Date(value).toLocaleString()
</script>
<style scoped>
.metric-runtime__state { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-1,4px); margin-top:var(--space-1,4px) }
.metric-runtime__state small, .metric-runtime__facts { color:var(--ink-3); font-size:var(--fs-12,12px) }
.metric-runtime__facts { display:flex; flex-wrap:wrap; gap:var(--space-1,4px) var(--space-4,16px); margin-top:var(--space-1,4px) }
</style>
