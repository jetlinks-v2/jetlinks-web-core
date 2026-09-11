import type {
  DashboardCanvasConfig, DashboardGridItem, DashboardGridSettings,
  DashboardLayoutItem, DashboardWidget,
} from '../types'

function finite(value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value)) : fallback
}

export function getGridSettings(canvas: DashboardCanvasConfig): DashboardGridSettings {
  const grid = canvas.gridLayout
  return {
    columns: Math.floor(finite(grid?.colNum, 12, 1, 48)),
    rowHeight: finite(grid?.rowHeight, 25, 1),
    margin: [finite(grid?.marginHorizontal, 8), finite(grid?.marginVertical, 8)],
  }
}

/** Normalize layout constraints before passing persisted or external values to the grid library. */
export function normalizeGridItem(grid: Partial<DashboardGridItem> = {}, columns = 12): DashboardGridItem {
  const minW = Math.floor(finite(grid.minW, 1, 1, columns))
  const minH = Math.floor(finite(grid.minH, 1, 1))
  const maxW = Math.floor(finite(grid.maxW, columns, minW, columns))
  const maxH = Math.floor(finite(grid.maxH, Math.max(minH, 30), minH))
  const w = Math.floor(finite(grid.w, Math.min(maxW, Math.max(minW, 2)), minW, maxW))
  const h = Math.floor(finite(grid.h, Math.min(maxH, Math.max(minH, 2)), minH, maxH))
  return {
    ...grid, w, h, minW, minH, maxW, maxH,
    x: Math.floor(finite(grid.x, 0, 0, columns - w)),
    y: Math.floor(finite(grid.y, 0)),
  }
}

export function toGridLayout(widgets: readonly DashboardWidget[], columns: number): DashboardLayoutItem[] {
  let bottom = 0
  return widgets.filter(widget => widget.visible !== false).map(widget => {
    const item = normalizeGridItem({ y: bottom, ...widget.componentProps.gridItem }, columns)
    bottom = Math.max(bottom, item.y + item.h)
    return { ...item, i: widget.id, static: widget.isLocked === true }
  })
}

export function applyGridLayout(widgets: DashboardWidget[], layout: DashboardLayoutItem[], columns: number) {
  const positions = new Map(layout.map(item => [item.i, item]))
  return widgets.map(widget => {
    const position = positions.get(widget.id)
    if (!position || widget.isLocked || widget.visible === false) return widget
    const { x, y, w, h } = normalizeGridItem({ ...widget.componentProps.gridItem, ...position }, columns)
    return {
      ...widget,
      componentProps: {
        ...widget.componentProps,
        gridItem: { ...widget.componentProps.gridItem, x, y, w, h },
      },
    }
  })
}
