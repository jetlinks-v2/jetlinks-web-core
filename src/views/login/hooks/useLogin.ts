import globalI18n from '@jetlinks-web-core/locales'
import { computed, onBeforeUnmount, reactive, ref, toRaw } from 'vue'
import { message } from 'ant-design-vue'
import { encrypt } from '@jetlinks-web/utils'
import { useLoginConfig } from './useLoginConfig'
import { useCaptchaVerify } from './useCaptchaVerify'
import { useLoginSuccess } from './useLoginSuccess'
import {
  encryptionConfig,
  identityRequest,
  identityConfirm,
  codeUrlWithoutProjectContext,
  loginWithoutProjectContext,
} from '@jetlinks-web-core/api/login'
import { useRequest } from '@jetlinks-web/hooks'
import {useBusinessApplicationStore, useMenuStore} from '@jetlinks-web-core/store'
import {setProjectStorage} from "@jetlinks-web-core/utils";

interface UseLoginOptions {
  shouldAutoLoadVerifyCode?: () => boolean
}

/** `/authorize/login/configs` 返回的登录加密配置。 */
interface LoginEncryptionConfig {
  encrypt?: {
    enabled?: boolean
    publicKey?: string
    id?: string
  }
}

/** 后端开启登录加密时，公钥有效期有限，按旧登录页逻辑定期刷新。 */
const ENCRYPTION_REFRESH_INTERVAL = 3 * 60 * 1000

export function useLogin(config: Ref<any>, options: UseLoginOptions = {}) {
  const { providers, loading: configLoading } = useLoginConfig()
  const { captchaOpen, openCaptcha, onCaptchaSuccess } = useCaptchaVerify()
  const menuStore = useMenuStore()
  const { handleLoginSuccess } = useLoginSuccess()

  const loading = ref(false)
  const countdown = ref(0)
  let timer: any = null
  let encryptionTimer: ReturnType<typeof setTimeout> | null = null

  const clearEncryptionTimer = () => {
    if (encryptionTimer) {
      clearTimeout(encryptionTimer)
      encryptionTimer = null
    }
  }

  const { data: encryption, run: reloadEncryption } = useRequest<
    LoginEncryptionConfig,
    LoginEncryptionConfig
  >(encryptionConfig, {
    onSuccess() {
      clearEncryptionTimer()
      encryptionTimer = setTimeout(() => reloadEncryption(), ENCRYPTION_REFRESH_INTERVAL)
    },
  })

  onBeforeUnmount(clearEncryptionTimer)

  /** 后端开启加密时，密码必须用当前公钥加密并带上 encryptId，否则登录会失败。 */
  const applyPasswordEncryption = (params: Record<string, any>) => {
    const _encrypt = encryption.value?.encrypt
    if (!_encrypt?.enabled || !_encrypt.publicKey) {
      return params
    }

    return {
      ...params,
      password: encrypt(String(params.password), _encrypt.publicKey),
      encryptId: _encrypt.id,
    }
  }

  const formData = reactive({
    username: undefined, // For password login
    password: undefined, // For password login
    identity: undefined, // Phone/Email for code login
    code: undefined,     // Verification code
    provider: undefined, // Selected provider id
    remember: false,
    verifyCode: undefined,
    verifyKey: undefined,
    type: undefined,
  })

  // Helper: Start 60s countdown
  const startCountdown = (time) => {
    countdown.value = time
    if (timer) clearInterval(timer)
    timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(timer)
        timer = null
      }
    }, 1000)
  }

  // Action: Send Verification Code
  const handleSendCode = async (provider: string) => {
    if (!formData.identity) {
      message.error(globalI18n.global.t('SaasManager.generated.c95fc02fafe7'))
      return
    }

    loading.value = true
    try {
      await identityRequest({
        provider,
        identity: formData.identity
      }).then(res => {
        message.success(globalI18n.global.t('AccountInfo.validationSmsSent'))
        startCountdown(res.result.intervalSeconds)

        sessionStorage.setItem('identity', JSON.stringify(res.result))
      })

    } catch (e: any) {
      console.error(e)
      // If error indicates captcha needed, handle it here
    } finally {
      loading.value = false
    }
  }

  const { data: imageUrl, run: getCode } = useRequest(codeUrlWithoutProjectContext, {
    immediate: false,
    onSuccess(resp) {
      if (config.value && resp.result?.key) {
        formData.verifyKey = resp.result?.key;
      }
      return resp.result?.base64
    },
  });

  const resolveRedirectPath = () => {
    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex < 0) return '/'

    const searchParams = new URLSearchParams(hash.slice(queryIndex + 1))
    return searchParams.get('redirect') || '/'
  }

  // Action: Confirm Login (Password or Code)
  const handleLogin = async (loginType: 'password' | 'code') => {
    // Basic validation

    const businessApplicationStore = useBusinessApplicationStore()

    let _params: Record<string, any> = {}
    let requestFn = undefined
    if (loginType === 'password') {
      if (!formData.username || !formData.password) {
        message.warn(globalI18n.global.t('SaasManager.generated.bd48a5228847'))
        return
      }
      _params.username = formData.username
      _params.password = formData.password
      _params.verifyCode = formData.verifyCode
      _params.verifyKey = formData.verifyKey
      _params.expires = formData.remember ? 7*24*60*60*1000 : 3600000

      _params = applyPasswordEncryption(_params)

      requestFn = loginWithoutProjectContext
    } else {
      if (!formData.identity || !formData.code) {
        message.warn(globalI18n.global.t('SaasManager.generated.26df1bdbecc1'))
        return
      }
      const _data = JSON.parse(sessionStorage.getItem('identity') || '{}')
      _params.requestId = _data?.requestId
      _params.token = _data?.token
      _params.context = _data?.context
      _params.params = {
        code: formData.code,
      }
      _params.provider = formData.type

      requestFn = identityConfirm
    }

    loading.value = true
    try {
        const response = await requestFn(_params)
        message.success(globalI18n.global.t('Login.loginSuccess'))
        let options = { username: _params.username}

        await handleLoginSuccess(response.result.token, options)

    } catch {
      if (loginType === 'password') {
        getVerifyCode()
        // 登录失败可能因为验证码或公钥过期，重取验证码的同时刷新加密配置。
        if (encryption.value?.encrypt?.enabled) {
          reloadEncryption()
        }
      }
    } finally {
        loading.value = false
    }
  }

  const getVerifyCode = () => {
    const _config = config.value
    if (config && _config.enabled && _config.type === 'image' && _config.loginWithVerify === false) {
      getCode()
    }
  }

  watch(() => config.value?.enabled && config.value?.type === 'image', (enabled) => {
    if (enabled && (options.shouldAutoLoadVerifyCode?.() ?? true)) {
      getVerifyCode()
    }
  })

  return {
    loading,
    formData,
    countdown,
    captchaOpen,
    providers,
    imageUrl,
    getCode:getVerifyCode,
    openCaptcha,
    onCaptchaSuccess,
    handleSendCode,
    handleLogin
  }
}
