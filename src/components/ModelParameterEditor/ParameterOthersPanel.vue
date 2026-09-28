<template>
  <div class="model-parameter-editor__others-panel">
    <div class="model-parameter-editor__others-head">
      <span>{{ locale.othersDescription }}</span>
    </div>
    <SectionCard
      class="model-parameter-editor__others-section"
      icon="EditOutlined"
      :title="locale.roiDrawing"
    >
      <div class="model-parameter-editor__others-form" role="group" :aria-label="locale.roiDrawing">
        <div
          v-for="item in options"
          :key="item.key"
          class="model-parameter-editor__others-option"
        >
          <span class="model-parameter-editor__others-label">{{ item.label }}</span>
          <a-switch
            :checked="capabilities[item.key]"
            :disabled="!editing"
            :aria-label="item.label"
            @change="emit('change', { capability: item.key, enabled: $event === true })"
          />
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import SectionCard from '../SectionCard/index.vue'
import { getModelRoiCapabilities } from './modelParameterUtils'
import type { ModelParameterLocale, ModelRoiCapability } from './types'

const props = defineProps({
  value: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({})
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
  (event: 'change', value: { capability: ModelRoiCapability; enabled: boolean }): void
}>()

const capabilities = computed(() => getModelRoiCapabilities(props.value))
const options = computed<Array<{ key: ModelRoiCapability; label: string }>>(() => [
  { key: 'area', label: props.locale.roiArea },
  { key: 'line', label: props.locale.roiLine },
  { key: 'entryExitLine', label: props.locale.roiEntryExitLine }
])
</script>

<style src="./style.less" scoped lang="less"></style>
