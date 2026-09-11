import { createApp, h, nextTick, reactive, type App } from 'vue'
import { graphic, getInstanceByDom, registerPostUpdate, type EChartsCoreOption } from 'echarts/core'
import Echarts from '../src/components/Echarts/Echarts.vue'
import type { EchartsLayoutProfile } from '../src/hooks/Echarts/geometryDefaults'

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
})

const host = document.getElementById('host')!
let app: App | undefined
let canonical: EChartsCoreOption = {}
let canonicalBytes = ''
const errors: string[] = []
const props = reactive<{ option: EChartsCoreOption; layoutProfile: EchartsLayoutProfile }>({ option: {}, layoutProfile: 'native' })
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
