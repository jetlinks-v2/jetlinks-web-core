import {
  APPLICATION_SCOPE_QUERY_KEY,
  deleteRouteQueryParam,
  getRouteQueryParam,
  setRouteQueryParam,
} from './application-scope'
import { createProjectPathRuntimeHref, getProjectCodeFromPathname } from './project-path'
import {
  getProjectStorage, setProjectStorage,
  isProjectStorageEnabled,
  type ProjectStorageInfo,
} from './project-storage'

export const APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY = 'applicationAccess'

const APPLICATION_ACCESS_BOOTSTRAP_VERSION = 1

export type ApplicationAccessLocation = Pick<Location, 'origin' | 'pathname'>
export type ApplicationBootstrapLocation = Pick<Location, 'href'>
export type ApplicationBootstrapHistory = Pick<History, 'state' | 'replaceState'>

export interface ApplicationAccessOptions {
  applicationId: string
  applicationName?: string
  domain?: string
  currentProjectCode?: string
  path?: string
  location?: ApplicationAccessLocation
}

export type ApplicationAccessFailureReason =
  | 'missing-application-code'
  | 'missing-project-storage'
  | 'invalid-project-storage'
  | 'invalid-target'

export type ApplicationAccessResult = {
  success: true
  url: string
  crossOrigin: boolean
  projectStorage?: ProjectStorageInfo
} | {
  success: false
  reason: ApplicationAccessFailureReason
}

export type ApplicationBootstrapResult = {
  status: 'none'
} | {
  status: 'applied'
  applicationCode: string
  applicationId: string
  projectStorage: ProjectStorageInfo
} | {
  status: 'invalid'
  reason: 'invalid-bootstrap'
    | 'application-code-mismatch'
    | 'application-scope-mismatch'
    | 'storage-write-failed'
}

export interface ApplicationAccessDependencies {
  getProjectStorage: typeof getProjectStorage
  setProjectStorage: typeof setProjectStorage
  createProjectRuntimeHref: typeof createProjectPathRuntimeHref
  isProjectStorageEnabled: typeof isProjectStorageEnabled
}

interface ApplicationAccessBootstrapPayload {
  version: number
  applicationCode: string
  applicationId: string
  projectStorage: ProjectStorageInfo
}

const defaultDependencies: ApplicationAccessDependencies = {
  getProjectStorage,
  setProjectStorage,
  createProjectRuntimeHref: createProjectPathRuntimeHref,
  isProjectStorageEnabled,
}

