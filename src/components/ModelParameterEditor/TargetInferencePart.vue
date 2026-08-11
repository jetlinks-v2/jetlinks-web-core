<template>
  <section
    class="target-inference-editor__part"
    :class="{ 'target-inference-editor__part--collapsed': !expanded }"
  >
    <div class="target-inference-editor__part-head">
      <div
        class="target-inference-editor__part-head-main"
        :aria-expanded="expanded"
        role="button"
        tabindex="0"
        @click="toggleExpanded"
        @keydown.enter.prevent="toggleExpanded"
        @keydown.space.prevent="toggleExpanded"
      >
        <AIcon
          class="target-inference-editor__collapse-icon"
          :type="expanded ? 'DownOutlined' : 'RightOutlined'"
          aria-hidden="true"
          @click.stop="toggleExpanded"
        />
        <div class="target-inference-editor__label-field">
          <a-input
            v-if="editing"
            :value="part.label"
            :status="errors?.label ? 'error' : undefined"
            :placeholder="locale.partLabel"
            :aria-label="locale.partLabel"
            allow-clear
            @click.stop="handleLabelClick"
            @update:value="emit('update:label', $event)"
          />
          <strong v-else class="target-inference-editor__label-value">
            {{ part.label || '--' }}
          </strong>
          <span v-if="errors?.label" class="target-inference-editor__error">
            {{ getErrorMessage(errors.label) }}
          </span>
          <span v-if="errors?.capability" class="target-inference-editor__error">
            {{ getErrorMessage(errors.capability) }}
          </span>
        </div>
      </div>
      <a-button
        v-if="editing"
        type="text"
        danger
        size="small"
        :aria-label="locale.deletePartLabel"
        @click.stop="emit('remove')"
      >
        <AIcon type="DeleteOutlined" />
        {{ locale.deletePartLabel }}
      </a-button>
    </div>

    <div v-show="expanded" class="target-inference-editor__part-body">
      <TargetInferenceOperation
        :title="locale.targetDetection"
        :path="buildPath(targetLabel, 'parts', part.label)"
        kind="parts"
        :operation="part.detector"
        :errors="errors?.detector"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:operation="emit('update:operation', { key: 'detector', operation: $event })"
      />
      <TargetInferenceOperation
        :title="locale.vector"
        :path="buildPath(targetLabel, 'parts', part.label, 'vector')"
        kind="vector"
        :operation="part.vector"
        :errors="errors?.vector"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:operation="emit('update:operation', { key: 'vector', operation: $event })"
      />
      <TargetInferenceOperation
        :title="locale.features"
        :path="buildPath(targetLabel, 'parts', part.label, 'features')"
        kind="features"
        :operation="part.features"
        :errors="errors?.features"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:operation="emit('update:operation', { key: 'features', operation: $event })"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'
import TargetInferenceOperation from './TargetInferenceOperation.vue'
import type { ModelParameterFile, ModelParameterLocale } from './types'
import type {
  TargetInferenceOperationDraft,
  TargetInferencePartDraft,
  TargetInferencePartErrors
} from './targetInferenceUtils'

type PartOperationKey = 'detector' | 'vector' | 'features'

const props = defineProps({
  part: {
    type: Object as PropType<TargetInferencePartDraft>,
    required: true
  },
  targetLabel: {
    type: String,
    required: true
  },
  errors: {
    type: Object as PropType<TargetInferencePartErrors>,
    default: undefined
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
  (event: 'update:label', value: unknown): void
  (event: 'update:operation', value: {
    key: PartOperationKey
    operation: TargetInferenceOperationDraft
  }): void
  (event: 'remove'): void
}>()

const expanded = ref(true)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function handleLabelClick() {
  if (!props.editing) toggleExpanded()
}

function buildPath(...parts: string[]) {
  return parts.map(part => part.trim() || '--').join(' / ')
}

function getErrorMessage(key?: string) {
  if (!key) return ''
  const messages: Record<string, string> = {
    invalidJson: props.locale.invalidJson,
    partLabelRequired: props.locale.partLabelRequired,
    partLabelDuplicate: props.locale.partLabelDuplicate,
    capabilityRequired: props.locale.capabilityRequired,
    modelRequired: props.locale.modelRequired,
    vectorProfileRequired: props.locale.vectorProfileRequired
  }
  return messages[key] || key
}
</script>

<style scoped lang="less">
.target-inference-editor__part {
  min-width: 0;
  padding: 0 var(--space-3) var(--space-2);
  border: 1px solid var(--jet-theme-border-secondary, var(--line));
  border-radius: 8px;
  background: var(--bg);
}

.target-inference-editor__part-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 2.5rem;
  gap: 1rem;
  padding: var(--space-2) 0;
}

.target-inference-editor__part-head-main,
.target-inference-editor__label-field {
  min-width: 0;
  flex: 1;
}

.target-inference-editor__part-head-main {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.target-inference-editor__collapse-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--ink-3);
  cursor: pointer;
}

.target-inference-editor__collapse-icon:hover {
  color: var(--jet-theme-primary);
}

.target-inference-editor__label-value {
  display: block;
  color: var(--ink-1);
  font-size: var(--fs-14);
  line-height: 1.5;
}

.target-inference-editor__label-field :deep(.ant-input-affix-wrapper) {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.target-inference-editor__label-field :deep(.ant-input) {
  padding: 0;
  color: var(--ink-1);
  background: transparent;
  font-size: var(--fs-14);
  font-weight: 600;
  line-height: 1.5;
}

.target-inference-editor__part-body {
  min-width: 0;
  border-top: 1px solid var(--line);
}

.target-inference-editor__error {
  display: block;
  margin-top: 0.25rem;
  color: var(--jet-theme-error);
  font-size: var(--fs-12);
  line-height: 1.4;
}
</style>
