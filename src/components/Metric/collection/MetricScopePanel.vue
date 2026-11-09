<template>
  <div class="metric-scope-panel">
    <nav v-if="context.readScopes?.length" class="metric-scope-panel__nav" :aria-label="t('source')">
      <div v-if="$slots['object-heading'] || $slots['object-actions']" class="metric-scope-panel__identity"><slot name="object-heading" /><slot name="object-actions" /></div>
      <button type="button" :class="{active:!!mode}" @click="mode='overview'"><AIcon type="AppstoreOutlined" />{{ t('overview') }}</button>
      <button type="button" :class="{ active:mode === '' }" @click="mode = ''"><AIcon type="SettingOutlined" />{{ t('own') }}</button>
    </nav>
    <nav v-if="mode && context.readScopes && context.readScopes.length>1" class="metric-scope-panel__nav"><button v-for="scope in context.readScopes" :key="scope.memberType" type="button" :class="{active:scopeType===scope.memberType}" @click="scopeType=scope.memberType"><AIcon :type="scope.icon" />{{ scope.label }}</button></nav>
    <KeepAlive :max="1"><MetricAggregateOverview v-if="mode==='overview' && activeScope" :key="context.ownerType + ':' + context.ownerId + ':' + activeScope.memberType" :context="context" :scope="activeScope" @members="openMembers" /></KeepAlive>
    <MetricCollection v-if="mode==='members' && activeScope" :key="context.ownerType + ':' + context.ownerId + ':' + activeScope.memberType" :context="context" :scope="activeScope" :selection="selection" @clear-selection="mode='overview';selection=undefined" />
    <MetricPanel v-if="!mode || !activeScope" :context="context" :pick-source="pickSource" :initial-reference="initialReference" :initial-template="initialTemplate" @apply-started="$emit('applyStarted')" :detail-link-label="detailLinkLabel" :hide-identity="!!context.readScopes?.length && !!$slots['object-heading']" @inspect-scope="inspectScope" @open-detail-link="$emit('openDetailLink', $event)"><template v-if="!context.readScopes?.length && $slots['object-heading']" #object-heading><slot name="object-heading" /></template><template #object-actions><slot v-if="!context.readScopes?.length" name="object-actions" /></template></MetricPanel>
  </div>
</template>
<script setup lang="ts">
import { computed, provide, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricPanel from '../MetricPanel.vue'
import MetricCollection from './MetricCollection.vue'
import MetricAggregateOverview from './MetricAggregateOverview.vue'
import { collectionMessages } from './messages'
import { metricSourcePickerKey } from '../useMetricSourceTemplate'
import type { MetricAlarmReference, MetricTemplateReference, MetricContext, MetricReference, MetricSourcePicker } from '../types'
import type { MetricCollectionSelection } from './types'
const props = defineProps<{ context:MetricContext; pickSource?:MetricSourcePicker; initialReference?:MetricReference; initialTemplate?:MetricTemplateReference; detailLinkLabel?:string }>()
provide(metricSourcePickerKey, toRef(props,'pickSource'))
defineEmits<{ (event:'applyStarted'):void; (event:'openDetailLink', reference:MetricAlarmReference):void }>()
const { t } = useI18n({ useScope:'local', messages:collectionMessages })
const mode = ref('')
watch(()=>props.initialTemplate,value=>{if (value) mode.value=''}, {immediate:true})
const scopeType=ref('')
const selection = ref<MetricCollectionSelection>()
function inspectScope(value:MetricCollectionSelection & {memberType:string}) {
  if (!props.context.readScopes?.some(scope => scope.memberType === value.memberType)) return
  selection.value = {templateId:value.templateId,group:value.group}
  scopeType.value=value.memberType
  mode.value = 'members'
}
function openMembers(value:MetricCollectionSelection){selection.value=value;mode.value='members'}
watch([() => props.context.ownerType, () => props.context.ownerId], () => {
  selection.value = undefined
  scopeType.value=props.context.readScopes?.[0]?.memberType || ''
  mode.value = props.initialReference || !scopeType.value ? '' : 'overview'
}, { immediate:true })
watch(() => props.initialReference, value => { if (value) mode.value = '' })
const activeScope = computed(() => props.context.readScopes?.find(item => item.memberType === scopeType.value))
</script>
<style scoped>
.metric-scope-panel { min-width:0 }
.metric-scope-panel__nav { display:flex; align-items:center; flex-wrap:wrap; column-gap:20px; padding:0 var(--space-4,16px); border-bottom:1px solid var(--border,#f0f0f0) }
.metric-scope-panel__identity { display:flex; align-items:center; gap:8px; min-width:0; max-width:100% }
.metric-scope-panel__nav > button { display:flex; align-items:center; gap:8px; padding:14px 0; background:none; border:0; border-bottom:2px solid transparent; color:var(--ink-2); cursor:pointer }
.metric-scope-panel__nav > button.active { color:var(--accent,#1677ff); border-bottom-color:var(--accent,#1677ff); font-weight:600 }
</style>
