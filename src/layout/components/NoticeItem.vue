<template>
  <button type="button" class="notice-item" :disabled="disabled" @click="emits('select', data)">
    <span class="notice-item__header">
      <span class="notice-item__title">{{ title }}</span>
      <time v-if="formattedTime" class="notice-item__time" :title="fullTime">{{ formattedTime }}</time>
    </span>
    <span v-if="summary || sourceName" class="notice-item__summary">
      {{ sourceName }}<template v-if="sourceName && summary"> · </template>{{ summary }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import type { NoticeRecord } from './noticeUtils'

const props = defineProps({
  data: { type: Object as PropType<NoticeRecord>, required: true },
  sourceName: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emits = defineEmits<{ (event: 'select', record: NoticeRecord): void }>()
const { t } = useI18n()
const title = computed(() => String(props.data.title || props.data.topicName || props.data.message || '').trim())
const summary = computed(() => {
  const text = String(props.data.summary || props.data.message || '').trim()
  return text === title.value ? '' : text
})
const date = computed(() => props.data.notifyTime ? dayjs(props.data.notifyTime) : undefined)
const fullTime = computed(() => date.value?.isValid() ? date.value.format('YYYY-MM-DD HH:mm:ss') : '')
const formattedTime = computed(() => {
  if (!date.value?.isValid()) return ''
  if (date.value.isSame(dayjs(), 'day')) return t('components.Notice.todayTime', { time: date.value.format('HH:mm') })
  return date.value.format(date.value.isSame(dayjs(), 'year') ? 'MM-DD HH:mm' : 'YYYY-MM-DD HH:mm')
})
</script>

<style lang="less" scoped>
.notice-item {
  display: block; width: 100%; padding: var(--space-2) var(--space-4);
  border: 0; border-bottom: 1px solid var(--jet-theme-border-secondary);
  background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer;
  &:last-child { border-bottom: 0; }
  &:hover { background: var(--jet-theme-primary-soft); }
  &:focus-visible { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; }
  &:disabled { cursor: wait; }
  &__header { display: flex; align-items: baseline; gap: var(--space-3); }
  &__title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--jet-theme-text-secondary); font-size: var(--fs-13); line-height: 1.6; }
  &__time { flex: none; color: color-mix(in srgb, var(--jet-theme-text-secondary) 70%, var(--jet-theme-bg-container)); font-size: var(--fs-12); }
  &__summary { display: block; margin-top: var(--space-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: color-mix(in srgb, var(--jet-theme-text-secondary) 70%, var(--jet-theme-bg-container)); font-size: var(--fs-12); line-height: 1.6; }
}
</style>
