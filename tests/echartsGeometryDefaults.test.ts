import assert from 'node:assert/strict'
import * as echartsRuntime from 'echarts/core'
import test, { type TestContext } from 'node:test'
import { graphic, init, use, registerPostUpdate, type ECharts, type EChartsCoreOption } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, LegendComponent, GridComponent, ToolboxComponent, DataZoomComponent, TooltipComponent, TimelineComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import { createMeasuredEchartsLayout } from '../src/hooks/Echarts/measuredLayout'
import { calculateGeometryDefaults, captureAuthoredLayout, type EchartsGeometry } from '../src/hooks/Echarts/geometryDefaults'
import originalOption from './fixtures/echarts-monthly-option.json'
import longTitleOption from './fixtures/echarts-long-title-option.json'

use([BarChart, LineChart, TitleComponent, LegendComponent, GridComponent, ToolboxComponent, DataZoomComponent, TooltipComponent, TimelineComponent, SVGRenderer])

type Rect = { x: number; y: number; width: number; height: number }
type Bounds = { title: Rect[]; legend: Rect[]; grid: Rect[]; axis: Rect[]; renderedTitleText: string[]; renderedAxisText: string[] }
const bounds = new WeakMap<ReturnType<ECharts['getZr']>, Bounds>()
registerPostUpdate((model, api) => {
  const result: Bounds = { title: [], legend: [], grid: [], axis: [], renderedTitleText: [], renderedAxisText: [] }
  for (const kind of ['title', 'legend', 'xAxis', 'yAxis'] as const) {
    model.eachComponent(kind, component => {
      const group = api.getViewOfComponentModel(component).group
      const rect = group.getBoundingRect().clone()
      const transform = group.getComputedTransform()
      if (transform) rect.applyTransform(transform)
      result[kind === 'xAxis' || kind === 'yAxis' ? 'axis' : kind].push(rect)
      if (kind !== 'legend') group.traverse(element => {
        if (element instanceof graphic.Text) {
          const text = element.childrenRef().map(child => 'text' in child.style ? child.style.text : '').join('')
          result[kind === 'title' ? 'renderedTitleText' : 'renderedAxisText'].push(text)
        }
      })
    })
  }
  for (const coordinateSystem of api.getCoordinateSystems()) {
    if (coordinateSystem.model?.mainType === 'grid' && coordinateSystem.getRect) {
      result.grid.push({ ...coordinateSystem.getRect() })
    }
  }
  bounds.set(api.getZr(), result)
})

const arrayOf = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value : []
const renderData = (instance: ECharts) => arrayOf(instance.getOption().series).map(series => series.data)
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height

test('header placement retains measured top/bottom plot relations after wrapping and authored obstacles', () => {
  const geometry: EchartsGeometry = {
    width: 360, height: 480, componentStates: [],
    components: [
      { kind: 'title', id: 'title', index: 0, top: 15, gap: 10, rect: { x: 17, y: 15, width: 325, height: 45 } },
      { kind: 'legend', id: 'legend', index: 0, top: 0, gap: 10, rect: { x: 83, y: 442, width: 194, height: 23 } },
      { kind: 'grid', id: 'grid', index: 0, top: 65, gap: 0, rect: { x: 54, y: 65, width: 190, height: 335 },
        exterior: { x: 23, y: 38, width: 334, height: 382 } },
    ],
  }
  const authored = captureAuthoredLayout({ title: {}, legend: {} })
  const patches = calculateGeometryDefaults(authored, geometry, new Map())
  assert.deepEqual(patches, [{ kind: 'grid', id: 'grid', top: 97 }], 'only the upper title reserves space above the axis exterior')

  geometry.components[1] = { ...geometry.components[1], top: 10, rect: { x: 83, y: 10, width: 194, height: 40 } }
  const fixedLegend = captureAuthoredLayout({ title: {}, legend: { top: 10 } })
  const moved = calculateGeometryDefaults(fixedLegend, geometry, new Map())
  assert.deepEqual(moved, [{ kind: 'title', id: 'title', top: 60 }, { kind: 'grid', id: 'grid', top: 142 }],
    'a title moved below an authored obstacle retains its original relation above the plot')
})

