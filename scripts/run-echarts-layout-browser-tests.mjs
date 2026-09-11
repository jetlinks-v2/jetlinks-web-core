import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript, compileStyle } from 'vue/compiler-sfc'
import { chromium } from 'playwright'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = await mkdtemp(path.join(tmpdir(), 'jetlinks-echarts-canvas-tests-'))
const artifactDirectory = process.env.ECHARTS_LAYOUT_ARTIFACT_DIR || path.join(packageRoot, 'output/playwright/echarts-layout')
await mkdir(artifactDirectory, { recursive: true })
let browser
const report = { renderer: 'real browser Canvas / Vue SFC / ResizeObserver', scenarios: [], errors: [] }
try {
  await build({
    entryPoints: [path.join(packageRoot, 'tests/echartsLayout.browser.ts')],
    outfile: path.join(outputDirectory, 'harness.js'), bundle: true, platform: 'browser', format: 'iife', target: 'chrome120',
    alias: { '@jetlinks-web-core': path.join(packageRoot, 'src') },
    define: { __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
    plugins: [{
      name: 'local-vue-sfc',
      setup(buildApi) {
        buildApi.onLoad({ filter: /\.vue$/ }, async ({ path: filename }) => {
          const { descriptor } = parse(await readFile(filename, 'utf8'), { filename })
          const script = compileScript(descriptor, { id: 'echarts-layout-harness', inlineTemplate: true, genDefaultAs: '__component' })
          const styles = descriptor.styles.map(style => {
            const result = compileStyle({ filename, source: style.content, id: 'echarts-layout-harness', scoped: false })
            if (result.errors.length) throw result.errors[0]
            return result.code
          }).join('\n')
          return {
            contents: `${script.content}\nconst style = document.createElement('style'); style.textContent = ${JSON.stringify(styles)}; document.head.append(style);\nexport default __component;`,
            loader: 'ts', resolveDir: path.dirname(filename),
          }
        })
      },
    }],
    logLevel: 'warning',
  })
  await writeFile(path.join(outputDirectory, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:16px;background:white}</style></head><body><div id="host"></div><script src="./harness.js"></script></body></html>')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => report.errors.push(String(error)))
  await page.goto(pathToFileURL(path.join(outputDirectory, 'index.html')).href)
  await page.waitForFunction(() => !!window.echartsLayoutHarness)
  const original = JSON.parse(await readFile(path.join(packageRoot, 'tests/fixtures/echarts-monthly-option.json'), 'utf8'))
  const latest = JSON.parse(await readFile(path.join(packageRoot, 'tests/fixtures/echarts-long-title-option.json'), 'utf8'))
  const snapshot = () => page.evaluate(() => window.echartsLayoutHarness.snapshot())
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
  const verify = async (name, clearHeaders = true) => {
    // Layout measurement reports target geometry; capture pixels only after the preserved renderer animation ends.
    await page.waitForFunction(() => window.echartsLayoutHarness.snapshot().animationFinished)
    const state = await snapshot()
    assert.deepEqual(state.errors, [])
    assert.equal(state.canonicalUnchanged, true)
    if (clearHeaders) {
      for (const title of state.geometry.title) for (const legend of state.geometry.legend) assert.equal(overlap(title, legend), false, name)
      for (const grid of state.geometry.grid) for (const header of [...state.geometry.title, ...state.geometry.legend]) {
        assert.ok(grid.y >= header.y + header.height, name)
      }
      for (const axis of state.geometry.axis) for (const header of [...state.geometry.title, ...state.geometry.legend]) {
        assert.equal(overlap(axis, header), false, `${name}: axis exterior/header overlap`)
      }
    }
    report.scenarios.push({ name, width: state.width, height: state.height, geometry: state.geometry, canonicalUnchanged: state.canonicalUnchanged })
    return state
  }
  const resize = async (width, height) => {
    await page.evaluate(({ width, height }) => window.echartsLayoutHarness.resize(width, height), { width, height })
    await page.waitForFunction(({ width, height }) => {
      const state = window.echartsLayoutHarness.snapshot()
      return state.width === width && state.height === height && state.domWidth === width
    }, { width, height })
  }
  const insideWidth = (rects, width, name) => {
    for (const rect of rects) assert.ok(rect.x >= -0.5 && rect.x + rect.width <= width + 0.5, `${name}: ${rect.x}..${rect.x + rect.width} exceeds ${width}`)
  }
  const characters = text => text.replace(/\{[^|}]+\|([^}]*)\}/g, '$1').replace(/\s/g, '')
  const completeTitle = (state, texts) => {
    for (const expected of texts) assert.ok(state.geometry.renderedTitleText.some(text => characters(text) === characters(expected)), 'all title/subtitle glyphs remain after layout')
  }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 800, 480), latest)
  const latestWide = await verify('latest-title-wide')
  for (const width of [360, 600, 800, 360, 800]) {
    await resize(width, 480)
    const state = await verify(`latest-title-resize-${width}`)
    insideWidth([...state.geometry.title, ...state.geometry.axis], width, 'latest canonical title/axis')
    completeTitle(state, [latest.title.text])
    assert.ok(state.geometry.renderedAxisText.includes(latest.xAxis.name))
    assert.deepEqual(state.option.series.map(series => series.data), latest.series.map(series => series.data))
    assert.equal(state.option.title[0].text, latest.title.text)
    if (width === 360) {
      assert.ok(state.geometry.title[0].height > latestWide.geometry.title[0].height)
      await page.locator('#host').screenshot({ path: path.join(artifactDirectory, 'latest-title-360.png') })
    }
    if (width === 800) assert.equal(state.geometry.title[0].height, latestWide.geometry.title[0].height)
  }
  const multilingual = { ...latest, title: {
    text: '{heading|Anonymous calibrated measurements over a changing observation window}\n匿名观测范围与测量指标的完整说明',
    subtext: 'Supplementary observations from independent sensors and sampling windows', left: 'center', padding: [8, 14, 10, 18],
    textStyle: { rich: { heading: { fontSize: 23, lineHeight: 31 } } }, subtextStyle: { lineHeight: 19 },
  }, dataZoom: [{ type: 'inside' }] }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 800, 600), multilingual)
  await page.evaluate(name => window.echartsLayoutHarness.interact(name), latest.series[0].name)
  const multilingualInteraction = await snapshot()
  for (const width of [360, 800]) {
    await resize(width, 600)
    const state = await verify(`multilingual-title-${width}`)
    insideWidth(state.geometry.title, width, 'multilingual title/subtitle')
    completeTitle(state, [multilingual.title.text, multilingual.title.subtext])
    assert.deepEqual(state.option.title[0].textStyle.rich, multilingual.title.textStyle.rich)
    assert.equal(state.option.title[0].subtextStyle.lineHeight, 19)
    assert.deepEqual(state.option.legend[0].selected, multilingualInteraction.option.legend[0].selected)
    assert.deepEqual(state.option.dataZoom, multilingualInteraction.option.dataZoom)
    if (width === 360) await page.locator('#host').screenshot({ path: path.join(artifactDirectory, 'multilingual-title-360.png') })
  }
  const explicitText = { ...latest, title: { text: 'Authored width and overflow are deliberate choices', left: 27, right: 19, padding: [4, 8],
    textStyle: { width: 130, overflow: 'truncate', lineHeight: 29 }, subtext: 'An authored subtitle', subtextStyle: { width: 95, overflow: 'break' } } }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'native', 360, 480), explicitText)
  await page.evaluate(() => window.echartsLayoutHarness.update({ title: { text: 'An updated authored title', textStyle: { color: 'blue' } } }))
  const nativeExplicit = await verify('explicit-title-native-anchor-baseline', false)
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 360, 480), explicitText)
  await page.evaluate(() => window.echartsLayoutHarness.update({ title: { text: 'An updated authored title', textStyle: { color: 'blue' } } }))
  await resize(800, 480)
  const explicitState = await verify('explicit-title-width-and-anchors')
  assert.equal(explicitState.option.title[0].textStyle.width, 130)
  assert.equal(explicitState.option.title[0].textStyle.overflow, 'truncate')
  assert.equal(explicitState.option.title[0].textStyle.lineHeight, 29)
  assert.equal(explicitState.option.title[0].subtextStyle.width, 95)
  assert.equal(explicitState.option.title[0].left, 27)
  assert.equal(explicitState.option.title[0].right, nativeExplicit.option.title[0].right)
  assert.deepEqual(explicitState.option.title[0].padding, [4, 8])
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'native', 800, 480), original)
  const native = await verify('original-native', false)
  assert.equal(overlap(native.geometry.title[0], native.geometry.legend[0]), true)
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 800, 480), original)
  for (const [width, height] of [[800, 480], [600, 360], [360, 288]]) {
    await resize(width, height)
    const state = await verify(`original-presentation-${width}`)
    assert.deepEqual(state.option.series.map(series => series.data), original.series.map(series => series.data))
    await page.locator('#host').screenshot({ path: path.join(artifactDirectory, `original-${width}.png`) })
  }
  const rich = {
    title: { text: '{large|Environment\nMeasurements}', subtext: 'Primary sensors\nSample window', left: 'center', textStyle: { rich: { large: { fontSize: 25, lineHeight: 30 } } } },
    legend: {}, xAxis: { type: 'category', data: ['A', 'B', 'C'] }, yAxis: {},
    series: ['Indoor temperature', 'Outdoor temperature', 'Relative humidity', 'Average pressure'].map(name => ({ name, type: 'line', data: [1, 4, 2] })),
    animation: true, toolbox: { feature: { saveAsImage: {} } }, dataZoom: [{ type: 'inside' }],
  }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 800, 480), rich)
  const wide = await verify('rich-wide')
  await page.evaluate(() => window.echartsLayoutHarness.interact('Outdoor temperature'))
  const interacted = await snapshot()
  for (const width of [360, 620, 800, 380, 800]) {
    await resize(width, 480)
    const state = await verify(`rich-interaction-resize-${width}`)
    assert.deepEqual(state.option.legend[0].selected, interacted.option.legend[0].selected)
    assert.deepEqual(state.option.dataZoom, interacted.option.dataZoom)
    assert.deepEqual(state.option.toolbox, interacted.option.toolbox)
    assert.equal(state.option.animation, true)
    assert.deepEqual(state.option.series.map(series => series.data), rich.series.map(series => series.data))
    if (width === 360) {
      assert.ok(state.geometry.legend[0].height > wide.geometry.legend[0].height)
      await page.locator('#host').screenshot({ path: path.join(artifactDirectory, 'rich-360.png') })
    }
  }
  await page.evaluate(() => window.echartsLayoutHarness.profile('native'))
  const disabled = await verify('profile-disabled', false)
  assert.deepEqual(disabled.option.legend[0].selected, interacted.option.legend[0].selected)
  assert.deepEqual(disabled.option.dataZoom, interacted.option.dataZoom)
  await page.evaluate(() => window.echartsLayoutHarness.profile('presentation'))
  await verify('profile-reenabled')
  const axisOption = {
    ...rich, title: { text: 'Sample measurements', left: 'center' },
    xAxis: { type: 'category', data: ['First reading', 'Second reading', 'Third reading'], position: 'top', axisLabel: { rotate: 25 } },
    yAxis: { name: 'Calibrated measurement magnitude', nameGap: 23 },
  }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 800, 480), axisOption)
  for (const width of [800, 360, 600, 800]) {
    await resize(width, 480)
    const state = await verify(`axis-exterior-${width}`)
    assert.equal(state.option.yAxis[0].nameGap, 23)
    assert.deepEqual(state.option.series.map(series => series.data), axisOption.series.map(series => series.data))
    if (width === 360) await page.locator('#host').screenshot({ path: path.join(artifactDirectory, 'axis-exterior-360.png') })
  }
  const regionOption = {
    title: { text: 'Calibration observations across independent measurement windows' }, legend: {},
    xAxis: { type: 'category', data: ['A', 'B', 'C'], name: 'Observation time' },
    yAxis: { type: 'value', name: 'Magnitude' },
    series: [{ name: 'Measured', type: 'line', data: [23, 58, 32] }, { name: 'Reference', type: 'line', data: [20, 50, 30] }],
  }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 800, 480), regionOption)
  for (const width of [800, 360, 800]) {
    await resize(width, 480)
    const state = await verify(`measured-header-region-${width}`)
    completeTitle(state, [regionOption.title.text])
    if (width === 360) await page.locator('#host').screenshot({ path: path.join(artifactDirectory, 'measured-header-region-360.png') })
  }
  const anchored = { ...rich, title: { text: 'Short', left: 'center' }, grid: { id: 'plot', top: 100 } }
  const partial = { title: { text: 'one\ntwo\nthree\nfour' } }
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'native', 600, 400), anchored)
  await page.evaluate(option => window.echartsLayoutHarness.update(option), partial)
  const nativePartial = await verify('partial-native-explicit-grid', false)
  await page.evaluate(option => window.echartsLayoutHarness.mount(option, 'presentation', 600, 400), anchored)
  await page.evaluate(() => window.echartsLayoutHarness.interact('Outdoor temperature'))
  const anchoredInteraction = await snapshot()
  await page.evaluate(option => window.echartsLayoutHarness.update(option), partial)
  const anchoredPartial = await verify('partial-presentation-explicit-grid', false)
  assert.equal(anchoredPartial.option.grid[0].top, 100)
  assert.deepEqual(anchoredPartial.option.grid, nativePartial.option.grid)
  assert.deepEqual(anchoredPartial.option.legend[0].selected, anchoredInteraction.option.legend[0].selected)
  assert.deepEqual(anchoredPartial.option.dataZoom, anchoredInteraction.option.dataZoom)
  await page.locator('#host').screenshot({ path: path.join(artifactDirectory, 'partial-explicit-grid.png') })
  await page.evaluate(() => window.echartsLayoutHarness.profile('native'))
  await page.evaluate(() => window.echartsLayoutHarness.update({ title: { text: 'one\ntwo\nthree\nfour\nfive' } }))
  await page.evaluate(() => window.echartsLayoutHarness.profile('presentation'))
  const toggled = await verify('partial-profile-native-then-presentation', false)
  assert.equal(toggled.option.grid[0].top, 100)
  assert.deepEqual(toggled.option.dataZoom, anchoredInteraction.option.dataZoom)
  await page.evaluate(() => window.echartsLayoutHarness.update({ grid: { id: 'plot', top: null, bottom: null, height: null } }))
  const cleared = await verify('partial-explicit-anchor-clear')
  assert.notEqual(cleared.option.grid[0].top, 100)
  assert.deepEqual(cleared.option.series.map(series => series.data), anchored.series.map(series => series.data))
  await page.evaluate(() => window.echartsLayoutHarness.update({ grid: { id: 'plot', top: 100, height: 150 } }))
  await page.evaluate(() => window.echartsLayoutHarness.update({ grid: { id: 'plot', bottom: 20, height: 160 } }))
  const replaced = await verify('partial-opposite-anchor-replacement', false)
  assert.equal(replaced.option.grid[0].top, undefined)
  assert.equal(replaced.option.grid[0].bottom, 20)
  assert.equal(replaced.option.grid[0].height, 160)
  assert.equal(await page.evaluate(() => window.echartsLayoutHarness.unmount()), true)
  assert.deepEqual(report.errors, [])
  report.status = 'PASS'
  report.scenarioCount = report.scenarios.length
  console.log(JSON.stringify({ status: report.status, scenarioCount: report.scenarioCount, artifactDirectory }))
} catch (error) {
  report.status = 'FAIL'
  report.failure = String(error?.stack || error)
  throw error
} finally {
  await writeFile(path.join(artifactDirectory, 'canvas-report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  await rm(outputDirectory, { recursive: true, force: true })
}
