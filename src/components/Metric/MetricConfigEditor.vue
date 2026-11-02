<template>
  <div class="metric-config-editor">
    <a-steps :current="step" size="small" :items="steps" />
    <a-alert v-if="error || errorKind" type="error" show-icon :message="errorHeading" :description="error || undefined" />
    <a-button v-if="errorKind === 'save' && draft.id" :loading="snapshotLoading" @click="readSaved">{{ t('reload') }}</a-button>
    <a-alert v-if="savedSnapshot" type="warning" show-icon :message="t('savedConfiguration')">
      <template #description>
        <div>{{ savedSnapshot.name || selectedTemplate?.name }} · {{ savedSnapshot.templateVersion }}</div>
        <div v-for="input in selectedTemplate?.inputDefinitions" :key="input.id">
          {{ input.name || input.id }}: {{ snapshotSource(input.id) }}
        </div>
        <div v-for="parameter in parameters" :key="parameter.id">
          {{ parameter.name || parameter.id }}: {{ metricValueText(savedSnapshot.parameters[parameter.id] ?? selectedTemplate?.parameters[parameter.id]) }}
        </div>
        <a-popconfirm :title="t('replaceEdits')" @confirm="useSaved"><a-button size="small">{{ t('useSaved') }}</a-button></a-popconfirm>
      </template>
    </a-alert>
    <a-spin :spinning="loading">
      <template v-if="step === 0">
        <SectionCard :title="t('selectTemplate')" icon="AppstoreOutlined">
          <a-select v-model:value="templateSelection" :placeholder="t('selectTemplate')" class="metric-full-width">
            <a-select-option v-for="item in templates" :key="item.id" :value="templateKey(item.template)">
              {{ item.template.name }} · {{ item.template.version }}
            </a-select-option>
          </a-select>
          <a-empty v-if="!loading && !templates.length" :description="t('noTemplate')" />
          <ul v-if="selectedTemplate" class="metric-outputs">
            <li v-for="output in selectedTemplate.outputs" :key="output.metricId">
              {{ metricOutputName(output, selectedTemplate) || t('unnamedOutput') }} <span v-if="output.unit">· {{ output.unit }}</span>
            </li>
          </ul>
        </SectionCard>
      </template>
      <template v-else-if="step === 1">
        <MetricExtension v-if="presentationProvider?.configFields && selectedTemplate" :content="presentationProvider.configFields" :content-props="{ context, template: selectedTemplate, draft: readonly(draft), pickSource }" @change="changeConfigFields" @failed="extensionFailed = true">
          <template #fallback><a-alert type="error" show-icon :message="t('presentationFailed')" /></template>
        </MetricExtension>
        <template v-else-if="!presentationMissing">
        <SectionCard :title="t('bindData')" icon="LinkOutlined">
          <a-alert v-if="!pickSource" type="warning" :message="t('noSourcePicker')" />
          <div v-for="input in selectedTemplate?.inputDefinitions" :key="input.id" class="metric-binding">
            <div><b>{{ input.name || input.id }}</b><span v-if="input.unit"> · {{ input.unit }}</span></div>
            <div class="metric-binding__source">{{ sourceLabel(input.id) }}</div>
            <a-button :disabled="!pickSource" :loading="choosing === input.id" @click="choose(input)">
              {{ t(draft.inputMappings[input.id] ? 'changeSource' : 'chooseSource') }}
            </a-button>
          </div>
        </SectionCard>
        </template>
        <SectionCard :title="t('parameters')" icon="SlidersOutlined">
          <MetricParameters :definitions="parameters" :values="draft.parameters" :defaults="selectedTemplate?.parameters || {}"
            @change="(id, value) => draft.parameters[id] = value" />
        </SectionCard>
      </template>
      <template v-else-if="step === 2">
        <SectionCard :title="t('review')" icon="CheckCircleOutlined">
          <a-form layout="vertical">
            <a-form-item :label="t('name')" html-for="metric-config-name"><a-input id="metric-config-name" v-model:value="draft.name" :placeholder="selectedTemplate?.name" /></a-form-item>
          </a-form>
          <a-descriptions :column="1" size="small">
            <a-descriptions-item :label="t('template')">{{ selectedTemplate?.name }} · {{ draft.templateVersion }}</a-descriptions-item>
            <a-descriptions-item v-for="input in selectedTemplate?.inputDefinitions" :key="input.id" :label="input.name || input.id">
              {{ sourceLabel(input.id) }}
            </a-descriptions-item>
            <a-descriptions-item v-for="parameter in parameters" :key="parameter.id" :label="parameter.name || parameter.id">
              {{ metricValueText(draft.parameters[parameter.id] ?? selectedTemplate?.parameters[parameter.id]) }}
            </a-descriptions-item>
          </a-descriptions>
        </SectionCard>
      </template>
      <SectionCard v-else :title="t('finish')" icon="CheckOutlined">
        <a-alert v-if="draft.id && draft.state === 'enabled'" type="info" show-icon :message="t('saveDisableHint')" />
        <a-descriptions :column="1">
          <a-descriptions-item :label="t('name')">{{ draft.name || selectedTemplate?.name }}</a-descriptions-item>
          <a-descriptions-item :label="t('output')">{{ selectedTemplate?.outputs.map(item => metricOutputName(item, selectedTemplate) || t('unnamedOutput')).join(' / ') }}</a-descriptions-item>
        </a-descriptions>
      </SectionCard>
      <a-alert v-if="presentationMissing" type="warning" show-icon :message="t('presentationMissing')" />
      <a-collapse v-if="selectedTemplate && !presentationMissing">
        <a-collapse-panel key="display" :header="t('displaySettings')">
          <MetricDisplayFields :model-value="normalizePresentation(draft.presentation)" :defaults="normalizePresentation(selectedTemplate.options?.presentation?.settings)" :provider="presentationProvider" :disabled="!context.editable || saving" @update:model-value="value => draft.presentation = value" @failed="extensionFailed = true" />
        </a-collapse-panel>
      </a-collapse>
    </a-spin>
    <StickyActionBar>
      <a-button :disabled="saving" @click="emit('cancel')">{{ t('cancel') }}</a-button>
      <a-button v-if="step > 0" :disabled="saving" @click="step--">{{ t('previous') }}</a-button>
      <a-button v-if="step < 3" type="primary" :disabled="loading || !selectedTemplate" @click="next">{{ t('next') }}</a-button>
      <template v-else>
        <a-button :loading="saving" :disabled="!context.editable || presentationMissing || extensionFailed" @click="submit(false)">{{ t(draft.id && draft.state === 'enabled' ? 'saveDisable' : 'save') }}</a-button>
        <a-button type="primary" :loading="saving" :disabled="!context.editable || presentationMissing || extensionFailed" @click="submit(true)">{{ t('saveEnable') }}</a-button>
      </template>
    </StickyActionBar>
  </div>
