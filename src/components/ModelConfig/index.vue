<template>
  <div
    class="model-config"
    :class="{ 'model-config--resizing': resizingSider }"
    :style="modelConfigStyle"
  >
    <aside class="model-config__sider">
      <div class="model-config__sider-head">
        <span class="model-config__title">{{ text.fileDirectory }}</span>
        <div class="model-config__format-actions">
          <a-select
            v-model:value="selectedFormat"
            class="model-config__format"
            :options="formatOptions"
            :placeholder="text.selectFormat"
            size="small"
          />
        </div>
      </div>

      <div class="model-config__actions">
        <a-button
          block
          :type="activeType === 'model' ? 'primary' : 'default'"
          @click="selectModelConfig"
        >
          <AIcon type="SettingOutlined" />
          {{ text.modelConfig }}
        </a-button>
        <a-button v-if="showAddFile" block @click="openAddFile('')">
          <AIcon type="PlusOutlined" />
          {{ text.addFile }}
        </a-button>
      </div>

      <a-spin :spinning="filesLoading">
        <a-tree
          v-if="treeData.length"
          v-model:selectedKeys="selectedKeys"
          class="model-config__tree"
          :tree-data="treeData"
          :field-names="{ title: 'title', key: 'key', children: 'children' }"
          default-expand-all
          block-node
          @select="onTreeSelect"
        >
          <template #title="{ title, isFile, path, shared, file }">
            <span
              class="model-config__tree-node"
              :class="{ 'model-config__tree-node--tagged': hasFileTreeTags(file) }"
            >
              <span class="model-config__tree-node-main">
                <AIcon :type="getTreeNodeIcon(isFile, shared, file)" />
                <a-tooltip
                  v-if="isFile"
                  overlay-class-name="model-config__tree-file-tooltip"
                >
                  <template #title>
                    <span class="model-config__tree-file-tooltip-content">
                      <span v-if="file?.path" class="model-config__tree-file-tooltip-path">{{ file.path }}</span>
                      <span class="model-config__tree-file-tooltip-name">{{ file?.name || title }}</span>
                    </span>
                  </template>
                  <span class="model-config__tree-node-title">{{ title }}</span>
                </a-tooltip>
                <span v-else class="model-config__tree-node-title">{{ title }}</span>
              </span>
              <span v-if="hasFileTreeTags(file)" class="model-config__tree-tags">
                <a-tooltip
                  v-for="tag in getFileTreeTags(file)"
                  :key="tag.key"
                  :title="tag.title"
                  overlay-class-name="model-config__tree-tag-tooltip"
                >
                  <span :class="['model-config__tree-tag', `model-config__tree-tag--${tag.type}`]">
                    {{ tag.label }}
                  </span>
                </a-tooltip>
              </span>
              <a-button
                v-if="!isFile"
                type="link"
                size="small"
                class="model-config__tree-add"
                @click.stop="openAddFile(path)"
              >
                <AIcon type="PlusOutlined" />
              </a-button>
            </span>
          </template>
        </a-tree>
        <a-empty
          v-else
          class="model-config__empty"
          :description="text.noFiles"
        />
      </a-spin>
    </aside>

    <div
      class="model-config__resize"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      :aria-label="text.resizeFileDirectory"
      :aria-valuemin="SIDER_WIDTH_MIN"
      :aria-valuemax="SIDER_WIDTH_MAX"
      :aria-valuenow="siderWidth"
      @pointerdown="startResizeSider"
      @keydown.left.prevent="resizeSiderByKeyboard(-16)"
      @keydown.right.prevent="resizeSiderByKeyboard(16)"
      @keydown.home.prevent="setSiderWidth(SIDER_WIDTH_MIN)"
      @keydown.end.prevent="setSiderWidth(SIDER_WIDTH_MAX)"
    />

    <main
      class="model-config__main"
      :class="{ 'model-config__main--with-tabs': activeType === 'model' }"
    >
      <header class="model-config__content-head">
        <div class="model-config__content-title">
          <AIcon :type="activeType === 'model' ? 'SettingOutlined' : 'FileTextOutlined'" />
          <span>{{ activeTitle }}</span>
        </div>
        <a-space>
          <template v-if="activeType === 'model' && isBuiltinConfigTab">
            <a-button
              v-if="configTab === 'definition'"
              :disabled="editing"
              @click="toggleDefinitionViewMode"
            >
              <AIcon :type="definitionViewMode === 'form' ? 'CodeOutlined' : 'FormOutlined'" />
              {{ definitionViewMode === 'form' ? text.jsonFormat : text.formFormat }}
            </a-button>
            <a-button v-if="!editing" @click="startEdit">
              <AIcon type="EditOutlined" />
              {{ text.edit }}
            </a-button>
            <template v-else>
              <a-button @click="cancelEdit">{{ text.exitEdit }}</a-button>
              <a-button type="primary" :loading="fileSaving" @click="saveEdit">{{ text.save }}</a-button>
            </template>
          </template>
          <template v-else-if="selectedFile">
            <a-button
              :disabled="!selectedFile.url"
              @click="downloadSelectedFile"
            >
              <AIcon type="DownloadOutlined" />
              {{ text.downloadFile }}
            </a-button>
            <a-button v-if="canEditFile && filePreviewLoaded && !editing" @click="startEdit">
              <AIcon type="EditOutlined" />
              {{ text.edit }}
            </a-button>
            <template v-if="editing">
              <a-button @click="cancelEdit">{{ text.exitEdit }}</a-button>
              <a-button type="primary" :loading="fileSaving" @click="saveEdit">{{ text.save }}</a-button>
            </template>
            <a-button danger @click="openDeleteFileConfirm">
              <AIcon type="DeleteOutlined" />
              {{ text.delete }}
            </a-button>
            <a-button @click="toggleProperty">
              <AIcon :type="propertyVisible ? 'DoubleRightOutlined' : 'ProfileOutlined'" />
              {{ propertyVisible ? text.collapseProperty : text.viewProperty }}
            </a-button>
          </template>
        </a-space>
      </header>

      <div v-if="activeType === 'model'" class="model-config__config-tabs">
        <a-tabs v-model:activeKey="configTab" @change="refreshEditorValue">
          <a-tab-pane key="definition" :tab="text.modelParams" />
          <a-tab-pane v-if="showManifest" key="manifest" :tab="text.basicInfo" />
          <a-tab-pane
            v-for="item in normalizedExtraConfigTabs"
            :key="item.key"
            :tab="item.label"
            :disabled="editing || item.disabled"
          />
        </a-tabs>
      </div>

      <section
        class="model-config__editor-wrap"
        :class="{ 'model-config__editor-wrap--definition': activeType === 'model' && configTab === 'definition' }"
      >
        <div
          v-if="activeType === 'model' && configTab === 'definition'"
          class="model-config__definition-content"
        >
          <template v-if="definitionViewMode === 'form'">
            <slot
              name="definition-content"
              :definition="definitionContent"
              :editing="editing"
              :files="files"
              :model="model"
              :update-definition="updateDefinitionContent"
            >
              <ModelParameterEditor
                ref="definitionEditorRef"
                :definition="definitionContent"
                :editing="editing"
                :files="files"
                :locale="text"
                @update:definition="updateDefinitionContent"
              />
            </slot>
          </template>
          <MonacoEditor
            v-else
            ref="editorRef"
            v-model:modelValue="editorValue"
            :key="editorKey"
            class="model-config__editor"
            theme="vs"
            language="json"
            :read-only="!editing"
            :blur-format="true"
            :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
          />
        </div>
        <div
          v-else-if="activeType === 'model' && isExtraConfigTab"
          class="model-config__extra-content"
        >
          <slot
            name="extra-config-content"
            :active-key="configTab"
          />
        </div>
        <MonacoEditor
          v-else-if="showEditor"
          ref="editorRef"
          v-model:modelValue="editorValue"
          :key="editorKey"
          class="model-config__editor"
          theme="vs"
          :language="editorLanguage"
          :read-only="!editing"
          :blur-format="editorLanguage === 'json'"
          :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
        />

        <div v-else class="model-config__preview">
          <a-result
            :title="previewResultTitle"
            :sub-title="previewResultDescription"
          >
            <template #extra>
              <a-space v-if="selectedFile">
                <a-button
                  v-if="canEditFile && selectedFile.url"
                  type="primary"
                  :loading="contentLoading"
                  @click="previewFile"
                >
                  <AIcon type="EyeOutlined" />
                  {{ text.preview }}
                </a-button>
                <a-upload
                  v-else-if="!canEditFile"
                  :show-upload-list="false"
                  :before-upload="replaceFile"
                >
                  <a-button :loading="fileSaving">
                    <AIcon type="UploadOutlined" />
                    {{ text.replaceFile }}
                  </a-button>
                </a-upload>
              </a-space>
            </template>
          </a-result>
        </div>
      </section>
    </main>

    <aside v-if="propertyVisible && selectedFile" class="model-config__property">
      <SectionCard
        icon="ProfileOutlined"
        :title="text.fileProperty"
      >
        <template #actions>
          <a-button
            type="link"
            size="small"
            @click="copyPath"
          >
            <AIcon type="CopyOutlined" />
            {{ text.copyPath }}
          </a-button>
        </template>
        <KvGrid
          cols="stacked"
          cell-layout="inline"
          :items="propertyItems"
        />
      </SectionCard>
    </aside>

    <AddFileModal
      :open="addFileVisible"
      :available-formats="availableFormats"
      :selected-owner="selectedOwner"
      :existing-files="files"
      :editable-extensions="editableExtensions"
      :locale="text"
      :show-batch-upload="showBatchUpload"
      :show-custom-create="showCustomCreate"
      @update:open="handleAddFileVisibleChange"
      @confirm="addFile"
      @batch-confirm="batchAddFile"
    >
      <template #custom-create-option>
        <slot name="add-file-custom-create-option" />
      </template>
      <template #custom-create-content="slotProps">
        <slot name="add-file-custom-create-content" v-bind="slotProps" />
      </template>
    </AddFileModal>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useSlots } from 'vue'
