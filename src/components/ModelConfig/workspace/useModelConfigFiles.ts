import { computed } from 'vue'
import type { Slots } from 'vue'
import { Modal } from 'ant-design-vue'
import { onlyMessage } from '@jetlinks-web/utils'
import type { ModelFile, TreeNode } from '../modelFileDirectory'
import { normalizeFilePath } from '../fileOwnerOptions'
import type { BatchAddFilePayload } from '../batchFileUpload'
import type { AddFilePayload, ModelConfigEmits, ModelConfigProps } from './types'
import type { ModelConfigState } from './useModelConfigState'

export function useModelConfigFiles(
  props: ModelConfigProps,
  emit: ModelConfigEmits,
  slots: Slots,
  state: ModelConfigState,
  requestFiles: () => void,
  selectFile: (file: ModelFile) => void,
  layoutEditor: () => void
) {
  const {
    text, selectedOwner, addFileVisible, modelId, selectedFormat, fileSaving, files, filePreviewLoaded,
    editorValue, draftValue, selectedFile, editing, contentLoading, propertyVisible, canEditFile
  } = state
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

  function completeFileCreate(success: boolean) {
    if (success) {
      handleAddFileVisibleChange(false)
      onlyMessage(text.value.fileSaveSuccess)
      requestFiles()
    }
    fileSaving.value = false
  }

  function completeFileReplace(success?: boolean) {
    if (success) {
      filePreviewLoaded.value = false
      editorValue.value = ''
      draftValue.value = ''
      onlyMessage(text.value.fileSaveSuccess)
      requestFiles()
    }
    fileSaving.value = false
  }

  function completePreview(success?: boolean, content = '') {
    if (success) {
      editorValue.value = content
      draftValue.value = editorValue.value
      filePreviewLoaded.value = true
      editing.value = false
    }
    contentLoading.value = false
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

  return { showCustomCreate, showBatchUpload, onTreeSelect, openAddFile, handleAddFileVisibleChange, addFile, batchAddFile, replaceFile, previewFile, toggleProperty, copyPath, downloadSelectedFile, openDeleteFileConfirm }
}
