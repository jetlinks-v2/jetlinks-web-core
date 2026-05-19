<template>
  <span class="meta-chip" :class="toneClass">
    <slot name="prefix" />
    <slot>
      <template v-if="label">{{ label }}</template>
    </slot>
    <b v-if="value !== undefined" class="value">{{ value }}</b>
  </span>
</template>

<script setup lang="ts">
/**
 * 通用胶囊。两种用法：
 *   <MetaChip label="项目" :value="12" />
 *   <MetaChip tone="warn">⚠ <b>3</b> 待处理告警</MetaChip>
 */
const props = defineProps<{
  label?: string
  value?: string | number
  tone?: 'default' | 'warn' | 'ok' | 'danger' | 'info'
}>()

const toneClass = computed(() => `t-${props.tone ?? 'default'}`)
</script>

<style scoped>
.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.1875rem 0.625rem;
  border-radius: 62.4375rem;
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-12);
  line-height: 1.5;
}
.meta-chip .value,
.meta-chip :deep(b) {
  color: var(--jet-theme-text);
  font-weight: 600;
}

.t-warn {
  background: var(--warn-bg);
  color: var(--jet-theme-warning);
}
.t-warn .value,
.t-warn :deep(b) {
  color: var(--jet-theme-warning);
}

.t-ok {
  background: var(--ok-bg);
  color: var(--jet-theme-success);
}
.t-danger {
  background: var(--err-bg);
  color: var(--jet-theme-error);
}
.t-info {
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-primary);
}</style>
