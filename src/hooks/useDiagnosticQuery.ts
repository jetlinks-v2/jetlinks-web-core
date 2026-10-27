import { getCurrentInstance, onDeactivated, onScopeDispose, ref, shallowRef } from 'vue'
import type { ViewState } from '../components/RuntimeDiagnostics/types'

export interface DiagnosticQueryOptions<T> {
  isEmpty?: (value: T) => boolean
  errorState?: (error: unknown) => ViewState
  retainData?: boolean
}
export interface DiagnosticQueryConfig { retainOnDeactivate?: boolean }

/** 宿主注入transport；新请求、清理或卸载后，旧响应无法覆盖当前目标。 */
export function useDiagnosticQuery<T>(config: DiagnosticQueryConfig = {}) {
  const data = shallowRef<T>()
  const state = ref<ViewState>({ status: 'ready' })
  let generation = 0
  let controller: AbortController | undefined
  let settledState: ViewState = { status: 'ready' }
  /** 暂停使在途响应失效，但保留已完成结果；取消加载不能留下永久loading。 */
  function cancel() {
    generation++; controller?.abort(); controller = undefined
    state.value = settledState
  }
  function clear(nextState: ViewState = { status: 'ready' }) {
    cancel()
    data.value = undefined; settledState = nextState; state.value = nextState
  }
  async function run(loader: (signal: AbortSignal) => Promise<T>, allowed: boolean, options: DiagnosticQueryOptions<T> = {}) {
    if (!allowed) { clear({ status: 'forbidden' }); return }
    if (options.retainData) cancel(); else clear()
    const current = generation
    controller = new AbortController()
    state.value = { status: 'loading' }
    try {
      const result = await loader(controller.signal)
      if (current !== generation) return
      data.value = result
      settledState = { status: options.isEmpty?.(result) ? 'empty' : 'ready', sampledAt: Date.now() }; state.value = settledState
    } catch (error) {
      if (current !== generation) return
      // HTTP / 命令错误由宿主解释，core 不依赖某一种 transport 的异常结构。
      settledState = options.errorState?.(error) ?? { status: 'error', message: error instanceof Error ? error.message : undefined }
      if (['forbidden', 'unsupported'].includes(settledState.status)) data.value = undefined
      state.value = settledState
    }
  }
  onScopeDispose(clear)
  if (getCurrentInstance()) onDeactivated(config.retainOnDeactivate ? cancel : clear)
  return { data, state, run, clear, cancel }
}
