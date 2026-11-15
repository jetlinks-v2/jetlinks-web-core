<template>
  <div class="metric-scope-panel">
    <header class="metric-scope-panel__head">
      <div class="metric-scope-panel__identity"><slot name="object-heading"><strong>{{ context.label }}</strong></slot><slot name="object-actions" /></div>
      <div v-if="context.editable" class="metric-scope-panel__actions">
        <a-button v-if="mode==='metrics'" type="text" :aria-pressed="managing" @click="managing=!managing"><AIcon :type="managing ? 'CheckOutlined' : 'SettingOutlined'" />{{ t(managing ? 'finishManage' : 'manage') }}</a-button>
        <a-dropdown v-model:open="addOpen" :trigger="['click']" placement="bottomRight">
          <a-button type="primary" :loading="bindings.busy.value"><AIcon type="PlusOutlined" />{{ t('addMetric') }}</a-button>
          <template #overlay><a-menu class="metric-scope-panel__add" @click="addMetric(String($event.key))">
            <a-menu-item key="new"><div class="metric-scope-panel__choice"><AIcon type="FunctionOutlined" /><span><b>{{ t('newMetric') }}</b><small>{{ t('newMetricHint') }}</small></span></div></a-menu-item>
            <a-menu-item v-if="pickSource" key="existing"><div class="metric-scope-panel__choice"><AIcon type="LinkOutlined" /><span><b>{{ t('existingMetric') }}</b><small>{{ t('existingMetricHint') }}</small></span></div></a-menu-item>
          </a-menu></template>
        </a-dropdown>
      </div>
    </header>
    <nav v-if="context.readScopes?.length" class="metric-scope-panel__nav" :aria-label="t('metric')">
      <button type="button" :class="{active:mode==='metrics'}" @click="setMode('metrics')"><AIcon type="DashboardOutlined" />{{ t('metric') }}</button>
      <button type="button" :class="{active:mode!=='metrics'}" @click="setMode('overview')"><AIcon type="BarChartOutlined" />{{ t('overview') }}</button>
    </nav>
    <nav v-if="mode!=='metrics' && context.readScopes && context.readScopes.length>1" class="metric-scope-panel__scopes" :aria-label="t('source')"><a-radio-group v-model:value="scopeType" size="small" @change="selection=undefined;mode='overview'"><a-radio-button v-for="scope in context.readScopes" :key="scope.memberType" :value="scope.memberType"><AIcon :type="scope.icon" /> {{ scope.label }}</a-radio-button></a-radio-group></nav>
    <MetricPanel v-show="mode==='metrics'" ref="panel" :context="context" :pick-source="pickSource" :initial-reference="initialReference" :initial-template="initialTemplate" :detail-link-label="detailLinkLabel" hide-identity hide-add :managing="managing" :suppress-empty="hasLinkedContent" @add-requested="addOpen=true" @apply-started="$emit('applyStarted')" @inspect-scope="inspectScope" @open-detail-link="$emit('openDetailLink',$event)">
      <template #default="{references}"><MetricObjectBindings :context="context" :state="bindings" :managing="managing" :exclude="references" @manage-location="$emit('openObject',$event)" /></template>
    </MetricPanel>
    <KeepAlive :max="1"><MetricAggregateOverview v-if="mode==='overview' && activeScope" :key="context.ownerType+':'+context.ownerId+':'+activeScope.memberType" :context="context" :scope="activeScope" @members="openMembers" /></KeepAlive>
    <MetricCollection v-if="mode==='members' && activeScope" :key="context.ownerType+':'+context.ownerId+':'+activeScope.memberType" :context="context" :scope="activeScope" :selection="selection" @clear-selection="mode='overview';selection=undefined" />
  </div>
