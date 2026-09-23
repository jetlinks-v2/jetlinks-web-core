import { collectDashboardSources } from './discovery/collectSources'
import type { DashboardSources } from './discovery/types'

// 宿主目录适配：只预读轻量清单，组件入口保持懒加载，不经过业务模块总出口。
const manifests = import.meta.glob([
  '../../../../modules/*/visDashboard/*/manifest.json',
  '../../../../modules/*/packages/component/*/manifest.json',
], { eager: true, import: 'default' })
const entries = import.meta.glob([
  '../../../../modules/*/visDashboard/*/*/index.ts',
  '../../../../modules/*/packages/component/*/*/index.ts',
])

/** 按需导入的共享来源；只装配一次以复用加载器缓存，范围与画布状态由各调用方维护。 */
export const dashboardSources: ReadonlyMap<string, DashboardSources> = collectDashboardSources({ manifests, entries })
