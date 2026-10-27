import type { FlameFrame } from './types'

export type FlameCategory = 'all' | 'network' | 'platform' | 'gc' | 'reactive' | 'other'
export interface FlameCell {
  key: string; parentKey?: string; name: string; samples: number; category: Exclude<FlameCategory, 'all'>
  className: string; method?: string; line?: number; validSamples: boolean; selfSamples?: number
  platform: boolean; depth: number; x: number; width: number; matched: boolean
  foldedNames?: string[]; expandedLibrary?: boolean
}
export interface FlameOptions { search?: string; category?: FlameCategory; focus?: string; platformPrefixes?: string[] }
export interface FlameLayout { cells: FlameCell[]; total: number; matched: number; depth: number; focus?: string }
export interface FlameViewportMetrics { scrollTop: number; scrollLeft: number; scrollHeight: number; clientHeight: number }
export interface FlameViewportAnchor { bottom: number; left: number }

/** 分类只表达可识别的调用包；未识别到 GC 帧不等于没有发生 GC。 */
export function createFlameRuntime() {
/** 所有 SVG / HTML 动态文本只经过同一转义函数，类名与方法名不能成为可执行标记。 */
function escapeFlameHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
}

function classifyFlameFrame(name: string, platformPrefixes: string[] = ['org.jetlinks.']): Exclude<FlameCategory, 'all'> {
  if (/(?:^|[.$])(?:GC|G1|ZGC|Shenandoah|GarbageCollector)|^jdk\.internal\.vm\.gc\./.test(name)) return 'gc'
  if (/^(?:reactor\.core\.|io\.reactivex\.|org\.reactivestreams\.)/.test(name)) return 'reactive'
  if (platformPrefixes.some(prefix => prefix.length > 0 && name.startsWith(prefix))) return 'platform'
  if (/^(?:io\.netty\.|io\.rsocket\.|java\.net\.|sun\.nio\.ch\.|jdk\.internal\.net\.|reactor\.netty\.)/.test(name)) return 'network'
  return 'other'
}

/** 火焰图从底部调用主干向上生长，按距底部的偏移保留阅读层级，不跟随新快照跳到稀疏栈顶。 */
function captureFlameViewport(viewport: FlameViewportMetrics): FlameViewportAnchor {
  const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  return { bottom: maximum - Math.min(maximum, Math.max(0, viewport.scrollTop)), left: viewport.scrollLeft }
}

/** 首次或显式切换聚焦使用零偏移；在线组件与离线 HTML 共用同一定位规则。 */
function restoreFlameViewport(viewport: FlameViewportMetrics, anchor: FlameViewportAnchor = { bottom: 0, left: 0 }) {
  return { top: Math.max(0, viewport.scrollHeight - viewport.clientHeight - anchor.bottom), left: anchor.left }
}

