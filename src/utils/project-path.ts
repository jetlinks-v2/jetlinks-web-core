const normalizeSegment = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return decodeURIComponent(value).trim()
}

export const normalizeProjectHashPath = (path = '') => {
  const [pathname = '', search = ''] = path.split('?')
  const normalizedPath = `/${pathname.replace(/^\/+/, '')}`.replace(/\/+/g, '/')
  return `${normalizedPath}${search ? `?${search}` : ''}`
}

export const isRuntimeRootPath = (pathname = window.location.pathname) => (
  pathname === '/' || pathname === '/index.html'
)

export const getProjectCodeFromPathname = (pathname = window.location.pathname) => {
  if (isRuntimeRootPath(pathname)) return ''
  const [first] = pathname.split('/').filter(Boolean)
  return normalizeSegment(first)
}

export const getProjectIdFromPathname = getProjectCodeFromPathname

export const getProjectCodeFromLocation = () => getProjectCodeFromPathname()

export const getProjectIdFromLocation = getProjectCodeFromLocation

export const createProjectPathRuntimeHref = (projectCode: string, path = '/') => {
  const normalizedProjectCode = normalizeSegment(projectCode)
  const hashPath = normalizeProjectHashPath(path)
  return normalizedProjectCode
    ? `/${encodeURIComponent(normalizedProjectCode)}/#${hashPath}`
    : `/#${hashPath}`
}
