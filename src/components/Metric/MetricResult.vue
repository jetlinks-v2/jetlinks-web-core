<template>
  <div class="metric-result">
    <a-alert v-if="error" type="error" show-icon :message="t('readFailed')" :description="error">
      <template #action><a-button size="small" @click="refresh">{{ t('retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="inaccessible" type="warning" show-icon :message="t('noAccess')" />
    <div v-else>
      <div class="metric-result__summary">
        <MetricStateDuration v-if="intervals" detail :labels="labels" :value="current" :disabled="configuration?.state === 'disabled'"><template #label><MetricOutputSwitch :template="template" :output="output" :output-id="reference.outputId" @change="emit('selectOutput',$event)" /></template></MetricStateDuration>
        <template v-else><div class="metric-result__reading"><MetricOutputSwitch :template="template" :output="output" :output-id="reference.outputId" @change="emit('selectOutput',$event)" /><MetricValueView v-if="current || configuration?.state === 'disabled' || runtime?.state === 'loaded'" summary :hide-quality="current?.quality?.valid === true" :value="current" :template="template" :output="output" :unit="output?.unit" :disabled="configuration?.state === 'disabled'" :settings="settings" :labels="labels" /><strong v-else>—</strong></div><small v-if="summaryTime" class="metric-result__stamp" :title="t('updatedAtHint')">{{ t('updatedAt') }} <time>{{ time(summaryTime) }}</time></small></template>
      </div>
      <MetricSourceIssues :value="current" :template="template" :configuration="configuration" :disabled="configuration?.state === 'disabled'" :editable="canEdit" @edit-source="emit('editSource',$event)" />
      <a-alert v-if="missing || extensionFailed" type="warning" show-icon :message="t(missing ? 'presentationMissing' : 'presentationFailed')" />
      <a-tabs v-model:active-key="tab" size="small">
        <a-tab-pane key="result" :tab="t('historyChanges')" /><a-tab-pane v-if="configuration && template && output" key="source" :tab="t('sourcesAndCalculation')" />
      </a-tabs>
      <template v-if="tab === 'result'">
      <a-spin :spinning="loading">
      <template v-if="provider?.detail && context && configuration && template && output">
      <div class="metric-result__tools"><MetricTimeRange v-model:range="range" v-model:custom-range="customRange" /><a-button type="text" size="small" :aria-label="t('refresh')" @click="refresh"><AIcon type="ReloadOutlined" />{{ t('refresh') }}</a-button></div>
      <MetricExtension :content="provider.detail"
        :content-props="{ context, configuration, template, output, value: current, settings, values, loading, error }" @failed="extensionFailed = true">
        <template #fallback><component :is="intervals ? MetricStateHistory : MetricTrend" :key="historyQueryKey" v-bind="intervals ? {} : { output,stateOutput,unit:output.unit }" :values="values" :current="current" :labels="labels" :bounds="bounds" :limited="limited" :unavailable="!!error || loading" /></template>
      </MetricExtension>
      </template>
      <component :is="intervals ? MetricStateHistory : MetricTrend" v-else :key="historyQueryKey" v-bind="intervals ? {} : { output,stateOutput,unit:output?.unit }" :values="values" :current="current" :bounds="bounds" :limited="limited" :labels="labels" :unavailable="!!error || loading"><template #tools><MetricTimeRange v-model:range="range" v-model:custom-range="customRange" /><a-button type="text" size="small" :aria-label="t('refresh')" :title="t('refresh')" @click="refresh"><AIcon type="ReloadOutlined" />{{ t('refresh') }}</a-button></template></component>
      </a-spin>
      <details v-if="current && !intervals && !recordHistory" class="metric-result__facts"><summary>{{ t('dataDetails') }}</summary><MetricValueView :value="current" :output="output" :unit="output?.unit" :settings="settings" :labels="labels" /></details>
      <details class="metric-result__facts"><summary>{{ t('runtimeDiagnostics') }}</summary><MetricRuntimeFeedback :runtime="runtime" :has-value="!!current" :disabled="configuration?.state === 'disabled'" /></details>
      </template>
      <MetricLineage v-else-if="configuration && template && output" :configuration="configuration" :template="template" :output="output" :context="context" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, inject, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricValueView from './MetricValue.vue'
