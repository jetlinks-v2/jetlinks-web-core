<template>
  <span v-if="denied" class="fw-denied">⌑ {{ t('denied') }}</span>
  <span v-else-if="isEmpty(value)" class="fw-empty">{{ t('empty') }}</span>
  <span v-else-if="field.type === 'enum'" class="fw-options">
    <template v-for="(option, index) in selectedOptions(field, value)" :key="index">
      <Tag v-if="item.display !== 'text'" :color="optionColor(option, item)" class="fw-tag">{{ text(option) }}</Tag>
      <span v-else>{{ index ? ' · ' : '' }}{{ text(option) }}</span>
    </template>
  </span>
  <span v-else-if="field.type === 'boolean'" class="fw-boolean"><span :class="value ? 'fw-yes' : 'fw-no'" :style="{ background: optionColor({ value: !!value, label: '' }, item) }" />{{ value ? t('yes') : t('no') }}</span>
  <span v-else class="fw-text" :class="{ 'fw-number': field.type === 'number', 'fw-paragraph': item.display === 'paragraph' || (item.display !== 'text' && (field.type === 'textarea' || field.type === 'custom')) }">{{ displayValue(field, item, value, locale) }}<span v-if="text(field, 'unit') && !item.hideUnit" class="fw-unit">{{ text(field, 'unit') }}</span></span>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import { Tag } from 'ant-design-vue'
import { displayValue, isEmpty, optionColor, selectedOptions } from './model'
import { useFormLocale } from './locale'
import type { FormField, FormLayoutItem } from './types'
defineProps({
  field: { type: Object as PropType<FormField>, required: true },
  item: { type: Object as PropType<FormLayoutItem>, required: true },
  value: { required: false },
  denied: Boolean,
})
const { t, locale, text } = useFormLocale()
</script>

<style scoped>
.fw-empty, .fw-denied { color: var(--jet-theme-text-secondary, #8d9399); font-size: 13px; }
.fw-options { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; }
.fw-tag { margin: 0; max-width: 100%; border-color: transparent; border-radius: 4px; white-space: normal; overflow-wrap: anywhere; }
.fw-paragraph { white-space: pre-wrap; }
.fw-number { display: inline-flex; align-items: baseline; vertical-align: top; max-width: 100%; font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; line-height: 26px; }
.fw-unit { flex-shrink: 0; margin-left: 5px; color: var(--jet-theme-text-secondary, #697586); font-size: 12px; line-height: normal; }
.fw-boolean { display: inline-flex; gap: 7px; align-items: center; }
.fw-yes, .fw-no { width: 6px; height: 6px; border-radius: 50%; background: var(--jet-theme-text-secondary, #8d9399); }
.fw-yes { background: var(--ok, #389e70); }
</style>
