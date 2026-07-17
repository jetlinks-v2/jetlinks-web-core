<template>
  <a-modal
    :open="open"
    :title="locale.addFile"
    :width="720"
    :ok-text="locale.confirm"
    :cancel-text="locale.cancel"
    :confirm-loading="confirming"
    :cancel-button-props="{ disabled: confirming }"
    :mask-closable="!confirming"
    :keyboard="!confirming"
    @ok="confirm"
    @cancel="cancel"
  >
    <a-form layout="vertical" :disabled="confirming">
      <a-row :gutter="16">
        <a-col :span="10">
          <a-form-item :label="locale.filePath">
            <a-input
              v-model:value="form.path"
              :placeholder="locale.rootDirectory"
              :disabled="pathReadonly"
            />
          </a-form-item>
        </a-col>
        <a-col :span="14">
          <a-form-item required>
            <template #label>
              <span>{{ locale.fileOwner }}</span>
              <span class="add-file-modal__label-desc">{{ ownerDescription }}</span>
            </template>
            <a-auto-complete
              :key="`owner-${autocompleteResetKey}`"
              v-model:value="selectedOwnerInput"
              :options="ownerOptions"
              :placeholder="locale.selectFileOwner"
              :filter-option="filterFileOwnerOption"
              :disabled="form.createType === 'custom'"
              allow-clear
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item required>
        <template #label>
          <span>{{ locale.createType }}</span>
          <span class="add-file-modal__label-desc">{{ createTypeDescription }}</span>
        </template>
        <a-radio-group v-model:value="form.createType">
          <a-radio-button value="upload">{{ locale.uploadCreate }}</a-radio-button>
          <a-radio-button value="extract">{{ locale.extractCreate }}</a-radio-button>
          <a-radio-button value="empty">{{ locale.emptyCreate }}</a-radio-button>
          <a-radio-button v-if="showCustomCreate" value="custom">
            <slot name="custom-create-option" />
          </a-radio-button>
        </a-radio-group>
      </a-form-item>
      <slot
        v-if="form.createType === 'custom'"
        name="custom-create-content"
        :set-file-name="setFileName"
        :set-file-owner="setFileOwner"
      />
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
      <a-row v-if="isModelFilePath" :gutter="16">
        <a-col :span="8">
          <a-form-item :label="locale.businessType" required>
            <a-auto-complete
              :key="`business-${autocompleteResetKey}`"
              v-model:value="businessTypeInput"
              :options="businessTypeOptions"
              :filter-option="filterModelFileOption"
              :placeholder="locale.businessTypePlaceholder"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="locale.modelBusiness" required>
            <a-auto-complete
              :key="`algorithm-${autocompleteResetKey}`"
              v-model:value="algorithmModelInput"
              :options="algorithmModelOptions"
              :filter-option="filterModelFileOption"
              :placeholder="locale.modelBusinessPlaceholder"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="locale.modelFileFormat" required>
            <a-auto-complete
              :key="`format-${autocompleteResetKey}`"
              v-model:value="modelFileFormatInput"
              :options="modelFileFormatOptions"
              :filter-option="filterModelFileOption"
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
import { buildFileOwnerOptions, isModelFilePath as checkModelFilePath, SHARED_OWNER_VALUE, type FileOwnerFormatOption } from './fileOwnerOptions'
interface AddFilePayload {
  name: string
  path?: string
  format?: string[]
  createType: 'upload' | 'extract' | 'empty' | 'custom'
  file?: File
  done?: (success?: boolean) => void
}

