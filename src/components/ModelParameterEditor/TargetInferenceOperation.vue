<template>
  <section
    class="target-inference-operation"
    :class="{
      'target-inference-operation--enabled': operation.enabled,
      'target-inference-operation--error': hasErrors
    }"
  >
    <div class="target-inference-operation__head">
      <div class="target-inference-operation__title-wrap">
        <div class="target-inference-operation__title-line">
          <strong>{{ title }}</strong>
          <!-- Default behavior and user choice are independent capability settings. -->
          <div class="target-inference-operation__status">
            <a-tag :bordered="false" :color="operation.enabled ? 'success' : undefined">
              {{ operation.enabled ? locale.defaultEnabled : locale.defaultDisabled }}
            </a-tag>
            <a-tag :bordered="false" :color="operation.userSelectable ? 'processing' : undefined">
              {{ operation.userSelectable ? locale.userSelectable : locale.userNotSelectable }}
            </a-tag>
          </div>
        </div>
        <div v-if="operation.model" class="target-inference-operation__summary">
          <span class="target-inference-operation__model-label">{{ locale.modelSummaryLabel }}</span>
          <a-tooltip :title="operation.model">
            <span class="target-inference-operation__model">{{ operation.model }}</span>
          </a-tooltip>
        </div>
        <span v-if="firstError" class="target-inference-operation__error">
          {{ getErrorMessage(firstError) }}
        </span>
      </div>
      <div class="target-inference-operation__actions">
        <a-tooltip :title="editing ? locale.configure : locale.viewConfiguration">
          <a-button
            type="text"
            size="small"
            :aria-label="`${editing ? locale.configure : locale.viewConfiguration} ${title}`"
            @click="configOpen = true"
          >
            <template #icon><AIcon :type="editing ? 'SettingOutlined' : 'EyeOutlined'" /></template>
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <a-modal
      v-if="configOpen"
      v-model:open="configOpen"
      :footer="null"
      :destroy-on-close="true"
      width="min(720px, calc(100vw - 32px))"
      :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', overflowX: 'hidden' }"
    >
      <template #title>
        <div class="target-inference-operation__modal-title">
          <strong>{{ title }}</strong>
          <span class="target-inference-operation__modal-path">{{ path }}</span>
        </div>
      </template>
      <TargetInferenceOperationBody
        :path="path"
        :kind="kind"
        :operation="operation"
        :errors="errors"
        :files="files"
        :locale="locale"
        :editing="editing"
        @update:operation="emit('update:operation', $event)"
      />
    </a-modal>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import TargetInferenceOperationBody from './TargetInferenceOperationBody.vue'
import type { ModelParameterFile, ModelParameterLocale } from './types'
import type {
  TargetInferenceOperationDraft,
  TargetInferenceOperationErrors,
  TargetInferenceOperationKind
} from './targetInferenceUtils'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  kind: {
    type: String as PropType<TargetInferenceOperationKind>,
    required: true
  },
  operation: {
    type: Object as PropType<TargetInferenceOperationDraft>,
    required: true
  },
  errors: {
    type: Object as PropType<TargetInferenceOperationErrors>,
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
  (event: 'update:operation', value: TargetInferenceOperationDraft): void
}>()

const configOpen = ref(false)

const firstError = computed(() => Object.values(props.errors || {}).find(Boolean))
const hasErrors = computed(() => Boolean(firstError.value))

function getErrorMessage(key?: string) {
  if (!key) return ''
  const messages: Record<string, string> = {
    invalidJson: props.locale.invalidJson,
    modelRequired: props.locale.modelRequired,
    vectorProfileRequired: props.locale.vectorProfileRequired,
    targetParameterNameRequired: props.locale.targetParameterNameRequired
  }
  return messages[key] || key
}
</script>

<style scoped lang="less">
.target-inference-operation {
  min-width: 0;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
}

.target-inference-operation:last-child {
  border-bottom: 0;
}

.target-inference-operation__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
}

.target-inference-operation__title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
  color: var(--ink-1);
}

.target-inference-operation__title-line strong {
  font-size: var(--fs-14);
  font-weight: 500;
  line-height: 1.5;
}

.target-inference-operation__status {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);

  :deep(.ant-tag) {
    margin-inline-end: 0;
    padding-inline: var(--space-1);
    font-size: var(--fs-12);
  }
}

.target-inference-operation__title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: var(--space-1);
}

.target-inference-operation__summary {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  min-width: 0;
  color: var(--ink-3);
  font-size: var(--fs-12);
  line-height: 1.4;
}

.target-inference-operation__model-label {
  flex: 0 0 auto;
}

.target-inference-operation__model {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-inference-operation__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
}

.target-inference-operation__modal-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: var(--space-1);
  padding-right: var(--space-6);
}

.target-inference-operation__modal-title strong {
  color: var(--ink-1);
  font-size: var(--fs-15);
  line-height: 1.5;
}

.target-inference-operation__modal-path {
  color: var(--ink-3);
  font-size: var(--fs-12);
  font-weight: normal;
  line-height: 1.4;
  word-break: break-all;
}

.target-inference-operation__error {
  display: block;
  margin-top: 0.25rem;
  color: var(--jet-theme-error);
  font-size: var(--fs-12);
  line-height: 1.4;
}

.target-inference-operation--error .target-inference-operation__title-line {
  color: var(--jet-theme-error);
}
</style>
