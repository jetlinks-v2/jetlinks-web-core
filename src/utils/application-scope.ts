export const APPLICATION_SCOPE_HEADER = 'X-Asset-Scope'
export const APPLICATION_SCOPE_QUERY_KEY = 'applicationScope'
export const PROJECT_APPLICATION_SCOPE = '__jetlinks_project__'

const APPLICATION_SCOPE_STORAGE_KEY = 'jetlinks-web:application-scope'
const APPLICATION_SCOPE_ENTRY_KEY = `${APPLICATION_SCOPE_STORAGE_KEY}:entry`

type ApplicationIdentity = {
  id: string
}

type ApplicationScopeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type RouteQueryLocation = Pick<Location, 'search'> & Partial<Pick<Location, 'hash' | 'pathname'>>
export type MenuApplicationScope = string | false | undefined

export type ApplicationRuntimeEntry =
  | { type: 'application'; applicationId: string }
  | { type: 'tenant' | 'project'; applicationId?: undefined }

/** A requested application must never silently fall back to project menus. */
export class ApplicationEntryUnavailableError extends Error {
  constructor() {
    super('Application entry unavailable')
    this.name = 'ApplicationEntryUnavailableError'
  }
}

const normalizeApplicationScope = (value: unknown) => typeof value === 'string'
  ? value.trim().replace(/^(business_application:)+/, '')
  : ''

export const isProjectApplicationScope = (value: unknown) => (
  normalizeApplicationScope(value) === PROJECT_APPLICATION_SCOPE
)

const getHashRouteQuery = (hash = '') => {
  const queryIndex = hash.indexOf('?')
  return queryIndex >= 0 ? new URLSearchParams(hash.slice(queryIndex + 1)) : undefined
}

const getRouteQuery = (location: RouteQueryLocation, key: string) => {
  const hashQuery = getHashRouteQuery(location.hash)
  return hashQuery?.has(key) ? hashQuery : new URLSearchParams(location.search)
}

/**
 * Read a query parameter from a hash route first, while retaining compatibility with
 * legacy links that placed router parameters before the hash.
 */
export const getRouteQueryParam = (location: RouteQueryLocation, key: string) => (
  getRouteQuery(location, key).get(key)
)

export const setRouteQueryParam = (url: URL, key: string, value: string) => {
  if (!url.hash.startsWith('#/')) {
    url.searchParams.set(key, value)
    return
  }

  const hash = url.hash.slice(1)
  const queryIndex = hash.indexOf('?')
  const hashPath = queryIndex >= 0 ? hash.slice(0, queryIndex) : hash
  const hashQuery = queryIndex >= 0
    ? new URLSearchParams(hash.slice(queryIndex + 1))
    : new URLSearchParams()
  hashQuery.set(key, value)
  url.hash = `${hashPath}?${hashQuery.toString()}`
}

export const deleteRouteQueryParam = (url: URL, key: string) => {
  // Clear both locations so links created by the previous non-hash-aware implementation are sanitized too.
  url.searchParams.delete(key)
  if (!url.hash.startsWith('#/')) return

  const hash = url.hash.slice(1)
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return

  const hashPath = hash.slice(0, queryIndex)
  const hashQuery = new URLSearchParams(hash.slice(queryIndex + 1))
  hashQuery.delete(key)
  url.hash = hashQuery.size ? `${hashPath}?${hashQuery.toString()}` : hashPath
}

const statusOf = (value: unknown) => {
  const status = Number(value)
  return Number.isFinite(status) ? status : undefined
}

export const isBusinessApplicationEndpointMissing = (value: unknown) => {
  const source = value as {
    status?: unknown
    response?: {
      status?: unknown
      data?: {
        status?: unknown
      }
    }
  }

  return statusOf(source?.status) === 404
    || statusOf(source?.response?.status) === 404
    || statusOf(source?.response?.data?.status) === 404
}

export const selectApplicationScope = <T extends ApplicationIdentity>(
  applications: T[],
  storedId?: string | null,
) => {
  const normalizedId = normalizeApplicationScope(storedId)
  return applications.find(item => item.id === normalizedId) || applications[0]
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
)

