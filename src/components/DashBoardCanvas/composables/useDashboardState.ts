import { computed, shallowRef, watch } from 'vue'
import { cloneDeep, isEqual } from 'lodash-es'
import { applyGridLayout, getGridSettings, normalizeGridItem, parseStoredLayout, toGridLayout, toStoredLayout } from '../utils/layout'
import { applyWidgetDraft } from '../utils/config'
import { createDashboardId } from '../utils/id'
import type {
  DashboardCatalog, DashboardCanvasConfig, DashboardLayoutItem, DashboardValue, DashboardWidget,
} from '../types'

interface DashboardStateOptions {
  value: () => DashboardValue
  catalog: () => DashboardCatalog
  editable: () => boolean
  onChange: (value: DashboardValue) => void
  layoutEditable: () => boolean
  storageKey?: () => string | undefined
}

/** One state per canvas. Neither input configuration nor catalog defaults are mutated. */
export function useDashboardState(options: DashboardStateOptions) {
  const initial = cloneDeep(options.value())
  const stored = options.storageKey?.()
  if (options.layoutEditable() && stored && typeof localStorage !== 'undefined') {
    try {
      const saved = parseStoredLayout(JSON.parse(localStorage.getItem(stored) || 'null'))
      if (saved) initial.components = applyGridLayout(initial.components, saved, getGridSettings(initial.canvas).columns)
    } catch { /* Ignore malformed or unavailable local storage. */ }
  }
  const value = shallowRef(initial)
  const gridSettings = computed(() => getGridSettings(value.value.canvas))

  watch(options.value, next => {
    if (!isEqual(next, value.value)) value.value = cloneDeep(next)
  }, { deep: true })

  function commit(next: DashboardValue) {
    if ((!options.editable() && !options.layoutEditable()) || isEqual(next, value.value)) return
    value.value = cloneDeep(next)
    if (options.editable()) options.onChange(cloneDeep(next))
  }

  function addWidget(type: string, position?: { x: number; y: number }, settledLayout?: DashboardLayoutItem[]) {
    const definition = options.catalog().components[type]
    if (!options.editable() || !definition) return
    const defaults = cloneDeep(definition.defaultConfig)
    const components = settledLayout
      ? applyGridLayout(value.value.components, settledLayout, gridSettings.value.columns)
      : value.value.components
    const layout = toGridLayout(components, gridSettings.value.columns)
    const bottom = Math.max(0, ...layout.map(item => item.y + item.h))
    const id = `${type}_${createDashboardId()}`
    const gridItem = normalizeGridItem({
      ...defaults.componentProps.gridItem,
      ...definition.defaultGridItem,
      x: position?.x ?? 0,
      y: position?.y ?? bottom,
    }, gridSettings.value.columns)
    const widget: DashboardWidget = {
      ...defaults, id, type,
      componentProps: { ...defaults.componentProps, gridItem },
    }
    commit({ ...value.value, components: [...components, widget] })
    return id
  }

  function removeWidget(id: string) {
    if (value.value.components.find(widget => widget.id === id)?.isLocked) return
    commit({ ...value.value, components: value.value.components.filter(widget => widget.id !== id) })
  }

  function updateWidget(initial: DashboardWidget, draft: DashboardWidget) {
    commit({
      ...value.value,
      components: value.value.components.map(widget => widget.id === initial.id && !widget.isLocked
        ? applyWidgetDraft(widget, initial, draft) : widget),
    })
  }

  function updateLayout(layout: DashboardLayoutItem[]) {
    if (!options.layoutEditable()) return
    const next = { ...value.value, components: applyGridLayout(value.value.components, layout, gridSettings.value.columns) }
    commit(next)
    const key = options.storageKey?.()
    if (key && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(key, JSON.stringify(toStoredLayout(layout))) } catch { /* Storage may be unavailable or full. */ }
    }
  }

  function updateCanvas(canvas: DashboardCanvasConfig) {
    commit({ ...value.value, canvas: cloneDeep(canvas) })
  }

  return { value, gridSettings, addWidget, removeWidget, updateWidget, updateLayout, updateCanvas }
}
