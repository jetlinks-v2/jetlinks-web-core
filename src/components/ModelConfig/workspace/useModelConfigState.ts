import { computed, ref } from 'vue'
import globalI18n from '@jetlinks-web-core/locales'
import type { ModelFile } from '../modelFileDirectory'
import { defaultLocale } from './defaultLocale'
import { isBuiltinConfigTabKey } from './types'
import type { DefinitionEditorExpose, DefinitionViewMode, FormatDetail, ModelConfigProps } from './types'

export function useModelConfigState(props: ModelConfigProps) {
  const text = computed(() => ({
    ...defaultLocale,
    unsavedChangesTitle: globalI18n.global.t('components.ModelConfig.unsavedChangesTitle'),
    unsavedChangesMessage: globalI18n.global.t('components.ModelConfig.unsavedChangesMessage'),
    discard: globalI18n.global.t('components.ModelConfig.discard'),
    ...props.locale
  }))
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
  const fileWorkspaceRef = ref<{ layout?: () => void }>()
  const resizingSider = ref(false)
  const siderWidth = ref(280)
  const definitionEditorRef = ref<DefinitionEditorExpose>()

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

  const modelId = computed(() => props.model?.id)
  const isBuiltinConfigTab = computed(() => isBuiltinConfigTabKey(configTab.value))

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
      { label: text.value.fileName, value: file.name || globalI18n.global.t('comm.table.empty-2') },
      { label: text.value.filePath, value: file.path || '', mono: true },
      { label: text.value.fileFormat, value: file.format?.length ? file.format.join(', ') : text.value.sharedFile },
      { label: text.value.fileKey, value: file.fileKey || globalI18n.global.t('comm.table.empty-2'), mono: true },
      { label: text.value.fileMd5, value: file.md5 || globalI18n.global.t('comm.table.empty-2'), mono: true },
      { label: text.value.fileSha256, value: file.sha256 || globalI18n.global.t('comm.table.empty-2'), mono: true }
    ]
  })

  return {
    text, selectedFormat, selectedKeys, files, activeType, selectedFile, configTab, definitionViewMode,
    editing, editorValue, draftValue, propertyVisible, addFileVisible, filePreviewLoaded, contentLoading,
    fileSaving, selectedOwner, localFormatDetails, editorRef, fileWorkspaceRef, resizingSider, siderWidth,
    definitionEditorRef, editableExtensions, modelId, isBuiltinConfigTab, activeTitle, canEditFile,
    showEditor, editorLanguage, editorKey, previewResultTitle, previewResultDescription, propertyItems
  }
}

export type ModelConfigState = ReturnType<typeof useModelConfigState>
