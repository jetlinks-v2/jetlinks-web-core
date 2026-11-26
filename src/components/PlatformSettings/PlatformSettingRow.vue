<template>
  <div class="settings-row" :class="{ 'settings-row--active': active }" :data-setting="field">
    <span class="settings-row__icon"><AIcon :type="icon" /></span>
    <div class="settings-row__body">
      <div v-if="label" class="settings-row__label">{{ label }}</div>
      <slot />
      <p v-if="description" class="settings-row__description">{{ description }}</p>
    </div>
    <div v-if="$slots.action" class="settings-row__action"><slot name="action" /></div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ field: string; icon: string; label?: string; description?: string; active?: boolean }>()
</script>
<style scoped>
.settings-row { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4) 0; min-width: 0; }
.settings-row + .settings-row { border-top: 1px solid var(--line); }
.settings-row--active { background: var(--jet-theme-bg-elevated); }
.settings-row__icon { display: flex; align-items: center; justify-content: center; flex: none; width: 2rem; height: 2rem; border-radius: var(--r-pill); background: var(--bg-sunken); color: var(--text-color-secondary); }
.settings-row__body { flex: 1; min-width: 0; }
.settings-row__label { color: var(--text-color); font-weight: 500; font-size: var(--fs-14); }
.settings-row__description { color: var(--text-color-secondary); font-size: var(--fs-12); margin: var(--space-1) 0 0; line-height: 1.7; }
.settings-row__action { display: flex; align-items: center; gap: var(--space-3); flex: none; }
.settings-row :deep(.inline-edit-form__grid) { grid-template-columns: minmax(0, 1fr); }
.settings-row :deep(.inline-edit-field--detail) { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: baseline; gap: 0 var(--space-4); }
.settings-row :deep(.inline-edit-field__label) { color: var(--text-color); font-size: var(--fs-14); font-weight: 500; margin: 0; }
.settings-row :deep(.inline-edit-field__hint) { grid-column: 1 / -1; }
.settings-row :deep(.inline-edit-field__editor) { min-width: 0; }
@media (max-width: 48rem) {
  .settings-row { flex-wrap: wrap; gap: var(--space-3); }
  .settings-row__action { margin-left: auto; max-width: 100%; }
  .settings-row :deep(.inline-edit-field--detail) { grid-template-columns: minmax(0, 1fr); }
}
</style>
