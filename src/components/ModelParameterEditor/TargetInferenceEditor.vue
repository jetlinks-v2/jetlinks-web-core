<template>
  <div class="target-inference-editor">
    <div class="target-inference-editor__intro">
      {{ locale.targetInferenceDescription }}
    </div>

    <div v-if="editing" class="target-inference-editor__toolbar">
      <a-button type="link" size="small" @click="addTargetGroup">
        <AIcon type="PlusOutlined" />
        {{ locale.addTargetLabel }}
      </a-button>
    </div>

    <div v-if="groups.length" class="target-inference-editor__groups">
      <TargetInferenceGroup
        v-for="group in groups"
        :key="group.id"
        :group="group"
        :errors="groupError(group.id)"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:label="updateGroupLabel(group.id, $event)"
        @update:operation="updateGroupOperation(group.id, $event.key, $event.operation)"
        @update:part-label="updatePartLabel(group.id, $event.partId, $event.value)"
        @update:part-operation="updatePartOperation(group.id, $event.partId, $event.key, $event.operation)"
        @add-part="addPart(group.id)"
        @remove-part="removePart(group.id, $event)"
        @remove="removeTargetGroup(group.id)"
      />
    </div>

    <a-empty v-else :description="locale.noTargetInference" />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { ref, watch } from 'vue'
import TargetInferenceGroup from './TargetInferenceGroup.vue'
import type { ModelParameterFile, ModelParameterLocale } from './types'
import type { ParameterRecord } from './modelParameterUtils'
import {
  createEmptyTargetGroup,
  createEmptyTargetPart,
  createTargetInferenceDraft,
  getTargetInference,
  serializeTargetInferenceEditorValue,
  type TargetInferenceGroupDraft,
  type TargetInferenceEditorValue,
  type TargetInferenceOperationDraft,
  type TargetInferenceValidationErrors
} from './targetInferenceUtils'
import { validateTargetInference } from './targetInferenceValidation'

interface TargetInferenceEditorExpose {
  prepareForSave: () => TargetInferenceEditorValue | undefined
}

const props = defineProps({
  definition: {
    type: Object as PropType<ParameterRecord>,
    required: true
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
  (event: 'update:target-inference', value: TargetInferenceEditorValue): void
}>()

const groups = ref<TargetInferenceGroupDraft[]>([])
const validationErrors = ref<TargetInferenceValidationErrors>({})

watch(() => props.editing, resetDraft, { immediate: true })
watch(() => props.definition, () => {
  if (!props.editing) resetDraft()
}, { deep: true })

function resetDraft() {
  groups.value = createTargetInferenceDraft(
    getTargetInference(props.definition),
    props.definition
  )
  validationErrors.value = {}
}

function emitDraft() {
  emit('update:target-inference', serializeTargetInferenceEditorValue(groups.value))
}

function addTargetGroup() {
  if (!props.editing) return
  groups.value = [...groups.value, createEmptyTargetGroup()]
  emitDraft()
}

function removeTargetGroup(groupId: string) {
  if (!props.editing) return
  groups.value = groups.value.filter(group => group.id !== groupId)
  validationErrors.value = {}
  emitDraft()
}

function addPart(groupId: string) {
  if (!props.editing) return
  groups.value = groups.value.map(group => group.id === groupId
    ? { ...group, parts: [...group.parts, createEmptyTargetPart()] }
    : group)
  emitDraft()
}

function removePart(groupId: string, partId: string) {
  if (!props.editing) return
  groups.value = groups.value.map(group => group.id === groupId
    ? { ...group, parts: group.parts.filter(part => part.id !== partId) }
    : group)
  validationErrors.value = {}
  emitDraft()
}

function updateGroupLabel(groupId: string, value: unknown) {
  if (!props.editing) return
  groups.value = groups.value.map(group => group.id === groupId
    ? { ...group, label: value == null ? '' : String(value) }
    : group)
  clearGroupError(groupId, 'label')
  emitDraft()
}

function updatePartLabel(groupId: string, partId: string, value: unknown) {
  if (!props.editing) return
  groups.value = groups.value.map(group => group.id === groupId
    ? {
        ...group,
        parts: group.parts.map(part => part.id === partId
          ? { ...part, label: value == null ? '' : String(value) }
          : part)
      }
    : group)
  clearPartError(groupId, partId, 'label')
  emitDraft()
}

function updateGroupOperation(
  groupId: string,
  key: 'vector' | 'features',
  operation: TargetInferenceOperationDraft
) {
  if (!props.editing) return
  groups.value = groups.value.map(group => group.id === groupId
    ? { ...group, [key]: operation }
    : group)
  clearGroupError(groupId, key)
  emitDraft()
}

function updatePartOperation(
  groupId: string,
  partId: string,
  key: 'detector' | 'vector' | 'features',
  operation: TargetInferenceOperationDraft
) {
  if (!props.editing) return
  groups.value = groups.value.map(group => group.id === groupId
    ? {
        ...group,
        parts: group.parts.map(part => part.id === partId
          ? { ...part, [key]: operation }
          : part)
      }
    : group)
  clearPartError(groupId, partId, key)
  emitDraft()
}

function groupError(groupId: string) {
  return validationErrors.value[groupId]
}

function partError(groupId: string, partId: string) {
  return validationErrors.value[groupId]?.parts?.[partId]
}

function clearGroupError(groupId: string, key: 'label' | 'vector' | 'features') {
  const current = validationErrors.value[groupId]
  if (!current || !current[key]) return
  const next = { ...current }
  delete next[key]
  const errors = { ...validationErrors.value }
  if (Object.keys(next).length) errors[groupId] = next
  else delete errors[groupId]
  validationErrors.value = errors
}

function clearPartError(groupId: string, partId: string, key: 'label' | 'detector' | 'vector' | 'features') {
  const current = validationErrors.value[groupId]?.parts?.[partId]
  if (!current || !current[key]) return
  const nextPart = { ...current }
  delete nextPart[key]
  const group = validationErrors.value[groupId]
  const nextParts = { ...(group.parts || {}) }
  if (Object.keys(nextPart).length) nextParts[partId] = nextPart
  else delete nextParts[partId]
  const nextGroup = { ...group }
  if (Object.keys(nextParts).length) nextGroup.parts = nextParts
  else delete nextGroup.parts
  const errors = { ...validationErrors.value }
  if (Object.keys(nextGroup).length) errors[groupId] = nextGroup
  else delete errors[groupId]
  validationErrors.value = errors
}

function prepareForSave() {
  const errors = validateTargetInference(groups.value)
  validationErrors.value = errors
  if (Object.keys(errors).length) return undefined
  return serializeTargetInferenceEditorValue(groups.value)
}

defineExpose<TargetInferenceEditorExpose>({ prepareForSave })
</script>

<style scoped lang="less">
.target-inference-editor {
  min-width: 0;
}

.target-inference-editor__intro {
  margin-bottom: 0.5rem;
  color: var(--ink-2);
  font-size: var(--fs-12);
  line-height: 1.5;
}

.target-inference-editor__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--space-3);
}

.target-inference-editor__groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

</style>
