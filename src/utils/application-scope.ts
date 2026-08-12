export const APPLICATION_SCOPE_HEADER = 'X-Application-Scope'
export const APPLICATION_SCOPE_QUERY_KEY = 'applicationScope'

const APPLICATION_SCOPE_STORAGE_KEY = 'jetlinks-web:application-scope'

const normalizeApplicationScope = (value: unknown) => typeof value === 'string'
  ? value.trim()
  : ''

/**
 * Resolve the application menu scope for the current browser tab.
 *
 * The query parameter bootstraps a newly opened application tab. Session storage keeps
 * the same menu scope across reloads without turning it into a global request header.
 */
export const getApplicationScopeFromLocation = (
  location: Pick<Location, 'search'> = window.location,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = window.sessionStorage,
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
