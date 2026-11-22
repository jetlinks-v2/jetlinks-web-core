export interface LanguagePair {
  sourceLanguage: string
  targetLanguage: string
}

export type ModelState = { phase: 'checking' | 'needed' | 'ready' | 'unsupported' | 'error' }
  | { phase: 'downloading'; percent?: number }

type NativeAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

export interface TranslatorInstance {
  translate(text: string, options: { signal: AbortSignal }): Promise<string>
  destroy(): void
}

export interface TranslatorApi {
  prepareTimeout?: number
  translateTimeout?: number
  dispose?(): void
  availability(pair: LanguagePair): Promise<NativeAvailability>
  create(options: LanguagePair & {
    signal: AbortSignal
    monitor?: (target: EventTarget) => void
  }): Promise<TranslatorInstance>
}

interface ModelEntry {
  pair: LanguagePair
  state?: ModelState
  inspection?: Promise<ModelState>
  operation?: { controller: AbortController; result: Promise<TranslatorInstance | undefined> }
  translator?: TranslatorInstance
  version: number
  usedAt: number
  active: number
}

const CHECKING: ModelState = { phase: 'checking' }
const UNSUPPORTED: ModelState = { phase: 'unsupported' }
const MAX_OPEN_MODELS = 6

export function pairKey({ sourceLanguage, targetLanguage }: LanguagePair): string {
  return `${sourceLanguage}:${targetLanguage}`
}

export function browserTranslator(): TranslatorApi | undefined {
  const browser = globalThis as typeof globalThis & { Translator?: TranslatorApi }
  const api = browser.Translator
  return browser.isSecureContext && typeof api?.availability === 'function' && typeof api.create === 'function' ? api : undefined
}

/** 按语言对协调可用状态、下载和少量在用翻译实例。 */
export class TranslationModels {
  private readonly entries = new Map<string, ModelEntry>()
  private disposed = false
  private clock = 0

  constructor(
    private readonly notify: (pair: LanguagePair, state: ModelState) => void,
    private readonly getApi = browserTranslator,
    private readonly prepareTimeout?: number,
  ) {}

  inspect(pair: LanguagePair, refresh = false): Promise<ModelState> {
    if (this.disposed || pair.sourceLanguage === pair.targetLanguage) return Promise.resolve(UNSUPPORTED)
    const entry = this.entry(pair)
    if (entry.translator || entry.operation) return Promise.resolve(entry.state ?? CHECKING)
    if (entry.inspection) return entry.inspection
    if (entry.state && !refresh) return Promise.resolve(entry.state)
    const api = this.getApi()
    if (!api) return Promise.resolve(this.update(entry, UNSUPPORTED))
    const version = entry.version
    entry.inspection = Promise.resolve().then(() => api.availability(pair)).then(value => {
      if (!this.current(entry, version)) return entry.state ?? CHECKING
      const phase = value === 'unavailable' ? 'unsupported' : entry.state?.phase === 'error' ? 'error'
        : value === 'available' ? 'ready' : 'needed'
      return this.update(entry, { phase })
    }, () => this.current(entry, version) ? this.update(entry, { phase: 'error' }) : entry.state ?? CHECKING)
      .finally(() => { entry.inspection = undefined })
    return entry.inspection
  }

  /** 必须在真实点击中直接调用，不把 create 推迟到下载队列、watch 或 await 后。 */
  prepare(pair: LanguagePair): Promise<boolean> {
    if (this.disposed || pair.sourceLanguage === pair.targetLanguage) return Promise.resolve(false)
    return this.open(this.entry(pair), true).then(Boolean)
  }

