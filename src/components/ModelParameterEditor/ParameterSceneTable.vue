<template>
  <div v-if="properties.length" class="model-parameter-editor__scene-list">
    <div class="model-parameter-editor__scene-table-head">
      <span>{{ locale.parameterName }}</span>
      <span>{{ locale.parameterPath }}</span>
      <span>{{ locale.parameterType }}</span>
      <span>{{ locale.parameterDescription }}</span>
      <span>{{ locale.parameterValue }}</span>
    </div>
    <div
      v-for="property in properties"
      :key="property.property"
      class="model-parameter-editor__scene-row"
    >
      <div class="model-parameter-editor__property-name" :title="property.name">
        {{ property.name }}
      </div>
      <div class="model-parameter-editor__path" :title="property.property">
        {{ property.property }}
      </div>
      <div class="model-parameter-editor__type" :title="property.typeName">
        {{ property.typeName }}
      </div>
      <div class="model-parameter-editor__description" :title="property.description || ''">
        {{ property.description }}
      </div>
      <div
        class="model-parameter-editor__value"
        :class="{
          'model-parameter-editor__value--error': invalidProperties.includes(property.property)
        }"
      >
        <ParameterField
          :property="property"
          :model-value="readPath(values, property.property)"
          :files="files"
          :locale="locale"
          :disabled="!editing"
          @update:model-value="updateValue(property.property, $event)"
        />
        <span v-if="invalidProperties.includes(property.property)" class="model-parameter-editor__value-error">
          {{ locale.pleaseEnter }}
        </span>
      </div>
    </div>
  </div>
  <a-empty v-else :description="locale.noSceneParameters" />
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import ParameterField from './ParameterField.vue'
import { readPath, type ParameterRecord } from './modelParameterUtils'
import type { ModelParameterFile, ModelParameterLocale, ModelParameterProperty } from './types'

defineProps({
  properties: {
    type: Array as PropType<ModelParameterProperty[]>,
    required: true
  },
  values: {
    type: Object as PropType<ParameterRecord>,
    required: true
  },
  invalidProperties: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  files: {
    type: Array as PropType<ModelParameterFile[]>,
    default: () => []
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
  (event: 'update:value', value: { property: string; value: unknown }): void
}>()

function updateValue(property: string, value: unknown) {
  emit('update:value', { property, value })
}
</script>

<style src="./sceneParameterTable.less" scoped lang="less"></style>
