export type EchartsLayoutProfile = 'native' | 'presentation'
export type LayoutComponentKind = 'title' | 'legend' | 'grid'
export type LayoutAnchor = string | number
export type LayoutDimension = 'top' | 'bottom' | 'height' | 'left' | 'right' | 'width'

export interface LayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface MeasuredLayoutComponent {
  kind: LayoutComponentKind
  id: string
  index: number
  rect: LayoutRect
  /** Grid and its publicly measured axis exterior, in the same renderer coordinates. */
  exterior?: LayoutRect
  top: LayoutAnchor
  gap: number
  /** Public box layout and text styles, read before policy fields are applied. */
  horizontal?: {
    left: unknown
    right: unknown
    padding: number[]
    textStyle?: { width: unknown; overflow: unknown }
    subtextStyle?: { width: unknown; overflow: unknown }
  }
}

export interface EchartsGeometry {
  width: number
  height: number
  components: MeasuredLayoutComponent[]
  componentStates: LayoutComponentState[]
}

export interface LayoutComponentState {
  kind: LayoutComponentKind
  id: string
  name: string
  index: number
  anchors: Record<LayoutDimension, unknown>
}

export interface LayoutTopPatch {
  kind: LayoutComponentKind
  id: string
  top: LayoutAnchor
}

export interface LayoutOptionPatch {
  kind: LayoutComponentKind
  id: string
  fields: {
    left?: LayoutAnchor
    right?: LayoutAnchor
    textStyle?: { width: number | null; overflow: 'break' | null }
    subtextStyle?: { width: number | null; overflow: 'break' | null }
  }
}

export const layoutComponentKey = (component: Pick<MeasuredLayoutComponent, 'kind' | 'id'>) => `${component.kind}:${component.id}`

type AuthoredComponent = Record<string, unknown>
export interface AuthoredLayout {
  enabled: boolean
  title: AuthoredComponent[]
  legend: AuthoredComponent[]
  grid: AuthoredComponent[]
}

const isObject = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
)

/** Capture authored omissions before ECharts inserts its defaults; never retain or transform series data. */
export function captureAuthoredLayout(option: Record<string, unknown>): AuthoredLayout {
  const source = isObject(option.baseOption) ? option.baseOption : option
  const components = (kind: LayoutComponentKind) => {
    const value = source[kind]
    return (Array.isArray(value) ? value : value === undefined ? [] : [value])
      .filter(isObject)
      .map(item => {
        const metadata = Object.fromEntries(['id', 'name', 'top', 'bottom', 'height', 'left', 'right', 'width', 'orient']
          .filter(key => Object.prototype.hasOwnProperty.call(item, key)).map(key => [key, item[key]]))
        for (const key of ['textStyle', 'subtextStyle'] as const) {
          const style = item[key]
          if (isObject(style)) metadata[key] = Object.fromEntries(['width', 'overflow']
            .filter(field => Object.prototype.hasOwnProperty.call(style, field)).map(field => [field, style[field]]))
        }
        return metadata
      })
  }
  return {
    // Authored responsive/timeline rules own their layout. Do not guess the active branch or pairing.
    enabled: !option.media && !option.options && !source.media && !source.options,
    title: components('title'),
    legend: components('legend'),
    grid: components('grid'),
  }
}

/** Track only authored layout metadata using ECharts normal-merge component identity, never default-filled options. */
export function mergeAuthoredLayout(
  previous: AuthoredLayout,
  incoming: AuthoredLayout,
  before: LayoutComponentState[],
  after: LayoutComponentState[],
): AuthoredLayout {
  const result: AuthoredLayout = { enabled: previous.enabled && incoming.enabled, title: [], legend: [], grid: [] }
  for (const kind of ['title', 'legend', 'grid'] as const) {
    const existing = before.filter(component => component.kind === kind)
    const entries = existing.map(component => ({
      component,
      option: previous[kind].find(item => item.id === component.id) ?? {},
      patch: undefined as AuthoredComponent | undefined,
    }))
    const pending = [...incoming[kind]]
    const assign = (index: number, entry: typeof entries[number]) => {
      entry.patch = pending[index]
      delete pending[index]
    }
    // Native normal merge matches id first, then name, then remaining existing positions.
    pending.forEach((patch, index) => {
      if (patch.id == null) return
      const entry = entries.find(item => item.component.id === String(patch.id))
      if (entry) assign(index, entry)
    })
    pending.forEach((patch, index) => {
      if (patch.id != null || patch.name == null) return
      const entry = entries.find(item => !item.patch && item.component.name === String(patch.name))
      if (entry) assign(index, entry)
    })
    const appended: AuthoredComponent[] = []
    pending.forEach((patch, index) => {
      const entry = patch.id == null ? entries.find(item => !item.patch) : undefined
      if (entry) assign(index, entry)
      else appended.push(patch)
    })
    let appendedIndex = 0
    for (const component of after.filter(item => item.kind === kind)) {
      const existingEntry = entries.find(item => item.component.id === component.id)
      const authored = existingEntry
        ? { ...existingEntry.option, ...existingEntry.patch }
        : { ...appended[appendedIndex++] }
      for (const key of ['textStyle', 'subtextStyle'] as const) {
        if (existingEntry && isObject(existingEntry.patch?.[key])) {
          authored[key] = { ...(isObject(existingEntry.option[key]) ? existingEntry.option[key] : {}), ...existingEntry.patch[key] }
        }
      }
      // Public effective anchors may clear a previously authored opposite anchor during native box-layout merge.
      // They can only remove provenance here: an ECharts default never becomes an authored anchor.
      for (const anchor of ['top', 'bottom', 'height', 'left', 'right', 'width'] as const) {
        if (component.anchors[anchor] == null || component.anchors[anchor] === 'auto') delete authored[anchor]
      }
      result[kind].push({ ...authored, id: component.id, name: component.name })
    }
  }
  return result
}

