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
        </div>
        <span class="target-inference-operation__path">{{ path }}</span>
        <span v-if="firstError" class="target-inference-operation__error">
          {{ getErrorMessage(firstError) }}
        </span>
      </div>
      <div class="target-inference-operation__actions">
        <a-button
          type="link"
          size="small"
          :aria-label="`${locale.configure} ${title}`"
          @click="configOpen = true"
        >
          <AIcon type="SettingOutlined" />
          {{ locale.configure }}
        </a-button>
      </div>
    </div>

    <a-modal
      v-if="configOpen"
      v-model:open="configOpen"
      :footer="null"
      :destroy-on-close="true"
      width="min(720px, calc(100vw - 32px))"
      :body-style="{ height: 'min(480px, calc(100vh - 180px))', overflow: 'hidden' }"
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
  gap: 1rem;
}

.target-inference-operation__title-line {
  display: flex;
  align-items: center;
  min-width: 0;
  color: var(--ink-1);
}

.target-inference-operation__title-wrap {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.2rem;
}

.target-inference-operation__path {
  color: var(--ink-3);
  font-size: var(--fs-12);
  line-height: 1.4;
  word-break: break-all;
}

.target-inference-operation__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.5rem;
}

.target-inference-operation__modal-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.15rem;
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