  /** 只有报告 available 的语言对才允许后台重建实例，不为页面文本隐式启动下载。 */
  async translate(pair: LanguagePair, text: string, signal: AbortSignal): Promise<string | undefined> {
    if (this.disposed || signal.aborted || pair.sourceLanguage === pair.targetLanguage) return
    const entry = this.entry(pair)
    if (!entry.translator) {
      const state = await this.inspect(pair)
      if (state.phase !== 'ready' || signal.aborted || this.disposed) return
    }
    const translator = entry.translator ?? await this.open(entry, false)
    if (!translator || signal.aborted || this.disposed) return
    entry.usedAt = ++this.clock
    entry.active++
    try {
      const timeout = this.getApi()?.translateTimeout ?? 20_000
      const result = await translator.translate(text, { signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]) })
      return signal.aborted || this.disposed ? undefined : result
    } catch (error) {
      if (!signal.aborted && !this.disposed && entry.translator === translator
        && (error as Error | undefined)?.name === 'InvalidStateError') {
        this.release(entry)
        this.update(entry, { phase: 'error' })
      }
    } finally {
      entry.active--
      this.trim()
    }
  }

  dispose(): void {
    this.disposed = true
    for (const entry of this.entries.values()) {
      entry.operation?.controller.abort()
      this.release(entry)
    }
    this.entries.clear()
  }

  private entry(pair: LanguagePair): ModelEntry {
    const key = pairKey(pair)
    let entry = this.entries.get(key)
    if (!entry) {
      entry = { pair, version: 0, usedAt: 0, active: 0 }
      this.entries.set(key, entry)
    }
    return entry
  }

  private open(entry: ModelEntry, explicit: boolean): Promise<TranslatorInstance | undefined> {
    if (entry.translator) return Promise.resolve(entry.translator)
    if (entry.operation) return entry.operation.result
    const api = this.getApi()
    const version = ++entry.version
    if (!api) {
      this.update(entry, UNSUPPORTED)
      return Promise.resolve(undefined)
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.prepareTimeout ?? api.prepareTimeout ?? 180_000)
    if (explicit) this.update(entry, { phase: 'downloading' })
    let creation: Promise<TranslatorInstance>
    try {
      creation = api.create({
        ...entry.pair,
        signal: controller.signal,
        monitor: explicit ? monitor => monitor.addEventListener('downloadprogress', event => {
          const { loaded, total } = event as ProgressEvent
          if (this.current(entry, version) && total > 0) {
            this.update(entry, { phase: 'downloading', percent: Math.min(100, Math.max(0, Math.round(loaded / total * 100))) })
          }
        }, { signal: controller.signal }) : undefined,
      })
    } catch (error) {
      creation = Promise.reject(error)
    }
    const result = creation.then(translator => {
      if (!this.current(entry, version) || controller.signal.aborted) {
        translator.destroy()
        if (this.current(entry, version)) this.update(entry, { phase: 'error' })
        return
      }
      entry.translator = translator
      entry.usedAt = ++this.clock
      this.trim(entry)
      this.update(entry, { phase: 'ready' })
      return translator
    }, error => {
      if (this.current(entry, version)) {
        this.update(entry, (error as Error | undefined)?.name === 'NotSupportedError' ? UNSUPPORTED : { phase: 'error' })
      }
      return undefined
    }).finally(() => {
      clearTimeout(timeout)
      if (entry.operation?.controller === controller) entry.operation = undefined
    })
    entry.operation = { controller, result }
    return result
  }

  private current(entry: ModelEntry, version: number): boolean {
    return !this.disposed && entry.version === version
  }

  private update(entry: ModelEntry, state: ModelState): ModelState {
    entry.state = state
    this.notify(entry.pair, state)
    return state
  }

  private release(entry: ModelEntry): void {
    entry.translator?.destroy()
    entry.translator = undefined
  }

  private trim(keep?: ModelEntry): void {
    const open = [...this.entries.values()].filter(entry => entry.translator)
    if (open.length <= MAX_OPEN_MODELS) return
    const idle = open.filter(entry => !entry.active && entry !== keep).sort((a, b) => a.usedAt - b.usedAt)
    for (const entry of idle.slice(0, open.length - MAX_OPEN_MODELS)) this.release(entry)
  }
}
