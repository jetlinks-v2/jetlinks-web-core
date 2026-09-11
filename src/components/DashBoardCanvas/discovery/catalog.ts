import { markRaw } from 'vue'
import type { Component } from 'vue'
import type { DashboardComponentDefinition, DashboardConfigEntry, DashboardWidgetDefaults } from '../types'
import { isRecord } from './collectSources'
import type { DashboardDiscoveryResult, DashboardDiscoveryScope, DashboardEntryLoader, DashboardSource } from './types'

const entryCache = new WeakMap<DashboardEntryLoader, Promise<unknown>>()
const isComponent = (value: unknown): value is Component => isRecord(value) || typeof value === 'function'
const permits = (allow: readonly string[] | undefined, value: string) => allow === undefined || allow.includes(value)

function loadEntry(loader: DashboardEntryLoader) {
  let pending = entryCache.get(loader)
  if (!pending) {
    pending = Promise.resolve().then(loader).catch(error => {
      entryCache.delete(loader)
      throw error
    })
    entryCache.set(loader, pending)
  }
  return pending
}

/** 按同一个入口内的 Xxx / XxxConfig / XxxConfigProps 配对，拒绝猜测第一个导出。 */
function definitions(value: unknown, source: DashboardSource, groupId: string) {
  if (!isRecord(value)) throw new Error('Dashboard entry must export an object')
  const result: Array<[string, DashboardComponentDefinition]> = []
  for (const [key, descriptor] of Object.entries(value)) {
    if (key === 'default' || !isRecord(descriptor) || !('component' in descriptor)) continue
    const configs = value[`${key}Config`]
    const defaults = value[`${key}ConfigProps`]
    if (typeof descriptor.name !== 'string' || !descriptor.name || !isComponent(descriptor.component)
      || !Array.isArray(configs) || !configs.every(entry => isRecord(entry)
        && typeof entry.name === 'string' && isComponent(entry.component))
      || !isRecord(defaults) || defaults.type !== descriptor.name || !isRecord(defaults.componentProps)) {
      throw new Error(`Invalid dashboard export triple: ${key}`)
    }
    result.push([descriptor.name, {
      component: markRaw(descriptor.component),
      configs: configs as DashboardConfigEntry[],
      defaultConfig: defaults as DashboardWidgetDefaults,
      groupId,
      defaultGridItem: {
        w: 6, h: 8,
        ...(isRecord(defaults.componentProps.gridItem) ? defaults.componentProps.gridItem : {}),
        ...source.gridOverrides?.[descriptor.name],
      },
    }])
  }
  if (!result.length) throw new Error('No dashboard export triple found')
  return result
}

/**
 * 仅消费调用方传入的来源。模块/目录/分组/入口在加载前过滤，类型在读取入口后过滤。
 * 单入口失败不影响其他入口；重复 type 的所有定义均移除，避免加载顺序决定渲染结果。
 */
export async function loadDashboardCatalog(
  sourceMap: ReadonlyMap<string, unknown>, scope: DashboardDiscoveryScope,
): Promise<DashboardDiscoveryResult> {
  const result: DashboardDiscoveryResult = { catalog: { groups: [], components: {} }, errors: [] }
  if (!scope.modules.length || scope.directories?.length === 0 || scope.groups?.length === 0
    || scope.entries?.length === 0 || scope.includeTypes?.length === 0) return result
  const candidates: Array<{ moduleId: string; groupId: string; name: string; sort: number; source: DashboardSource }> = []
  for (const moduleId of [...new Set(scope.modules)].sort()) {
    const sources = sourceMap.get(moduleId)
    if (sources === undefined) continue
    if (!isRecord(sources)) {
      result.errors.push({ code: 'invalid-source', moduleId, groupId: '', message: 'Invalid dashboard sources' })
      continue
    }
    for (const [id, value] of Object.entries(sources)) {
      const groupId = `${moduleId}/${id}`
      if (!permits(scope.groups, groupId)) continue
      if (scope.directories && (!isRecord(value) || typeof value.directory !== 'string'
        || !scope.directories.includes(value.directory))) continue
      if (isRecord(value) && typeof value.error === 'string') {
        result.errors.push({ code: 'invalid-source', moduleId, groupId, message: value.error })
        continue
      }
      if (!isRecord(value) || typeof value.name !== 'string' || typeof value.sort !== 'number'
        || !isRecord(value.entries) || !Object.values(value.entries).every(loader => typeof loader === 'function')) {
        result.errors.push({ code: 'invalid-source', moduleId, groupId, message: 'Invalid dashboard source' })
        continue
      }
      candidates.push({ moduleId, groupId, name: value.name, sort: value.sort, source: value as unknown as DashboardSource })
    }
  }
  candidates.sort((a, b) => a.sort - b.sort || a.groupId.localeCompare(b.groupId))
  const tasks = candidates.flatMap(candidate => Object.entries(candidate.source.entries).sort()
    .filter(([path]) => permits(scope.entries, path))
    .map(([path, loader]) => ({ ...candidate, path, loader })))
  const loaded = await Promise.all(tasks.map(async task => {
    let value: unknown
    try { value = await loadEntry(task.loader) } catch (error) {
      return { task, error, code: 'load-failed' as const }
    }
    try { return { task, entries: definitions(value, task.source, task.groupId) } } catch (error) {
      return { task, error, code: 'invalid-entry' as const }
    }
  }))
  const components: Record<string, DashboardComponentDefinition> = Object.create(null)
  const origins = new Map<string, { moduleId: string; groupId: string; path: string }>()
  for (const item of loaded) {
    const { moduleId, groupId, path } = item.task
    if (!item.entries) {
      result.errors.push({ code: item.code!, moduleId, groupId, path,
        message: item.error instanceof Error ? item.error.message : String(item.error) })
      continue
    }
    for (const [type, definition] of item.entries) {
      if (!permits(scope.includeTypes, type) || scope.excludeTypes?.includes(type)) continue
      const previous = origins.get(type)
      if (previous) {
        delete components[type]
        result.errors.push({ code: 'duplicate-type', moduleId, groupId, path, type,
          message: `Duplicate ${type}: ${previous.moduleId}:${previous.path} and ${moduleId}:${path}` })
      } else {
        origins.set(type, { moduleId, groupId, path })
        components[type] = markRaw(definition)
      }
    }
  }
  const usedGroups = new Set(Object.values(components).map(item => item.groupId))
  result.catalog = markRaw({
    groups: candidates.filter(group => usedGroups.has(group.groupId)).map(group => ({ id: group.groupId, name: group.name })),
    components,
  })
  return result
}
