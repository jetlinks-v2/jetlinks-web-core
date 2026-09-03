<template>
  <div class="batch-file-upload-content">
    <a-upload-dragger
      class="batch-file-upload-content__dropzone"
      :show-upload-list="false"
      :multiple="true"
      :before-upload="beforeUpload"
      :disabled="disabled"
    >
      <p class="batch-file-upload-content__dropzone-icon">
        <AIcon type="CloudUploadOutlined" />
      </p>
      <p class="batch-file-upload-content__dropzone-title">
        {{ locale.batchUploadTitle }}
      </p>
      <p class="batch-file-upload-content__dropzone-description">
        {{ locale.batchUploadDescription }}
      </p>
    </a-upload-dragger>

    <div v-if="items.length" class="batch-file-upload-content__list">
      <div class="batch-file-upload-content__list-head">
        <span>{{ locale.batchUploadList }}</span>
        <span class="batch-file-upload-content__count">{{ items.length }}</span>
      </div>

      <div
        v-for="item in items"
        :key="item.uid"
        class="batch-file-upload-content__row"
        :class="{ 'batch-file-upload-content__row--error': hasBlockingError(item) }"
      >
        <div class="batch-file-upload-content__file">
          <AIcon type="FileOutlined" />
          <span :title="item.originalName">{{ item.originalName }}</span>
        </div>

        <a-input
          v-model:value="item.name"
          :placeholder="locale.batchUploadTargetName"
          :disabled="disabled || isProcessing(item)"
          @change="handleNameChange(item)"
        />

        <div class="batch-file-upload-content__status">
          <span :class="`batch-file-upload-content__status--${item.status}`">
            {{ statusText(item.status) }}
          </span>
          <a-button
            type="text"
            size="small"
            danger
            :disabled="disabled || isProcessing(item)"
            @click="removeItem(item.uid)"
          >
            <AIcon type="DeleteOutlined" />
          </a-button>
        </div>

        <div v-if="hasExistingConflict(item)" class="batch-file-upload-content__conflict">
          <span>{{ locale.batchUploadConflict }}</span>
          <a-checkbox
            v-model:checked="item.overwrite"
            :disabled="disabled || isProcessing(item)"
          >
            {{ locale.batchUploadOverwrite }}
          </a-checkbox>
        </div>
        <div v-if="rowError(item)" class="batch-file-upload-content__error">
          {{ rowError(item) }}
        </div>
      </div>

      <div v-if="hasError" class="batch-file-upload-content__retry-hint">
        {{ locale.batchUploadRetryHint }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import {
  type ExistingModelFile,
  type BatchFileStatus,
  type BatchFileStatusUpdate,
  type BatchFileUploadItem
} from './batchFileUpload'
import { normalizeFilePath } from './fileOwnerOptions'

const props = defineProps({
  path: {
    type: String,
    default: ''
  },
  existingFiles: {
    type: Array as PropType<ExistingModelFile[]>,
    default: () => []
  },
  locale: {
    type: Object as PropType<Record<string, string>>,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

interface BatchFileUploadExpose {
  prepareForSave: () => BatchFileUploadItem[] | undefined
  updateStatus: (index: number, update: BatchFileStatusUpdate) => void
}

const items = ref<BatchFileUploadItem[]>([])
let uidSequence = 0

const hasError = computed(() => items.value.some(item => item.status === 'error'))

function createUid() {
  uidSequence += 1
  return `batch-file-${Date.now()}-${uidSequence}`
}

function beforeUpload(file: File) {
  items.value.push({
    uid: createUid(),
    file,
    originalName: file.name,
    name: file.name,
    overwrite: false,
    status: 'pending'
  })
  return false
}

function removeItem(uid: string) {
  items.value = items.value.filter(item => item.uid !== uid)
}

function handleNameChange(item: BatchFileUploadItem) {
  item.status = 'pending'
  item.error = undefined
  item.uploadResult = undefined
  item.overwrite = false
}

function isProcessing(item: BatchFileUploadItem) {
  return item.status === 'uploading' || item.status === 'saving'
}

function targetKey(item: BatchFileUploadItem) {
  const path = normalizeFilePath(props.path)
  const name = item.name.trim()
  return `${path}/${name}`
}

function hasBatchDuplicate(item: BatchFileUploadItem) {
  const name = item.name.trim()
  if (!name) return false
  const key = targetKey(item)
  return items.value.some(other => other.uid !== item.uid && other.name.trim() && targetKey(other) === key)
}

function hasExistingConflict(item: BatchFileUploadItem) {
  const name = item.name.trim()
  if (!name) return false
  const path = normalizeFilePath(props.path)
  return props.existingFiles.some(file => (
    normalizeFilePath(file.path) === path
    && file.name.trim() === name
  ))
}

function rowError(item: BatchFileUploadItem) {
  if (!item.name.trim()) return props.locale.batchUploadNameRequired
  if (hasBatchDuplicate(item)) return props.locale.batchUploadDuplicate
  return item.error || ''
}

function hasBlockingError(item: BatchFileUploadItem) {
  return !!rowError(item) || (hasExistingConflict(item) && !item.overwrite)
}

function statusText(status: BatchFileStatus) {
  const statusMap: Record<BatchFileStatus, string> = {
    pending: props.locale.batchUploadStatusPending,
    uploading: props.locale.batchUploadStatusUploading,
    uploaded: props.locale.batchUploadStatusUploaded,
    saving: props.locale.batchUploadStatusSaving,
    success: props.locale.batchUploadStatusSuccess,
    error: props.locale.batchUploadStatusError
  }
  return statusMap[status]
}

function updateStatus(index: number, update: BatchFileStatusUpdate) {
  const item = items.value[index]
  if (!item) return
  item.status = update.status
  item.error = update.error
  if (Object.prototype.hasOwnProperty.call(update, 'uploadResult')) {
    item.uploadResult = update.uploadResult
  }
}

function resetProcessingState() {
  items.value.forEach(item => {
    item.status = 'pending'
    item.error = undefined
    item.uploadResult = undefined
  })
}

function prepareForSave() {
  if (!items.value.length || items.value.some(item => hasBlockingError(item))) {
    return undefined
  }
  return items.value.map(item => ({
    ...item,
    name: item.name.trim()
  }))
}

watch(() => props.path, (path, previousPath) => {
  if (path !== previousPath) resetProcessingState()
})

defineExpose<BatchFileUploadExpose>({
  prepareForSave,
  updateStatus
})
</script>

<style scoped src="./BatchFileUploadContent.less"></style>