import { Modal } from 'ant-design-vue'
import { onlyMessage } from '@jetlinks-web/utils'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import SectionCard from '../SectionCard/index.vue'
import KvGrid from '../KvGrid/index.vue'
import ModelParameterEditor from '../ModelParameterEditor/index.vue'
import AddFileModal from './AddFileModal.vue'
import { normalizeFilePath } from './fileOwnerOptions'
import type { BatchAddFilePayload } from './batchFileUpload'

interface FormatDetail {
  id: string
  name?: string
  local?: boolean
}

interface ExtraConfigTab {
  key: string
  label: string
  disabled?: boolean
}

interface DefinitionEditorExpose {
  prepareForSave: () => Record<string, any> | undefined
}

interface TreeNode {
  title: string
  key: string
  path?: string
  isFile?: boolean
  shared?: boolean
  file?: ModelFile
  children?: TreeNode[]
}

type LocaleText = Record<string, string>
type BuiltinConfigTab = 'definition' | 'manifest'
type DefinitionViewMode = 'form' | 'json'
type CustomCreateVisible = (path?: string) => boolean

const BUILTIN_CONFIG_TABS: BuiltinConfigTab[] = ['definition', 'manifest']

function isBuiltinConfigTabKey(key: string): key is BuiltinConfigTab {
  return BUILTIN_CONFIG_TABS.includes(key as BuiltinConfigTab)
}

interface AddFilePayload {
  id?: string
  name: string
  path?: string
  format?: string[]
  createType: 'upload' | 'extract' | 'empty' | 'custom'
  file?: File
  done?: (success?: boolean) => void
}

interface ModelFile {
  id: string
  modelId?: string
  name: string
  path?: string
  fileKey?: string
  url?: string
  internalUrl?: string
  size?: number
  md5?: string
  sha256?: string
  format?: string[]
  content?: string
  local?: boolean
  extract?: boolean
}

interface ModelConfigSavePayload {
  definition: Record<string, unknown>
  manifest: Record<string, unknown>
  formats: string[][]
}

interface DonePayload<T = void> {
  done?: (success?: boolean, result?: T) => void
}

interface LoadFilesPayload {
  modelId: string
  format: string
}

interface SaveConfigPayload extends DonePayload {
  type: 'definition' | 'manifest'
  value: string
  config: ModelConfigSavePayload
}

interface SaveFilePayload extends DonePayload {
  format: string
  file: {
    id?: string
    name: string
    path?: string
    format?: string[]
    content: string
  }
}

interface AddFileEventPayload extends DonePayload {
  format: string
  file: AddFilePayload
}

