<template>
  <div class="metric-template-manager">
    <header class="metric-template-manager__head">
      <h2>{{ t('templates') }}</h2>
      <a-space>
        <a-button :loading="loading" @click="load">{{ t('refresh') }}</a-button>
        <a-button v-if="editable" type="primary" :disabled="saving || editing" @click="requestOpen()">{{ t('newTemplate') }}</a-button>
      </a-space>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="t('readFailed')" :description="error" />
    <div class="metric-template-manager__workspace">
      <aside>
        <a-spin :spinning="loading">
          <a-empty v-if="!loading && !entities.length" :description="t('emptyTemplates')" />
          <button v-for="entity in entities" :key="entity.id" type="button" class="metric-template-manager__entry"
            :class="{ selected: entity.id === selected?.id }" :disabled="saving || editing" @click="requestOpen(entity)">
            <b>{{ entity.name }}</b><span>{{ entity.template.version }}</span>
            <a-tag :color="entity.released ? 'blue' : undefined">{{ t(entity.released ? 'published' : 'draft') }}</a-tag>
            <small v-if="!entity.available">{{ t('notSelectable') }}</small>
          </button>
          <a-pagination v-if="total > 20" v-model:current="page" :page-size="20" :total="total" size="small" @change="load" />
        </a-spin>
      </aside>
      <main v-if="draft">
        <div class="metric-template-manager__editor-tools">
          <b v-if="readOnly || saving || editing || mode === 'full'">{{ draft.name || t('newTemplate') }}</b>
          <InputEditable v-else :value="draft.name" @update:value="draft.name = $event" />
          <a-tag>{{ draft.version || t('versionRequired') }}</a-tag>
        </div>
        <a-alert v-if="selected?.released" type="info" show-icon :message="t('publishedReadOnly')" />
        <a-tabs :active-key="tab" @update:active-key="changeTab">
          <a-tab-pane key="design" :tab="t('design')" :disabled="editing">
            <div class="metric-template-manager__editor-tools">
              <div class="metric-template-manager__modes" role="group" :aria-label="t('design')">
                <a-button v-for="value in ['form', 'full'] as const" :key="value" type="text" size="small" :data-mode="value" :aria-pressed="mode === value" :class="{ active: mode === value }" :disabled="editing || saving" @click="switchMode(value)">{{ t(value === 'form' ? 'visualMode' : 'fullMode') }}</a-button>
              </div>
              <a-select v-if="mode === 'full'" :value="format" :disabled="saving" :options="formats" @update:value="(value: unknown) => switchFormat(value as ConfigurationFormat)" />
            </div>
            <template v-if="mode === 'form'">
              <a-collapse :bordered="false" :default-active-key="selected ? [] : ['identity']" class="metric-template-manager__identity-settings">
                <a-collapse-panel key="identity" :header="t('basic')">
                  <a-form layout="vertical" :disabled="locked || editing">
                    <a-form-item :label="t('templateName')" required><a-input v-model:value="draft.name" /></a-form-item>
                    <div class="metric-template-manager__identity">
                      <a-form-item :label="t('templateId')" required><a-input v-model:value="draft.id" /></a-form-item>
                      <a-form-item :label="t('version')" required><a-input v-model:value="draft.version" /></a-form-item>
                    </div>
                  </a-form>
                </a-collapse-panel>
              </a-collapse>
              <TemplateDesigner v-model:template="draft" :disabled="locked" @editing="editing = $event" />
            </template>
            <MonacoEditor v-else v-model="fullText" :language="format" :read-only="locked" theme="vs" class="metric-template-manager__full-code" :options="editorOptions" />
          </a-tab-pane>
          <a-tab-pane v-if="editable" key="simulation" :tab="t('simulate')" :disabled="editing || saving">
            <TemplateSimulation :key="selected?.id || draft.id" v-model:text="simulationText" :template="draft" :format="format" :results="simulationResults" :response="simulationResponse" :loading="simulating" :error="simulationError" @simulate="simulate" @invalid="invalidateSimulation">
              <template #advancedTools><a-select :value="format" :disabled="simulating" :options="formats" @update:value="(value: unknown) => switchFormat(value as ConfigurationFormat)" /></template>
            </TemplateSimulation>
          </a-tab-pane>
          <a-tab-pane key="publication" :tab="t('release')" :disabled="editing || saving">
            <p>{{ t(selected?.released ? 'publishedReadOnly' : 'releaseConfirm') }}</p>
            <a-descriptions :column="1" size="small">
              <a-descriptions-item :label="t('templateId')">{{ draft.id }}</a-descriptions-item>
              <a-descriptions-item :label="t('version')">{{ draft.version }}</a-descriptions-item>
              <a-descriptions-item :label="t('outputs')">{{ draft.outputs.map(item => item.label || item.metricId).join('、') }}</a-descriptions-item>
            </a-descriptions>
            <a-popconfirm v-if="!readOnly" :title="t('releaseConfirm')" :ok-text="t('release')" :cancel-text="t('cancel')" @confirm="release">
              <a-button type="primary" :loading="saving">{{ t('release') }}</a-button>
            </a-popconfirm>
            <a-space v-if="editable && selected?.released">
              <a-button :disabled="saving" @click="newVersion">{{ t('newVersion') }}</a-button>
              <a-button :loading="saving" @click="setAvailable(!selected.available)">{{ t(selected.available ? 'unavailableAction' : 'available') }}</a-button>
            </a-space>
          </a-tab-pane>
        </a-tabs>
        <StickyActionBar v-if="tab !== 'simulation'">
          <a-button v-if="!readOnly" :loading="saving" :disabled="editing" @click="save">{{ t('save') }}</a-button>
          <a-popconfirm v-if="!readOnly && selected?.id" :title="t('confirmDeleteDraft')" :ok-text="t('deleteDraft')" :cancel-text="t('cancel')" @confirm="removeDraft">
            <a-button danger :loading="saving" :disabled="editing">{{ t('deleteDraft') }}</a-button>
          </a-popconfirm>
        </StickyActionBar>
      </main>
      <a-empty v-else :description="t('selectTemplate')" />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import InputEditable from '../../Editable/InputEditable.vue'
