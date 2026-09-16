<template>
  <section v-if="bindings.length" class="sso-login-methods">
    <div class="sso-title">{{ title }}</div>
    <div class="sso-list">
      <button
        v-for="item in bindings"
        :key="item.id"
        type="button"
        class="sso-button"
        :title="item.name"
        :aria-label="item.name"
        @click="$emit('select', item)"
      >
        <span class="sso-icon">
          <img :src="resolveSsoIcon(item)" :alt="item.name || ''" />
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { resolveSsoIcon } from '@jetlinks-web-core/utils/sso-icon'
import type { SsoBinding } from '../hooks/useSsoLogin'

defineProps<{
  title: string
  bindings: SsoBinding[]
}>()

defineEmits<{
  (e: 'select', item: SsoBinding): void
}>()
</script>

<style scoped lang="less">
.sso-login-methods {
  margin-top: var(--space-section);
}

.sso-title {
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

.sso-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(3rem, 1fr));
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-6);
}

.sso-button {
  display: grid;
  place-items: center;
  justify-self: center;
  width: 3rem;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-0.0625rem);
  }
}

.sso-icon {
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
</style>
