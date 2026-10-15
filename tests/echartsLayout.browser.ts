import { createApp, h, nextTick, reactive, type App } from 'vue'
import { graphic, getInstanceByDom, registerPostUpdate, type EChartsCoreOption } from 'echarts/core'
import Echarts from '../src/components/Echarts/Echarts.vue'
import type { EchartsLayoutProfile } from '../src/hooks/Echarts/geometryDefaults'
import percentageMarginOption from './fixtures/echarts-percentage-margin-option.json'

type Rect = { x: number; y: number; width: number; height: number }
const geometries = new Map<string, { title: Rect[]; legend: Rect[]; grid: Rect[]; axis: Rect[]; renderedTitleText: string[]; renderedAxisText: string[] }>()
registerPostUpdate((model, api) => {
  const measured = { title: [] as Rect[], legend: [] as Rect[], grid: [] as Rect[], axis: [] as Rect[], renderedTitleText: [] as string[], renderedAxisText: [] as string[] }
  for (const kind of ['title', 'legend', 'xAxis', 'yAxis'] as const) {
    model.eachComponent(kind, component => {
      const group = api.getViewOfComponentModel(component).group
      const rect = group.getBoundingRect().clone()
      const transform = group.getComputedTransform()
      if (transform) rect.applyTransform(transform)
      measured[kind === 'xAxis' || kind === 'yAxis' ? 'axis' : kind].push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
      if (kind !== 'legend') group.traverse(element => {
        if (element instanceof graphic.Text) {
          const text = element.childrenRef().map(child => 'text' in child.style ? child.style.text : '').join('')
          measured[kind === 'title' ? 'renderedTitleText' : 'renderedAxisText'].push(text)
        }
      })
    })
  }
  for (const coordinateSystem of api.getCoordinateSystems()) {
    if (coordinateSystem.model?.mainType === 'grid' && coordinateSystem.getRect) {
      measured.grid.push({ ...coordinateSystem.getRect() })
    }
  }
  geometries.set(api.getId(), measured)
  if (manualReport) queueMicrotask(publishManualReport)
})

const host = document.getElementById('host')!
let app: App | undefined
let canonical: EChartsCoreOption = {}
let canonicalBytes = ''
const errors: string[] = []
const props = reactive<{ option: EChartsCoreOption; layoutProfile: EchartsLayoutProfile }>({ option: {}, layoutProfile: 'native' })
let manualReport: HTMLElement | undefined
let expectedInteraction: { selected: unknown; dataZoom: unknown } | undefined
const instance = () => {
  const element = host.querySelector<HTMLElement>('.echarts-warp')
  return element ? getInstanceByDom(element) : undefined
}

const harness = {
  async mount(option: EChartsCoreOption, layoutProfile: EchartsLayoutProfile, width: number, height: number) {
    app?.unmount()
    geometries.clear()
    errors.length = 0
    canonical = structuredClone(option)
    canonicalBytes = JSON.stringify(canonical)
    props.option = canonical
    props.layoutProfile = layoutProfile
    host.style.width = `${width}px`
    host.style.height = `${height}px`
    app = createApp({
      render: () => h(Echarts, {
        option: props.option, layoutProfile: props.layoutProfile,
        onError: (error: unknown) => errors.push(String(error)),
      }),
    })
    app.mount(host)
    await nextTick()
  },
  resize(width: number, height: number) {
    // Deliberately no chart.resize() here: exercise the real component ResizeObserver and debounce.
    host.style.width = `${width}px`
    host.style.height = `${height}px`
  },
  interact(name: string) {
    instance()?.dispatchAction({ type: 'legendUnSelect', name })
    instance()?.dispatchAction({ type: 'dataZoom', start: 20, end: 70 })
  },
  async profile(layoutProfile: EchartsLayoutProfile) {
    props.layoutProfile = layoutProfile
    await nextTick()
  },
  async update(option: EChartsCoreOption) {
    canonical = structuredClone(option)
    canonicalBytes = JSON.stringify(canonical)
    props.option = canonical
    await nextTick()
  },
  snapshot() {
    const chart = instance()
    return {
      errors: [...errors], width: chart?.getWidth(), height: chart?.getHeight(), domWidth: host.getBoundingClientRect().width,
      geometry: chart ? geometries.get(chart.getId()) : undefined,
      animationFinished: chart?.getZr().animation.isFinished(),
      option: chart?.getOption(), canonicalUnchanged: canonicalBytes === JSON.stringify(canonical),
    }
  },
  unmount() {
    const chart = instance()
    app?.unmount()
    app = undefined
    return chart?.isDisposed()
  },
}

declare global {
  interface Window { echartsLayoutHarness: typeof harness }
}
window.echartsLayoutHarness = harness

// Manual controls exercise the same SFC/ResizeObserver via normal browser interaction, without hidden-state automation.
function publishManualReport() {
  if (!manualReport) return
  const state = harness.snapshot()
  const geometry = state.geometry
  if (!geometry || !state.width || !state.height) return
  const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  const headers = [...geometry.title, ...geometry.legend]
  const clearHeaders = geometry.title.every(title => geometry.legend.every(legend => !overlap(title, legend)))
    && geometry.grid.every(grid => headers.every(header => grid.y >= header.y + header.height))
    && geometry.axis.every(axis => headers.every(header => !overlap(axis, header)))
  const insideViewport = [...headers, ...geometry.axis].every(rect => rect.x >= -0.5 && rect.x + rect.width <= state.width! + 0.5
    && rect.y >= -0.5 && rect.y + rect.height <= state.height! + 0.5)
  const rendered = state.option?.series as { data?: unknown }[] | undefined
  const source = canonical.series as { data?: unknown }[] | undefined
  const legend = state.option?.legend as { selected?: unknown }[] | undefined
  manualReport.textContent = JSON.stringify({
    profile: props.layoutProfile, width: state.width, height: state.height,
    clearHeaders, insideViewport, canonicalUnchanged: state.canonicalUnchanged,
    dataUnchanged: JSON.stringify(rendered?.map(series => series.data)) === JSON.stringify(source?.map(series => series.data)),
    interactionPreserved: !expectedInteraction || (JSON.stringify(legend?.[0]?.selected) === JSON.stringify(expectedInteraction.selected)
      && JSON.stringify(state.option?.dataZoom) === JSON.stringify(expectedInteraction.dataZoom)),
    errors: state.errors,
  }, null, 2)
}

if (new URLSearchParams(window.location.search).has('manual')) {
  const controls = document.createElement('nav')
  controls.setAttribute('aria-label', 'Layout test controls')
  manualReport = document.createElement('pre')
  manualReport.setAttribute('aria-label', 'Layout verification')
  for (const [label, action] of [
    ['Narrow', () => harness.resize(400, 398)],
    ['Small', () => harness.resize(360, 360)],
    ['Wide', () => harness.resize(800, 600)],
    ['Tall', () => harness.resize(800, 720)],
    ['Native', () => harness.profile('native')],
    ['Presentation', () => harness.profile('presentation')],
    ['Select and zoom', () => {
      harness.interact('Signal B maximum')
      const state = harness.snapshot()
      expectedInteraction = { selected: (state.option?.legend as { selected?: unknown }[])?.[0]?.selected, dataZoom: state.option?.dataZoom }
      publishManualReport()
    }],
  ] as const) {
    const button = document.createElement('button')
    button.textContent = label
    button.addEventListener('click', () => { void action() })
    controls.append(button)
  }
  host.before(controls)
  host.after(manualReport)
  void harness.mount(percentageMarginOption, 'presentation', 400, 398)
}
