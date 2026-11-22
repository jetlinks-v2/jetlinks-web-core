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
  const models = new TranslationModels((pair, state) => {
    states.set(pairKey(pair), state)
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
    return pair ? states.get(pairKey(pair)) ?? CHECKING : CHECKING
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