/** 包含样本只作各层宽度，父子不相加；筛选保留完整调用路径与全量分母。 */
function buildFlameLayout(frames: FlameFrame[], options: FlameOptions = {}): FlameLayout {
  const weight = (frame: FlameFrame) => Number.isFinite(frame.samples) && frame.samples > 0 ? frame.samples : 0
  const frameName = (frame: FlameFrame) => `${frame.className}${frame.method ? `.${frame.method}` : ''}${Number.isSafeInteger(frame.line) && Number(frame.line) > 0 ? `:${frame.line}` : ''}`
  const total = frames.reduce((sum, frame) => sum + weight(frame), 0)
  const all: FlameCell[] = []
  const pending: Array<{ frame: FlameFrame; key: string; parentKey?: string; depth: number; x: number; width: number }> = []
  const enqueue = (children: FlameFrame[], parentKey: string | undefined, depth: number, x: number, width: number, denominator: number) => {
    const sum = children.reduce((value, child) => value + weight(child), 0)
    const divisor = Math.max(sum, denominator)
    const occurrences = new Map<string, number>()
    let offset = x
    children.forEach(frame => {
      const name = frameName(frame)
      const occurrence = occurrences.get(name) ?? 0; occurrences.set(name, occurrence + 1)
      const key = `${parentKey ?? ''}/${encodeURIComponent(name)}@${occurrence}`
      const childWidth = divisor > 0 ? width * weight(frame) / divisor : 0
      pending.push({ frame, key, parentKey, depth, x: offset, width: childWidth }); offset += childWidth
    })
  }
  enqueue(frames, undefined, 0, 0, 100, total)
  for (let index = 0; index < pending.length; index++) {
    const { frame, ...cell } = pending[index]
    const name = frameName(frame)
    const category = classifyFlameFrame(frame.className, options.platformPrefixes)
    const platform = (options.platformPrefixes ?? ['org.jetlinks.']).some(prefix => prefix.length > 0 && frame.className.startsWith(prefix))
    const matched = (!options.search || name.toLowerCase().includes(options.search.toLowerCase())) && (!options.category || options.category === 'all' || category === options.category)
    const validSamples = Number.isSafeInteger(frame.samples) && frame.samples >= 0
    const children = frame.children ?? [], childrenTotal = children.reduce((sum, child) => sum + child.samples, 0)
    // 自身仅表示未进入已报告子帧的样本；过滤 / 截断过的栈仍不能推导实际 CPU 消耗。
    const completeChildren = Array.isArray(frame.children) && children.every(child => Number.isSafeInteger(child.samples) && child.samples >= 0)
    const selfSamples = validSamples && completeChildren && Number.isSafeInteger(childrenTotal) && childrenTotal <= frame.samples ? frame.samples - childrenTotal : undefined
    all.push({ ...cell, name, className: frame.className, method: frame.method, line: frame.line, samples: weight(frame), validSamples, selfSamples, category, platform, matched })
    enqueue(frame.children ?? [], cell.key, cell.depth + 1, cell.x, cell.width, weight(frame))
  }
  const focused = options.focus ? all.find(cell => cell.key === options.focus && cell.width > 0) : undefined
  const cells = focused ? all.filter(cell => cell.key === focused.key || cell.key.startsWith(`${focused.key}/`)).map(cell => ({ ...cell,
    depth: cell.depth - focused.depth, x: (cell.x - focused.x) / focused.width * 100, width: cell.width / focused.width * 100 })) : all
  return { cells, total, matched: cells.filter(cell => cell.matched).length, depth: cells.reduce((max, cell) => Math.max(max, cell.depth + 1), 0), focus: focused?.key }
}

/** 只折叠同宽、同样本数、同类别的连续单子帧库调用；原树与帧身份保持不变。 */
function compactFlameLayout(layout: FlameLayout, expanded: ReadonlySet<string> = new Set()): FlameLayout {
  const keys = new Set(layout.cells.map(cell => cell.key)), children = new Map<string, FlameCell[]>()
  for (const cell of layout.cells) if (cell.parentKey && keys.has(cell.parentKey)) {
    const siblings = children.get(cell.parentKey)
    if (siblings) siblings.push(cell)
    else children.set(cell.parentKey, [cell])
  }
  const queue = layout.cells.filter(cell => !cell.parentKey || !keys.has(cell.parentKey)).map(cell => ({ cell, depth: 0, unfolded: new Set<string>() }))
  const cells: FlameCell[] = []
  for (let index = 0; index < queue.length; index++) {
    const { cell, depth, unfolded } = queue[index], path = [cell]
    let end = cell
    if (!cell.platform && !unfolded.has(cell.key)) {
      while ((children.get(end.key)?.length ?? 0) === 1) {
        const next = children.get(end.key)![0]
        if (next.platform || next.category !== cell.category || next.samples !== cell.samples || Math.abs(next.width - cell.width) > 1e-8) break
        path.push(next); end = next
      }
    }
    const foldable = path.length >= 3, open = foldable && expanded.has(cell.key)
    cells.push({ ...cell, depth, foldedNames: foldable ? path.slice(1).map(frame => frame.name) : undefined, expandedLibrary: open })
    const protectedKeys = open ? new Set([...unfolded, ...path.slice(1).map(frame => frame.key)]) : unfolded
    for (const child of children.get(foldable && !open ? end.key : cell.key) ?? []) queue.push({ cell: child, depth: depth + 1, unfolded: protectedKeys })
  }
  return { ...layout, cells, depth: cells.reduce((max, cell) => Math.max(max, cell.depth + 1), 0) }
}