/** Constrain omitted text widths and grid sides using one native horizontal measurement, before vertical layout. */
export function calculateHorizontalDefaults(authored: AuthoredLayout, geometry: EchartsGeometry): LayoutOptionPatch[] {
  if (!authored.enabled) return []
  const patches: LayoutOptionPatch[] = []
  for (const component of geometry.components.filter(item => item.kind === 'title')) {
    const option = findAuthored(authored, component)
    const horizontal = component.horizontal
    if (!option || !horizontal) continue
    const inset = (value: unknown) => typeof value === 'number' || typeof value === 'string'
      ? resolveLayoutTop(value, geometry.width) ?? 0 : 0
    const centered = horizontal.left === 'center' || horizontal.right === 'center'
    // ECharts centers the content box, not its asymmetric padding: both sides need their own half-width budget.
    const paddingWidth = centered ? 2 * Math.max(horizontal.padding[1], horizontal.padding[3])
      : horizontal.padding[1] + horizontal.padding[3]
    const width = geometry.width - inset(horizontal.left) - inset(horizontal.right) - paddingWidth
    const outside = component.rect.x < 0 || component.rect.x + component.rect.width > geometry.width
    if (width <= 0 || (!outside && component.rect.width <= width + horizontal.padding[1] + horizontal.padding[3])) continue
    const fields: LayoutOptionPatch['fields'] = {}
    for (const key of ['textStyle', 'subtextStyle'] as const) {
      const style = horizontal[key]
      const source = isObject(option[key]) ? option[key] : {}
      // Explicit style choices (including theme styles) keep ECharts' own wrapping/truncation semantics.
      if (style && style.width == null && style.overflow == null && !hasAnchor(source, 'width') && !hasAnchor(source, 'overflow')) {
        fields[key] = { width, overflow: 'break' }
      }
    }
    if (Object.keys(fields).length) patches.push({ kind: 'title', id: component.id, fields })
  }
  const grids = geometry.components.filter(item => item.kind === 'grid')
  if (grids.length === 1) {
    const grid = grids[0]
    const option = findAuthored(authored, grid)
    const state = geometry.componentStates.find(item => item.kind === 'grid' && item.id === grid.id)
    if (option && state && !hasAnchor(option, 'width')) {
      const exterior = grid.exterior ?? grid.rect
      const left = hasAnchor(option, 'left') ? 0 : Math.max(0, -exterior.x)
      const right = hasAnchor(option, 'right') ? 0 : Math.max(0, exterior.x + exterior.width - geometry.width)
      // A viewport that cannot contain the measured exterior does not authorize altering explicit dimensions.
      if (left + right < grid.rect.width) {
        const fields: LayoutOptionPatch['fields'] = {}
        for (const [side, displacement] of [['left', left], ['right', right]] as const) {
          const anchor = state.anchors[side]
          const baseline = typeof anchor === 'string' || typeof anchor === 'number' ? resolveLayoutTop(anchor, geometry.width) : undefined
          if (displacement > 0.5 && baseline !== undefined) fields[side] = baseline + displacement
        }
        if (Object.keys(fields).length) patches.push({ kind: 'grid', id: grid.id, fields })
      }
    }
  }
  return patches
}

/** Resolve only the public numeric/percentage top anchors that can be moved without inventing alignment semantics. */
export function resolveLayoutTop(value: LayoutAnchor, height: number): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (value === 'top') return 0
  const number = Number.parseFloat(value)
  if (!Number.isFinite(number)) return undefined
  return value.endsWith('%') ? number * height / 100 : number
}

