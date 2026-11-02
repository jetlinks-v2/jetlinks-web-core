<template>
  <div class="metric-panel">
    <header class="metric-panel__head">
      <h3>{{ context.label || t('title') }}</h3>
      <a-space>
        <a-button type="text" size="small" :loading="loading" @click="refresh">{{ t('refresh') }}</a-button>
        <a-button v-if="context.editable && configurations.length" size="small" @click="openEditor()">{{ t('add') }}</a-button>
      </a-space>
    </header>
    <a-alert v-if="error" type="error" show-icon :message="t('readFailed')" :description="error">
      <template #action><a-button size="small" @click="refresh">{{ t('retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="actionError" type="error" show-icon :message="t('deleteFailed')" :description="actionError" />
    <a-spin :spinning="loading">
      <a-empty v-if="!loading && !configurations.length && !error" :description="t('noMetrics')">
        <a-button v-if="context.editable" type="primary" @click="openEditor()">{{ t('add') }}</a-button>
      </a-empty>
      <div v-else class="metric-panel__grid">
        <button v-for="card in cards" :key="JSON.stringify([card.reference.configId, card.reference.outputId])" type="button"
          :ref="element => setCardElement(card.reference, element)"
          class="metric-panel__card" :class="{ 'is-selected': reference?.configId === card.reference.configId && reference?.outputId === card.reference.outputId, 'is-stopped': card.config.state === 'disabled' }"
          :disabled="inaccessibleIds.includes(card.reference.configId) || !!error || !!latestErrors[card.reference.configId]"
          :aria-pressed="reference?.configId === card.reference.configId && reference?.outputId === card.reference.outputId"
          aria-haspopup="dialog" @click="select(card.reference.configId, card.reference.outputId)">
          <span class="metric-panel__name">{{ metricOutputName(card.output, templates[card.reference.configId]) || t('unnamedOutput') }}</span>
          <span v-if="configName(card.config) !== metricOutputName(card.output, templates[card.reference.configId])" class="metric-panel__alias">{{ configName(card.config) }}</span>
          <div v-if="inaccessibleIds.includes(card.reference.configId) || error || latestErrors[card.reference.configId]" class="metric-panel__unavailable">
            <strong>—</strong><a-tag>{{ t(error || latestErrors[card.reference.configId] ? 'readFailed' : 'noAccess') }}</a-tag>
            <small v-if="latestErrors[card.reference.configId]">{{ latestErrors[card.reference.configId] }}</small>
          </div>
          <MetricCardContent v-else :context="context" :configuration="card.config" :template="templates[card.reference.configId]" :output="card.output" :value="outputs[card.reference.configId]?.[card.reference.outputId]" :runtime="runtimes[card.reference.configId]" />
        </button>
        <a-alert v-for="config in configurations.filter(item => item.id && itemErrors[item.id])" :key="config.id" class="metric-panel__failure"
          type="error" show-icon :message="configName(config)" :description="t('missingTemplate') + ': ' + itemErrors[config.id!]">
          <template v-if="context.editable" #action><a-space><a-button size="small" @click="openEditor(config)">{{ t('edit') }}</a-button><a-button danger size="small" :loading="busyId === config.id" @click="confirmRemove(config)">{{ t('deleteMetric') }}</a-button></a-space></template>
        </a-alert>
      </div>
    </a-spin>
    <JlDrawerShell :open="editorOpen || !!reference" :title="editorOpen ? (editing ? t('edit') : t('add')) : metricOutputName(selectedOutput, templates[selectedId]) || t('unnamedOutput')"
      :sub="editorOpen ? undefined : selected && configName(selected)" :width="editorOpen ? 780 : 860" :icon="editorOpen ? 'SettingOutlined' : 'LineChartOutlined'" @update:open="!$event && dismissDrawer()" @after-open-change="restoreCardFocus">
      <template v-if="!editorOpen && reference" #head-extra>
        <a-space>
          <a-button v-if="context.editable && selected?.state === 'enabled' && runtimes[selectedId]?.state === 'failed'" size="small" :loading="busyId === selected.id" @click="setEnabled(selected, true)">{{ t('retryLoad') }}</a-button>
          <a-button v-if="detailLinkLabel" type="text" size="small" @click="openDetailLink">{{ detailLinkLabel }}</a-button>
          <a-button v-if="context.alarmEnabled && selectedOutput?.publish" type="text" size="small" @click="createAlarm">{{ t('createAlarm') }}</a-button>
          <a-dropdown v-if="context.editable && selected" :trigger="['click']">
            <a-button size="small" type="text" :loading="busyId === selected.id">{{ t('edit') }} <span aria-hidden="true">⌄</span></a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item key="edit" :disabled="busyId === selected.id" @click="openEditor(selected)">{{ t('edit') }}</a-menu-item>
                <a-menu-item v-if="selected.state === 'enabled'" key="disable" :disabled="busyId === selected.id" @click="confirmDisable(selected)">{{ t('disable') }}</a-menu-item>
                <a-menu-item v-else key="enable" :disabled="busyId === selected.id" @click="setEnabled(selected, true)">{{ t('enable') }}</a-menu-item>
                <a-menu-item key="delete" danger :disabled="busyId === selected.id" @click="confirmRemove(selected)">{{ t('deleteMetric') }}</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </template>
      <MetricConfigEditor v-if="editorOpen" :context="context" :configuration="editing" :pick-source="pickSource" @saved="saved" @cancel="closeDrawer" />
      <MetricResult v-else-if="reference" :key="metricResultKey(selected, reference.outputId)" :reference="reference" :latest="selectedLatest" :output="selectedOutput" :context="context" :template="templates[selectedId]" />
    </JlDrawerShell>
  </div>
