export const APPLICATION_SCOPE_HEADER = 'X-Application-Scope'
export const APPLICATION_SCOPE_QUERY_KEY = 'applicationScope'

const APPLICATION_SCOPE_STORAGE_KEY = 'jetlinks-web:application-scope'

type ApplicationIdentity = {
  id: string
}

type ApplicationScopeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type MenuApplicationScope = string | false | undefined

const normalizeApplicationScope = (value: unknown) => typeof value === 'string'
  ? value.trim()
  : ''

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

/**
 * Resolve the application menu scope for the current browser tab.
 *
 * The query parameter bootstraps a newly opened application tab. Session storage keeps
 * the same menu scope across reloads without turning it into a global request header.
 */
export const getApplicationScopeFromLocation = (
  location: Pick<Location, 'search'> = window.location,
  storage: ApplicationScopeStorage = window.sessionStorage,
) => {
  const query = new URLSearchParams(location.search)

  if (query.has(APPLICATION_SCOPE_QUERY_KEY)) {
    const scope = normalizeApplicationScope(query.get(APPLICATION_SCOPE_QUERY_KEY))
    if (scope) {
      storage.setItem(APPLICATION_SCOPE_STORAGE_KEY, scope)
      return scope
    }
    storage.removeItem(APPLICATION_SCOPE_STORAGE_KEY)
    return undefined
  }

  return normalizeApplicationScope(storage.getItem(APPLICATION_SCOPE_STORAGE_KEY)) || undefined
}

export const resolveMenuApplicationScope = (
  applicationScope: MenuApplicationScope,
  location: Pick<Location, 'search'> = window.location,
  storage: ApplicationScopeStorage = window.sessionStorage,
) => (
  applicationScope === false
    ? undefined
    : applicationScope ?? getApplicationScopeFromLocation(location, storage)
)

/**
 * Persist the active application for this browser tab only.
 *
 * Application scope remains a menu request concern and must not become a global request header.
 */
export const setApplicationScope = (
  applicationId?: string,
  storage: ApplicationScopeStorage = window.sessionStorage,
) => {
  const normalizedId = normalizeApplicationScope(applicationId)
  if (normalizedId) {
    storage.setItem(APPLICATION_SCOPE_STORAGE_KEY, normalizedId)
    return
  }
  storage.removeItem(APPLICATION_SCOPE_STORAGE_KEY)
}

export const createApplicationScopeUrl = (
  target: string,
  applicationId: string,
  baseUrl = window.location.origin,
) => {
  const normalizedTarget = /^https?:\/\//i.test(target) || target.startsWith('/')
    ? target
    : `https://${target}`
  const url = new URL(normalizedTarget, baseUrl)
  url.searchParams.set(APPLICATION_SCOPE_QUERY_KEY, applicationId)
  return url.toString()
}
