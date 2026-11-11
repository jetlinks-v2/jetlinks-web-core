import { moduleRegistry } from './module-registry'
import type { ObjectRelationMaintenance, ObjectRelationMaintainer } from '../types/object-relation'

/** 冲突时不依赖模块加载顺序选择写入能力；浏览方向必须符合来源声明。 */
export function resolveObjectRelationMaintainer(
  declaration?: ObjectRelationMaintenance,
  reverse = false
): ObjectRelationMaintainer | undefined {
  if (!declaration) return undefined
  const matches = [...moduleRegistry.getAllModules().values()]
    .map((module) => module.objectRelationMaintainers?.[declaration.provider])
    .filter((value): value is ObjectRelationMaintainer => !!value)
  const provider = matches.length === 1 ? matches[0] : undefined
  return provider &&
    (provider.directions || ['forward']).includes(reverse ? 'reverse' : 'forward') &&
    (provider.available?.(declaration, reverse) ?? true)
    ? provider
    : undefined
}
