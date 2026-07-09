export interface FileOwnerFormatOption {
  id: string
  name?: string
  local?: boolean
}

export const SHARED_OWNER_VALUE = '__shared__'

export const normalizeFilePath = (path?: string) => path?.trim().replace(/^\/+|\/+$/g, '') || ''

export function isModelFilePath(path?: string) {
  const value = normalizeFilePath(path)
  return value === 'models' || value.startsWith('models/')
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
