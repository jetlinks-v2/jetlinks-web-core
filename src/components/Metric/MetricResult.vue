<template>
  <div class="metric-result">
    <a-alert v-if="error" type="error" show-icon :message="t('readFailed')" :description="error">
      <template #action><a-button size="small" @click="refresh">{{ t('retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="inaccessible" type="warning" show-icon :message="t('noAccess')" />
    <a-spin v-else :spinning="loading">
      <MetricValueView v-if="current || configuration?.state === 'disabled' || runtime?.state === 'loaded'" :value="current" :unit="output?.unit" :disabled="configuration?.state === 'disabled'" :settings="settings" />
      <strong v-else>—</strong>
      <MetricRuntimeFeedback :runtime="runtime" :has-value="!!current" :disabled="configuration?.state === 'disabled'" />
      <a-alert v-if="missing || extensionFailed" type="warning" show-icon :message="t(missing ? 'presentationMissing' : 'presentationFailed')" />
      <div class="metric-result__tools">
        <a-radio-group v-model:value="range" size="small" @change="customRange = undefined">
          <a-radio-button :value="3600000">{{ t('hour') }}</a-radio-button>
          <a-radio-button :value="86400000">{{ t('day') }}</a-radio-button>
        </a-radio-group>
        <a-range-picker show-time :placeholder="[t('rangeStart'), t('rangeEnd')]" @change="setRange" />
        <a-button size="small" @click="refresh">{{ t('refresh') }}</a-button>
      </div>
      <MetricExtension v-if="provider?.detail && context && configuration && template && output" :content="provider.detail"
        :content-props="{ context, configuration, template, output, value: current, settings, values, loading, error }" @failed="extensionFailed = true">
        <template #fallback><MetricTrend :values="values" :unit="output.unit" /></template>
      </MetricExtension>
      <MetricTrend v-else :values="values" :unit="output?.unit" />
      <small v-if="values.length >= 200">{{ t('resultsLimit') }}</small>
    </a-spin>
  </div>
</template>
<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Dayjs } from 'dayjs'
import MetricValueView from './MetricValue.vue'
import MetricRuntimeFeedback from './MetricRuntimeFeedback.vue'
import MetricTrend from './MetricTrend.vue'
import { useMetricResult } from './useMetricResult'
import { metricMessages } from './messages'
import MetricExtension from './extensions/MetricExtension.vue'
import { useMetricPresentation } from './extensions/useMetricPresentation'
import type { MetricContext, MetricLatest, MetricReference, MetricTemplate, MetricTemplateOutput } from './types'
const props = defineProps<{ reference: MetricReference; latest?: MetricLatest; output?: MetricTemplateOutput; context?: MetricContext; template?: MetricTemplate }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { current, runtime, configuration, inaccessible, values, loading, error, range, customRange, refresh } = useMetricResult(toRef(props, 'reference'), undefined, toRef(props, 'latest'))
const { provider, missing, settings } = useMetricPresentation(toRef(props, 'template'), configuration)
const extensionFailed = ref(false)
watch(provider, () => { extensionFailed.value = false })
function setRange(dates: [Dayjs, Dayjs] | null) { customRange.value = dates ? [dates[0].valueOf(), dates[1].valueOf()] : undefined }
</script>
<style scoped>
.metric-result { display:grid; gap:var(--space-4,16px) }
.metric-result__tools { display:flex; align-items:center; gap:var(--space-2,8px); flex-wrap:wrap; margin:var(--space-4,16px) 0 }
.metric-result small { color:var(--ink-3) }
</style>

