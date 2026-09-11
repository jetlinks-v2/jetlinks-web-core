import type { ECharts, EChartsCoreOption } from 'echarts/core'
import {
  captureAuthoredLayout,
  mergeAuthoredLayout,
  calculateGeometryDefaults,
  calculateHorizontalDefaults,
  layoutComponentKey,
  type EchartsGeometry,
  type LayoutAnchor,
  type LayoutTopPatch,
  type MeasuredLayoutComponent,
  type LayoutComponentState,
  type LayoutOptionPatch,
} from './geometryDefaults'

export type EchartsLayoutRuntime = Pick<typeof import('echarts/core'), 'graphic' | 'registerPostUpdate'>
type GeometryObservers = WeakMap<ReturnType<ECharts['getZr']>, {
  measure: () => boolean
  update: (geometry: EchartsGeometry) => void
}>

// Each ECharts runtime owns its extension callback; disposed charts are removed without retaining their canvas.
const runtimeObservers = new WeakMap<EchartsLayoutRuntime, GeometryObservers>()

/** Component extension callbacks expose a generic option; read only the public text constraint fields. */
function readTextConstraints(value: unknown) {
  return {
    width: value && typeof value === 'object' && 'width' in value ? value.width : undefined,
    overflow: value && typeof value === 'object' && 'overflow' in value ? value.overflow : undefined,
  }
}

/** Register one official extension callback. It only reads public geometry for explicitly attached renderers. */
function registerGeometryObserver(runtime: EchartsLayoutRuntime): GeometryObservers {
  const registered = runtimeObservers.get(runtime)
  if (registered) return registered
  const geometryObservers: GeometryObservers = new WeakMap()
  runtimeObservers.set(runtime, geometryObservers)
  runtime.registerPostUpdate((model, api) => {
    const observer = geometryObservers.get(api.getZr())
    if (!observer) return
    const components: MeasuredLayoutComponent[] = []
    const componentStates: LayoutComponentState[] = []
    for (const kind of ['title', 'legend', 'grid'] as const) {
      model.eachComponent(kind, component => {
        const { top, bottom, height, left, right, width } = component.getBoxLayoutParams()
        componentStates.push({ kind, id: component.id, name: component.name, index: component.componentIndex, anchors: { top, bottom, height, left, right, width } })
      })
    }
    if (!observer.measure()) {
      observer.update({ width: api.getWidth(), height: api.getHeight(), components, componentStates })
      return
    }
    for (const kind of ['title', 'legend'] as const) {
      model.eachComponent(kind, component => {
        const group = api.getViewOfComponentModel(component).group
        if (!group.childCount()) return
        const rect = group.getBoundingRect().clone()
        const transform = group.getComputedTransform()
        if (transform) rect.applyTransform(transform)
        if (rect.width <= 0 || rect.height <= 0) return
        const top = component.getBoxLayoutParams().top ?? 0
        if (typeof top !== 'string' && typeof top !== 'number') return
        const gap = 'itemGap' in component.option ? component.option.itemGap : undefined
        const padding = 'padding' in component.option ? component.option.padding : 0
        const cssPadding = typeof padding === 'number' ? [padding, padding, padding, padding]
          : Array.isArray(padding) ? [padding[0], padding[1] ?? padding[0], padding[2] ?? padding[0], padding[3] ?? padding[1] ?? padding[0]] : [0, 0, 0, 0]
        const { left, right } = component.getBoxLayoutParams()
        components.push({
          kind, id: component.id, index: component.componentIndex,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          top, gap: typeof gap === 'number' && gap >= 0 ? gap : 0,
          ...(kind === 'title' ? { horizontal: {
            left, right, padding: cssPadding,
            textStyle: readTextConstraints('textStyle' in component.option ? component.option.textStyle : undefined),
            subtextStyle: readTextConstraints('subtextStyle' in component.option ? component.option.subtextStyle : undefined),
          } } : {}),
        })
      })
    }
    for (const coordinateSystem of api.getCoordinateSystems()) {
      const component = coordinateSystem.model
      if (component?.mainType !== 'grid' || !coordinateSystem.getRect) continue
      const top = component.getBoxLayoutParams().top ?? 0
      if (typeof top !== 'string' && typeof top !== 'number') continue
      const rect = coordinateSystem.getRect()
      const exterior = new runtime.graphic.BoundingRect(rect.x, rect.y, rect.width, rect.height)
      for (const kind of ['xAxis', 'yAxis'] as const) {
        model.eachComponent(kind, axis => {
          const grid = axis.getReferringComponents('grid', { useDefault: true }).models[0]
          if (grid?.id !== component.id) return
          const group = api.getViewOfComponentModel(axis).group
          if (!group.childCount()) return
          const axisRect = group.getBoundingRect().clone()
          const transform = group.getComputedTransform()
          if (transform) axisRect.applyTransform(transform)
          exterior.union(axisRect)
        })
      }
      components.push({
        kind: 'grid', id: component.id, index: component.componentIndex,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        exterior: { x: exterior.x, y: exterior.y, width: exterior.width, height: exterior.height },
        top, gap: 0,
      })
    }
    observer.update({ width: api.getWidth(), height: api.getHeight(), components, componentStates })
  })
  return geometryObservers
}

