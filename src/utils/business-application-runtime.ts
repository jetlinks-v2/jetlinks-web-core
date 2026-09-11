import { isSubApp } from './consts'
import { isProjectRuntime } from './project-runtime'

/**
 * 业务应用上下文只属于项目路径及其应用入口；租户根端不加载应用列表或应用配置。
 */
export const isBusinessApplicationRuntime = () => (
  !isSubApp && isProjectRuntime()
)
