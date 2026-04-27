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
        <span class="condition-field-panel__label">{{ column.title }}</span>
        <span class="condition-field-panel__key">{{ column.dataIndex }}</span>
      </button>
      <div v-if="!filteredColumns.length" class="condition-field-panel__empty">
        {{ $t('components.ConditionFilter.fieldSelect.empty') }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.condition-field-panel {
  width: 220px;
  padding: 4px;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  box-shadow: 0 8px 20px rgba(31, 35, 41, 0.12);

  &__title {
    padding: 4px 8px 2px;
    color: #24292f;
    font-size: 12px;
    font-weight: 600;
    line-height: 18px;
  }

  &__search {
    margin-bottom: 6px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 320px;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 6px 8px;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #f6f8fa;
    }
  }

  &__item--active {
    background: #f0f7ff;

    .condition-field-panel__label {
      color: #0969da;
      font-weight: 600;
    }

    .condition-field-panel__key {
      color: #6e7781;
    }
  }

  &__label {
    color: #24292f;
    font-size: 12px;
    line-height: 18px;
  }

  &__key {
    color: #8c959f;
    font-size: 10px;
    line-height: 16px;
  }

  &__empty {
    padding: 20px 0;
    color: #86909c;
    font-size: 12px;
    text-align: center;
  }
}
</style>