function createChart(t: TestContext, option: EChartsCoreOption, width = 800, height = 480, enabled = true) {
  const canonical = structuredClone(option)
  const originalBytes = JSON.stringify(canonical)
  const instance = init(null, undefined, { renderer: 'svg', ssr: true, width, height })
  const layout = enabled ? createMeasuredEchartsLayout(instance, echartsRuntime) : undefined
  layout?.prepare(canonical)
  instance.setOption(canonical)
  layout?.apply()
  t.after(() => {
    assert.equal(JSON.stringify(canonical), originalBytes, 'canonical source is immutable')
    layout?.dispose()
    instance.dispose()
  })
  return {
    instance, layout, canonical,
    update(patch: EChartsCoreOption) {
      layout?.prepare(patch)
      instance.setOption(patch)
      layout?.apply()
    },
    geometry: () => bounds.get(instance.getZr())!,
    resize(nextWidth: number, nextHeight = height) {
      instance.resize({ width: nextWidth, height: nextHeight })
      layout?.apply()
    },
  }
}

function assertHeadersClear(geometry: Bounds) {
  for (const title of geometry.title) for (const legend of geometry.legend) {
    assert.equal(intersects(title, legend), false, 'measured title and legend rectangles do not overlap')
  }
  for (const grid of geometry.grid) for (const header of [...geometry.title, ...geometry.legend]) {
    assert.ok(grid.y >= header.y + header.height, 'plot begins below the measured header')
  }
  for (const axis of geometry.axis) for (const header of [...geometry.title, ...geometry.legend]) {
    assert.equal(intersects(axis, header), false, 'measured axis exterior clears the header')
  }
}

function assertInsideWidth(rects: Rect[], width: number) {
  for (const rect of rects) {
    assert.ok(rect.x >= -0.5 && rect.x + rect.width <= width + 0.5, `horizontal bounds ${rect.x}..${rect.x + rect.width} fit ${width}`)
  }
}

const renderedCharacters = (text: string) => text.replace(/\{[^|}]+\|([^}]*)\}/g, '$1').replace(/\s/g, '')

test('actual long canonical title and time-axis name fit a narrow viewport and recover on wider resize', t => {
  const chart = createChart(t, longTitleOption, 800, 480)
  const wideHeight = chart.geometry().title[0].height
  for (const width of [360, 600, 800, 360, 800]) {
    chart.resize(width)
    assertInsideWidth([...chart.geometry().title, ...chart.geometry().axis], width)
    assertHeadersClear(chart.geometry())
    assert.ok(chart.geometry().renderedTitleText.some(text => renderedCharacters(text) === renderedCharacters(longTitleOption.title.text)))
    assert.ok(chart.geometry().renderedAxisText.includes(longTitleOption.xAxis.name))
    assert.deepEqual(renderData(chart.instance), longTitleOption.series.map(series => series.data))
    assert.equal(arrayOf(chart.instance.getOption().title)[0].text, longTitleOption.title.text)
    if (width === 360) assert.ok(chart.geometry().title[0].height > wideHeight)
    if (width === 800) assert.equal(chart.geometry().title[0].height, wideHeight)
  }
})

test('anonymous multilingual title, subtitle and rich lines use public natural wrapping with padding', t => {
  const title = {
    text: '{heading|Anonymous calibrated measurements over a changing observation window}\n匿名观测范围与测量指标的完整说明',
    subtext: 'Supplementary observations from independent sensors and sampling windows',
    left: 'center', padding: [8, 14, 10, 18],
    textStyle: { rich: { heading: { fontSize: 23, lineHeight: 31 } } },
    subtextStyle: { lineHeight: 19 },
  }
  const chart = createChart(t, { ...longTitleOption, title }, 800, 600)
  for (const width of [360, 800]) {
    chart.resize(width, 600)
    assertInsideWidth(chart.geometry().title, width)
    assertHeadersClear(chart.geometry())
    for (const expected of [title.text, title.subtext]) {
      assert.ok(chart.geometry().renderedTitleText.some(text => renderedCharacters(text) === renderedCharacters(expected)))
    }
    const actual = arrayOf(chart.instance.getOption().title)[0]
    assert.equal(actual.text, title.text)
    assert.equal(actual.subtext, title.subtext)
    assert.deepEqual((actual.textStyle as typeof title.textStyle).rich, title.textStyle.rich)
    assert.equal((actual.subtextStyle as typeof title.subtextStyle).lineHeight, 19)
  }
})

