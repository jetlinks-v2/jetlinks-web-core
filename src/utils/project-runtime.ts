type RuntimeLocation = Pick<Location, 'pathname'>

const PROJECT_LEGACY_PREFIX = /^\/?project\/(?:\:projectId|[^/?#]+)(?=\/|[?#]|$)/

const getCurrentLocation = (): RuntimeLocation | undefined => {
  return typeof window === 'undefined' ? undefined : window.location
}

const decodePathSegment = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const pickRoutePath = (value?: string) => {
  if (!value) return '/'

  const rawPath = String(value).trim()
  if (!rawPath) return '/'

  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(rawPath)) {
    try {
      const url = new URL(rawPath)
      return url.hash ? url.hash.replace(/^#/, '') : `${url.pathname}${url.search}`
    } catch {
      return rawPath
    }
  }

  const hashIndex = rawPath.indexOf('#')
  if (hashIndex >= 0) {
    const hashPath = rawPath.slice(hashIndex + 1)
    return hashPath || '/'
  }

  return rawPath
}

export const normalizeProjectRuntimePath = (value?: string) => {
  const routePath = pickRoutePath(value)
    .replace(/^#/, '')
    .replace(/^\/?#/, '')

  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`
  const withoutLegacyPrefix = normalizedPath.replace(PROJECT_LEGACY_PREFIX, '')

  if (!withoutLegacyPrefix) {
    return '/'
  }

  return withoutLegacyPrefix.startsWith('/') ? withoutLegacyPrefix : `/${withoutLegacyPrefix}`
}

export const getProjectIdFromLocation = (locationLike: RuntimeLocation | undefined = getCurrentLocation()) => {
  const pathname = locationLike?.pathname || ''
  const firstSegment = pathname.split('/').filter(Boolean)[0] || ''

  return decodePathSegment(firstSegment)
}

export const isProjectRuntime = (locationLike?: RuntimeLocation) => {
  return !!getProjectIdFromLocation(locationLike)
}

export const createProjectRuntimeHref = (projectId: string, path = '/') => {
  const normalizedPath = normalizeProjectRuntimePath(path)

  if (!projectId) {
    return `/#${normalizedPath}`
  }

  return `/${encodeURIComponent(projectId)}/#${normalizedPath}`
}
