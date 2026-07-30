import { getProjectCodeFromLocation as getProjectCodeFromPathnameLocation } from './project-path'
import { isProjectStorageEnabled } from './project-storage'
import { isFromCloud } from './request-context'

export {
  getProjectCodeFromPathname,
  getProjectIdFromLocation,
  getProjectIdFromPathname,
} from './project-path'

export type ProjectRuntimeScope = 'auto' | 'tenant' | 'project'

export interface ProjectRuntimeConfig {
  scope: ProjectRuntimeScope
  projectCode: string
  basePath: string
  fixedProject: boolean
  projectStorageEnabled: boolean
  subAccountLoginEnabled: boolean
}

const normalizeRuntimeScope = (value: unknown): ProjectRuntimeScope => {
  const scope = String(value || '').trim().toLowerCase()
  return scope === 'tenant' || scope === 'project' ? scope : 'auto'
}

const normalizeProjectCode = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return decodeURIComponent(value).trim()
}

const normalizeBasePath = (value: unknown) => {
  const path = `/${String(value || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/+/g, '/')
  return path === '/' ? path : `${path}/`
}

export const getProjectRuntimeConfig = (): ProjectRuntimeConfig => {
  const scope = normalizeRuntimeScope(import.meta.env.VITE_APP_RUNTIME_SCOPE)
  const fixedProject = scope === 'project'
  const projectStorageEnabled = scope === 'auto' && isProjectStorageEnabled()
  const projectCode = fixedProject
    ? normalizeProjectCode(import.meta.env.VITE_APP_PROJECT_CODE)
    : scope === 'tenant'
      ? ''
      : getProjectCodeFromPathnameLocation()

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

const normalizeHashPath = (path = '') => {
  const [pathname = '', search = ''] = path.split('?')
  const normalizedPath = `/${pathname.replace(/^\/+/, '')}`.replace(/\/+/g, '/')
  return `${normalizedPath}${search ? `?${search}` : ''}`
}

export const isProjectRuntime = () => {
  const runtimeConfig = getProjectRuntimeConfig()
  return runtimeConfig.fixedProject
    || (!isFromCloud() && !!runtimeConfig.projectCode)
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
  const normalizedProjectCode = normalizeProjectCode(projectCode)
  const hashPath = normalizeProjectRuntimePath(path)

  // A fixed-project build owns its deployment base; the project code is context, not a URL prefix.
  if (runtimeConfig.fixedProject) {
    return `${runtimeConfig.basePath}#${hashPath}`
  }

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