test('authored text widths, overflow, padding and side anchors survive partial updates and profile toggles', t => {
  const title = { text: 'An authored title which deliberately uses truncation', left: 27, right: 19, padding: [4, 8],
    textStyle: { width: 130, overflow: 'truncate', lineHeight: 29 }, subtext: 'Authored subtitle', subtextStyle: { width: 95, overflow: 'break' } }
  const chart = createChart(t, { ...longTitleOption, title }, 360, 480)
  const native = createChart(t, { ...longTitleOption, title }, 360, 480, false)
  chart.update({ title: { text: 'A changed authored title', textStyle: { color: 'blue' } } })
  native.update({ title: { text: 'A changed authored title', textStyle: { color: 'blue' } } })
  chart.resize(800)
  chart.layout?.setEnabled(false)
  chart.layout?.setEnabled(true)
  chart.instance.resize()
  chart.layout?.apply()
  const actual = arrayOf(chart.instance.getOption().title)[0]
  assert.equal(actual.left, 27)
  assert.equal(actual.right, arrayOf(native.instance.getOption().title)[0].right, 'native ignoreSize merge chooses between opposite title anchors')
  assert.deepEqual(actual.padding, [4, 8])
  assert.equal((actual.textStyle as typeof title.textStyle).width, 130)
  assert.equal((actual.textStyle as typeof title.textStyle).overflow, 'truncate')
  assert.equal((actual.textStyle as typeof title.textStyle).lineHeight, 29)
  assert.equal((actual.subtextStyle as typeof title.subtextStyle).width, 95)
  chart.update({ title: { text: longTitleOption.title.text, textStyle: { width: null, overflow: null } } })
  chart.resize(360)
  assertInsideWidth(chart.geometry().title, 360)
})

test('grid exterior only derives missing sides and never replaces authored horizontal sizes', t => {
  for (const grid of [{ left: 55 }, { left: 30, right: 12 }, { left: 30, width: 260 }]) {
    const chart = createChart(t, { ...longTitleOption, grid }, 360, 480)
    const actual = arrayOf(chart.instance.getOption().grid)[0]
    assert.equal(actual.left, grid.left)
    if ('right' in grid) assert.equal(actual.right, grid.right)
    if ('width' in grid) assert.equal(actual.width, grid.width)
    if (!('right' in grid) && !('width' in grid)) assertInsideWidth(chart.geometry().axis, 360)
  }
})

test('real ECharts rendering fixes the original overlap at three sizes without repairing its data', t => {
  const native = createChart(t, originalOption, 800, 480, false)
  assert.equal(intersects(native.geometry().title[0], native.geometry().legend[0]), true)
  for (const [width, height] of [[800, 480], [600, 360], [360, 288]]) {
    const chart = createChart(t, originalOption, width, height)
    assertHeadersClear(chart.geometry())
    assert.deepEqual(renderData(chart.instance), originalOption.series.map(series => series.data))
    assert.equal(originalOption.xAxis.data.length, 31)
    assert.equal(originalOption.series[0].data.length, 30, 'layout never fabricates the missing data point')
  }
})

const richOption: EChartsCoreOption = {
  title: {
    text: '{large|Environment\nMeasurements}', subtext: 'Primary sensors\nSample window', left: 'center',
    textStyle: { rich: { large: { fontSize: 25, lineHeight: 30 } } },
  },
  legend: {}, xAxis: { type: 'category', data: ['A', 'B', 'C'] }, yAxis: {},
  series: ['Indoor temperature', 'Outdoor temperature', 'Relative humidity', 'Average pressure'].map(name => ({
    name, type: 'line', data: [1, 4, 2],
  })),
}

