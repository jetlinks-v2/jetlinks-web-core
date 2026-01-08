import {
  createRouter,
  createWebHashHistory,
} from 'vue-router'
import { getToken, removeToken } from '@jetlinks-web/utils'
import { NOT_FIND_ROUTE, LOGIN_ROUTE, OAuth2, OAuthWechat, AccountCenterBind, AUTHORIZE_ROUTE, Demo, Scene } from './basic'
import {isSubApp} from '@jetlinks-web-core/utils/consts'
import { useApplication, useUserStore, useSystemStore, useMenuStore  } from '@jetlinks-web-core/store'
import microApp from '@micro-zoe/micro-app'
import { getDefaultModules } from '@jetlinks-web-core/router/globModules'

let TokenFilterRoute: string[] = [OAuth2.path, AccountCenterBind.path, AUTHORIZE_ROUTE.path, Demo.path]

let FilterPath: string[] = [OAuth2.path, AUTHORIZE_ROUTE.path, Demo.path, Scene.path]

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    LOGIN_ROUTE,
    OAuth2,
    OAuthWechat,
    AccountCenterBind,
    AUTHORIZE_ROUTE,
    Demo,
    Scene,
    ...getDefaultModules(TokenFilterRoute)
  ],
  scrollBehavior(to, form, savedPosition) {
    return savedPosition || {top: 0}
  },
})


microApp.router.setBaseAppRouter(router)

const NoTokenJump = (to: any, next: any, isLogin: boolean) => {
  // 登录页，不需要token 的页面直接放行，否则跳转登录页
  if (isLogin || TokenFilterRoute.includes(to.path)) {
    next()
  } else {
    next({path: LOGIN_ROUTE.path})
  }
}

const getRoutesByServer = async (to: any, next: any) => {

  const UserInfoStore = useUserStore()
  const SystemStore = useSystemStore()
  const MenuStore = useMenuStore()
  const application = useApplication()

  if (!Object.keys(UserInfoStore.userInfo).length) {
    // 是否有用户信息
    await UserInfoStore.getUserInfo()
    //
    await SystemStore.queryVersion()
    await SystemStore.getShowThreshold()
    await SystemStore.queryInfo()
    await SystemStore.setMircoData()
  }

  if (!isSubApp && !application.appList.length) { // 是否开启微前端
    await application.queryApplication() // 获取子应用
  }

  // 没有菜单的情况下获取菜单
  if (!MenuStore.menu.length && !FilterPath.includes(to.path as string)) {
    //
    await MenuStore.queryMenus()
    if (!MenuStore.menu) {
      // 请求之后还是没有页面，跳转异常处理页面
      next()
    } else {
      MenuStore.menu.forEach((r) => {
        router.addRoute(r)
      })
      router.addRoute( NOT_FIND_ROUTE)
      await next({...to, replace: true})
    }
  } else {
    next()
  }
}

router.beforeEach((to, from, next) => {
  const token = getToken()
  const isLogin = to.path === LOGIN_ROUTE.path
  if (token) {
    if (isLogin) {
      next({path: '/'})
    } else {
      getRoutesByServer(to, next)
    }
  } else {
    NoTokenJump(to, next, isLogin)
  }
})

export const jumpLogin = () => {
  const { path } = toValue(router.currentRoute)
  if (TokenFilterRoute.includes(path)) return

  setTimeout(() => {
    removeToken()
    router.replace({
      path: LOGIN_ROUTE.path,
    })
  })
}

export default router
