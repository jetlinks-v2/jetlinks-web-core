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
  width: 220px;
  padding: 4px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--r-3);
  box-shadow: var(--shadow-1);
}
.condition-field-panel__title {
  padding: 4px 8px 2px;
  color: var(--ink-1);
  font-size: var(--fs-12);
  font-weight: 600;
  line-height: 18px;
}
.condition-field-panel__search {
  margin-bottom: 6px;
}
.condition-field-panel__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}
.condition-field-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--r-2);
  cursor: pointer;
  transition: all 0.2s ease;
}
.condition-field-panel__item:hover {
  background: var(--bg-hover);
}
.condition-field-panel__item--active {
  background: var(--accent-soft);
}
.condition-field-panel__item--active .condition-field-panel__label {
  color: var(--accent);
  font-weight: 600;
}
.condition-field-panel__item--active .condition-field-panel__key {
  color: var(--ink-2);
}
.condition-field-panel__label {
  color: var(--ink-1);
  font-size: var(--fs-12);
  line-height: 18px;
}
.condition-field-panel__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.condition-field-panel__description {
  overflow: hidden;
  color: var(--ink-2);
  font-size: var(--fs-11);
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.condition-field-panel__key {
  color: var(--ink-4);
  font-size: var(--fs-10);
  line-height: 16px;
}
.condition-field-panel__empty {
  padding: 20px 0;
  color: var(--ink-3);
  font-size: var(--fs-12);
  text-align: center;
}
</style>
