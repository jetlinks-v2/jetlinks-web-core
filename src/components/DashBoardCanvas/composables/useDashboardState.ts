import { computed, shallowRef, watch } from 'vue'
import { cloneDeep, isEqual } from 'lodash-es'
import { applyGridLayout, getGridSettings, normalizeGridItem, toGridLayout } from '../utils/layout'
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
}

/** One state per canvas. Neither input configuration nor catalog defaults are mutated. */
export function useDashboardState(options: DashboardStateOptions) {
  const value = shallowRef(cloneDeep(options.value()))
  const gridSettings = computed(() => getGridSettings(value.value.canvas))

  watch(options.value, next => {
    if (!isEqual(next, value.value)) value.value = cloneDeep(next)
  }, { deep: true })

  function commit(next: DashboardValue) {
    if (!options.editable() || isEqual(next, value.value)) return
    value.value = cloneDeep(next)
    options.onChange(cloneDeep(next))
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
    commit({ ...value.value, components: applyGridLayout(value.value.components, layout, gridSettings.value.columns) })
  }

  function updateCanvas(canvas: DashboardCanvasConfig) {
    commit({ ...value.value, canvas: cloneDeep(canvas) })
  }

  return { value, gridSettings, addWidget, removeWidget, updateWidget, updateLayout, updateCanvas }
}
