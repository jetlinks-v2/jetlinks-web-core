<template>
  <div class="model-parameter-editor__scene-panel">
    <div class="model-parameter-editor__scene-head">
      <span>{{ description }}</span>
      <a-segmented
        :value="mode"
        :options="modeOptions"
        size="small"
        @update:value="emit('update:mode', $event)"
      />
    </div>
    <ParameterSceneTable
      v-if="mode === 'user'"
      :properties="properties"
      :values="values"
      :invalid-properties="invalidProperties"
      :files="files"
      :locale="locale"
      :editing="editing"
      @update:value="emit('update:value', $event)"
    />
    <template v-else>
      <MonacoEditor
        :key="scene"
        :model-value="defaultText"
        class="model-parameter-editor__scene-json-editor"
        theme="vs"
        language="json"
        :read-only="!editing"
        :blur-format="true"
        :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
        @update:model-value="emit('update:defaults', $event)"
      />
      <span v-if="defaultInvalid" class="model-parameter-editor__json-error">
        {{ locale.invalidJson }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import ParameterSceneTable from './ParameterSceneTable.vue'
import type {
  ModelParameterFile,
  ModelParameterLocale,
  ModelParameterProperty,
  ModelParameterScene,
  ModelParameterSceneMode
} from './types'
import type { ParameterRecord } from './modelParameterUtils'

interface SceneModeOption {
  label: string
  value: ModelParameterSceneMode
}

defineProps({
  scene: {
    type: String as PropType<ModelParameterScene>,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  mode: {
    type: String as PropType<ModelParameterSceneMode>,
    required: true
  },
  modeOptions: {
    type: Array as PropType<SceneModeOption[]>,
    required: true
  },
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
  defaultText: {
    type: String,
    required: true
  },
  defaultInvalid: {
    type: Boolean,
    default: false
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
  (event: 'update:mode', value: unknown): void
  (event: 'update:value', value: { property: string; value: unknown }): void
  (event: 'update:defaults', value: string): void
}>()
</script>

<style scoped lang="less">
.model-parameter-editor__scene-head {
  display: flex;
  flex: 0 0 auto;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
  color: var(--ink-1);
}

.model-parameter-editor__scene-head span {
  display: block;
  margin-top: 0;
  color: var(--ink-3);
  font-size: var(--fs-12);
  line-height: 1.5;
}

.model-parameter-editor__scene-head > span {
  flex: 1 1 auto;
  min-width: 0;
}

.model-parameter-editor__scene-json-editor {
  flex: 1 1 0;
  height: auto;
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-2);
  overflow: hidden;
}

.model-parameter-editor__json-error {
  display: block;
  margin-top: 0.375rem;
  color: var(--jet-theme-error);
  font-size: var(--fs-12);
}
</style>
