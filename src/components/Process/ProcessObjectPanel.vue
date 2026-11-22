<script setup lang="ts">
import { toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ProcessBindingEditor from './ProcessBindingEditor.vue'
import ProcessRunPanel from './ProcessRunPanel.vue'
import { useProcessManagement } from './useProcessManagement'
import { processMessages } from './messages'
import type { ProcessApi, ProcessBinding, ProcessObject } from './types'
const props = defineProps<{ object?: ProcessObject; api: ProcessApi; initialTemplate?:{id:string;version:string}; permissions?: {configure:boolean;remove:boolean;start:boolean;stop:boolean;reconcile:boolean} }>()
const emit = defineEmits<{applied:[]}>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const state = useProcessManagement(toRef(props,'object'),props.api)
const {configurations,assignments,runs,page,total,runPage,assignmentCursor,moreAssignments,loading,busy,error,binding,template,editorOpen,templateOpen,templates,templatePage,templateTotal,runId,complete,load,listTemplates,useTemplate,edit,save,remove,execute} = state
const bindingOf = (value: string) => JSON.parse(value) as ProcessBinding
watch(() => props.initialTemplate, async (value,_,onCleanup) => {
  if (!value || !props.object || !props.permissions?.configure) return
  let active = true; onCleanup(() => {active = false})
  try { const row = await props.api.resolveTemplate(value.id,value.version); if (active && row.published) { useTemplate(row); emit('applied') } }
  catch (cause) { if (active) error.value = cause instanceof Error ? cause.message : String(cause) }
},{immediate:true})
</script>
<template>
  <section class="process-object-panel">
    <header><h3>{{ object?.name || object?.id || t('processes') }}</h3><a-space><a-button :disabled="busy" :loading="loading" @click="load">{{ t('refresh') }}</a-button><a-button v-if="permissions?.configure" type="primary" :disabled="!object" :loading="busy" @click="listTemplates">{{ t('newApplication') }}</a-button></a-space></header>
    <a-alert v-if="error" :message="t('operationFailed')" :description="error" type="error" show-icon />
    <a-empty v-if="!object" :description="t('noSelection')" />
    <a-spin v-else :spinning="loading"><a-tabs>
      <a-tab-pane key="effective" :tab="t('effective')"><a-empty v-if="!assignments.length" :description="t('noAssignments')" />
        <a-list v-else :data-source="assignments"><template #renderItem="{item}"><a-list-item><a-list-item-meta :title="item.slot"><template #description><a-space wrap><a-tag>{{ t(item.state === 'effective' ? 'effectiveState' : item.state) }}</a-tag><span>{{ t(item.executionIntent) }}</span><span>{{ item.reason }}</span></a-space></template></a-list-item-meta><a-space wrap>
          <a-button v-if="permissions?.start" :disabled="busy || item.state !== 'effective' || !!item.currentRunId" @click="execute('start',item.slot)">{{ t('start') }}</a-button>
          <a-button v-if="item.currentRunId" @click="runId = item.currentRunId">{{ t('statusDetail') }}</a-button><a-button v-if="permissions?.stop && item.currentRunId" :disabled="busy" @click="execute('stop',item.currentRunId)">{{ t('stop') }}</a-button><a-button v-if="permissions?.reconcile && item.currentRunId" :disabled="busy" @click="execute('reconcile',item.currentRunId)">{{ t('reconcile') }}</a-button>
        </a-space></a-list-item></template></a-list><a-space><a-button :disabled="loading || !assignmentCursor" @click="assignmentCursor = undefined; load()">{{ t('previous') }}</a-button><a-button :disabled="loading || !moreAssignments" @click="assignmentCursor = assignments.at(-1)?.id; load()">{{ t('next') }}</a-button></a-space>
      </a-tab-pane>
      <a-tab-pane key="configuration" :tab="t('configuration')"><a-empty v-if="!configurations.length" :description="t('empty')" /><a-list v-else :data-source="configurations"><template #renderItem="{item}"><a-list-item><a-list-item-meta :title="bindingOf(item.bindingJson).slot"><template #description><a-space wrap><span>{{ bindingOf(item.bindingJson).templateVersion }}</span><span>{{ t(bindingOf(item.bindingJson).application) }}</span><a-tag>{{ t(bindingOf(item.bindingJson).enabled ? 'enabled' : 'disabled') }}</a-tag><span>{{ t(item.synchronization) }}</span></a-space></template></a-list-item-meta><a-space><a-button :disabled="busy" @click="edit(item)">{{ t('open') }}</a-button><a-popconfirm v-if="permissions?.remove" :title="t('removeConfirm')" @confirm="remove(item)"><a-button danger :disabled="busy">{{ t('restore') }}</a-button></a-popconfirm></a-space></a-list-item></template></a-list><a-pagination :current="page + 1" :page-size="20" :total="total" :show-size-changer="false" @change="value => {page = value - 1; load()}" /></a-tab-pane>
      <a-tab-pane key="executions" :tab="t('executions')"><a-empty v-if="!runs.length" :description="t('empty')" /><a-list v-else :data-source="runs"><template #renderItem="{item}"><a-list-item><a-list-item-meta :title="t(item.status)" :description="item.id" /><a-button @click="runId = item.id">{{ t('statusDetail') }}</a-button></a-list-item></template></a-list><a-space><a-button :disabled="loading || runPage === 0" @click="runPage--; load()">{{ t('previous') }}</a-button><a-button :disabled="loading || runs.length < 20" @click="runPage++; load()">{{ t('next') }}</a-button></a-space></a-tab-pane>
    </a-tabs></a-spin>
    <a-drawer :open="templateOpen" :title="t('choosePublished')" width="min(540px,100vw)" @close="templateOpen = false"><a-empty v-if="!templates.length" :description="t('empty')" /><a-list v-else :data-source="templates"><template #renderItem="{item}"><a-list-item><a-list-item-meta :title="item.name" :description="item.version" /><a-button @click="useTemplate(item)">{{ t('apply') }}</a-button></a-list-item></template></a-list><a-pagination :current="templatePage + 1" :page-size="20" :total="templateTotal" :show-size-changer="false" @change="value => {templatePage = value - 1; listTemplates()}" /></a-drawer>
    <a-drawer :open="editorOpen" :title="template?.name || t('configuration')" width="min(720px,100vw)" @close="editorOpen = false"><a-alert v-if="error" :message="t('operationFailed')" :description="error" type="error" show-icon /><ProcessBindingEditor v-if="binding && template" v-model="binding" :template="template" :readonly="!permissions?.configure || busy" /><template #footer><a-space><a-button @click="editorOpen = false">{{ t('cancel') }}</a-button><a-button v-if="permissions?.configure" type="primary" :loading="busy" :disabled="!complete" @click="save">{{ t('confirm') }}</a-button></a-space></template></a-drawer>
    <a-drawer :open="!!runId" :title="t('executions')" width="min(1280px,100vw)" destroy-on-close @close="runId = ''"><ProcessRunPanel v-if="runId" :run-id="runId" :api="api" /></a-drawer>
  </section>
</template>
<style scoped>.process-object-panel { display:grid; gap:16px; min-width:0 }.process-object-panel header { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap }.process-object-panel h3 { font-size:16px; margin:0 }.process-object-panel :deep(.ant-list-item) { gap:12px; flex-wrap:wrap }</style>
