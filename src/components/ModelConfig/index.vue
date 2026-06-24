<template>
  <div class="model-config">
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
            allow-clear
          />
          <a-button
            size="small"
            :title="text.addFormat"
            @click="openAddFormat"
          >
            <AIcon type="PlusOutlined" />
          </a-button>
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
        <a-button block @click="openAddFile('')">
          <AIcon type="PlusOutlined" />
          {{ text.addFile }}
        </a-button>
      </div>

      <a-spin :spinning="fileLoading">
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
          <template #title="{ title, isFile, path }">
            <span class="model-config__tree-node">
              <span class="model-config__tree-node-main">
                <AIcon :type="isFile ? 'FileOutlined' : 'FolderOutlined'" />
                <span>{{ title }}</span>
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

    <main class="model-config__main">
      <header class="model-config__content-head">
        <div class="model-config__content-title">
          <AIcon :type="activeType === 'model' ? 'SettingOutlined' : 'FileTextOutlined'" />
          <span>{{ activeTitle }}</span>
        </div>
        <a-space>
          <template v-if="activeType === 'model'">
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
            <a-button v-if="canEditFile && filePreviewLoaded && !editing" @click="startEdit">
              <AIcon type="EditOutlined" />
              {{ text.edit }}
            </a-button>
            <template v-if="editing">
              <a-button @click="cancelEdit">{{ text.exitEdit }}</a-button>
              <a-button type="primary" :loading="fileSaving" @click="saveEdit">{{ text.save }}</a-button>
            </template>
            <a-popconfirm
              :title="text.confirmDelete"
              @confirm="emit('delete-file', selectedFile)"
            >
              <a-button danger>
                <AIcon type="DeleteOutlined" />
                {{ text.delete }}
              </a-button>
            </a-popconfirm>
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
          <a-tab-pane key="manifest" :tab="text.basicInfo" />
        </a-tabs>
      </div>

      <section class="model-config__editor-wrap">
        <MonacoEditor
          v-if="showEditor"
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
      v-model:open="addFileVisible"
      :selected-format="selectedFormat"
      :selected-owner="selectedOwner"
      :locale="text"
      @confirm="addFile"
    />
    <AddFormatModal
      v-model:open="addFormatVisible"
      :existing-formats="existingFormatIds"
      :locale="text"
      :confirm-loading="addFormatSaving"
      @confirm="saveFormat"
    />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import SectionCard from '../SectionCard/index.vue'
import KvGrid from '../KvGrid/index.vue'
import { fileUpload } from '@jetlinks-web-core/api/comm'
import { queryModelFiles, saveModelFile, saveModelFormats, type ModelFile } from '@jetlinks-web-core/api/modelConfig'
import AddFileModal from './AddFileModal.vue'
import AddFormatModal from './AddFormatModal.vue'

interface FormatDetail {
  id: string
  name?: string
  local?: boolean
}

interface TreeNode {
  title: string
  key: string
  path?: string
  isFile?: boolean
  file?: ModelFile
  children?: TreeNode[]
}

type LocaleText = Record<string, string>

interface AddFilePayload {
  id?: string
  name: string
  path?: string
  format?: string[]
  createType: 'upload' | 'empty'
  file?: File
}

const defaultLocale: LocaleText = {
  fileDirectory: '文件目录',
  selectFormat: '请选择架构',
  modelConfig: '模型配置',
  addFile: '新增文件',
  noFiles: '暂无模型文件，先选择架构后上传文件',
  edit: '编辑',
  exitEdit: '退出编辑',
  save: '保存',
  delete: '删除',
  confirmDelete: '确认删除该文件？',
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
  replaceFile: '上传替换文件',
  fileProperty: '文件属性',
  copyPath: '复制路径',
  copySuccess: '文件路径已复制',
  filePath: '文件路径',
  fileName: '文件名称',
  fileFormat: '支持架构',
  fileMd5: 'MD5',
  fileSha256: 'SHA256',
  fileScore: '评分',
  fileKey: '文件标识',
  sharedFile: '共享文件',
  saveSuccess: '已更新编辑内容',
  fileSaveSuccess: '文件已保存',
  confirm: '确定',
  cancel: '取消',
  pleaseEnterFileName: '请输入文件名称',
  selectFile: '选择文件',
  pleaseSelectFile: '请选择文件',
  fileOwner: '文件归属',
  selectFileOwner: '请选择文件归属',
  createType: '创建方式',
  uploadCreate: '上传文件',
  emptyCreate: '空白文件',
  rootDirectory: '根目录',
  currentFormatFile: '当前架构文件',
  addFormat: '新增架构',
  format: '架构',
  addFormatSuccess: '已新增架构'
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
  }
})

const emit = defineEmits<{
  (e: 'save-config', payload: { type: 'definition' | 'manifest' | 'file'; value: string; file?: ModelFile }): void
  (e: 'add-file', payload: AddFilePayload): void
  (e: 'format-added', format: string): void
  (e: 'replace-file', file: ModelFile): void
  (e: 'delete-file', file: ModelFile): void
}>()