interface ReplaceFilePayload extends DonePayload {
  format: string
  target: ModelFile
  file: AddFilePayload
}

interface PreviewFilePayload extends DonePayload<string> {
  file: ModelFile
}

const defaultLocale: LocaleText = {
  fileDirectory: '文件目录',
  selectFormat: '请选择架构',
  modelConfig: '模型配置',
  addFile: '新增文件',
  noFiles: '暂无模型文件，先选择架构后上传文件',
  edit: '编辑',
  jsonFormat: 'JSON格式',
  formFormat: '表单格式',
  exitEdit: '退出编辑',
  save: '保存',
  delete: '删除',
  confirmDelete: '确认删除该文件？',
  confirmDeleteDescription: '删除后无法恢复，请确认是否继续。',
  confirmDeleteShared: '确认删除共享文件？',
  confirmDeleteSharedDescription: '该文件未绑定单一架构，删除后会在多个架构中同时删除，请谨慎操作。',
  viewProperty: '查看属性',
  collapseProperty: '收起属性',
  modelParams: '模型参数',
  basicInfo: '基础信息',
  previewTitle: '文件暂不支持在线编辑',
  previewDescription: '当前文件类型不支持在线编辑，可以上传文件替换。',
  editablePreviewTitle: '查看文件预览',
  editablePreviewDescription: '预览后可编辑文件内容。',
  fileUrlMissing: '文件预览地址未返回，请稍后重试。',
  noFileSelected: '请选择文件',
  selectFileFirst: '从左侧目录选择文件后查看内容或属性。',
  preview: '预览',
  downloadFile: '下载文件',
  replaceFile: '上传替换文件',
  fileProperty: '文件属性',
  copyPath: '复制路径',
  copySuccess: '文件路径已复制',
  filePath: '文件路径',
  appendPath: '可选追加子路径',
  modelPurpose: '模型用途',
  standardModel: '普通模型',
  targetInferenceModel: '二次推理模型',
  fileName: '文件名称',
  businessType: '业务类型', businessTypePlaceholder: '请选择或输入业务类型',
  businessTypeOptionObjectDetection: '目标检测(object_detection)', businessTypeOptionPoseDetection: '人体姿态检测(pose_detection)',
  businessTypeOptionFaceEmbedding: '人脸特征(face_embedding)', businessTypeOptionOcrText: 'OCR 文本识别(ocr_text)',
  modelBusiness: '算法模型',
  modelBusinessPlaceholder: '请选择或输入算法模型',
  modelBusinessOptionYolo: 'yolo(yolo)',
  modelBusinessOptionYoloPose: 'yolo姿势(yolo_pose)',
  modelBusinessOptionRetinaface: '人脸识别(retinaface)',
  modelBusinessOptionResnet50: '人脸向量(resnet50)',
  modelBusinessOptionDeim: 'deim(deim)',
  modelFileFormat: '模型格式',
  modelFileFormatPlaceholder: '请选择或输入模型格式',
  fileFormat: '支持架构',
  fileMd5: 'MD5',
  fileSha256: 'SHA256',
  fileKey: '文件标识',
  sharedFile: '共享文件',
  sharedFormat: '共享架构',
  extractFile: '待解压',
  sharedFileOwnerDescription: '保存为共享文件，可被多个架构复用',
  formatFileOwnerDescription: '仅归属于当前架构',
  saveSuccess: '已更新编辑内容',
  fileSaveSuccess: '文件已保存',
  confirm: '确定',
  cancel: '取消',
  pleaseEnterFileName: '请输入文件名称',
  pleaseEnterBusinessType: '请输入业务类型', pleaseEnterModelBusiness: '请输入算法模型',
  pleaseEnterModelFileFormat: '请输入模型格式',
  pleaseEnterEditableFileName: '不支持创建该后缀的空白文件',
  selectFile: '选择文件',
  pleaseSelectFile: '请选择文件',
  fileOwner: '文件归属',
  selectFileOwner: '请选择文件归属',
  createType: '创建方式',
  uploadCreate: '上传文件',
  extractCreate: '待解压文件',
  emptyCreate: '空白文件',
  uploadCreateDescription: '上传文件到对应路径',
  extractCreateDescription: '上传压缩包，使用时解压到对应路径',
  emptyCreateDescription: '创建可在线编辑的文本文件',
  batchUploadCreate: '批量上传',
  batchUploadCreateDescription: '一次选择多个文件并逐项上传',
  batchUploadTitle: '选择多个文件',
  batchUploadDescription: '支持同时选择多个文件，上传前可逐项修改文件名',
  batchUploadList: '待上传文件',
  batchUploadTargetName: '保存文件名',
  batchUploadOverwrite: '覆盖已有文件',
  batchUploadConflict: '当前路径存在同名文件，请确认覆盖',
  batchUploadDuplicate: '当前批次存在重复文件名',
  batchUploadNameRequired: '请输入文件名',
  batchUploadEmpty: '请完善文件信息',
  batchUploadRetryHint: '失败文件可修改后重新点击确定重试',
  batchUploadStatusPending: '待上传',
  batchUploadStatusUploading: '上传中',
  batchUploadStatusUploaded: '已上传',
  batchUploadStatusSaving: '保存中',
  batchUploadStatusSuccess: '已完成',
  batchUploadStatusError: '失败',
  pleaseEnterArchiveFileName: '请上传 zip 或 tar 格式压缩包',
  rootDirectory: '根目录',
  currentFormatFile: '当前架构文件',
  format: '架构',
  invalidJson: 'JSON 格式错误',
  allFormats: '全部',
  modelFiles: '模型文件',
  codeFiles: '代码文件',
  skillFiles: '技能文件',
  resizeFileDirectory: '调整文件目录宽度',
  parameterConfig: '参数配置',
  parameterConfigDescription: '定义用户可配置的模型参数',
  validationFailed: '请完善配置项后再保存',
  addParameter: '新增参数',
  realtime: '实时推理',
  imageTest: '图片推理',
  userParameters: '用户参数',
  defaultParameters: '默认参数',
  others: '其他配置',
  othersDescription: '模型其余配置',
  realtimeUserDescription: '实时推理时，用户可配置参数的默认值',
  realtimeDefaultDescription: '实时推理时，用户不可配置参数的默认值',
  imageUserDescription: '图片推理时，用户可配置参数的默认值',
  imageDefaultDescription: '图片推理时，用户不可配置参数的默认值',
  parameterName: '名称',
  parameterPath: '路径',
  parameterType: '类型',
  parameterDescription: '说明',
  parameterValue: '值',
  actions: '操作',
  deleteParameter: '删除参数',
  noParameters: '模型未声明可配置参数',
  noSceneParameters: '请先在参数配置中选择适用参数',
  pleaseEnter: '请输入参数值',
  pleaseSelect: '请选择参数值',
  configure: '配置'
}