/** Vue 和离线 HTML 共用 SVG 生成器；嵌套 SVG 裁剪短帧文本，避免覆盖相邻调用。 */
function renderFlameSvg(layout: FlameLayout, labels: { samples: string; platform: string }, viewportWidth = 1200): string {
  const escape = escapeFlameHtml
  const height = Math.max(60, layout.depth * 27)
  // viewBox 与显示宽度一致，保留 27px 层高，避免 SVG 等比缩放把深栈压缩后垂直居中留白。
  const canvasWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1200
  const cells = layout.cells.filter(cell => cell.width > 0).map(cell => {
    const x = cell.x / 100 * canvasWidth, width = Math.max(0.1, cell.width / 100 * canvasWidth - 1), y = height - (cell.depth + 1) * 27
    const percent = layout.total ? (cell.samples / layout.total * 100).toFixed(1) : '0.0'
    const title = `${cell.name}\n${cell.samples} ${labels.samples} · ${percent}%${cell.platform ? ` · ${labels.platform}` : ''}`
    const shortName = `${cell.className.split('.').at(-1)}${cell.method ? `.${cell.method}` : ''}`
    const folded = cell.foldedNames?.length ?? 0
    const text = `${shortName}${folded && !cell.expandedLibrary ? ` +${folded}` : ''}`
    const clipped = text.length > Math.floor(width / 7) ? `${text.slice(0, Math.max(0, Math.floor(width / 7) - 1))}…` : text
    const iconWidth = folded && width > 24 ? 18 : 0
    const toggle = iconWidth ? `<g data-expand-key="${escape(cell.key)}"><rect x="0" y="3" width="14" height="18" fill="transparent"/><path d="M3 12h8${cell.expandedLibrary ? '' : 'M7 8v8'}" fill="none" stroke="var(--flame-text)" stroke-width="1.3"/></g>` : ''
    const foldedTitle = folded && !cell.expandedLibrary ? `\n${cell.foldedNames!.join('\n')}` : ''
    return `<g role="button" tabindex="0" data-frame-key="${escape(cell.key)}" aria-label="${escape(title)}"><title>${escape(title + foldedTitle)}</title><rect x="${x}" y="${y}" width="${width}" height="25" rx="1" fill="var(--flame-${cell.category})" stroke="${cell.platform ? 'var(--flame-platform-stroke)' : 'var(--flame-border,transparent)'}" opacity="${cell.matched ? 1 : 0.45}"/><svg x="${x + 3}" y="${y}" width="${Math.max(0, width - 6)}" height="25" overflow="hidden">${toggle}<text x="${iconWidth}" y="17" fill="var(--flame-text)" opacity="${cell.matched ? 1 : 0.55}" font-size="12">${escape(width > 24 ? clipped : '')}</text></svg></g>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${height}" preserveAspectRatio="xMinYMax meet" width="${canvasWidth}" height="${height}" role="img" aria-label="${escape(labels.samples)}">${cells}</svg>`
}
return { classifyFlameFrame, buildFlameLayout, compactFlameLayout, renderFlameSvg, captureFlameViewport, restoreFlameViewport, escapeFlameHtml }
}

export const { classifyFlameFrame, buildFlameLayout, compactFlameLayout, renderFlameSvg, captureFlameViewport, restoreFlameViewport, escapeFlameHtml } = createFlameRuntime()
