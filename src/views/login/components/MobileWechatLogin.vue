<template>
  <div v-if='showWechatLogin' class='mobile-wechat-login'>
    <WechatBrowserLogin :record='wechatRecord' />
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue'
import WechatBrowserLogin from './WechatBrowserLogin.vue'

const props = withDefaults(
  defineProps<{
    record?: Record<string, any> | null
    isMobile?: boolean
  }>(),
  {
    record: null,
    isMobile: false
  }
)

const isWechatBrowser = computed(() => {
  if (typeof navigator === 'undefined') {
    return false
  }

  return /MicroMessenger/i.test(navigator.userAgent)
})

const wechatRecord = computed(() => props.record || undefined)
const showWechatLogin = computed(() => !!wechatRecord.value && props.isMobile && isWechatBrowser.value)
</script>

<style scoped lang='less'>
.mobile-wechat-login {
  width: 100%;
  max-width: 25rem;
  margin-top: var(--space-6);

  &__divider-text {
    color: var(--jet-theme-text-disabled);
    font-size: var(--fs-14);
    padding: 0 0.75rem;
  }

  :deep(.ant-divider) {
    margin: 1rem 0;
    border-color: var(--jet-theme-border-secondary);
  }
}

@media (max-width: 48rem) {
  .mobile-wechat-login {
    max-width: 100%;
  }
}</style>
