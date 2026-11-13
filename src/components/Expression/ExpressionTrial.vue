<template>
  <component :is="inline ? 'section' : 'details'" class="expression-trial" :class="{'is-inline':inline}" :aria-label="t('trial')">
    <summary v-if="!inline"><AIcon type="ExperimentOutlined" />{{ t('trial') }}</summary>
    <p v-if="!inline">{{ t('simulation') }}</p>
    <a-form layout="vertical" size="small" :title="t('simulation')">
      <a-form-item v-for="item in references" :key="item.id" :label="item.displayLabel || item.label">
        <a-tooltip v-if="numericType(item.schema?.type)" :title="item.description"><a-input-number :value="numberValue(values[item.id])" @update:value="values[item.id]=$event" string-mode :controls="false" :placeholder="t('empty')" :aria-label="item.label" /></a-tooltip>
        <a-select v-else-if="item.schema?.type === 'boolean'" :value="values[item.id] == null ? undefined : String(values[item.id])" @update:value="values[item.id]=$event == null ? null : $event === 'true'" allow-clear :options="[{label:'true',value:'true'},{label:'false',value:'false'}]" :placeholder="t('empty')" :aria-label="item.label" />
        <a-input v-else :value="values[item.id] == null ? '' : format(values[item.id])" @update:value="values[item.id]=$event" :placeholder="t('empty')" :aria-label="item.label" />
        <a-button v-if="values[item.id] != null" type="text" size="small" :title="t('clear')" :aria-label="t('clear')" @click="values[item.id]=null"><AIcon type="ClearOutlined" /></a-button>
      </a-form-item>
      <a-button v-if="!automatic" size="small" :type="inline ? 'text' : 'primary'" :loading="loading" :disabled="disabled" @click="run">{{ t('run') }}</a-button>
      <a-spin v-else-if="loading" size="small" />
    </a-form>
    <div v-if="inline && (error || result?.error)" class="expression-trial__failure" role="alert">
      <AIcon type="ExclamationCircleOutlined" /><span :title="error || result?.error || undefined">{{ t(error ? 'unavailable' : 'failed') }}</span>
      <a-button type="text" size="small" :disabled="disabled || loading" :title="t('retry')" :aria-label="t('retry')" @click="run"><AIcon type="ReloadOutlined" /></a-button>
    </div>
    <a-alert v-else-if="error" type="error" show-icon :message="t('unavailable')" :description="error" />
    <template v-if="result">
      <a-alert v-if="result.error && !inline" type="error" show-icon :message="t('failed')" :description="result.error" />
      <p v-if="!result.error">{{ t('result') }} <strong>{{ format(result.value) }}</strong></p>
      <ExpressionWorkspace v-if="!inline" v-slot="{substitute}" :node="modelValue.root" :context="context" :explanation="result.explanation" :format="reading">
        <MathExpressionView :node="modelValue.root" :context="context" :facts="substitute ? facts : undefined" />
      </ExpressionWorkspace>
      <details><summary>{{ t('process') }}</summary><ExpressionProcess :explanation="result.explanation" :context="context" /></details>
    </template>
  </component>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionExplanation } from './types'
import { useExpressionTrial,type ExpressionTrialProps } from './useExpressionTrial'
import { trialMessages } from './trialMessages'
import { explanationFacts } from './presentation'
import ExpressionProcess from './ExpressionProcess.vue'
import ExpressionWorkspace from './ExpressionWorkspace.vue'
import MathExpressionView from './MathExpressionView.vue'
const props=defineProps<ExpressionTrialProps>()
const {t}=useI18n({useScope:'local',messages:trialMessages})
const {values,result,loading,error,references,run}=useExpressionTrial(props)
const numericType=(type:unknown)=>['number','int','long','float','double','decimal','bigint'].includes(String(type))
const numberValue=(value:unknown)=>typeof value === 'string' || typeof value === 'number' ? value : undefined
const format=(value:unknown):string=>value == null ? 'null' : typeof value === 'object' ? JSON.stringify(value) : String(value)
const reading=(node:ExpressionExplanation)=>({text:format(node.value)})
const facts=computed(()=>result.value ? explanationFacts(props.modelValue.root,result.value.explanation,reading) : undefined)
</script>
<style scoped>
.expression-trial { min-width:0;margin-top:6px;font-size:12px }
.expression-trial summary { display:flex;align-items:center;gap:5px;cursor:pointer;color:var(--jet-theme-text-secondary,#8c8c8c) }
.expression-trial p { margin:6px 0;color:var(--jet-theme-text-secondary,#8c8c8c) }
.expression-trial :deep(.ant-form) { display:flex;flex-wrap:wrap;gap:6px 10px;align-items:flex-end;margin-bottom:8px }
.expression-trial :deep(.ant-form-item) { margin:0;flex:1;min-width:140px }
.expression-trial :deep(.ant-form-item-label) { padding:0 }
.expression-trial :deep(.ant-form-item-label label) { font-size:12px }
.expression-trial :deep(.ant-input-number) { width:calc(100% - 28px) }
.expression-trial :deep(.ant-alert) { margin-top:6px }
.expression-trial :deep(.ant-tree) { font-size:12px;background:transparent }
.expression-trial.is-inline { padding-top:4px }
.expression-trial.is-inline :deep(.ant-form-item) { flex:0 1 180px;min-width:120px }
.expression-trial.is-inline :deep(.ant-form) { margin-bottom:0 }
.expression-trial.is-inline :deep(.ant-form-item-label label) { color:var(--jet-theme-text-secondary,#8c8c8c);font-size:11px }
.expression-trial__failure { display:flex;align-items:center;gap:6px;margin-top:6px;color:var(--jet-theme-error,#ff4d4f);font-size:12px }
.expression-trial__failure > span { min-width:0 }
.expression-trial__failure :deep(.ant-btn) { height:24px;width:24px;padding:0;color:inherit }
</style>