test('rich multiline title/subtitle and real legend wrapping remeasure on narrow and wide resize', t => {
  const chart = createChart(t, richOption)
  assertHeadersClear(chart.geometry())
  const wideHeight = chart.geometry().legend[0].height
  const wideTop = chart.geometry().grid[0].y
  chart.resize(360)
  assertHeadersClear(chart.geometry())
  assert.ok(chart.geometry().legend[0].height > wideHeight)
  assert.ok(chart.geometry().grid[0].y > wideTop)
  chart.resize(800)
  assertHeadersClear(chart.geometry())
  assert.equal(chart.geometry().grid[0].y, wideTop, 'layout can shrink back without sticky generated anchors')
})

test('long axis names and a top category axis clear headers using measured exterior at narrow and wide sizes', t => {
  const option: EChartsCoreOption = {
    ...richOption,
    title: { text: 'Sample measurements', left: 'center' },
    xAxis: { type: 'category', data: ['First reading', 'Second reading', 'Third reading'], position: 'top', axisLabel: { rotate: 25 } },
    yAxis: { name: 'Calibrated measurement magnitude', nameGap: 23 },
  }
  const chart = createChart(t, option, 800, 480)
  for (const width of [800, 360, 600, 800]) {
    chart.resize(width)
    assertHeadersClear(chart.geometry())
    assert.deepEqual(renderData(chart.instance), arrayOf(option.series).map(series => series.data))
    assert.equal(arrayOf(chart.instance.getOption().yAxis)[0].nameGap, 23)
  }
})

test('title-only partial updates retain authored grid anchors and interaction state, while explicit clears remain effective', t => {
  const initial: EChartsCoreOption = {
    ...richOption, title: { text: 'Short', left: 'center' }, grid: { id: 'plot', top: 100 },
    dataZoom: [{ type: 'inside' }],
  }
  const native = createChart(t, initial, 600, 400, false)
  const chart = createChart(t, initial, 600, 400)
  chart.instance.dispatchAction({ type: 'legendUnSelect', name: 'Outdoor temperature' })
  chart.instance.dispatchAction({ type: 'dataZoom', start: 20, end: 70 })
  const before = chart.instance.getOption()
  const patch = { title: { text: 'one\ntwo\nthree\nfour' } }
  native.update(patch)
  chart.update(patch)
  assert.equal(arrayOf(chart.instance.getOption().grid)[0].top, 100)
  assert.deepEqual(chart.instance.getOption().grid, native.instance.getOption().grid)
  assert.deepEqual(arrayOf(chart.instance.getOption().legend)[0].selected, arrayOf(before.legend)[0].selected)
  assert.deepEqual(chart.instance.getOption().dataZoom, before.dataZoom)
  chart.update({ grid: { id: 'plot', top: null, bottom: null, height: null } })
  assertHeadersClear(chart.geometry())
  assert.notEqual(arrayOf(chart.instance.getOption().grid)[0].top, 100)
  chart.update({ grid: { id: 'plot', top: 100, height: 150 } })
  native.update({ grid: { id: 'plot', top: 100, bottom: null, height: 150 } })
  const replace = { grid: { id: 'plot', bottom: 20, height: 160 } }
  chart.update(replace)
  native.update(replace)
  assert.deepEqual(chart.instance.getOption().grid, native.instance.getOption().grid, 'native box merge clears the old top for the new bottom/height pair')
  assert.deepEqual(renderData(chart.instance), arrayOf(initial.series).map(series => series.data))
})