const props = defineProps({
  model: {
    type: Object as PropType<Record<string, any>>,
    required: true
  },
  formatDetails: {
    type: Array as PropType<FormatDetail[][]>,
    default: () => []
  },
  locale: {
    type: Object as PropType<Partial<LocaleText>>,
    default: () => ({})
  },
  files: {
    type: Array as PropType<ModelFile[]>,
    default: () => []
  },
  filesLoading: {
    type: Boolean,
    default: false
  },
  availableFormats: {
    type: Array as PropType<FormatDetail[]>,
    default: () => []
  },
  formatLoading: {
    type: Boolean,
    default: false
  },
  showAddFile: {
    type: Boolean,
    default: true
  },
  showManifest: {
    type: Boolean,
    default: true
  },
  extraConfigTabs: {
    type: Array as PropType<ExtraConfigTab[]>,
    default: () => []
  },
  batchUploadOwners: {
    type: Array as PropType<string[]>,
    default: () => ['python', 'skill']
  },
  customCreateVisible: {
    type: Function as PropType<CustomCreateVisible>,
    default: undefined
  }
})

const emit = defineEmits<{
  (e: 'load-files', payload: LoadFilesPayload): void
  (e: 'save-config', payload: SaveConfigPayload): void
  (e: 'add-file', payload: AddFileEventPayload): void
  (e: 'batch-add-file', payload: BatchAddFilePayload): void
  (e: 'add-file-close'): void
  (e: 'save-file', payload: SaveFilePayload): void
  (e: 'replace-file', payload: ReplaceFilePayload): void
  (e: 'preview-file', payload: PreviewFilePayload): void
  (e: 'delete-file', file: ModelFile): void
}>()

const slots = useSlots()
const text = computed(() => ({ ...defaultLocale, ...props.locale }))
const selectedFormat = ref('')
const selectedKeys = ref<string[]>([])
const files = ref<ModelFile[]>([])
const activeType = ref<'model' | 'file'>('model')
const selectedFile = ref<ModelFile>()
const configTab = ref<string>('definition')
const definitionViewMode = ref<DefinitionViewMode>('form')
const editing = ref(false)
const editorValue = ref('')
const draftValue = ref('')
const propertyVisible = ref(false)
const addFileVisible = ref(false)
const filePreviewLoaded = ref(false)
const contentLoading = ref(false)
const fileSaving = ref(false)
const selectedOwner = ref('')
const localFormatDetails = ref<FormatDetail[][]>([])
const editorRef = ref<{ layout?: () => void }>()
const resizingSider = ref(false)
const siderWidth = ref(280)
const definitionEditorRef = ref<DefinitionEditorExpose>()

const showCustomCreate = computed(() => {
  if (!slots['add-file-custom-create-option']) return false
  // Without a predicate, keep the original slot-driven behavior for existing callers.
  return props.customCreateVisible
    ? props.customCreateVisible(selectedOwner.value || undefined)
    : true
})

const showBatchUpload = computed(() => {
  const selectedPath = normalizeFilePath(selectedOwner.value)
  if (!selectedPath) return false
  return props.batchUploadOwners.some(owner => {
    const ownerPath = normalizeFilePath(owner)
    return !!ownerPath && (selectedPath === ownerPath || selectedPath.startsWith(`${ownerPath}/`))
  })
})

const SIDER_WIDTH_STORAGE_KEY = 'jetlinks:model-config:sider-width'
const SIDER_WIDTH_DEFAULT = 280
const SIDER_WIDTH_MIN = 220
const SIDER_WIDTH_MAX = 520
const SIDER_RESIZE_BREAKPOINT = 1100

let siderResizeStartX = 0
let siderResizeStartWidth = SIDER_WIDTH_DEFAULT
let editorLayoutFrame = 0

const editableExtensions = [
  'py',
  'pyi',
  'txt',
  'md',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'env',
  'properties',
  'xml',
  'proto'
]

const formatOptions = computed(() => {
  const options = localFormatDetails.value
    .flat()
    .filter(item => item?.id)
    .map(item => ({
      label: item.local ? `${item.name || item.id} (${item.id})` : item.name || item.id,
      value: item.id
    }))
  return [
    { label: text.value.allFormats, value: '' },
    ...options
  ]
})

const modelConfigStyle = computed(() => ({
  '--model-config-sider-width': `${siderWidth.value}px`
}))

const formatNameMap = computed(() => props.availableFormats.reduce<Map<string, string>>((map, item) => {
  if (item?.id) {
    map.set(item.id, item.name || item.id)
  }
  return map
}, new Map()))

const modelId = computed(() => props.model?.id)

const normalizedExtraConfigTabs = computed(() => {
  const keys = new Set<string>(BUILTIN_CONFIG_TABS)
  return props.extraConfigTabs.filter((item) => {
    if (!item?.key || keys.has(item.key)) return false
    keys.add(item.key)
    return true
  })
})

const availableConfigTabs = computed(() => [
  'definition',
  ...(props.showManifest ? ['manifest'] : []),
  ...normalizedExtraConfigTabs.value.map(item => item.key)
])

const isBuiltinConfigTab = computed(() => isBuiltinConfigTabKey(configTab.value))
const isExtraConfigTab = computed(() => normalizedExtraConfigTabs.value.some(item => item.key === configTab.value))
// Business modules can replace the definition Monaco editor while retaining ModelConfig's save-config contract.
const definitionContent = computed(() => {
  const parsed = parseJsonSilently(editorValue.value)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed
    : props.model?.definition || {}
})

const activeTitle = computed(() => {
  return activeType.value === 'model'
    ? text.value.modelConfig
    : `${selectedFile.value?.path ? `${selectedFile.value.path}/` : ''}${selectedFile.value?.name || ''}`
})

