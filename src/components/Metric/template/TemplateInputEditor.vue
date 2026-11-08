<template>
  <div class="input-editor">
    <section class="input-editor__reading">
      <div class="input-editor__sentence">
        <AIcon type="DatabaseOutlined" /><span>{{ t('inputRead') }}</span>
        <Editable class="input-editor__mode" type="select" :value="input.source?.lookback ? 'history' : 'latest'" :component-props="{ disabled, bordered:false, defaultOpen:true, dropdownMatchSelectWidth:false, 'aria-label':t('readMode'), options:readModes }" @change="setReadMode($event as string)" />
      </div>
      <div v-if="input.source?.lookback" class="input-editor__sentence input-editor__continuation">
        <span>{{ t('inputLookback') }}</span><TemplateDuration :model-value="input.source.lookback" :disabled="disabled" @update:model-value="sourceField('lookback', $event)" />
      </div>
      <div class="input-editor__sentence input-editor__continuation input-editor__muted">
        <span>{{ t('inputUnit') }}</span><Editable class="input-editor__unit" :value="input.unit" :component-props="{ disabled:disabled || published, bordered:false, placeholder:t('noUnit'), 'aria-label':t('unit') }" @change="emit('patch', { unit:$event })" />
      </div>
    </section>
    <section v-if="consumers.length" class="input-editor__execution" :aria-label="t('calculationTrigger')">
      <h4><AIcon type="ThunderboltOutlined" />{{ t('calculationTrigger') }}</h4>
      <p>{{ t('inputTriggerHint') }}</p>
      <div v-for="consumer in consumers" :key="consumer.id" class="input-editor__consumer">
        <TemplateReference :metric-id="consumer.id" locatable>{{ consumer.name }}</TemplateReference>
        <span>{{ consumer.timing }}</span>
      </div>
    </section>
    <section class="input-editor__requirements">
      <div class="input-editor__sentence">
        <AIcon type="ClockCircleOutlined" /><span>{{ t('maxAge') }}</span><TemplateDuration :model-value="input.maxAge" :empty-label="t('unlimited')" :disabled="disabled" @update:model-value="emit('patch', { maxAge:$event })" />
      </div>
      <div class="input-editor__sentence">
        <AIcon type="SafetyOutlined" /><span>{{ t('inputPresence') }}</span>
        <Editable class="input-editor__presence" type="select" :value="input.presence || 'required'" :component-props="{ disabled:disabled || published, bordered:false, defaultOpen:true, dropdownMatchSelectWidth:false, 'aria-label':t('inputPresence'), options:presenceOptions }" @change="emit('patch', { presence:$event })" />
      </div>
      <div v-if="input.presence === 'defaultValue'" class="input-editor__sentence input-editor__continuation">
        <span>{{ t('defaultValue') }}</span><span class="input-editor__default"><MetricParameterValue inline :disabled="disabled" :parameter="defaultParameter" :model-value="input.defaultValue" @update:model-value="emit('patch', { defaultValue:$event })" /></span>
      </div>
    </section>
    <details v-if="input.source?.lookback" class="input-editor__advanced"><summary>{{ t('moreSettings') }}</summary>
      <div class="input-editor__sentence"><AIcon type="DotChartOutlined" /><span>{{ t('minSamples') }}</span><Editable class="input-editor__amount" type="number" :value="input.minSamples" :component-props="{ disabled, min:1, controls:false, bordered:false, 'aria-label':t('minSamples') }" @change="emit('patch', { minSamples:$event ?? undefined })" /></div>
      <div class="input-editor__sentence"><AIcon type="DatabaseOutlined" /><span>{{ t('maxPoints') }}</span><Editable class="input-editor__amount" type="number" :value="input.source.maxPoints" :component-props="{ disabled, min:1, controls:false, bordered:false, 'aria-label':t('maxPoints') }" @change="sourceField('maxPoints', $event ?? undefined)" /></div>
      <div class="input-editor__sentence"><AIcon type="DisconnectOutlined" /><span>{{ t('maxGap') }}</span><TemplateDuration :model-value="input.maxGap" :empty-label="t('unlimited')" :disabled="disabled" @update:model-value="emit('patch', { maxGap:$event })" /></div>
    </details>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Editable from '../../Editable/index.vue'