test('layout provenance follows component id/name matching rather than the order of partial arrays', t => {
  const initial: EChartsCoreOption = {
    ...originalOption,
    title: [{ id: 'a', name: 'Alpha', text: 'A', top: 8 }, { id: 'b', name: 'Beta', text: 'B', top: 90, right: 0 }],
    legend: { top: 130 }, grid: { id: 'plot', top: 180 },
  }
  const native = createChart(t, initial, 800, 480, false)
  const chart = createChart(t, initial)
  for (const patch of [
    { title: [{ id: 'b', text: 'B updated' }, { id: 'a', text: 'A updated' }] },
    { title: [{ name: 'Beta', text: 'Beta\nwith rows' }] },
    { title: { id: 'new', text: 'New', top: 230 } },
    { title: { name: 'Beta', bottom: 8, top: null } },
  ]) {
    chart.update(patch)
    native.update(patch)
    assert.deepEqual(chart.instance.getOption().title, native.instance.getOption().title)
    assert.deepEqual(chart.instance.getOption().grid, native.instance.getOption().grid)
  }
  assert.equal(arrayOf(chart.instance.getOption().title).length, 3, 'unmatched new ids append under normal merge')
})

test('profile toggles preserve metadata from partial native updates without replaying source data', t => {
  const chart = createChart(t, { ...originalOption, title: { text: 'Short' }, grid: { top: 100 } })
  chart.layout?.setEnabled(false)
  chart.update({ title: { text: 'one\ntwo\nthree\nfour' } })
  chart.layout?.setEnabled(true)
  chart.resize(600)
  assert.equal(arrayOf(chart.instance.getOption().grid)[0].top, 100)
  assert.deepEqual(renderData(chart.instance), originalOption.series.map(series => series.data))
})

test('explicit opposite anchors, vertical legends and authored grid dimensions remain authoritative', t => {
  const option = {
    ...originalOption,
    title: { text: 'Footer', bottom: 8, right: 12 },
    legend: { orient: 'vertical', right: 0, bottom: 40 },
    grid: { top: 37, bottom: 91, left: 52, right: 170, containLabel: true },
  }
  const native = createChart(t, option, 800, 480, false)
  const chart = createChart(t, option)
  assert.deepEqual(chart.geometry(), native.geometry())
  chart.resize(600)
  native.resize(600)
  assert.deepEqual(chart.geometry(), native.geometry())
  assert.deepEqual(chart.instance.getOption().grid, native.instance.getOption().grid)
})

test('explicit overlapping top anchors are never rewritten as defaults', t => {
  const option = { ...originalOption, title: { text: 'Author', top: 0, left: 'center' }, legend: { top: 0 }, grid: { top: 100 } }
  const chart = createChart(t, option)
  assert.equal(intersects(chart.geometry().title[0], chart.geometry().legend[0]), true)
  assert.equal(arrayOf(chart.instance.getOption().title)[0].top, 0)
  assert.equal(arrayOf(chart.instance.getOption().legend)[0].top, 0)
})

test('multiple authored grid regions and separate legends retain their mappings and anchors', t => {
  const option = {
    title: { text: 'Two plots', left: 'center' },
    legend: [{ data: ['Left'], left: 5 }, { data: ['Right'], right: 5 }],
    grid: [{ top: 80, bottom: '55%' }, { top: '60%', bottom: 25 }],
    xAxis: [{ gridIndex: 0, data: ['A', 'B'] }, { gridIndex: 1, data: ['A', 'B'] }],
    yAxis: [{ gridIndex: 0 }, { gridIndex: 1 }],
    series: [
      { name: 'Left', type: 'line', xAxisIndex: 0, yAxisIndex: 0, data: [1, 2] },
      { name: 'Right', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: [3, 4] },
    ],
  }
  const native = createChart(t, option, 800, 480, false)
  const chart = createChart(t, option)
  chart.resize(360)
  native.resize(360)
  assert.deepEqual(chart.instance.getOption().grid, native.instance.getOption().grid)
  assert.deepEqual(renderData(chart.instance), option.series.map(series => series.data))
  assert.equal(arrayOf(chart.instance.getOption().legend)[0].left, 5)
  assert.equal(arrayOf(chart.instance.getOption().legend)[1].right, 5)
})

test('overlapping same-kind components do not acquire an invented array-order layout', t => {
  const option = { ...originalOption, title: [], legend: [{ data: ['进入人次'] }, { data: ['离开人次'] }] }
  const native = createChart(t, option, 800, 480, false)
  const chart = createChart(t, option)
  assert.deepEqual(chart.geometry().legend, native.geometry().legend)
})

