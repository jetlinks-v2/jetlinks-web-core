<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { objectOverviewMessages } from './messages'
import type { ObjectValueType } from '../../object-capability/types'
import type { ObjectMemberState } from '../../object-capability/useObjectCapabilities'

const props = defineProps<{ value?: unknown; metadata?: ObjectValueType; state?: ObjectMemberState['status']; compact?: boolean }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const collection = computed(() => Array.isArray(props.value) ? props.value.slice(0, 20) : undefined)
const enumValue = computed(() => props.metadata?.type === 'enum' && props.value && typeof props.value === 'object' && 'value' in props.value
  ? props.value as { value: unknown; text?: string } : undefined)
const entries = computed(() => !enumValue.value && props.value && !Array.isArray(props.value) && typeof props.value === 'object'
  ? Object.entries(props.value as Record<string, unknown>).slice(0, 30) : [])
const text = computed(() => {
  if (props.value === null || props.value === undefined) return t('unknown')
  const type = props.metadata
  if (type?.type === 'password') return '••••••'
  const label = type?.elements?.find(entry => entry.value === (enumValue.value?.value ?? props.value))?.text || enumValue.value?.text
  if (label) return label
  if (typeof props.value === 'boolean') return props.value ? type?.trueText || '✓' : type?.falseText || '—'
  if (type?.type === 'date' && (typeof props.value === 'number' || typeof props.value === 'string')) {
    const value = dayjs(props.value)
    if (value.isValid()) return value.format('YYYY-MM-DD HH:mm:ss')
  }
  return String(props.value)
})
</script>

<template>
  <span v-if="state === 'loading'" class="object-value__muted" role="status"><a-spin size="small" /> {{ t('loading') }}</span>
  <span v-else-if="state === 'failed'" class="object-value__muted"><a-button type="link" size="small" @click="$emit('retry')">{{ t('retry') }}</a-button></span>
  <div v-else-if="collection" class="object-value__list">
    <ObjectDataView v-for="(item, index) in collection" :key="index" :value="item" :metadata="metadata?.elementType" compact />
    <span v-if="(value as unknown[]).length > 20" class="object-value__muted">{{ t('limited') }}</span>
  </div>
  <dl v-else-if="entries.length" class="object-value__fields">
    <div v-for="[key, item] in entries" :key="key">
      <dt>{{ metadata?.properties?.find(field => field.id === key)?.name || key }}</dt>
      <dd><ObjectDataView :value="item" :metadata="metadata?.properties?.find(field => field.id === key)?.valueType" compact /></dd>
    </div>
  </dl>
  <span v-else class="object-value" :class="{ 'object-value--compact': compact, 'object-value__muted': value == null }">
    {{ text }}<small v-if="metadata?.unit && value != null">{{ metadata.unit }}</small>
  </span>
</template>

<style scoped>
.object-value { color: var(--ant-color-text, inherit); font-size: 22px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.object-value--compact { font-size: 13px; }
.object-value small { margin-inline-start: 6px; font-size: 12px; color: var(--ant-color-text-secondary, inherit); }
.object-value__muted { color: var(--ant-color-text-tertiary, inherit); font-size: 13px; }
.object-value__fields { margin: 0; display: grid; gap: 8px; }
.object-value__fields > div { display: grid; grid-template-columns: minmax(70px, 1fr) minmax(0, 2fr); gap: 12px; }
.object-value__fields dt { color: var(--ant-color-text-secondary, inherit); }.object-value__fields dd { margin: 0; min-width: 0; }
.object-value__list { display: grid; gap: 10px; }
</style>