import MetricOutputSwitch from './MetricOutputSwitch.vue'
import MetricRuntimeFeedback from './MetricRuntimeFeedback.vue'
import MetricSourceIssues from './MetricSourceIssues.vue'
import MetricTrend from './MetricTrend.vue'
import MetricStateDuration from './MetricStateDuration.vue'
import MetricStateHistory from './MetricStateHistory.vue'
import { stateLabels } from './stateIntervals'
import { metricOutputPresentation } from './outputPresentation'
import MetricTimeRange from './MetricTimeRange.vue'
import MetricLineage from './MetricLineage.vue'
import { metricHistoryKey } from './useMetricTrends'
import { useMetricResult } from './useMetricResult'
import { metricMessages } from './messages'
import { resultTime } from './presentation'
import { useHistoryKind } from './history/useHistoryTimeline'
import MetricExtension from './extensions/MetricExtension.vue'
import { useMetricPresentation } from './extensions/useMetricPresentation'
import type { MetricContext, MetricLatest, MetricReference, MetricTemplate, MetricTemplateOutput } from './types'
const props = defineProps<{ reference: MetricReference; latest?: MetricLatest; output?: MetricTemplateOutput; context?: MetricContext; template?: MetricTemplate }>()
const emit = defineEmits<{ (event: 'selectOutput', id: string): void; (event:'editSource',inputId:string):void }>()
const { t, locale } = useI18n({ useScope: 'local', messages: metricMessages })
const labels = computed(() => props.output ? stateLabels(props.template, props.output.metricId) : [])
const presentation = computed(() => metricOutputPresentation(props.output,{template:props.template}))
const intervals = computed(() => presentation.value.history === 'interval')
const { current, runtime, configuration, inaccessible, values, loading, error, range, customRange, refresh, bounds, limited } = useMetricResult(toRef(props, 'reference'), undefined, toRef(props, 'latest'), inject(metricHistoryKey, undefined), intervals)
const canEdit = computed(()=>!!props.context?.editable && configuration.value?.ownerType === props.context.ownerType && configuration.value?.ownerId === props.context.ownerId)
const historyScope = computed(() => JSON.stringify([props.reference.configId, props.reference.outputId, props.reference.targetType, props.reference.targetId]))
// Query intent resets interactions; rolling response bounds and latest samples do not.
const historyQueryKey = computed(() => JSON.stringify([historyScope.value,range.value,customRange.value]))
const historyKind = useHistoryKind(values, current, historyScope)
const stateOutput = computed(() => presentation.value.history === 'state' || intervals.value)
const recordHistory = computed(() => stateOutput.value || presentation.value.history === 'boolean' || historyKind.value === 'boolean')
const summaryTime = computed(() => current.value && (intervals.value ? current.value.state?.readView?.time ?? resultTime(current.value) : resultTime(current.value)))
const time = (value:number) => new Date(value).toLocaleString(String(locale.value), { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
const { provider, missing, settings } = useMetricPresentation(toRef(props, 'template'), configuration)
const extensionFailed = ref(false)
const tab = ref('result')
watch(provider, () => { extensionFailed.value = false })
</script>
<style scoped>
.metric-result { display:grid; gap:var(--space-4,16px) }
.metric-result__tools { display:flex; align-items:center; gap:var(--space-2,8px); flex-wrap:wrap; margin:var(--space-4,16px) 0 }
.metric-result small { color:var(--ink-2) }
.metric-result__summary { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin:0 0 16px }
.metric-result__reading { display:flex; align-items:center; flex-wrap:wrap; gap:8px 20px; min-width:0 }
.metric-result__reading :deep(.metric-value--summary .metric-value__main strong) { font-size:var(--fs-24,24px); letter-spacing:0 }
.metric-result__summary > small { font-size:var(--fs-12,12px); line-height:1.7; color:var(--ink-3) }
.metric-result__stamp time { font-variant-numeric:tabular-nums; white-space:nowrap }
.metric-result__tools { justify-content:space-between }
.metric-result__facts { margin-top:12px; padding-top:10px; border-top:1px solid var(--line) }
.metric-result__facts summary { font-size:var(--fs-12,12px); color:var(--ink-2); cursor:pointer; margin-bottom:12px }
</style>
