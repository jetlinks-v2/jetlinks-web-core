<template>
  <span class="status-pill" :class="statusClass">{{ label }}</span>
</template>

<script setup lang="ts">
import globalI18n from '@jetlinks-web-core/locales'

import { computed, type PropType } from 'vue'

const LABELS = {
  draft: globalI18n.global.t('components.StatusPill.draft'),
  review: globalI18n.global.t('components.StatusPill.review'),
  published: globalI18n.global.t('components.StatusPill.published'),
  deprecated: globalI18n.global.t('components.StatusPill.deprecated'),
  archived: globalI18n.global.t('components.StatusPill.archived'),
} as const

type StatusKey = keyof typeof LABELS

const props = defineProps({
  status: {
    type: String as PropType<StatusKey | string>,
    required: true
  }
})

const statusClass = computed(() => (props.status in LABELS ? props.status : ''))
const label = computed(() => (props.status in LABELS ? LABELS[props.status as StatusKey] : props.status))
</script>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.0625rem 0.4375rem;
  border-radius: 0.25rem;
  font-size: var(--fs-14);
  font-weight: 500;
  line-height: 1.5;
}
.draft {
  background: var(--jet-theme-primary-soft);
  color: var(--jet-theme-text-disabled);
}
.review {
  background: var(--warn-bg);
  color: var(--jet-theme-warning);
}
.published {
  background: var(--ok-bg);
  color: var(--jet-theme-success);
}</style>
