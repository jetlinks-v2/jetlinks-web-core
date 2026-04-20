<template>
  <div class="j-md-editor">
    <div
      class="j-md-editor__surface"
      :class="{
        'is-disabled': disabled,
        'is-dragover': dragActive,
      }"
      @dragenter.prevent="handleDragEnter"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input ref="fileInputRef" type="file" multiple class="j-md-editor__file-input" tabindex="-1" aria-hidden="true" style="display: none" @change="handleFileInputChange" />

      <a-empty v-if="disabled && !text.trim()" :description="mergedTexts.emptyDescription" class="j-md-editor__empty" />

      <MdPreview
        v-else-if="disabled"
        :id="previewId"
        class="j-md-editor__preview-only"
        :model-value="text"
        :language="editorLanguage"
        :theme="theme"
        :preview-theme="previewTheme"
        :code-theme="codeTheme"
      />

      <MdEditor
        v-else
        ref="editorRef"
        v-model="text"
        class="j-md-editor__inner"
        :style="{ height: editorHeight }"
        :placeholder="placeholder"
        :language="editorLanguage"
        :theme="theme"
        :toolbars="mergedToolbars"
        :footers="[]"
        :input-box-width="inputBoxWidth"
        :show-toolbar-name="false"
        :preview-theme="previewTheme"
        :code-theme="codeTheme"
        :on-upload-img="handleUploadImages"
      >
        <template #defToolbars>
          <NormalToolbar
            v-if="showUploadFileToolbar"
            :title="mergedTexts.uploadFile"
            @onClick="openFilePicker"
          >
            <span class="j-md-editor__toolbar-icon" aria-hidden="true">
              <AIcon type="PaperClipOutlined" />
            </span>
          </NormalToolbar>
        </template>
      </MdEditor>

      <div v-if="dragActive && !disabled" class="j-md-editor__drop-mask">
        <div class="j-md-editor__drop-title">{{ mergedTexts.dropTitle }}</div>
        <div class="j-md-editor__drop-subtitle">{{ mergedTexts.dropSubtitle }}</div>
      </div>
    </div>

    <div v-if="!disabled" class="j-md-editor__hint-row">
      <span class="j-md-editor__hint">
        {{ uploading ? mergedTexts.uploading : mergedTexts.uploadHint }}
      </span>
    </div>

    <p v-if="uploadError" class="j-md-editor__error">{{ uploadError }}</p>
  </div>
</template>

<script setup lang="ts">
import { fileUpload, getFileUrlById } from '@jetlinks-web-core/api/comm'
import { onlyMessage } from '@jetlinks-web/utils'
import {
  MdEditor,
  MdPreview,
  NormalToolbar,
  type ExposeParam,
  type ToolbarNames,
  type UploadImgCallBack,
} from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

export interface MarkdownEditorTexts {
  emptyDescription: string
  uploadHint: string
  uploading: string
  uploadFile: string
  dropTitle: string
  dropSubtitle: string
  uploadFailed: string
  uploadNoUrl: string
}

let editorSeed = 0

const defaultToolbars: ToolbarNames[] = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'link',
  'image',
  0,
  'codeRow',
  'code',
  'table',
  '-',
  'revoke',
  'next',
  '=',
  'preview',
  'previewOnly',
  'fullscreen',
]

const defaultTexts: MarkdownEditorTexts = {
  emptyDescription: 'Nothing to preview',
  uploadHint: 'Drag, paste, or upload images/files to insert Markdown links automatically',
  uploading: 'Uploading files...',
  uploadFile: 'Upload file',
  dropTitle: 'Drop to upload into the document',
  dropSubtitle: 'Images become ![]() and other files become []()',
  uploadFailed: 'File upload failed',
  uploadNoUrl: 'Upload succeeded but no file URL was returned',
}

