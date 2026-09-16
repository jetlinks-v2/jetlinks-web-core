import {
  createProjectRuntimeHref,
  getProjectRuntimeConfig,
} from '@jetlinks-web-core/utils/project-runtime'

const LOGIN_REDIRECT_STORAGE_KEY = 'saas-manager-ui:login-redirect'
const LOGIN_IDENTITY_STORAGE_KEY = 'identity'
const DEVICE_SCAN_TOKEN_STORAGE_KEY = 't'
const WECHAT_APP_ID_STORAGE_KEY = 'wechatAppId'

type RedirectValue = string | null | undefined | (string | null)[]

const pickRedirectValue = (value?: RedirectValue) => {
  if (Array.isArray(value)) {
    return value.find(item => !!item) || ''
  }

  return value || ''
}

const getPathname = (value: string) => value.split('?')[0].split('#')[0]

const isLoginPath = (value: string) => {
  const pathname = getPathname(value)
  return pathname === '/login'
}

const isPathnameOnlyRootRedirect = (pathname: string, hashPath: string) => {
  return pathname !== '/' && (hashPath === '/' || hashPath.startsWith('/?'))
}

export const normalizeLoginRedirect = (value?: RedirectValue) => {
  const raw = pickRedirectValue(value)
  if (!raw) {
    return ''
  }

  const trimmed = raw.trim()
  if (!trimmed || trimmed === '/') {
    return ''
  }

  try {
    const url = new URL(trimmed, window.location.origin)
    if (url.origin !== window.location.origin) {
      return ''
    }

    const hashPath = url.hash.startsWith('#/') ? url.hash.slice(1) : ''
    const routePath = hashPath || url.pathname
    if (isLoginPath(routePath)) {
      return ''
    }

    // A path prefix with only the hash root is a deployment shell, not a concrete route intent.
    if (hashPath && isPathnameOnlyRootRedirect(url.pathname, hashPath)) {
      return ''
    }

    if (url.pathname === '/' && hashPath) {
      return hashPath === '/' ? '' : hashPath
    }

    const path = `${url.pathname}${url.search}${url.hash}`
    return path !== '/' ? path : ''
  } catch {
    return ''
  }
}

export const rememberLoginRedirect = (value?: RedirectValue) => {
  const redirect = normalizeLoginRedirect(value)
  if (redirect) {
    sessionStorage.setItem(LOGIN_REDIRECT_STORAGE_KEY, redirect)
  }
}

export const clearLoginRedirect = () => {
  sessionStorage.removeItem(LOGIN_REDIRECT_STORAGE_KEY)
}

/**
 * 清理只服务于当前登录尝试的缓存。
 *
 * 主动退出不能把上一账号的回跳地址、设备扫码参数或微信应用信息带给下一次登录。
 */
export const clearLoginTransientState = () => {
  clearLoginRedirect()
  sessionStorage.removeItem(LOGIN_IDENTITY_STORAGE_KEY)
  localStorage.removeItem(DEVICE_SCAN_TOKEN_STORAGE_KEY)
  localStorage.removeItem(WECHAT_APP_ID_STORAGE_KEY)
}

export const takeLoginRedirect = (value?: RedirectValue) => {
  const queryRedirect = normalizeLoginRedirect(value)
  const storageRedirect = normalizeLoginRedirect(sessionStorage.getItem(LOGIN_REDIRECT_STORAGE_KEY))

  clearLoginRedirect()

  return queryRedirect || storageRedirect
}

export const toHashHref = (path: string) => `/#${path.startsWith('/') ? path : `/${path}`}`

export const toRuntimeHashHref = (path: string) => {
  const runtimeConfig = getProjectRuntimeConfig()

  return runtimeConfig.fixedProject
    ? createProjectRuntimeHref(runtimeConfig.projectCode, path)
    : toHashHref(path)
}

export const toDefaultLoginSuccessHref = () => (
    toRuntimeHashHref('/')
)
