<template>
  <a-modal :open="open" :title="locale.addFile" :width="720" :ok-text="locale.confirm" :cancel-text="locale.cancel" @ok="confirm" @cancel="emit('update:open', false)">
    <a-form layout="vertical">
      <a-form-item required>
        <template #label>
          <span>{{ locale.fileOwner }}</span>
          <span class="add-file-modal__label-desc">{{ ownerDescription }}</span>
        </template>
        <a-radio-group v-model:value="fileOwner">
          <a-radio-button value="shared">{{ locale.sharedFile }}</a-radio-button>
          <a-radio-button value="format">{{ selectedFormatName || locale.currentFormatFile }}</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item required>
        <template #label>
          <span>{{ locale.createType }}</span>
          <span class="add-file-modal__label-desc">{{ createTypeDescription }}</span>
        </template>
        <a-radio-group v-model:value="form.createType">
          <a-radio-button value="upload">{{ locale.uploadCreate }}</a-radio-button>
          <a-radio-button value="extract">{{ locale.extractCreate }}</a-radio-button>
          <a-radio-button value="empty">{{ locale.emptyCreate }}</a-radio-button>
        </a-radio-group>
      </a-form-item>
      <a-form-item v-if="form.createType === 'upload' || form.createType === 'extract'" :label="locale.selectFile" required>
        <a-upload
          v-model:file-list="uploadFiles"
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
      <a-form-item :label="locale.fileName" required>
        <a-input
          v-model:value="form.name"
          :placeholder="locale.pleaseEnterFileName"
          :addon-after="modelFileNameSuffix || undefined"
        />
      </a-form-item>
      <a-form-item :label="locale.filePath">
        <a-input
          v-model:value="form.path"
          :placeholder="locale.rootDirectory"
        />
      </a-form-item>
      <a-row v-if="isModelFilePath" :gutter="16">
        <a-col :span="8">
          <a-form-item :label="locale.businessType" required>
            <a-auto-complete
              v-model:value="businessType"
              :options="businessTypeOptions"
              :placeholder="locale.businessTypePlaceholder"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="locale.modelBusiness" required>
            <a-auto-complete
              v-model:value="algorithmModel"
              :options="algorithmModelOptions"
              :placeholder="locale.modelBusinessPlaceholder"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="locale.modelFileFormat" required>
            <a-auto-complete
              v-model:value="modelFileFormat"
              :options="modelFileFormatOptions"
              :placeholder="locale.modelFileFormatPlaceholder"
            />
          </a-form-item>
        </a-col>
      </a-row>
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
  createType: 'upload' | 'extract' | 'empty'
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
  selectedFormatName: {
    type: String,
    default: ''
  },
  editableExtensions: {
    type: Array as PropType<string[]>,
    default: () => []
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
const fileOwner = ref<'shared' | 'format'>('shared')
const businessType = ref('')
const algorithmModel = ref('')
const modelFileFormat = ref('')

const businessTypeOptions = computed(() => [
  { label: props.locale.businessTypeOptionObjectDetection, value: 'object_detection' }, { label: props.locale.businessTypeOptionPoseDetection, value: 'pose_detection' },
  { label: props.locale.businessTypeOptionFaceEmbedding, value: 'face_embedding' }, { label: props.locale.businessTypeOptionOcrText, value: 'ocr_text' }
])

const algorithmModelOptions = computed(() => [
  { label: props.locale.modelBusinessOptionYolo, value: 'yolo' },
  { label: props.locale.modelBusinessOptionYoloPose, value: 'yolo_pose' },
  { label: props.locale.modelBusinessOptionRetinaface, value: 'retinaface' },
  { label: props.locale.modelBusinessOptionResnet50, value: 'resnet50' },
  { label: props.locale.modelBusinessOptionDeim, value: 'deim' }
])

const modelFileFormatOptions = [
  { value: 'plan' },
  { value: 'onnx' },
  { value: 'bin' },
  { value: 'rknn' },
  { value: 'bmodel' },
  { value: 'om' }
]

watch(() => props.open, (open) => {
  if (open) {
    form.name = ''
    form.path = props.selectedOwner
    fileOwner.value = 'shared'
    form.createType = 'upload'
    form.format = []
    form.file = undefined
    businessType.value = ''
    algorithmModel.value = ''
    modelFileFormat.value = ''
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

const isEditableFileName = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  return !!ext && props.editableExtensions.includes(ext)
}

const isArchiveFileName = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'zip' || ext === 'tar'
}

const normalizeFilePath = (path?: string) => {
  return path?.trim().replace(/^\/+|\/+$/g, '') || ''
}

const normalizeModelFileFormat = (format: string) => {
  const value = format.trim()
  return value && !value.startsWith('.') ? `.${value}` : value
}

const isModelFilePath = computed(() => normalizeFilePath(form.path) === 'models')

const modelFileNameSuffix = computed(() => {
  if (!isModelFilePath.value) return ''
  // 模型文件保存时要求业务类型、算法模型、模型格式三段后缀进入真实文件名。
  const business = businessType.value.trim()
  const algorithm = algorithmModel.value.trim()
  const fileFormat = normalizeModelFileFormat(modelFileFormat.value)
  return [business, algorithm, fileFormat].filter(Boolean).map(item => item.startsWith('.') ? item : `.${item}`).join('')
})

const resolvedFileName = computed(() => {
  return `${form.name}${modelFileNameSuffix.value}`
})

const ownerDescription = computed(() => {
  return fileOwner.value === 'format' ? props.locale.formatFileOwnerDescription : props.locale.sharedFileOwnerDescription
})

const createTypeDescription = computed(() => {
  const descriptionMap: Record<AddFilePayload['createType'], string> = {
    upload: props.locale.uploadCreateDescription,
    extract: props.locale.extractCreateDescription,
    empty: props.locale.emptyCreateDescription
  }
  return descriptionMap[form.createType]
})

const confirm = () => {
  if (!form.name) {
    onlyMessage(props.locale.pleaseEnterFileName, 'warning')
    return
  }
  if (form.createType === 'empty' && !isEditableFileName(form.name)) {
    onlyMessage(props.locale.pleaseEnterEditableFileName, 'warning')
    return
  }
  if (form.createType === 'extract' && !isArchiveFileName(form.name)) {
    onlyMessage(props.locale.pleaseEnterArchiveFileName, 'warning')
    return
  }
  if (isModelFilePath.value && !businessType.value.trim()) {
    onlyMessage(props.locale.pleaseEnterBusinessType, 'warning')
    return
  }
  if (isModelFilePath.value && !algorithmModel.value.trim()) {
    onlyMessage(props.locale.pleaseEnterModelBusiness, 'warning')
    return
  }
  if (isModelFilePath.value && !modelFileFormat.value.trim()) {
    onlyMessage(props.locale.pleaseEnterModelFileFormat, 'warning')
    return
  }
  if (fileOwner.value === 'format' && !props.selectedFormat) {
    onlyMessage(props.locale.selectFileOwner, 'warning')
    return
  }
  if ((form.createType === 'upload' || form.createType === 'extract') && !form.file) {
    onlyMessage(props.locale.pleaseSelectFile, 'warning')
    return
  }
  emit('confirm', {
    name: resolvedFileName.value,
    path: form.path?.trim() || undefined,
    format: fileOwner.value === 'format' && props.selectedFormat ? [props.selectedFormat] : [],
    createType: form.createType,
    file: form.file
  })
  emit('update:open', false)
}
</script>

<style scoped lang="less">
.add-file-modal__label-desc {
  margin-left: 8px;
  color: var(--ink-4);
  font-size: var(--fs-12);
  font-weight: 400;
}
</style>