const props = withDefaults(
  defineProps<{
    modelValue?: string
    rows?: number
    placeholder?: string
    emptyDescription?: string
    disabled?: boolean
    language?: string
    theme?: 'light' | 'dark'
    previewTheme?: string
    codeTheme?: string
    inputBoxWidth?: string
    toolbars?: ToolbarNames[]
    texts?: Partial<MarkdownEditorTexts>
    showUploadFileToolbar?: boolean
  }>(),
  {
    modelValue: '',
    rows: 12,
    placeholder: '',
    emptyDescription: undefined,
    disabled: false,
    language: undefined,
    theme: 'light',
    previewTheme: 'github',
    codeTheme: 'atom',
    inputBoxWidth: undefined,
    toolbars: undefined,
    texts: undefined,
    showUploadFileToolbar: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { locale } = useI18n()

const text = ref(props.modelValue ?? '')
const editorRef = ref<ExposeParam>()
const fileInputRef = ref<HTMLInputElement>()
const uploadError = ref('')
const uploading = ref(false)
const dragActive = ref(false)
const dragDepth = ref(0)

const editorId = `j-md-editor-${++editorSeed}`
const previewId = `${editorId}-preview`

const editorLanguage = computed(() => {
  if (props.language?.trim()) return props.language.trim()
  const current = String(locale.value || '').toLowerCase()
  return current.startsWith('zh') ? 'zh-CN' : 'en-US'
})

const editorHeight = computed(() => `${Math.max((props.rows ?? 12) * 24 + 120, 360)}px`)
const mergedToolbars = computed(() => props.toolbars?.length ? props.toolbars : defaultToolbars)
const mergedTexts = computed<MarkdownEditorTexts>(() => ({
  ...defaultTexts,
  ...(props.texts || {}),
  emptyDescription: props.emptyDescription?.trim() || props.texts?.emptyDescription || defaultTexts.emptyDescription,
}))
const inputBoxWidth = computed(() => {
  if (props.inputBoxWidth?.trim()) return props.inputBoxWidth.trim()
  return (props.rows ?? 12) >= 20 ? '52%' : '56%'
})

watch(
  () => props.modelValue,
  (value) => {
    const next = value ?? ''
    if (next !== text.value) {
      text.value = next
    }
  },
)

watch(text, (value) => {
  emit('update:modelValue', value)
})

function openFilePicker() {
  if (props.disabled || uploading.value) return
  fileInputRef.value?.click()
}

function resetInputValue(event: Event) {
  const input = event.target as HTMLInputElement | null
  if (input) {
    input.value = ''
  }
}

function escapeMarkdownLabel(value: string) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\r?\n/g, ' ')
}

function markdownUrl(url: string) {
  return `<${String(url || '').replace(/>/g, '%3E')}>`
}

function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i.test(file.name || '')
}

function buildMarkdownSnippet(file: File, url: string) {
  const name = escapeMarkdownLabel(file.name || (isImageFile(file) ? 'image' : 'file'))
  const target = markdownUrl(url)
  return isImageFile(file) ? `![${name}](${target})` : `[${name}](${target})`
}

function insertUploadedSnippets(snippets: string[]) {
  if (!snippets.length) return

  const content = snippets.join('\n')
  if (editorRef.value?.insert) {
    editorRef.value.insert(() => ({
      targetValue: content,
      select: false,
    }))
    return
  }

  text.value = text.value?.trim() ? `${text.value}\n${content}` : content
}

function resolveUploadUrl(result: Record<string, any>) {
  let url = String(result.accessUrl ?? result.path ?? result.url ?? result.location ?? '').trim()
  if (!url && result.id != null) {
    url = getFileUrlById(String(result.id))
  }
  return url
}

async function uploadSingleFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const res: any = await fileUpload(formData)

  if (!(res?.success || res?.status === 200)) {
    throw new Error(res?.message || mergedTexts.value.uploadFailed)
  }

  const url = resolveUploadUrl(res?.result || {})
  if (!url) {
    throw new Error(mergedTexts.value.uploadNoUrl)
  }

  return { file, url }
}

async function uploadMany(files: File[]) {
  const uploaded = [] as Array<{ file: File; url: string }>
  for (const file of files) {
    uploaded.push(await uploadSingleFile(file))
  }
  return uploaded
}

