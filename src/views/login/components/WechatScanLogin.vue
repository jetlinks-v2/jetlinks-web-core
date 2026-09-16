<template>
  <div class='wechat-scan-login'>

    <div v-if='qrCodeValue' ref="qrcodeWrapperRef" class='qrcode-wrapper'>
      <QRCode
        :value='qrCodeValue'
        :status='qrStatus'
        :size='qrcodeSize'
        :icon='showIcon'
        @refresh='refreshIframe'
      >
        <template #icon>
          <img
            :src='showIcon'
            :style='qrcodeIconStyle'
          />
        </template>
      </QRCode>
    </div>

    <div v-else-if='iframeUrl' class='iframe-wrapper'>
      <iframe
        :key='iframeKey'
        class='scan-iframe'
        :src='iframeUrl'
        frameborder='0'
        scrolling='no'
      />
    </div>

    <div v-else class='scan-empty'>
      {{ t('Login.wechatScanUnavailable') }}
    </div>
    <div class='scan-desc'>{{ scanDesc }}</div>
  </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { message, QRCode } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import { scanLoginAsync } from '@jetlinks-web-core/api/login'
import { useLoginSuccess } from '../hooks/useLoginSuccess'
import { useResponsiveQRCodeSize } from '../hooks/useResponsiveQRCodeSize'
import { useScanLoginCompletion } from '../hooks/useScanLoginCompletion'
import DingPng from '@jetlinks-web-core/assets/login/dingding.png'
import WeChat from '@jetlinks-web-core/assets/login/weChat.png'

const { handleLoginSuccess } = useLoginSuccess()
const t = i18n.global.t

const props = withDefaults(
  defineProps<{
    record?: Record<string, any>
    qrCodeKey?: string[]
    forBind?: boolean
  }>(),
  {
    record: () => ({}),
    qrCodeKey: () => [],
    forBind: false
  }
)
const emit = defineEmits<{
  (e: 'bind-success', result: AsyncLoginSuccessResult): void
}>()

interface AsyncLoginEvent {
  type?: string
  message?: string
  result?: Record<string, unknown> | string
}

interface AsyncLoginSuccessResult {
  token?: string
  bound?: boolean
  bindCode?: string
}

interface SubscriptionLike {
  unsubscribe?: () => void
}

const iframeKey = ref(0)
const iframeUrl = ref('')
const qrCodeValue = ref('')
const qrcodeWrapperRef = ref<HTMLElement | null>(null)

const streamSub = ref<SubscriptionLike | null>(null)
const { qrcodeSize, qrcodeIconStyle, updateQRCodeSize } = useResponsiveQRCodeSize(qrcodeWrapperRef)

const isOfficialAccountProvider = computed(() => {
  return props.record.provider === 'wechat-official-account'
})

const qrStatus = ref('loading')

const scanDesc = computed(() => (
  props.forBind ? t('Login.scanBindDescription') : t('Login.scanLoginDescription')
))

const showIcon = computed(() => {
  if (['wechat-webapp', 'wechat-official-account'].includes(props.record.provider)) {
    return WeChat
  }

  if (props.record.provider === 'dingtalk-ent-app') {
    return DingPng
  }
})

const stopAsyncLogin = () => {
  streamSub.value?.unsubscribe?.()
  streamSub.value = null
}

const { completeLogin, onCredentialStorage } = useScanLoginCompletion({
  beforeComplete: stopAsyncLogin,
  complete: handleLoginSuccess,
  disabled: () => props.forBind,
  onError: () => message.error(t('Login.loginFailed')),
})

const resolveIframeUrl = (result?: Record<string, unknown> | string) => {
  if (!result) {
    return ''
  }

  if (typeof result === 'string') {
    return result
  }

  const keys = ['url', 'redirectUrl', 'redirect', 'qrCodeUrl', 'qrcodeUrl']
  for (const key of keys) {
    const value = result[key]
    if (typeof value === 'string' && value) {
      return value
    }
  }

  return ''
}

const startAsyncLogin = () => {
  qrStatus.value = 'loading'
  stopAsyncLogin()
  iframeUrl.value = ''
  qrCodeValue.value = ''
  if (!props.record?.id) {
    return
  }

  iframeKey.value += 1

  streamSub.value = scanLoginAsync(props.record.id, props.forBind).subscribe({
    next: (payload: AsyncLoginEvent) => {
      if (!payload?.type) {
        return
      }

      if (payload.type === 'init') {
        const url = resolveIframeUrl(payload.result)
        if (url) {
          if (isOfficialAccountProvider.value) {
            qrCodeValue.value = url
            qrStatus.value = 'active'
            iframeUrl.value = ''
            updateQRCodeSize()
          } else {
            iframeUrl.value = url
            iframeKey.value += 1
          }
        }
        return
      }

      if (payload.type === 'processing') {
        return
      }

      if (payload.type === 'success') {
        const result = (payload.result || {}) as AsyncLoginSuccessResult
        if (props.forBind) {
          if (result.bound === false) {
            message.warning(i18n.global.t('SaasManager.generated.7c770d768e67'))
            return
          }
          stopAsyncLogin()
          emit('bind-success', result)
          return
        }

        if (result.token) {
          void completeLogin(result.token)
          return
        }
        if (result.bound === false) {
          message.warning(t('SaasManager.generated.7c770d768e67'))
        }
        return
      }

      if (payload.type === 'failed') {
        message.error(payload.message || t('Login.loginFailed'))
      }
    },
    error: () => {
      message.error(t('Login.loginFailed'))
    },
    complete: () => {
      streamSub.value = null
      qrStatus.value = 'expired'
    }
  })
}

const refreshIframe = () => startAsyncLogin()

onMounted(() => {
  window.addEventListener('storage', onCredentialStorage)
})

onUnmounted(() => {
  window.removeEventListener('storage', onCredentialStorage)
  stopAsyncLogin()
})

watch(
  () => props.record,
  () => {
    if (!props.record) {
      iframeUrl.value = ''
      qrCodeValue.value = ''
      stopAsyncLogin()
      return
    }
    startAsyncLogin()
  },
  { immediate: true }
)
</script>

<style scoped lang='less'>
.wechat-scan-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;

  .scan-desc {
    font-size: var(--fs-14);
    color: var(--jet-theme-text-secondary);
    margin-top: var(--space-4);
  }

  .iframe-wrapper {
    width: 100%;
    border-radius: 0.625rem;
    overflow: hidden;
    border: 0.0625rem solid var(--jet-theme-border-secondary);
    background: var(--jet-theme-bg-container);
  }

  .scan-iframe {
    width: 100%;
    height: 26.25rem;
    display: block;
  }

  .qrcode-wrapper {
    width: 100%;
    min-height: min(42vh, 16.5rem);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    > div {
      border: none
    }
  }

  .scan-empty {
    width: 12.375rem;
    height: 12.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--jet-theme-text-disabled);
    font-size: var(--fs-14);
    border: 0.0625rem dashed var(--jet-theme-border);
    border-radius: 0.625rem;
  }
}</style>