</template>
<script setup lang="ts">
import { computed, readonly, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SectionCard from '../SectionCard/index.vue'
import StickyActionBar from '../StickyActionBar/index.vue'
import MetricParameters from './MetricParameters.vue'
import { useMetricEditor } from './useMetricEditor'
import { templateKey } from './service'
import { metricOutputName, metricValueText } from './presentation'
import { metricMessages } from './messages'
import MetricExtension from './extensions/MetricExtension.vue'
import MetricDisplayFields from './extensions/MetricDisplayFields.vue'
import { applyMetricConfigFields, normalizePresentation } from './extensions/presentationSettings'
import type { MetricConfig, MetricConfigFieldsPatch, MetricContext, MetricSourcePicker } from './types'
const props = defineProps<{ context: MetricContext; configuration?: MetricConfig; pickSource?: MetricSourcePicker }>()
const emit = defineEmits<{ (event: 'saved', configuration: MetricConfig): void; (event: 'cancel'): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { draft, templates, selectedTemplate, templateSelection, parameters, step, loading, saving, choosing,
  error, errorKind, sourceLabels, savedSnapshot, snapshotLoading, presentation, extensionFailed, choose, next, save, readSaved, useSaved } = useMetricEditor(toRef(props, 'context'), toRef(props, 'configuration'), toRef(props, 'pickSource'))
const { provider: presentationProvider, missing: presentationMissing } = presentation
function changeConfigFields(patch: MetricConfigFieldsPatch) {
  if (props.context.editable && selectedTemplate.value) draft.value = applyMetricConfigFields(draft.value, selectedTemplate.value, patch)
}
const steps = computed(() => ['selectTemplate', 'bindData', 'review', 'finish'].map(key => ({ title: t(key) })))
const errorHeading = computed(() => t(errorKind.value === 'presentation' ? 'presentationFailed' : errorKind.value === 'activation' ? 'activationFailed' :
  errorKind.value === 'binding' ? (selectedTemplate.value ? 'missingBindings' : 'selectRequired') :
    errorKind.value === 'save' ? 'saveFailed' : 'readFailed'))
function sourceLabel(inputId: string) {
  const mapping = draft.value.inputMappings[inputId]
  return sourceLabels.value[inputId] || (mapping ? [mapping.thingId || draft.value.targetId, mapping.id].join(' · ') : t('notBound'))
}
function snapshotSource(inputId: string) {
  const mapping = savedSnapshot.value?.inputMappings[inputId]
  return mapping ? [mapping.thingId || savedSnapshot.value?.targetId, mapping.id].join(' · ') : t('notBound')
}
async function submit(activate: boolean) { const saved = await save(activate); if (saved) emit('saved', saved) }
</script>
<style scoped>
.metric-config-editor { display:grid; gap:var(--space-4,16px) }
.metric-full-width { width:100% }
.metric-outputs { margin:0; padding-left:var(--space-4,16px); color:var(--ink-3) }
.metric-binding { display:grid; grid-template-columns:minmax(100px,1fr) minmax(100px,2fr) auto; gap:var(--space-3,12px); align-items:center; padding:var(--space-3,12px) 0; border-bottom:1px solid var(--line) }
.metric-binding__source { color:var(--ink-3); overflow-wrap:anywhere }
@media(max-width:600px) { .metric-binding { grid-template-columns:1fr auto } .metric-binding__source { grid-column:1/-1; grid-row:2 } }
</style>
