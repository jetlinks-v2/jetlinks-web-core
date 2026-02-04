import type { CoreRouteConfig, ModuleRouteOverride } from './types'
import { RouteSecurityLevel } from './types'
import * as basicRoutes from './basic'

/**
 * 核心路由注册表 - 单一真相源
 *
 * 规则:
 * 1. 所有需要被子模块覆盖的路由必须在此注册
 * 2. key 必须与 basicRoutes 中的导出名称一致
 * 3. 安全级别通过 route.meta.security 声明
 */
export const CORE_ROUTE_REGISTRY: CoreRouteConfig[] = [
  {
    key: 'LOGIN_ROUTE',
    route: {
      ...basicRoutes.LOGIN_ROUTE,
      meta: {
        ...basicRoutes.LOGIN_ROUTE.meta,
        security: RouteSecurityLevel.PUBLIC
      }
    },
    description: '登录页面'
  },
  {
    key: 'OAuth2',
    route: {
      ...basicRoutes.OAuth2,
      meta: {
        ...basicRoutes.OAuth2.meta,
        security: RouteSecurityLevel.PUBLIC
      }
    },
    description: 'OAuth2授权页'
  },
  {
    key: 'AUTHORIZE_ROUTE',
    route: {
      ...basicRoutes.AUTHORIZE_ROUTE,
      meta: {
        ...basicRoutes.AUTHORIZE_ROUTE.meta,
        security: RouteSecurityLevel.PUBLIC
      }
    },
    description: '分享授权认证'
  },
  {
    key: 'Demo',
    route: {
      ...basicRoutes.Demo,
      meta: {
        ...basicRoutes.Demo.meta,
        security: RouteSecurityLevel.PUBLIC,
        skipMenuFetch: true
      }
    },
    description: 'Demo演示页'
  },
  {
    key: 'Scene',
    route: {
      ...basicRoutes.Scene,
      meta: {
        ...basicRoutes.Scene.meta,
        skipMenuFetch: true
      }
    },
    description: '场景商城'
  },
  {
    key: 'RegisterRoute',
    route: {
      ...basicRoutes.RegisterRoute,
      meta: {
        ...basicRoutes.RegisterRoute.meta,
        security: RouteSecurityLevel.PUBLIC,
        skipMenuFetch: true
      }
    },
    description: '注册页面'
  },
  {
    key: 'AccountCenterBind',
    route: {
      ...basicRoutes.AccountCenterBind,
      meta: {
        ...basicRoutes.AccountCenterBind.meta,
        security: RouteSecurityLevel.PUBLIC
      }
    },
    description: '第三方账号绑定'
  },
  {
    key: 'IdentityResultRoute',
    route: {
      ...basicRoutes.IdentityResultRoute,
      meta: {
        ...basicRoutes.IdentityResultRoute.meta,
        security: RouteSecurityLevel.PUBLIC
      }
    },
    description: '身份验证结果页'
  },
  {
    key: 'OAuthWechat',
    route: {
      ...basicRoutes.OAuthWechat,
      meta: {
        ...basicRoutes.OAuthWechat.meta,
        security: RouteSecurityLevel.PUBLIC
      }
    },
    description: '微信OAuth授权'
  },
  // 以下路由不允许替换，但需要在注册表中声明以便生成过滤规则
  // {
  //   key: 'NOT_FIND_ROUTE',
  //   route: basicRoutes.NOT_FIND_ROUTE,
  //   description: '404错误页（不可替换）'
  // }
]

/**
 * 解析核心路由配置，应用模块覆盖
 *
 * @param overrides 模块提供的覆盖配置
 * @returns 解析后的路由列表和过滤规则
 */
export function resolveCoreRoutes(overrides: ModuleRouteOverride[] = []) {
  // 克隆注册表防止污染原始配置
  const registry = new Map(
    CORE_ROUTE_REGISTRY.map(config => [config.key, { ...config }])
  )

  // 应用模块覆盖（按提供顺序，后者优先）
  const overrideLogs: string[] = []
  for (const override of overrides) {
    const original = registry.get(override.key)
    if (!original) {
      console.warn(
        `[Route Override] 未知的路由key "${override.key}"，已忽略。` +
        `可用keys: ${Array.from(registry.keys()).join(', ')}`
      )
      continue
    }

    if (override.route) {
      registry.set(override.key, {
        key: override.key,
        route: override.route,
        description: override.reason || original.description
      })
      overrideLogs.push(
        `  - ${override.key}: ${override.reason || '模块自定义'}`
      )
    } else {
      // 删除路由
      registry.delete(override.key)
      overrideLogs.push(`  - ${override.key}: [已移除]`)
    }
  }

  if (overrideLogs.length > 0) {
    console.info(
      `[Route Override] 已应用 ${overrideLogs.length} 个路由覆盖:\n` +
      overrideLogs.join('\n')
    )
  }

  // 提取路由和过滤规则
  const routes = Array.from(registry.values()).map(c => c.route)
  const tokenFilterPaths = extractTokenFilterPaths(routes)
  const menuFilterPaths = extractMenuFilterPaths(routes)

  return {
    routes,
    tokenFilterPaths,
    menuFilterPaths,
    registry: Array.from(registry.values()) // 供调试使用
  }
}

/**
 * 提取需要跳过token验证的路径（支持动态参数）
 */
function extractTokenFilterPaths(routes: import('vue-router').RouteRecordRaw[]): string[] {
  const paths: string[] = []

  function traverse(route: import('vue-router').RouteRecordRaw) {
    const security = route.meta?.security
    if (security === RouteSecurityLevel.PUBLIC) {
      paths.push(route.path)
    }

    // 递归处理子路由
    if (route.children) {
      route.children.forEach(traverse)
    }
  }

  routes.forEach(traverse)
  return paths
}

/**
 * 提取需要跳过菜单权限检查的路径
 */
function extractMenuFilterPaths(routes: import('vue-router').RouteRecordRaw[]): string[] {
  const paths: string[] = []

  function traverse(route: import('vue-router').RouteRecordRaw) {
    if (route.meta?.skipMenuFetch) {
      paths.push(route.path)
    }
    if (route.children) {
      route.children.forEach(traverse)
    }
  }

  routes.forEach(traverse)
  return paths
}
