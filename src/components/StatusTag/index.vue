<template>
  <span
    class="status-tag"
    :class="[
      `status-tag--${status}`,
      { 'status-tag--borderless': !bordered },
    ]"
  >
    <span v-if="$slots.icon" class="status-tag__icon">
      <slot name="icon" />
    </span>
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

export type StatusTagStatus = 'success' | 'warning' | 'error' | 'info' | 'processing' | 'default' | 'disabled'

defineProps({
  /** 状态颜色只表达展示语义，业务状态值应由调用方先完成映射。 */
  status: {
    type: String as PropType<StatusTagStatus>,
    default: 'default',
  },
  text: {
    type: String,
    default: undefined,
  },
  bordered: {
    type: Boolean,
    default: true,
  },
})
</script>

<style scoped>
.status-tag {
  --status-tag-color: var(--jet-theme-text-secondary);
  --status-tag-success: #06c170;
  --status-tag-warning: #f18900;
  --status-tag-error: #f84343;
  --status-tag-info: #1593ff;
  --status-tag-disabled: #86909c;

  display: inline-flex;
  align-items: center;
  width: max-content;
  min-height: 1.5rem;
  box-sizing: border-box;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: var(--jet-theme-stroke-width) solid color-mix(in srgb, var(--status-tag-color) 20%, transparent);
  border-radius: 62.4375rem;
  background: color-mix(in srgb, var(--status-tag-color) 10%, transparent);
  color: var(--status-tag-color);
  font-size: var(--fs-13);
  font-weight: 500;
  line-height: 1rem;
  white-space: nowrap;
}

.status-tag--success {
  --status-tag-color: var(--status-tag-success);
}

.status-tag--warning {
  --status-tag-color: var(--status-tag-warning);
}

.status-tag--error {
  --status-tag-color: var(--status-tag-error);
}

.status-tag--info {
  --status-tag-color: var(--status-tag-info);
}

.status-tag--processing {
  --status-tag-color: var(--jet-theme-primary);
}

.status-tag--disabled {
  --status-tag-color: var(--status-tag-disabled);
}

.status-tag--borderless {
  border-color: transparent;
}

.status-tag__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  font-size: 0.875rem;
  line-height: 1;
}
</style>
