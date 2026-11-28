<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { objectOverviewMessages } from './messages'
import { useValueUnit } from '../../hooks/useValueUnit'
import type { ObjectValueType } from '../../object-capability/types'
import type { ObjectMemberState } from '../../object-capability/useObjectCapabilities'

const props = defineProps<{ value?: unknown; metadata?: ObjectValueType; state?: ObjectMemberState['status']; compact?: boolean; emptyText?: string; defaultExpanded?: boolean }>()
defineEmits<{ retry: [] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const unit = useValueUnit(() => props.metadata?.unit)
const expanded = ref(!!props.defaultExpanded), visibleCount = ref(20)
const sensitive = computed(() => props.metadata?.type === 'password')
const collection = computed(() => !sensitive.value && Array.isArray(props.value) ? props.value : undefined)
const enumValue = computed(() => props.metadata?.type === 'enum' && props.value && typeof props.value === 'object' && 'value' in props.value
  ? props.value as { value: unknown; text?: string } : undefined)
const record = computed(() => !sensitive.value && !enumValue.value && props.value !== null && !Array.isArray(props.value) && typeof props.value === 'object')
const entries = computed(() => record.value ? Object.entries(props.value as Record<string, unknown>) : [])
const count = computed(() => collection.value?.length ?? entries.value.length)
const text = computed(() => {
  if (props.value === null || props.value === undefined) return props.emptyText || t('unknown')
  const type = props.metadata
  if (sensitive.value) return '••••••'
  const label = type?.elements?.find(entry => String(entry.value) === String(enumValue.value?.value ?? props.value))?.text ?? enumValue.value?.text
  if (label !== undefined) return label
  if (typeof props.value === 'boolean') return props.value ? type?.trueText ?? t('trueValue') : type?.falseText ?? t('falseValue')
  if (props.value === '') return t('emptyValue')
  if (type?.type === 'date' && (typeof props.value === 'number' || typeof props.value === 'string')) {
    const value = dayjs(props.value)
    if (value.isValid()) return value.format('YYYY-MM-DD HH:mm:ss')
  }
  return String(props.value)
})
</script>

<template>
  <span v-if="state === 'loading'" class="object-value__muted" role="status"><a-spin size="small" /> {{ t('loading') }}</span>
  <span v-else-if="state === 'failed'" class="object-value__muted" role="status">{{ t('loadFailed') }} <a-button type="link" size="small" @click="$emit('retry')">{{ t('retry') }}</a-button></span>
  <details v-else-if="collection || record" class="object-value__structure" :open="expanded" @toggle="expanded = ($event.target as HTMLDetailsElement).open">
    <summary>{{ t('itemCount', { count }) }}</summary>
    <template v-if="expanded">
      <div v-if="collection" class="object-value__list">
        <ObjectDataView v-for="(item, index) in collection.slice(0, visibleCount)" :key="index" :value="item" :metadata="metadata?.elementType" compact />
      </div>
      <dl v-else class="object-value__fields">
        <div v-for="[key, item] in entries.slice(0, visibleCount)" :key="key">
          <dt>{{ metadata?.properties?.find(field => field.id === key)?.name || key }}</dt>
          <dd><ObjectDataView :value="item" :metadata="metadata?.properties?.find(field => field.id === key)?.valueType" compact /></dd>
        </div>
      </dl>
      <a-button v-if="count > visibleCount" type="link" size="small" @click="visibleCount += 20">{{ t('showMore') }}</a-button>
    </template>
  </details>
  <span v-else class="object-value" :class="{ 'object-value--compact': compact, 'object-value__muted': value == null }">
    {{ text }}<small v-if="unit && value != null">{{ unit }}</small>
  </span>
</template>

<style scoped>
.object-value { color: var(--ant-color-text, inherit); font-size: var(--object-value-font-size, 22px); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.object-value--compact { font-size: var(--object-value-font-size, var(--ant-font-size, 14px)); }
.object-value small { margin-inline-start: 6px; font-size: 12px; color: var(--ant-color-text-secondary, var(--ink-2)); }
.object-value__muted { color: var(--ant-color-text-tertiary, var(--ink-2)); font-size: 13px; }
.object-value__structure { min-width: 0; color: var(--ant-color-text, inherit); font-size: 14px; overflow-wrap: anywhere; }
.object-value__structure summary { cursor: pointer; color: var(--ant-color-primary, inherit); }
.object-value__fields { margin: 10px 0 0; display: grid; gap: 8px; }
.object-value__fields > div { display: grid; grid-template-columns: minmax(70px, 1fr) minmax(0, 2fr); gap: 12px; }
.object-value__fields dt { color: var(--ant-color-text-secondary, inherit); }.object-value__fields dd { margin: 0; min-width: 0; }
.object-value__list { display: grid; gap: 10px; margin-top: 10px; }
</style>