const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const normalizeApplicationCode = (value: unknown) => (
  normalizeText(value).replace(/^\/+|\/+$/g, '')
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const normalizeProjectStorage = (value: unknown): ProjectStorageInfo | undefined => {
  if (!isRecord(value)) return undefined

  const token = normalizeText(value.token)
  const apiUrl = normalizeText(value.apiUrl)
  if (!token || !apiUrl) return undefined

  return {
    token: value.token as string,
    apiUrl: value.apiUrl as string,
    domain: typeof value.domain === 'string' ? value.domain : undefined,
    runtime: typeof value.runtime === 'string' ? value.runtime : undefined,
    id: typeof value.id === 'string' ? value.id : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    projectName: typeof value.projectName === 'string' ? value.projectName : undefined,
    scope: typeof value.scope === 'string' ? value.scope : undefined,
  }
}

const copyProjectStorage = (
  source: ProjectStorageInfo,
  applicationName?: string,
  applicationScope?: string,
): ProjectStorageInfo | undefined => {
  const projectStorage = normalizeProjectStorage(source)
  if (!projectStorage) return undefined

  const name = normalizeText(applicationName) || projectStorage.name
  const projectName = normalizeText(source.projectName) || projectStorage.name
  const scope = normalizeApplicationCode(applicationScope) || projectStorage.scope
  return { ...projectStorage, name, projectName, scope }
}

const resolveTargetOrigin = (target: unknown, currentOrigin: string) => {
  const normalizedTarget = normalizeText(target)
  if (!normalizedTarget) return new URL(currentOrigin).origin

  const targetUrl = normalizedTarget.startsWith('/')
    ? new URL(normalizedTarget, currentOrigin)
    : new URL(
      /^https?:\/\//i.test(normalizedTarget) ? normalizedTarget : `https://${normalizedTarget}`,
    )

  return ['http:', 'https:'].includes(targetUrl.protocol) ? targetUrl.origin : ''
}

const createBootstrapPayload = (
  applicationCode: string,
  applicationId: string,
  projectStorage: ProjectStorageInfo,
): ApplicationAccessBootstrapPayload => ({
  version: APPLICATION_ACCESS_BOOTSTRAP_VERSION,
  applicationCode,
  applicationId,
  projectStorage,
})

/**
 * Prepare an application runtime URL from the active project's stored access context.
 *
 * Same-Origin targets are written immediately. Cross-Origin targets receive a one-time
 * bootstrap payload because one Origin cannot write another Origin's localStorage.
 */
export const prepareApplicationAccess = (
  options: ApplicationAccessOptions,
  dependencies: ApplicationAccessDependencies = defaultDependencies,
): ApplicationAccessResult => {
  const location = options.location || window.location
  const applicationCode = normalizeApplicationCode(options.applicationId)
  if (!applicationCode) {
    return { success: false, reason: 'missing-application-code' }
  }

  let targetOrigin = ''
  try {
    targetOrigin = resolveTargetOrigin(options.domain, location.origin)
  } catch {
    return { success: false, reason: 'invalid-target' }
  }
  if (!targetOrigin) {
    return { success: false, reason: 'invalid-target' }
  }

  const runtimeHref = dependencies.createProjectRuntimeHref(applicationCode, options.path || '/')
  const url = new URL(runtimeHref, targetOrigin)
  setRouteQueryParam(url, APPLICATION_SCOPE_QUERY_KEY, applicationCode)

  const crossOrigin = url.origin !== new URL(location.origin).origin

  if (!dependencies.isProjectStorageEnabled()) {
    return crossOrigin
      ? { success: false, reason: 'missing-project-storage' }
      : {
          success: true,
          url: url.toString(),
          crossOrigin,
        }
  }

  const currentProjectCode = normalizeApplicationCode(options.currentProjectCode)
    || getProjectCodeFromPathname(location.pathname)
  const currentProjectStorage = dependencies.getProjectStorage(currentProjectCode)
  if (!currentProjectStorage) {
    return { success: false, reason: 'missing-project-storage' }
  }

  const projectStorage = copyProjectStorage(currentProjectStorage, options.applicationName, applicationCode)
  if (!projectStorage) {
    return { success: false, reason: 'invalid-project-storage' }
  }

  if (crossOrigin) {
    // The token is removed by the target runtime before router/session initialization.
    setRouteQueryParam(
      url,
      APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY,
      JSON.stringify(createBootstrapPayload(applicationCode, applicationCode, projectStorage)),
    )
  } else {
    dependencies.setProjectStorage(applicationCode, projectStorage)
  }

  return {
    success: true,
    url: url.toString(),
    crossOrigin,
    projectStorage,
  }
}

const clearBootstrapQuery = (
  url: URL,
  history: ApplicationBootstrapHistory,
) => {
  deleteRouteQueryParam(url, APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY)
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

const parseBootstrapPayload = (value: string): ApplicationAccessBootstrapPayload | undefined => {
  try {
    const payload = JSON.parse(value) as unknown
    if (!isRecord(payload) || payload.version !== APPLICATION_ACCESS_BOOTSTRAP_VERSION) {
      return undefined
    }

    const applicationCode = normalizeApplicationCode(payload.applicationCode)
    const applicationId = normalizeText(payload.applicationId)
    const projectStorage = normalizeProjectStorage(payload.projectStorage)
    if (!applicationCode || !applicationId || !projectStorage) return undefined

    return {
      version: APPLICATION_ACCESS_BOOTSTRAP_VERSION,
      applicationCode,
      applicationId,
      projectStorage,
    }
  } catch {
    return undefined
  }
}

/**
 * Consume a cross-Origin application bootstrap before router/session initialization.
 *
 * The sensitive query value is removed for both valid and invalid payloads so it cannot
 * survive reloads, browser history copies, or generic query persistence in App.vue.
 */
export const consumeApplicationAccessBootstrap = (
  location: ApplicationBootstrapLocation = window.location,
  history: ApplicationBootstrapHistory = window.history,
  dependencies: ApplicationAccessDependencies = defaultDependencies,
): ApplicationBootstrapResult => {
  const url = new URL(location.href)
  const rawPayload = getRouteQueryParam(url, APPLICATION_ACCESS_BOOTSTRAP_QUERY_KEY)
  if (rawPayload === null) return { status: 'none' }

  const payload = parseBootstrapPayload(rawPayload)
  if (!payload) {
    clearBootstrapQuery(url, history)
    return { status: 'invalid', reason: 'invalid-bootstrap' }
  }

  let pathnameCode = ''
  try {
    pathnameCode = getProjectCodeFromPathname(url.pathname)
  } catch {
    clearBootstrapQuery(url, history)
    return { status: 'invalid', reason: 'application-code-mismatch' }
  }

  if (pathnameCode !== payload.applicationCode) {
    clearBootstrapQuery(url, history)
    return { status: 'invalid', reason: 'application-code-mismatch' }
  }

  if (getRouteQueryParam(url, APPLICATION_SCOPE_QUERY_KEY) !== payload.applicationId) {
    clearBootstrapQuery(url, history)
    return { status: 'invalid', reason: 'application-scope-mismatch' }
  }

  try {
    dependencies.setProjectStorage(payload.applicationCode, payload.projectStorage)
  } catch {
    clearBootstrapQuery(url, history)
    return { status: 'invalid', reason: 'storage-write-failed' }
  }

  clearBootstrapQuery(url, history)
  return {
    status: 'applied',
    applicationCode: payload.applicationCode,
    applicationId: payload.applicationId,
    projectStorage: payload.projectStorage,
  }
}

export const createApplicationAccessDisplayUrl = (
  applicationId: string,
  domain?: string,
  baseUrl = window.location.origin,
) => {
  const applicationCode = normalizeApplicationCode(applicationId)
  if (!applicationCode) return ''

  try {
    const origin = resolveTargetOrigin(domain, baseUrl)
    return origin ? new URL(`/${encodeURIComponent(applicationCode)}`, origin).toString() : ''
  } catch {
    return ''
  }
}
