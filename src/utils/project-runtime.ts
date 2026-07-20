import { getProjectCodeFromLocation } from './project-path'
import { isFromCloud } from './request-context'

export {
  getProjectCodeFromLocation,
  getProjectCodeFromPathname,
  getProjectIdFromLocation,
  getProjectIdFromPathname,
} from './project-path'

const normalizeHashPath = (path = '') => {
  const [pathname = '', search = ''] = path.split('?')
  const normalizedPath = `/${pathname.replace(/^\/+/, '')}`.replace(/\/+/g, '/')
  return `${normalizedPath}${search ? `?${search}` : ''}`
}

export const isProjectRuntime = () => !isFromCloud() && !!getProjectCodeFromLocation()

export const normalizeProjectRuntimePath = (path = '') => {
  const nextPath = normalizeHashPath(path)
  const projectMatch = nextPath.match(/^\/project\/([^/?#]+)(\/.*)?$/)

  if (projectMatch) {
    return normalizeHashPath(projectMatch[2] || '/')
  }

  return nextPath
}

export const createProjectRuntimeHref = (projectCode: string, path = '/') => {
  const normalizedProjectCode = decodeURIComponent(String(projectCode || '')).trim()
  const hashPath = normalizeProjectRuntimePath(path)

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
