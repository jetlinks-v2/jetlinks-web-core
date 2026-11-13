<template>
  <main class="fw-example">
    <header class="example-heading"><div><span class="example-eyebrow">{{ example.t('eyebrow') }}</span><h1>{{ example.t('title') }}</h1><p>{{ example.t('description') }}</p></div><Select :value="example.scene.value" :bordered="false" :options="[{ value: 'object', label: example.t('object') }, { value: 'workflow', label: example.t('workflow') }]" :aria-label="example.t('scene')" @change="example.switchScene(String($event))" /></header>
    <div class="example-toolbar">
      <Select v-model:value="locale" class="example-language" :aria-label="example.t('language')" :bordered="false" :options="[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]" />
      <Segmented :value="example.mode.value" :options="[{ label: example.t('design'), value: 'design' }, { label: example.t('use'), value: 'use' }, { label: 'JSON', value: 'json' }]" @change="example.setMode(String($event))" />
      <div v-if="example.mode.value === 'design'" class="example-actions"><Button type="text" @click="example.saveDraft">{{ example.t('saveDraft') }}</Button><Button v-if="example.draft.value" type="text" @click="example.restoreDraft">{{ example.t('restoreDraft') }}</Button><Button type="primary" @click="example.publish">{{ example.t('publish') }}</Button></div>
    </div>
    <div v-if="example.mode.value === 'use'" class="example-scenarios"><Checkbox v-model:checked="example.restricted.value">{{ example.t('restricted') }}</Checkbox><Checkbox v-model:checked="example.revoke.value">{{ example.t('revoke') }}</Checkbox><Checkbox v-model:checked="example.readonly.value">{{ example.t('readonly') }}</Checkbox><Checkbox v-model:checked="example.failNext.value">{{ example.t('failNext') }}</Checkbox></div>
    <p class="example-status" role="status">{{ example.status.value ? example.t(example.status.value) : '' }}</p>
    <section v-if="example.mode.value === 'json'" class="example-json"><Input.TextArea v-model:value="example.json.value" :auto-size="{ minRows: 16, maxRows: 26 }" :aria-label="example.t('layoutJson')" /><Alert v-if="example.jsonError.value" type="error" :message="example.jsonError.value" /><Button type="primary" @click="example.importJson">{{ example.t('applyJson') }}</Button></section>
    <component :is="example.mode.value === 'design' ? FormDesigner : FormRenderer" v-else :key="`${example.scene.value}:${example.mode.value}:${example.epoch.value}`" v-bind="example.bindings.value" class="example-workspace" @update:layout="example.layout.value = $event" @dirty-change="example.dirty.value = $event">
      <template #header><div class="example-summary"><span class="example-avatar">{{ example.scene.value === 'object' ? 'TH' : '申' }}</span><div><strong>{{ example.scene.value === 'object' ? example.values.value.name : example.t('request') }}</strong><div><Tag color="green">{{ example.t(example.scene.value === 'object' ? 'running' : 'pending') }}</Tag><span>{{ example.t(example.scene.value === 'object' ? 'objectContext' : 'workflowContext') }}</span></div></div></div></template>
      <template #value-sampling="{ value }"><span>{{ example.t('sampling', { interval: samplingInterval(value) }) }}</span></template>
      <template #editor-sampling="{ value, update, confirm, cancel }"><div class="example-custom-editor"><InputNumber :value="samplingInterval(value)" :min="1" :aria-label="example.t('interval')" @change="update({ interval: $event })" /><span>{{ example.t('seconds') }}</span><Button type="text" @click="cancel">{{ example.t('cancel') }}</Button><Button size="small" type="primary" @click="confirm">{{ example.t('confirm') }}</Button></div></template>
    </component>
    <details v-if="example.lastPayload.value" class="example-payload"><summary>{{ example.t('payload') }}</summary><pre>{{ example.lastPayload.value }}</pre></details>
  </main>
</template>

<script setup lang="ts">
import { Alert, Button, Checkbox, Input, InputNumber, Segmented, Select, Tag } from 'ant-design-vue'
import { FormDesigner, FormRenderer } from '../index'
import { useFormExample } from './useFormExample'
import { useI18n } from 'vue-i18n'
const example = useFormExample()
const { locale } = useI18n({ useScope: 'global' })
function samplingInterval(value: unknown): number {
  return value && typeof value === 'object' && 'interval' in value ? Number(value.interval) : 30
}
</script>

<style scoped>
.fw-example { max-width: 1040px; padding: 32px 28px 56px; margin: auto; }
.example-heading { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
.example-eyebrow { font-size: 12px; color: var(--jet-theme-text-secondary, #8d9399); }
h1 { font-size: 23px; font-weight: 600; margin: 6px 0; }
.example-heading p { font-size: 13px; color: var(--jet-theme-text-secondary, #697586); margin: 0; }
.example-heading :deep(.ant-select) { min-width: 144px; }
.example-toolbar { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.example-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.example-status { min-height: 20px; color: var(--jet-theme-text-secondary, #697586); font-size: 12px; margin: 8px 0; }
.example-workspace { background: var(--bg, #fff); }
.example-workspace.fw-renderer { border: 1px solid var(--line, #e5e9ef); border-radius: 10px; padding: 0 28px 24px; }
.example-summary { display: flex; gap: 14px; align-items: center; padding: 24px 0; border-bottom: 1px solid var(--line, #e5e9ef); }
.example-avatar { display: grid; place-items: center; width: 48px; height: 48px; flex-shrink: 0; background: var(--bg-sunken, #f0f5fa); color: var(--primary-color, #1677ff); border-radius: 12px; font-weight: 600; }
.example-summary strong { display: block; font-size: 17px; margin-bottom: 6px; }
.example-summary div div { font-size: 12px; color: var(--jet-theme-text-secondary, #697586); }
.example-scenarios { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.example-json { display: grid; gap: 16px; }
.example-json :deep(textarea) { font-family: monospace; font-size: 12px; }
.example-custom-editor { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.example-custom-editor :deep(.ant-input-number) { width: 80px; }
.example-payload { margin-top: 20px; font-size: 12px; }
.example-payload pre { overflow: auto; padding: 16px; background: var(--bg-sunken, #f5f7fa); }
@media (max-width: 600px) { .fw-example { padding: 20px 12px 32px; } .example-heading { flex-wrap: wrap; gap: 12px; } h1 { font-size: 20px; } .example-toolbar { gap: 12px; } .example-workspace.fw-renderer { padding: 0 20px 24px; } .example-actions :deep(.ant-btn) { min-height: 44px; } .example-summary strong { font-size: 15px; } }
</style>
