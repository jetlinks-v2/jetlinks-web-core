<template>
  <section class="state-tracking">
    <div class="state-tracking__sentence"><AIcon type="HistoryOutlined" /><span>{{ t('intervalTrackSentence') }}</span><a-switch size="small" :checked="!!rule.stateTracking" :disabled="disabled" :aria-label="t('intervalTrackSentence')" @change="toggle(!!$event)" /></div>
    <template v-if="rule.stateTracking">
      <div class="state-tracking__sentence"><span>{{ t('stateSampleNoDataFor') }}</span><TemplateDuration :model-value="rule.stateTracking.maxNoData" :disabled="disabled" @update:model-value="emit('patch', { stateTracking: { maxNoData: $event || 'PT20M' } })" /><span>{{ t('sentenceInterrupted') }}{{ t('sentenceEnd') }}</span></div>
      <div class="state-tracking__labels">
        <div v-for="(item,index) in labels" :key="index" class="state-tracking__label">
          <a-popover v-if="!disabled" trigger="click" placement="leftTop" :overlay-style="{ maxWidth:'calc(100vw - 32px)' }"><template #content><div class="state-tracking__appearance"><IconValueEditor :model-value="item.icon" :preview-fallback="stateLabel(item.value,labels,String(locale))" :preview-size="28" @update:model-value="setLabel(index,{ ...item,icon:$event })" /></div></template><button type="button" class="state-tracking__icon" :aria-label="t('stateAppearanceFor',{ name:stateLabel(item.value,labels,String(locale)) })"><IconValueView :value="item.icon" :size="24" :fallback-text="stateLabel(item.value,labels,String(locale))" /></button></a-popover>
          <IconValueView v-else :value="item.icon" :size="24" :fallback-text="stateLabel(item.value,labels,String(locale))" />
          <Editable :value="typeof item.value === 'string' ? JSON.stringify(item.value) : String(item.value)" :component-props="{ disabled, bordered:false, 'aria-label':`${t('stateCode')}: ${String(item.value)}` }" @change="setCode(index, String($event))" /><span>→</span>
          <I18nTextEditable :value="item.name" field="name" :label="t('stateName')" :i18n-messages="{ name:item.nameI18n || {} }" :disabled="disabled" @change="setLabel(index, { ...item, name:$event.value, nameI18n:$event.i18nMessages.name })" />
          <a-button v-if="!disabled" type="text" size="small" :aria-label="t('removeState', { name:stateLabel(item.value, labels, String(locale)) })" @click="saveLabels(labels.filter((_, i) => i !== index))"><AIcon type="CloseOutlined" /></a-button>
        </div>
        <a-button v-if="!disabled" type="text" size="small" @click="saveLabels([...labels, { value:`state${labels.length + 1}`, name:'' }])"><AIcon type="PlusOutlined" />{{ t('addState') }}</a-button>
      </div>
      <small>{{ t('stateTrackingHint') }}</small>
      <small>{{ t('stateChangeValidityHint') }}</small>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Editable from '../../Editable/index.vue'
import I18nTextEditable from '../../I18n/I18nTextEditable.vue'
import TemplateDuration from './TemplateDuration.vue'
import { ruleDependencies, type TemplateRule } from './designer'
import type { MetricStateLabel } from '../types'
import { metricMessages } from '../messages'
import { stateLabel } from '../stateIntervals'
import IconValueEditor from '../../IconValue/IconValueEditor.vue'
import IconValueView from '../../IconValue/IconValueView.vue'
const props = defineProps<{ rule:TemplateRule; disabled?:boolean }>()
const emit = defineEmits<{ (event:'patch', fields:Partial<TemplateRule>):void }>()
const { t, locale } = useI18n({ useScope:'local', messages:metricMessages })
const options = computed(() => (props.rule.options || {}) as Record<string, unknown>)
const labels = computed(() => (options.value.stateLabels || []) as MetricStateLabel[])
function toggle(enabled:boolean) {
  if (props.disabled) return
  emit('patch', { stateTracking:enabled ? { maxNoData:'PT20M' } : undefined,
    ...(enabled && !props.rule.inputs?.length ? { inputs:ruleDependencies(props.rule).map(id => ({ id, metricId:id })) } : {}) })
}
function saveLabels(values:MetricStateLabel[]) { if (!props.disabled) emit('patch', { options:{ ...options.value, stateLabels:values } }) }
function setLabel(index:number, value:MetricStateLabel) { saveLabels(labels.value.map((item,i) => i === index ? value : item)) }
function setCode(index:number, text:string) {
  let value:string | number | boolean = text
  try {
    const parsed:unknown = JSON.parse(text)
    if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') value = parsed
  } catch {
    // Bare identifiers are convenient string states; quoted numeric strings retain their type.
  }
  setLabel(index, { ...labels.value[index]!, value })
}
</script>
<style scoped>
.state-tracking { display:grid; gap:10px; padding:14px 0; border-top:1px solid var(--line); margin-top:14px }
.state-tracking__sentence { display:flex; align-items:center; flex-wrap:wrap; gap:6px; color:var(--ink-2); font-size:var(--fs-12,12px) }
.state-tracking__labels { display:grid; gap:6px }
.state-tracking__label { display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; background:var(--bg-2); min-width:0 }
.state-tracking__label > .editable-field { flex:0 0 64px; min-width:0 }
.state-tracking__icon { border:0; padding:0; background:transparent; cursor:pointer; flex:none }
.state-tracking__icon:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:4px }
.state-tracking__appearance { width:280px; max-width:calc(100vw - 56px) }
.state-tracking__label :deep(.i18n-text-editable) { flex:1; min-width:0 }
.state-tracking small { color:var(--ink-3); line-height:1.6 }
</style>
