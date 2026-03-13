import type { CoreRouteConfig, ModuleRouteOverride } from './types'
import { RouteSecurityLevel } from './types'
import * as basicRoutes from './basic'


/**
 * 解析核心路由配置，应用模块覆盖
 *
 * @param overrides 模块提供的覆盖配置
 * @returns 解析后的路由列表和过滤规则
 */
export function resolveCoreRoutes(overrides: ModuleRouteOverride[] = []) {
  // 克隆注册表防止污染原始配置


  const registry = new Map(
    Object.values(basicRoutes).map(config => [config.name, { ...config }])
  )
  console.log('overrides', overrides)
  // 应用模块覆盖（按提供顺序，后者优先）
  const overrideLogs: string[] = []
  for (const override of overrides) {

    if (override.component) {
      if (override.meta?.handleHideInMenuFn?.() === false) {
        registry.set(override.name, override)
        overrideLogs.push(
          `  - ${override.name}: ${override.reason || '模块自定义'}`
        )
      }
    } else {
      // 删除路由
      registry.delete(override.name)
      overrideLogs.push(`  - ${override.name}: [已移除]`)
    }
  }

  if (overrideLogs.length > 0) {
    console.info(
      `[Route Override] 已应用 ${overrideLogs.length} 个路由覆盖:\n` +
      overrideLogs.join('\n')
    )
  }

  // 提取路由和过滤规则
  const routes = [...registry.values()]
  const tokenFilterPaths = extractTokenFilterPaths(routes)
  const menuFilterPaths = extractMenuFilterPaths(routes)

  return {
    routes,
    tokenFilterPaths,
    menuFilterPaths,
    registry: [...registry.values()] // 供调试使用
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
  console.log(routes, paths)
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
