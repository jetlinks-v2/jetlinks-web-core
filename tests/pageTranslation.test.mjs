import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createI18n } from 'vue-i18n'
import { extraLanguagesFixture } from './pageTranslationLanguageFixture.mjs'

const bundleOptions = {
  stdin: {
    resolveDir: fileURLToPath(new URL('..', import.meta.url)),
    contents: `export * from './src/locales/translation/models';
      export * from './src/locales/translation/languages';
      export * from './src/locales/translation/runtime';
      export * from './src/locales/translation/page/source';`,
  },
  format: 'cjs', platform: 'node', bundle: true, packages: 'external', write: false,
  define: { 'import.meta.url': '"file:///fixture.js"', 'import.meta.env.BASE_URL': '"/"' },
}
async function loadTranslation(plugins = []) {
  const { outputFiles } = await build({ ...bundleOptions, plugins })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', outputFiles[0].text)(module, module.exports, createRequire(import.meta.url))
  return module.exports
}

const { TranslationModels, createTranslationRuntime, translationLanguageKey, PageSourceCatalog,
  builtInLanguageOptions, machineLanguageOptions, builtInLanguage, excludedText, usableTranslation } = await loadTranslation()
const pair = { sourceLanguage: 'zh', targetLanguage: 'ko' }

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function model() {
  const inputs = []
  return { inputs, destroyed: 0, async translate(text) { inputs.push(text); return `번역: ${text}` }, destroy() { this.destroyed++ } }
}

function fixture(t, api, timeout) {
  const states = []
  const models = new TranslationModels((pair, state) => states.push({ pair, ...state }), () => api, timeout)
  t.after(() => models.dispose())
  return { models, states }
}

test('unsupported or unprepared pairs never create an implicit download', async t => {
  const unsupported = fixture(t, undefined).models
  assert.equal((await unsupported.inspect(pair)).phase, 'unsupported')
  assert.equal(await unsupported.prepare(pair), false)
  for (const availability of ['unavailable', 'downloadable', 'downloading']) {
    const { models } = fixture(t, { availability: async () => availability, create() { assert.fail('unexpected native creation') } })
    assert.equal((await models.inspect(pair)).phase, availability === 'unavailable' ? 'unsupported' : 'needed')
    assert.equal(await models.translate(pair, '设备离线', new AbortController().signal), undefined)
  }
})

test('an explicit click calls create synchronously, shares it, and reports native progress', async t => {
  const creating = deferred()
  const translator = model()
  const monitor = new EventTarget()
  let creates = 0
  const { models, states } = fixture(t, {
    availability: async () => 'downloadable',
    create(options) { creates++; options.monitor(monitor); return creating.promise },
  })
  await models.inspect(pair)
  const pending = models.prepare(pair)
  assert.equal(creates, 1)
  const duplicate = models.prepare(pair)
  const progress = new Event('downloadprogress')
  Object.assign(progress, { loaded: 0.37, total: 1 })
  monitor.dispatchEvent(progress)
  assert.equal(states.at(-1).percent, 37)
  assert.equal(creates, 1)
  creating.resolve(translator)
  assert.deepEqual(await Promise.all([pending, duplicate]), [true, true])
  assert.equal(states.at(-1).phase, 'ready')
  assert.equal(await models.translate(pair, '设备离线', new AbortController().signal), '번역: 设备离线')
  assert.equal(creates, 1)
})

test('a stale availability response cannot replace a prepared browser instance', async t => {
  const probe = deferred()
  const { models, states } = fixture(t, { availability: () => probe.promise, create: async () => model() })
  const inspecting = models.inspect(pair)
  assert.equal(await models.prepare(pair), true)
  probe.resolve('downloadable')
  assert.equal((await inspecting).phase, 'ready')
  assert.equal(states.at(-1).phase, 'ready')
})

test('failure stays retryable; a warm pair can reopen without an explicit download', async t => {
  let attempts = 0
  const { models } = fixture(t, {
    availability: async () => 'downloadable',
    create: () => ++attempts === 1 ? Promise.reject(new DOMException('offline', 'NetworkError')) : Promise.resolve(model()),
  })
  assert.equal(await models.prepare(pair), false)
  assert.equal((await models.inspect(pair, true)).phase, 'error')
  assert.equal(await models.prepare(pair), true)

  const warm = fixture(t, {
    availability: async () => 'available',
    create(options) { assert.equal(options.monitor, undefined); return Promise.resolve(model()) },
  }).models
  assert.equal(await warm.translate(pair, '欢迎', new AbortController().signal), '번역: 欢迎')
})

