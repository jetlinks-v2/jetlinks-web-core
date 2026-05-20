<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SearchItem } from '../Search/Filter/typing'
import type { ConditionFilterField } from './types'
import { resolveConditionFields } from './schema'

const props = defineProps({
  fields: {
    type: Array as PropType<ConditionFilterField[]>,
    default: () => [],
  },
  activeKey: {
    type: String,
    default: undefined,
  },
  columns: {
    type: Array as PropType<SearchItem[]>,
    default: () => [],
  },
  keyword: {
    type: String,
    default: undefined,
  },
  showSearch: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits<{
  (e: 'select', value: string): void
  (e: 'hover', value: string): void
}>()

const { t: $t } = useI18n()
const keyword = ref('')
const listRef = ref<HTMLElement>()
const resolvedFields = computed(() => resolveConditionFields(props.fields, props.columns))

const filteredColumns = computed(() => {
  if (props.keyword !== undefined) {
    return resolvedFields.value
  }

  const rawKeyword = props.keyword !== undefined ? props.keyword : keyword.value
  const searchText = String(rawKeyword || '').trim().toLowerCase()

  if (!searchText) {
    return resolvedFields.value
  }

  return resolvedFields.value.filter((item) => {
    return `${item.title}${item.dataIndex}`.toLowerCase().includes(searchText)
  })
})

const syncActiveIntoView = () => {
  if (!props.activeKey) {
    return
  }

  nextTick(() => {
    const activeItem = listRef.value?.querySelector<HTMLElement>(`[data-field-key="${props.activeKey}"]`)
    activeItem?.scrollIntoView?.({
      block: 'nearest',
    })
  })
}

watch(() => props.activeKey, syncActiveIntoView)
watch(filteredColumns, syncActiveIntoView)
</script>

<template>
  <div class="condition-field-panel">
    <div v-if="showSearch" class="condition-field-panel__title">{{ $t('components.ConditionFilter.fieldSelect.title') }}</div>
    <a-input
      v-if="showSearch"
      v-model:value="keyword"
      allow-clear
      class="condition-field-panel__search"
      :placeholder="$t('components.ConditionFilter.fieldSelect.searchPlaceholder')"
    >
      <template #prefix>
        <AIcon type="SearchOutlined" />
      </template>
    </a-input>
    <div ref="listRef" class="condition-field-panel__list">
      <button
        v-for="column in filteredColumns"
        :key="column.dataIndex"
        class="condition-field-panel__item"
        :class="{ 'condition-field-panel__item--active': activeKey === column.dataIndex }"
        :data-field-key="column.dataIndex"
        type="button"
        @mousedown.prevent
        @mouseenter="emit('hover', column.dataIndex)"
        @click="emit('select', column.dataIndex)"
      >
        <span class="condition-field-panel__content">
          <span class="condition-field-panel__label">{{ column.title }}</span>
          <span v-if="column.description" class="condition-field-panel__description">
            {{ column.description }}
          </span>
        </span>
        <span class="condition-field-panel__key">{{ column.dataIndex }}</span>
      </button>
      <div v-if="!filteredColumns.length" class="condition-field-panel__empty">
        {{ $t('components.ConditionFilter.fieldSelect.empty') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.condition-field-panel {
  width: 13.75rem;
  padding: var(--space-1);
  background: var(--color-jet-bg-elevated);
  border: 1px solid var(--color-jet-border);
  border-radius: var(--radius-jet-lg);
  box-shadow: var(--jet-theme-shadow-secondary);
}
.condition-field-panel__title {
  padding: var(--space-1) var(--space-2) 0.125rem;
  color: var(--color-jet-text);
  font-size: var(--fs-12);
  font-weight: 600;
  line-height: 1.125rem;
}
.condition-field-panel__search {
  margin-bottom: 0.375rem;
}
.condition-field-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 20rem;
  overflow-y: auto;
}
.condition-field-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: 0.375rem 0.5rem;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius-jet);
  cursor: pointer;
  transition: all 0.2s ease;
}
.condition-field-panel__item:hover {
  background: var(--color-jet-border-secondary);
}
.condition-field-panel__item--active {
  background: var(--color-jet-primary-soft);
}
.condition-field-panel__item--active .condition-field-panel__label {
  color: var(--color-jet-primary);
  font-weight: 600;
}
.condition-field-panel__item--active .condition-field-panel__key {
  color: var(--color-jet-text-secondary);
}
.condition-field-panel__label {
  color: var(--color-jet-text);
  font-size: var(--fs-12);
  line-height: 1.125rem;
}
.condition-field-panel__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.condition-field-panel__description {
  overflow: hidden;
  color: var(--color-jet-text-secondary);
  font-size: var(--fs-12);
  line-height: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.condition-field-panel__key {
  color: var(--color-jet-text-disabled);
  font-size: var(--fs-12);
  line-height: 1rem;
}
.condition-field-panel__empty {
  padding: 1.25rem 0;
  color: var(--color-jet-text-disabled);
  font-size: var(--fs-12);
  text-align: center;
}</style>
