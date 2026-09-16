<template>
  <div class="wechat-callback-login">
    <a-spin :spinning="callbackLoginLoading">
      <div class="wechat-callback-login__card">
        <div class="wechat-callback-login__title">{{ $t('SaasManager.generated.e2537363335a') }}</div>
        <div class="wechat-callback-login__desc">{{ statusText }}</div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import globalI18n from '@jetlinks-web-core/locales'

import { computed, onMounted, ref } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import { notifyApplicationLoginResult } from '@jetlinks-web-core/api/login'
import { useLoginSuccess } from '../hooks/useLoginSuccess'

const callbackLoginLoading = ref(false)
const statusText = computed(() => callbackLoginLoading.value ? globalI18n.global.t('SaasManager.generated.60509ff13809') : globalI18n.global.t('SaasManager.generated.76a6ea50ebb9'))
const { handleLoginSuccess } = useLoginSuccess()

const resolveUrlParams = () => {
  const params = new URLSearchParams()

  if (typeof window === 'undefined') {
    return params
  }

  new URLSearchParams(window.location.search).forEach((value, key) => {
    params.set(key, value)
  })

  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.split('?')[1]
    : ''

  if (hashQuery) {
    new URLSearchParams(hashQuery).forEach((value, key) => {
      if (!params.has(key)) {
        params.set(key, value)
      }
    })
  }

  return params
}

const resolveWechatCode = () => {
  return resolveUrlParams().get('code') || ''
}

const resolveAppId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return localStorage.getItem('wechatAppId') || ''
}

const handleWechatCallbackLogin = async () => {
  const code = resolveWechatCode()
  const appId = resolveAppId()
  if (!code || !appId || callbackLoginLoading.value) {
    return
  }

  callbackLoginLoading.value = true
  try {
    const response = await notifyApplicationLoginResult(appId, code)
    const result = response.result

    if (!result?.token) {
      onlyMessage(
        result?.bound === false
          ? globalI18n.global.t('SaasManager.generated.7c770d768e67')
          : globalI18n.global.t('Login.loginFailed'),
        result?.bound === false ? 'warning' : 'error',
      )
      return
    }

    localStorage.removeItem('wechatAppId')
    await handleLoginSuccess(result.token)
  } catch (error: any) {
    console.error('Wechat callback login failed:', error)
    onlyMessage(error?.message || globalI18n.global.t('SaasManager.generated.5f69d92886f9'), 'error')
  } finally {
    callbackLoginLoading.value = false
  }
}

onMounted(() => {
  handleWechatCallbackLogin()
})
</script>

<style scoped lang="less">
.wechat-callback-login {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 15rem;

  &__card {
    min-width: 15rem;
    padding: var(--space-8);
    text-align: center;
    border-radius: 0.75rem;
    background: var(--jet-theme-bg-container);
    box-shadow: 0 0.5rem 1.5rem var(--jet-theme-border-secondary);
  }

  &__title {
    margin-bottom: var(--space-2);
    color: var(--jet-theme-text);
    font-size: var(--fs-18);
    font-weight: 600;
  }

  &__desc {
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-14);
  }
}</style>
