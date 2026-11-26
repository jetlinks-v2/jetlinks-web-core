import {
  createProjectPathRuntimeHref,
  getProjectCodeFromLocation as getProjectCodeFromPathnameLocation,
  normalizeProjectHashPath,
} from './project-path'
import { getProjectStorage, isProjectStorageEnabled } from './project-storage'
import { isPrivateDeployment } from './deployment'
import { edgeDefaultUrl, isSubApp } from './consts'
import { resolveApplicationRuntimeEntry } from './application-scope'

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
  const configuredCode = fixedProject ? normalizeProjectCode(import.meta.env.VITE_APP_PROJECT_CODE) : ''
  let projectCode = ''

  if (fixedProject && isPrivateDeployment()) {
    // 私有化安装目录不能作为项目编码。
    projectCode = configuredCode
  } else if (scope !== 'tenant' && !window.location.pathname.includes(edgeDefaultUrl)) {
    // 边缘代理与项目共用构建；首次打开代理页时 terminal 可能尚未写入。
    projectCode = configuredCode || getProjectCodeFromPathnameLocation()
  }

  return {
    scope,
    projectCode,
    basePath: normalizeBasePath(import.meta.env.BASE_URL),
    fixedProject,
    projectStorageEnabled,
  }
}

export const getProjectCodeFromLocation = () => getProjectRuntimeConfig().projectCode

export const isProjectRuntime = () => {
  const { fixedProject, projectCode } = getProjectRuntimeConfig()
  return (fixedProject && isPrivateDeployment()) || !!projectCode
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

/** App identity is independent of whether this deployment supports SaaS project storage. */
export const getApplicationRuntimeEntry = () => resolveApplicationRuntimeEntry(
  isProjectRuntime(),
  getProjectContext()?.storage?.scope,
  !!isSubApp,
)

export const isApplicationRuntime = () => getApplicationRuntimeEntry().type === 'application'