test('baseOption is supported while authored media branches retain native resize behavior', t => {
  assertHeadersClear(createChart(t, { baseOption: originalOption }).geometry())
  const option = {
    baseOption: originalOption,
    media: [{ query: { maxWidth: 500 }, option: { title: { bottom: 0 }, legend: { right: 0, top: 30 } } }],
  }
  const native = createChart(t, option, 800, 480, false)
  const chart = createChart(t, option)
  for (const width of [360, 800, 420]) {
    native.resize(width)
    chart.resize(width)
    assert.deepEqual(chart.geometry(), native.geometry())
  }
})

test('continuous resize preserves real legend/dataZoom actions, controls, animation and data', t => {
  const option: EChartsCoreOption = { ...richOption, animation: true, toolbox: { feature: { saveAsImage: {} } }, dataZoom: [{ type: 'inside' }] }
  const chart = createChart(t, option)
  chart.instance.dispatchAction({ type: 'legendUnSelect', name: 'Outdoor temperature' })
  chart.instance.dispatchAction({ type: 'dataZoom', start: 20, end: 70 })
  const before = chart.instance.getOption()
  for (const width of [360, 620, 800, 380, 800]) {
    chart.resize(width)
    const after = chart.instance.getOption()
    assert.deepEqual(arrayOf(after.legend)[0].selected, arrayOf(before.legend)[0].selected)
    assert.deepEqual(after.dataZoom, before.dataZoom)
    assert.deepEqual(after.toolbox, before.toolbox)
    assert.equal(after.animation, before.animation)
    assert.deepEqual(renderData(chart.instance), arrayOf(option.series).map(series => series.data))
    assertHeadersClear(chart.geometry())
  }
})

test('a new authored bottom anchor replaces prior policy fields without losing source or interaction state', t => {
  const chart = createChart(t, originalOption)
  const next = { title: { text: 'Bottom caption', bottom: 0 }, legend: { top: 10 } }
  chart.layout?.prepare(next)
  chart.instance.setOption(next)
  chart.layout?.apply()
  assert.equal(arrayOf(chart.instance.getOption().title)[0].bottom, 0)
  assert.equal(arrayOf(chart.instance.getOption().legend)[0].top, 10)
  assert.deepEqual(renderData(chart.instance), originalOption.series.map(series => series.data))
})

test('detaching the profile restores its own anchors and leaves native renderers unaffected', t => {
  const native = createChart(t, originalOption, 800, 480, false)
  const chart = createChart(t, originalOption)
  chart.layout?.dispose(true)
  assert.deepEqual(chart.geometry(), native.geometry())
  chart.instance.resize({ width: 360, height: 480 })
  native.resize(360)
  assert.deepEqual(chart.geometry(), native.geometry())
})

test('injected runtimes register once and release disposed chart observers independently', t => {
  const registrations = [0, 0]
  const runtimes = registrations.map((_, index) => ({
    graphic: echartsRuntime.graphic,
    registerPostUpdate: ((callback) => {
      registrations[index]++
      echartsRuntime.registerPostUpdate(callback)
    }) as typeof echartsRuntime.registerPostUpdate,
  }))
  for (const runtime of runtimes) {
    for (const width of [800, 360]) {
      const chart = createChart(t, longTitleOption, width, 480, false)
      const nativeGeometry = chart.geometry()
      const layout = createMeasuredEchartsLayout(chart.instance, runtime)
      layout.prepare(chart.canonical)
      chart.instance.setOption(chart.canonical)
      layout.apply()
      assertInsideWidth(chart.geometry().axis, width)
      assertHeadersClear(chart.geometry())
      layout.dispose(true)
      assert.deepEqual(chart.geometry(), nativeGeometry)
      chart.instance.resize({ width, height: 480 })
      layout.apply()
      assert.deepEqual(chart.geometry(), nativeGeometry, 'disposed observers cannot reapply policy fields')
    }
  }
  assert.deepEqual(registrations, [1, 1])
})
