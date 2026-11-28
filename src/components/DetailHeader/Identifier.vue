<template>
  <span class="detail-identifier">
  <button type="button" class="detail-identifier__button" :title="t('DetailMetaItem.copyTooltip', { id: value })" :aria-label="t('DetailMetaItem.copyTooltip', { id: value })" @click="$emit('copy')">
    <span class="detail-identifier__label">{{ label }}</span><span class="detail-identifier__value">{{ value }}</span><AIcon v-if="!$slots.after" class="detail-identifier__copy" type="CopyOutlined" aria-hidden="true" />
  </button>
  <slot name="after" />
  </span>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
withDefaults(defineProps<{ value: string; label?: string }>(), { label: 'ID' })
defineEmits<{ copy: [] }>()
const { t } = useI18n()
</script>
<style scoped>
.detail-identifier { display:flex; align-items:center; gap:6px; width:100%; min-width:0; max-width:100%; height:24px; color:var(--jet-theme-text-secondary); font:inherit; font-size:12px; }
.detail-identifier__button { display:flex; flex:0 1 auto; align-items:center; gap:6px; min-width:0; max-width:100%; height:24px; padding:0; border:0; background:transparent; color:inherit; font:inherit; text-align:start; cursor:pointer; }
.detail-identifier__label { flex:none; }
.detail-identifier__value { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-variant-numeric:tabular-nums; }
.detail-identifier__copy { flex:none; width:24px; opacity:0; }
.detail-identifier__button:is(:hover,:focus-visible) .detail-identifier__copy { opacity:1; }
.detail-identifier__button:focus-visible { outline:2px solid var(--jet-theme-primary); outline-offset:2px; }
@media (hover:none) { .detail-identifier__copy { opacity:1; } }
</style>
