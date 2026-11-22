<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import ProcessDesigner from './ProcessDesigner.vue'
import ProcessDeclarations from './ProcessDeclarations.vue'
import ProcessSimulation from './ProcessSimulation.vue'
import { useProcessTemplates } from './useProcessTemplates'
import { processMessages } from './messages'
import type { ProcessApi } from './types'
const props = defineProps<{ api: ProcessApi; editable?: boolean }>()
const emit = defineEmits<{ apply: [template: { id: string; version: string }] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const { rows,total,page,loading,busy,error,selected,draft,dirty,simulationOpen,load,open,create,newVersion,action } = useProcessTemplates(props.api)
const tab = ref('steps')
watch(page, load)
function switchDraft(next: () => void) { if (dirty.value) Modal.confirm({ title:t('unsaved'), okText:t('confirm'), cancelText:t('cancel'), onOk:next }); else next() }
async function execute(kind: 'save' | 'publish' | 'validate') { if (await action(kind)) message.success(t(kind === 'validate' ? 'valid' : kind === 'publish' ? 'published' : 'saved')) }
</script>
<template>
  <div class="process-template-manager">
    <aside class="process-template-manager__list">
      <a-space><a-button v-if="editable" type="primary" :disabled="busy" @click="switchDraft(create)">{{ t('create') }}</a-button><a-button :loading="loading" @click="load">{{ t('refresh') }}</a-button></a-space>
      <a-spin :spinning="loading"><a-empty v-if="!rows.length" :description="t('empty')" /><div v-else class="process-template-manager__items"><a-button v-for="row in rows" :key="row.id" :disabled="busy" :type="selected?.id === row.id ? 'primary' : 'text'" @click="switchDraft(() => open(row))"><strong>{{ row.name }}</strong><small>{{ row.version }} · {{ t(row.published ? 'published' : 'draft') }}</small></a-button></div></a-spin>
      <a-pagination :current="page + 1" :total="total" :page-size="20" simple :show-size-changer="false" @change="value => { page = value - 1 }" />
    </aside>
    <main class="process-template-manager__editor">
      <a-alert v-if="error" :message="t('operationFailed')" :description="error" type="error" show-icon />
      <a-empty v-if="!draft" :description="t('choose')" />
      <template v-else>
        <header class="process-template-manager__toolbar"><a-space wrap><a-tag>{{ t(selected?.published ? 'published' : 'draft') }}</a-tag><span v-if="dirty">{{ t('unsaved') }}</span></a-space><a-space wrap><a-button :loading="busy" @click="execute('validate')">{{ t('validate') }}</a-button><a-button @click="simulationOpen = true">{{ t('simulate') }}</a-button><a-button v-if="editable && !selected?.published" :loading="busy" :disabled="!draft.name.trim()" @click="execute('save')">{{ t('save') }}</a-button><a-button v-if="editable && !selected?.published" type="primary" :loading="busy" :disabled="!draft.name.trim()" @click="execute('publish')">{{ t('publish') }}</a-button><a-button v-if="editable && selected?.published" :disabled="busy" @click="newVersion">{{ t('newVersion') }}</a-button><a-button v-if="selected?.published" type="primary" @click="emit('apply',{id:draft.id,version:draft.version})">{{ t('apply') }}</a-button></a-space></header>
        <a-form layout="vertical" class="process-template-manager__identity" :disabled="!editable || selected?.published || busy">
          <a-form-item :label="t('name')" required><a-input :value="draft.name" @update:value="name => draft && (draft = {...draft,name})" /></a-form-item>
          <a-form-item :label="t('version')" required><a-input :value="draft.version" :disabled="!!selected" @update:value="version => draft && (draft = {...draft,version})" /></a-form-item>
          <a-form-item :label="t('mode')"><a-select :value="draft.mode" :options="['once','continuous'].map(value => ({value,label:t(value)}))" @update:value="mode => draft && (draft = {...draft,mode:mode as 'once'|'continuous'})" /></a-form-item>
        </a-form>
        <a-tabs v-model:active-key="tab"><a-tab-pane key="steps" :tab="t('steps')"><ProcessDesigner :model-value="draft" :readonly="!editable || selected?.published || busy" @update:model-value="draft = $event" /></a-tab-pane><a-tab-pane key="declarations" :tab="t('declarations')"><ProcessDeclarations :model-value="draft" :readonly="!editable || selected?.published || busy" @update:model-value="draft = $event" /></a-tab-pane></a-tabs>
      </template>
    </main>
    <a-drawer v-if="draft" :open="simulationOpen" :title="t('simulation')" width="min(1280px,100vw)" destroy-on-close @close="simulationOpen = false"><ProcessSimulation :template="draft" :api="api" /></a-drawer>
  </div>
</template>
<style scoped>
.process-template-manager { display:grid; grid-template-columns:240px minmax(0,1fr); gap:24px; height:100%; min-height:0 }.process-template-manager__list { display:flex; flex-direction:column; gap:16px; min-width:0; overflow:auto }.process-template-manager__editor { min-width:0; overflow:auto; display:flex; flex-direction:column; gap:16px }.process-template-manager__toolbar { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap }.process-template-manager__identity { display:grid; grid-template-columns:minmax(180px,2fr) minmax(100px,1fr) minmax(150px,1fr); gap:16px }.process-template-manager__items { display:grid; gap:4px }.process-template-manager__items :deep(.ant-btn) { height:auto; text-align:start; white-space:normal }.process-template-manager__items strong,.process-template-manager__items small { display:block; overflow-wrap:anywhere }.process-template-manager__items small { opacity:.75 }
@media(max-width:900px) { .process-template-manager { grid-template-columns:minmax(0,1fr); height:auto }.process-template-manager__list { max-height:220px }.process-template-manager__identity { grid-template-columns:1fr } }
</style>