import StickyActionBar from '../../StickyActionBar/index.vue'
import MonacoEditor from '../../MonacoEditor/monacoEditor.vue'
import TemplateDesigner from './TemplateDesigner.vue'
import TemplateSimulation from './TemplateSimulation.vue'
import { metricMessages } from '../messages'
import { useMetricTemplates } from './useMetricTemplates'
import type { ConfigurationFormat } from './configurationText'
import type { MetricTemplateEntity } from '../types'
const props = withDefaults(defineProps<{ editable?: boolean }>(), { editable: false })
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { entities, total, page, selected, draft, mode, format, fullText, simulationText,
  simulationResults, simulationResponse, error, simulationError, loading, saving, simulating, readOnly, hasChanges, load, open,
  switchMode, switchFormat, save, release, newVersion, setAvailable, removeDraft, simulate, invalidateSimulation } = useMetricTemplates(toRef(props, 'editable'))
const tab = ref('design')
const editing = ref(false)
const locked = computed(() => readOnly.value || saving.value)
const formats = [{ value: 'yaml', label: 'YAML' }, { value: 'json', label: 'JSON' }]
watch(toRef(props, 'editable'), value => { if (!value && tab.value === 'simulation') tab.value = 'design' })
const editorOptions = { minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true }
function requestOpen(entity?: MetricTemplateEntity) {
  if (editing.value || saving.value) return
  const accept = () => { open(entity); tab.value = 'design' }
  if (hasChanges.value) Modal.confirm({ title: t('discardEdits'), okText: t('continue'), cancelText: t('cancel'), onOk: accept })
  else accept()
}
function changeTab(value: string | number) {
  if (editing.value || saving.value) return
  if (value !== 'design' && mode.value === 'full') { switchMode('form'); if (mode.value === 'full') return }
  tab.value = String(value)
}
onMounted(load)
</script>
<style scoped>
.metric-template-manager { display:grid; gap:var(--space-4,16px); padding:var(--space-4,16px) }
.metric-template-manager__head, .metric-template-manager__editor-tools { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3,12px) }
.metric-template-manager__head h2 { margin:0; font-size:var(--fs-18,18px) }
.metric-template-manager__workspace { display:grid; grid-template-columns:minmax(220px,280px) minmax(0,1fr); gap:var(--space-4,16px) }
.metric-template-manager__workspace main { min-width:0; display:grid; grid-template-columns:minmax(0,1fr); align-content:start; gap:var(--space-4,16px) }
.metric-template-manager__entry { width:100%; display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-2,8px); padding:var(--space-3,12px); margin-bottom:var(--space-2,8px); text-align:left; border:1px solid var(--line); border-radius:var(--r-3,8px); background:var(--panel-background); color:var(--ink-2); cursor:pointer }
.metric-template-manager__entry.selected { border-color:var(--accent); background:var(--accent-soft) }
.metric-template-manager__entry small { flex-basis:100%; color:var(--ink-3) }
.metric-template-manager__identity { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3,12px) }
.metric-template-manager__full-code { height:560px }
.metric-template-manager__identity-settings { margin-top:var(--space-3,12px) }
.metric-template-manager__modes { display:flex; padding:2px; border:1px solid var(--line); border-radius:var(--r-2,6px) }
.metric-template-manager__modes .active { background:var(--accent-soft); color:var(--accent) }
@media(max-width:800px) { .metric-template-manager__workspace { grid-template-columns:1fr } .metric-template-manager__identity { grid-template-columns:1fr } }
</style>
