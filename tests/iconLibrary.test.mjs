import assert from 'node:assert/strict'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const uiRoot = resolve(coreRoot, '..')
const require = createRequire(join(uiRoot, 'package.json'))
const { build } = require('esbuild')
const { parse, compileScript, compileStyleAsync } = require('vue/compiler-sfc')
const chromeBinary = process.env.ICON_LIBRARY_CHROME ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].find(existsSync)

test('IconLibrary uses the loaded SVG symbols throughout the selection lifecycle', { timeout: 60000 }, async t => {
  assert.ok(chromeBinary, 'Set ICON_LIBRARY_CHROME to a Chrome or Chromium executable')
  const iconSource = await readFile(join(coreRoot, 'public/icons/iconfont.js'), 'utf8')
  const expectedIds = [...new Set([...iconSource.matchAll(/<symbol\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]))]
  assert.ok(expectedIds.length > 0)
  const styles = []
  const fixture = `
    import { createApp, defineComponent, h, reactive } from 'vue'
    import { createI18n } from 'vue-i18n'
    import { Modal, Tabs, Input, Tag } from 'ant-design-vue'
    import AIcon from '@jetlinks-web/components/es/Icon/index.js'
    import ConfigProvider from '@jetlinks-web/components/es/ConfigProvider/index.js'
    import IconLibrary from './src/components/IconLibrary/index.vue'
    import zh from './src/locales/lang/zh.json'
    import en from './src/locales/lang/en.json'
    const parameters = new URLSearchParams(location.search)
    const scriptUrl = parameters.has('slow') ? '/slow-icons.js' : parameters.has('custom') ? '/custom-icons.js' : '/icons.js'
    const state = reactive({ value: '', saved: [], visible: false })
    window.iconLibraryState = state
    const i18n = createI18n({ legacy: false, locale: 'zh', messages: { zh, en } })
    window.setIconLibraryLocale = locale => { i18n.global.locale.value = locale }
    const Root = defineComponent({ setup: () => () => h(ConfigProvider, { IconConfig: { scriptUrl } }, {
      default: () => h(IconLibrary, {
        type: state.value,
        'onUpdate:type': value => { state.value = value },
        onChange: value => state.saved.push(value),
        onVisibleChange: visible => { state.visible = visible }
      })
    }) })
    const app = createApp(Root)
    app.use(i18n)
    app.component('AModal', Modal)
    app.component('ATabs', Tabs)
    app.component('ATabPane', Tabs.TabPane)
    app.component('AInputSearch', Input.Search)
    app.component('ATag', Tag)
    app.component('AIcon', AIcon)
    app.mount('#app')
  `
  const bundle = await build({
    absWorkingDir: coreRoot,
    stdin: { contents: fixture, resolveDir: coreRoot, loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser',
    define: {
      'process.env.NODE_ENV': '"production"',
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false'
    },
    plugins: [{ name: 'icon-library-vue', setup(builder) {
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor } = parse(await readFile(path, 'utf8'))
        for (const style of descriptor.styles) {
          const result = await compileStyleAsync({ source: style.content, filename: path, id: 'icon-library-test', scoped: false })
          assert.deepEqual(result.errors, [])
          styles.push(result.code)
        }
        const autoImports = path.endsWith('/IconLibrary/index.vue') ? "import { ref, watch } from 'vue'\n" : ''
        return { contents: autoImports + compileScript(descriptor, { id: 'icon-library-test', inlineTemplate: true }).content, loader: 'ts' }
      })
    } }]
  })
  const reset = await readFile(require.resolve('ant-design-vue/dist/reset.css'), 'utf8')
  const customIds = ['vendor-radar', 'powerCustom', 'custom-iconOutlined']
  const customSource = `(() => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'; svg.innerHTML = ${JSON.stringify(customIds.map(id => `<symbol id="${id}" viewBox="0 0 24 24"><path d="M2 2h20v20H2z" /></symbol>`).join(''))}; document.body.prepend(svg) })()`
  const pendingSlow = new Set()
  const releaseSlow = () => { for (const response of pendingSlow) response.end(iconSource); pendingSlow.clear() }
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname.endsWith('.js')) {
      response.setHeader('content-type', 'text/javascript')
      if (url.pathname === '/slow-icons.js') { pendingSlow.add(response); return }
      response.end(url.pathname === '/app.js' ? bundle.outputFiles[0].text : url.pathname === '/custom-icons.js' ? customSource : iconSource)
      return
    }
    response.setHeader('content-type', 'text/html')
    response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${reset}\n${styles.join('\n')}\n:root{--line:#ddd;--line-strong:#ccc;--accent:#1677ff;--accent-soft:#e6f4ff;--ink-3:#666;--space-2:8px;--space-3:12px;--space-4:16px;--fs-12:12px;--fs-22:22px;--fs-32:32px;--r-2:8px}body{padding:24px}</style></head><body>${url.searchParams.has('preloaded') ? '<script src="/icons.js"></script>' : ''}<div id="app"></div><script src="/app.js"></script></body></html>`)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => { releaseSlow(); await new Promise(resolve => server.close(resolve)) })
  const browser = await chromium.launch({ executablePath: chromeBinary, headless: true })
  t.after(() => browser.close())
  const context = await browser.newContext({ viewport: { width: 1228, height: 901 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  page.setDefaultTimeout(5000)
  const browserErrors = []
  page.on('pageerror', error => { browserErrors.push(error.message); console.error(error.stack) })
  await page.addInitScript(() => {
    window.iconLibraryObservers = new Set()
    window.iconLibraryScans = 0
    const NativeObserver = window.MutationObserver
    window.MutationObserver = class extends NativeObserver {
      observe(target, options) {
        if (options.attributeFilter?.length === 1 && options.attributeFilter[0] === 'id') window.iconLibraryObservers.add(this)
        return super.observe(target, options)
      }
      disconnect() { window.iconLibraryObservers.delete(this); return super.disconnect() }
    }
    const query = Document.prototype.querySelectorAll
    Document.prototype.querySelectorAll = function (selector) {
      if (selector === 'svg symbol[id]') window.iconLibraryScans++
      return query.call(this, selector)
    }
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const items = page.locator('.ant-tabs-tabpane-active .icon-item')
  const names = () => items.locator('.icon-name').allTextContents()
  const open = async () => {
    await page.locator('#app .container').click()
    await expect(page.locator('.ant-modal')).toBeVisible()
  }
  const load = async (query = '') => {
    await page.goto(origin + '/' + query, { waitUntil: 'domcontentloaded' })
    assert.deepEqual(browserErrors, [])
    await open()
  }
  const tab = name => page.getByRole('tab', { name, exact: true }).click()
  const customTab = async () => { await tab('iconfont'); await expect(items).toHaveCount(expectedIds.length) }
  const flush = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

  await t.test('actual resource supplies every custom icon and every preview resolves to geometry', async () => {
    await load()
    await customTab()
    assert.deepEqual(await names(), expectedIds)
    assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tabpane-active .icon-item svg')).filter(svg => { const box = svg.getBBox(); return !box.width || !box.height }).length), 0)
    await page.screenshot({ path: join(process.env.TMPDIR || '/tmp', 'icon-library-fixed.png') })
  })

  await t.test('All and iconfont share the original value, highlight, clipboard and saved result', async () => {
    await load()
    await tab('全部')
    const name = expectedIds[0]
    const item = items.filter({ has: page.getByText(name, { exact: true }) })
    await item.click()
    assert.equal(await item.locator('use').getAttribute('xlink:href'), '#' + name)
    await expect(item).toHaveClass(/active/)
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(name)
    await customTab()
    await expect(items.filter({ has: page.getByText(name, { exact: true }) })).toHaveClass(/active/)
    await page.locator('.ant-modal-footer .ant-btn-primary').click()
    await expect.poll(() => page.evaluate(() => iconLibraryState.value)).toBe(name)
    assert.deepEqual(await page.evaluate(() => Array.from(iconLibraryState.saved)), [name])
    await expect.poll(() => page.evaluate(() => iconLibraryObservers.size)).toBe(0)
  })

  await t.test('Ant Design icons retain their theme suffix and category labels react to locale', async () => {
    await load()
    await page.evaluate(() => setIconLibraryLocale('en'))
    await tab('Direction')
    await items.filter({ has: page.getByText('StepBackward', { exact: true }) }).click()
    await page.locator('.ant-modal-footer .ant-btn-primary').click()
    await expect.poll(() => page.evaluate(() => iconLibraryState.value)).toBe('StepBackwardOutlined')
  })

  await t.test('symbol injection, deduplication, ID changes and sprite removal update the open modal', async () => {
    await load()
    await customTab()
    await page.evaluate(existing => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.id = 'test-sprite'
      svg.innerHTML = `<symbol id="${existing}" /><symbol id="vendor-glyph" /><symbol />`
      document.body.append(svg)
    }, expectedIds[0])
    await expect(items).toHaveCount(expectedIds.length + 1)
    await page.evaluate(() => { document.querySelector('#test-sprite symbol:last-child').id = 'new-glyph'; document.querySelector('#vendor-glyph').id = 'renamed-glyph' })
    await expect(items).toHaveCount(expectedIds.length + 2)
    assert.ok((await names()).includes('renamed-glyph'))
    assert.ok(!(await names()).includes('vendor-glyph'))
    await page.locator('.toolbar input').fill('RENAMED-GLYPH')
    await expect(items).toHaveCount(1)
    assert.deepEqual(await names(), ['renamed-glyph'])
    await page.locator('.toolbar input').fill('')
    await page.evaluate(() => document.querySelector('#test-sprite').remove())
    await expect(items).toHaveCount(expectedIds.length)
  })

  await t.test('ordinary DOM updates and category searches do not rescan symbols', async () => {
    await load()
    await customTab()
    await flush()
    const scans = await page.evaluate(() => iconLibraryScans)
    await page.evaluate(() => { const div = document.createElement('div'); div.id = 'ordinary'; document.body.append(div); div.id = 'renamed'; div.textContent = 'unrelated'; div.remove() })
    await page.locator('.toolbar input').fill(expectedIds[0])
    await tab('全部')
    await flush()
    assert.equal(await page.evaluate(() => iconLibraryScans), scans)
  })

  await t.test('late script loading populates an initially empty custom category', async () => {
    await load('?slow')
    await expect.poll(() => pendingSlow.size).toBe(1)
    await tab('iconfont')
    await expect(items).toHaveCount(0)
    releaseSlow()
    await expect(items).toHaveCount(expectedIds.length)
    assert.deepEqual(await names(), expectedIds)
  })

  await t.test('a sprite loaded before the modal is discovered and remains deduplicated', async () => {
    await load('?preloaded')
    await customTab()
    assert.deepEqual(await names(), expectedIds)
  })

  await t.test('configured scripts accept arbitrary prefixes and preserve IDs ending in Outlined', async () => {
    await load('?custom')
    await tab('iconfont')
    await expect(items).toHaveCount(customIds.length)
    assert.deepEqual(await names(), customIds)
    await tab('全部')
    await items.filter({ has: page.getByText(customIds[2], { exact: true }) }).click()
    await page.locator('.ant-modal-footer .ant-btn-primary').click()
    await expect.poll(() => page.evaluate(() => iconLibraryState.value)).toBe(customIds[2])
  })

  await t.test('closing releases the observer and reopening discovers resources added while closed', async () => {
    await load()
    await customTab()
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal(await page.evaluate(() => iconLibraryObservers.size), 1)
      await page.locator('.ant-modal-close').click()
      await expect.poll(() => page.evaluate(() => iconLibraryObservers.size)).toBe(0)
      await open()
    }
    await page.locator('.ant-modal-close').click()
    await expect.poll(() => page.evaluate(() => iconLibraryObservers.size)).toBe(0)
    await page.evaluate(() => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.innerHTML = '<symbol id="added-while-closed" />'; document.body.prepend(svg) })
    await open()
    await tab('iconfont')
    await expect(items).toHaveCount(expectedIds.length + 1)
  })

  assert.deepEqual(browserErrors, [])
})
