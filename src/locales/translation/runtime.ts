import { computed, inject, onScopeDispose, provide, shallowReactive, shallowRef, type InjectionKey } from 'vue'
import { useI18n } from 'vue-i18n'
import { builtInLanguage, DEFAULT_LANGUAGE, machineLanguage, type BuiltInLanguage } from './languages'
import { TranslationModels, browserTranslator, pairKey, type LanguagePair, type ModelState, type TranslatorApi } from './models'
import { usableTranslation } from './page/source'
import { createLocalTranslator } from './local/provider'

export const translationLanguageKey = 'jetlinks.page-translation.language'
const CHECKING: ModelState = { phase: 'checking' }
const READY: ModelState = { phase: 'ready' }
const MAX_CACHED_TEXTS = 512
const downloadsAutomatically = (language: string) => language === 'en' || language === 'ja'

function defaultStorage(): Storage | undefined {
  try { return globalThis.localStorage } catch { return undefined }
}

/** 旧存储只记录目标语种，按当前内置语种恢复一次切换。 */
function readLanguagePath(base: BuiltInLanguage, storage?: Storage): string[] {
  try {
    const saved = storage?.getItem(translationLanguageKey)
    const legacyTarget = machineLanguage(saved)
    if (legacyTarget) return [base, legacyTarget]
    const path: unknown = JSON.parse(saved ?? 'null')
    if (Array.isArray(path) && path[0] === base
      && path.slice(1).every((language, index) => typeof language === 'string'
        && machineLanguage(language) === language && language !== path[index])) return path
  } catch { /* 存储受限或数据无效时使用内置词库。 */ }
  return [base]
}

