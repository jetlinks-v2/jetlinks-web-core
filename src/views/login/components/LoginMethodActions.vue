<template>
  <div v-if="methods.length" class="login-method-actions">
    <div class="method-title">{{ title }}</div>
    <div class="method-list">
      <button
        v-for="method in methods"
        :key="method.key"
        type="button"
        class="method-button"
        :class="{ active: method.key === activeMode }"
        @click="$emit('change', method.key)"
      >
        <span class="method-icon">
          <img :src="methodImages[method.key]" alt="" />
        </span>
        <span>{{ method.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import DefaultImage from '@jetlinks-web-core/assets/login/default.png'
import EmailImage from '@jetlinks-web-core/assets/login/email.png'
import PhoneImage from '@jetlinks-web-core/assets/login/phone.png'
import WechatImage from '@jetlinks-web-core/assets/login/weChat.png'

const methodImages: Record<string, string> = {
  subAccount: DefaultImage,
  password: DefaultImage,
  mobile: PhoneImage,
  wechat: WechatImage,
  email: EmailImage
}

defineProps<{
  title: string
  methods: Array<{
    key: string
    label: string
    icon: string
  }>
  activeMode?: string
}>()

defineEmits<{
  (e: 'change', key: string): void
}>()
</script>

<style scoped lang="less">
.login-method-actions {
  margin-top: var(--space-section);
}

.method-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 0.0625rem;
    background: var(--jet-theme-border-secondary);
  }
}

.method-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-10);
}

.method-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  width: 3rem;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  cursor: pointer;
  line-height: 1.25rem;
  justify-self: center;
  white-space: nowrap;
  transition: color 0.2s ease;

  &:hover,
  &.active {
    color: var(--jet-theme-primary);
  }
}

.method-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background: var(--jet-theme-bg-container);

  img {
    display: block;
    width: 2.125rem;
    height: 2.125rem;
    object-fit: contain;
  }
}

@media (max-width: 48rem) {
  .method-list {
    gap: var(--space-2);
  }

  .method-button {
    min-height: 2rem;
  }
}
</style>