const hasApplicationId = (value: unknown): value is ApplicationIdentity => (
  isRecord(value) && typeof value.id === 'string' && !!value.id
)

export const normalizeBusinessApplications = <T extends ApplicationIdentity>(
  response: unknown,
): T[] => {
  if (Array.isArray(response)) {
    return response.filter(hasApplicationId) as T[]
  }

  if (!isRecord(response)) {
    return []
  }

  const result = response.result
  if (Array.isArray(result)) {
    return result.filter(hasApplicationId) as T[]
  }

  if (isRecord(result)) {
    if (Array.isArray(result.data)) {
      return result.data.filter(hasApplicationId) as T[]
    }

    if (hasApplicationId(result)) {
      return [result as T]
    }
  }

  if (Array.isArray(response.data)) {
    return response.data.filter(hasApplicationId) as T[]
  }

  return hasApplicationId(response) ? [response as T] : []
}

const trimUrlEnd = (value: string) => value.endsWith('/') ? value.slice(0, -1) : value

export const createApplicationCodeUrl = (
  applicationCode?: unknown,
  baseUrl = window.location.origin,
) => {
  const code = normalizeApplicationScope(applicationCode).replace(/^\/+|\/+$/g, '')
  if (!code) return ''

  return new URL(`/${encodeURIComponent(code)}`, baseUrl).toString()
}

export const resolveApplicationAccessUrl = (
  target?: unknown,
  applicationCode?: unknown,
  baseUrl = window.location.origin,
) => {
  const normalizedTarget = normalizeApplicationScope(target)
  const resolvedTarget = normalizedTarget || createApplicationCodeUrl(applicationCode, baseUrl)
  if (!resolvedTarget) return ''

  const normalizedUrl = /^https?:\/\//i.test(resolvedTarget) || resolvedTarget.startsWith('/')
    ? resolvedTarget
    : `https://${resolvedTarget}`

  return new URL(normalizedUrl, baseUrl).toString()
}

export const normalizeApplicationBaseUrl = (
  target?: unknown,
  applicationCode?: unknown,
  baseUrl = window.location.origin,
) => trimUrlEnd(resolveApplicationAccessUrl(target, applicationCode, baseUrl))

/**
 * Resolve the application menu scope for the current browser tab.
 *
 * The query parameter bootstraps a newly opened application tab. Session storage keeps
 * the same scope within this entry without leaking it to another project or tenant.
 */
export const getApplicationScopeFromLocation = (
  location: RouteQueryLocation = window.location,
  storage: ApplicationScopeStorage = window.sessionStorage,
) => {
  const query = getRouteQuery(location, APPLICATION_SCOPE_QUERY_KEY)

  if (query.has(APPLICATION_SCOPE_QUERY_KEY)) {
    const scope = normalizeApplicationScope(query.get(APPLICATION_SCOPE_QUERY_KEY))
    setApplicationScope(scope, storage, location)
    return scope || undefined
  }

  if (location.pathname !== undefined
    && storage.getItem(APPLICATION_SCOPE_ENTRY_KEY) !== location.pathname) return undefined
  return normalizeApplicationScope(storage.getItem(APPLICATION_SCOPE_STORAGE_KEY)) || undefined
}

/** Resolve one entry identity for all consumers; explicit project intent overrides SaaS storage. */
export const resolveApplicationRuntimeEntry = (
  projectRuntime: boolean,
  storedScope?: string,
  subApp = false,
  location: RouteQueryLocation = window.location,
  storage: ApplicationScopeStorage = window.sessionStorage,
): ApplicationRuntimeEntry => {
  if (subApp || !projectRuntime) return { type: projectRuntime ? 'project' : 'tenant' }

  const queryScope = getRouteQueryParam(location, APPLICATION_SCOPE_QUERY_KEY)
  const scope = queryScope !== null
    ? getApplicationScopeFromLocation(location, storage)
    : normalizeApplicationScope(storedScope) || getApplicationScopeFromLocation(location, storage)

  return scope && !isProjectApplicationScope(scope)
    ? { type: 'application', applicationId: scope }
    : { type: 'project' }
}