async function runUploadTask<T>(task: () => Promise<T>) {
  uploading.value = true
  uploadError.value = ''
  try {
    return await task()
  } catch (error: any) {
    const message = error?.message || mergedTexts.value.uploadFailed
    uploadError.value = message
    onlyMessage(message, 'error')
    return undefined
  } finally {
    uploading.value = false
    resetDragState()
  }
}

async function handleUploadImages(files: Array<File>, callback: UploadImgCallBack) {
  const uploaded = await runUploadTask(() => uploadMany(files))
  if (!uploaded?.length) return

  callback(
    uploaded
      .filter(({ file }) => isImageFile(file))
      .map(({ file, url }) => ({
        url,
        alt: file.name || 'image',
        title: file.name || 'image',
      })),
  )
}

async function uploadFiles(files: File[]) {
  const uploaded = await runUploadTask(() => uploadMany(files))
  if (!uploaded?.length) return
  insertUploadedSnippets(uploaded.map(({ file, url }) => buildMarkdownSnippet(file, url)))
}

async function handleFileInputChange(event: Event) {
  const files = Array.from((event.target as HTMLInputElement | null)?.files ?? [])
  resetInputValue(event)
  if (!files.length) return
  await uploadFiles(files)
}

function hasTransferFiles(dataTransfer?: DataTransfer | null) {
  return !!dataTransfer && Array.from(dataTransfer.types || []).includes('Files')
}

function resetDragState() {
  dragDepth.value = 0
  dragActive.value = false
}

function handleDragEnter(event: DragEvent) {
  if (props.disabled || !hasTransferFiles(event.dataTransfer)) return
  dragDepth.value += 1
  dragActive.value = true
}

function handleDragOver(event: DragEvent) {
  if (props.disabled || !hasTransferFiles(event.dataTransfer)) return
  dragActive.value = true
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function handleDragLeave(event: DragEvent) {
  if (props.disabled || !hasTransferFiles(event.dataTransfer)) return
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (!dragDepth.value) {
    dragActive.value = false
  }
}

async function handleDrop(event: DragEvent) {
  if (props.disabled) return
  event.stopPropagation()
  const files = Array.from(event.dataTransfer?.files ?? [])
  resetDragState()
  if (!files.length) return
  await uploadFiles(files)
}
</script>

<style scoped lang="less">
.j-md-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.j-md-editor__surface {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: #fff;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.j-md-editor__surface.is-dragover {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.12);
  background: #f7fbff;
}

.j-md-editor__surface.is-disabled {
  background: #fafafa;
}

.j-md-editor__surface :deep(.md-editor) {
  border: 0;
}

.j-md-editor__surface :deep(.md-editor-toolbar) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.j-md-editor__surface :deep(.md-editor-toolbar-wrapper) {
  padding-inline: 8px;
}

.j-md-editor__surface :deep(.md-editor-input-wrapper),
.j-md-editor__surface :deep(.md-editor-preview-wrapper) {
  font-size: 13px;
}

.j-md-editor__surface :deep(.md-editor-input) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.j-md-editor__surface :deep(.md-editor-preview) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.j-md-editor__surface :deep(.md-editor-footer) {
  display: none;
}

.j-md-editor__preview-only {
  min-height: 220px;
  padding: 16px;
}

.j-md-editor__empty {
  padding: 40px 0;
}

.j-md-editor__drop-mask {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px dashed rgba(22, 119, 255, 0.42);
  background: rgba(22, 119, 255, 0.08);
  color: #0958d9;
  text-align: center;
  pointer-events: none;
}

.j-md-editor__drop-title {
  font-size: 15px;
  font-weight: 600;
}

.j-md-editor__drop-subtitle {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.65);
}

.j-md-editor__hint-row {
  display: flex;
  justify-content: flex-end;
}

.j-md-editor__hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
}

.j-md-editor__error {
  margin: 0;
  color: #cf1322;
  font-size: 12px;
}

.j-md-editor__toolbar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
</style>

