<template>
  <div class="model-parameter-editor__others-panel">
    <div class="model-parameter-editor__others-head">
      <span>{{ locale.othersDescription }}</span>
    </div>
    <MonacoEditor
      :model-value="text"
      class="model-parameter-editor__others-editor"
      theme="vs"
      language="json"
      :read-only="!editing"
      :blur-format="true"
      :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
      @update:model-value="emit('update:text', $event)"
    />
    <span v-if="invalid" class="model-parameter-editor__json-error">{{ locale.invalidJson }}</span>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import type { ModelParameterLocale } from './types'

defineProps({
  text: {
    type: String,
    required: true
  },
  invalid: {
    type: Boolean,
    default: false
  },
  locale: {
    type: Object as PropType<ModelParameterLocale>,
    required: true
  },
  editing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (event: 'update:text', value: string): void
}>()
</script>

<style src="./style.less" scoped lang="less"></style>
