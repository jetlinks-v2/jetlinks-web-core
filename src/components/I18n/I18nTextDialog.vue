<template>
  <component :is="mobile ? Drawer : Modal" :open="visible" :title="title" v-bind="mobile ? { placement: 'bottom', height: 'auto', rootClassName: 'i18n-text-sheet' } : { width: 440, centered: true, wrapClassName: 'i18n-text-modal' }" :mask-closable="false" destroy-on-close @cancel="handleCancel" @close="handleCancel" @after-open-change="$event && focusEditor()">
    <div class="i18n-text-workspace">
      <Tabs v-model:activeKey="activeLanguage" size="small">
        <Tabs.TabPane v-for="language in languages" :key="language.code">
          <template #tab><span>{{ language.label }}</span><span class="i18n-text-dot" :class="{ filled: !!formData[language.code]?.trim() }" :aria-label="t(formData[language.code]?.trim() ? 'I18n.translated' : 'I18n.untranslated')" /></template>
        </Tabs.TabPane>
      </Tabs>
      <Input.TextArea v-if="textarea" :key="activeLanguage" ref="editor" v-model:value="formData[activeLanguage]" :aria-label="t('I18n.translation')" :auto-size="{ minRows: 3, maxRows: 7 }" :placeholder="defaultText" />
      <Input v-else :key="activeLanguage" ref="editor" v-model:value="formData[activeLanguage]" :aria-label="t('I18n.translation')" :placeholder="defaultText" @keydown.enter="!$event.isComposing && $event.keyCode !== 229 && handleOk()" />
      <div class="i18n-text-meta"><span>{{ t('I18n.fallbackHint') }}</span><span>{{ formData[activeLanguage]?.length || 0 }}/{{ maxLength }}</span></div>
      <div v-if="error" role="alert" class="i18n-text-error">{{ error }}</div>
      <div class="i18n-text-preview"><span>{{ t('I18n.preview') }}</span><p>{{ preview || '—' }}</p></div>
    </div>
    <template #footer><div class="i18n-text-actions"><Button type="text" @click="handleCancel">{{ t('I18n.cancel') }}</Button><Button type="primary" @click="handleOk">{{ t('I18n.apply') }}</Button></div></template>
  </component>
</template>

<script setup lang="ts">
import { Button, Drawer, Input, Modal, Tabs } from 'ant-design-vue'
import { useI18nTextDialog } from './hooks/useI18nTextDialog'
const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  data?: Record<string, string>
  displayValue?: string
  fallbackMessages?: Record<string, string>
  maxLength?: number
  textarea?: boolean
}>(), { data: () => ({}), maxLength: 200, textarea: false })
const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm', value: Record<string, string>): void
}>()
const { t, mobile, editor, formData, languages, activeLanguage, defaultText, preview, error, handleCancel, handleOk, focusEditor } = useI18nTextDialog(props, emit)
</script>

<style scoped>
.i18n-text-workspace { padding: 0 0 4px; }
.i18n-text-dot { display: inline-block; width: 5px; height: 5px; margin-left: 7px; border: 1px solid var(--jet-theme-text-tertiary, #8d9399); border-radius: 50%; vertical-align: middle; }
.i18n-text-dot.filled { background: var(--jet-theme-primary, #1677ff); border-color: transparent; }
.i18n-text-meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; font-size: 11px; color: var(--jet-theme-text-tertiary, #8d9399); }
.i18n-text-preview { margin-top: 20px; padding: 14px 16px; border-radius: 8px; background: var(--jet-theme-fill-secondary, #f5f7fa); }
.i18n-text-preview > span { font-size: 11px; color: var(--jet-theme-text-tertiary, #8d9399); }
.i18n-text-preview p { margin: 6px 0 0; font-size: 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
.i18n-text-error { margin-top: 8px; font-size: 12px; color: var(--jet-theme-error, #cf3535); }
.i18n-text-actions { display: flex; justify-content: flex-end; gap: 8px; }
.i18n-text-actions :deep(.ant-btn) { border-radius: 6px; font-size: 12px; box-shadow: none; }
@media (max-width: 600px) { .i18n-text-actions :deep(.ant-btn) { min-height: 44px; } .i18n-text-workspace { max-height: 55dvh; overflow: auto; } }
</style>
