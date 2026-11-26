import { resolvePublicAssetUrl } from '../../../utils/public-asset'
import type { LanguagePair, TranslatorApi, TranslatorInstance } from '../models'
import { localPackFiles, localPackName, localPackPath, localPackVersion, needsNeuralModel,
  supportsLocalPair, type LocalReply, type LocalRequest } from './pack'

type DownloadProgress = { loaded: number; total: number }
type LocalWork = Exclude<LocalRequest, { type: 'cancel' }>

/** 媒体文件以实际接收的字节汇报进度，单个完整文件写入缓存后可在重试时复用。 */
async function cacheFile(cache: Cache, url: string, size: number, signal: AbortSignal, progress: (bytes: number) => void) {
  const response = await fetch(url, { mode: 'same-origin', cache: 'no-store', redirect: 'error', signal })
  if (!response.ok || !response.body) throw new Error(`Could not load translation asset (${response.status})`)
  let loaded = 0
  const body = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, output) {
      loaded += chunk.byteLength
      if (loaded > size) throw new Error('Unexpected translation asset size')
      progress(chunk.byteLength)
      output.enqueue(chunk)
    },
    flush() {
      if (loaded !== size) throw new Error('Incomplete translation asset')
    },
  }))
  await cache.put(url, new Response(body, { headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' } }))
}

/** 每个页面共享一个 Worker 和一份模型，语言对只持有各自的翻译参数。 */
export function createLocalTranslator(): TranslatorApi | undefined {
  if (!globalThis.isSecureContext || !globalThis.caches || typeof Worker !== 'function'
    || typeof WebAssembly !== 'object' || typeof TransformStream !== 'function') return

  const packUrl = new URL(resolvePublicAssetUrl(localPackPath), location.origin).href
  const files = localPackFiles.map(file => ({ url: new URL(file.path, packUrl).href, size: file.size }))
  const total = files.reduce((sum, file) => sum + file.size, 0)
  const progressListeners = new Set<EventTarget>()
  const pending = new Map<number, { reply: (message: LocalReply) => void; fail: (error: Error) => void }>()
  let nextId = 0
  let worker: Worker | undefined
  let packCheck: Promise<boolean> | undefined
  let packDownload: Promise<void> | undefined
  let progress: DownloadProgress = { loaded: 0, total }

  const cacheReady = async () => {
    const cache = await caches.open(localPackName)
    const keys = new Set((await cache.keys()).map(key => key.url))
    return files.every(file => keys.has(file.url))
  }

  const installedOnSite = () => {
    packCheck ??= fetch(new URL('pack.json', packUrl), {
      mode: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(6000),
    })
      .then(async response => response.ok && (await response.json())?.version === localPackVersion)
      .catch(() => false)
      .then(installed => {
        if (!installed) packCheck = undefined
        return installed
      })
    return packCheck
  }

  const report = (bytes: number) => {
    progress = { loaded: progress.loaded + bytes, total }
    progressListeners.forEach(listener => listener.dispatchEvent(new ProgressEvent('downloadprogress', progress)))
  }

  const downloadPack = async (signal: AbortSignal) => {
    if (packDownload) return packDownload
    progress = { loaded: 0, total }
    packDownload = (async () => {
      const cache = await caches.open(localPackName)
      const keys = new Set((await cache.keys()).map(key => key.url))
      for (const file of files) {
        signal.throwIfAborted()
        if (keys.has(file.url)) report(file.size)
        else await cacheFile(cache, file.url, file.size, signal, report)
      }
    })().finally(() => { packDownload = undefined })
    return packDownload
  }

  function stopWorker(error: Error): void {
    worker?.terminate()
    worker = undefined
    pending.forEach(request => request.fail(error))
    pending.clear()
  }

  function request(message: LocalWork, signal: AbortSignal): Promise<string | undefined> {
    signal.throwIfAborted()
    if (!worker) {
      const started = new Worker(new URL('./translator.worker.ts', import.meta.url), { type: 'module' })
      started.onmessage = ({ data }: MessageEvent<LocalReply>) => {
        if (worker === started) pending.get(data.id)?.reply(data)
      }
      started.onerror = () => {
        if (worker === started) stopWorker(new DOMException('Local translation Worker failed', 'InvalidStateError'))
      }
      worker = started
    }
    const active = worker
    return new Promise((resolve, reject) => {
      const finish = () => {
        pending.delete(message.id)
        signal.removeEventListener('abort', abort)
      }
      const abort = () => {
        active.postMessage({ id: message.id, type: 'cancel' } satisfies LocalRequest)
        finish()
        reject(signal.reason)
      }
      pending.set(message.id, {
        reply: ({ result, error }) => {
          finish()
          if (error) reject(new DOMException(error, 'InvalidStateError'))
          else resolve(result)
        },
        fail: error => { finish(); reject(error) },
      })
      signal.addEventListener('abort', abort, { once: true })
      try { active.postMessage(message) } catch (error) { finish(); reject(error) }
    })
  }

  async function availability(pair: LanguagePair) {
    if (!supportsLocalPair(pair)) return 'unavailable'
    if (!needsNeuralModel(pair) || await cacheReady()) return 'available'
    // 缺失的清单可能由站点以 HTML 响应，仍应提示模型资产不可用。
    return await installedOnSite() ? 'downloadable' : 'model-unavailable'
  }

  return {
    availability,
    downloadWithoutActivation: true,
    prepareTimeout: 15 * 60_000,
    translateTimeout: 60_000,
    async create({ sourceLanguage, targetLanguage, signal, monitor }): Promise<TranslatorInstance> {
      const pair = { sourceLanguage, targetLanguage }
      if (!supportsLocalPair(pair)) throw new DOMException('Unsupported local translation pair', 'NotSupportedError')
      if (needsNeuralModel(pair) && !await cacheReady()) {
        // 下载由准备流程启动，普通翻译只使用已缓存的模型。
        if (!monitor) throw new DOMException('Local translation pack is unavailable', 'InvalidStateError')
        const events = new EventTarget()
        monitor(events)
        progressListeners.add(events)
        try {
          if (packDownload) events.dispatchEvent(new ProgressEvent('downloadprogress', progress))
          await downloadPack(signal)
        } finally {
          progressListeners.delete(events)
        }
      }
      await request({ id: ++nextId, type: 'prepare', pair, packUrl }, signal)
      const lifetime = new AbortController()
      return {
        async translate(text, options) {
          const result = await request({ id: ++nextId, type: 'translate', pair, packUrl, text },
            AbortSignal.any([lifetime.signal, options.signal]))
          if (result === undefined) throw new DOMException('Local translation returned no result', 'InvalidStateError')
          return result
        },
        destroy: () => lifetime.abort(),
      }
    },
    dispose: () => stopWorker(new DOMException('Translation runtime disposed', 'AbortError')),
  }
}
