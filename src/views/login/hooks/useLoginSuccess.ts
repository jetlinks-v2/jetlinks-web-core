import { useRoute } from 'vue-router'
import { setToken } from '@jetlinks-web/utils'
import { getInitSet } from '@jetlinks-web-core/api/login'
import {useAuthStore, useBusinessApplicationStore, useMenuStore, useUserStore} from '@jetlinks-web-core/store'
import {
  takeLoginRedirect,
  toDefaultLoginSuccessHref,
  toRuntimeHashHref,
} from '../utils/redirect'
import {setProjectStorage} from "@jetlinks-web-core/utils";

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
    await userStore.init()
    await menuStore.init()
    await authStore.init()

    await userStore.getUserInfo()
    const menus = await menuStore.requestMenus(false)

    localStorage.removeItem('pFrom') // 清除来源地址

    if (options?.afterStoreInit) {
      await options.afterStoreInit()
    }

    // 获取菜单是否只有某一个
    const menuOwners = new Set()
    menus.result.forEach((menu) => {
      console.log(menuOwners.size, menu)
      if (menuOwners.size <= 2) {
        menuOwners.add(menu.owner)
      }
    })

    if (menuOwners.size === 1 && menuOwners.has('app')) {
      const businessApplicationStore = useBusinessApplicationStore()
      businessApplicationStore.init()
      const enteredApplication = await businessApplicationStore.enterFirstApplication({
        currentProjectCode: code,
        fallbackPath: '',
        silent: true,
      })
      if (enteredApplication) return
    }

    if (code) {
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
    window.location.href = toDefaultLoginSuccessHref()
  }

  return {
    handleLoginSuccess,
  }
}