/** Serialize application IDs only at the transport boundary, including already-prefixed IDs. */
export const getApplicationScopeHeader = (scope?: string) => {
  const id = normalizeApplicationScope(scope)
  return id && !isProjectApplicationScope(id) ? `business_application:${id}` : undefined
}

/** Carry the entry through internal navigation without replacing an explicit route choice. */
export const preserveApplicationScopeQuery = <T extends Record<string, unknown>>(
  query: T,
  applicationId?: string,
) => applicationId !== undefined && !Object.prototype.hasOwnProperty.call(query, APPLICATION_SCOPE_QUERY_KEY)
  ? { ...query, [APPLICATION_SCOPE_QUERY_KEY]: applicationId }
  : query

/** Apply disable > explicit target > current entry consistently to every HTTP transport. */
export const applyApplicationScopeHeaders = (
  headers: Record<string, unknown>,
  applicationScope: MenuApplicationScope,
  currentApplicationId?: string,
  projectContext?: false,
  url?: string,
) => {
  const scopeKeys = Object.keys(headers).filter(key => key.toLowerCase() === APPLICATION_SCOPE_HEADER.toLowerCase())
  const explicitHeader = scopeKeys.map(key => headers[key]).find(value => typeof value === 'string' && value.trim())
  scopeKeys.forEach(key => delete headers[key])
  if (applicationScope === false || projectContext === false || isProjectApplicationScope(applicationScope)) return

  if (applicationScope) {
    headers[APPLICATION_SCOPE_HEADER] = getApplicationScopeHeader(applicationScope)
  } else if (typeof explicitHeader === 'string') {
    // Other asset types may explicitly use this header too; preserve their transport contract.
    headers[APPLICATION_SCOPE_HEADER] = explicitHeader.startsWith('business_application:')
      ? getApplicationScopeHeader(explicitHeader)
      : explicitHeader
  } else if (!url?.includes('/edge/device/')) {
    const scope = getApplicationScopeHeader(currentApplicationId)
    if (scope) headers[APPLICATION_SCOPE_HEADER] = scope
  }
}

export const resolveMenuApplicationScope = (
  applicationScope: MenuApplicationScope,
  location: RouteQueryLocation = window.location,
  storage: ApplicationScopeStorage = window.sessionStorage,
) => (
  (() => {
    const resolved = applicationScope === false
      ? undefined
      : applicationScope ?? getApplicationScopeFromLocation(location, storage)
    return isProjectApplicationScope(resolved) ? undefined : normalizeApplicationScope(resolved) || undefined
  })()
)

/**
 * Persist the active application for this browser tab only.
 *
 * Bind the cache to its pathname; URLs and SaaS entry storage remain the entry identity.
 */
export const setApplicationScope = (
  applicationId?: string,
  storage: ApplicationScopeStorage = window.sessionStorage,
  location: RouteQueryLocation | undefined = typeof window === 'undefined' ? undefined : window.location,
) => {
  const normalizedId = normalizeApplicationScope(applicationId)
  if (normalizedId) {
    storage.setItem(APPLICATION_SCOPE_STORAGE_KEY, normalizedId)
    if (location?.pathname !== undefined) storage.setItem(APPLICATION_SCOPE_ENTRY_KEY, location.pathname)
    return
  }
  storage.removeItem(APPLICATION_SCOPE_STORAGE_KEY)
  storage.removeItem(APPLICATION_SCOPE_ENTRY_KEY)
}

export const createApplicationScopeUrl = (
  target: string,
  applicationId: string,
  baseUrl = window.location.origin,
  applicationCode?: string,
) => {
  const targetUrl = resolveApplicationAccessUrl(target, applicationCode, baseUrl)
  if (!targetUrl) return ''

  const url = new URL(targetUrl)
  setRouteQueryParam(url, APPLICATION_SCOPE_QUERY_KEY, applicationId)
  return url.toString()
}
