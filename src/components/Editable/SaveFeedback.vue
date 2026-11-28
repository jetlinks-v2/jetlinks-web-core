<template>
  <span v-if="state" class="inline-save-feedback" :class="`inline-save-feedback--${state}`" role="img" :aria-label="text" :title="text" @mousedown.prevent>
    <AIcon :type="state === 'saving' ? 'LoadingOutlined' : state === 'saved' ? 'CheckCircleFilled' : 'EditOutlined'" :spin="state === 'saving'" aria-hidden="true" />
  </span>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SaveFeedbackState } from './useSaveFeedback'
const props = defineProps<{ state: SaveFeedbackState }>()
const { t } = useI18n()
const text = computed(() => props.state ? t(`Editable.${props.state}`) : '')
</script>
<style scoped>
.inline-save-feedback { display:inline-flex; align-items:center; justify-content:center; flex:none; width:16px; color:var(--jet-theme-primary); font-size:12px; }
.inline-save-feedback--saved { color:var(--success,var(--jet-theme-success)); animation:inline-save-feedback-in .22s ease-out, inline-save-feedback-out .2s ease-in 1.8s forwards; }
@keyframes inline-save-feedback-in { from { opacity:0; transform:scale(.6); } 70% { opacity:1; transform:scale(1.15); } to { opacity:1; transform:scale(1); } }
@keyframes inline-save-feedback-out { to { opacity:0; } }
@media (prefers-reduced-motion:reduce) { .inline-save-feedback,.inline-save-feedback :deep(.anticon-spin) { animation:none; } }
</style>
