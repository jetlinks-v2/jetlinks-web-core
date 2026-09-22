<template>
  <div v-if="!textarea" class="i18n-input-field">
    <a-input
      v-bind="$attrs"
      :value="value"
      @update:value="handleValueChange"
    />
    <I18nInputTrigger class="i18n-input-field__trigger" @configure="visible = true" />
  </div>
  <div v-else class="i18n-textarea-field">
    <a-textarea
      v-bind="$attrs"
      :value="value"
      @update:value="handleValueChange"
    />
    <I18nInputTrigger class="i18n-textarea-field__trigger" @configure="visible = true" />
  </div>
  <a-form-item-rest>
    <I18nTextDialog
      v-if="visible"
      :visible="visible"
      :title="dialogTitle"
      :data="fieldI18nMessages"
      :display-value="value"
      :max-length="i18nMaxLength"
      :textarea="textarea"
      @update:visible="visible = $event"
      @confirm="saveI18nMessages"
    />
  </a-form-item-rest>
</template>

<script setup lang="ts">
import I18nInputTrigger from './I18nInputTrigger.vue'
import I18nTextDialog from './I18nTextDialog.vue'
import { useI18nTextField } from './hooks/useI18nTextField'

defineOptions({ inheritAttrs: false })

// 保留内联宏类型，兼容当前 setup-name-support 插件的匿名 SFC 预编译。
const props = withDefaults(defineProps<{
  value?: string
  i18nMessages?: Record<string, Record<string, string>>
  field: string
  label: string
  i18nMaxLength?: number
  textarea?: boolean
}>(), {
  value: '',
  i18nMessages: () => ({}),
  i18nMaxLength: 200,
  textarea: false,
})
const emit = defineEmits<{
  (event: 'update:value', value: string): void
  (event: 'update:i18nMessages', value: Record<string, Record<string, string>>): void
}>()
const { visible, fieldI18nMessages, dialogTitle, handleValueChange, saveI18nMessages } = useI18nTextField(props, emit)
</script>

<style scoped lang="less">
.i18n-textarea-field {
  position: relative;
}

.i18n-input-field {
  position: relative;
}

.i18n-input-field__trigger {
  position: absolute;
  top: 50%;
  right: var(--space-2);
  z-index: 1;
  transform: translateY(-50%);
}

.i18n-input-field :deep(.ant-input) {
  padding-right: var(--space-8);
}

.i18n-input-field :deep(.ant-input-clear-icon) {
  margin-right: var(--space-5);
}

.i18n-textarea-field__trigger {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
}

.i18n-textarea-field :deep(.ant-input-textarea-show-count::after) {
  padding-right: var(--space-5);
}
</style>