/** 使用已准备的翻译路径驱动界面，持久化内容只有语种。 */
export function createTranslationRuntime(
  base: BuiltInLanguage,
  storage = defaultStorage(),
  api?: () => TranslatorApi | undefined,
) {
  const path = shallowRef(readLanguagePath(base, storage))

  let ownedApi: TranslatorApi | undefined
  const getApi = api ?? (() => ownedApi ??= browserTranslator() ?? createLocalTranslator())
  const states = shallowReactive(new Map<string, ModelState>())
  const supplements = shallowReactive(new Map<string, LanguagePair>())
  const readyModels = shallowRef(0)
  const models = new TranslationModels((pair, state) => {
    const key = pairKey(pair)
    if (state.phase === 'ready' && states.get(key)?.phase !== 'ready') readyModels.value++
    states.set(key, state)
  }, getApi)

  const pairs = computed(() => path.value.slice(1).map((targetLanguage, index) => ({
    sourceLanguage: path.value[index], targetLanguage,
  })))
  // 清理浏览器模型后，界面回到仍能翻译的最后一段。就绪状态变化不会重启无关翻译。
  const readyCount = computed(() => {
    const unavailable = pairs.value.findIndex(pair => states.get(pairKey(pair))?.phase !== 'ready')
    return unavailable === -1 ? pairs.value.length : unavailable
  })
  const activePairs = computed(() => pairs.value.slice(0, readyCount.value))
  const language = computed(() => activePairs.value.at(-1)?.targetLanguage ?? base)
  const translations = new Map<string, string>()

  function optionPair(target: string): LanguagePair | undefined {
    const targetLanguage = machineLanguage(target)
    if (targetLanguage && targetLanguage !== language.value) return { sourceLanguage: language.value, targetLanguage }
  }

  function state(target: string): ModelState {
    if (target === language.value) return READY
    const pair = optionPair(target)
    return pair ? pairState(pair) : CHECKING
  }

  function inspect(target: string): void {
    const pair = optionPair(target)
    if (pair) void models.inspect(pair, true)
  }

  function prepare(target: string): void {
    const pair = optionPair(target)
    const phase = state(target).phase
    if (pair && (phase === 'needed' || phase === 'error')) void models.prepare(pair)
  }

  function select(target?: string): boolean {
    if (target === language.value) return true
    const pair = target ? optionPair(target) : undefined
    if (target && (!pair || state(target).phase !== 'ready')) return false
    path.value = pair ? [...path.value.slice(0, readyCount.value + 1), pair.targetLanguage] : [base]
    try {
      if (pair) storage?.setItem(translationLanguageKey, JSON.stringify(path.value))
      else storage?.removeItem(translationLanguageKey)
    } catch { /* 仍允许当前页面切换。 */ }
    return true
  }

  function pairState(pair: LanguagePair): ModelState {
    return states.get(pairKey(pair)) ?? CHECKING
  }

  function supplementModels(target: BuiltInLanguage) {
    return [...supplements.values()].filter(pair => pair.targetLanguage === target)
      .map(pair => ({ pair, state: pairState(pair) }))
  }

  async function inspectSupplement(pair: LanguagePair, refresh = false) {
    const { phase } = await models.inspect(pair, refresh)
    if (phase === 'needed' && downloadsAutomatically(pair.targetLanguage) && getApi()?.downloadWithoutActivation) {
      void models.prepare(pair)
    }
  }

  /** 仅在发现可见的异语种文案时检查模型，下载就绪后再处理该文案。 */
  function requireSupplement(pair: LanguagePair): boolean {
    const key = pairKey(pair)
    if (!supplements.has(key)) {
      supplements.set(key, pair)
      void inspectSupplement(pair)
    }
    return pairState(pair).phase === 'ready'
  }

  function inspectSupplements(target: BuiltInLanguage): void {
    for (const { pair } of supplementModels(target)) void inspectSupplement(pair, true)
  }

  function prepareSupplement(pair: LanguagePair): Promise<boolean> | undefined {
    const { phase } = pairState(pair)
    if (phase === 'needed' || phase === 'error') return models.prepare(pair)
  }

  /** 恢复已保存的语种后，复用页面的真实点击准备已发现的缺失语言对。 */
  function preparePendingSupplements(): void {
    if (!downloadsAutomatically(base) || getApi()?.downloadWithoutActivation) return
    const missing = supplementModels(base).filter(({ state }) => state.phase === 'needed')
    const next = missing.find(({ pair }) => pair.sourceLanguage === DEFAULT_LANGUAGE) ?? missing[0]
    if (next) void models.prepare(next.pair)
  }

  /** 首次选择英日语时在点击中启动 Chrome 下载，刷新之前等准备结束。 */
  function prepareBuiltIn(target: BuiltInLanguage) {
    if (!downloadsAutomatically(target)) return
    const translator = getApi()
    if (!translator) return
    const current = supplementModels(base)
    if (translator.downloadWithoutActivation) {
      if (target !== base) return
      const retryable = current.filter(({ state }) => state.phase !== 'ready' && state.phase !== 'unsupported')
      if (retryable.length) return Promise.all(retryable.map(async ({ pair }) => {
        await models.inspect(pair, true)
        return prepareSupplement(pair)
      }))
      return
    }

    // Chrome 会消耗该次点击的激活。优先准备当前页面实际用过的原文语种。
    const visibleSources = current.filter(({ state }) => state.phase === 'ready').map(({ pair }) => pair.sourceLanguage)
    const sources = new Set([...visibleSources, base, ...current.map(({ pair }) => pair.sourceLanguage)])
    for (const sourceLanguage of sources) {
      if (sourceLanguage === target) continue
      const pair = { sourceLanguage, targetLanguage: target }
      const { phase } = pairState(pair)
      if (phase === 'ready' || phase === 'unsupported') continue
      supplements.set(pairKey(pair), pair)
      return models.prepare(pair)
    }
  }

  /** 翻译下一段时优先复用已显示的前一段译文，新增文案或刷新后按同一路径生成。 */
  async function translate(route: readonly LanguagePair[], text: string, signal: AbortSignal) {
    let result: string | undefined
    for (const pair of route) {
      if (signal.aborted) return
      const input = result ?? text
      const key = JSON.stringify([pairKey(pair), input])
      const cached = translations.get(key)
      if (cached !== undefined) {
        result = cached
        continue
      }
      const output = await models.translate(pair, input, signal)
      if (output === undefined || !usableTranslation(input, output)) break
      result = output.trim()
      translations.set(key, result)
      if (translations.size > MAX_CACHED_TEXTS) {
        const oldest = translations.keys().next().value
        if (oldest !== undefined) translations.delete(oldest)
      }
    }
    return signal.aborted ? undefined : result
  }

  return {
    language, activePairs, state, inspect, prepare, select, translate,
    readyModels, supplementModels, requireSupplement, inspectSupplements,
    preparePendingSupplements, prepareBuiltIn,
    resume: () => pairs.value.forEach(pair => void models.inspect(pair, true)),
    dispose: () => {
      translations.clear()
      models.dispose()
      ownedApi?.dispose?.()
    },
  }
}

type TranslationRuntime = ReturnType<typeof createTranslationRuntime>
const translationRuntimeKey: InjectionKey<TranslationRuntime> = Symbol('pageTranslation')

export function provideTranslationRuntime(): TranslationRuntime {
  const { locale } = useI18n({ useScope: 'global' })
  const runtime = createTranslationRuntime(builtInLanguage(locale.value) ?? DEFAULT_LANGUAGE)
  provide(translationRuntimeKey, runtime)
  onScopeDispose(runtime.dispose)
  return runtime
}

export function useTranslationRuntime(): TranslationRuntime {
  const provided = inject(translationRuntimeKey, undefined)
  if (provided) return provided
  const { locale } = useI18n({ useScope: 'global' })
  const runtime = createTranslationRuntime(builtInLanguage(locale.value) ?? DEFAULT_LANGUAGE)
  onScopeDispose(runtime.dispose)
  return runtime
}
