import 'vue-router'

/**
 * 路由安全策略枚举
 */
export enum RouteSecurityLevel {
  /** 公开路由，无需token（如登录页、OAuth回调） */
  PUBLIC = 'public',
  /** 需要token，但无需菜单权限（如个人中心） */
  AUTHENTICATED = 'authenticated',
  /** 需要token和菜单权限（默认） */
  AUTHORIZED = 'authorized'
}

declare module 'vue-router' {
  interface RouteMeta {
    /** 路由安全级别 */
    security?: RouteSecurityLevel
    /** 是否跳过菜单权限检查（遗留兼容，建议使用security） */
    skipMenuFetch?: boolean
    /** 页面标题 */
    title?: string
    /** 是否在菜单中隐藏 */
    hideInMenu?: boolean
  }
}

/**
 * 核心路由配置项
 */
export interface CoreRouteConfig {
  /** 路由唯一标识（用于替换） */
  key: string
  /** 路由定义 */
  route: import('vue-router').RouteRecordRaw
  /** 描述（调试用） */
  description?: string
}

/**
 * 模块路由覆盖配置
 */
export interface ModuleRouteOverride {
  /** 要覆盖的核心路由key */
  key: string
  /** 新的路由定义（可选，不提供则删除该路由） */
  route?: import('vue-router').RouteRecordRaw
  /** 覆盖原因（调试日志） */
  reason?: string
}
