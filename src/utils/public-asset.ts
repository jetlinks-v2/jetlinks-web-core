const EXTERNAL_URL_PATTERN = /^(?:https?:)?\/\//i
const INLINE_URL_PATTERN = /^(?:data|blob):/i
const ROUTE_OR_API_PATTERN = /^(?:\/?#\/|\/?api(?:\/|$))/i

const normalizeBasePath = () => {
  const value = String(import.meta.env.BASE_URL || '/').trim()
  if (!value || value === './') return '/'
  return `/${value.replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')
}

const splitPathSuffix = (value: string) => {
  const suffixIndex = value.search(/[?#]/)
  return suffixIndex === -1
    ? [value, ''] as const
    : [value.slice(0, suffixIndex), value.slice(suffixIndex)] as const
}

const normalizeLogicalPath = (value: string) => value
  .replace(/\\/g, '/')
  .replace(/^(?:\.\/)+/, '')
  .replace(/^\/+/, '')
  .replace(/\/+/g, '/')

const containsPathTraversal = (value: string) => {
  try {
    return decodeURIComponent(value)
      .replace(/\\/g, '/')
      .split('/')
      .includes('..')
  } catch {
    return true
  }
}

/**
 * Resolve a logical file from Vite's public directory without changing stored configuration values.
 */
export const resolvePublicAssetUrl = (value?: string | null): string => {
  const source = typeof value === 'string' ? value.trim() : ''
  if (!source) return ''
  if (EXTERNAL_URL_PATTERN.test(source) || INLINE_URL_PATTERN.test(source)) return source
  if (ROUTE_OR_API_PATTERN.test(source)) return source

  const [pathname, suffix] = splitPathSuffix(source)
  if (!pathname || containsPathTraversal(pathname)) return ''

  const logicalPath = normalizeLogicalPath(pathname)
  if (!logicalPath || (!logicalPath.includes('/') && !/\.[A-Za-z0-9]+$/.test(logicalPath))) {
    return source
  }

  const basePath = normalizeBasePath()
  const baseSegment = basePath.replace(/^\/+|\/+$/g, '')
  const pathWithoutBase = baseSegment && (
    logicalPath === baseSegment || logicalPath.startsWith(`${baseSegment}/`)
  )
    ? logicalPath.slice(baseSegment.length).replace(/^\/+/, '')
    : logicalPath

  return `${basePath}${pathWithoutBase}${suffix}`
}
