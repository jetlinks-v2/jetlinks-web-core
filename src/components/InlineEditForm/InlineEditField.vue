<template>
  <div class="inline-edit-field" :class="{ 'inline-edit-field--wide': field.fullWidth, 'inline-edit-field--detail': mode === 'detail' }" @focusin="emit('focus', field.key)">
    <label :id="labelId" :for="inputId" class="inline-edit-field__label"><span v-if="mode === 'form' && field.required" class="inline-edit-field__required">*</span>{{ field.label }}</label>
    <div v-if="field.readonly || (!active && field.editTrigger === 'manual')" :id="inputId" ref="trigger" class="inline-edit-field__value" :tabindex="field.readonly ? undefined : -1"><slot name="display" :field="field">{{ display }}</slot></div>
    <button v-else-if="!active" :id="inputId" ref="trigger" type="button" class="inline-edit-field__trigger inline-edit-trigger" :disabled="locked" :aria-labelledby="`${labelId} ${valueId}`" :aria-describedby="describedBy" @click="begin">
      <span :id="valueId" class="inline-edit-field__display"><slot name="display" :field="field">{{ display }}</slot></span><DownOutlined v-if="field.editor === 'select'" class="inline-edit-field__arrow" aria-hidden="true" />
    </button>
    <div v-else ref="editor" class="inline-edit-field__editor" :class="{ 'inline-edit-surface': mode === 'detail' && field.editor !== 'custom', 'inline-edit-field__editor--content': contentSized }" :aria-busy="pending" :aria-disabled="locked || undefined" :aria-invalid="error ? true : undefined" @keydown="keydown" @focusout="field.editor !== 'custom' && blur($event)">
      <span v-if="contentSized" class="inline-edit-field__measure" :class="{ 'inline-edit-field__measure--suffix': field.editor === 'number' || field.editor === 'password' }" aria-hidden="true">{{ field.editor === 'password' ? '•'.repeat(textValue.length) : field.editor === 'number' ? numberValue : textValue || field.placeholder }}</span>
      <div v-if="field.editor === 'custom'" :inert="locked || undefined"><slot name="editor" :field="field" :value="value" :update="update" :commit="commit" :cancel="cancel" :blur="blur" :disabled="locked" :loading="pending" :input-id="inputId" :label-id="labelId" :described-by="describedBy" :error="error" /></div>
      <Select v-else-if="field.editor === 'select'" v-bind="controlAttrs" :id="inputId" :value="selectValue" :options="field.options" :disabled="locked" :loading="pending" :default-open="mode === 'detail'" :placeholder="field.placeholder" :status="error ? 'error' : undefined" allow-clear :get-popup-container="popupContainer" @update:value="update" @change="commit" />
      <InputNumber v-else-if="field.editor === 'number'" v-bind="controlAttrs" :id="inputId" :value="numberValue" :min="field.min" :max="field.max" :precision="field.precision" :disabled="locked" :status="error ? 'error' : undefined" @update:value="update($event ?? undefined)" />
      <InputPassword v-else-if="field.editor === 'password'" v-bind="controlAttrs" :id="inputId" :value="textValue" :disabled="locked" :placeholder="field.placeholder" :status="error ? 'error' : undefined" autocomplete="new-password" @update:value="update" />
      <Textarea v-else-if="field.editor === 'textarea'" v-bind="controlAttrs" :id="inputId" :value="textValue" :disabled="locked" :maxlength="field.maxLength" :status="error ? 'error' : undefined" @update:value="update" />
      <Input v-else v-bind="controlAttrs" :id="inputId" :value="textValue" :disabled="locked" :placeholder="field.placeholder" :maxlength="field.maxLength" :status="error ? 'error' : undefined" @update:value="update" />
    </div>
    <p v-if="error" :id="errorId" class="inline-edit-field__error" role="alert">{{ error }}</p>
    <p v-else-if="field.hint" :id="hintId" class="inline-edit-field__hint">{{ field.hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useId, watch, type PropType } from 'vue'
import { Input, InputNumber, Select } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'
import type { InlineEditEditorScope, InlineEditFieldDefinition, InlineEditMessages, InlineEditSubmit } from './types'
import { useInlineEditField } from './useInlineEditField'
const InputPassword = Input.Password
const Textarea = Input.TextArea
const props = defineProps({
  field: { type: Object as PropType<InlineEditFieldDefinition>, required: true },
  mode: { type: String as PropType<'detail' | 'form'>, default: 'detail' },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  messages: { type: Object as PropType<InlineEditMessages>, required: true },
  submit: { type: Function as PropType<InlineEditSubmit>, default: undefined },
})
const emit = defineEmits<{ (event: 'change', key: string, value: unknown): void; (event: 'focus' | 'cancel', key: string): void }>()
defineSlots<{ editor?: (scope: InlineEditEditorScope) => unknown; display?: (scope: { field: InlineEditFieldDefinition }) => unknown }>()
const { value, active, pending, locked, error, display, begin, update, cancel, commit, blur, keydown } = useInlineEditField(props, (key, next) => emit('change', key, next), key => emit('cancel', key))
const trigger = ref<HTMLElement>()
const inputId = useId()
const labelId = `${inputId}-label`
const valueId = `${inputId}-value`
const errorId = `${inputId}-error`
const hintId = `${inputId}-hint`
const describedBy = computed(() => error.value ? errorId : props.field.hint ? hintId : undefined)
const controlAttrs = computed(() => ({ bordered: props.mode === 'form', 'aria-describedby': describedBy.value, 'aria-invalid': error.value ? true : undefined }))
const editor = ref<HTMLElement>()
const textValue = computed(() => typeof value.value === 'string' ? value.value : '')
const numberValue = computed(() => typeof value.value === 'number' ? value.value : undefined)
const selectValue = computed(() => typeof value.value === 'string' || typeof value.value === 'number' ? value.value : undefined)
const contentSized = computed(() => props.mode === 'detail' && !['custom', 'select'].includes(props.field.editor || 'text'))
const popupContainer = (element: HTMLElement) => element.parentElement || element
defineExpose({ begin })
watch(active, async open => {
  if (props.mode === 'form') return
  await nextTick()
  if (open) editor.value?.querySelector<HTMLElement>('input, textarea, [tabindex]')?.focus()
  // A successful operation may open another field; never steal focus back from that editor.
  else if (typeof document !== 'undefined' && document.activeElement === document.body) trigger.value?.focus()
})
</script>

<style scoped>
.inline-edit-field { min-width: 0; }
.inline-edit-field--wide { grid-column: 1 / -1; }
.inline-edit-field__label { display: block; margin-bottom: var(--space-2); font-size: var(--fs-12); color: var(--text-color-secondary); }
.inline-edit-field__required { color: var(--ant-color-error, var(--error-color)); margin-right: var(--space-1); }
.inline-edit-field__trigger { display: inline-flex; align-items: center; gap: var(--space-2); max-width: 100%; min-height:32px; padding: var(--space-1) var(--space-2); margin-left: calc(-1 * var(--space-2)); border: 0; color: var(--jet-theme-text-title); background: transparent; font: inherit; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: pointer; }
.inline-edit-field__trigger, .inline-edit-field__value, .inline-edit-field__editor { font-size: var(--fs-14); }
.inline-edit-field__display { min-width: 0; }
.inline-edit-field__arrow { flex: none; font-size: var(--fs-12); line-height: 1; }
.inline-edit-field__trigger:disabled { cursor: default; }
.inline-edit-field__trigger:focus-visible { outline: 2px solid var(--ant-color-primary, var(--jet-primary-color)); outline-offset: 2px; }
.inline-edit-field__value { overflow-wrap: anywhere; white-space: pre-wrap; }
.inline-edit-field__editor { min-width: 0; }
.inline-edit-field__editor--content { display:inline-grid; grid-template-columns:minmax(0,auto); min-width:1ch; max-width:min(100%,var(--inline-edit-max-width,100%)); }
.inline-edit-field__measure { grid-area:1/1; visibility:hidden; white-space:pre; min-height:32px; overflow:hidden; }
.inline-edit-field__measure--suffix { padding-inline-end:var(--space-6,24px); }
.inline-edit-field__editor--content > :not(.inline-edit-field__measure) { grid-area:1/1; min-width:0; }
.inline-edit-field__editor--content :deep(.ant-input), .inline-edit-field__editor--content :deep(.ant-input-affix-wrapper), .inline-edit-field__editor--content :deep(.ant-input-number) { padding-inline:0; border:0; box-shadow:none; font:inherit; }
.inline-edit-field__editor--content :deep(.ant-input-number-input) { padding-inline:0; font:inherit; }
.inline-edit-field__editor :deep(.ant-input-number), .inline-edit-field__editor :deep(.ant-select) { width: 100%; }
.inline-edit-field__hint, .inline-edit-field__error { margin: var(--space-1) 0 0; font-size: var(--fs-12); line-height: 1.75; overflow-wrap: anywhere; }
.inline-edit-field__hint { color: var(--text-color-secondary); }
.inline-edit-field__error { color: var(--ant-color-error, var(--error-color)); }
</style>
<style src="../Editable/inline-edit.css" />
