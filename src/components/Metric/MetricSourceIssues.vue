<template>
  <details v-if="!disabled && (diagnostics.total || abnormal)" class="metric-source-issues" open>
    <summary>{{ t('issueDetails') }}<small v-if="diagnostics.total">{{ diagnostics.total }}</small></summary>
    <p>{{ t(abnormal ? 'issueBlocksResult' : 'issuePartialResult') }}</p>
    <ul v-if="diagnostics.issues.length"><li v-for="(issue,index) in diagnostics.issues" :key="`${issue.inputId}:${index}`">
      <div><strong>{{ metricIssueName(issue,template,t,value?.metricId) }}</strong><span>{{ metricIssueReason(issue.reason,t) }}</span></div>
      <small>{{ t(issue.required ? 'issueRequired' : 'issueOptional') }}<template v-if="mapping(issue)"> · {{ t(`issueKind_${mapping(issue)!.kind}`) }}</template><template v-if="issue.eventTime"> · {{ t('sourceTime') }} {{ time(issue.eventTime) }}</template></small>
      <p>{{ metricIssueNextStep(issue.reason,t) }}</p>
      <a-button v-if="editable && inputId(issue)" type="link" size="small" @click="emit('editSource',inputId(issue)!)">{{ t('issueCheckBinding') }}<AIcon type="RightOutlined" /></a-button>
    </li></ul>
    <p v-else>{{ t('issueNoDetails') }}</p>
    <small v-if="diagnostics.total > diagnostics.issues.length">{{ t('issueTruncated',{count:diagnostics.total - diagnostics.issues.length}) }}</small>
    <p v-if="!editable" class="metric-source-issues__hint">{{ t('issueReadOnlyHint') }}</p>
  </details>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from './messages'
import { metricInputDiagnostics, metricIssueInputId, metricIssueName, metricIssueReason, metricIssueNextStep, type MetricInputIssue } from './sourceDiagnostics'
import type { MetricConfig, MetricTemplate, MetricValue } from './types'
const props=defineProps<{value?:MetricValue;template?:MetricTemplate;configuration?:MetricConfig;editable?:boolean;disabled?:boolean}>()
const emit=defineEmits<{(event:'editSource',inputId:string):void}>()
const {t,locale}=useI18n({useScope:'local',messages:metricMessages})
const diagnostics=computed(()=>metricInputDiagnostics(props.value))
const abnormal=computed(()=>props.value?.status === 'invalid' || props.value?.quality?.valid === false)
const inputId=(issue:MetricInputIssue)=>metricIssueInputId(issue,props.template,props.value?.metricId)
const mapping=(issue:MetricInputIssue)=>{ const id=inputId(issue); return id ? props.configuration?.inputMappings[id] : undefined }
const time=(value:number)=>new Date(value).toLocaleString(String(locale.value))
</script>
<style scoped>
.metric-source-issues { border-radius:var(--r-2,6px); background:var(--bg-sunken); padding:10px 12px; font-size:var(--fs-12,12px); color:var(--ink-2) }
summary { display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--ink-1) }
summary::before { content:'›'; transition:transform .15s }
details[open]>summary::before { transform:rotate(90deg) }
small { color:var(--ink-3) }
p { margin:10px 0 0; line-height:1.6 }
ul { list-style:none; margin:8px 0 0; padding:0 }
li { position:relative; padding:8px 0; border-bottom:1px solid var(--line) }
li>div { display:flex; flex-wrap:wrap; gap:8px; padding-right:110px }
li strong { font-weight:500; color:var(--ink-1) }
li :deep(.ant-btn) { position:absolute; right:0; top:6px; padding-inline:0 }
.metric-source-issues__hint { color:var(--ink-3) }
</style>
