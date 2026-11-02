import type { MetricTemplate } from '../types'
import type { TemplateWindow } from './window'

export type TemplateNodeKind = 'input' | 'rule' | 'output'
export interface TemplateNode { kind: TemplateNodeKind; index: number }
export interface TemplateRule extends Record<string, unknown> {
  id?: string
  dependsOn?: string[]
  sourceMetric?: string
  inputs?: { id?: string; metricId?: string; [key: string]: unknown }[]
  expression?: string
  applicabilityExpression?: string
  maxInputSkew?: string
  type?: string
  aggregation?: string
  window?: TemplateWindow
  qualityPolicy?: Record<string, unknown> & { expectedCount?: number }
  calculator?: { provider?: string; providerVersion?: string; parameters?: Record<string, unknown>; [key: string]: unknown }
  temporalCondition?: { enterExpression?: string; exitExpression?: string; dwell?: string; recovery?: string; maxNoData?: string; [key: string]: unknown }
}
export const nodeKey = (node: TemplateNode) => `${node.kind}-${node.index}`
export function nodeList(template: MetricTemplate): TemplateNode[] {
  return (['input', 'rule', 'output'] as const).flatMap(kind => {
    const items = kind === 'input' ? template.inputDefinitions : kind === 'rule' ? template.definitions : template.outputs
    return items.map((_, index) => ({ kind, index }))
  })
}
export function nodeLabel(template: MetricTemplate, node: TemplateNode): string {
  if (node.kind === 'input') { const item = template.inputDefinitions[node.index]; return item.name || item.id }
  if (node.kind === 'output') { const item = template.outputs[node.index]; return item.label || item.metricId }
  const rule = template.definitions[node.index] as TemplateRule
  return template.outputs.find(item => item.metricId === rule.id)?.label || rule.id || ''
}
export function ruleDependencies(rule: TemplateRule): string[] {
  return [...new Set([...(rule.sourceMetric ? [rule.sourceMetric] : []), ...(rule.dependsOn || []), ...(rule.inputs || []).filter(item => !item.source).map(item => item.metricId).filter((id): id is string => !!id)])]
}

/** 图只读取声明的引用。拓扑分层允许前向声明；循环和未知引用仍交由编译器报告。 */
export function templateGraph(template: MetricTemplate) {
  const inputColumns = new Map(template.inputDefinitions.map(item => [item.id, 0]))
  const ruleIds = new Set(template.definitions.map(item => item.id))
  const dependenciesByRule = template.definitions.map(rule => ruleDependencies(rule as TemplateRule))
  const pending = new Set(template.definitions.map((_, index) => index))
  const columns = new Map<number, number>()
  while (pending.size) {
    let progressed = false
    for (const index of pending) {
      const rule = template.definitions[index] as TemplateRule
      const dependencies = dependenciesByRule[index]
      if (dependencies.some(id => !inputColumns.has(id) && ruleIds.has(id))) continue
      const column = Math.max(0, ...dependencies.map(id => inputColumns.get(id) || 0)) + 1
      columns.set(index, column)
      if (rule.id) inputColumns.set(rule.id, column)
      pending.delete(index); progressed = true
    }
    if (!progressed) { for (const index of pending) columns.set(index, 1); break }
  }
  const lastColumn = Math.max(1, ...columns.values()) + 1
  const counts = new Map<number, number>()
  const nodes = nodeList(template).map(node => {
    const column = node.kind === 'input' ? 0 : node.kind === 'output' ? lastColumn : columns.get(node.index) || 1
    const row = counts.get(column) || 0
    counts.set(column, row + 1)
    return { ...node, key: nodeKey(node), label: nodeLabel(template, node), column, x: column * 200 + 8, y: row * 68 + 38 }
  })
  const sources = new Map<string, typeof nodes[number]>()
  for (const node of nodes) {
    const id = node.kind === 'input' ? template.inputDefinitions[node.index].id : node.kind === 'rule' ? template.definitions[node.index].id : undefined
    if (typeof id === 'string') sources.set(id, node)
  }
  const edges = nodes.flatMap(target => {
    const ids = target.kind === 'rule' ? ruleDependencies(template.definitions[target.index] as TemplateRule)
      : target.kind === 'output' ? [template.outputs[target.index].metricId] : []
    return ids.flatMap(id => {
      const candidate = sources.get(id)
      const source = candidate?.key === target.key ? nodes.find(node => node.kind === 'input' && template.inputDefinitions[node.index].id === id) : candidate
      if (!source) return []
      const x = source.x + 164; const y = source.y + 22; const endX = target.x; const endY = target.y + 22
      return [{ key: `${source.key}:${target.key}`, path: `M${x},${y} C${x + 24},${y} ${endX - 24},${endY} ${endX},${endY}` }]
    })
  })
  return { nodes, edges, width: (lastColumn + 1) * 200, height: Math.max(1, ...counts.values()) * 68 + 42, lastColumn }
}

/** 仅替换已声明变量的显示名，保留原表达式，不另建计算语言。 */
export function expressionLabel(template: MetricTemplate, expression?: string, names?: ReadonlyMap<string, string>): string {
  const labels = new Map(template.inputDefinitions.map(item => [item.id.replace(/[^a-zA-Z0-9_]/g, '_'), item.name || item.id]))
  for (const output of template.outputs) labels.set(output.metricId, output.label || output.metricId)
  for (const [id, label] of names || []) labels.set(id.replace(/[^a-zA-Z0-9_]/g, '_'), label)
  // 字符串字面量保持原样；只替换独立引用，不把对象的属性名当成输入别名。
  return (expression || '').replace(/#sample\.getTags\(\)\[['"]parameters['"]\]\[['"]([^'"]+)['"]\]|#?params(?:\.([a-zA-Z_][\w]*)|\['((?:[^']|'')*)'\])|'(?:[^']|'')*'|"(?:[^"]|"")*"|#?[a-zA-Z_][\w]*/g,
    (token, legacy: string, property: string, key: string, offset: number, source: string) => {
      const parameter = legacy ?? property ?? key?.replaceAll("''", "'")
      if (parameter !== undefined) return names?.get(`params.${parameter}`) || template.parameterDefinitions.find(item => item.id === parameter)?.name || token
      if (token.startsWith("'") || token.startsWith('"') || source[offset - 1] === '.') return token
      return labels.get(token.replace(/^#/, '')) || token
    })
}

export function nextNodeId(template: MetricTemplate, prefix: string): string {
  const ids = new Set([...template.inputDefinitions.map(item => item.id), ...template.definitions.map(item => item.id)])
  let sequence = 1
  while (ids.has(`${prefix}${sequence}`)) sequence++
  return `${prefix}${sequence}`
}
