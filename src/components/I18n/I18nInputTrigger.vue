<template>
  <span
    class="i18n-input-trigger-wrapper"
    role="button"
    tabindex="0"
    :aria-label="$t('I18n.configure')"
    @mousedown.stop
    @click.stop="emit('configure')"
    @keydown.enter.stop.prevent="emit('configure')"
    @keydown.space.stop.prevent="emit('configure')"
  >
    <a-tooltip :title="$t('I18n.configure')">
      <AIcon class="i18n-input-trigger" type="GlobalOutlined" />
    </a-tooltip>
  </span>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  (event: 'configure'): void
}>()
</script>

<style scoped lang="less">
.i18n-input-trigger-wrapper {
  display: inline-flex;
}

.i18n-input-trigger {
  color: var(--jet-theme-primary);
  cursor: pointer;
}
</style>
