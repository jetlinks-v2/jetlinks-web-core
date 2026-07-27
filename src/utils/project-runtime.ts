import { isFromCloud } from '@/utils/comm'
import { isProjectStorageEnabled } from './project-storage'

export type RuntimeScope = 'auto' | 'tenant' | 'project'

export interface ProjectRuntimeConfig {
  scope: RuntimeScope
  projectCode: string
  basePath: string
  fixedProject: boolean
  projectStorageEnabled: boolean
  subAccountLoginEnabled: boolean
}

const normalizeSegment = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return decodeURIComponent(value).trim()
}

const normalizeHashPath = (path = '') => {
  const [pathname = '', search = ''] = path.split('?')
  const normalizedPath = `/${pathname.replace(/^\/+/, '')}`.replace(/\/+/g, '/')
  return `${normalizedPath}${search ? `?${search}` : ''}`
}

const normalizeBasePath = (value: unknown) => {
  const basePath = typeof value === 'string' ? value.trim() : ''
  if (!basePath || basePath === './') return '/'
  return `/${basePath.replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')
}

const getRuntimeScope = (): RuntimeScope => {
  const scope = String(import.meta.env.VITE_APP_RUNTIME_SCOPE || '').trim().toLowerCase()
  return scope === 'project' || scope === 'tenant' ? scope : 'auto'
}

export const getProjectCodeFromPathname = (pathname = window.location.pathname) => {
  const [first] = pathname.split('/').filter(Boolean)
  return normalizeSegment(first)
}

export const getProjectIdFromPathname = getProjectCodeFromPathname

export const getProjectRuntimeConfig = (): ProjectRuntimeConfig => {
  const scope = getRuntimeScope()
  const fixedProject = scope === 'project'
  const projectCode = fixedProject
    ? normalizeSegment(import.meta.env.VITE_APP_PROJECT_CODE)
    : scope === 'tenant'
      ? ''
      : getProjectCodeFromPathname()
  const projectStorageEnabled = isProjectStorageEnabled()

  return {
    scope,
    projectCode,
    basePath: normalizeBasePath(import.meta.env.BASE_URL),
    fixedProject,
    projectStorageEnabled,
    subAccountLoginEnabled: projectStorageEnabled,
  }
}

export const getProjectCodeFromLocation = () => getProjectRuntimeConfig().projectCode

export const getProjectIdFromLocation = getProjectCodeFromLocation

export const isProjectRuntime = () => {
  const config = getProjectRuntimeConfig()
  return config.scope === 'project'
    || (config.scope === 'auto' && !isFromCloud() && !!config.projectCode)
}

export const normalizeProjectRuntimePath = (path = '') => {
  const nextPath = normalizeHashPath(path)
  const projectMatch = nextPath.match(/^\/project\/([^/?#]+)(\/.*)?$/)

  if (projectMatch) {
    return normalizeHashPath(projectMatch[2] || '/')
  }

  return nextPath
}

export const createProjectRuntimeHref = (projectCode: string, path = '/') => {
  const runtimeConfig = getProjectRuntimeConfig()
  const hashPath = normalizeProjectRuntimePath(path)

  // 固定项目产物部署在 Vite base 下，项目编码不再参与浏览器 pathname。
  if (runtimeConfig.fixedProject) {
    return `${runtimeConfig.basePath}#${hashPath}`
  }

  const normalizedProjectCode = normalizeSegment(projectCode)

  if (!normalizedProjectCode) {
    return `/#${hashPath}`
  }

  return `/${encodeURIComponent(normalizedProjectCode)}/#${hashPath}`
}

export const redirectLegacyProjectHash = (hash = window.location.hash) => {
  const match = hash.match(/^#\/?project\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?$/)

  if (!match) {
    return false
  }

  const [, projectId, path = '/', query = ''] = match
  window.location.href = createProjectRuntimeHref(projectId, `${path}${query}`)
  return true
}
