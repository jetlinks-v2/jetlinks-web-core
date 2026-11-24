<template>
  <span class="i18n-text-editable">
    <InputEditable :value="display" :label="label" trigger="text" :disabled="disabled" :size="size" :text-style="textStyle" :placeholder="placeholder || label" :max-length="i18nMaxLength" @update:value="changeValue">
      <template v-if="!disabled" #action="scope">
        <a-popover :open="visible" trigger="click" placement="bottomLeft" :title="label" @open-change="open => openTranslations(open, scope)">
          <a-button ref="translationTrigger" class="i18n-text-editable__action" type="text" size="small" :aria-label="t('I18n.configure')" :title="t('I18n.configure')" :aria-expanded="visible" aria-haspopup="dialog" @mousedown.prevent><AIcon type="GlobalOutlined" /></a-button>
          <template #content>
            <div ref="panelRef" class="i18n-text-editable__panel" role="dialog" :aria-label="label" @keydown="translationKeydown">
              <a-form ref="formRef" :model="formData" :rules="rules" layout="horizontal" label-align="left" :label-col="{ span: 6 }" :wrapper-col="{ span: 18 }" :colon="false">
                <a-form-item v-for="language in languages" :key="language.code" :label="language.label" :name="language.code">
                  <a-input v-model:value="formData[language.code]" :maxlength="i18nMaxLength" :placeholder="value ? t('I18n.fallback', { value }) : t('I18n.placeholder', { language: language.label })" />
                </a-form-item>
              </a-form>
              <div class="i18n-text-editable__footer"><a-button size="small" @click="handleCancel">{{ t('I18n.cancel') }}</a-button><a-button type="primary" size="small" @click="handleOk">{{ t('I18n.confirm') }}</a-button></div>
            </div>
          </template>
        </a-popover>
      </template>
    </InputEditable>
  </span>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementVisibility } from '@vueuse/core'
import InputEditable from '../Editable/InputEditable.vue'
import { useI18nTextField } from './hooks/useI18nTextField'
import { useI18nTextDialog } from './hooks/useI18nTextDialog'
import { i18nText } from './text'
import type { I18nTextMessages } from './types'
const props = withDefaults(defineProps<{
  value?: string; field: string; label: string; placeholder?: string; i18nMessages?: Record<string, Record<string, string>>; disabled?: boolean; i18nMaxLength?: number
  size?: 'small' | 'middle' | 'large'; textStyle?: CSSProperties
}>(), { value: '', i18nMessages: () => ({}), i18nMaxLength: 200, size: 'middle' })
const emit = defineEmits<{
  (event: 'update:value', value: string): void
  (event: 'update:i18nMessages', value: Record<string, Record<string, string>>): void
  (event: 'change', value: { value: string; i18nMessages: Record<string, Record<string, string>> }): void
}>()
const { locale, t } = useI18n()
const { visible, fieldI18nMessages, handleValueChange, saveI18nMessages } = useI18nTextField(props, emit,
  (value, i18nMessages) => emit('change', { value, i18nMessages }))
const display = computed(() => i18nText(props.value, fieldI18nMessages.value, String(locale.value)))
function changeValue(value: string) { if (!props.disabled) handleValueChange(value) }
const translationTrigger = ref<{ $el: HTMLButtonElement }>()
const panelRef = ref<HTMLElement>()
const panelVisible = useElementVisibility(panelRef)
const messagesSource = ref<I18nTextMessages>({})
const { formRef, formData, languages, rules, handleCancel, handleOk } = useI18nTextDialog({
  get visible() { return visible.value },
  get title() { return props.label },
  get data() { return messagesSource.value },
  get maxLength() { return props.i18nMaxLength },
}, translationEvent)
function translationEvent(event: 'update:visible', value: boolean): void
function translationEvent(event: 'confirm', value: I18nTextMessages): void
function translationEvent(event: 'update:visible' | 'confirm', value: boolean | I18nTextMessages) {
  if (event === 'confirm' && typeof value !== 'boolean') {
    if (!props.disabled) saveI18nMessages(value, props.value)
  } else if (typeof value === 'boolean') {
    visible.value = value
    if (!value) void nextTick(() => translationTrigger.value?.$el?.focus({ preventScroll: true }))
  }
}
function openTranslations(open: boolean, scope: { value: string; editing: boolean; cancel: () => void }) {
  if (!open) { visible.value = false; return }
  messagesSource.value = { ...fieldI18nMessages.value }
  if (scope.editing && scope.value !== display.value) {
    const language = String(locale.value).replace('_', '-').split('-')[0]
    messagesSource.value[language] = scope.value
  }
  scope.cancel()
  visible.value = true
}
function translationKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing) return
  event.preventDefault()
  event.stopPropagation()
  handleCancel()
}
watch([visible, panelVisible], ([open, shown]) => {
  if (open && shown) panelRef.value?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus({ preventScroll: true })
}, { flush: 'post' })
watch([() => props.disabled, () => props.field], () => { visible.value = false })
</script>
<style scoped>
.i18n-text-editable { display:inline-flex; align-items:center; min-width:0; max-width:100%; vertical-align:middle }
.i18n-text-editable > .input-editable { flex:0 1 auto; min-width:0 }
.i18n-text-editable__action { width:24px; height:24px; padding:0; color:var(--ink-2); opacity:0 }
.i18n-text-editable:hover .i18n-text-editable__action,.i18n-text-editable:focus-within .i18n-text-editable__action,.i18n-text-editable__action[aria-expanded="true"] { opacity:1 }
.i18n-text-editable__panel { width:min(22rem, calc(100vw - 48px)); max-height:calc(100dvh - 160px); overflow:auto }
.i18n-text-editable__panel :deep(.ant-form-item) { margin-bottom:var(--space-3,12px) }
.i18n-text-editable__footer { display:flex; justify-content:flex-end; gap:var(--space-2,8px) }
@media(hover:none) { .i18n-text-editable__action { opacity:1 } }
</style>
