<template>
  <div class="template-simulation">
    <div class="template-simulation__tools">
      <small>{{ t('flowEditHint') }}</small>
      <a-popover v-if="facts" trigger="click" placement="bottom">
        <template #content>
          <a-input type="datetime-local" :value="sampleDate(typeof facts.endAt === 'number' ? facts.endAt : undefined)" :disabled="loading" :aria-label="t('observeUntil')" step="1" @change="changeEndAt($event.target.value)" />
          <a-button v-if="facts.endAt !== undefined" type="link" size="small" :disabled="loading" @click="changeEndAt('')">{{ t('observeToLastSample') }}</a-button>
        </template>
        <a-button type="text" size="small" :disabled="loading" :danger="endAtInvalid"><AIcon type="ClockCircleOutlined" />{{ t('observeUntil') }}<template v-if="typeof facts.endAt === 'number'"> · {{ sampleDate(facts.endAt) }}</template></a-button>
      </a-popover>
      <a-button type="text" size="small" :disabled="loading || sampleInvalid || advanced && !facts" :aria-pressed="advanced" @click="advanced = !advanced">{{ t(advanced ? 'returnToDiagram' : 'advancedSamples') }}</a-button>
    </div>
    <section v-if="advanced" class="template-simulation__advanced">
      <div><slot name="advancedTools" /></div>
      <small v-if="!facts">{{ t('sampleTextOnly') }}</small>
      <MonacoEditor :key="format" :model-value="text" :language="format" :read-only="loading" theme="vs" :options="editorOptions" class="template-simulation__code" @update:model-value="emit('update:text', $event)" />
    </section>
    <TemplateSimulationFlow :template="template" :facts="facts" :advanced="advanced" :results="results" :response="response" :loading="loading" @change="updateFacts" @invalid="setSampleInvalid" />
    <div class="template-simulation__action"><a-button type="primary" :loading="loading" :disabled="sampleInvalid || endAtInvalid || !advanced && !facts?.samples.length" @click="emit('simulate')">{{ t('simulate') }}</a-button><small v-if="sampleInvalid || endAtInvalid">{{ t('completeSample') }}</small></div>
    <a-alert v-if="response?.status === 'failed' && results.length" type="warning" :message="t('partialSimulation')" show-icon />
    <a-alert v-if="response?.recordsTruncated" type="info" :message="t('recordsTruncated')" show-icon />
    <a-alert v-if="error" type="error" :message="error" show-icon />
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import MonacoEditor from '../../MonacoEditor/monacoEditor.vue'
import TemplateSimulationFlow from './TemplateSimulationFlow.vue'
import { configurationObject, encodeConfiguration } from './configurationText'
import { sampleDate, visualSamples, type SimulationFacts } from './simulation'
import { metricMessages } from '../messages'
import type { ConfigurationFormat } from './configurationText'
import type { MetricTemplate, MetricValue, MetricSimulationResponse } from '../types'
const props = defineProps<{ template: MetricTemplate; text: string; format: ConfigurationFormat; results: MetricValue[]; response?: MetricSimulationResponse; loading: boolean; error: string }>()
const emit = defineEmits<{ (event: 'update:text', value: string): void; (event: 'simulate'): void; (event: 'invalid'): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const sampleInvalid = ref(false)
const endAtInvalid = ref(false)
const facts = computed(() => {
  try { const value = configurationObject(props.text, props.format); return visualSamples(props.template, value) ? value : undefined }
  catch { return undefined }
})
const advanced = ref(!facts.value)
function updateFacts(value: SimulationFacts) { emit('update:text', encodeConfiguration(value, props.format)) }
function setSampleInvalid(value: boolean) { sampleInvalid.value = value; if (value) emit('invalid') }
/** 时间入口只改观察截止点；未知字段和高级样本原样保留，时间先后由后端统一校验。 */
function changeEndAt(text: string) {
  if (!facts.value || props.loading) return
  const time = text ? new Date(text).getTime() : undefined
  endAtInvalid.value = time !== undefined && !Number.isFinite(time)
  if (endAtInvalid.value) { emit('invalid'); return }
  const next = { ...facts.value }
  if (time === undefined) delete next.endAt
  else next.endAt = time
  updateFacts(next)
}
const editorOptions = { minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true }
</script>
<style scoped>
.template-simulation { display:grid; gap:var(--space-3,12px); min-width:0 }
.template-simulation__tools { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap }
.template-simulation small { color:var(--ink-3) }
.template-simulation__advanced { min-width:0; display:grid; gap:8px }
.template-simulation__code { height:280px }
.template-simulation__action { display:flex; gap:12px; align-items:center }
</style>
