import type { ExtractPropTypes, PropType } from 'vue'
import type { ModelFile } from '../modelFileDirectory'
import type { BatchAddFilePayload } from '../batchFileUpload'

export interface FormatDetail {
  id: string
  name?: string
  local?: boolean
}

export interface ExtraConfigTab {
  key: string
  label: string
  disabled?: boolean
}

export interface DefinitionEditorExpose {
  prepareForSave: () => Record<string, unknown> | undefined
  hasChanges?: () => boolean
}

export type LocaleText = Record<string, string>
export type BuiltinConfigTab = 'definition' | 'manifest'
export type DefinitionViewMode = 'form' | 'json'
export type CustomCreateVisible = (path?: string) => boolean

export const BUILTIN_CONFIG_TABS: BuiltinConfigTab[] = ['definition', 'manifest']

export function isBuiltinConfigTabKey(key: string): key is BuiltinConfigTab {
  return BUILTIN_CONFIG_TABS.includes(key as BuiltinConfigTab)
}

export interface AddFilePayload {
  id?: string
  name: string
  path?: string
  format?: string[]
  createType: 'upload' | 'extract' | 'empty' | 'custom'
  file?: File
  done?: (success?: boolean) => void
}

export interface ModelConfigSavePayload {
  definition: Record<string, unknown>
  manifest: Record<string, unknown>
  formats: string[][]
}

export interface DonePayload<T = void> {
  done?: (success?: boolean, result?: T) => void
}

export interface LoadFilesPayload {
  modelId: string
  format: string
}

export interface SaveConfigPayload extends DonePayload {
  type: 'definition' | 'manifest'
  value: string
  config: ModelConfigSavePayload
}

export interface SaveFilePayload extends DonePayload {
  format: string
  file: {
    id?: string
    name: string
    path?: string
    format?: string[]
    content: string
  }
}

export interface AddFileEventPayload extends DonePayload {
  format: string
  file: AddFilePayload
}

export interface ReplaceFilePayload extends DonePayload {
  format: string
  target: ModelFile
  file: AddFilePayload
}

export interface PreviewFilePayload extends DonePayload<string> {
  file: ModelFile
}

export const modelConfigProps = {
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
} as const

export type ModelConfigProps = Readonly<ExtractPropTypes<typeof modelConfigProps>>

export interface ModelConfigEmits {
  (e: 'load-files', payload: LoadFilesPayload): void
  (e: 'save-config', payload: SaveConfigPayload): void
  (e: 'add-file', payload: AddFileEventPayload): void
  (e: 'batch-add-file', payload: BatchAddFilePayload): void
  (e: 'add-file-close'): void
  (e: 'save-file', payload: SaveFilePayload): void
  (e: 'replace-file', payload: ReplaceFilePayload): void
  (e: 'preview-file', payload: PreviewFilePayload): void
  (e: 'delete-file', file: ModelFile): void
}
