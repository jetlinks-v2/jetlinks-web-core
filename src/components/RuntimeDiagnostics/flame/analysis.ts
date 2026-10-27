import type { FlameCell, FlameLayout } from '../flameGraph'

export interface FlameHotspot extends FlameCell { members: string[] }
export interface FlameInsight {
  kind: 'limited' | 'invalid' | 'self' | 'platform' | 'none'
  count: number; total: number; minimum: number; frameKey?: string
}
export interface FlameAnalysis {
  total: number; minimum: number; complete: boolean; nodes: FlameCell[]
  byKey: Map<string, FlameCell>; children: Map<string, FlameCell[]>; groups: string[][]; insights: FlameInsight[]
}
export interface FlameEvidence { frame: FlameCell; path: FlameCell[]; downstream: FlameCell[]; compressed: number }

/** 无环境依赖的报告树分析，在线与离线导出内嵌同一实现，不把分类当性能结论。 */
export function createFlameAnalysisRuntime() {
  const samePath = (left: string, right: string) => left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
  const selfRank = (node: FlameCell) => node.selfSamples !== undefined && node.selfSamples > 0 ? node.selfSamples : 0

  /** 仅压缩唯一正权重、包含样本相同的线性路径，分叉和重复方法的不同路径保持独立。 */
  function compactGroups(nodes: FlameCell[], children: Map<string, FlameCell[]>): string[][] {
    const visited = new Set<string>(), groups: string[][] = []
    for (const node of nodes) {
      if (visited.has(node.key) || !node.validSamples || node.samples <= 0) continue
      const group: string[] = []; let current = node
      while (!visited.has(current.key)) {
        group.push(current.key); visited.add(current.key)
        const descendants = (children.get(current.key) ?? []).filter(child => child.samples > 0)
        if (current.selfSamples !== 0 || descendants.length !== 1 || !descendants[0].validSamples || descendants[0].samples !== current.samples) break
        current = descendants[0]
      }
      groups.push(group)
    }
    return groups
  }

  /** 提示只使用全量分母；阈值仅是少样本提示规则，不承诺达到阈值即可找到瓶颈。 */
  function collectInsights(analysis: FlameAnalysis): FlameInsight[] {
    const base = { total: analysis.total, minimum: analysis.minimum }
    if (!analysis.total) return []
    if (!analysis.complete) return [{ ...base, kind: 'invalid', count: analysis.total }]
    if (analysis.total < analysis.minimum) return [{ ...base, kind: 'limited', count: analysis.total }]
    const result: FlameInsight[] = []
    const own = analysis.nodes.filter(node => selfRank(node) > 0).sort((left, right) => selfRank(right) - selfRank(left) || right.depth - left.depth)[0]
    if (own) result.push({ ...base, kind: 'self', count: own.selfSamples!, frameKey: own.key })
    // 平台线索不与同一条自身路径重复，也不累加父子或平行帧的包含样本。
    const platform = analysis.nodes.filter(node => node.platform && node.samples > 0 && (!own || !samePath(node.key, own.key)))
      .sort((left, right) => right.samples - left.samples || right.depth - left.depth)[0]
    if (platform) result.push({ ...base, kind: 'platform', count: platform.samples, frameKey: platform.key })
    return result.length ? result : [{ ...base, kind: 'none', count: analysis.total }]
  }

  function analyzeFlameLayout(layout: FlameLayout, minimumSamples = 100): FlameAnalysis {
    const nodes = layout.cells, byKey = new Map(nodes.map(node => [node.key, node])), children = new Map<string, FlameCell[]>()
    for (const node of nodes) if (node.parentKey) {
      const siblings = children.get(node.parentKey) ?? []; siblings.push(node); children.set(node.parentKey, siblings)
    }
    const minimum = Number.isSafeInteger(minimumSamples) && minimumSamples > 0 ? minimumSamples : 100
    const complete = Number.isSafeInteger(layout.total) && nodes.every(node => node.validSamples && node.selfSamples !== undefined)
    const analysis: FlameAnalysis = { total: layout.total, minimum, complete, nodes, byKey, children, groups: compactGroups(nodes, children), insights: [] }
    analysis.insights = collectInsights(analysis)
    return analysis
  }

  /** 搜索 / 分类 / 聚焦只选择代表帧，计数与分母始终来自完整报告树，不合并不同路径。 */
  function selectFlameHotspots(analysis: FlameAnalysis, visibleKeys: Set<string>, limit = 8): FlameHotspot[] {
    const rows: FlameHotspot[] = []
    for (const members of analysis.groups) {
      const eligible = members.map(key => analysis.byKey.get(key)!).filter(node => visibleKeys.has(node.key))
      const selected = eligible.sort((left, right) => selfRank(right) - selfRank(left) || Number(right.platform) - Number(left.platform) || right.depth - left.depth)[0]
      if (selected) rows.push({ ...selected, members })
    }
    return rows.sort((left, right) => Number(selfRank(right) > 0) - Number(selfRank(left) > 0) || selfRank(right) - selfRank(left) || right.samples - left.samples || right.depth - left.depth).slice(0, limit)
  }

  /** 展开保留压缩路径的全部上游 / 下游帧，任何帧都可回到图中定位。 */
  function flameEvidence(analysis: FlameAnalysis, row: FlameHotspot): FlameEvidence {
    let current = analysis.byKey.get(row.members[row.members.length - 1]) ?? row
    const path: FlameCell[] = [], downstream = analysis.children.get(current.key) ?? []
    while (current) {
      path.unshift(current)
      const parent = current.parentKey ? analysis.byKey.get(current.parentKey) : undefined
      if (!parent) break
      current = parent
    }
    return { frame: row, path, downstream, compressed: row.members.length }
  }
  return { analyzeFlameLayout, selectFlameHotspots, flameEvidence }
}

export const { analyzeFlameLayout, selectFlameHotspots, flameEvidence } = createFlameAnalysisRuntime()