const text = computed(() => ({ ...defaultLocale, ...props.locale }))
const selectedFormat = ref<string>()
const selectedKeys = ref<string[]>([])
const files = ref<ModelFile[]>([])
const fileLoading = ref(false)
const activeType = ref<'model' | 'file'>('model')
const selectedFile = ref<ModelFile>()
const configTab = ref<'definition' | 'manifest'>('definition')
const editing = ref(false)
const editorValue = ref('')
const draftValue = ref('')
const propertyVisible = ref(false)
const addFileVisible = ref(false)
const addFormatVisible = ref(false)
const addFormatSaving = ref(false)
const filePreviewLoaded = ref(false)
const contentLoading = ref(false)
const fileSaving = ref(false)
const selectedOwner = ref('')
const localFormatDetails = ref<FormatDetail[][]>([])
const editorRef = ref<{ layout?: () => void }>()

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
  'xml'
]

const formatOptions = computed(() => {
  return localFormatDetails.value
    .flat()
    .filter(item => item?.id)
    .map(item => ({
      label: item.local ? `${item.name || item.id} (${item.id})` : item.name || item.id,
      value: item.id
    }))
})

const existingFormatIds = computed(() => {
  const formatIds = localFormatDetails.value
    .flat()
    .map(item => item?.id)
    .filter(Boolean) as string[]
  const modelFormatIds = normalizeFormats(props.model?.formats).flat()
  return Array.from(new Set([...modelFormatIds, ...formatIds]))
})

const modelId = computed(() => props.model?.id)
const modelVersion = computed(() => props.model?.version || props.model?.modelVersion || props.model?.latestVersion || props.model?.versionNo || 1)

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

const showEditor = computed(() => activeType.value === 'model' || (canEditFile.value && filePreviewLoaded.value))

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
    xml: 'xml'
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
  const filePath = file.path ? `${file.path}/${file.name}` : file.name
  return [
    { label: text.value.fileName, value: file.name || '--' },
    { label: text.value.filePath, value: filePath || '--', mono: true },
    { label: text.value.fileFormat, value: file.format?.length ? file.format.join(', ') : text.value.sharedFile },
    { label: text.value.fileKey, value: file.fileKey || '--', mono: true },
    { label: text.value.fileMd5, value: file.md5 || '--', mono: true },
    { label: text.value.fileSha256, value: file.sha256 || '--', mono: true },
    { label: text.value.fileScore, value: file.score ?? '--' }
  ]
})

watch(formatOptions, (options) => {
  if (!selectedFormat.value && options.length) {
    selectedFormat.value = options[0].value as string
  }
}, { immediate: true })

watch(() => props.formatDetails, (formatDetails) => {
  localFormatDetails.value = cloneFormatDetails(formatDetails)
}, { deep: true, immediate: true })

watch([modelId, selectedFormat], () => {
  loadFiles()
}, { immediate: true })

watch(() => props.model, () => {
  if (activeType.value === 'model' && !editing.value) {
    refreshEditorValue()
  }
}, { deep: true, immediate: true })

watch(configTab, () => {
  if (!editing.value) {
    refreshEditorValue()
  }
})

async function loadFiles() {
  if (!modelId.value || !selectedFormat.value) {
    files.value = []
    return
  }
  fileLoading.value = true
  try {
    const resp = await queryModelFiles(modelId.value, {
      version: modelVersion.value,
      format: selectedFormat.value
    })
    files.value = Array.isArray(resp?.result) ? resp.result : []
    if (activeType.value === 'file') {
      const nextFile = files.value.find(item => item.id === selectedFile.value?.id)
      if (nextFile) {
        selectFile(nextFile)
      } else {
        selectModelConfig()
      }
    }
  } finally {
    fileLoading.value = false
  }
}

function buildTree(source: ModelFile[]): TreeNode[] {
  const roots: TreeNode[] = []
  const folderMap = new Map<string, TreeNode>()
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
      file
    })
  })
  return roots
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

function openAddFormat() {
  addFormatVisible.value = true
}

async function saveFormat(format: string) {
  if (!modelId.value) return
  addFormatSaving.value = true
  try {
    await saveModelFormats(modelId.value, buildSaveFormatPayload(format))
    addLocalFormat(format)
    selectedFormat.value = format
    addFormatVisible.value = false
    onlyMessage(text.value.addFormatSuccess)
    emit('format-added', format)
  } finally {
    addFormatSaving.value = false
  }
}

