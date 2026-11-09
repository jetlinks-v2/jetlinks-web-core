<template>
  <div class="metric-template-manager">
    <header class="metric-template-manager__head">
      <ConditionFilter v-if="entities.length" v-model="directory.terms.value" :fields="directory.fields.value" :common-fields="['name']" :placeholder="t('searchTemplates')" class="metric-template-manager__search" />
      <a-space :size="8" class="metric-template-manager__main-actions">
        <a-button type="text" size="small" :aria-label="t('refresh')" :title="t('refresh')" :loading="loading || categoriesLoading" @click="refresh"><AIcon type="ReloadOutlined" /></a-button>
        <a-button v-if="editable" type="primary" @click="startCreating"><AIcon type="PlusOutlined" />{{ t('newTemplate') }}</a-button>
      </a-space>
    </header>
    <a-alert v-if="error && !draft" type="error" show-icon :message="t('readFailed')" :description="error" />
    <a-alert v-if="categoryError && !draft" type="warning" show-icon :message="t('categoryLoadFailed')" :description="categoryError"><template #action><a-button size="small" :loading="categoriesLoading" @click="loadCategories">{{ t('retry') }}</a-button></template></a-alert>
    <nav v-if="entities.length" class="metric-template-manager__categories" :aria-label="t('templateCategory')">
      <button type="button" :aria-pressed="directory.category.value === undefined" @click="directory.selectCategory()">{{ t('allCategories') }}<small>{{ entities.length }}</small></button>
      <button v-for="group in catalog" :key="group.id" type="button" :aria-pressed="directory.category.value === group.id" @click="directory.selectCategory(group.id)">{{ group.label }}<small>{{ group.items.length }}</small></button>
    </nav>
    <div class="metric-template-manager__gallery">
      <a-spin :spinning="loading">
        <template v-if="entities.length">
          <TemplateCatalog v-if="directory.visible.value.length" :groups="directory.visible.value" flat @select="selectCard" />
          <a-empty v-else :description="t('noMatchingTemplates')"><a-button @click="directory.clear">{{ t('clearFilters') }}</a-button></a-empty>
        </template>
        <section v-else-if="!loading && !error" class="metric-template-manager__empty">
          <template v-if="editable && starters.length">
            <h3>{{ t('startWithScenario') }}</h3>
            <TemplateCatalog :groups="starterGroups" @select="selectCard" />
            <a-button type="text" @click="requestOpen()"><AIcon type="PlusOutlined" />{{ t('startBlank') }}</a-button>
          </template>
          <a-empty v-else :description="t('emptyTemplates')"><a-button v-if="editable" type="primary" @click="requestOpen()">{{ t('newTemplate') }}</a-button></a-empty>
        </section>
      </a-spin>
    </div>
    <a-drawer class="metric-template-editor-drawer" :open="!!draft" width="100%" placement="right" :closable="false" :mask-closable="false" :keyboard="false" :destroy-on-close="true"
      :header-style="{ display:'none' }" :body-style="{ padding:0, overflow:'hidden' }" @close="requestClose">
      <main v-if="draft" class="metric-template-manager__detail" :class="{ 'is-publication':tab === 'publication' }">
        <header class="metric-template-manager__editor-head">
          <TemplateIdentity v-model:template="draft" :disabled="!canEditIdentity || updates.applying.value" :published="selected?.released" :revision="selected?.revision" :pending="!!selected?.draft" />
          <span v-if="hasChanges" class="metric-template-manager__dirty" role="status">{{ t('unsavedChanges') }}</span>
          <a-button v-if="editable && tab === 'design'" :loading="simulating" :disabled="editing || trial.invalid || saving || updates.applying.value" @click="runSimulation"><AIcon type="PlayCircleOutlined" />{{ t('simulate') }}</a-button>
          <a-button v-if="!readOnly && (tab === 'design' || hasChanges)" :type="tab === 'design' ? 'primary' : 'default'" :loading="saving" :disabled="editing || simulating || updates.applying.value" @click="save">{{ t('save') }}</a-button>
          <a-button type="text" class="metric-template-manager__close" :aria-label="t('close')" :title="t('close')" :disabled="saving || updates.applying.value" @click="requestClose"><AIcon type="CloseOutlined" /></a-button>
        </header>
        <a-alert v-if="error" type="error" show-icon :message="t('templateOperationFailed')" :description="error" />
        <a-tabs :active-key="tab" @update:active-key="changeTab">
          <template #rightExtra>
            <div v-if="tab === 'design'" class="metric-template-manager__editor-tools">
              <a-select v-if="mode === 'full'" :value="format" size="small" :aria-label="t('configurationFormat')" :disabled="saving" :options="formats" :dropdown-match-select-width="false" @update:value="(value: unknown) => switchFormat(value as ConfigurationFormat)"><template #option="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></template></a-select>
              <a-button type="text" size="small" :data-mode="mode === 'form' ? 'full' : 'form'" :aria-label="t(mode === 'form' ? 'fullMode' : 'visualMode')" :disabled="editing || saving || simulating || updates.applying.value" @click="switchMode(mode === 'form' ? 'full' : 'form')">
                <AIcon :type="mode === 'form' ? 'CodeOutlined' : 'ArrowLeftOutlined'" />{{ t(mode === 'form' ? 'fullMode' : 'visualMode') }}
              </a-button>
            </div>
          </template>
          <a-tab-pane key="design" :tab="t('design')" :disabled="editing || simulating || updates.applying.value" />
          <a-tab-pane key="publication" :tab="t('release')" :disabled="editing || saving || simulating">
            <TemplatePublication :template="displayTemplate!" :entity="selected" :editable="editable" :pending="hasChanges || !!selected?.draft" :saving="saving" :updates="updates" @release="publish">
            <a-dropdown v-if="editable && selected?.released" :trigger="['click']" :disabled="saving || updates.applying.value"><a-button type="text" size="small"><AIcon type="MoreOutlined" />{{ t('publicationMore') }}</a-button><template #overlay><a-menu><a-menu-item key="version" @click="newVersion"><AIcon type="BranchesOutlined" />{{ t('newVersion') }}</a-menu-item><a-menu-item key="availability" @click="setAvailable(!selected.available)"><AIcon :type="selected.available ? 'StopOutlined' : 'CheckCircleOutlined'" />{{ t(selected.available ? 'unavailableAction' : 'available') }}</a-menu-item></a-menu></template></a-dropdown>
            </TemplatePublication>
          </a-tab-pane>
        </a-tabs>
        <div v-show="tab !== 'publication'" class="metric-template-manager__workspace">
          <a-alert v-if="calculatorError && tab === 'design'" type="warning" :message="t('algorithmCatalogFailed')" :description="calculatorError" show-icon><template #action><a-button size="small" @click="loadCalculators">{{ t('retry') }}</a-button></template></a-alert>
          <TemplateDesigner v-show="mode === 'form'" :key="selected?.id || draft.id" v-model:template="draft" :disabled="locked" :trial="editable ? trial : undefined" :simulation-error="simulationError" :published="selected?.released" :calculators="calculators" :categories="categories" :categories-loading="categoriesLoading" :category-error="categoryError" @reload-categories="loadCategories" @editing="editing = $event">
            <template #advancedTools><a-select :value="format" :disabled="simulating || saving" :options="formats" :dropdown-match-select-width="false" @update:value="(value: unknown) => switchFormat(value as ConfigurationFormat)"><template #option="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></template></a-select></template>
          </TemplateDesigner>
          <MonacoEditor v-if="mode === 'full' && tab === 'design'" v-model="fullText" :language="format" :read-only="locked" theme="vs" class="metric-template-manager__full-code" :options="editorOptions" />
        </div>
        <StickyActionBar v-if="!readOnly && selected?.id && (selected.draft || !selected.released)" class="metric-template-manager__actions">
          <a-popconfirm v-if="!readOnly && selected?.draft" :title="t('discardRevisionConfirm')" :ok-text="t('discardRevision')" :cancel-text="t('cancel')" @confirm="discardDraft">
            <a-button type="text" :disabled="editing || saving || updates.applying.value">{{ t('discardRevision') }}</a-button>
          </a-popconfirm>
          <a-popconfirm v-if="!readOnly && selected?.id && !selected.released" :title="t('confirmDeleteDraft')" :ok-text="t('deleteDraft')" :cancel-text="t('cancel')" @confirm="removeDraft">
            <a-button type="text" danger :loading="saving" :disabled="editing || updates.applying.value">{{ t('deleteDraft') }}</a-button>
          </a-popconfirm>
        </StickyActionBar>
      </main>
    </a-drawer>
    <JlDrawerShell :open="choosingStarter" :title="t('newTemplate')" :sub="t('startWithScenario')" icon="AppstoreOutlined" :width="760" @update:open="choosingStarter = $event">
      <TemplateCatalog :groups="starterGroups" @select="selectCard" />
      <template #foot><a-button @click="requestOpen()"><AIcon type="PlusOutlined" />{{ t('startBlank') }}</a-button></template>
    </JlDrawerShell>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, toRef, watch } from 'vue'
import { Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import TemplateIdentity from './TemplateIdentity.vue'
import TemplatePublication from './TemplatePublication.vue'
import { useTemplateUpdates } from './useTemplateUpdates'
import { localizedTemplate } from './text'
import { starterCatalog, templateCatalog, type TemplateCatalogItem } from './templateCatalog'
import { useTemplateCatalog } from './useTemplateCatalog'
import ConditionFilter from '../../ConditionFilter'
import StickyActionBar from '../../StickyActionBar/index.vue'
import MonacoEditor from '../../MonacoEditor/monacoEditor.vue'
import JlDrawerShell from '../../JlDrawerShell/index.vue'
import TemplateDesigner from './TemplateDesigner.vue'
import { useTemplateSimulation } from './useTemplateSimulation'
import TemplateCatalog from './TemplateCatalog.vue'
import { metricMessages } from '../messages'
import SelectOption from '../../SelectOption/index.vue'
import { useMetricTemplates } from './useMetricTemplates'
import { useTemplateLeaveGuard } from './useTemplateLeaveGuard'
import type { ConfigurationFormat } from './configurationText'
import type { MetricTemplateEntity, MetricTemplateStarter } from '../types'
const props = withDefaults(defineProps<{ editable?: boolean; starters?: MetricTemplateStarter[] }>(), { editable: false, starters: () => [] })
const { t, locale } = useI18n({ useScope: 'local', messages: metricMessages })
const { categories, categoriesLoading, categoryError, loadCategories, calculators, calculatorError, loadCalculators, entities, selected, draft, mode, format, fullText, simulationText,
  simulationResults, simulationResponse, error, simulationError, loading, saving, simulating, readOnly, hasChanges, load, open, close,
  switchMode, switchFormat, save, release, newVersion, setAvailable, removeDraft, discardDraft, simulate, invalidateSimulation } = useMetricTemplates(toRef(props, 'editable'), undefined, t)
const tab = ref('design')
const editing = ref(false)
const updates = useTemplateUpdates(selected, toRef(props, 'editable'))
const trial = useTemplateSimulation({ template:draft, text:simulationText, format, results:simulationResults, response:simulationResponse, loading:simulating, invalidate:invalidateSimulation,
  execution:{ run:simulate, enabled:() => props.editable && !editing.value && !saving.value && !updates.applying.value,
    autoEnabled:() => !!draft.value && tab.value === 'design' && mode.value === 'form' } })
watch(editing, value => { if (value) invalidateSimulation() }, { flush:'sync' })
const choosingStarter = ref(false)
const catalog = computed(() => templateCatalog(entities.value, categories.value, String(locale.value), t('otherCategory')))
const directory = useTemplateCatalog(catalog, t)
const starterGroups = computed(() => starterCatalog(props.starters, String(locale.value), categories.value, t('otherCategory')))
watch(locale, loadCategories)
const locked = computed(() => readOnly.value || saving.value || updates.applying.value)
const canEditIdentity = computed(() => !locked.value && !editing.value && mode.value === 'form')
const displayTemplate = computed(() => draft.value ? localizedTemplate(draft.value, String(locale.value)) : undefined)
watch(tab, value => { if (value === 'publication') updates.load() })
async function publish() { if (updates.applying.value) return; await release(); if (selected.value?.released) await updates.load() }
const formats = computed(() => [{ value:'yaml', label:'YAML', icon:'CodeOutlined', description:t('yamlFormatHint') }, { value:'json', label:'JSON', icon:'CodeOutlined', description:t('jsonFormatHint') }])
const editorOptions = { minimap: { enabled: false }, wordWrap: 'on', automaticLayout: true }
const canLeave = useTemplateLeaveGuard(computed(() => hasChanges.value || editing.value), computed(() => saving.value || updates.applying.value), () => new Promise(resolve => {
  Modal.confirm({ title: t('discardEdits'), okText: t('continue'), cancelText: t('cancel'),
    onOk: () => resolve(true), onCancel: () => resolve(false), afterClose: () => resolve(false) })
}))
function startCreating() {
  if (updates.applying.value) return
  if (props.starters.length) choosingStarter.value = true
  else requestOpen()
}
function selectCard(item: TemplateCatalogItem) { return item.kind === 'template' ? requestOpen(item.entity) : requestOpen(undefined, item.starter) }
async function requestClose() {
  if (!await canLeave()) return
  close(); editing.value = false; tab.value = 'design'
}
async function requestOpen(entity?: MetricTemplateEntity, starter?: MetricTemplateStarter) {
  if (editing.value || saving.value || updates.applying.value) return
  if (!await canLeave()) return
  open(entity, starter); trial.reset(); choosingStarter.value = false; tab.value = 'design'
}
function runSimulation() {
  if (!props.editable || editing.value || trial.invalid || saving.value || simulating.value || updates.applying.value) return
  if (mode.value === 'full') { switchMode('form'); if (mode.value === 'full') return }
  return trial.run()
}
function changeTab(value: string | number) {
  if (value !== 'design' && value !== 'publication') return
  if (editing.value || saving.value || simulating.value || updates.applying.value) return
  if (value !== 'design' && mode.value === 'full') { switchMode('form'); if (mode.value === 'full') return }
  tab.value = String(value)
}
function refresh() { load(); loadCategories() }
onMounted(() => { refresh(); loadCalculators() })
</script>
<style scoped>
/* 首页滚动容器常驻；抽屉编辑、关闭不重建卡片或改变滚动位置。 */
.metric-template-manager { display:flex; flex-direction:column; flex:1; min-height:0; min-width:0; gap:var(--space-3,12px); contain:size }
.metric-template-manager__head { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3,12px); flex:none; min-height:32px }
.metric-template-manager__search { flex:1; min-width:0 }
.metric-template-manager__main-actions { flex:none; margin-inline-start:auto }
.metric-template-manager__categories { display:flex; flex-wrap:wrap; flex:none; gap:var(--space-2,8px); padding-bottom:var(--space-3,12px); border-bottom:1px solid var(--line) }
.metric-template-manager__categories button { display:flex; align-items:center; gap:8px; min-height:32px; padding:4px 10px; border:0; border-radius:var(--r-2,6px); background:none; color:var(--ink-2); font:inherit; font-size:13px; cursor:pointer }
.metric-template-manager__categories button:hover { background:var(--bg-hover) }
.metric-template-manager__categories button[aria-pressed="true"] { color:var(--accent); background:var(--accent-soft); font-weight:500 }
.metric-template-manager__categories button:focus-visible { outline:2px solid var(--accent); outline-offset:2px }
.metric-template-manager__categories small { color:var(--ink-3); font-size:11px; font-weight:400 }
.metric-template-manager__gallery { flex:1; min-height:0; min-width:0; overflow:auto; scrollbar-gutter:stable }
.metric-template-manager__empty > h3 { margin:0 0 16px; font-size:var(--fs-16,16px); font-weight:500 }
.metric-template-manager__detail { display:flex; flex-direction:column; height:100%; min-width:0; min-height:0; overflow:hidden; padding:16px 20px; box-sizing:border-box; container:metric-template / inline-size }
.metric-template-manager__editor-head { display:flex; align-items:center; flex:none; gap:var(--space-3,12px); min-height:64px }
.metric-template-manager__editor-head > .template-identity { flex:1 }
.metric-template-manager__editor-head > :deep(.ant-btn) { flex:none }
.metric-template-manager__dirty { flex:none; color:var(--ink-3); font-size:var(--fs-12,12px) }
.metric-template-manager__close { width:32px; padding:0; color:var(--ink-3) }
.metric-template-manager__detail > :deep(.ant-tabs) { flex:none; min-height:0; margin-top:var(--space-3,12px) }
.metric-template-manager__detail.is-publication > :deep(.ant-tabs) { flex:1 }
.metric-template-manager__workspace { display:flex; flex:1; flex-direction:column; min-width:0; min-height:0; overflow:hidden }
.metric-template-manager__detail :deep(.ant-tabs-content-holder) { min-height:0; overflow:hidden }
.metric-template-manager__detail :deep(.ant-tabs-content) { height:100% }
.metric-template-manager__detail :deep(.ant-tabs-tabpane-active) { height:100%; overflow:auto }
.metric-template-manager__detail :deep(.metric-template-manager__design.ant-tabs-tabpane-active) { display:flex; flex-direction:column; min-height:0; overflow:hidden }
.metric-template-manager__detail :deep(.ant-tabs-nav) { margin-bottom:16px; flex-shrink:0 }
.metric-template-manager__full-code { flex:1; min-height:280px }
.metric-template-manager__editor-tools { display:flex; align-items:center; gap:var(--space-2,8px); padding-left:var(--space-3,12px) }
.metric-template-manager__editor-tools :deep(.ant-btn) { color:var(--ink-3); font-size:var(--fs-12,12px) }
.metric-template-manager__editor-tools :deep(.ant-select) { width:84px }
.metric-template-manager__actions { flex-shrink:0; margin-top:var(--space-3,12px); padding:var(--space-3,12px) 0 0; box-shadow:none }
@container metric-template (max-width:760px) {
  .metric-template-manager__dirty { display:none }
  .metric-template-manager__editor-head { gap:8px }
}
@container metric-template (max-width:440px) {
  .metric-template-manager__editor-tools { padding-left:4px; gap:4px }
  .metric-template-manager__editor-tools :deep(.ant-btn) { max-width:100px; padding:0 4px }
  .metric-template-manager__actions { flex-wrap:wrap }
}
</style>