</template>
<script setup lang="ts">
import {computed,provide,ref,toRef,watch} from 'vue'
import {useI18n} from 'vue-i18n'
import MetricPanel from '../MetricPanel.vue'
import MetricCollection from './MetricCollection.vue'
import MetricAggregateOverview from './MetricAggregateOverview.vue'
import MetricObjectBindings from '../bindings/MetricObjectBindings.vue'
import {useMetricBindings} from '../bindings/useMetricBindings'
import {collectionMessages} from './messages'
import {metricSourcePickerKey} from '../useMetricSourceTemplate'
import type {MetricAlarmReference,MetricTemplateReference,MetricContext,MetricReference,MetricSourcePicker,MetricWorkspaceSelection} from '../types'
import type {MetricCollectionSelection} from './types'
const props=defineProps<{context:MetricContext;pickSource?:MetricSourcePicker;initialReference?:MetricReference;initialTemplate?:MetricTemplateReference;detailLinkLabel?:string}>()
provide(metricSourcePickerKey,toRef(props,'pickSource'))
defineEmits<{(event:'applyStarted'):void;(event:'openDetailLink',reference:MetricAlarmReference):void;(event:'openObject',value:MetricWorkspaceSelection):void}>()
const {t}=useI18n({useScope:'local',messages:collectionMessages})
const mode=ref('metrics'),managing=ref(false),addOpen=ref(false),scopeType=ref(''),selection=ref<MetricCollectionSelection>()
const panel=ref<InstanceType<typeof MetricPanel>>()
const bindings=useMetricBindings(toRef(props,'context'),toRef(props,'pickSource'))
const hasLinkedContent=computed(()=>bindings.page.state.value.status!=='ready' || !!bindings.page.data.value?.items.length || !!bindings.page.data.value?.nextCursor)
const activeScope=computed(()=>props.context.readScopes?.find(item=>item.memberType===scopeType.value))
async function setMode(value:string){if(mode.value===value)return;if(await panel.value?.canLeave()){mode.value=value;selection.value=undefined}}
async function addMetric(kind:string){
  addOpen.value=false
  if(!await panel.value?.canLeave())return
  mode.value='metrics'
  if(kind==='new')panel.value?.create()
  else await bindings.add(t('selectConcrete'))
}
function inspectScope(value:MetricCollectionSelection & {memberType:string}){
  if(!props.context.readScopes?.some(scope=>scope.memberType===value.memberType))return
  selection.value={templateId:value.templateId,group:value.group};scopeType.value=value.memberType;mode.value='members'
}
function openMembers(value:MetricCollectionSelection){selection.value=value;mode.value='members'}
watch([()=>props.context.ownerType,()=>props.context.ownerId],()=>{
  selection.value=undefined;managing.value=false;addOpen.value=false;mode.value='metrics'
  scopeType.value=(props.context.readScopes?.find(scope=>!scope.tree) || props.context.readScopes?.[0])?.memberType || ''
},{immediate:true})
watch([()=>props.initialReference,()=>props.initialTemplate],values=>{if(values.some(Boolean))mode.value='metrics'})
</script>
<style scoped>
.metric-scope-panel{display:grid;gap:12px;min-width:0}.metric-scope-panel__head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.metric-scope-panel__identity,.metric-scope-panel__actions{display:flex;align-items:center;gap:8px;min-width:0;max-width:100%}.metric-scope-panel__identity{flex:1 1 180px}.metric-scope-panel__actions{margin-left:auto}
.metric-scope-panel__nav{display:flex;align-items:center;gap:24px;border-bottom:1px solid var(--line)}.metric-scope-panel__nav>button{display:flex;align-items:center;gap:6px;padding:8px 0;background:none;border:0;border-bottom:2px solid transparent;color:var(--ink-2);cursor:pointer}
.metric-scope-panel__nav>button.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:600}.metric-scope-panel__nav>button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.metric-scope-panel__scopes{min-width:0;overflow:auto}.metric-scope-panel__add{max-width:min(360px,calc(100vw - 32px))}.metric-scope-panel__choice{display:flex;align-items:center;gap:12px;padding:6px 4px}
.metric-scope-panel__choice>.anticon{font-size:20px;color:var(--accent)}.metric-scope-panel__choice span{display:grid;gap:2px;white-space:normal}.metric-scope-panel__choice b{font-weight:500}.metric-scope-panel__choice small{font-size:12px;color:var(--ink-3)}
</style>