/** Merge layout fields only; replaying the source here would reset current legend/dataZoom interaction state. */
function applyTopPatches(instance: ECharts, patches: LayoutTopPatch[]) {
  if (!patches.length) return
  const option: EChartsCoreOption = {}
  for (const kind of ['title', 'legend', 'grid'] as const) {
    const values = patches.filter(patch => patch.kind === kind).map(({ id, top }) => ({ id, top }))
    if (values.length) option[kind] = values
  }
  instance.setOption(option, { silent: true })
}

/** Patch only measured text/box constraints; source text, rich styles and all interaction data stay in the renderer. */
function applyHorizontalPatches(instance: ECharts, patches: LayoutOptionPatch[]) {
  if (!patches.length) return
  const option: EChartsCoreOption = {}
  for (const kind of ['title', 'grid'] as const) {
    const values = patches.filter(patch => patch.kind === kind).map(({ id, fields }) => ({ id, ...fields }))
    if (values.length) option[kind] = values
  }
  instance.setOption(option, { silent: true })
}

/** Use the caller's public ECharts runtime in browsers and isolated SSR contexts; no renderer is bundled here. */
export function createMeasuredEchartsLayout(instance: ECharts, runtime: EchartsLayoutRuntime, enabled = true) {
  const geometryObservers = registerGeometryObserver(runtime)
  let authored = captureAuthoredLayout({})
  let latest: EchartsGeometry | undefined
  let pending: ReturnType<typeof captureAuthoredLayout> | undefined
  let previousStates: LayoutComponentState[] = []
  const baselineTops = new Map<string, LayoutAnchor>()
  const patched = new Map<string, LayoutTopPatch>()
  let horizontalRestores: LayoutOptionPatch[] = []
  geometryObservers.set(instance.getZr(), { measure: () => enabled, update: geometry => { latest = geometry } })

  const restore = () => {
    const patches = [...patched.values()].map(patch => ({
      ...patch, top: baselineTops.get(layoutComponentKey(patch)) ?? patch.top,
    }))
    applyTopPatches(instance, patches)
    patched.clear()
    applyHorizontalPatches(instance, horizontalRestores)
    horizontalRestores = []
  }

  return {
    /** Restore previous policy fields before a new authored option; never persist layout defaults as source. */
    prepare(option: EChartsCoreOption) {
      restore()
      pending = captureAuthoredLayout(option)
      previousStates = latest?.componentStates ?? []
      baselineTops.clear()
      latest = undefined
    },
    /** Called after setOption/resize returns, never from the ECharts update callback or an event feedback loop. */
    apply() {
      if (!latest) return
      if (pending) {
        authored = mergeAuthoredLayout(authored, pending, previousStates, latest.componentStates)
        pending = undefined
        previousStates = []
      }
      if (!enabled) return
      // Every resize starts from native geometry. Two directional passes cannot feed back into one another.
      restore()
      baselineTops.clear()
      const horizontalPatches = calculateHorizontalDefaults(authored, latest)
      horizontalRestores = horizontalPatches.map(({ kind, id, fields }) => {
        const state = latest!.componentStates.find(item => item.kind === kind && item.id === id)!
        const restored: LayoutOptionPatch['fields'] = {}
        for (const side of ['left', 'right'] as const) {
          const anchor = state.anchors[side]
          if (fields[side] !== undefined && (typeof anchor === 'string' || typeof anchor === 'number')) restored[side] = anchor
        }
        for (const key of ['textStyle', 'subtextStyle'] as const) {
          if (fields[key]) restored[key] = { width: null, overflow: null }
        }
        return { kind, id, fields: restored }
      })
      applyHorizontalPatches(instance, horizontalPatches)
      for (const component of latest.components) {
        const key = layoutComponentKey(component)
        if (!baselineTops.has(key)) baselineTops.set(key, component.top)
      }
      const patches = calculateGeometryDefaults(authored, latest, baselineTops)
      applyTopPatches(instance, patches)
      for (const patch of patches) patched.set(layoutComponentKey(patch), patch)
    },
    /** Keep authored metadata through profile toggles, including native-mode partial updates. */
    setEnabled(value: boolean) {
      if (!value) restore()
      enabled = value
      baselineTops.clear()
    },
    dispose(restoreLayout = false) {
      if (restoreLayout) restore()
      geometryObservers.delete(instance.getZr())
      baselineTops.clear()
      patched.clear()
      horizontalRestores = []
      latest = undefined
      pending = undefined
      previousStates = []
    },
  }
}
