import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createReadStream, existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { compileScript, compileStyleAsync, parse } from 'vue/compiler-sfc'

const { chromium, firefox } = await import(process.env.PAGE_TRANSLATION_PLAYWRIGHT_MODULE || 'playwright')
const native = process.argv.includes('--native')
const local = process.argv.includes('--firefox')
const initialLocale = native ? 'en' : 'zh'
const chrome = process.env.PAGE_TRANSLATION_CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync)
if (!local) assert.ok(chrome, 'Set PAGE_TRANSLATION_CHROME to a desktop Chrome executable')

const root = fileURLToPath(new URL('..', import.meta.url))
const pack = JSON.parse(await readFile(new URL('../src/locales/translation/local/pack.json', import.meta.url), 'utf8'))
const styles = []
const { outputFiles } = await build({
  entryPoints: [join(root, 'tests/pageTranslation.ui.ts')],
  bundle: true, format: 'iife', platform: 'browser', write: false,
  alias: { '@jetlinks-web-core': join(root, 'src') },
  define: { 'import.meta.env': '{}', 'import.meta.url': 'location.href', 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false' },
  plugins: [{ name: 'page-translation-fixture', setup(builder) {
    builder.onResolve({ filter: /^(@jetlinks-web-core\/store|@jetlinks-web\/utils)$/ }, ({ path }) => ({ path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
      resolveDir: root,
      contents: path.endsWith('/store')
        ? 'import { reactive } from "vue"; const state=reactive({language: localStorage.getItem("Accept-Language") || "zh"}); export const useSystemStore=()=>state;'
        : 'export const LocalStore={ set(key, value) { localStorage.setItem(key, value) } };',
    }))
    builder.onLoad({ filter: /\.vue$/ }, async ({ path: filename }) => {
      const { descriptor, errors } = parse(await readFile(filename, 'utf8'), { filename })
      assert.deepEqual(errors, [])
      const id = 'data-v-page-translation-browser'
      for (const style of descriptor.styles) {
        const result = await compileStyleAsync({ filename, source: style.content, id, scoped: false, preprocessLang: style.lang })
        assert.deepEqual(result.errors, [])
        styles.push(result.code)
      }
      return { contents: compileScript(descriptor, { id, inlineTemplate: true }).content, resolveDir: dirname(filename), loader: 'ts' }
    })
  } }],
})

const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><style>
:root{--space-1:4px;--space-2:8px;--r-2:4px;--ink-1:#20252b;--fs-14:14px;--fs-12:12px}body{font-family:system-ui}
${styles.join('\n')}
</style><body><div id="app"></div><script defer src="/fixture.js"></script></body></html>`
const workerCode = local && (process.env.PAGE_TRANSLATION_WORKER_PATH
  ? await readFile(process.env.PAGE_TRANSLATION_WORKER_PATH)
  : (await build({
    entryPoints: [join(root, 'src/locales/translation/local/translator.worker.ts')],
    bundle: true, format: 'esm', platform: 'browser', write: false,
  })).outputFiles[0].contents)
const modelRequests = []
const assetsRoot = join(root, 'public/local-translation')
let serveLocalPack = false
const server = createServer(async (request, response) => {
  if (local && request.url === '/translator.worker.ts') {
    response.setHeader('Content-Type', 'text/javascript')
    response.end(workerCode)
    return
  }
  if (local && serveLocalPack && request.url?.startsWith('/local-translation/')) {
    const asset = resolve(assetsRoot, request.url.slice('/local-translation/'.length))
    const info = asset.startsWith(`${assetsRoot}/`) && await stat(asset).catch(() => undefined)
    if (!info?.isFile()) { response.writeHead(404).end(); return }
    modelRequests.push(request.url)
    response.setHeader('Content-Length', info.size)
    response.setHeader('Content-Type', asset.endsWith('.json') ? 'application/json' : 'application/octet-stream')
    createReadStream(asset).pipe(response)
    return
  }
  const isScript = request.url === '/fixture.js'
  response.setHeader('Content-Type', isScript ? 'text/javascript' : 'text/html; charset=utf-8')
  response.end(isScript ? outputFiles[0].contents : html)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const url = `http://localhost:${server.address().port}/`
const profile = await mkdtemp(join(tmpdir(), 'jetlinks-native-translation-'))
let context
try {
  context = await (local ? firefox : chromium).launchPersistentContext(profile, {
    executablePath: local ? undefined : chrome, headless: true, locale: 'zh-CN', viewport: { width: 1050, height: 720 },
    ignoreDefaultArgs: native ? ['--disable-background-networking', '--disable-component-update'] : undefined,
  })
  const page = context.pages()[0] || await context.newPage()
  const errors = []
  const external = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (!request.url().startsWith(url)) external.push(request.url()) })
  await context.addInitScript(({ useNative, useLocal, initialLocale }) => {
    if (!localStorage.getItem('Accept-Language')) localStorage.setItem('Accept-Language', initialLocale)
    if (!localStorage.getItem('editor-language')) localStorage.setItem('editor-language', initialLocale)
    if (useLocal) {
      window.workerErrors = []
      const BrowserWorker = window.Worker
      window.Worker = class extends BrowserWorker {
        constructor(...args) {
          super(...args)
          this.addEventListener('message', event => {
            if (event.data.error) window.workerErrors.push(event.data.error)
          })
        }
      }
      return
    }
    if (useNative) {
      const create = window.Translator?.create.bind(window.Translator)
      if (!create) return
      window.nativeTranslationCalls = []
      window.Translator.create = options => {
        const call = {
          sourceLanguage: options.sourceLanguage, targetLanguage: options.targetLanguage,
          gesture: navigator.userActivation.isActive, progress: null, result: 'pending',
        }
        window.nativeTranslationCalls.push(call)
        const promise = create({
          ...options,
          monitor: options.monitor && (monitor => {
            options.monitor(monitor)
            monitor.addEventListener('downloadprogress', event => {
              call.progress = Math.round(event.loaded / event.total * 100)
            })
          }),
        })
        promise.then(() => { call.result = 'ready' }, error => { call.result = `${error.name} ${error.message}` })
        return promise
      }
      return
    }
    window.translationCalls = { inspections: [], creates: [], translates: [] }
    let usedActivation = false
    document.addEventListener('click', () => { usedActivation = false }, true)
    const key = ({ sourceLanguage, targetLanguage }) => `fixture:${sourceLanguage}:${targetLanguage}`
    const api = {
      async availability(pair) {
        window.translationCalls.inspections.push(pair)
        if (sessionStorage.getItem('fixture:unsupported')) return 'unavailable'
        return sessionStorage.getItem(key(pair)) ? 'available' : 'downloadable'
      },
      async create(options) {
        const { monitor, sourceLanguage, targetLanguage } = options
        const pair = key(options)
        window.translationCalls.creates.push({ sourceLanguage, targetLanguage, explicit: !!monitor, gesture: navigator.userActivation.isActive })
        if (sessionStorage.getItem('fixture:unsupported')) throw new DOMException('test unsupported pair', 'NotSupportedError')
        if (!sessionStorage.getItem(pair)) {
          if (!monitor || !navigator.userActivation.isActive || usedActivation) throw new DOMException('user gesture required', 'NotAllowedError')
          usedActivation = true
          const events = new EventTarget()
          monitor(events)
          events.dispatchEvent(new ProgressEvent('downloadprogress', { loaded: 37, total: 100 }))
          await new Promise(resolve => setTimeout(resolve, 500))
          if (sessionStorage.getItem(`${pair}:fail`)) {
            sessionStorage.removeItem(`${pair}:fail`)
            throw new DOMException('test download failure', 'NetworkError')
          }
          sessionStorage.setItem(pair, '1')
        }
        return {
          // 迟到的替身故意不理会 abort，测的是应用也会保护新节点和新文本。
          async translate(text) {
            window.translationCalls.translates.push({ sourceLanguage, targetLanguage, text })
            await new Promise(resolve => setTimeout(resolve, text === '旧设备文本' ? 600 : 15))
            if (targetLanguage === 'ko') return `번역: ${text}`
            if (targetLanguage === 'zh-Hant') return `譯: ${text}`
            return `${sourceLanguage} → ${targetLanguage}: ${text}`
          },
          destroy() {},
        }
      },
    }
    Object.defineProperty(window, 'Translator', { value: api })
  }, { useNative: native, useLocal: local, initialLocale })

  await page.goto(url)
  const menu = page.locator('button.language-switch')
  const korean = page.getByRole('button', { name: '한국어', exact: true })
  const koreanRow = page.locator('.language-switch__row').filter({ has: korean })
  const traditional = page.getByRole('button', { name: '繁體中文', exact: true })
  const traditionalDownload = page.locator('.language-switch__row').filter({ has: traditional }).locator('.language-switch__model-button')
  const download = koreanRow.locator('.language-switch__model-button')
  const heading = page.locator('#heading')
  const review = page.locator('#review')
  const reviewText = '复判目标：车辆违停检测。图片中未见任何车辆。'
  const open = async () => {
    if (await menu.getAttribute('aria-expanded') !== 'true') await menu.click()
    await korean.waitFor()
  }
  async function waitText(selector, value) {
    try {
      await page.waitForFunction(([css, text]) => document.querySelector(css)?.textContent === text, [selector, value], { timeout: 6000 })
    } catch (error) {
      console.error(await page.evaluate(css => ({
        target: localStorage.getItem('jetlinks.page-translation.language'), y: scrollY, viewport: innerHeight,
        actual: document.querySelector(css)?.textContent, rect: document.querySelector(css)?.getBoundingClientRect().toJSON(),
        calls: window.translationCalls,
      }), selector), errors)
      throw error
    }
  }
  const waitModel = (text, timeout) => koreanRow.getByRole('button', { name: text }).waitFor({ timeout })
  const waitReview = async text => {
    await waitText('#review', text)
    await page.waitForFunction(value => document.querySelector('#review')?.title === value, text)
  }
  const waitPagerLabel = title => page.waitForFunction(
    expected => document.querySelector('#pagination .ant-pagination-next')?.getAttribute('title') === expected, title,
  )
  const assertKoreanDirection = async source => {
    const { inspections, creates, translates } = await page.evaluate(() => window.translationCalls)
    assert.ok([...inspections, ...creates].some(call => call.sourceLanguage === source && call.targetLanguage === 'ko'))
    assert.ok(translates.some(call => call.sourceLanguage === source && call.targetLanguage === 'ko'))
  }
  // Playwright 可能把绝对定位的弹层滚入视口；断言前把被测标题明确放回可见区。
  const revealHeading = () => page.evaluate(() => window.scrollTo(0, 0))
  await open()
  assert.deepEqual(await page.evaluate(() => window.fixtureLocales()), ['en', 'ja', 'zh'])
  const currentOption = page.locator('.language-switch__option[aria-current="true"]')
  assert.equal(await currentOption.textContent(), native ? 'English' : '中文')
  assert.equal(await currentOption.locator('svg').count(), 0)
  if (local) {
    // 缺失的静态清单与开发站点相同，返回页面 HTML。重新打开菜单应识别补齐的模型。
    await waitModel('站点的 中文 → 한국어 翻译模型暂不可用')
    assert.equal(await download.isDisabled(), true)
    serveLocalPack = true
    await menu.click()
    await open()
  }
  await waitModel(native ? 'Download the English → 한국어 language pack' : '下载 中文 → 한국어 语言包')
  assert.equal(await korean.isDisabled(), true)
  assert.equal(await heading.textContent(), native ? 'Device management' : '设备管理')

  if (local) {
    assert.equal(await page.evaluate(() => typeof window.Translator), 'undefined')
    const downloadedAssets = () => modelRequests.filter(path => !path.endsWith('/pack.json'))
    assert.deepEqual(downloadedAssets(), [])
    const waitLocalReview = async expression => {
      try {
        await page.waitForFunction(({ pattern, flags, original }) => {
          const element = document.querySelector('#review')
          return element && element.textContent !== original && element.title === element.textContent
            && new RegExp(pattern, flags).test(element.textContent)
        }, { pattern: expression.source, flags: expression.flags, original: reviewText }, { timeout: 180_000 })
      } catch (error) {
        console.error(await page.evaluate(() => ({
          errors: window.workerErrors,
          review: document.querySelector('#review')?.textContent,
          labels: [...document.querySelectorAll('.language-switch__model [aria-label]')].map(element => element.getAttribute('aria-label')),
        })))
        throw error
      }
    }
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await waitText('#heading', 'Device management')
    await waitLocalReview(/\b(?:vehicle|car|parking)\b/i)
    assert.equal(await page.locator('#gateway').textContent(), '测试网关')
    assert.equal(await page.locator('#gateway').getAttribute('title'), '测试网关')
    const englishReview = await review.textContent()
    assert.equal(downloadedAssets().length, pack.modelFiles.length + pack.runtimeFiles.length)
    await open()
    await page.getByRole('button', { name: '日本語', exact: true }).click()
    await waitText('#heading', '機器管理')
    await waitLocalReview(/[\p{Script=Hiragana}\p{Script=Katakana}]/u)
    const japaneseReview = await review.textContent()
    assert.equal(downloadedAssets().length, pack.modelFiles.length + pack.runtimeFiles.length)
    await open()
    await page.getByRole('button', { name: '中文', exact: true }).click()
    await waitReview(reviewText)
    await open()
    await waitModel('中文 → 한국어 语言包已就绪')
    await korean.click()
    await revealHeading()
    const waitKoreanHeading = () => page.waitForFunction(() => /[가-힣]/.test(
      document.querySelector('#heading')?.textContent ?? '',
    ), undefined, { timeout: 60_000 })
    await waitKoreanHeading()
    const translatedFromChinese = await heading.textContent()
    await open()
    await page.getByRole('button', { name: '日本語', exact: true }).click()
    await waitText('#heading', '機器管理')
    await open()
    await waitModel('日本語 → 한국어の言語パックを使用できます')
    await korean.click()
    await revealHeading()
    await waitKoreanHeading()
    const koreanHeading = await heading.textContent()
    await page.waitForFunction(() => /[가-힣]/.test(document.querySelector('#access-menu')?.textContent ?? ''), undefined, { timeout: 60_000 })
    await open()
    await traditionalDownload.waitFor()
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.language-switch__model-button'))
      .some(button => button.getAttribute('aria-label')?.includes('한국어 → 繁體中文') && button.disabled))
    await traditional.click()
    await revealHeading()
    await page.waitForFunction(() => {
      const text = document.querySelector('#heading')?.textContent ?? ''
      return /[\u4e00-\u9fff]/.test(text) && !/[가-힣]/.test(text) && text !== '機器管理'
    }, undefined, { timeout: 60_000 })
    const traditionalHeading = await heading.textContent()
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('jetlinks.page-translation.language'))), ['ja', 'ko', 'zh-Hant'])
    const downloaded = modelRequests.length
    await page.route('**/local-translation/**', route => route.abort())
    await page.reload()
    await revealHeading()
    await page.waitForFunction(text => document.querySelector('#heading')?.textContent === text, traditionalHeading, { timeout: 60_000 })
    assert.equal(modelRequests.length, downloaded)
    await open()
    await page.getByRole('button', { name: '日本語', exact: true }).click()
    await waitText('#heading', '機器管理')
    await open()
    await page.getByRole('button', { name: '中文', exact: true }).click()
    await waitReview(reviewText)
    assert.equal(modelRequests.length, downloaded)
    console.log(`Firefox 英日自动下载和共用缓存通过。复判译文为 ${englishReview} / ${japaneseReview}`)
    console.log(`Firefox 连续翻译通过。设备管理 → ${translatedFromChinese}，機器管理 → ${koreanHeading} → ${traditionalHeading}，刷新后复用缓存`)
  } else if (native) {
    assert.ok(await page.evaluate(() => typeof Translator === 'function' && isSecureContext))
    await download.click()
    const readyLabel = 'The English → 한국어 language pack is ready'
    const terminalLabels = [readyLabel, 'Could not download the English → 한국어 language pack', 'cannot translate to English → 한국어']
    try {
      const outcome = await Promise.race(terminalLabels.map(async label => {
        await waitModel(label, 185_000)
        return label
      }))
      assert.equal(outcome, readyLabel)
    } catch (error) {
      console.error(await page.evaluate(async () => ({
        open: document.querySelector('.language-switch')?.getAttribute('aria-expanded'),
        labels: Array.from(document.querySelectorAll('.language-switch__model-button'), element => element.getAttribute('aria-label')),
        availability: await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ko' }),
        calls: window.nativeTranslationCalls,
      })))
      throw error
    }
    assert.equal(await heading.textContent(), 'Device management')
    assert.deepEqual(await page.evaluate(() => window.nativeTranslationCalls.map(({ sourceLanguage, targetLanguage }) => ({ sourceLanguage, targetLanguage }))), [
      { sourceLanguage: 'en', targetLanguage: 'ko' },
    ])
    await korean.click()
    await revealHeading()
    try {
      await page.waitForFunction(() => /[가-힣]/.test(document.querySelector('#heading')?.textContent || ''))
    } catch (error) {
      console.error(await page.evaluate(async () => ({
        target: localStorage.getItem('jetlinks.page-translation.language'),
        availability: await Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ko' }),
        heading: document.querySelector('#heading')?.textContent, scrollY,
      })), errors)
      throw error
    }
    console.log(`真实 Chrome ${context.browser()?.version() ?? ''}: Device management → ${await heading.textContent()}`)
    assert.equal(await page.evaluate(() => localStorage.getItem('Accept-Language')), 'en')
    const after = await page.evaluate(() => Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ko' }))
    assert.equal(after, 'available')
    await page.reload()
    await heading.waitFor()
    await revealHeading()
    const reopened = await page.evaluate(() => Translator.availability({ sourceLanguage: 'en', targetLanguage: 'ko' }))
    if (reopened === 'available') await page.waitForFunction(() => /[가-힣]/.test(document.querySelector('#heading')?.textContent || ''))
    else assert.equal(await heading.textContent(), 'Device management')
    console.log(`真实 Chrome 刷新后: ${reopened}`)
  } else {
    assert.deepEqual(await page.evaluate(() => window.translationCalls.creates), [])
    await page.evaluate(() => sessionStorage.setItem('fixture:zh:ko:fail', '1'))
    await download.click()
    await waitModel('37%')
    await waitModel('失败，点击重试')
    assert.equal(await heading.textContent(), '设备管理')
    await download.click()
    await waitModel('语言包已就绪')
    assert.equal(await heading.textContent(), '设备管理')
    assert.match(await menu.textContent(), /中文/)
    assert.ok((await page.evaluate(() => window.translationCalls.creates)).every(entry => entry.explicit && entry.gesture))
    await menu.click()
    await page.setViewportSize({ width: 360, height: 540 })
    await open()
    await page.waitForFunction(() => document.querySelector('.language-switch__model-button')?.getBoundingClientRect().right <= innerWidth)
    const bounds = await koreanRow.evaluate(row => ({
      nameRight: row.querySelector('.language-switch__option').getBoundingClientRect().right,
      downloadLeft: row.querySelector('.language-switch__model-button').getBoundingClientRect().left,
      downloadRight: row.querySelector('.language-switch__model-button').getBoundingClientRect().right,
    }))
    assert.ok(bounds.nameRight <= bounds.downloadLeft, JSON.stringify(bounds))
    assert.ok(bounds.downloadRight <= 360, JSON.stringify(bounds))
    if (process.env.PAGE_TRANSLATION_SCREENSHOT) {
      await page.screenshot({ path: process.env.PAGE_TRANSLATION_SCREENSHOT, animations: 'disabled' })
    }
    await korean.click()
    await revealHeading()
    await waitText('#heading', '번역: 设备管理')
    assert.equal(await page.evaluate(() => localStorage.getItem('Accept-Language')), 'zh')
    assert.equal(await page.evaluate(() => localStorage.getItem('editor-language')), 'zh')
    assert.equal(await page.locator('#input').inputValue(), '机房输入值')
    await page.waitForFunction(() => document.querySelector('#input').placeholder === '번역: 搜索设备')
    assert.equal(await page.locator('#select').inputValue(), '表单原值')
    assert.equal(await page.locator('#identifier').textContent(), 'DEVICE-01')
    assert.equal(await page.locator('#editable').textContent(), '编辑区内容')
    assert.equal(await page.locator('#offscreen').textContent(), '离屏内容')
    await page.waitForFunction(() => window.translationCalls.translates.some(entry => entry.text === '旧设备文本'))
    await page.evaluate(() => { window.fixtureState.text = '新设备文本'; window.fixtureState.modal = true; window.fixtureState.mixed = true })
    await waitText('#dynamic', '번역: 新设备文本')
    await waitText('#modal', '번역: 设备详情')
    await waitText('#mixed-zh', '번역: 网关异常')
    assert.equal(await page.locator('#mixed-en').textContent(), 'Device offline')
    assert.equal(await page.locator('#mixed-ja').textContent(), '通信機器')
    await open()
    assert.equal(await korean.getAttribute('aria-current'), 'true')
    assert.equal(await download.count(), 0)
    await assertKoreanDirection('zh')
    assert.equal(await heading.textContent(), '번역: 设备管理')
    assert.equal(await page.locator('#dynamic').textContent(), '번역: 新设备文本')
    await page.evaluate(() => { window.fixtureState.exclude = true; document.querySelector('#offscreen').scrollIntoView() })
    await waitText('#offscreen', '번역: 离屏内容')
    assert.equal(await page.locator('#opt-out').textContent(), '可关闭翻译')
    await revealHeading()
    await page.reload()
    await revealHeading()
    await waitText('#heading', '번역: 设备管理')
    assert.ok((await page.evaluate(() => window.translationCalls.creates)).every(entry => !entry.explicit))
    await page.evaluate(() => sessionStorage.removeItem('fixture:zh:ko'))
    await page.reload()
    await waitText('#heading', '设备管理')
    await open()
    await waitModel('下载 中文 → 한국어 语言包')
    assert.deepEqual(await page.evaluate(() => window.translationCalls.creates), [])
    await download.click()
    await revealHeading()
    await waitText('#heading', '번역: 设备管理')
    await page.evaluate(() => { window.fixtureState.login = true })
    await waitText('#heading', '设备管理')
    await page.evaluate(() => { window.fixtureState.login = false })
    await waitText('#heading', '번역: 设备管理')
    await open()
    await page.getByRole('button', { name: '中文', exact: true }).click()
    await waitText('#heading', '设备管理')
    assert.equal(await page.evaluate(() => localStorage.getItem('jetlinks.page-translation.language')), null)
    await page.evaluate(() => { window.fixtureState.foreign = true })
    await heading.click()
    await waitText('#foreign-en', 'The gateway is offline.')
    await waitText('#hinted-ja', '管理')
    assert.ok(await page.evaluate(() => [...window.translationCalls.inspections, ...window.translationCalls.creates]
      .every(call => call.targetLanguage !== 'zh')))
    await page.reload()
    await waitReview(reviewText)

    const builtInCases = [
      { locale: 'en', label: 'English', heading: 'Device management', accessMenu: 'Access components',
        pager: 'Next Page', needed: 'Download the English → 한국어 language pack', ready: 'The English → 한국어 language pack is ready' },
      { locale: 'ja', label: '日本語', heading: '機器管理', accessMenu: '接続コンポーネント',
        pager: '次のページ', needed: '日本語 → 한국어の言語パックをダウンロード', ready: '日本語 → 한국어の言語パックを使用できます' },
    ]
    for (const item of builtInCases) {
      if (item.locale === 'ja') await waitReview(`zh → en: ${reviewText}`)
      await open()
      const option = page.getByRole('button', { name: item.label, exact: true })
      if (item.locale === 'en') await page.evaluate(() => sessionStorage.setItem('fixture:zh:en:fail', '1'))
      await Promise.all([option.click(), page.waitForFunction(label => {
        const language = Array.from(document.querySelectorAll('.language-switch__option'))
          .find(button => button.textContent.trim() === label)
        const progress = language?.closest('.language-switch__row')?.querySelector('.language-switch__model-button')
        const downloadButton = Array.from(document.querySelectorAll('.language-switch__model-button'))
          .find(button => button.getAttribute('aria-label')?.includes('한국어'))
        if (progress?.textContent.trim() !== '37%' || !progress.disabled || !downloadButton) return false
        const bounds = progress.getBoundingClientRect()
        return language.getBoundingClientRect().right <= bounds.left
          && Math.abs(bounds.right - downloadButton.getBoundingClientRect().right) < 1
      }, item.label)])
      await waitText('#heading', item.heading)
      await waitText('#access-menu', item.accessMenu)
      await waitPagerLabel(item.pager)
      if (item.locale === 'en') {
        // 下载失败仍切换词库。下一次普通点击重试并翻译同一段正文和悬浮标题。
        assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture:zh:en')), null)
        await waitReview(reviewText)
        await page.waitForFunction(() => window.translationCalls.inspections.some(call => call.sourceLanguage === 'zh' && call.targetLanguage === 'en'))
        await heading.click()
        await waitReview(`zh → en: ${reviewText}`)
        const nextReview = '网关离线，无法完成复判。'
        await page.evaluate(text => { Object.assign(window.fixtureState, { review: text, foreign: true, modal: true }) }, nextReview)
        await waitReview(`zh → en: ${nextReview}`)
        await waitText('#modal', 'zh → en: 设备详情')
        await page.waitForFunction(() => window.translationCalls.inspections.some(call => call.sourceLanguage === 'ja' && call.targetLanguage === 'en'))
        await heading.click()
        await waitText('#hinted-zh', 'zh → en: 管理')
        await waitText('#hinted-ja', 'ja → en: 管理')
        const calls = await page.evaluate(() => window.translationCalls)
        for (const source of ['zh', 'ja']) {
          assert.ok(calls.creates.some(call => call.sourceLanguage === source && call.targetLanguage === 'en'
            && call.explicit && call.gesture), JSON.stringify(calls.creates))
        }
        assert.equal(calls.translates.filter(call => call.text === nextReview).length, 1)
        assert.equal(await page.locator('#foreign-en').textContent(), 'The gateway is offline.')
        await page.reload()
      }
      await waitReview(`zh → ${item.locale}: ${reviewText}`)
      await waitText('#resource-statistic', `zh → ${item.locale}: 功耗分布`)
      await page.waitForFunction(value => document.querySelector('#input')?.placeholder === value, `zh → ${item.locale}: 搜索设备`)
      assert.equal(await page.locator('#gateway').textContent(), '测试网关')
      assert.equal(await page.locator('#gateway').getAttribute('title'), '测试网关')
      await open()
      assert.equal(await option.locator('..').locator('.language-switch__model-button:enabled').count(), 0)
      await waitModel(item.needed)
      await download.click()
      await waitModel(item.ready)
      assert.equal(await heading.textContent(), item.heading)
      await korean.click()
      await revealHeading()
      await waitText('#heading', `번역: ${item.heading}`)
      await waitText('#access-menu', `번역: ${item.accessMenu}`)
      await waitPagerLabel(`번역: ${item.pager}`)
      assert.deepEqual(await page.evaluate(() => [localStorage.getItem('Accept-Language'), localStorage.getItem('editor-language')]), [item.locale, item.locale])
      await assertKoreanDirection(item.locale)

      await page.reload()
      await revealHeading()
      await waitText('#heading', `번역: ${item.heading}`)
      await page.evaluate(() => { window.fixtureState.login = true })
      await waitText('#heading', item.heading)
      await waitPagerLabel(item.pager)
      await page.evaluate(() => { window.fixtureState.login = false })
      await waitText('#heading', `번역: ${item.heading}`)
      await open()
      assert.equal(await korean.getAttribute('aria-current'), 'true')
      assert.equal(await download.count(), 0)
      if (item.locale === 'ja') {
        await traditionalDownload.click()
        await traditional.waitFor()
        await traditionalDownload.getAttribute('aria-label').then(label => assert.ok(label?.includes('한국어 → 繁體中文')))
        await page.waitForFunction(() => !Array.from(document.querySelectorAll('.language-switch__option'))
          .find(button => button.textContent?.trim() === '繁體中文')?.disabled)
        await traditional.click()
        await revealHeading()
        await waitText('#heading', '譯: 번역: 機器管理')
        assert.ok(await page.evaluate(() => window.translationCalls.translates.some(call =>
          call.sourceLanguage === 'ko' && call.targetLanguage === 'zh-Hant' && call.text === '번역: 機器管理')))
        await page.reload()
        await revealHeading()
        await waitText('#heading', '譯: 번역: 機器管理')
        await open()
      }
      await option.click()
      await waitText('#heading', item.heading)
      await waitText('#access-menu', item.accessMenu)
      await waitPagerLabel(item.pager)
      assert.equal(await page.evaluate(() => localStorage.getItem('jetlinks.page-translation.language')), null)
    }

    await page.evaluate(() => sessionStorage.setItem('fixture:unsupported', '1'))
    await page.reload()
    await open()
    await waitModel('このブラウザまたは原文言語は日本語 → 한국어への翻訳に対応していません')
    assert.equal(await korean.isDisabled(), true)
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await waitText('#heading', 'Device management')
    assert.equal(await page.evaluate(() => localStorage.getItem('Accept-Language')), 'en')
    assert.equal(await page.evaluate(() => localStorage.getItem('editor-language')), 'en')
    console.log('Chrome 页面回归通过，覆盖英日自动下载、失败后切换和重试、复判正文与标题补译、跳过标记、连续翻译和刷新。')
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(external, [])
} finally {
  await context?.close()
  server.close()
  await rm(profile, { force: true, recursive: true })
}