import MetricParameterValue from '../MetricParameterValue.vue'
import TemplateDuration from './TemplateDuration.vue'
import TemplateReference from './TemplateReference.vue'
import { ruleDependencies, type TemplateRule } from './designer'
import { ruleTriggerSummary } from './graphPresentation'
import { metricMessages } from '../messages'
import type { MetricTemplate, MetricTemplateInput } from '../types'
const props = defineProps<{ input: MetricTemplateInput; template?:MetricTemplate; disabled?: boolean; published?: boolean }>()
const emit = defineEmits<{ (event:'patch', fields:Record<string, unknown>):void }>()
const { t } = useI18n({ useScope:'local', messages:metricMessages })
const consumers=computed(()=>(props.template?.definitions || []).flatMap(item=>{
  const rule=item as TemplateRule
  return ruleDependencies(rule).includes(props.input.id) ? [{id:rule.id || '',name:rule.name || rule.id || '',timing:ruleTriggerSummary(rule,t)}] : []
}))
const readModes = computed(() => [{ value:'latest', label:t('latestReading'), icon:'ThunderboltOutlined', description:t('latestReadingHint') }, { value:'history', label:t('historySeries'), icon:'HistoryOutlined', description:t('historySeriesHint') }])
const presenceOptions = computed(() => [{value:'required',label:t('inputRequired'),icon:'SafetyOutlined',description:t('inputRequiredHint')},{value:'optional',label:t('inputOptional'),icon:'MinusCircleOutlined',description:t('inputOptionalHint')},{value:'defaultValue',label:t('inputDefault'),icon:'RollbackOutlined',description:t('inputDefaultHint')}])
const defaultParameter = computed(() => ({ ...props.input, valueType:{ ...props.input.valueType, type:String(props.input.valueType?.type || 'double') } }))
function sourceField(field:string, value:unknown) { if (!props.disabled) emit('patch', { source:{ ...props.input.source, [field]:value } }) }
function setReadMode(mode:string) {
  if (props.disabled) return
  if (mode === 'history') sourceField('lookback', 'PT1H')
  // 单值不携带已隐藏的序列约束；来源扩展和其他输入要求保留。
  else emit('patch', { source:{ ...props.input.source, lookback:undefined, maxPoints:undefined }, minSamples:undefined, maxGap:undefined })
}
</script>
<style scoped>
.input-editor { min-width:0; font-size:13px; line-height:1.8 }
.input-editor__reading { padding-bottom:12px; border-bottom:1px solid var(--line) }
.input-editor__sentence { display:flex; align-items:center; flex-wrap:wrap; gap:4px 8px; min-height:40px; min-width:0 }
.input-editor__sentence > .anticon { flex:none; width:16px; color:var(--ink-3) }
.input-editor__sentence > span:not(.editable-field):not(.template-duration) { flex:none }
.input-editor__continuation { padding-left:24px }
.input-editor__muted { color:var(--ink-3) }
.input-editor__mode { width:104px; color:var(--accent) }
.input-editor__presence { width:120px; color:var(--accent) }
.input-editor__unit,.input-editor__amount { width:96px; color:var(--accent) }
.input-editor__default { width:128px; max-width:100% }
.input-editor__requirements { padding:12px 0 }
.input-editor__execution { padding:12px 0; border-bottom:1px solid var(--line) }
.input-editor__execution h4 { display:flex; align-items:center; gap:8px; margin:0; font-size:13px; font-weight:500 }
.input-editor__execution h4 > .anticon { width:16px; color:var(--ink-3) }
.input-editor__execution p { margin:4px 0 8px 24px; color:var(--ink-3); font-size:12px; line-height:1.6 }
.input-editor__consumer { display:flex; align-items:baseline; gap:12px; padding:4px 0 4px 24px; font-size:12px }
.input-editor__consumer > :first-child { flex:1; min-width:0; overflow-wrap:anywhere }
.input-editor__consumer > span { flex:0 1 50%; color:var(--ink-2); text-align:right }
.input-editor__advanced { border-top:1px solid var(--line) }
.input-editor__advanced > summary { padding:12px 0; font-size:12px; color:var(--ink-3); cursor:pointer }
.input-editor :deep(.ant-input-number) { width:128px; max-width:100% }
</style>
