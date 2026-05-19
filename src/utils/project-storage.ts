export interface ProjectStorageInfo {
  domain?: string
  apiUrl?: string
  token?: string
  name?: string
  runtime?: string
}

export const PROJECT_STORAGE_PREFIX = 'project_'

export const isProjectStorageEnabled = () => !!import.meta.env.VITE_APP_ENVIRONMENT

const normalizeProjectCode = (projectCode: unknown) => {
  return typeof projectCode === 'string' ? projectCode.trim() : ''
}

export const getProjectStorageKey = (projectCode: string) => {
  return `${PROJECT_STORAGE_PREFIX}${normalizeProjectCode(projectCode)}`
}

const isProjectStorageInfo = (value: unknown): value is ProjectStorageInfo => {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export const getProjectStorage = (projectCode?: string): ProjectStorageInfo | undefined => {
  const code = normalizeProjectCode(projectCode)
  if (!code || typeof localStorage === 'undefined') {
    return undefined
  }

  const raw = localStorage.getItem(getProjectStorageKey(code))
  if (!raw) {
    return undefined
  }

  try {
    const parsed = JSON.parse(raw)
    return isProjectStorageInfo(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export const setProjectStorage = (projectCode: string, value: ProjectStorageInfo) => {
  const code = normalizeProjectCode(projectCode)

  if (!code || typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(getProjectStorageKey(code), JSON.stringify(value))
}

export const removeProjectStorage = (projectCode: string) => {
  const code = normalizeProjectCode(projectCode)
  if (!code || typeof localStorage === 'undefined') {
    return
  }

  localStorage.removeItem(getProjectStorageKey(code))
}
