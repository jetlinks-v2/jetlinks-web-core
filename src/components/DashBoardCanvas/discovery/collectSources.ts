import type { DashboardEntryLoader, DashboardSources } from './types'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * 将显式提供的清单和懒加载入口按模块归属整理；只收录有 manifest 的目录，不执行入口。
 * 路径中的 modules 是宿主布局边界，不包含任何具体业务模块名称。
 */
export function collectDashboardSources(options: {
  manifests: Record<string, unknown>
  entries: Record<string, DashboardEntryLoader>
}): Map<string, DashboardSources> {
  const result = new Map<string, DashboardSources>()
  const entriesByGroup = new Map<string, Record<string, DashboardEntryLoader>>()
  for (const [path, loader] of Object.entries(options.entries)) {
    const match = path.match(/(?:^|\/)modules\/(.+)\/index\.ts$/)
    if (!match) continue
    const parent = path.replace(/\/[^/]+\/index\.ts$/, '')
    const entries = entriesByGroup.get(parent) || Object.create(null)
    // 稳定入口 ID 不包含 glob 的相对路径前缀和 index.ts，供调用方在加载前精确筛选。
    entries[match[1]] = loader
    entriesByGroup.set(parent, entries)
  }
  for (const [path, manifest] of Object.entries(options.manifests).sort()) {
    const match = path.match(/(?:^|\/)modules\/([^/]+)\/(.+)\/([^/]+)\/manifest\.json$/)
    if (!match) continue
    const [, moduleId, directory, folder] = match
    const parent = path.slice(0, -'/manifest.json'.length)
    const entries = entriesByGroup.get(parent)
    if (!entries) continue
    const sources = result.get(moduleId) || Object.create(null) as DashboardSources
    // 文件夹是宿主发现的稳定地址；manifest.id 不影响目录归属或覆盖其他分组。
    const id = `${directory}/${folder}`
    if (!isRecord(manifest) || typeof manifest.name !== 'string') {
      // 保留为无效来源，交给按范围加载的 catalog 返回错误，不阻断整个宿主启动。
      sources[id] = { directory, name: '', sort: 0, entries: {}, error: `Invalid dashboard manifest: ${path}` }
    } else {
      sources[id] = {
        directory, name: manifest.name,
        sort: typeof manifest.sort === 'number' ? manifest.sort : 0,
        entries,
      }
    }
    result.set(moduleId, sources)
  }
  return result
}
