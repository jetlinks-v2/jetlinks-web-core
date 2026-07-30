const ABSOLUTE_ASSET_PATTERN = /^(?:(?:https?:)?\/\/|data:|blob:)/i

const normalizeBasePath = (value: unknown) => {
  const path = `/${String(value || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/+/g, '/')
  return path === '/' ? path : `${path}/`
}

const splitPathSuffix = (value: string) => {
  const queryIndex = value.indexOf('?')
  const hashIndex = value.indexOf('#')
  const indexes = [queryIndex, hashIndex].filter(index => index >= 0)
  const suffixIndex = indexes.length ? Math.min(...indexes) : value.length
  return [value.slice(0, suffixIndex), value.slice(suffixIndex)] as const
}

const containsPathTraversal = (value: string) => {
  try {
    return decodeURIComponent(value)
      .replace(/\\/g, '/')
      .split('/')
      .some(segment => segment === '..')
  } catch {
    return true
  }
}

/** Resolves public-directory assets against the active Vite base without rewriting remote URLs. */
export const resolvePublicAssetUrl = (value?: string | null) => {
  const source = typeof value === 'string' ? value.trim() : ''
  if (!source || ABSOLUTE_ASSET_PATTERN.test(source)) {
    return source
  }
  if (source.startsWith('#') || source.startsWith('/#')) {
    return source
  }

  const [rawPath, suffix] = splitPathSuffix(source)
  if (!rawPath || containsPathTraversal(rawPath)) {
    return ''
  }

  const assetPath = rawPath
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
  if (!assetPath) {
    return ''
  }

  const basePath = normalizeBasePath(import.meta.env.BASE_URL)
  const baseSegment = basePath.replace(/^\/+|\/+$/g, '')
  if (baseSegment && (assetPath === baseSegment || assetPath.startsWith(`${baseSegment}/`))) {
    return `/${assetPath}${suffix}`
  }

  return `${basePath}${assetPath}${suffix}`
}