const overlapsX = (a: LayoutRect, b: LayoutRect) => a.x < b.x + b.width && b.x < a.x + a.width
const overlaps = (a: LayoutRect, b: LayoutRect) => (
  overlapsX(a, b) && a.y < b.y + b.height && b.y < a.y + a.height
)
const hasAnchor = (option: AuthoredComponent, name: string) => option[name] !== undefined && option[name] !== null

function findAuthored(layout: AuthoredLayout, component: MeasuredLayoutComponent) {
  const entries = layout[component.kind]
  return entries.find(item => item.id !== undefined && String(item.id) === component.id)
    ?? entries[component.index]
    ?? (component.kind === 'grid' && entries.length === 0 ? {} : undefined)
}

/** Compute only missing vertical anchors from measured rectangles. Explicit and ambiguous regions keep their placement. */
export function calculateGeometryDefaults(
  authored: AuthoredLayout,
  geometry: EchartsGeometry,
  baselineTops: ReadonlyMap<string, LayoutAnchor>,
): LayoutTopPatch[] {
  if (!authored.enabled || geometry.width <= 0 || geometry.height <= 0) return []
  const items = geometry.components.map(component => {
    const option = findAuthored(authored, component)
    const top = resolveLayoutTop(component.top, geometry.height)
    const baseline = resolveLayoutTop(baselineTops.get(layoutComponentKey(component)) ?? component.top, geometry.height)
    const eligible = !!option && top !== undefined && baseline !== undefined
      && !hasAnchor(option, 'top') && !hasAnchor(option, 'bottom')
      && !hasAnchor(option, 'height')
      && (component.kind !== 'legend' || option.orient !== 'vertical')
    return {
      ...component,
      eligible,
      currentTop: top,
      baselineTop: baseline,
      rect: {
        ...component.rect,
        y: eligible ? component.rect.y - top! + baseline! : component.rect.y,
      },
      exterior: {
        ...(component.exterior ?? component.rect),
        y: (component.exterior ?? component.rect).y - (eligible ? top! - baseline! : 0),
      },
    }
  })
  const headers = items.filter(item => item.kind !== 'grid')
  const patches: LayoutTopPatch[] = []
  // Array order is not a title-to-chart or legend-to-chart relationship. Do not invent one for overlapping peers.
  for (const item of headers) {
    if (headers.some(peer => peer !== item && peer.kind === item.kind && overlaps(peer.rect, item.rect))) {
      if (item.eligible && Math.abs(item.baselineTop! - item.currentTop!) > 0.5) {
        patches.push({ kind: item.kind, id: item.id, top: item.baselineTop! })
      }
      item.eligible = false
    }
  }
  const fixed = headers.filter(item => !item.eligible)
  const titles = headers.filter(item => item.kind === 'title' && item.eligible)
  const legends = headers.filter(item => item.kind === 'legend' && item.eligible)
  const grids = items.filter(item => item.kind === 'grid')
  // Preserve each header's measured relation to the plot before moving headers around authored obstacles.
  // A native footer legend must not consume the top reserve or invalidate a title's otherwise feasible move.
  const topHeaders = grids.length === 1 ? headers.filter(header => overlapsX(header.rect, grids[0].exterior)
    && header.rect.y <= grids[0].rect.y) : []

  // Fixed authored anchors are obstacles; a missing title precedes a missing horizontal legend.
  const placeAfter = (item: typeof items[number], obstacles: typeof items) => {
    const initialY = item.rect.y
    let nextY = initialY
    for (let pass = 0; pass < obstacles.length; pass++) {
      let moved = false
      for (const obstacle of obstacles) {
        const candidate = { ...item.rect, y: nextY }
        if (overlaps(candidate, obstacle.rect)) {
          nextY = obstacle.rect.y + obstacle.rect.height + Math.max(item.gap, obstacle.gap)
          moved = true
        }
      }
      if (!moved) break
    }
    // An impossible viewport does not authorize clipping components or changing authored dimensions.
    if (nextY + item.rect.height > geometry.height) return
    item.rect.y = nextY
    const top = item.baselineTop! + nextY - initialY
    if (Math.abs(top - item.currentTop!) > 0.5) patches.push({ kind: item.kind, id: item.id, top })
  }
  for (const title of titles) placeAfter(title, fixed)
  for (const legend of legends) placeAfter(legend, [...fixed, ...titles])

  if (grids.length === 1 && grids[0].eligible) {
    const grid = grids[0]
    const displacement = Math.max(0, ...topHeaders.map(header => header.rect.y + header.rect.height + header.gap - grid.exterior.y))
    const top = grid.baselineTop! + displacement
    if (displacement < grid.rect.height && Math.abs(top - grid.currentTop!) > 0.5) {
      patches.push({ kind: 'grid', id: grid.id, top })
    }
  }
  return patches
}
