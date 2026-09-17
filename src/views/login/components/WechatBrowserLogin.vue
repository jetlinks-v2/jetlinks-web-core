<template>
  <div class='wechat-browser-login'>
    <a-button
      type='primary'
      size='large'
      class='wechat-browser-login__button'
      :loading='directLoginLoading'
      @click='handleWechatBrowserLogin'
    > {{ $t('SaasManager.generated.e2537363335a') }} </a-button>
  </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue'
import { toRuntimeHashHref } from '../utils/redirect'

const props = withDefaults(
  defineProps<{
    record?: Record<string, any>
  }>(),
  {
    record: () => ({})
  }
)

const appId = computed(() => props.record?.config?.appId)
const directLoginLoading = ref(false)

const resolveScanToken = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  const hashQuery = window.location.hash.split('?')[1] || ''
  const hashParams = new URLSearchParams(hashQuery)
  const hashToken = hashParams.get('t')
  if (hashToken) {
    return hashToken
  }

  return localStorage.getItem('t') || ''
}

const handleWechatBrowserLogin = () => {
  if (!appId.value || directLoginLoading.value) {
    return
  }

  directLoginLoading.value = true
  const scanToken = resolveScanToken()
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wechatAppId', appId.value)
    if (scanToken) {
      localStorage.setItem('t', scanToken)
    }
  }
  const redirect = encodeURIComponent(`${window.location.origin}${toRuntimeHashHref('/weixin/callback')}`)
  const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${appId.value}&redirect_uri=${redirect}&response_type=code&scope=snsapi_userinfo&state=123#wechat_redirect`
  window.location.href = url
}
</script>

<style scoped lang='less'>
.wechat-browser-login {
  width: 100%;

  &__button {
    width: 100%;
    height: 2.625rem;
    border-radius: var(--jet-theme-radius-lg);
    font-weight: 500;
  }
}</style>
