<template>
  <div ref="root" class="fw-renderer">
    <slot name="header" />
    <div v-if="!readonly || session.failure.value || errorCount" class="fw-actions" aria-live="polite">
      <div class="fw-feedback" role="status">
        <Alert v-if="session.failure.value" type="error" :message="session.failure.value" :title="session.failure.value" show-icon />
        <span v-else-if="errorCount" role="alert" :title="firstError">{{ firstError }}</span>
        <span v-else-if="dirtyCount && !$slots.actions" class="fw-dirty">{{ t('dirty', { count: dirtyCount }) }}</span>
      </div>
      <slot v-if="!readonly" name="actions" :changes="session.changes.value" :dirty="dirtyCount" :saving="session.saving.value" :save="save" :restore="restoreAll">
        <Button type="text" :disabled="!dirtyCount || session.saving.value" @click="restoreAll">{{ t('undo') }}</Button>
        <Button v-if="submit" type="primary" :loading="session.saving.value" :disabled="!session.dirty.value && !active" @click="save">{{ t('save') }}</Button>
      </slot>
    </div>
    <FormCanvas :fields="fields" :layout="layout" :values="session.values.value" :access="access">
      <template #label="{ field, item }">
        <span :title="text(field, 'description')" class="fw-label-text">{{ label(field, item) }}</span>
        <Button v-if="Object.hasOwn(session.changes.value, field.key)" type="text" size="small" class="fw-change" :disabled="session.saving.value" :aria-label="t('restoreField', { label: label(field, item) })" @pointerdown.prevent @click="restoreField(field.key)"><span class="fw-change-normal">{{ t('changed') }}</span><span class="fw-change-hover">↶ {{ t('restore') }}</span></Button>
      </template>
      <template #value="{ field, item, access: capability, value }">
        <div v-if="active === field.key" class="fw-active" :data-editor="field.key" @keydown="activeKeydown">
          <slot v-if="field.type === 'custom'" :name="`editor-${field.renderer || field.key}`" :field="field" :item="item" :value="draft" :update="updateDraft" :confirm="confirm" :cancel="cancel" />
          <FormValueEditor v-else :key="field.key" :field="field" :item="item" :value="draft" :original-value="value" :min-height="editorHeight" @update="updateDraft" @confirm="confirmEditor" @cancel="cancel" @navigate="navigate" />
        </div>
        <template v-else-if="capability === 'denied'"><FormValue :field="field" :item="item" denied /></template>
        <div v-else class="fw-value-target" :class="{ 'fw-editable': editable(field) }">
          <div :role="editable(field) && field.type !== 'custom' ? 'button' : undefined" :tabindex="editable(field) && field.type !== 'custom' ? 0 : undefined" :aria-label="editable(field) && field.type !== 'custom' ? t('edit', { label: label(field, item) }) : undefined" @click="activateValue($event, field)" @keydown="activateValue($event, field)">
            <slot :name="`value-${field.renderer || field.key}`" :field="field" :item="item" :value="value"><FormValue :field="field" :item="item" :value="value" /></slot>
          </div>
          <Button v-if="editable(field)" type="text" size="small" class="fw-edit-icon" :aria-label="t('edit', { label: label(field, item) })" @click="begin(field)">✎</Button>
        </div>
        <span v-if="session.errors.value[field.key]" class="fw-field-error" role="alert">{{ session.errors.value[field.key] }}</span>
      </template>
      <template #empty><div class="fw-empty-page">{{ t('nothing') }}</div></template>
    </FormCanvas>
  </div>
</template>

<script setup lang="ts">
import { useSlots, type PropType } from 'vue'
import { Alert, Button } from 'ant-design-vue'
import FormCanvas from './FormCanvas.vue'
import FormValue from './FormValue.vue'
import FormValueEditor from './FormValueEditor.vue'
import { useFormRenderer } from './useFormRenderer'
import type { FormAccess, FormField, FormLayout, FormSubmit, FormValidate, FormValues } from './types'
import './form.css'

