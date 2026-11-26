<template>
  <span class="i18n-text-editable" :class="{ 'i18n-text-editable--multiline': textarea }">
    <InputEditable :value="display" :label="label" trigger="text" :disabled="disabled" :size="size" :text-style="textStyle" :placeholder="placeholder || label" :max-length="i18nMaxLength" :textarea="textarea" @update:value="changeValue">
      <template v-if="!disabled" #action="scope">
        <a-popover :open="visible && !mobile" trigger="click" placement="bottomLeft" :title="label" @open-change="(open: boolean) => openTranslations(open, scope)">
          <a-button ref="translationTrigger" class="i18n-text-editable__action" type="text" size="small" :aria-label="t('I18n.configure')" :title="t('I18n.configure')" :aria-expanded="visible" aria-haspopup="dialog" @mousedown.prevent><AIcon type="GlobalOutlined" /></a-button>
          <template #content>
            <div class="i18n-text-editable__panel" :class="{ 'i18n-text-editable__panel--multiline': textarea }" role="dialog" :aria-label="label">
              <I18nTextEditor :visible="visible && !mobile" :title="label" :data="messagesSource" :fallback-messages="{}" :display-value="value" :max-length="i18nMaxLength" :textarea="textarea" @confirm="translationEvent('confirm', $event)" @update:visible="translationEvent('update:visible', $event)" />
            </div>
          </template>
        </a-popover>
      </template>
    </InputEditable>
    <I18nTextDialog v-if="mobile" :visible="visible" :title="label" :data="messagesSource" :fallback-messages="{}" :display-value="value" :max-length="i18nMaxLength" :textarea="textarea"
      @confirm="translationEvent('confirm', $event)" @update:visible="translationEvent('update:visible', $event)" />
  </span>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMediaQuery } from '@vueuse/core'
import InputEditable from '../Editable/InputEditable.vue'
import { useI18nTextField } from './hooks/useI18nTextField'
import I18nTextEditor from './I18nTextEditor.vue'
import I18nTextDialog from './I18nTextDialog.vue'
import { i18nText } from './text'
import type { I18nTextMessages } from './types'
const props = withDefaults(defineProps<{
  value?: string; field: string; label: string; placeholder?: string; i18nMessages?: Record<string, Record<string, string>>; disabled?: boolean; i18nMaxLength?: number
  size?: 'small' | 'middle' | 'large'; textStyle?: CSSProperties; textarea?: boolean
}>(), { value: '', i18nMessages: () => ({}), i18nMaxLength: 200, size: 'middle', textarea: false })
const emit = defineEmits<{
  (event: 'update:value', value: string): void
  (event: 'update:i18nMessages', value: Record<string, Record<string, string>>): void
  (event: 'change', value: { value: string; i18nMessages: Record<string, Record<string, string>> }): void
}>()
const { locale, t } = useI18n()
const narrow = useMediaQuery('(max-width: 600px)')
const mobile = ref(narrow.value)
const { visible, fieldI18nMessages, handleValueChange, saveI18nMessages } = useI18nTextField(props, emit,
  (value, i18nMessages) => emit('change', { value, i18nMessages }))
// 打开期间不更换容器，避免旋转屏幕时重建翻译草稿。
watch([visible, narrow], ([, value], [wasOpen]) => { if (!wasOpen) mobile.value = value }, { flush: 'sync' })
const display = computed(() => i18nText(props.value, fieldI18nMessages.value, String(locale.value)))
function changeValue(value: string) { if (!props.disabled) handleValueChange(value) }
const translationTrigger = ref<{ $el: HTMLButtonElement }>()
const messagesSource = ref<I18nTextMessages>({})
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
watch([() => props.disabled, () => props.field], () => { visible.value = false })
</script>
<style scoped>
.i18n-text-editable { display:inline-flex; align-items:center; min-width:0; max-width:100%; vertical-align:middle }
.i18n-text-editable--multiline { display:block; width:100% }
.i18n-text-editable > .input-editable { flex:0 1 auto; min-width:0 }
.i18n-text-editable__action { width:24px; height:24px; padding:0; color:var(--ink-2); opacity:0 }
.i18n-text-editable:hover .i18n-text-editable__action,.i18n-text-editable:focus-within .i18n-text-editable__action,.i18n-text-editable__action[aria-expanded="true"] { opacity:1 }
.i18n-text-editable__panel { width:min(22rem, calc(100vw - 48px)); max-height:calc(100dvh - 160px); overflow:auto }
.i18n-text-editable__panel--multiline { width:min(36rem, calc(100vw - 48px)) }
@media(hover:none) { .i18n-text-editable__action { opacity:1 } }
@media(pointer:coarse) { .i18n-text-editable__action { min-width:44px; min-height:44px; } }
</style>
