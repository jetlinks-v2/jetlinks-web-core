import type { DashboardCatalog, DashboardGridItem } from '../types'

export type DashboardEntryLoader = () => Promise<unknown>
export interface DashboardSource {
  directory?: string
  /** 宿主发现的无效清单，由 catalog 在选中该范围时返回。 */
  error?: string
  name: string
  sort: number
  entries: Readonly<Record<string, DashboardEntryLoader>>
  gridOverrides?: Readonly<Record<string, Partial<DashboardGridItem>>>
}
export type DashboardSources = Record<string, DashboardSource>

export interface DashboardDiscoveryScope {
  /** 必填白名单；空数组不加载，不存在的模块来源跳过。 */
  modules: readonly string[]
  /** 宿主发现的目录名，如 visDashboard、packages/component。 */
  directories?: readonly string[]
  /** 宿主分组标识：moduleId/directory/groupFolder；省略表示全部，空数组表示无分组。 */
  groups?: readonly string[]
  /** 入口 ID 精确匹配：moduleId/directory/groupFolder/componentFolder；在加载前过滤。 */
  entries?: readonly string[]
  /** 类型由入口导出决定，这两项在加载入口后过滤。 */
  includeTypes?: readonly string[]
  excludeTypes?: readonly string[]
}

export interface DashboardDiscoveryError {
  code: 'invalid-source' | 'load-failed' | 'invalid-entry' | 'duplicate-type'
  moduleId: string
  groupId: string
  path?: string
  type?: string
  message: string
}
export interface DashboardDiscoveryResult {
  catalog: DashboardCatalog
  errors: DashboardDiscoveryError[]
}