const canEditFile = computed(() => {
  if (!selectedFile.value?.name) return false
  const ext = selectedFile.value.name.split('.').pop()?.toLowerCase()
  return !!ext && editableExtensions.includes(ext)
})

const showEditor = computed(() => (
  (activeType.value === 'model' && isBuiltinConfigTab.value)
  || (canEditFile.value && filePreviewLoaded.value)
))

const editorLanguage = computed(() => {
  if (activeType.value === 'model') return 'json'
  const ext = selectedFile.value?.name?.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    py: 'python',
    pyi: 'python',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    proto: 'protobuf'
  }
  return languageMap[ext || ''] || 'plaintext'
})

const editorKey = computed(() => `${activeType.value}-${configTab.value}-${selectedFile.value?.id || selectedFile.value?.url || 'model'}-${editing.value}`)

const treeData = computed<TreeNode[]>(() => buildTree(files.value))

const previewResultTitle = computed(() => {
  if (!selectedFile.value) return text.value.noFileSelected
  return canEditFile.value ? text.value.editablePreviewTitle : text.value.previewTitle
})

const previewResultDescription = computed(() => {
  if (!selectedFile.value) return text.value.selectFileFirst
  if (canEditFile.value && !selectedFile.value.url) return text.value.fileUrlMissing
  return canEditFile.value ? text.value.editablePreviewDescription : text.value.previewDescription
})

const propertyItems = computed(() => {
  const file = selectedFile.value
  if (!file) return []
  return [
    { label: text.value.fileName, value: file.name || '--' },
    { label: text.value.filePath, value: file.path || '', mono: true },
    { label: text.value.fileFormat, value: file.format?.length ? file.format.join(', ') : text.value.sharedFile },
    { label: text.value.fileKey, value: file.fileKey || '--', mono: true },
    { label: text.value.fileMd5, value: file.md5 || '--', mono: true },
    { label: text.value.fileSha256, value: file.sha256 || '--', mono: true }
  ]
})

watch(formatOptions, (options) => {
  const values = options.map(item => item.value)
  if (!values.includes(selectedFormat.value)) {
    selectedFormat.value = options[0]?.value as string || ''
    return
  }
}, { immediate: true })

watch(() => props.formatDetails, (formatDetails) => {
  localFormatDetails.value = cloneFormatDetails(formatDetails)
}, { deep: true, immediate: true })

watch([modelId, selectedFormat], () => {
  requestFiles()
}, { immediate: true })

watch(() => props.model, () => {
  if (activeType.value === 'model' && isBuiltinConfigTab.value && !editing.value) {
    refreshEditorValue()
  }
}, { deep: true, immediate: true })

watch(configTab, () => {
  if (isBuiltinConfigTab.value && !editing.value) {
    refreshEditorValue()
  }
})

watch(availableConfigTabs, (tabs) => {
  if (!tabs.includes(configTab.value)) {
    configTab.value = 'definition'
  }
}, { immediate: true })

watch(() => props.files, (nextFiles) => {
  files.value = Array.isArray(nextFiles) ? [...nextFiles] : []
  if (activeType.value === 'file') {
    const nextFile = files.value.find(item => item.id === selectedFile.value?.id)
    if (nextFile) {
      selectedFile.value = nextFile
      if (!editing.value && getInlineFileContent(nextFile) !== undefined) {
        applyFileContent(nextFile)
      }
    } else {
      selectModelConfig()
    }
  }
}, { deep: true, immediate: true })

onMounted(() => {
  restoreSiderWidth()
})

onBeforeUnmount(() => {
  stopResizeSider()
  if (editorLayoutFrame && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(editorLayoutFrame)
  }
})

function requestFiles() {
  if (!modelId.value) {
    files.value = []
    return
  }
  emit('load-files', {
    modelId: modelId.value,
    format: selectedFormat.value
  })
}

function buildTree(source: ModelFile[]): TreeNode[] {
  const fixedFolders = [
    { path: 'models', title: text.value.modelFiles },
    { path: 'python', title: text.value.codeFiles },
    { path: 'skill', title: text.value.skillFiles }
  ]
  const roots: TreeNode[] = fixedFolders.map(folder => ({
    title: formatRootFolderTitle(folder.title, folder.path),
    key: `folder:${folder.path}`,
    path: folder.path,
    children: []
  }))
  const folderMap = new Map<string, TreeNode>()
  roots.forEach(node => {
    if (node.path) {
      folderMap.set(node.path, node)
    }
  })
  source.forEach(file => {
    const segments = file.path?.split('/').filter(Boolean) || []
    let current = roots
    let pathKey = ''
    segments.forEach(segment => {
      pathKey = pathKey ? `${pathKey}/${segment}` : segment
      if (!folderMap.has(pathKey)) {
        const node: TreeNode = {
          title: segment,
          key: `folder:${pathKey}`,
          path: pathKey,
          children: []
        }
        folderMap.set(pathKey, node)
        current.push(node)
      }
      current = folderMap.get(pathKey)!.children!
    })
    current.push({
      title: file.name,
      key: file.id || `${file.path || ''}/${file.name}`,
      isFile: true,
      shared: !file.format?.length,
      file
    })
  })
  return roots
}

function getTreeNodeIcon(isFile?: boolean, shared?: boolean, file?: ModelFile) {
  if (!isFile) return 'FolderOutlined'
  if (file?.extract) return 'FileZipOutlined'
  return shared ? 'FileOutlined' : 'FileProtectOutlined'
}

function hasFileTreeTags(file?: ModelFile) {
  return !!file && (file.extract || !!file.format?.filter(Boolean).length)
}

function getFileTreeTags(file?: ModelFile) {
  if (!file) return []
  const formats = file.format?.filter(Boolean) || []
  const formatLabel = formats.map(format => formatNameMap.value.get(format) || format).join(',')
  if (file.extract && formatLabel) {
    return [{
      key: 'extract-format',
      label: text.value.extractFile + ' · ' + formatLabel,
      title: text.value.extractFile + ' / ' + formatLabel,
      type: 'extract' as const
    }]
  }

  const tags: Array<{ key: string; label: string; title: string; type: 'extract' | 'format' }> = []
  if (file.extract) {
    tags.push({
      key: 'extract',
      label: text.value.extractFile,
      title: text.value.extractFile,
      type: 'extract'
    })
  }
  if (formatLabel) {
    tags.push({
      key: 'format',
      label: formatLabel,
      title: formatLabel,
      type: 'format'
    })
  }
  return tags
}