</template>
<script setup lang="ts">
import { toRef, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { Modal } from 'ant-design-vue'
import JlDrawerShell from '../JlDrawerShell/index.vue'
import MetricConfigEditor from './MetricConfigEditor.vue'
import MetricResult from './MetricResult.vue'
import MetricCardContent from './extensions/MetricCardContent.vue'
import { useMetricPanel } from './useMetricPanel'
import { metricResultKey } from './service'
import { metricOutputName } from './presentation'
import { metricMessages } from './messages'
import type { MetricAlarmReference, MetricConfig, MetricContext, MetricReference, MetricSourcePicker } from './types'
const props = defineProps<{ context: MetricContext; pickSource?: MetricSourcePicker; initialReference?: MetricReference; detailLinkLabel?: string }>()
const emit = defineEmits<{ (event: 'createAlarm', reference: MetricAlarmReference): void; (event: 'openDetailLink', reference: MetricAlarmReference): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { configurations, templates, outputs, runtimes, selectedLatest, itemErrors, inaccessibleIds, latestErrors, actionError, loading, error, busyId, selectedId, selected,
  selectedOutput, reference, cards, select, editorOpen, editing, openEditor, closeDrawer, dismissDrawer, takeFocusReference, saved, refresh, setEnabled, remove } = useMetricPanel(toRef(props, 'context'), undefined, toRef(props, 'initialReference'))
const cardElements = new Map<string, HTMLButtonElement>()
function setCardElement(reference: MetricReference, element: Element | ComponentPublicInstance | null) {
  const key = JSON.stringify([reference.configId, reference.outputId])
  if (element instanceof HTMLButtonElement) cardElements.set(key, element)
  else cardElements.delete(key)
}
/** Shell 将该事件透传到 Ant Drawer；退场结束后回焦，保留概览原滚动位置。 */
function restoreCardFocus(open: boolean) {
  if (open) return
  const target = takeFocusReference()
  const element = target && cardElements.get(JSON.stringify([target.configId, target.outputId]))
  if (element?.isConnected && !element.disabled) element.focus({ preventScroll: true })
}
const configName = (config: MetricConfig) => config.name || templates.value[config.id || '']?.name || t('unnamedConfiguration')
function createAlarm() {
  if (reference.value) emit('createAlarm', { ...reference.value, ownerType: props.context.ownerType, ownerId: props.context.ownerId })
}
function confirmDisable(config: MetricConfig) {
  Modal.confirm({ title: t('confirmDisable'), okText: t('disable'), cancelText: t('cancel'), onOk: () => setEnabled(config, false) })
}
function confirmRemove(config: MetricConfig) {
  Modal.confirm({ title: t('confirmDeleteMetric'), okText: t('deleteMetric'), cancelText: t('cancel'), okButtonProps: { danger: true }, onOk: async () => { if (!await remove(config)) throw new Error(t('deleteFailed')) } })
}
function openDetailLink() {
  if (props.detailLinkLabel && reference.value) emit('openDetailLink', { ...reference.value, ownerType: props.context.ownerType, ownerId: props.context.ownerId })
}
</script>
<style scoped>
.metric-panel { display:grid; gap:var(--space-4,16px); min-width:0; container:metric-panel / inline-size }
.metric-panel__head { display:flex; align-items:center; justify-content:space-between; gap:var(--space-3,12px) }
.metric-panel__head h3 { font-size:var(--fs-16,16px); margin:0 }
.metric-panel__grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--space-4,16px) }
.metric-panel__card { display:flex; flex-direction:column; align-items:stretch; text-align:left; gap:var(--space-1,4px); min-width:0; min-height:164px; padding:var(--space-4,16px); border:1px solid var(--line); border-radius:var(--r-3,8px); background:var(--panel-background); color:var(--ink-1); font:inherit; cursor:pointer; transition:border-color .15s }
.metric-panel__card:hover, .metric-panel__card.is-selected { border-color:var(--accent) }
.metric-panel__card:focus-visible { outline:2px solid var(--accent); outline-offset:2px }
.metric-panel__card:disabled { cursor:default }
.metric-panel__card:disabled:hover { border-color:var(--line) }
.metric-panel__card.is-stopped { background:var(--bg-sunken); color:var(--ink-3) }
.metric-panel__name { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.metric-panel__alias { font-size:var(--fs-12,12px); color:var(--ink-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:var(--space-2,8px) }
.metric-panel__unavailable { display:flex; flex-direction:column; align-items:flex-start; gap:var(--space-2,8px) }
.metric-panel__unavailable strong { font-size:var(--fs-24,24px) }
.metric-panel__failure { grid-column:1/-1 }
@container metric-panel (min-width:1300px) { .metric-panel__grid { grid-template-columns:repeat(4,minmax(0,1fr)) } }
@container metric-panel (max-width:850px) { .metric-panel__grid { grid-template-columns:repeat(2,minmax(0,1fr)) } }
@container metric-panel (max-width:520px) { .metric-panel__grid { grid-template-columns:minmax(0,1fr) } }
</style>
