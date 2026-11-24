<template>
  <div ref="root" class="i18n-text-editor" @keydown="keydown">
    <a-form ref="formRef" :name="formId" :model="formData" :rules="rules" :layout="textarea ? 'vertical' : 'horizontal'" label-align="left" :label-col="textarea ? undefined : { span: 6 }" :wrapper-col="textarea ? undefined : { span: 18 }" :colon="false">
      <a-tabs v-if="textarea" v-model:active-key="activeLanguage" size="small">
        <a-tab-pane v-for="language in languages" :key="language.code" :tab="language.label" force-render>
          <div class="i18n-text-editor__language" :data-language="language.code">
            <a-form-item :name="language.code">
              <a-textarea v-model:value="formData[language.code]" :aria-label="language.label" :auto-size="{ minRows: 5, maxRows: 12 }" :maxlength="maxLength" :placeholder="placeholder(language.label)" show-count />
            </a-form-item>
          </div>
        </a-tab-pane>
      </a-tabs>
      <template v-else>
        <a-form-item v-for="language in languages" :key="language.code" :label="language.label" :name="language.code">
          <a-input v-model:value="formData[language.code]" :maxlength="maxLength" :placeholder="placeholder(language.label)" />
        </a-form-item>
      </template>
    </a-form>
    <div v-if="actions" class="i18n-text-editor__footer">
      <a-button size="small" @click="handleCancel">{{ t('I18n.cancel') }}</a-button>
      <a-button type="primary" size="small" :loading="confirming" @click="confirm">{{ t('I18n.confirm') }}</a-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElementVisibility } from '@vueuse/core'
import { useI18nTextDialog } from './hooks/useI18nTextDialog'
import type { I18nTextDialogProps, I18nTextMessages } from './types'

const props = withDefaults(defineProps<I18nTextDialogProps & { actions?: boolean }>(), {
  data: () => ({}), maxLength: 200, textarea: false, actions: true,
})
const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm', value: I18nTextMessages): void
}>()
const { t } = useI18n()
const formId = `i18n-text-${useId()}`
const { formRef, formData, languages, activeLanguage, rules, confirming, handleCancel, handleOk } = useI18nTextDialog(props, emit)
const root = ref<HTMLElement>()
const shown = useElementVisibility(root)
const placeholder = (language: string) => props.displayValue
  ? t('I18n.fallback', { value: props.displayValue }) : t('I18n.placeholder', { language })

function focus() {
  const selector = props.textarea
    ? `[data-language="${activeLanguage.value}"] textarea` : 'input:not(:disabled)'
  root.value?.querySelector?.<HTMLInputElement | HTMLTextAreaElement>(selector)?.focus({ preventScroll: true })
}
async function confirm() {
  if (await handleOk() === false) { await nextTick(); focus() }
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    handleCancel()
  } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    void confirm()
  }
}
watch([() => props.visible, shown], ([visible, rendered]) => {
  if (visible && rendered) focus()
}, { flush: 'post' })
defineExpose({ confirm, cancel: handleCancel, confirming })
</script>
<style scoped>
.i18n-text-editor :deep(.ant-form-item) { margin-bottom:var(--space-3,12px) }
.i18n-text-editor :deep(.ant-tabs-nav) { margin-bottom:var(--space-3,12px) }
.i18n-text-editor__footer { display:flex; justify-content:flex-end; gap:var(--space-2,8px) }
</style>