const props = defineProps({
  fields: { type: Array as PropType<FormField[]>, required: true },
  layout: { type: Object as PropType<FormLayout>, required: true },
  values: { type: Object as PropType<FormValues>, required: true },
  access: Object as PropType<FormAccess>,
  readonly: Boolean,
  submit: Function as PropType<FormSubmit>,
  validate: Function as PropType<FormValidate>,
})
const emit = defineEmits<{
  (event: 'change' | 'saved', values: FormValues): void
  (event: 'dirty-change', dirty: boolean): void
  (event: 'external-change', keys: string[]): void
}>()
const { t, text, label, root, active, draft, editorHeight, session, dirtyCount, errorCount, firstError, editable, updateDraft, begin, activateValue, activeKeydown, confirm, confirmEditor, cancel, navigate, restoreField, restoreAll, save } = useFormRenderer(props, useSlots(), {
  change: values => emit('change', values), saved: values => emit('saved', values), dirty: dirty => emit('dirty-change', dirty), externalChange: keys => emit('external-change', keys),
})
defineExpose({ save, restore: restoreAll })
</script>

<style scoped>
.fw-renderer { min-width: 0; }
.fw-actions { display: flex; align-items: center; gap: 8px; position: sticky; top: 0; min-height: 36px; background: var(--bg, #fff); z-index: 2; }
.fw-actions > :deep(.ant-btn) { flex-shrink: 0; }
.fw-dirty { color: var(--jet-theme-text-secondary, #697586); }
.fw-feedback { flex: 1; min-width: 0; color: var(--err, #cf3535); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fw-feedback :deep(.ant-alert) { padding: 0; border: 0; background: transparent; }
.fw-feedback :deep(.ant-alert-message) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fw-label-text { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fw-label-text:has(+ .fw-change) { max-width: calc(100% - 76px); }
.fw-change.ant-btn { position: absolute; right: 0; top: 0; height: 22px; padding: 0 6px; min-width: 60px; font-size: 11px; line-height: 22px; color: #916820; background: #fff7e6; border: none; }
.fw-change-hover { display: none; }
@media (hover: hover) { .fw-change:hover .fw-change-normal { display: none; } .fw-change:hover .fw-change-hover { display: inline; } }
.fw-value-target { display: inline-flex; align-items: flex-start; gap: 6px; max-width: 100%; min-height: 26px; vertical-align: top; }
.fw-value-target > div { min-width: 0; }
.fw-editable > [role="button"] { cursor: text; border-radius: 3px; outline-offset: 3px; }
.fw-edit-icon.ant-btn { flex-shrink: 0; width: 26px; height: 26px; padding: 0; opacity: 0; background: transparent; color: var(--jet-theme-text-secondary, #8d9399); }
.fw-value-target:hover .fw-edit-icon, .fw-value-target:focus-within .fw-edit-icon { opacity: 1; }
.fw-field-error { position: absolute; left: 0; bottom: -20px; max-width: 100%; font-size: 11px; line-height: 18px; color: var(--err, #cf3535); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fw-empty-page { color: var(--jet-theme-text-secondary, #8d9399); padding: 24px 0; }
@media (max-width: 600px) { .fw-actions { min-height: 44px; } .fw-actions :deep(.ant-btn) { min-height: 44px; } }
@media (pointer: coarse) { .fw-edit-icon.ant-btn { opacity: 1; width: 26px; height: 26px; position: relative; } .fw-edit-icon.ant-btn::before { content: ''; display: block; position: absolute; inset: -9px; } .fw-change.ant-btn { min-width: 74px; } .fw-change.ant-btn::before { content: ''; display: block; position: absolute; inset: -11px 0; } .fw-change-normal::after { content: ' ↶'; } .fw-actions :deep(.ant-btn) { min-height: 44px; } }
</style>
