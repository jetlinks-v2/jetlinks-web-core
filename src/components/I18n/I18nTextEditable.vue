<template>
  <span class="i18n-text-editable">
    <InputEditable :value="display" :disabled="disabled" :size="size" :text-style="textStyle" :placeholder="placeholder || label" :max-length="i18nMaxLength" @update:value="changeValue" />
    <span class="i18n-text-editable__action"><I18nInputTrigger v-if="!disabled" @configure="visible = true" /></span>
    <I18nTextDialog v-if="visible && !disabled" :visible="visible" :title="dialogTitle" :data="fieldI18nMessages" :display-value="value"
      :max-length="i18nMaxLength" @update:visible="visible = $event" @confirm="saveMessages" />
  </span>
</template>
<script setup lang="ts">
import { computed, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import InputEditable from '../Editable/InputEditable.vue'
import I18nInputTrigger from './I18nInputTrigger.vue'
import I18nTextDialog from './I18nTextDialog.vue'
import { useI18nTextField } from './hooks/useI18nTextField'
import { i18nText } from './text'
const props = withDefaults(defineProps<{
  value?: string; field: string; label: string; placeholder?: string; i18nMessages?: Record<string, Record<string, string>>; disabled?: boolean; i18nMaxLength?: number
  size?: 'small' | 'middle' | 'large'; textStyle?: CSSProperties
}>(), { value: '', i18nMessages: () => ({}), i18nMaxLength: 200, size: 'middle' })
const emit = defineEmits<{
  (event: 'update:value', value: string): void
  (event: 'update:i18nMessages', value: Record<string, Record<string, string>>): void
  (event: 'change', value: { value: string; i18nMessages: Record<string, Record<string, string>> }): void
}>()
const { locale } = useI18n()
const { visible, fieldI18nMessages, dialogTitle, handleValueChange, saveI18nMessages } = useI18nTextField(props, emit,
  (value, i18nMessages) => emit('change', { value, i18nMessages }))
const display = computed(() => i18nText(props.value, fieldI18nMessages.value, String(locale.value)))
function changeValue(value: string) { if (!props.disabled) handleValueChange(value) }
function saveMessages(value: Record<string, string>) { if (!props.disabled) saveI18nMessages(value) }
watch(() => props.disabled, disabled => { if (disabled) visible.value = false })
</script>
<style scoped>
.i18n-text-editable { display:inline-flex; align-items:center; gap:var(--space-2,8px); min-width:0; max-width:100%; vertical-align:middle }
.i18n-text-editable > .input-editable { flex:0 1 auto; min-width:0 }
.i18n-text-editable__action { display:flex; flex:none; align-items:center; justify-content:center; width:24px; height:24px }
.i18n-text-editable :deep(.ant-btn),.i18n-text-editable :deep(.i18n-input-trigger-wrapper) { opacity:0 }
.i18n-text-editable:hover :deep(.ant-btn),.i18n-text-editable:focus-within :deep(.ant-btn),.i18n-text-editable:hover :deep(.i18n-input-trigger-wrapper),.i18n-text-editable:focus-within :deep(.i18n-input-trigger-wrapper) { opacity:1 }
@media(hover:none) { .i18n-text-editable :deep(.ant-btn),.i18n-text-editable :deep(.i18n-input-trigger-wrapper) { opacity:1 } }
</style>
