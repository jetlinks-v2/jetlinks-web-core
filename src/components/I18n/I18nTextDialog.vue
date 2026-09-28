<template>
  <a-modal
    :open="visible"
    :title="title"
    :width="600"
    :mask-closable="false"
    @cancel="handleCancel"
    @ok="handleOk"
  >
    <a-form ref="formRef" :model="formData" :rules="rules" layout="vertical">
      <a-form-item
        v-for="language in languages"
        :key="language.code"
        :label="language.label"
        :name="language.code"
      >
        <a-textarea
          v-if="textarea"
          v-model:value="formData[language.code]"
          :rows="4"
          :maxlength="maxLength"
          :placeholder="$t('I18n.placeholder', { language: language.label })"
          show-count
        />
        <a-input
          v-else
          v-model:value="formData[language.code]"
          :maxlength="maxLength"
          :placeholder="$t('I18n.placeholder', { language: language.label })"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { useI18nTextDialog } from './hooks/useI18nTextDialog'

// 保留内联宏类型，兼容当前 setup-name-support 插件的匿名 SFC 预编译。
const props = withDefaults(defineProps<{
  visible: boolean
  title: string
  data?: Record<string, string>
  displayValue?: string
  maxLength?: number
  textarea?: boolean
}>(), {
  data: () => ({}),
  maxLength: 200,
  textarea: false,
})
const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'confirm', value: Record<string, string>): void
}>()
const { formRef, formData, languages, rules, handleCancel, handleOk } = useI18nTextDialog(props, emit)
</script>
