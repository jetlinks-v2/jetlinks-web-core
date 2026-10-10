import { computed, onScopeDispose, shallowRef } from 'vue'

export interface CaptchaVerifyOptions<TContext> {
  context?: TContext
  signal?: AbortSignal
}

interface PendingCaptcha<TResult, TContext> {
  context?: TContext
  resolve: (result: TResult) => void
  reject: (error: Error) => void
  removeAbortListener?: () => void
}

/** Owns one verification wait per scope; rendering, proof validation and business requests stay with callers. */
export function useCaptchaVerify<TResult = unknown, TContext = undefined>() {
  const pending = shallowRef<PendingCaptcha<TResult, TContext>>()
  let disposed = false

  // Clear the session atomically before notifying UI or settling its caller.
  const release = (session: PendingCaptcha<TResult, TContext>) => {
    session.removeAbortListener?.()
    pending.value = undefined
  }

  const closeCaptcha = (error = new Error('Captcha closed by user')) => {
    const session = pending.value
    if (!session) return
    release(session)
    session.reject(error)
  }

  // Existing Captcha v-model bindings can close a wait, but opening requires a caller Promise.
  const captchaOpen = computed({
    get: () => pending.value !== undefined,
    set: (open: boolean) => { if (!open) closeCaptcha() },
  })
  const context = computed(() => pending.value?.context)

  const openCaptcha = ({ context, signal }: CaptchaVerifyOptions<TContext> = {}): Promise<TResult> => {
    if (disposed || signal?.aborted) return Promise.reject(new Error('Captcha cancelled'))
    if (pending.value) return Promise.reject(new Error('Captcha already pending'))
    return new Promise<TResult>((resolve, reject) => {
      const session: PendingCaptcha<TResult, TContext> = { context, resolve, reject }
      const onAbort = () => { if (pending.value === session) closeCaptcha() }
      signal?.addEventListener('abort', onAbort, { once: true })
      session.removeAbortListener = () => signal?.removeEventListener('abort', onAbort)
      pending.value = session
    })
  }

  const onCaptchaSuccess = (result: TResult) => {
    const session = pending.value
    if (!session) return
    release(session)
    session.resolve(result)
  }

  onScopeDispose(() => {
    disposed = true
    closeCaptcha()
  })

  return { captchaOpen, context, openCaptcha, onCaptchaSuccess, closeCaptcha }
}
