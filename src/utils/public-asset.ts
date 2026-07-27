const EXTERNAL_URL_PATTERN = /^(?:https?:)?\/\//i
const INLINE_URL_PATTERN = /^(?:data|blob):/i
const ROUTE_OR_API_PATTERN = /^(?:\/?#\/|\/?api(?:\/|$))/i

const normalizeBasePath = () => {
  const value = String(import.meta.env.BASE_URL || '/').trim()
  if (!value || value === './') return '/'
  return `/${value.replace(/^\/+|\/+$/g, '')}/`.replace(/\/+/g, '/')
}

/**
 * Resolve a logical file from Vite's public directory without changing stored configuration values.
 */
export const resolvePublicAssetUrl = (value?: string | null): string => {
  const source = typeof value === 'string' ? value.trim() : ''
  if (!source) return ''
  if (EXTERNAL_URL_PATTERN.test(source) || INLINE_URL_PATTERN.test(source)) return source
  if (ROUTE_OR_API_PATTERN.test(source)) return source

  const suffixIndex = source.search(/[?#]/)
  const pathname = suffixIndex === -1 ? source : source.slice(0, suffixIndex)
  const suffix = suffixIndex === -1 ? '' : source.slice(suffixIndex)
  const logicalPath = pathname.replace(/^\.\//, '').replace(/^\/+/, '')

  try {
    if (decodeURIComponent(logicalPath).split('/').includes('..')) return ''
  } catch {
    return ''
  }

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