function buildSaveFormatPayload(format: string) {
  // 新增架构只扩展支持架构列表，模型参数和基础信息必须沿用当前详情，避免保存时清空已有配置。
  const formats = normalizeFormats(props.model?.formats)
  if (!formats.length) {
    formats.push(...normalizeFormats(props.model?.formatDetails))
  }
  if (!formats.some(item => item.includes(format))) {
    formats.push([format])
  }
  return {
    definition: props.model?.definition || {},
    manifest: props.model?.manifest || {},
    formats
  }
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

function addLocalFormat(format: string) {
  if (localFormatDetails.value.flat().some(item => item?.id === format)) return
  localFormatDetails.value = [
    ...localFormatDetails.value,
    [{ id: format, name: format }]
  ]
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
  filePreviewLoaded.value = false
  editorValue.value = ''
  draftValue.value = editorValue.value
}

async function loadFileContent(file: ModelFile) {
  if (!file.url) return ''
  try {
    const resp = await fetch(file.url)
    return await resp.text()
  } catch {
    return ''
  }
}

function refreshEditorValue() {
  const source = configTab.value === 'definition' ? props.model?.definition : props.model?.manifest
  editorValue.value = stringifyValue(source)
  draftValue.value = editorValue.value
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
  emit('save-config', {
    type: activeType.value === 'model' ? configTab.value : 'file',
    value: editorValue.value,
    file: selectedFile.value
  })
  editing.value = false
  draftValue.value = editorValue.value
  onlyMessage(text.value.saveSuccess)
}

async function saveTextFile() {
  if (!modelId.value || !selectedFormat.value || !selectedFile.value) return
  fileSaving.value = true
  try {
    await saveModelFile(modelId.value, selectedFormat.value, {
      id: selectedFile.value.id,
      name: selectedFile.value.name,
      path: selectedFile.value.path,
      content: editorValue.value
    })
    editing.value = false
    draftValue.value = editorValue.value
    onlyMessage(text.value.fileSaveSuccess)
    await loadFiles()
  } finally {
    fileSaving.value = false
  }
}

async function addFile(payload: AddFilePayload) {
  if (!modelId.value || !selectedFormat.value) return
  fileSaving.value = true
  try {
    await saveModelFile(modelId.value, selectedFormat.value, await buildFileSavePayload(payload))
    addFileVisible.value = false
    onlyMessage(text.value.fileSaveSuccess)
    await loadFiles()
  } finally {
    fileSaving.value = false
  }
}

async function replaceFile(file: File) {
  if (!modelId.value || !selectedFormat.value || !selectedFile.value) return false
  fileSaving.value = true
  try {
    await saveModelFile(modelId.value, selectedFormat.value, await buildFileSavePayload({
      id: selectedFile.value.id,
      name: selectedFile.value.name,
      path: selectedFile.value.path,
      createType: 'upload',
      file
    } as AddFilePayload))
    filePreviewLoaded.value = false
    editorValue.value = ''
    draftValue.value = ''
    onlyMessage(text.value.fileSaveSuccess)
    await loadFiles()
  } finally {
    fileSaving.value = false
  }
  return false
}

async function buildFileSavePayload(payload: AddFilePayload) {
  const data: Record<string, any> = {
    id: payload.id,
    name: payload.name,
    path: payload.path
  }
  if (payload.createType === 'upload' && payload.file) {
    const uploadResult = await uploadModelFile(payload.file)
    return {
      ...data,
      url: uploadResult.accessUrl,
      md5: uploadResult.md5,
      sha256: uploadResult.sha256
    }
  }
  return {
    ...data,
    content: ''
  }
}

async function uploadModelFile(file: File) {
  const formData = new FormData()
  formData.append('file', file, file.name)
  const resp = await fileUpload(formData)
  return resp?.result || {}
}

function toggleProperty() {
  propertyVisible.value = !propertyVisible.value
  nextTick(() => {
    editorRef.value?.layout?.()
  })
}

async function copyPath() {
  const file = selectedFile.value
  if (!file || typeof navigator === 'undefined') return
  const filePath = file.path ? `${file.path}/${file.name}` : file.name
  await navigator.clipboard?.writeText(filePath)
  onlyMessage(text.value.copySuccess)
}

async function previewFile() {
  if (!selectedFile.value?.url) return
  if (!canEditFile.value) {
    window.open(selectedFile.value.url, '_blank')
    return
  }
  contentLoading.value = true
  try {
    editorValue.value = await loadFileContent(selectedFile.value)
    draftValue.value = editorValue.value
    filePreviewLoaded.value = true
    editing.value = false
  } finally {
    contentLoading.value = false
  }
}
</script>

<style scoped lang="less">
.model-config {
  display: grid;
  grid-template-columns: 17.5rem minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  background: var(--bg-sunken);
  overflow: hidden;
}

.model-config__sider,
.model-config__property {
  min-height: 0;
  background: var(--bg);
  border-right: 1px solid var(--line);
  padding: var(--space-4);
  overflow: auto;
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
  background: transparent;
}

.model-config__tree-node,
.model-config__content-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.model-config__tree-node {
  width: 100%;
  justify-content: space-between;
}

.model-config__tree-node-main {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
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
  grid-template-rows: auto auto minmax(0, 1fr);
  background: var(--bg);
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
  padding: var(--space-4);
}

.model-config__editor {
  height: 100%;
  min-height: 22rem;
  border: 1px solid var(--line);
  border-radius: var(--r-2);
  overflow: hidden;
}

.model-config__preview {
  height: 100%;
  min-height: 22rem;
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

  .model-config__property {
    grid-column: 1 / -1;
    width: auto;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
</style>
