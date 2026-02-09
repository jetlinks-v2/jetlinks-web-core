import {modules} from '@jetlinks-web-core/utils/modules'
import type { ModuleRouteOverride } from './types'

const routerModules = import.meta.glob('../views/**/index.vue')

export const getAsyncRoutesMap = () => {
  const modulesMap: Record<string, any> = {}
  Object.keys(routerModules).forEach(item => {
    const code = item.replace('../views/', '').replace('/index.vue', '')
    modulesMap[code] = routerModules[item]
  })

  return modulesMap
}

export const getGlobModules = async () => {
  const asyncRoutesMap = getAsyncRoutesMap()

  const modulesFiles = modules()
  Object.values(modulesFiles).forEach(item => {
    const routes = item.default.getAsyncRoutesMap?.() || []
    Object.assign(asyncRoutesMap, routes)
  })

  return {
    ...asyncRoutesMap
  }
}

/**
 * 获取子模块的默认路由（非核心路由替换）
 *
 * @deprecated tokenFilterRoute 参数已废弃，使用 meta.security 代替
 */
export const getDefaultModules = (tokenFilterRoute?: any) => {
  const modulesFiles = modules()
  const _modules: any[] = []
  Object.values(modulesFiles).forEach((item) => {
    const modules = item.default.getDefaultRoutes?.() || []
    _modules.push(...modules)

    // 兼容旧的 getFilterRoutes（逐步废弃）
    if (tokenFilterRoute) {
      const filter = item.default.getFilterRoutes?.() || []
      tokenFilterRoute.push(...filter)
    }
  })
  return _modules
}

/**
 * 收集所有模块的核心路由覆盖配置
 *
 * @returns 模块覆盖配置数组（按priority排序）
 */
export function collectCoreRouteOverrides(): ModuleRouteOverride[] {
  const modulesFiles = modules() // 已按priority排序
  const overrides: ModuleRouteOverride[] = []

  Object.values(modulesFiles).forEach((item: any) => {
    const moduleOverrides = item.default.getCoreRouteOverrides?.() || []
    if (moduleOverrides.length > 0) {
      overrides.push(...moduleOverrides)
    }
  })

  return overrides
}