test('timed out preparation and late translations do not leave a pending UI result', async t => {
  const stale = deferred()
  const translator = { ...model(), translate: () => stale.promise }
  const slow = fixture(t, {
    availability: async () => 'downloadable',
    create: ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  }, 10)
  assert.equal(await slow.models.prepare(pair), false)
  assert.equal(slow.states.at(-1).phase, 'error')

  const warm = fixture(t, { availability: async () => 'available', create: async () => translator }).models
  const controller = new AbortController()
  const result = warm.translate(pair, '旧内容', controller.signal)
  await delay(0)
  controller.abort()
  stale.resolve('stale output')
  assert.equal(await result, undefined)
  warm.dispose()
  assert.equal(translator.destroyed, 1)
})

test('translation uses the visible language, restores the ready prefix and keeps the saved request and editor locale', async t => {
  const { createTranslationRuntime } = await loadTranslation([extraLanguagesFixture])
  const items = new Map([['Accept-Language', 'ja'], ['editor-language', 'ja']])
  const storage = { getItem: key => items.get(key), setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) }
  const downloaded = new Set(['zh:ko'])
  const inspections = []
  const creations = []
  const translated = []
  const japanese = { sourceLanguage: 'ja', targetLanguage: 'ko' }
  const korean = { sourceLanguage: 'ko', targetLanguage: 'zh-Hant' }
  const api = () => ({
    availability: async direction => {
      inspections.push(direction)
      return downloaded.has(`${direction.sourceLanguage}:${direction.targetLanguage}`) ? 'available' : 'downloadable'
    },
    create: async ({ sourceLanguage, targetLanguage, monitor }) => {
      creations.push({ sourceLanguage, targetLanguage })
      if (monitor) downloaded.add(`${sourceLanguage}:${targetLanguage}`)
      return {
        async translate(text) {
          translated.push({ sourceLanguage, text })
          return targetLanguage === 'ko' ? '기기 관리' : '設備管理'
        },
        destroy() {},
      }
    },
  })
  const runtime = createTranslationRuntime('ja', storage, api)
  t.after(runtime.dispose)
  runtime.inspect('ko')
  await delay(0)
  assert.equal(runtime.select('ko'), false)
  assert.deepEqual(creations, [])
  assert.deepEqual(inspections, [japanese])
  runtime.prepare('ko')
  await delay(0)
  assert.deepEqual(creations, [japanese])
  assert.equal(runtime.language.value, 'ja')
  assert.equal(runtime.select('ko'), true)
  runtime.prepare('ko')
  assert.equal(runtime.state('ko').phase, 'ready')
  const signal = new AbortController().signal
  assert.equal(await runtime.translate(runtime.activePairs.value, '機器管理', signal), '기기 관리')
  runtime.inspect('zh-Hant')
  await delay(0)
  assert.equal(runtime.select('zh-Hant'), false)
  assert.equal(runtime.language.value, 'ko')
  runtime.prepare('zh-Hant')
  await delay(0)
  assert.equal(runtime.select('zh-Hant'), true)
  assert.deepEqual(creations, [japanese, korean])
  assert.deepEqual(runtime.activePairs.value, [japanese, korean])
  assert.equal(await runtime.translate(runtime.activePairs.value, '機器管理', signal), '設備管理')
  assert.deepEqual(translated, [{ sourceLanguage: 'ja', text: '機器管理' }, { sourceLanguage: 'ko', text: '기기 관리' }])
  assert.deepEqual(Object.fromEntries(items), {
    'Accept-Language': 'ja', 'editor-language': 'ja', [translationLanguageKey]: '["ja","ko","zh-Hant"]',
  })

  downloaded.delete('ko:zh-Hant')
  const resumed = createTranslationRuntime('ja', storage, api)
  t.after(resumed.dispose)
  assert.equal(resumed.language.value, 'ja')
  resumed.resume()
  await delay(0)
  assert.equal(resumed.language.value, 'ko')
  assert.deepEqual(resumed.activePairs.value, [japanese])
  assert.deepEqual(inspections, [japanese, korean, japanese, korean])
  assert.deepEqual(creations, [japanese, korean])
  resumed.prepare('zh-Hant')
  await delay(0)
  assert.equal(resumed.language.value, 'zh-Hant')
  resumed.select()
  assert.equal(resumed.language.value, 'ja')
  assert.equal(items.has(translationLanguageKey), false)
})

