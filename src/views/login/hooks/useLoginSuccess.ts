import { useRoute } from 'vue-router'
import { setToken } from '@jetlinks-web/utils'
import { getInitSet } from '@jetlinks-web-core/api/login'
import {useAuthStore, useBusinessApplicationStore, useMenuStore, useUserStore} from '@jetlinks-web-core/store'
import {
  takeLoginRedirect,
  toDefaultLoginSuccessHref,
  toRuntimeHashHref,
} from '../utils/redirect'
import { getProjectStorage, isProjectStorageEnabled, setProjectStorage } from '@jetlinks-web-core/utils/project-storage'
import {
  createProjectRuntimeHref,
  getApplicationRuntimeEntry,
  getProjectCodeFromLocation,
  getProjectCodeFromPathname,
} from '@jetlinks-web-core/utils/project-runtime'
import { createApplicationScopeUrl } from '@jetlinks-web-core/utils/application-scope'
import { isBusinessApplicationRuntime } from '@jetlinks-web-core/utils/business-application-runtime'
import {
  DefaultApplicationEntryError,
  enterDefaultApplication,
  initializeBusinessApplicationEntry,
} from '@jetlinks-web-core/router/default-entry'

interface LoginSuccessOptions {
  afterStoreInit?: () => Promise<void> | void
  resolveFallbackPath?: () => Promise<string> | string
  redirectTo?: string
  username?: string
}

export function useLoginSuccess() {
  const route = useRoute()
  const userStore = useUserStore()
  const menuStore = useMenuStore()
  const authStore = useAuthStore()

  const isMobile = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false
    }

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768
  }

  const handleLoginSuccess = async (token: string, options?: LoginSuccessOptions) => {
    setToken(token)

    // 扫码登录与微信回调只传 token，这里必须允许 options 缺省，否则会直接抛 TypeError。
    const username = options?.username || ''
    const currentProjectCode = getProjectCodeFromLocation() || getProjectCodeFromPathname()
    const isSubAccess = username.includes('@')
    let code

    if (isSubAccess) {
      code = username.split('@')[1]
      if (code) {
        setProjectStorage(code, {
          domain: code,
          apiUrl: location.origin + '/api',
          token: token,
          name: '',
          projectName: '',
          runtime: '',
          id: '',
        })
      }
    }
    if (isProjectStorageEnabled() && isBusinessApplicationRuntime()
      && (!code || code === currentProjectCode || getApplicationRuntimeEntry().type === 'application')) {
      const stored = getProjectStorage(currentProjectCode)
      // 当前项目凭证优先于全局 token；就地重登录也必须替换它，才能读取新账号的角色。
      if (stored) setProjectStorage(currentProjectCode, { ...stored, token })
    }
    await userStore.init()
    await menuStore.init()
    await authStore.init()
    const businessApplicationStore = useBusinessApplicationStore()
    businessApplicationStore.init()

    localStorage.removeItem('pFrom') // 清除来源地址

    if (options?.afterStoreInit) {
      await options.afterStoreInit()
    }

    // 跨项目登录先建立目标 URL 上下文，身份判断交给目标项目的会话启动。
    if (code && code !== currentProjectCode && getApplicationRuntimeEntry().type !== 'application') {
      window.location.href = createProjectRuntimeHref(code)
      return
    }

    try {
      if (isBusinessApplicationRuntime()) await initializeBusinessApplicationEntry()
      await userStore.getUserInfo()
      if (await enterDefaultApplication()) return
    } catch (error) {
      if (!(error instanceof DefaultApplicationEntryError)) throw error
      window.location.href = createProjectRuntimeHref(currentProjectCode, '/403')
      return
    }

    if (code && getApplicationRuntimeEntry().type !== 'application') {
      window.location.href = `${location.origin}/${code}/#/`
      return
    }

    if (options?.redirectTo) {
      window.location.href = options.redirectTo
      return
    }

    const redirectUrl = route.params.query
    if (typeof redirectUrl === 'string' && redirectUrl) {
      const has = redirectUrl.indexOf('?') === -1
      window.location.href = `${redirectUrl}${has ? '' : '?'}token=${token}`
      return
    }

    // 会话失效会记录来源地址；主动退出已在登录守卫中清理该状态。
    const loginRedirect = takeLoginRedirect(route.query.redirect)
    if (loginRedirect) {
      if (loginRedirect.includes('#/')) {
        window.location.href = loginRedirect
      } else {
        window.location.href = toRuntimeHashHref(loginRedirect)
      }
      return
    }

    const scanToken = localStorage.getItem('t')
    if (isMobile() && scanToken) {
      localStorage.removeItem('t')
      window.location.href = toRuntimeHashHref(`/device-asset/scan?t=${encodeURIComponent(scanToken)}`)
      return
    }

    // 管理员在初始化配置为空时先进入初始化页，避免落到没有任何菜单的空首页。
    if (userStore.isAdmin) {
      const initResp = await getInitSet()
      if (initResp.success && !initResp.result?.length) {
        window.location.href = toRuntimeHashHref('/init-home')
        return
      }
    }

    // let url = '/'
    // if (!menuStore.hasResponeMenu) {
    //   // const initResp = await getUserInit()
    //   // const hasInit = initResp.result.some(item => item.type === 'init')
    //   // url = hasInit ? '/#/home/analysis' : '/#/information'
    //   url = '/#/console/index'
    // }
    const entry = getApplicationRuntimeEntry()
    if (entry.type === 'application') {
      window.location.href = createApplicationScopeUrl(`${location.origin}${location.pathname}#/`, entry.applicationId)
      return
    }
    window.location.href = isBusinessApplicationRuntime()
      ? createProjectRuntimeHref(currentProjectCode)
      : toDefaultLoginSuccessHref()
  }

  return {
    handleLoginSuccess,
  }
}
