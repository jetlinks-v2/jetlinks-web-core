import { AutoModelForSeq2SeqLM, AutoTokenizer, env, InterruptableStoppingCriteria, TranslationPipeline } from '@huggingface/transformers'
import { Converter } from 'opencc-js'
import { localPackName, needsNeuralModel, type LocalReply, type LocalRequest } from './pack'

type Work = Exclude<LocalRequest, { type: 'cancel' }>
const scope = self as unknown as {
  postMessage(message: LocalReply): void
  onmessage: (event: MessageEvent<LocalRequest>) => void
}
const toTraditional = Converter({ from: 'cn', to: 't' })
const toSimplified = Converter({ from: 't', to: 'cn' })
const jobs = new Map<number, AbortController>()
let queue = Promise.resolve()
let translator: Promise<TranslationPipeline> | undefined

/** WASM、词表和权重均从下载按钮准备的本地缓存加载。 */
async function loadTranslator(packUrl: string): Promise<TranslationPipeline> {
  const cache = await caches.open(localPackName)
  const wasm = await cache.match(new URL('ort-wasm-simd-threaded.jsep.wasm', packUrl))
  if (!wasm) throw new Error('Incomplete local translation runtime')
  const wasmOptions = env.backends.onnx.wasm
  if (!wasmOptions) throw new Error('WASM translation is unavailable')
  // 使用 ONNX ESM 自带的加载器，并提供离线缓存里的 WASM 二进制。
  wasmOptions.numThreads = 1
  wasmOptions.initTimeout = 60_000
  wasmOptions.wasmPaths = undefined
  wasmOptions.wasmBinary = await wasm.arrayBuffer()
  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.localModelPath = packUrl
  env.useBrowserCache = false
  env.useCustomCache = true
  env.customCache = {
    // 缓存缺项在加载阶段返回 404，交给下载入口处理。
    match: async (url: string) => await cache.match(url).catch(() => undefined) ?? new Response(null, { status: 404 }),
    put: cache.put.bind(cache),
  }
  const options = { device: 'wasm', dtype: 'q8', local_files_only: true } as const
  const [model, tokenizer] = await Promise.all([
    AutoModelForSeq2SeqLM.from_pretrained('model', options),
    AutoTokenizer.from_pretrained('model', options),
  ])
  return new TranslationPipeline({ task: 'translation', model, tokenizer })
}

/** 按原始语言对推理，繁体中文通过 OpenCC 转换字形。 */
async function run(work: Work, signal: AbortSignal): Promise<string | undefined> {
  signal.throwIfAborted()
  if (!needsNeuralModel(work.pair)) return work.type === 'translate' ? toTraditional(work.text) : undefined
  translator ??= loadTranslator(work.packUrl).catch(error => {
    translator = undefined
    throw error
  })
  const translate = await translator
  signal.throwIfAborted()
  if (work.type === 'prepare') return
  const { sourceLanguage, targetLanguage } = work.pair
  const simplified = sourceLanguage === 'zh-Hant' ? toSimplified(work.text) : work.text
  const stop = new InterruptableStoppingCriteria()
  const abort = () => stop.interrupt()
  signal.addEventListener('abort', abort, { once: true })
  try {
    const generation = translate.model.generation_config
    if (!generation) throw new Error('Missing local translation generation configuration')
    const options = {
      ...generation,
      src_lang: sourceLanguage === 'zh-Hant' ? 'zh' : sourceLanguage,
      tgt_lang: targetLanguage === 'zh-Hant' ? 'zh' : targetLanguage,
      num_beams: 1,
      max_new_tokens: 512,
      stopping_criteria: stop,
    }
    const [result] = await translate(simplified, options)
    signal.throwIfAborted()
    if (!result || Array.isArray(result)) throw new Error('Invalid translation result')
    return targetLanguage === 'zh-Hant' ? toTraditional(result.translation_text) : result.translation_text
  } finally {
    signal.removeEventListener('abort', abort)
  }
}

scope.onmessage = ({ data }) => {
  if (data.type === 'cancel') {
    jobs.get(data.id)?.abort()
    return
  }
  const controller = new AbortController()
  jobs.set(data.id, controller)
  // 一个模型实例串行处理推理，取消后跳过排队项并终止正在生成的译文。
  queue = queue.then(async () => {
    try {
      const result = await run(data, controller.signal)
      scope.postMessage({ id: data.id, result })
    } catch (error) {
      scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) })
    } finally {
      jobs.delete(data.id)
    }
  })
}
