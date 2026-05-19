<template>
  <div class="identity-result-page">
    <div class="identity-result-card">
      <div v-if="isSuccess" class="result-icon success">
        <CheckCircleOutlined />
      </div>
      <div v-else class="result-icon error">
        <CloseCircleOutlined />
      </div>
      <div class="result-title">{{ isSuccess ? $t('IdentityResult.successTitle') : $t('IdentityResult.failTitle') }}</div>
      <div class="result-message">{{ displayMessage }}</div>
      <a-button type="primary" class="result-btn" @click="goCenter">
        {{ $t('IdentityResult.goCenter') }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()
const route = useRoute()
const router = useRouter()

const isSuccess = computed(() => {
  const s = route.query.success
  return s === 'true' || s === true
})

const displayMessage = computed(() => {
  const msg = route.query.message
  if (msg && typeof msg === 'string') return decodeURIComponent(msg)
  return isSuccess.value ? $t('IdentityResult.defaultSuccess') : $t('IdentityResult.defaultFail')
})

function goCenter() {
  router.replace('/account/center')
}
</script>

<style lang="less" scoped>
.identity-result-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--jet-theme-bg-layout);
}

.identity-result-card {
  background: var(--jet-theme-bg-container);
  border-radius: var(--r-3);
  padding: var(--space-12) calc(var(--space-12) + var(--space-2));
  text-align: center;
  box-shadow: var(--shadow-1);
  min-width: 22.5rem;
}

.result-icon {
  font-size: var(--fs-64);
  margin-bottom: var(--space-6);

  &.success {
    color: var(--jet-theme-success);
  }

  &.error {
    color: var(--jet-theme-error);
  }
}

.result-title {
  font-size: var(--fs-20);
  font-weight: 600;
  color: var(--jet-theme-text-title);
  margin-bottom: var(--space-3);
}

.result-message {
  font-size: var(--fs-14);
  color: var(--jet-theme-text-secondary);
  margin-bottom: var(--space-8);
  word-break: break-word;
}

.result-btn {
  min-width: 7.5rem;
}</style>