test('source detection respects the starting locale and its mixed text', () => {
  const catalog = new PageSourceCatalog({
    zh: { status: '设备状态：{name}', plain: '目录管理' },
    en: { plain: 'Directory', welcome: 'Welcome, {name}!' },
    ja: { plain: '監視', count: '{count}件' },
  }, text => ['接入组件', '日本語の本文', '監視'].includes(text))
  assert.equal(catalog.isSourceText('设备状态：传感器一', 'zh'), true)
  assert.equal(catalog.isSourceText('目录管理', 'zh'), true)
  assert.equal(catalog.isSourceText('现场设备异常', 'zh'), true)
  assert.equal(catalog.isSourceText('Welcome, 机房!', 'zh'), false)
  assert.equal(catalog.isSourceText('Welcome, 机房!', 'en'), true)
  assert.equal(catalog.isSourceText('監視', 'zh'), false)
  assert.equal(catalog.isSourceText('監視', 'ja'), true)
  assert.equal(catalog.isSourceText('日本語の本文', 'zh'), false)
  assert.equal(catalog.isSourceText('機器一覧を開く', 'ja'), true)
  assert.equal(catalog.isSourceText('12件', 'zh'), false)
  assert.equal(catalog.isSourceText('12件', 'ja'), true)
  assert.equal(catalog.isSourceText('接入组件', 'zh'), true)
  assert.equal(catalog.isSourceText('接入组件', 'zh', 'ja-JP'), false)
  assert.equal(catalog.isSourceText('정상', 'ja'), false)
  assert.equal(catalog.isSourceText('Device offline', 'ja'), false)
  assert.equal(catalog.isSourceText('Device offline', 'en'), true)
  assert.equal(catalog.isSourceText('現場', 'zh', 'zh-Hant'), false)
  assert.equal(catalog.isSourceText('现场', 'zh', 'zh-CN'), true)
  assert.equal(catalog.isSourceText('管理', 'ja', 'ja-JP'), true)
  for (const value of ['DEVICE-01', 'abc123', '2026-11-18', 'https://example.test', 'id@example.test', '{{value}}']) {
    assert.equal(excludedText(value), true, value)
  }
  assert.equal(excludedText('设备 01 离线'), false)
  assert.equal(usableTranslation('设备离线', '设备 设备 设备 设备 设备 设备'), false)
  assert.equal(builtInLanguage('en-US'), 'en')
  assert.equal(builtInLanguage('ko-KR'), undefined)
})

test('built-in page translation covers unmarked text and respects dictionaries and language hints', () => {
  const catalog = new PageSourceCatalog({
    zh: { same: '管理', label: '离线' },
    ja: { same: '管理', label: '監視', count: '{count}件' },
    en: { label: 'Offline', welcome: 'Welcome, {name}!' },
  })
  assert.equal(catalog.supplementSource('复判目标：车辆违停检测。', 'en'), 'zh')
  assert.equal(catalog.supplementSource('復判結果を表示しました', 'en'), 'ja')
  assert.equal(catalog.supplementSource('The gateway is offline.', 'ja'), 'en')
  assert.equal(catalog.supplementSource('Offline', 'zh'), 'en')
  assert.equal(catalog.supplementSource('12件', 'en'), 'ja')
  assert.equal(catalog.supplementSource('Welcome, 设备!', 'en'), undefined)
  assert.equal(catalog.supplementSource('管理', 'en'), 'zh')
  assert.equal(catalog.supplementSource('地域名称', 'en'), 'zh')
  assert.equal(catalog.supplementSource('Gateway summary', 'ja'), 'en')
  assert.equal(catalog.supplementSource('管理', 'en', 'ja-JP'), 'ja')
  assert.equal(catalog.supplementSource('管理', 'en', 'zh-CN'), 'zh')
  assert.equal(catalog.supplementSource('監視', 'zh', 'zh-TW'), 'zh-Hant')
  assert.equal(catalog.supplementSource('Gateway', 'en', 'en-US'), undefined)
})

test('disabled extra languages fall back to the saved built-in language without probing a model', async t => {
  assert.deepEqual(builtInLanguageOptions.map(option => option.value), ['zh', 'en', 'ja'])
  assert.deepEqual(machineLanguageOptions, [])
  const inspections = []
  for (const preference of ['ko', '["en","ko","zh-Hant"]']) {
    const runtime = createTranslationRuntime('en', { getItem: () => preference }, () => ({
      async availability(pair) { inspections.push(pair); return 'downloadable' },
    }))
    t.after(runtime.dispose)
    runtime.resume()
    for (const language of ['ko', 'zh-Hant']) {
      runtime.inspect(language)
      runtime.prepare(language)
      assert.equal(runtime.select(language), false)
    }
    assert.equal(runtime.language.value, 'en')
    assert.deepEqual(runtime.activePairs.value, [])
  }
  await delay(0)
  assert.deepEqual(inspections, [])
})

test('native locale JSON renders language pack feedback without creating a Korean dictionary', async () => {
  for (const locale of ['zh', 'en', 'ja']) {
    const dictionary = JSON.parse(await readFile(new URL(`../src/locales/lang/${locale}.json`, import.meta.url), 'utf8'))
    const i18n = createI18n({ legacy: false, locale, messages: { [locale]: dictionary } })
    const progress = i18n.global.t('localTranslation.progress', { language: '한국어', percent: 37 })
    assert.match(progress, /한국어/)
    assert.match(progress, /37%/)
    assert.deepEqual(i18n.global.availableLocales, [locale])
  }
})
