import type { RouteRecordRaw } from 'vue-router'

export const USER_CENTER_ROUTE: RouteRecordRaw = {
  path: "/account",
  name: "Account",
  redirect: "/account/center",
  component: () => import("@jetlinks-web-core/layout/BasicLayoutPage.vue"),
  meta: {
    title: "个人中心",
    hideInMenu: true,
  },
  children: [
    {
      path: "/account/center",
      name: "account/center",
      meta: {
        title: "基本设置",
        icon: "",
        hideInMenu: false,
      },
      component: () => import("@jetlinks-web-core/views/account/center/index.vue"),
    },
    // {
    //   path: AccountCenterBindPath,
    //   name: "account/center/bind",
    //   component: () => import("@jetlinks-web-core/views/account/center/bind/index.vue"),
    // },
  ],
};

export const LOGIN_ROUTE: RouteRecordRaw = {
  path: "/login",
  name: "Login",
  // @ts-ignore
  component: () => import("@jetlinks-web-core/views/login/index.vue"),
  meta: {
    title: "登录页",
  },
};

export const NOT_FIND_ROUTE: RouteRecordRaw = {
  path: "/:pathMatch(.*)",
  name: "error",
  component: () => import("@jetlinks-web-core/views/Error/404.vue"),
  meta: {
    title: "404",
  },
};

export const EDGE_TOKEN_ROUTE: RouteRecordRaw = {
  path: '/edge/token/:id',
  meta: {
    title: 'token失效'
  },
  component: () => import('@jetlinks-web-core/views/TokenJump/index.vue')
};

export const AccountCenterBind: RouteRecordRaw = {
  path: '/account/center/bind',
  meta: {
    title: '第三方'
  },
  component: () => import("@jetlinks-web-core/views/account/center/bind/index.vue"),
}

export const OAuth2: RouteRecordRaw = {
  path: '/oauth',
  meta: {
    title: '授权页'
  },
  component: () => import('@jetlinks-web-core/views/oauth/index.vue')
}

export const INIT_HOME: RouteRecordRaw = {
  path: '/init-home',
  name: 'init-home',
  component: () => import("@jetlinks-web-core/views/init-home/index.vue"),
  meta: {
    title: "初始化",
  },
}

export const OAuthWechat: RouteRecordRaw = {
  path: '/oauth/wechat',
    meta: {
    title: '微信授权页'
  },
  component: () => import('@jetlinks-web-core/views/oauth/WeChat.vue')
}

export const AUTHORIZE_ROUTE: RouteRecordRaw = {
  path: '/share/authorize',
  name: 'Authorize',
  component: () => import('@jetlinks-web-core/views/share/authorize/index.vue'),
  meta: {
    title: '授权认证'
  }
}