function formatRootFolderTitle(title: string, path: string) {
  return title && title !== path ? `${title}(${path})` : path
}

function onTreeSelect(_: string[], info: { node?: TreeNode }) {
  if (info.node?.isFile && info.node.file) {
    selectFile(info.node.file)
  }
}

function openAddFile(path = '') {
  selectedOwner.value = path
  addFileVisible.value = true
}

function handleAddFileVisibleChange(visible: boolean) {
  const shouldNotifyClose = addFileVisible.value && !visible
  addFileVisible.value = visible
  // 统一收口取消、关闭和保存成功路径，确保消费方只清理一次新增文件会话状态。
  if (shouldNotifyClose) emit('add-file-close')
}

function completeSaving(success: boolean) {
  if (success) {
    editing.value = false
    draftValue.value = editorValue.value
    onlyMessage(text.value.saveSuccess)
  }
  fileSaving.value = false
}

function parseEditorJson() {
  const value = editorValue.value.trim()
  if (!value) return {}
  try {
    return JSON.parse(value)
  } catch {
    onlyMessage(text.value.invalidJson, 'error')
    return undefined
  }
}

function buildSaveConfigPayload(type: 'definition' | 'manifest') {
  const value = parseEditorJson()
  if (value === undefined) return undefined
  return {
    definition: type === 'definition' ? value : props.model?.definition || {},
    manifest: type === 'manifest' ? value : props.model?.manifest || {},
    formats: buildCurrentFormats()
  }
}

function buildCurrentFormats() {
  const formats = normalizeFormats(props.model?.formats)
  if (!formats.length) {
    formats.push(...normalizeFormats(props.model?.formatDetails))
  }
  return formats
}

function completeFileSaving(success: boolean) {
  if (success) {
    editing.value = false
    draftValue.value = editorValue.value
    onlyMessage(text.value.fileSaveSuccess)
    requestFiles()
  }
  fileSaving.value = false
}

function completeFileCreate(success: boolean) {
  if (success) {
    handleAddFileVisibleChange(false)
    onlyMessage(text.value.fileSaveSuccess)
    requestFiles()
  }
  fileSaving.value = false
}

function completeFileReplace(success: boolean) {
  if (success) {
    filePreviewLoaded.value = false
    editorValue.value = ''
    draftValue.value = ''
    onlyMessage(text.value.fileSaveSuccess)
    requestFiles()
  }
  fileSaving.value = false
}

function completePreview(success: boolean, content = '') {
  if (success) {
    editorValue.value = content
    draftValue.value = editorValue.value
    filePreviewLoaded.value = true
    editing.value = false
  }
  contentLoading.value = false
}

function getInlineFileContent(file: ModelFile) {
  // 只有后端明确返回 content 字段时才跳过远程预览；未返回 content 的文件仍走原有 url 预览流程。
  if (typeof file.content === 'string') return file.content
  return file.local ? '' : undefined
}

function applyFileContent(file: ModelFile) {
  const content = getInlineFileContent(file)
  filePreviewLoaded.value = content !== undefined
  editorValue.value = content ?? ''
  draftValue.value = editorValue.value
}

function normalizeFormats(source: unknown): string[][] {
  if (!Array.isArray(source)) return []
  return source
    .map(item => {
      if (Array.isArray(item)) {
        return item
          .map(format => typeof format === 'string' ? format : format?.id)
          .filter(Boolean)
      }
      return [typeof item === 'string' ? item : item?.id].filter(Boolean)
    })
    .filter(item => item.length)
}

function cloneFormatDetails(formatDetails: FormatDetail[][]) {
  return (formatDetails || []).map(group => group.map(item => ({ ...item })))
}

function selectModelConfig() {
  activeType.value = 'model'
  selectedFile.value = undefined
  selectedKeys.value = []
  propertyVisible.value = false
  editing.value = false
  filePreviewLoaded.value = false
  refreshEditorValue()
}

function selectFile(file: ModelFile) {
  activeType.value = 'file'
  selectedFile.value = file
  selectedKeys.value = [file.id || `${file.path || ''}/${file.name}`]
  editing.value = false
  applyFileContent(file)
}

function refreshEditorValue() {
  if (!isBuiltinConfigTabKey(configTab.value)) return
  const source = configTab.value === 'definition' ? props.model?.definition : props.model?.manifest
  editorValue.value = stringifyValue(source)
  draftValue.value = editorValue.value
}

function updateDefinitionContent(value: Record<string, unknown>) {
  editorValue.value = stringifyValue(value)
}

function toggleDefinitionViewMode() {
  // Keep the two editors from holding competing drafts while a model definition is being edited.
  if (editing.value || activeType.value !== 'model' || configTab.value !== 'definition') return
  definitionViewMode.value = definitionViewMode.value === 'form' ? 'json' : 'form'
}

