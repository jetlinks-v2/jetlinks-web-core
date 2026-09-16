import { ref } from 'vue'
import { TOKEN_KEY } from '@jetlinks-web/constants'

interface UseScanLoginCompletionOptions {
  beforeComplete: () => void
  complete: (token: string) => Promise<void>
  disabled?: () => boolean
  onError: () => void
}

/**
 * 合并扫码流和 iframe storage 两个完成信号，确保同一次登录只初始化一次会话。
 * 初始化失败时释放互斥锁并交给调用方提示，允许用户刷新二维码后重试。
 */
export const useScanLoginCompletion = (options: UseScanLoginCompletionOptions) => {
  const loginInProgress = ref(false)

  const completeLogin = async (token: string) => {
    if (!token || loginInProgress.value) {
      return
    }

    loginInProgress.value = true
    try {
      options.beforeComplete()
      await options.complete(token)
    } catch {
      loginInProgress.value = false
      options.onError()
    }
  }

  const onCredentialStorage = (event: StorageEvent) => {
    if (options.disabled?.() || event.key !== TOKEN_KEY || !event.newValue) {
      return
    }

    void completeLogin(event.newValue)
  }

  return {
    completeLogin,
    onCredentialStorage,
  }
}
