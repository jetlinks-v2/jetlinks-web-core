export interface FileOwnerFormatOption {
  id: string
  name?: string
  local?: boolean
}

export const SHARED_OWNER_VALUE = '__shared__'
export const MODEL_FILE_PATH = 'models'
export const TARGET_INFERENCE_MODEL_PATH = 'models/targetInference'

export const normalizeFilePath = (path?: string) => path?.trim().replace(/^\/+|\/+$/g, '') || ''

export function isModelFilePath(path?: string) {
  const value = normalizeFilePath(path)
  return value === MODEL_FILE_PATH || value.startsWith(`${MODEL_FILE_PATH}/`)
}

export function isTargetInferenceModelPath(path?: string) {
  const value = normalizeFilePath(path)
  return value === TARGET_INFERENCE_MODEL_PATH || value.startsWith(`${TARGET_INFERENCE_MODEL_PATH}/`)
}

export function isStandardModelPath(path?: string) {
  return isModelFilePath(path) && !isTargetInferenceModelPath(path)
}

export function buildFileOwnerOptions(
  availableFormats: FileOwnerFormatOption[],
  locale: Record<string, string>,
  modelFilePath: boolean
) {
  const formatOptions = availableFormats
    .filter(item => item?.id)
    .map(item => ({
      label: item.local ? `${item.name || item.id} (${item.id})` : item.name || item.id,
      value: item.id
    }))
  if (modelFilePath) {
    return formatOptions
  }
  return [
    { label: locale.sharedFormat || locale.sharedFile, value: SHARED_OWNER_VALUE },
    ...formatOptions
  ]
}