function parseJsonSilently(value: string) {
  if (!value.trim()) return {}
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function stringifyValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  if (value === undefined || value === null) {
    return ''
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function startEdit() {
  draftValue.value = editorValue.value
  editing.value = true
}

function cancelEdit() {
  editorValue.value = draftValue.value
  editing.value = false
}

async function saveEdit() {
  if (activeType.value === 'file') {
    await saveTextFile()
    return
  }
  if (!isBuiltinConfigTabKey(configTab.value)) return
  // The default definition editor validates its local parameter draft before the shared save event is emitted.
  const definitionEditor = definitionEditorRef.value
  if (
    configTab.value === 'definition'
    && definitionViewMode.value === 'form'
    && definitionEditor
    && definitionEditor.prepareForSave() === undefined
  ) {
    onlyMessage(text.value.validationFailed, 'error')
    return
  }
  const config = buildSaveConfigPayload(configTab.value)
  if (!config) return
  fileSaving.value = true
  emit('save-config', {
    type: configTab.value,
    value: editorValue.value,
    config,
    done: completeSaving
  })
}

async function saveTextFile() {
  const currentFormat = selectedFormat.value || selectedFile.value?.format?.[0] || ''
  // Shared files can be saved without a format owner; parent handlers receive format="".
  if (!modelId.value || !selectedFile.value) return
  fileSaving.value = true
  emit('save-file', {
    format: currentFormat,
    file: {
      id: selectedFile.value.local ? undefined : selectedFile.value.id,
      name: selectedFile.value.name,
      path: selectedFile.value.path,
      format: selectedFile.value.format || [],
      content: editorValue.value
    },
    done: completeFileSaving
  })
}

async function addFile(payload: AddFilePayload) {
  if (!modelId.value) {
    payload.done?.(false)
    return
  }
  if (payload.createType === 'empty') {
    addLocalEmptyFile(payload)
    payload.done?.(true)
    return
  }
  const targetFormat = payload.format?.[0]
  fileSaving.value = true
  emit('add-file', {
    format: selectedFormat.value || payload.format?.[0] || '',
    file: normalizeAddFilePayload(payload),
    done: (success = true) => {
      if (success && targetFormat && selectedFormat.value) {
        selectedFormat.value = targetFormat
      }
      completeFileCreate(success)
      payload.done?.(success)
    }
  })
}

function batchAddFile(payload: BatchAddFilePayload) {
  if (!modelId.value) {
    payload.done?.(false)
    return
  }
  const targetFormat = payload.format?.[0]
  fileSaving.value = true
  // 批量保存沿用弹窗中选择的文件归属，保持与旧创建方式的 file.format 契约一致。
  emit('batch-add-file', {
    path: payload.path,
    format: payload.format,
    files: payload.files,
    update: payload.update,
    done: (success = true) => {
      if (success && targetFormat && selectedFormat.value) {
        selectedFormat.value = targetFormat
      }
      completeFileCreate(success)
      payload.done?.(success)
    }
  })
}

function normalizeAddFilePayload(payload: AddFilePayload): AddFilePayload {
  const { done, ...file } = payload
  return file
}

function addLocalEmptyFile(payload: AddFilePayload) {
  const file: ModelFile = {
    id: `local:${Date.now()}:${payload.path || ''}/${payload.name}`,
    name: payload.name,
    path: payload.path,
    format: payload.format,
    content: '',
    local: true
  }
  files.value = [...files.value, file]
  handleAddFileVisibleChange(false)
  selectFile(file)
  filePreviewLoaded.value = true
  editing.value = true
}

async function replaceFile(file: File) {
  const currentFormat = selectedFormat.value || selectedFile.value?.format?.[0] || ''
  if (!modelId.value || !selectedFile.value) return false
  fileSaving.value = true
  emit('replace-file', {
    format: currentFormat,
    target: selectedFile.value,
    file: {
      id: selectedFile.value.id,
      name: selectedFile.value.name,
      path: selectedFile.value.path,
      format: selectedFile.value.format || [],
      createType: 'upload',
      file
    },
    done: completeFileReplace
  })
  return false
}

function toggleProperty() {
  propertyVisible.value = !propertyVisible.value
  layoutEditor()
}

async function copyPath() {
  const file = selectedFile.value
  if (!file || typeof navigator === 'undefined') return
  const filePath = file.path ? `${file.path}/${file.name}` : file.name
  await navigator.clipboard?.writeText(filePath)
  onlyMessage(text.value.copySuccess)
}

function downloadSelectedFile() {
  const file = selectedFile.value
  if (!file?.url || typeof document === 'undefined') return
  const link = document.createElement('a')
  link.href = file.url
  link.download = file.name || 'model-file'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function openDeleteFileConfirm() {
  const file = selectedFile.value
  if (!file) return
  const sharedFile = isSharedModelFile(file)
  Modal.confirm({
    title: sharedFile ? text.value.confirmDeleteShared : text.value.confirmDelete,
    content: sharedFile ? text.value.confirmDeleteSharedDescription : text.value.confirmDeleteDescription,
    okText: text.value.confirm,
    cancelText: text.value.cancel,
    okType: 'danger',
    onOk: () => emit('delete-file', file)
  })
}

function isSharedModelFile(file: ModelFile) {
  // format 为空代表共享文件，删除影响所有复用该文件的架构。
  return !file.format?.length
}

function restoreSiderWidth() {
  if (typeof window === 'undefined') return
  let cached = Number.NaN
  try {
    cached = Number(window.localStorage?.getItem(SIDER_WIDTH_STORAGE_KEY))
  } catch {
    cached = Number.NaN
  }
  if (Number.isFinite(cached)) {
    siderWidth.value = clampSiderWidth(cached)
  }
}

function startResizeSider(event: PointerEvent) {
  if (!isSiderResizable()) return
  event.preventDefault()
  resizingSider.value = true
  siderResizeStartX = event.clientX
  siderResizeStartWidth = siderWidth.value
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  window.addEventListener('pointermove', resizeSider)
  window.addEventListener('pointerup', stopResizeSider)
  window.addEventListener('pointercancel', stopResizeSider)
}

function resizeSider(event: PointerEvent) {
  if (!resizingSider.value) return
  setSiderWidth(siderResizeStartWidth + event.clientX - siderResizeStartX, false)
}

function stopResizeSider() {
  const shouldPersist = resizingSider.value
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', resizeSider)
    window.removeEventListener('pointerup', stopResizeSider)
    window.removeEventListener('pointercancel', stopResizeSider)
  }
  resizingSider.value = false
  if (shouldPersist) {
    persistSiderWidth()
  }
}

function resizeSiderByKeyboard(offset: number) {
  if (!isSiderResizable()) return
  setSiderWidth(siderWidth.value + offset)
}

function setSiderWidth(width: number, persist = true) {
  siderWidth.value = clampSiderWidth(width)
  if (persist) {
    persistSiderWidth()
  }
  layoutEditor()
}

function persistSiderWidth() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(SIDER_WIDTH_STORAGE_KEY, String(siderWidth.value))
  } catch {
    // localStorage 可能被浏览器策略禁用，失败时仅不记忆宽度。
  }
}

function clampSiderWidth(width: number) {
  return Math.min(SIDER_WIDTH_MAX, Math.max(SIDER_WIDTH_MIN, Math.round(width)))
}

function isSiderResizable() {
  return typeof window !== 'undefined' && window.innerWidth > SIDER_RESIZE_BREAKPOINT
}

function layoutEditor() {
  if (typeof requestAnimationFrame === 'undefined') {
    editorRef.value?.layout?.()
    return
  }
  if (editorLayoutFrame) {
    cancelAnimationFrame(editorLayoutFrame)
  }
  editorLayoutFrame = requestAnimationFrame(() => {
    editorRef.value?.layout?.()
    editorLayoutFrame = 0
  })
}

