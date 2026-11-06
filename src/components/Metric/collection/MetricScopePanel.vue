<template>
  <div class="metric-scope-panel">
    <nav v-if="context.readScopes?.length" class="metric-scope-panel__nav" :aria-label="t('source')">
      <button type="button" :class="{active:mode === 'overview'}" @click="mode='overview'"><AIcon type="AppstoreOutlined" />{{ t('overview') }}</button>
      <button type="button" :class="{active:mode === 'members'}" @click="mode='members'"><AIcon type="UnorderedListOutlined" />{{ t('membersTab') }}</button>
      <button type="button" :class="{ active:mode === '' }" @click="mode = ''"><AIcon type="SettingOutlined" />{{ t('own') }}</button>
    </nav>
    <nav v-if="mode && context.readScopes && context.readScopes.length>1" class="metric-scope-panel__nav"><button v-for="scope in context.readScopes" :key="scope.memberType" type="button" :class="{active:scopeType===scope.memberType}" @click="scopeType=scope.memberType"><AIcon :type="scope.icon" />{{ scope.label }}</button></nav>
    <KeepAlive :max="1"><MetricAggregateOverview v-if="mode==='overview' && activeScope" :key="context.ownerType + ':' + context.ownerId + ':' + activeScope.memberType" :context="context" :scope="activeScope" @members="openMembers" /></KeepAlive>
    <MetricCollection v-if="mode==='members' && activeScope" :key="context.ownerType + ':' + context.ownerId + ':' + activeScope.memberType" :context="context" :scope="activeScope" :selection="selection" @clear-selection="selection = undefined" />
    <MetricPanel v-if="!mode || !activeScope" :context="context" :pick-source="pickSource" :initial-reference="initialReference" :detail-link-label="detailLinkLabel" @inspect-scope="inspectScope" @open-detail-link="$emit('openDetailLink', $event)"><template #object-actions><slot name="object-actions" /></template></MetricPanel>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricPanel from '../MetricPanel.vue'
import MetricCollection from './MetricCollection.vue'
import MetricAggregateOverview from './MetricAggregateOverview.vue'
import { collectionMessages } from './messages'
import type { MetricAlarmReference, MetricContext, MetricReference, MetricSourcePicker } from '../types'
import type { MetricCollectionSelection } from './types'
const props = defineProps<{ context:MetricContext; pickSource?:MetricSourcePicker; initialReference?:MetricReference; detailLinkLabel?:string }>()
defineEmits<{ (event:'openDetailLink', reference:MetricAlarmReference):void }>()
const { t } = useI18n({ useScope:'local', messages:collectionMessages })
const mode = ref('')
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
.metric-scope-panel__nav { display:flex; gap:20px; padding:0 var(--space-4,16px); border-bottom:1px solid var(--border,#f0f0f0) }
.metric-scope-panel__nav button { display:flex; align-items:center; gap:8px; padding:14px 0; background:none; border:0; border-bottom:2px solid transparent; color:var(--ink-2); cursor:pointer }
.metric-scope-panel__nav button.active { color:var(--accent,#1677ff); border-bottom-color:var(--accent,#1677ff); font-weight:600 }
</style>
