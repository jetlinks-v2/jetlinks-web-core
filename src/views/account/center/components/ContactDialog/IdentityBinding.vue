<script setup lang="ts">
import type { PropType } from 'vue'
import { useIdentityBinding, type IdentityProvider } from './useIdentityBinding'
const props = defineProps({ provider: { type: String as PropType<IdentityProvider>, required: true } })
const { identities, identity, code, validation, countdown, busy, loading, failed, validIdentity, load, sendCode, confirm, unbind } = useIdentityBinding(props.provider, true)
</script>

<template>
  <section class="identity-binding">
    <h4>{{ $t('PersonalCenter.loginIdentity') }}</h4>
    <p>{{ $t('PersonalCenter.identityHint') }}</p>
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.identityFailed')">
      <template #action><a-button type="link" :disabled="busy" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-spin :spinning="loading">
      <div v-for="item in identities" :key="item.id" class="identity-binding__item">
        <span>{{ item.identity }}</span>
        <a-popconfirm :title="$t('AccountInfo.deleteConfirm')" @confirm="unbind(item.id)">
          <a-button type="link" size="small" :disabled="busy">{{ $t('AccountInfo.unbind') }}</a-button>
        </a-popconfirm>
      </div>
    </a-spin>
    <a-space direction="vertical" class="identity-binding__form">
      <a-input v-model:value="identity" :disabled="busy" :aria-label="$t(provider === 'mobile' ? 'AccountInfo.basicPhone' : 'AccountInfo.basicEmail')" :placeholder="$t(provider === 'mobile' ? 'AccountInfo.pleaseEnterPhone' : 'AccountInfo.pleaseEnterEmail')" />
      <div class="identity-binding__code">
        <a-input v-model:value="code" :disabled="!validation || busy" :placeholder="$t('AccountInfo.enterCode')" :aria-label="$t('AccountInfo.enterCode')" />
        <a-button :loading="busy && !validation" :disabled="busy || loading || !!countdown || !validIdentity" @click="sendCode">
          {{ countdown ? $t('PersonalCenter.resendIn', { seconds: countdown }) : $t('PersonalCenter.sendCode') }}
        </a-button>
      </div>
      <a-button type="primary" :loading="busy && !!validation" :disabled="busy || !validation || !code.trim()" @click="confirm">{{ $t('PersonalCenter.confirmBinding') }}</a-button>
    </a-space>
  </section>
</template>

<style scoped>
.identity-binding { border-top: 1px solid var(--line); padding-top: var(--space-4); margin-top: var(--space-6); }
h4 { font-size: var(--fs-14); margin: 0; }
p { color: var(--text-color-secondary); font-size: var(--fs-12); margin: var(--space-2) 0; }
.identity-binding__item { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); overflow-wrap: anywhere; }
.identity-binding__form { width: 100%; margin-top: var(--space-3); }
.identity-binding__code { display: flex; gap: var(--space-2); }
</style>