async function previewFile() {
  if (!selectedFile.value?.url) return
  if (!canEditFile.value) {
    window.open(selectedFile.value.url, '_blank')
    return
  }
  contentLoading.value = true
  emit('preview-file', {
    file: selectedFile.value,
    done: completePreview
  })
}
</script>

<style scoped lang="less">
.model-config {
  display: grid;
  grid-template-columns: var(--model-config-sider-width, 17.5rem) 1px minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  background: var(--bg-sunken);
  overflow: hidden;
}

.model-config--resizing {
  cursor: col-resize;
  user-select: none;
}

.model-config__sider,
.model-config__property {
  min-height: 0;
  background: var(--bg);
  border-right: 1px solid var(--line);
  padding: var(--space-4);
  overflow: hidden auto;
}

.model-config__resize {
  position: relative;
  min-width: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.model-config__resize::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 1px;
  background: var(--line);
  transform: translateX(-50%);
  opacity: 0.65;
  transition: background-color 0.2s, opacity 0.2s;
}

.model-config__resize:hover::before,
.model-config__resize:focus-visible::before,
.model-config--resizing .model-config__resize::before {
  opacity: 1;
  background: var(--primary-color);
}

.model-config__property {
  width: 20rem;
  min-width: 0;
  border-right: 0;
  border-left: 1px solid var(--line);
}

.model-config__sider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.model-config__title {
  flex-shrink: 0;
  font-weight: 600;
  color: var(--ink-1);
}

.model-config__format {
  min-width: 9.5rem;
}

.model-config__format-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.model-config__actions {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.model-config__tree {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  background: transparent;
}

.model-config__sider :deep(.ant-spin-nested-loading),
.model-config__sider :deep(.ant-spin-container) {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.model-config__tree :deep(.ant-tree-list),
.model-config__tree :deep(.ant-tree-list-holder),
.model-config__tree :deep(.ant-tree-list-holder-inner),
.model-config__tree :deep(.ant-tree-treenode),
.model-config__tree :deep(.ant-tree-node-content-wrapper),
.model-config__tree :deep(.ant-tree-title) {
  min-width: 0;
  max-width: 100%;
}

.model-config__tree :deep(.ant-tree-list-holder-inner) {
  display: block;
  width: 100%;
  overflow: hidden;
}

.model-config__tree :deep(.ant-tree-treenode) {
  display: flex;
  width: 100%;
  overflow: hidden;
}

.model-config__tree :deep(.ant-tree-switcher),
.model-config__tree :deep(.ant-tree-indent) {
  flex-shrink: 0;
}

.model-config__tree :deep(.ant-tree-node-content-wrapper) {
  flex: 1 1 0;
  width: 0;
  overflow: hidden;
}

.model-config__tree :deep(.ant-tree-title) {
  display: block;
  width: 100%;
  overflow: hidden;
}

.model-config__content-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.model-config__tree-node {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.model-config__tree-node-main {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
}

.model-config__tree-node-main :deep(.ant-tooltip-open),
.model-config__tree-node-title {
  display: block;
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.model-config__tree-node--tagged {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 5.625rem;
}

.model-config__tree-node--tagged .model-config__tree-node-main {
  width: 100%;
}

.model-config__tree-tags {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  width: 5.625rem;
  min-width: 0;
  overflow: hidden;
  justify-content: flex-end;
}

.model-config__tree-tags :deep(.ant-tooltip-open) {
  min-width: 0;
  max-width: 100%;
}

:global(.model-config__tree-file-tooltip .ant-tooltip-inner),
:global(.model-config__tree-tag-tooltip .ant-tooltip-inner) {
  width: max-content;
  max-width: calc(100vw - 2rem);
}

:global(.model-config__tree-file-tooltip-content) {
  display: block;
  width: max-content;
  max-width: calc(100vw - 3rem);
}

:global(.model-config__tree-file-tooltip-path) {
  display: block;
  width: max-content;
  max-width: calc(100vw - 3rem);
  color: rgba(255, 255, 255, 0.72);
  white-space: nowrap;
}

:global(.model-config__tree-file-tooltip-path)::after {
  content: "/";
}

:global(.model-config__tree-file-tooltip-name),
:global(.model-config__tree-tag-tooltip .ant-tooltip-inner) {
  display: block;
  width: max-content;
  max-width: calc(100vw - 3rem);
  white-space: nowrap;
}

.model-config__tree-tag {
  display: inline-block;
  max-width: 100%;
  min-width: 0;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: var(--r-1);
  border: 1px solid var(--line);
  color: var(--ink-2);
  background: var(--bg-sunken);
  font-size: var(--fs-12);
  line-height: 1.25rem;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-config__tree-tag--extract {
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 32%, var(--line));
  background: color-mix(in srgb, var(--warning) 8%, var(--bg));
}

.model-config__tree-tag--format {
  color: var(--primary-color);
  border-color: color-mix(in srgb, var(--primary-color) 32%, var(--line));
  background: color-mix(in srgb, var(--primary-color) 8%, var(--bg));
}

.model-config__tree-add {
  opacity: 0;
}

.model-config__tree-node:hover .model-config__tree-add {
  opacity: 1;
}

.model-config__empty {
  margin-top: 3rem;
}

.model-config__main {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: var(--bg);
}

.model-config__main--with-tabs {
  grid-template-rows: auto auto minmax(0, 1fr);
}

.model-config__content-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.model-config__content-title {
  font-weight: 600;
  color: var(--ink-1);
  overflow-wrap: anywhere;
}

.model-config__config-tabs {
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--line);
}

.model-config__editor-wrap {
  min-width: 0;
  min-height: 0;
  display: grid;
  padding: var(--space-4);
}

.model-config__editor-wrap--definition {
  padding-top: var(--space-2);
}

.model-config__extra-content {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.model-config__definition-content {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.model-config__editor {
  height: 100%;
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: var(--r-2);
  overflow: hidden;
}

.model-config__preview {
  height: 100%;
  min-height: 0;
  display: grid;
  place-items: center;
  border: 1px dashed var(--line);
  border-radius: var(--r-2);
  background: var(--bg-sunken);
}

@media (max-width: 1100px) {
  .model-config {
    grid-template-columns: 14rem minmax(0, 1fr);
  }

  .model-config__resize {
    display: none;
  }

  .model-config__property {
    grid-column: 1 / -1;
    width: auto;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
</style>
