const PROJECT_RESERVED_PATHS = new Set([
  'api',
  'assets',
  'static',
  'public',
  'dist',
  'login',
  'console',
  'application',
  'developer',
  'account',
  'docs',
  'oauth',
  'share',
  'identity-result',
  'init-home',
  'edge',
  'weixin',
])

const normalizeSegment = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return decodeURIComponent(value).trim()
}

const normalizeHashPath = (path = '') => {
  const [pathname = '', search = ''] = path.split('?')
  const normalizedPath = `/${pathname.replace(/^\/+/, '')}`.replace(/\/+/g, '/')
  return `${normalizedPath}${search ? `?${search}` : ''}`
}

export const getProjectIdFromPathname = (pathname = window.location.pathname) => {
  const [first] = pathname.split('/').filter(Boolean)
  const projectId = normalizeSegment(first)

  if (!projectId || PROJECT_RESERVED_PATHS.has(projectId)) {
    return ''
  }

  return projectId
}

export const getProjectIdFromLocation = () => getProjectIdFromPathname()

export const isProjectRuntime = () => !!getProjectIdFromLocation()

export const normalizeProjectRuntimePath = (path = '') => {
  const nextPath = normalizeHashPath(path)
  const projectMatch = nextPath.match(/^\/project\/([^/?#]+)(\/.*)?$/)

  if (projectMatch) {
    return normalizeHashPath(projectMatch[2] || '/')
  }

  return nextPath
}

export const createProjectRuntimeHref = (projectId: string, path = '/') => {
  const normalizedProjectId = normalizeSegment(projectId)
  const hashPath = normalizeProjectRuntimePath(path)

  if (!normalizedProjectId) {
    return `/#${hashPath}`
  }

  return `/${encodeURIComponent(normalizedProjectId)}/#${hashPath}`
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
