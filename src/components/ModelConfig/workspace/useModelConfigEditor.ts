import { computed, watch } from 'vue'
import { isEqual } from 'lodash-es'
import { onlyMessage } from '@jetlinks-web/utils'
import type { ModelFile } from '../modelFileDirectory'
import { isBuiltinConfigTabKey } from './types'
import type { ModelConfigEmits, ModelConfigProps } from './types'
import type { ModelConfigState } from './useModelConfigState'

export function useModelConfigEditor(props: ModelConfigProps, emit: ModelConfigEmits, state: ModelConfigState, requestFiles: () => void) {
  const {
    activeType, selectedFile, selectedKeys, propertyVisible, editing, filePreviewLoaded, configTab,
    editorValue, draftValue, definitionViewMode, definitionEditorRef, fileSaving, modelId, selectedFormat,
    text, files, isBuiltinConfigTab
  } = state
  const definitionContent = computed(() => {
    const parsed = parseJsonSilently(editorValue.value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : props.model?.definition || {}
  })

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

  watch(() => props.files, (nextFiles) => {
    files.value = Array.isArray(nextFiles) ? [...nextFiles] : []
    // 文件一级页允许尚未选择文件；只有原先选中的文件消失才返回配置页。
    if (activeType.value === 'file' && selectedFile.value) {
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

  function hasUnsavedChanges() {
    if (!editing.value) return false
    if (activeType.value === 'model' && configTab.value === 'definition' && definitionViewMode.value === 'form') {
      // 默认表单按各编辑器的实际草稿判断，避免预览重建字段导致改回原值仍误报。
      const formEditor = definitionEditorRef.value
      return formEditor?.hasChanges
        ? formEditor.hasChanges()
        : !isEqual(parseJsonSilently(editorValue.value), parseJsonSilently(draftValue.value))
    }
    return editorValue.value !== draftValue.value
  }

  async function saveEdit(): Promise<boolean> {
    if (fileSaving.value) return false
    if (activeType.value === 'file') {
      return saveTextFile()
    }
    if (!isBuiltinConfigTabKey(configTab.value)) return false
    // The default definition editor validates its local parameter draft before the shared save event is emitted.
    const definitionEditor = definitionEditorRef.value
    if (
      configTab.value === 'definition'
      && definitionViewMode.value === 'form'
      && definitionEditor
      && definitionEditor.prepareForSave() === undefined
    ) {
      onlyMessage(text.value.validationFailed, 'error')
      return false
    }
    const config = buildSaveConfigPayload(configTab.value)
    if (!config) return false
    const type = configTab.value
    fileSaving.value = true
    // 仍由宿主通过原 done 回调确认保存结果，发出事件不代表保存成功。
    return new Promise(resolve => {
      emit('save-config', {
        type,
        value: editorValue.value,
        config,
        done: success => {
          completeSaving(success)
          resolve(Boolean(success))
        }
      })
    })
  }

  async function saveTextFile(): Promise<boolean> {
    const currentFormat = selectedFormat.value || selectedFile.value?.format?.[0] || ''
    // Shared files can be saved without a format owner; parent handlers receive format="".
    if (!modelId.value || !selectedFile.value) return false
    fileSaving.value = true
    const file = {
      id: selectedFile.value.local ? undefined : selectedFile.value.id,
      name: selectedFile.value.name,
      path: selectedFile.value.path,
      format: selectedFile.value.format || [],
      content: editorValue.value
    }
    return new Promise(resolve => {
      emit('save-file', {
        format: currentFormat,
        file,
        done: success => {
          completeFileSaving(success)
          resolve(Boolean(success))
        }
      })
    })
  }

  function completeSaving(success?: boolean) {
    if (success) {
      editing.value = false
      draftValue.value = editorValue.value
      onlyMessage(text.value.saveSuccess)
    }
    fileSaving.value = false
  }

  function completeFileSaving(success?: boolean) {
    if (success) {
      editing.value = false
      draftValue.value = editorValue.value
      onlyMessage(text.value.fileSaveSuccess)
      requestFiles()
    }
    fileSaving.value = false
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

  function buildSaveConfigPayload(type: 'definition' | 'manifest') {
    const value = parseEditorJson()
    if (value === undefined) return undefined
    return {
      definition: type === 'definition' ? value : props.model?.definition || {},
      manifest: type === 'manifest' ? value : props.model?.manifest || {},
      formats: buildCurrentFormats()
    }
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

  function buildCurrentFormats() {
    const formats = normalizeFormats(props.model?.formats)
    if (!formats.length) {
      formats.push(...normalizeFormats(props.model?.formatDetails))
    }
    return formats
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

  return { definitionContent, selectModelConfig, selectFile, refreshEditorValue, updateDefinitionContent, toggleDefinitionViewMode, startEdit, cancelEdit, hasUnsavedChanges, saveEdit }
}
