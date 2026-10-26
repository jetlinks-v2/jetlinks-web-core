import { buildFlameLayout, escapeFlameHtml, renderFlameSvg } from './flameGraph'
import type { JfrSnapshot, SamplingState, ThreadSnapshot, ViewState } from './types'

/** 只包含当前节点已采集的数据；导出时冻结，不触发任何新的远端诊断。 */
export interface JvmDiagnosticExport {
  version: 1
  nodeId: string
  exportedAt: number
  threads: ThreadSnapshot[]
  threadState: ViewState
  snapshot?: JfrSnapshot
  sampling: SamplingState
}
export interface JvmDiagnosticReportLabels {
  title: string; savePdf: string; exportedAt: string; range: string; notCollected: string; boundary: string
  threads: string; flame: string; frames: string; allocations: string; method: string; samples: string
  parent: string; bytes: string; state: string; all: string
  threadFields: Record<'lock' | 'lockOwner' | 'blockedCount' | 'blockedTime' | 'waitedCount' | 'waitedTime' | 'inNative' | 'suspended', string>
  formatTime: (value: number) => string
}

/** SVG 分层分页，完整方法 / 线程栈 / 分配明细自然分页；不截取屏幕可见区域。 */
export function createJvmDiagnosticReport(data: JvmDiagnosticExport, labels: JvmDiagnosticReportLabels): string {
  const e = escapeFlameHtml, time = (value?: number) => value === undefined ? labels.notCollected : labels.formatTime(value)
  const table = (head: string[], rows: string[][]) => `<table><thead><tr>${head.map(value => `<th>${e(value)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${e(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const empty = `<p class="muted">${e(labels.notCollected)}</p>`
  const layout = buildFlameLayout(data.snapshot?.flameGraph ?? []), byKey = new Map(layout.cells.map(cell => [cell.key, cell]))
  const flamePages: string[] = []
  for (let level = 0; level < layout.depth; level += 16) {
    const cells = layout.cells.filter(cell => cell.depth >= level && cell.depth < level + 16).map(cell => ({ ...cell, depth: cell.depth - level }))
    const page = { ...layout, cells, depth: Math.min(16, layout.depth - level) }
    flamePages.push(`<section class="flame-page"><h2>${e(labels.flame)} · ${level + 1}–${level + page.depth} / ${layout.depth}</h2>${renderFlameSvg(page, { samples: labels.samples, platform: '' }, 1040)}</section>`)
  }
  const frameTable = layout.cells.length ? table([labels.method, labels.samples, labels.parent], layout.cells.map(cell => [cell.name, String(cell.samples), cell.parentKey ? byKey.get(cell.parentKey)?.name ?? labels.all : labels.all])) : empty
  const allocations = data.snapshot?.objectAllocations ?? []
  const allocationTable = allocations.length ? table([labels.method, labels.bytes], [...allocations].sort((a, b) => b.allocationSize - a.allocationSize).map(value => [value.className, value.allocationSize.toLocaleString()])) : empty
  const threads = data.threads.length ? data.threads.map(thread => {
    const details = (Object.keys(labels.threadFields) as Array<keyof typeof labels.threadFields>).flatMap(key => {
      const value = thread[key]
      if (value === undefined) return []
      const text = key === 'lockOwner' ? [thread.lockOwner?.name, thread.lockOwner?.id === undefined ? undefined : `#${thread.lockOwner.id}`].filter(Boolean).join(' ')
        : key === 'blockedTime' || key === 'waitedTime' ? Number(value) < 0 ? labels.notCollected : `${value} ms` : String(value)
      return [`<div><dt>${e(labels.threadFields[key])}</dt><dd>${e(text)}</dd></div>`]
    }).join('')
    return `<article class="thread"><h3>${e(thread.name)} <small>#${e(thread.id)} · ${e(thread.state)} · ${e(time(thread.sampledAt))}</small></h3><dl>${details}</dl><pre>${e(thread.stack)}</pre></article>`
  }).join('') : empty
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"><title>${e(labels.title)} · ${e(data.nodeId)}</title><style>
  @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:13px/1.5 system-ui,sans-serif;color:#202530;background:#fff;margin:24px}h1{font-size:22px;margin:0 0 8px}h2{font-size:17px;margin:20px 0 10px}h3{font-size:14px;margin:12px 0 4px}small,.muted{color:#657080}header{display:flex;justify-content:space-between;gap:16px}button{font:inherit;padding:6px 14px;cursor:pointer}dl{display:flex;flex-wrap:wrap;gap:6px 24px;margin:8px 0}dt{color:#657080}dd{margin:0}dl>div{display:flex;gap:8px}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:12px}th,td{text-align:left;vertical-align:top;padding:6px 8px;border:1px solid #d9dde5;overflow-wrap:anywhere}th{background:#f3f5fa}thead{display:table-header-group}tr{break-inside:avoid}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 ui-monospace,monospace;margin:6px 0}h2,h3{break-after:avoid}.flame-page{break-before:page;break-inside:avoid}.flame-page svg{width:100%;height:auto;display:block}.details{break-before:page}
  .flame-page:first-of-type{break-before:auto}
  :root{--flame-network:#b5d8f5;--flame-platform:#b8d9bd;--flame-platform-stroke:#388347;--flame-gc:#e8c3f4;--flame-reactive:#f5d39c;--flame-other:#d9dde5;--flame-text:#202530;--flame-border:#fff}
  @media print{body{margin:0}.print-actions{display:none}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:inherit}}
  </style></head><body><header><div><h1>${e(labels.title)}</h1><strong>${e(data.nodeId)}</strong></div><div class="print-actions"><button onclick="window.print()">${e(labels.savePdf)}</button></div></header><dl><div><dt>${e(labels.exportedAt)}</dt><dd>${e(time(data.exportedAt))}</dd></div><div><dt>${e(labels.range)}</dt><dd>${e(time(data.snapshot?.startedAt))} – ${e(time(data.snapshot?.sampledAt))}</dd></div><div><dt>${e(labels.samples)}</dt><dd>${layout.total.toLocaleString()}</dd></div></dl><p class="muted">${e(labels.state)} · ${e(labels.boundary)}</p>${flamePages.length ? flamePages.join('') : `<h2>${e(labels.flame)}</h2>${empty}`}<section class="details"><h2>${e(labels.frames)} · ${layout.cells.length.toLocaleString()}</h2>${frameTable}</section><section class="details"><h2>${e(labels.allocations)} · ${allocations.length.toLocaleString()}</h2>${allocationTable}</section><section class="details"><h2>${e(labels.threads)} · ${data.threads.length.toLocaleString()}</h2>${threads}</section></body></html>`
}
