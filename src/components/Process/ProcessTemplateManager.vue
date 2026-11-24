<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import ProcessDesigner from './ProcessDesigner.vue'
import ProcessDeclarations from './ProcessDeclarations.vue'
import ProcessSimulation from './ProcessSimulation.vue'
import { useProcessTemplates } from './useProcessTemplates'
import { processMessages } from './messages'
import type { ProcessApi, ProcessTemplateEntity } from './types'
const props = defineProps<{ api: ProcessApi; editable?: boolean }>()
const emit = defineEmits<{ apply: [template: { id: string; version: string }] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const { rows,total,page,loading,busy,error,selected,draft,dirty,simulationOpen,load,open,create,close,newVersion,action } = useProcessTemplates(props.api)
const tab = ref('steps')
watch(page, load)
function start(row?: ProcessTemplateEntity) { tab.value = 'steps'; row ? open(row) : create() }
function requestClose() {
  if (busy.value) return
  if (dirty.value) Modal.confirm({ title:t('unsaved'), okText:t('discardChanges'), cancelText:t('keepEditing'), onOk:close })
  else close()
}
function apply() {
  if (!draft.value || !selected.value?.published || busy.value) return
  const template = {id:draft.value.id,version:draft.value.version}
  close(); emit('apply',template)
}
async function execute(kind: 'save' | 'publish' | 'validate') { if (await action(kind)) message.success(t(kind === 'validate' ? 'valid' : kind === 'publish' ? 'published' : 'saved')) }
</script>
<template>
  <div class="process-template-manager">
    <header class="process-template-manager__head">
      <a-button type="text" size="small" :aria-label="t('refresh')" :title="t('refresh')" :loading="loading" @click="load"><AIcon type="ReloadOutlined" /></a-button>
      <a-button v-if="editable" type="primary" @click="start()"><AIcon type="PlusOutlined" />{{ t('create') }}</a-button>
    </header>
    <a-alert v-if="error && !draft" :message="t('loadFailed')" :description="error" type="error" show-icon><template #action><a-button @click="load">{{ t('retry') }}</a-button></template></a-alert>
    <div class="process-template-manager__gallery">
      <a-spin :spinning="loading">
        <div v-if="rows.length" class="process-template-manager__cards">
          <button v-for="row in rows" :key="row.id" type="button" class="process-template-manager__card" :aria-label="row.name" @click="start(row)">
            <span class="process-template-manager__card-heading"><AIcon type="ApartmentOutlined" /><strong :title="row.name">{{ row.name }}</strong><a-tag :color="row.published ? 'blue' : undefined">{{ t(row.published ? 'published' : 'draft') }}</a-tag><AIcon type="ArrowRightOutlined" /></span>
            <span class="process-template-manager__metadata">{{ t('version') }} {{ row.version }}</span>
          </button>
        </div>
        <a-empty v-else-if="!loading && !error" :description="t('emptyTemplates')"><a-button v-if="editable" type="primary" @click="start()"><AIcon type="PlusOutlined" />{{ t('create') }}</a-button></a-empty>
      </a-spin>
    </div>
    <a-pagination :current="page + 1" :total="total" :page-size="20" :show-size-changer="false" hide-on-single-page @change="value => { page = value - 1 }" />
    <a-drawer :open="!!draft" :title="draft?.name || t('create')" width="100%" :closable="false" :mask-closable="false" :keyboard="false" destroy-on-close :header-style="{display:'none'}" :body-style="{padding:0,overflow:'hidden'}" @close="requestClose">
      <main v-if="draft" class="process-template-manager__editor">
        <header class="process-template-manager__toolbar">
          <div class="process-template-manager__identity">
            <AIcon type="ApartmentOutlined" class="process-template-manager__icon" />
            <div class="process-template-manager__identity-body">
              <h3 v-if="!editable || selected?.published" :title="draft.name">{{ draft.name }}</h3>
              <a-input v-else :value="draft.name" :aria-label="t('name')" :placeholder="t('templateName')" :bordered="false" :disabled="busy" class="process-template-manager__name" @update:value="name => draft && (draft = {...draft,name})" />
              <div class="process-template-manager__metadata">
                <span v-if="selected || !editable">{{ t('version') }} {{ draft.version }}</span>
                <a-input v-else :value="draft.version" :aria-label="t('version')" :placeholder="t('version')" size="small" :disabled="busy" class="process-template-manager__version" @update:value="version => draft && (draft = {...draft,version})" />
                <span v-if="!editable || selected?.published">{{ t(draft.mode) }}</span>
                <a-select v-else :value="draft.mode" :aria-label="t('mode')" size="small" :disabled="busy" :dropdown-match-select-width="false" :options="['once','continuous'].map(value => ({value,label:t(value)}))" @update:value="mode => draft && (draft = {...draft,mode:mode as 'once'|'continuous'})" />
                <a-tag :color="selected?.published ? 'blue' : undefined">{{ t(selected?.published ? 'published' : 'draft') }}</a-tag>
              </div>
            </div>
          </div>
          <span v-if="dirty" class="process-template-manager__dirty" role="status">{{ t('unsaved') }}</span>
          <a-space wrap class="process-template-manager__actions">
            <a-button :loading="busy" @click="execute('validate')">{{ t('validate') }}</a-button><a-button :disabled="busy" @click="simulationOpen = true">{{ t('simulate') }}</a-button>
            <a-button v-if="editable && !selected?.published" :loading="busy" :disabled="!draft.name.trim()" @click="execute('save')">{{ t('save') }}</a-button>
            <a-button v-if="editable && !selected?.published" type="primary" :loading="busy" :disabled="!draft.name.trim()" @click="execute('publish')">{{ t('publish') }}</a-button>
            <a-button v-if="editable && selected?.published" :disabled="busy" @click="newVersion">{{ t('newVersion') }}</a-button>
            <a-button v-if="selected?.published" type="primary" :disabled="busy" @click="apply">{{ t('apply') }}</a-button>
          </a-space>
          <a-button type="text" :aria-label="t('close')" :title="t('close')" :disabled="busy" @click="requestClose"><AIcon type="CloseOutlined" /></a-button>
        </header>
        <a-alert v-if="error" :message="t('operationFailed')" :description="error" type="error" show-icon />
        <a-tabs v-model:active-key="tab" class="process-template-manager__tabs"><a-tab-pane key="steps" :tab="t('steps')"><ProcessDesigner :model-value="draft" :readonly="!editable || selected?.published || busy" @update:model-value="draft = $event" /></a-tab-pane><a-tab-pane key="declarations" :tab="t('declarations')"><ProcessDeclarations :model-value="draft" :readonly="!editable || selected?.published || busy" @update:model-value="draft = $event" /></a-tab-pane></a-tabs>
      </main>
    </a-drawer>
    <a-drawer v-if="draft" :open="simulationOpen" :title="t('simulation')" width="min(1280px,100vw)" destroy-on-close @close="simulationOpen = false"><ProcessSimulation :template="draft" :api="api" /></a-drawer>
  </div>
</template>
<style scoped>
.process-template-manager { display:flex; flex-direction:column; gap:var(--space-3,12px); height:100%; min-height:0; min-width:0 }
.process-template-manager__head { display:flex; justify-content:flex-end; align-items:center; gap:var(--space-2,8px) }
.process-template-manager__gallery { flex:1; min-height:0; overflow:auto; scrollbar-gutter:stable }
.process-template-manager__gallery :deep(.ant-empty) { padding-block:var(--space-8,32px) }
.process-template-manager__cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr)); gap:var(--space-4,16px) }
.process-template-manager__card { display:flex; flex-direction:column; gap:var(--space-3,12px); padding:var(--space-4,16px); min-width:0; border:1px solid var(--line,#f0f0f0); border-radius:var(--r-2,6px); background:var(--panel-background,#fff); color:var(--ink-1,#262626); font:inherit; text-align:start; cursor:pointer }
.process-template-manager__card:hover { border-color:var(--accent,#1677ff); background:var(--accent-soft,#e6f4ff) }
.process-template-manager__card:focus-visible { outline:2px solid var(--accent,#1677ff); outline-offset:2px }
.process-template-manager__card-heading { display:flex; align-items:center; gap:var(--space-2,8px); min-width:0 }
.process-template-manager__card-heading strong { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500 }
.process-template-manager__card-heading :deep(.ant-tag) { margin:0; flex:none }
.process-template-manager__card-heading > :first-child { color:var(--accent,#1677ff); font-size:18px }
.process-template-manager__editor { display:flex; flex-direction:column; gap:var(--space-3,12px); height:100%; min-height:0; padding:16px 20px; overflow:hidden; box-sizing:border-box; container:process-template / inline-size }
.process-template-manager__toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-3,12px); flex:none; min-height:64px }
.process-template-manager__identity { display:flex; align-items:center; gap:var(--space-3,12px); flex:1; min-width:200px }
.process-template-manager__identity-body { min-width:0; flex:1 }
.process-template-manager__identity h3 { margin:0 0 4px; font-size:var(--fs-18,18px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.process-template-manager__name { padding-inline:0; font-size:var(--fs-18,18px); font-weight:600 }
.process-template-manager__icon { display:flex; align-items:center; justify-content:center; flex:none; width:42px; height:42px; color:var(--accent,#1677ff); font-size:20px; border:1px solid var(--line,#f0f0f0); border-radius:var(--r-2,6px) }
.process-template-manager__metadata { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-3,12px); color:var(--ink-3,#595959); font-size:var(--fs-12,12px) }
.process-template-manager__version { width:80px }
.process-template-manager__dirty { font-size:var(--fs-12,12px); color:var(--ink-3,#595959) }
.process-template-manager__tabs { flex:1; min-height:0; overflow:hidden }
.process-template-manager__tabs :deep(.ant-tabs-content-holder) { overflow:auto; scrollbar-gutter:stable }
@container process-template (max-width:760px) { .process-template-manager__actions { order:2; width:100% } .process-template-manager__dirty { order:3 } }
</style>
