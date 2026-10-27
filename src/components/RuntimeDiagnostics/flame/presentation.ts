import { escapeFlameHtml } from '../flameGraph'
import type { FlameCell, FlameCategory } from '../flameGraph'
import type { FlameAnalysis, FlameEvidence, FlameHotspot, FlameInsight } from './analysis'

export interface FlameSymbol { primary: string; secondary: string; raw: string }
export interface FlameInsightLabels {
  samplingHints: string; limited: string; invalid: string; self: string; platform: string; none: string
  sampleRule: string; locate: string; evidence: string; compressed: string; path: string; downstream: string
  selfSamples: string; inclusiveSamples: string; selfUnavailable: string; selfBoundary: string; rawName: string
  copy: string; copied: string; copyFailed: string
}
export interface FlameRowsOptions {
  rows: FlameHotspot[]; total: number; category: FlameCategory; labels: FlameInsightLabels; categories: string[]
  expanded?: string; evidence?: FlameEvidence
}

/** 符号与提示文案只作展示，在线 Vue 和自包含 HTML 使用相同解析、插值与转义规则。 */
export function createFlamePresentationRuntime(escape: (value: unknown) => string) {
  const defaultFlameLabels: FlameInsightLabels = {
    samplingHints: 'Sampling notes', limited: 'Only {count} execution samples so far. Continue sampling while the issue occurs.',
    invalid: 'Sample weights are incomplete or inconsistent. No clear sampling clue can be derived.',
    self: '{name} has {count} / {total} samples outside its reported child frames. Inspect its full call path.',
    platform: 'Platform path {name} includes {count} / {total} execution samples. Inspect its upstream and downstream calls.',
    none: 'No clear sampling clue yet. Capture more samples while the issue occurs.',
    sampleRule: 'Low-sample reference: {minimum}. Reaching it does not guarantee that a bottleneck can be identified.',
    locate: 'Locate frame', evidence: 'Full path and evidence', compressed: '{count} equal-weight frames combined', path: 'Call path', downstream: 'Downstream calls',
    selfSamples: 'Derived self samples', inclusiveSamples: 'Inclusive samples', selfUnavailable: 'Self samples cannot be derived',
    selfBoundary: 'Derived self samples are samples outside the directly reported child frames. Stacks may be filtered or truncated; these counts are not CPU time or evidence of waiting, GC pressure, locking or leaks.',
    rawName: 'Original symbol', copy: 'Copy original symbol', copied: 'Copied', copyFailed: 'Copy failed. Select and copy the original symbol.',
  }

  /** Lambda 的隐藏类后缀属于类身份，不能在最后一个点处分到包名而丢掉实际类名。 */
  function flameSymbol(frame: Pick<FlameCell, 'className' | 'method' | 'line' | 'name'>): FlameSymbol {
    const raw = frame.name
    if (!/^[\w$]+(?:[./][\w$]+)*$/.test(frame.className)) return { primary: raw, secondary: '', raw }
    const generated = frame.className.indexOf('$$Lambda'), boundary = (generated < 0 ? frame.className : frame.className.slice(0, generated)).lastIndexOf('.')
    const className = frame.className.slice(boundary + 1), secondary = boundary < 0 ? '' : frame.className.slice(0, boundary)
    const line = Number.isSafeInteger(frame.line) && Number(frame.line) > 0 ? `:${frame.line}` : ''
    return { primary: `${className}${frame.method ? `.${frame.method}` : ''}${line}`, secondary, raw }
  }

  function formatFlameMessage(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] === undefined ? token : String(values[key]))
  }

  function formatFlameInsight(insight: FlameInsight, analysis: FlameAnalysis, labels: FlameInsightLabels): string {
    const node = insight.frameKey ? analysis.byKey.get(insight.frameKey) : undefined
    return formatFlameMessage(labels[insight.kind], { count: insight.count.toLocaleString(), total: insight.total.toLocaleString(), minimum: insight.minimum.toLocaleString(), name: node ? flameSymbol(node).primary : '' })
  }

  function flameSampleShare(count: number, total: number): string { return total > 0 ? `${(count / total * 100).toFixed(1)}%` : '0.0%' }

  function renderSymbol(frame: FlameCell, attribute: string, className = ''): string {
    const symbol = flameSymbol(frame)
    return `<button type="button" class="flame-symbol ${className}" ${attribute}="${escape(frame.key)}" title="${escape(symbol.raw)}"><strong>${frame.platform ? '<span class="flame-platform">◆ </span>' : ''}${escape(symbol.primary)}</strong>${symbol.secondary ? `<small>${escape(symbol.secondary)}</small>` : ''}</button>`
  }

  function renderFlameEvidenceHtml(evidence: FlameEvidence, total: number, labels: FlameInsightLabels): string {
    const frame = evidence.frame, own = frame.selfSamples === undefined ? labels.selfUnavailable : `${labels.selfSamples}: ${frame.selfSamples.toLocaleString()} / ${total.toLocaleString()}`
    const row = (node: FlameCell) => `<li${node.key === frame.key ? ' aria-current="true"' : ''}>${renderSymbol(node, 'data-hotspot-focus')}<small>${escape(node.samples.toLocaleString())} / ${escape(total.toLocaleString())}</small></li>`
    return `<div class="flame-evidence"><div class="flame-original"><span>${escape(labels.rawName)}</span><code>${escape(frame.name)}</code></div><p>${escape(labels.inclusiveSamples)}: ${escape(frame.samples.toLocaleString())} / ${escape(total.toLocaleString())} · ${escape(own)}</p><p class="flame-boundary">${escape(labels.selfBoundary)}</p><strong>${escape(labels.path)}</strong><ol>${evidence.path.map(row).join('')}</ol>${evidence.downstream.length ? `<strong>${escape(labels.downstream)}</strong><ul>${evidence.downstream.map(row).join('')}</ul>` : ''}</div>`
  }

  function renderFlameHotspotsHtml(options: FlameRowsOptions): string {
    const { labels, total, category, categories } = options, values = ['all', 'network', 'platform', 'gc', 'reactive', 'other']
    return options.rows.map(row => {
      const own = row.selfSamples !== undefined && row.selfSamples > 0, count = own ? row.selfSamples! : row.samples, expanded = options.expanded === row.key
      const tag = category === 'all' ? `<span class="flame-category">${escape(categories[values.indexOf(row.category)] ?? row.category)}</span>` : ''
      const compressed = row.members.length > 1 ? `<small>${escape(formatFlameMessage(labels.compressed, { count: row.members.length }))}</small>` : ''
      const evidence = expanded && options.evidence ? renderFlameEvidenceHtml(options.evidence, total, labels) : ''
      return `<article class="flame-hotspot"><div class="flame-hotspot-main"><div class="flame-hotspot-name">${renderSymbol(row, 'data-hotspot-focus')}${tag}</div><div class="flame-counts"><strong>${escape(count.toLocaleString())} / ${escape(total.toLocaleString())}</strong><small>${escape(flameSampleShare(count, total))} · ${escape(own ? labels.selfSamples : labels.inclusiveSamples)}</small></div></div><div class="flame-hotspot-actions"><button type="button" data-hotspot-evidence="${escape(row.key)}" aria-expanded="${expanded}">${escape(labels.evidence)}</button>${compressed}<button type="button" data-hotspot-copy="${escape(row.key)}" title="${escape(row.name)}">${escape(labels.copy)}</button></div>${evidence}</article>`
    }).join('')
  }

  function renderFlameInsightsHtml(analysis: FlameAnalysis, labels: FlameInsightLabels): string {
    const rule = formatFlameMessage(labels.sampleRule, { minimum: analysis.minimum })
    return analysis.insights.map(insight => `<div class="flame-insight"><span aria-hidden="true">ⓘ</span><span title="${escape(rule)}">${escape(formatFlameInsight(insight, analysis, labels))}</span>${insight.frameKey ? `<button type="button" data-insight-focus="${escape(insight.frameKey)}">${escape(labels.locate)}</button>` : ''}</div>`).join('')
  }
  return { defaultFlameLabels, flameSymbol, formatFlameMessage, formatFlameInsight, flameSampleShare, renderFlameEvidenceHtml, renderFlameHotspotsHtml, renderFlameInsightsHtml }
}

export const { defaultFlameLabels, flameSymbol, formatFlameMessage, formatFlameInsight, flameSampleShare, renderFlameEvidenceHtml, renderFlameHotspotsHtml, renderFlameInsightsHtml } = createFlamePresentationRuntime(escapeFlameHtml)

/** 保留模板占位符供共用纯展示函数插值，导出只保存最终本地化文本。 */
export function localizedFlameLabels(translate: (key: string, values: Record<string, string>) => string): FlameInsightLabels {
  const values = { count: '{count}', total: '{total}', minimum: '{minimum}', name: '{name}' }
  const labels = { ...defaultFlameLabels }
  for (const key of Object.keys(labels) as Array<keyof FlameInsightLabels>) labels[key] = translate(`runtimeDiagnostics.flameInsights.${key}`, values)
  return labels
}
