<template>
  <altcha-widget
    v-if="open"
    ref="widgetRef"
    :class="{ 'is-loading': !ready }"
    :inert="!ready"
    :aria-busy="String(!ready)"
    class="altcha-captcha"
    data-testid="altcha-captcha"
  />
</template>

<script setup lang="ts">
import 'altcha/external'
import 'altcha/altcha.css'
import 'altcha/i18n/en'
import 'altcha/i18n/zh-cn'
import Pbkdf2Worker from 'altcha/workers/pbkdf2?worker'
import type { AltchaWidgetElement } from './types'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import {
  getAltchaCaptchaChallenge,
  prevalidateAltchaCaptcha,
  type AltchaCaptchaChallenge,
  type AltchaCaptchaConfig,
  type AltchaCaptchaContext,
  type AltchaCaptchaProof,
} from '@jetlinks-web-core/api/verify'

$altcha.algorithms.set('PBKDF2/SHA-256', () => new Pbkdf2Worker())
$altcha.algorithms.set('PBKDF2/SHA-384', () => new Pbkdf2Worker())
$altcha.algorithms.set('PBKDF2/SHA-512', () => new Pbkdf2Worker())

const props = defineProps<{
  config: AltchaCaptchaConfig
  contextToken?: string
  verifyKey?: string
  open: boolean
}>()

const emit = defineEmits<{
  success: [proof: AltchaCaptchaProof]
  fail: [error: Error]
  expired: []
  ready: []
}>()

const widgetRef = ref<AltchaWidgetElement>()
const ready = ref(false)
let requestController: AbortController | undefined
let challengeSequence = 0
let disposed = false

function getContext(): AltchaCaptchaContext | undefined {
  const key = props.verifyKey?.trim()
  const contextToken = props.contextToken?.trim()
  if (Boolean(key) === Boolean(contextToken)) {
    return undefined
  }
  return key ? { key } : { contextToken: contextToken! }
}

function getResult<T>(response: { result?: T }): T {
  if (response.result === undefined) {
    throw new Error('ALTCHA response is missing its result')
  }
  return response.result
}

function getLanguage() {
  return String(i18n.global.locale.value).toLowerCase().startsWith('zh') ? 'zh-cn' : 'en'
}

function applyAltchaI18n() {
  const strings = {
    label: i18n.global.t('verify.altchaStart'),
    verifying: i18n.global.t('verify.altchaVerifying'),
    verified: i18n.global.t('verify.altchaVerified'),
    error: i18n.global.t('verify.altchaError'),
  }
  for (const language of ['en', 'zh-cn'] as const) {
    $altcha.i18n.set(language, {
      ...$altcha.i18n.get(language),
      ...strings,
    })
  }
}

function resetWidget() {
  challengeSequence += 1
  ready.value = false
  requestController?.abort()
  requestController = undefined
}

applyAltchaI18n()

async function loadChallenge() {
  if (disposed) {
    return
  }
  resetWidget()
  if (disposed || !props.open) {
    return
  }
  applyAltchaI18n()
  const context = getContext()
  if (!context) {
    return
  }

  const sequence = challengeSequence
  const controller = new AbortController()
  requestController = controller
  try {
    const response = await getAltchaCaptchaChallenge(props.config.challengeUrl, context, { signal: controller.signal })
    const challenge = getResult<AltchaCaptchaChallenge>(response)
    if (sequence !== challengeSequence || !widgetRef.value) {
      return
    }
    const language = getLanguage()
    await widgetRef.value.configure({
      auto: 'off',
      challenge,
      credentials: 'include',
      hideFooter: true,
      hideLogo: true,
      language,
      retryOnOutOfMemoryError: false,
      workers: 2,
    })
    if (sequence === challengeSequence) {
      ready.value = true
      emit('ready')
    }
  } catch (error) {
    if (sequence === challengeSequence) {
      emit('fail', error instanceof Error ? error : new Error('Unable to load ALTCHA challenge'))
    }
  } finally {
    if (sequence === challengeSequence && requestController === controller) {
      requestController = undefined
    }
  }
}

async function onVerified(event: Event) {
  const payload = (event as CustomEvent<{ payload?: unknown }>).detail?.payload
  const context = getContext()
  if (typeof payload !== 'string' || !context) {
    resetWidget()
    emit('fail', new Error('ALTCHA verification payload is invalid'))
    return
  }

  const sequence = challengeSequence
  requestController?.abort()
  const controller = new AbortController()
  requestController = controller
  try {
    const response = await prevalidateAltchaCaptcha(
      props.config.prevalidateUrl,
      { ...context, payload },
      { signal: controller.signal }
    )
    const proof = getResult<AltchaCaptchaProof>(response)
    if (
      sequence !== challengeSequence ||
      typeof proof.proof !== 'string' ||
      proof.proof.trim().length === 0 ||
      !Number.isFinite(proof.expiresAt)
    ) {
      throw new Error('ALTCHA prevalidation proof is invalid')
    }
    if (proof.expiresAt <= Date.now()) {
      resetWidget()
      emit('expired')
      await nextTick()
      loadChallenge()
      return
    }
    emit('success', { proof: proof.proof.trim(), expiresAt: proof.expiresAt })
  } catch (error) {
    if (sequence === challengeSequence) {
      resetWidget()
      emit('fail', error instanceof Error ? error : new Error('Unable to prevalidate ALTCHA response'))
      await nextTick()
      if (!disposed && props.open) {
        loadChallenge()
      }
    }
  } finally {
    if (sequence === challengeSequence && requestController === controller) {
      requestController = undefined
    }
  }
}

function onStateChange(event: Event) {
  const state = (event as CustomEvent<{ state?: string }>).detail?.state
  if (state === 'expired') {
    resetWidget()
    emit('expired')
    loadChallenge()
  }
}

watch(
  () => [props.open, props.verifyKey, props.contextToken, props.config.challengeUrl, props.config.prevalidateUrl],
  async () => {
    await nextTick()
    if (props.open) {
      await loadChallenge()
    } else {
      resetWidget()
    }
  },
  { flush: 'post' }
)

onMounted(loadChallenge)

watch(widgetRef, (widget, previousWidget) => {
  previousWidget?.removeEventListener('verified', onVerified)
  previousWidget?.removeEventListener('statechange', onStateChange)
  widget?.addEventListener('verified', onVerified)
  widget?.addEventListener('statechange', onStateChange)
})

onBeforeUnmount(() => {
  disposed = true
  resetWidget()
})
</script>

<style scoped>
.altcha-captcha {
  display: block;
  margin: 0 auto;
  width: 100%;
}

.altcha-captcha.is-loading {
  pointer-events: none;
  opacity: 0.65;
}
</style>
