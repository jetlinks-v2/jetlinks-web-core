<template>
  <div class="login-panel-header">
    <button
      v-if="showBack"
      type="button"
      class="back-button"
      @click="$emit('back')"
    >
      <AIcon type="ArrowLeftOutlined" />
      <span>{{ backText }}</span>
    </button>

    <h2>{{ title }}</h2>
    <p v-if="description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    backText: string
    showBack?: boolean
  }>(),
  {
    description: '',
    showBack: false
  }
)

defineEmits<{
  (e: 'back'): void
}>()
</script>

<style scoped lang="less">
.login-panel-header {
  margin-bottom: var(--space-12);
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-5);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  cursor: pointer;
  transition: color 0.2s ease;

  &:hover {
    color: var(--jet-theme-primary);
  }
}

h2 {
  margin: 0;
  color: var(--code-dark-bg);
  font-size: var(--fs-32);
  font-weight: 700;
  line-height: 2.75rem;
  letter-spacing: 0;
}

p {
  margin: var(--space-4) auto 0;
  max-width: 21.4375rem;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-16);
  line-height: 1.25rem;
  text-align: center;
}

h2 {
  text-align: center;
}

@media (max-width: 48rem) {
  .login-panel-header {
    margin-bottom: var(--space-5);
  }

  h2 {
    font-size: var(--fs-28);
    line-height: 2.25rem;
  }
}
</style>