interface ModelFileOption {
  label: string
  value: string
  rawValue: string
}

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  availableFormats: {
    type: Array as PropType<FileOwnerFormatOption[]>,
    default: () => []
  },
  editableExtensions: {
    type: Array as PropType<string[]>,
    default: () => []
  },
  selectedOwner: {
    type: String,
    default: ''
  },
  showCustomCreate: {
    type: Boolean,
    default: false
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
const selectedOwnerFormat = ref<string>()
const businessTypeInput = ref('')
const algorithmModelInput = ref('')
const modelFileFormatInput = ref('')
const confirming = ref(false)
const autocompleteResetKey = ref(0)

function createModelFileOption(label: string, rawValue: string): ModelFileOption {
  const displayLabel = label || rawValue
  return {
    label: displayLabel,
    value: displayLabel,
    rawValue
  }
}

function resolveModelFileOptionValue(input: string, options: ModelFileOption[]) {
  const value = input.trim()
  const option = options.find(item => item.value === value || item.label === value || item.rawValue === value || value.endsWith(`(${item.rawValue})`))
  return option?.rawValue || value
}

function filterModelFileOption(input: string, option?: ModelFileOption) {
  const keyword = input.toLowerCase()
  return [option?.label, option?.rawValue].some(item => item?.toLowerCase().includes(keyword))
}

function filterFileOwnerOption(input: string, option?: { label?: string; value?: string }) {
  const selectedOption = ownerOptions.value.find(item => item.value === selectedOwnerFormat.value)
  // 已选架构只用于回显，不能继续作为搜索词把下拉收窄为单个选项。
  if (selectedOption && (input === selectedOption.label || input === selectedOption.value)) return true
  const keyword = input.toLowerCase()
  return [option?.label, option?.value].some(item => item?.toLowerCase().includes(keyword))
}

const businessTypeOptions = computed<ModelFileOption[]>(() => [
  createModelFileOption(props.locale.businessTypeOptionObjectDetection, 'object_detection'),
  createModelFileOption(props.locale.businessTypeOptionPoseDetection, 'pose_detection'),
  createModelFileOption(props.locale.businessTypeOptionFaceEmbedding, 'face_embedding'),
  createModelFileOption(props.locale.businessTypeOptionOcrText, 'ocr_text')
])

const algorithmModelOptions = computed<ModelFileOption[]>(() => [
  createModelFileOption(props.locale.modelBusinessOptionYolo, 'yolo'),
  createModelFileOption(props.locale.modelBusinessOptionYoloPose, 'yolo_pose'),
  createModelFileOption(props.locale.modelBusinessOptionRetinaface, 'retinaface'),
  createModelFileOption(props.locale.modelBusinessOptionResnet50, 'resnet50'),
  createModelFileOption(props.locale.modelBusinessOptionDeim, 'deim')
])

const modelFileFormatOptions: ModelFileOption[] = ['plan', 'onnx', 'bin', 'rknn', 'bmodel', 'om']
  .map(value => createModelFileOption(`.${value}`, value))

// AutoComplete 选中后显示 label，真实文件名后缀仍使用 rawValue。
const businessType = computed(() => resolveModelFileOptionValue(businessTypeInput.value, businessTypeOptions.value))
const algorithmModel = computed(() => resolveModelFileOptionValue(algorithmModelInput.value, algorithmModelOptions.value))
const modelFileFormat = computed(() => resolveModelFileOptionValue(modelFileFormatInput.value, modelFileFormatOptions))

watch(() => form.createType, (createType) => {
  if (createType !== 'upload' && createType !== 'extract') {
    form.file = undefined
    uploadFiles.value = []
  }
  if (createType === 'custom') {
    selectedOwnerFormat.value = undefined
  }
})

// 业务调用方通过插槽扩展创建方式，公共弹窗只提供文件名和文件归属回填能力。
const setFileName = (name: string) => {
  form.name = name
}

const setFileOwner = (owner?: string) => {
  selectedOwnerFormat.value = owner || undefined
}

const beforeUpload = (file: File) => {
  form.file = file
  if (!form.name) {
    form.name = file.name
  }
  return false
}

const removeFile = () => { form.file = undefined }

const isEditableFileName = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  return !!ext && props.editableExtensions.includes(ext)
}

const isArchiveFileName = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'zip' || ext === 'tar'
}

const normalizeModelFileFormat = (format: string) => {
  const value = format.trim()
  return value && !value.startsWith('.') ? `.${value}` : value
}

const isModelFilePath = computed(() => checkModelFilePath(form.path))
const pathReadonly = computed(() => checkModelFilePath(props.selectedOwner))
const ownerOptions = computed(() => buildFileOwnerOptions(props.availableFormats, props.locale, isModelFilePath.value))

// AutoComplete 展示选项文案，提交状态始终保留文件归属的原始值。
const selectedOwnerInput = computed<string | undefined>({
  get: () => ownerOptions.value
    .find(option => option.value === selectedOwnerFormat.value)?.label || selectedOwnerFormat.value,
  set: (value) => {
    const option = ownerOptions.value.find(item => item.value === value || item.label === value)
    selectedOwnerFormat.value = option?.value || value || undefined
  }
})

watch(() => props.open, (open) => {
  if (open) {
    autocompleteResetKey.value += 1
    confirming.value = false
    form.name = ''
    form.path = props.selectedOwner
    selectedOwnerFormat.value = isModelFilePath.value ? undefined : SHARED_OWNER_VALUE
    form.createType = 'upload'
    form.format = []
    form.file = undefined
    businessTypeInput.value = ''
    algorithmModelInput.value = ''
    modelFileFormatInput.value = ''
    uploadFiles.value = []
  }
})

watch(isModelFilePath, (modelFilePath) => {
  if (!props.open) return
  if (modelFilePath && selectedOwnerFormat.value === SHARED_OWNER_VALUE) {
    selectedOwnerFormat.value = undefined
    return
  }
  if (!modelFilePath && !selectedOwnerFormat.value) {
    selectedOwnerFormat.value = SHARED_OWNER_VALUE
  }
})

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
  if (form.createType === 'custom') return ''
  if (!selectedOwnerFormat.value) return props.locale.selectFileOwner
  return selectedOwnerFormat.value === SHARED_OWNER_VALUE
    ? props.locale.sharedFileOwnerDescription
    : props.locale.formatFileOwnerDescription
})

const createTypeDescription = computed(() => {
  const descriptionMap: Record<AddFilePayload['createType'], string> = {
    upload: props.locale.uploadCreateDescription,
    extract: props.locale.extractCreateDescription,
    empty: props.locale.emptyCreateDescription,
    custom: ''
  }
  return descriptionMap[form.createType]
})

const cancel = () => {
  if (confirming.value) return
  emit('update:open', false)
}

const confirm = () => {
  if (confirming.value) return
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
  if (!selectedOwnerFormat.value) {
    onlyMessage(props.locale.selectFileOwner, 'warning')
    return
  }
  if ((form.createType === 'upload' || form.createType === 'extract') && !form.file) {
    onlyMessage(props.locale.pleaseSelectFile, 'warning')
    return
  }
  confirming.value = true
  emit('confirm', {
    name: resolvedFileName.value,
    path: form.path?.trim() || undefined,
    format: selectedOwnerFormat.value === SHARED_OWNER_VALUE ? [] : [selectedOwnerFormat.value],
    createType: form.createType,
    file: form.file,
    done: (success = true) => {
      confirming.value = false
      if (success) {
        emit('update:open', false)
      }
    }
  })
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
