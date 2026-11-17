/**
 * 通用「图标值」字符串约定（适用于资源图标、标签、头像等）：
 * - `color:<css 颜色>[:可选标签]` — 标签用于色块上展示文字；无标签时由展示组件用 fallback 生成缩写
 * - `font:AppstoreOutlined` — Ant Design Vue 图标名
 * - 有效 Ant Design Vue 裸图标名 — 兼容 IconLibrary 保存的旧值
 * - 已加载的 iconfont symbol ID — 与 IconLibrary 使用相同资源
 * - `http(s)://`、`//`、`/`、`data:image...` — 图片地址
 * - `img:<url>` — 图片地址（兼容）
 * - 其它非空字符串可作为「文本缩写」展示（兼容旧数据）
 */

import * as AntdIcons from '@ant-design/icons-vue'

const COLOR_TOKEN = /^color:\s*(.+)$/i
const FONT_RE = /^font:\s*([^/\s]+)\s*$/i
const STANDALONE_HEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/
const STANDALONE_CSS_COLOR = /^(rgba?\(|hsla?\()/

/** 默认安全色（可读性较好的调色板），可在编辑器中覆盖 */
export const DEFAULT_SAFE_COLORS: readonly string[] = [
  '#6366f1',
  '#0ea5e9',
  '#22c55e',
  '#f97316',
  '#a855f7',
  '#ec4899',
  '#64748b',
  '#ef4444',
  '#14b8a6',
  '#eab308',
]

export function isHttpIconString(s?: string | null): boolean {
  if (!s || typeof s !== 'string') return false
  const t = s.trim()
  return /^https?:\/\//i.test(t) || t.startsWith('//') || t.startsWith('data:') || t.startsWith('/')
}

/**
 * 解析 `color:` 后的主体：`<css color>` 或 `<css color>:<标签>`
 */
export function parseColorLabelPayload(rest: string): { color: string; label?: string } | null {
  const s = rest.trim()
  if (!s) return null

  let m = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}):(.+)$/.exec(s)
  if (m) return { color: `#${m[1]}`, label: m[2].trim() }

  m = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.exec(s)
  if (m) return { color: s }

  m = /^(rgba?\([^)]+\)):(.+)$/.exec(s)
  if (m) return { color: m[1].trim(), label: m[2].trim() }
  m = /^(rgba?\([^)]+\))$/.exec(s)
  if (m) return { color: m[1].trim() }

  m = /^(hsla?\([^)]+\)):(.+)$/.exec(s)
  if (m) return { color: m[1].trim(), label: m[2].trim() }
  m = /^(hsla?\([^)]+\))$/.exec(s)
  if (m) return { color: m[1].trim() }

  return null
}

/** 标签侧：从 icon 字段解析「仅 CSS 颜色」用于着色（忽略色块标签文案） */
export function parseTagColorFromIcon(icon?: string | null): string | undefined {
  if (!icon || typeof icon !== 'string') return undefined
  const s = icon.trim()
  const m = COLOR_TOKEN.exec(s)
  if (m) {
    const p = parseColorLabelPayload(m[1].trim())
    if (p) return p.color
    return undefined
  }
  if (STANDALONE_HEX.test(s) || STANDALONE_CSS_COLOR.test(s)) return s
  return undefined
}

export function formatTagIconFromColor(cssColor: string, label?: string): string {
  return formatIconValueColor(cssColor, label)
}

export type IconValueParsed =
  | { kind: 'none' }
  | { kind: 'image'; url: string }
  | { kind: 'color'; color: string; label?: string }
  | { kind: 'font'; iconType: string }
  | { kind: 'text'; text: string }

/** @deprecated 使用 IconValueParsed */
export type MarketplaceIconParsed = IconValueParsed

/** 裸 iconfont ID 仅匹配调用方提供的已加载资源，避免把未知名称或普通文本误判为图标。 */
export function parseIconValue(icon?: string | null, iconfontSymbols: readonly string[] = []): IconValueParsed {
  if (!icon || typeof icon !== 'string') return { kind: 'none' }
  const s = icon.trim()
  if (!s) return { kind: 'none' }
  if (/^img:\s*/i.test(s)) {
    const u = s.replace(/^img:\s*/i, '').trim()
    if (u) return { kind: 'image', url: u }
  }
  if (isHttpIconString(s)) return { kind: 'image', url: s }

  const cm = COLOR_TOKEN.exec(s)
  if (cm) {
    const p = parseColorLabelPayload(cm[1].trim())
    if (p) return { kind: 'color', color: p.color, ...(p.label ? { label: p.label } : {}) }
  }

  if (STANDALONE_HEX.test(s) || STANDALONE_CSS_COLOR.test(s)) return { kind: 'color', color: s }

  const fm = FONT_RE.exec(s)
  if (fm) return { kind: 'font', iconType: fm[1].trim() }
  // 兼容 IconLibrary 的裸值；Ant Design 图标及当前已加载的 symbol 都保留原始名称。
  if ((/(Outlined|Filled|TwoTone)$/.test(s) && Object.hasOwn(AntdIcons, s)) || iconfontSymbols.includes(s)) {
    return { kind: 'font', iconType: s }
  }
  return { kind: 'text', text: sliceGlyph(s, 2) }
}

function sliceGlyph(s: string, max: number): string {
  const t = s.trim()
  if (!t) return ''
  return [...t].slice(0, max).join('').toUpperCase()
}

/**
 * 生成 `color:` 存储串；`label` 为空则仅写入颜色，展示时由组件使用 fallbackText。
 */
export function formatIconValueColor(cssColor: string, label?: string): string {
  const c = String(cssColor || '').trim()
  if (!c) return ''
  const lab = String(label || '').trim()
  if (lab) return `color:${c}:${lab}`
  return `color:${c}`
}

export function formatIconValueFont(iconType: string): string {
  const t = String(iconType || '').trim()
  return t ? `font:${t}` : ''
}

/** @deprecated 使用 parseIconValue */
export const parseMarketplaceIcon = parseIconValue

/** @deprecated 使用 formatIconValueColor（支持第二参数 label） */
export function formatMarketplaceIconColor(cssColor: string, label?: string): string {
  return formatIconValueColor(cssColor, label)
}

export function formatMarketplaceIconFont(iconType: string): string {
  return formatIconValueFont(iconType)
}

/** @deprecated 使用 parseIconValue */
export const parseResourceIcon = parseIconValue

export function formatResourceIconColor(cssColor: string, label?: string): string {
  return formatIconValueColor(cssColor, label)
}

export function formatResourceIconFont(iconType: string): string {
  return formatIconValueFont(iconType)
}
