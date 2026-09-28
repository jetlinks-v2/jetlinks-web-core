import {
  createProjectPathRuntimeHref,
  getProjectCodeFromLocation as getProjectCodeFromPathnameLocation,
  normalizeProjectHashPath,
} from './project-path'
import { getProjectStorage, isProjectStorageEnabled } from './project-storage'
import { isFromCloud } from './request-context'
import { isPrivateDeployment } from './deployment'

export {
  getProjectCodeFromPathname,
  getProjectIdFromLocation,
  getProjectIdFromPathname,
} from './project-path'

export type ProjectRuntimeScope = 'auto' | 'tenant' | 'project'
export type RuntimeScope = ProjectRuntimeScope

export interface ProjectRuntimeConfig {
  scope: ProjectRuntimeScope
  projectCode: string
  basePath: string
  fixedProject: boolean
  projectStorageEnabled: boolean
  subAccountLoginEnabled: boolean
}

const getProjectContext = () => {
    if (!isProjectStorageEnabled()) {
        return undefined
    }

    const projectId = getProjectCodeFromPathnameLocation()
    if (!projectId) {
        return undefined
    }

    return {
        projectId,
        storage: getProjectStorage(projectId)
    }
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
  const basePath = typeof value === 'string' ? value.trim() : ''
  if (!basePath || basePath === './') return '/'
  return `/${basePath.replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')
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

export const isProjectRuntime = () => {
  const runtimeConfig = getProjectRuntimeConfig()
  return runtimeConfig.fixedProject
    || (runtimeConfig.scope === 'auto' && !isFromCloud() && !!runtimeConfig.projectCode)
}

export const normalizeProjectRuntimePath = (path = '') => {
  const nextPath = normalizeProjectHashPath(path)
  const projectMatch = nextPath.match(/^\/project\/([^/?#]+)(\/.*)?$/)

  if (projectMatch) {
    return normalizeProjectHashPath(projectMatch[2] || '/')
  }

  return nextPath
}

export const createProjectRuntimeHref = (projectCode: string, path = '/') => {
  const runtimeConfig = getProjectRuntimeConfig()
  const hashPath = normalizeProjectRuntimePath(path)

  // SaaS 也会使用 project scope；只有私有化部署使用构建基础路径而不拼接项目 ID。
  if (isPrivateDeployment()) {
    return `${runtimeConfig.basePath}#${hashPath}`
  }

  return createProjectPathRuntimeHref(projectCode, hashPath)
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

export const isApplicationRuntime = () => {
    const projectContext = getProjectContext()

    if (projectContext) {
        const { storage: projectStorage } = projectContext

        return !!projectStorage?.scope
    }

    return false
}
