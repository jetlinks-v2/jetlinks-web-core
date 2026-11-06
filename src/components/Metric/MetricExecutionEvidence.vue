<template>
  <section class="metric-evidence">
    <header><h4>{{ t('evidenceUsedData') }}</h4><time v-if="value?.evaluationTime">{{ t('evidenceComputedAt') }} {{ time(value.evaluationTime) }}</time></header>
    <p v-if="!value?.evidence?.execution" class="metric-evidence__notice">{{ t('evidenceNotRecorded') }}</p>
    <p v-else-if="value.evidence.execution.truncated" class="metric-evidence__notice">{{ t('evidenceTruncated') }}</p>
    <div v-for="group in inputs" :key="group.id" class="metric-evidence__input">
      <div class="metric-evidence__identity"><strong><AIcon type="DatabaseOutlined" />{{ group.name }}</strong>
        <small v-if="group.input && group.input.count > 0">{{ t('evidenceSamples',{ count:group.input.count }) }}<template v-if="group.input.inputTimeEnd > 0"> · {{ time(group.input.inputTimeStart || group.input.inputTimeEnd) }}<template v-if="group.input.inputTimeStart && group.input.inputTimeStart !== group.input.inputTimeEnd"> — {{ time(group.input.inputTimeEnd) }}</template></template></small>
      </div>
      <div v-for="(item,index) in group.values" :key="`${item.path}:${index}`" class="metric-evidence__value">
        <span>{{ reading(item,group.metricId).label || t('evidenceValue') }}<small v-if="item.state === 'defaulted'"> · {{ t('evidenceInput_defaulted') }}</small></span><b>{{ reading(item,group.metricId).text }}</b>
      </div>
      <small v-if="!group.values.length">{{ t('evidenceValuesMissing') }}</small>
    </div>
    <div v-if="parameters.length" class="metric-evidence__parameters">
      <h4>{{ t('evidenceParameters') }}</h4>
      <div v-for="group in parameters" :key="group.id"><div v-for="(item,index) in group.values" :key="index" class="metric-evidence__value"><span>{{ group.name }}<template v-if="reading(item,group.metricId).label"> / {{ reading(item,group.metricId).label }}</template></span><b>{{ reading(item,group.metricId).text }}</b></div></div>
    </div>
    <div v-if="facts.length" class="metric-evidence__facts"><h4>{{ t('evidenceAlgorithmFacts') }}</h4><p v-for="(fact,index) in facts" :key="index">{{ fact.text }}<template v-if="fact.amount != null"> · {{ fact.amount }}</template></p></div>
    <details v-if="value?.evidence?.contributions?.length || value?.evidence?.uncertainty" class="metric-evidence__extra"><summary>{{ t('evidenceAlgorithmDetails') }}</summary>
      <div v-for="(item,index) in value.evidence.contributions || []" :key="index" class="metric-evidence__value"><span>{{ inputs.find(group=>group.id === item.inputId)?.name || item.inputId }}</span><b>{{ item.amount }}</b></div>
      <p v-if="value.evidence.uncertainty">{{ t('evidenceInterval') }} {{ value.evidence.uncertainty.lower }} – {{ value.evidence.uncertainty.upper }} · {{ value.evidence.uncertainty.method }}</p>
    </details>
    <small class="metric-evidence__hint">{{ t('evidenceSnapshotHint') }}</small>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from './messages'
import { localizedTemplate } from './template/text'
import { evidenceGroups, evidenceValue } from './evidence'
import type { MetricSnapshotValue, MetricTemplate, MetricTemplateOutput, MetricValue } from './types'
const props = defineProps<{ value?:MetricValue; template:MetricTemplate; output:MetricTemplateOutput }>()
const { t,locale } = useI18n({ useScope:'local',messages:metricMessages })
const template = computed(()=>localizedTemplate(props.template,String(locale.value)))
const inputs = computed(()=>evidenceGroups(props.value?.evidence,template.value,'input',props.output.metricId))
const parameters = computed(()=>[...evidenceGroups(props.value?.evidence,template.value,'parameter',props.output.metricId),
  ...evidenceGroups(props.value?.evidence,template.value,'calculatorParameter',props.output.metricId).map(group=>({...group,id:`calculator:${group.id}`,name:t('evidenceCalculatorParameter',{name:group.name})}))])
const facts = computed(()=>props.value?.evidence?.facts?.filter(item=>item.text) || [])
const reading = (value:MetricSnapshotValue, id:string)=>evidenceValue(value,id,template.value,String(locale.value),t)
const time = (value:number)=>new Date(value).toLocaleString(String(locale.value),{ month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit' })
</script>
<style scoped>
.metric-evidence { display:grid; gap:12px; min-width:0 }
.metric-evidence header { display:flex; align-items:baseline; justify-content:space-between; flex-wrap:wrap; gap:6px 12px }
.metric-evidence h4 { font-size:14px; font-weight:500; color:var(--ink-1); margin:0 }
.metric-evidence time,.metric-evidence small { font-size:12px; color:var(--ink-3); font-weight:400 }
.metric-evidence__notice { padding:10px 12px; margin:0; border-radius:6px; background:var(--bg-sunken); color:var(--ink-2); font-size:12px; line-height:1.7 }
.metric-evidence__input { padding:12px; border:1px solid var(--line); border-radius:8px; min-width:0 }
.metric-evidence__identity { display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 12px; margin-bottom:8px }
.metric-evidence__identity strong { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:500; color:var(--ink-2) }
.metric-evidence__identity .anticon { color:var(--ink-3); font-size:12px }
.metric-evidence__value { display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:4px 0; font-size:13px; min-width:0 }
.metric-evidence__value > span { color:var(--ink-2); overflow-wrap:anywhere }
.metric-evidence__value > b { color:var(--ink-1); font-weight:500; text-align:right; overflow-wrap:anywhere; font-variant-numeric:tabular-nums }
.metric-evidence__parameters { border-top:1px solid var(--line); padding-top:12px }
.metric-evidence__parameters h4,.metric-evidence__facts h4 { font-size:12px; margin-bottom:6px; color:var(--ink-2) }
.metric-evidence__facts p,.metric-evidence__extra { font-size:12px; color:var(--ink-2); line-height:1.7; margin:0 }
.metric-evidence__extra summary { cursor:pointer }
.metric-evidence__hint { line-height:1.7 }
</style>
