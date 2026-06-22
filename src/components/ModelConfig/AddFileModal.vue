<template>
  <a-modal
    :open="open"
    :title="locale.addFile"
    :ok-text="locale.confirm"
    :cancel-text="locale.cancel"
    @ok="confirm"
    @cancel="emit('update:open', false)"
  >
    <a-form layout="vertical">
      <a-form-item :label="locale.fileOwner" required>
        <a-radio-group v-model:value="fileOwner">
          <a-radio-button value="shared">{{ locale.sharedFile }}</a-radio-button>
          <a-radio-button value="format">{{ locale.currentFormatFile }}</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item :label="locale.fileName" required>
        <a-input
          v-model:value="form.name"
          :placeholder="locale.pleaseEnterFileName"
        />
      </a-form-item>
      <a-form-item :label="locale.createType" required>
        <a-radio-group v-model:value="form.createType">
          <a-radio-button value="upload">{{ locale.uploadCreate }}</a-radio-button>
          <a-radio-button value="empty">{{ locale.emptyCreate }}</a-radio-button>
        </a-radio-group>
        <a-upload
          v-if="form.createType === 'upload'"
          v-model:file-list="uploadFiles"
          class="add-file-modal__upload"
          :max-count="1"
          :before-upload="beforeUpload"
          @remove="removeFile"
        >
          <a-button>
            <AIcon type="UploadOutlined" />
            {{ locale.selectFile }}
          </a-button>
        </a-upload>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'

interface AddFilePayload {
  name: string
  path?: string
  format?: string[]
  createType: 'upload' | 'empty'
  file?: File
}

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  selectedFormat: {
    type: String,
    default: undefined
  },
  selectedOwner: {
    type: String,
    default: ''
  },
  locale: {
    type: Object as PropType<Record<string, string>>,
    required: true
  }
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'confirm', payload: AddFilePayload): void
}>()

const form = reactive<AddFilePayload>({
  name: '',
  path: '',
  createType: 'upload',
  format: []
})
const uploadFiles = ref<any[]>([])
const fileOwner = ref<'shared' | 'format'>('format')

watch(() => props.open, (open) => {
  if (open) {
    form.name = ''
    form.path = props.selectedOwner
    fileOwner.value = props.selectedFormat ? 'format' : 'shared'
    form.createType = 'upload'
    form.format = []
    form.file = undefined
    uploadFiles.value = []
  }
})

watch(() => form.createType, (createType) => {
  if (createType === 'empty') {
    form.file = undefined
    uploadFiles.value = []
  }
})

const beforeUpload = (file: File) => {
  form.file = file
  if (!form.name) {
    form.name = file.name
  }
  return false
}

const removeFile = () => {
  form.file = undefined
}

const confirm = () => {
  if (!form.name) {
    onlyMessage(props.locale.pleaseEnterFileName, 'warning')
    return
  }
  if (fileOwner.value === 'format' && !props.selectedFormat) {
    onlyMessage(props.locale.selectFileOwner, 'warning')
    return
  }
  if (form.createType === 'upload' && !form.file) {
    onlyMessage(props.locale.pleaseSelectFile, 'warning')
    return
  }
  emit('confirm', {
    name: form.name,
    path: form.path,
    format: fileOwner.value === 'format' && props.selectedFormat ? [props.selectedFormat] : [],
    createType: form.createType,
    file: form.file
  })
  emit('update:open', false)
}
</script>

<style scoped lang="less">
.add-file-modal__upload {
  display: block;
  margin-top: var(--space-3);
}
</style>
