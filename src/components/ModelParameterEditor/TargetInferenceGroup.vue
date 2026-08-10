<template>
  <section
    class="target-inference-editor__group"
    :class="{ 'target-inference-editor__group--collapsed': !expanded }"
  >
    <div class="target-inference-editor__group-head">
      <div
        class="target-inference-editor__group-head-main"
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
            :value="group.label"
            :status="errors?.label ? 'error' : undefined"
            :placeholder="locale.targetLabel"
            :aria-label="locale.targetLabel"
            allow-clear
            @click.stop="handleLabelClick"
            @update:value="emit('update:label', $event)"
          />
          <strong v-else class="target-inference-editor__label-value">
            {{ group.label || '--' }}
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
        :aria-label="locale.deleteTargetLabel"
        @click.stop="emit('remove')"
      >
        <AIcon type="DeleteOutlined" />
        {{ locale.deleteTargetLabel }}
      </a-button>
    </div>

    <div v-show="expanded" class="target-inference-editor__group-body">
      <TargetInferenceOperation
        :title="locale.vector"
        :path="buildPath(group.label, 'vector')"
        kind="vector"
        :operation="group.vector"
        :errors="errors?.vector"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:operation="emit('update:operation', { key: 'vector', operation: $event })"
      />
      <TargetInferenceOperation
        :title="locale.features"
        :path="buildPath(group.label, 'features')"
        kind="features"
        :operation="group.features"
        :errors="errors?.features"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:operation="emit('update:operation', { key: 'features', operation: $event })"
      />

      <div class="target-inference-editor__parts-head">
        <div
          class="target-inference-editor__parts-title"
          @click="togglePartsExpanded"
        >
          <AIcon
            class="target-inference-editor__collapse-icon"
            :type="partsExpanded ? 'DownOutlined' : 'RightOutlined'"
            aria-hidden="true"
            @click.stop="togglePartsExpanded"
          />
          <div class="target-inference-editor__parts-title-wrap">
            <strong>{{ locale.parts }}</strong>
            <span class="target-inference-editor__parts-path">
              {{ buildPath(group.label, 'parts') }}
            </span>
          </div>
        </div>
        <a-button
          v-if="editing"
          type="link"
          size="small"
          @click.stop="emit('add-part')"
        >
          <AIcon type="PlusOutlined" />
          {{ locale.addPartLabel }}
        </a-button>
      </div>

      <div
        v-if="group.parts.length"
        v-show="partsExpanded"
        class="target-inference-editor__parts"
      >
        <TargetInferencePart
          v-for="part in group.parts"
          :key="part.id"
          :part="part"
          :target-label="group.label"
          :errors="partError(part.id)"
          :files="files"
          :locale="locale"
          :editing="editing"
          @update:label="emit('update:part-label', { partId: part.id, value: $event })"
          @update:operation="emit('update:part-operation', {
            partId: part.id,
            key: $event.key,
            operation: $event.operation
          })"
          @remove="emit('remove-part', part.id)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'
import TargetInferenceOperation from './TargetInferenceOperation.vue'
import TargetInferencePart from './TargetInferencePart.vue'
import type { ModelParameterFile, ModelParameterLocale } from './types'
import type {
  TargetInferenceGroupDraft,
  TargetInferenceGroupErrors,
  TargetInferenceOperationDraft
} from './targetInferenceUtils'

type RootOperationKey = 'vector' | 'features'
type PartOperationKey = 'detector' | 'vector' | 'features'

const props = defineProps({
  group: {
    type: Object as PropType<TargetInferenceGroupDraft>,
    required: true
  },
  errors: {
    type: Object as PropType<TargetInferenceGroupErrors>,
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
  (event: 'update:operation', value: { key: RootOperationKey; operation: TargetInferenceOperationDraft }): void
  (event: 'update:part-label', value: { partId: string; value: unknown }): void
  (event: 'update:part-operation', value: {
    partId: string
    key: PartOperationKey
    operation: TargetInferenceOperationDraft
  }): void
  (event: 'add-part'): void
  (event: 'remove-part', partId: string): void
  (event: 'remove'): void
}>()

const expanded = ref(true)
const partsExpanded = ref(true)

function toggleExpanded() {
  expanded.value = !expanded.value
}

function togglePartsExpanded() {
  partsExpanded.value = !partsExpanded.value
}

function handleLabelClick() {
  if (!props.editing) toggleExpanded()
}

function partError(partId: string) {
  return props.errors?.parts?.[partId]
}

function buildPath(...parts: string[]) {
  return parts.map(part => part.trim() || '--').join(' / ')
}

function getErrorMessage(key?: string) {
  if (!key) return ''
  const messages: Record<string, string> = {
    invalidJson: props.locale.invalidJson,
    targetLabelRequired: props.locale.targetLabelRequired,
    targetLabelDuplicate: props.locale.targetLabelDuplicate,
    partLabelRequired: props.locale.partLabelRequired,
    partLabelDuplicate: props.locale.partLabelDuplicate,
    capabilityRequired: props.locale.capabilityRequired,
    modelRequired: props.locale.modelRequired,
    vectorProfileRequired: props.locale.vectorProfileRequired
  }
  return messages[key] || key
}
</script>

<style src="./targetInferenceGroup.less" scoped lang="less"></style>
