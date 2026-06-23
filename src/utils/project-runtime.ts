const normalizeSegment = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return decodeURIComponent(value).trim()
}

const normalizeHashPath = (path = '') => {
  const [pathname = '', search = ''] = path.split('?')
  const normalizedPath = `/${pathname.replace(/^\/+/, '')}`.replace(/\/+/g, '/')
  return `${normalizedPath}${search ? `?${search}` : ''}`
}

export const getProjectCodeFromPathname = (pathname = window.location.pathname) => {
  const [first] = pathname.split('/').filter(Boolean)
  return normalizeSegment(first)
}

export const getProjectIdFromPathname = getProjectCodeFromPathname

export const getProjectCodeFromLocation = () => getProjectCodeFromPathname()

export const getProjectIdFromLocation = getProjectCodeFromLocation

export const isProjectRuntime = () => !!getProjectCodeFromLocation()

export const normalizeProjectRuntimePath = (path = '') => {
  const nextPath = normalizeHashPath(path)
  const projectMatch = nextPath.match(/^\/project\/([^/?#]+)(\/.*)?$/)

  if (projectMatch) {
    return normalizeHashPath(projectMatch[2] || '/')
  }

  return nextPath
}

export const createProjectRuntimeHref = (projectCode: string, path = '/') => {
  const normalizedProjectCode = normalizeSegment(projectCode)
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
