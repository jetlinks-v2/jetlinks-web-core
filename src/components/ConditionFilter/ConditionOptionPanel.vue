<script setup lang="ts">
import type { PropType } from 'vue'
import type { SearchOptionPanelConfig } from '../Search/Filter/typing'
import { normalizeOptionTree } from '../Search/Filter/utils'

type OptionItem = Record<string, any> & {
  value: string | number
  label: string
  disabled?: boolean
  children?: OptionItem[]
}

const props = defineProps({
  value: {
    type: [String, Number, Array] as PropType<any>,
    default: undefined,
  },
  options: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  config: {
    type: Object as PropType<SearchOptionPanelConfig | undefined>,
    default: undefined,
  },
})

const emit = defineEmits<{
  (e: 'update:value', value: any): void
  (e: 'submit', options?: { close?: boolean; allowEmpty?: boolean }): void
}>()

const keyword = ref('')
const remoteOptions = ref<OptionItem[]>([])
const selectedOptions = ref<OptionItem[]>([])
const innerLoading = ref(false)

let searchTimer: number | undefined
let requestVersion = 0
let selectedRequestVersion = 0

const multiple = computed(() => props.config?.multiple !== false)
const showSearch = computed(() => props.config?.showSearch !== false)
const showCheckAll = computed(() => multiple.value && props.config?.showCheckAll !== false)
const keywordPlaceholder = computed(() => props.config?.keywordPlaceholder || '筛选条目')
const emptyText = computed(() => props.config?.emptyText || '暂无可选项')
const hintText = computed(() => props.config?.hintText || (props.config?.loadOptions ? '键入以查看更多' : ''))

const normalizeOptions = (items: any[] = []) => normalizeOptionTree(items || []) as OptionItem[]

const mergeOptions = (...groups: OptionItem[][]) => {
  const seen = new Set<string>()

  return groups.flat().filter((item) => {
    const key = String(item?.value ?? '')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const flattenOptions = (items: OptionItem[] = [], parents: string[] = []) => {
  return items.flatMap((item) => {
    const path = [...parents, String(item.label ?? item.name ?? item.value)]
    const current: OptionItem = {
      ...item,
      label: path.join(' / '),
    }

    if (!Array.isArray(item.children) || !item.children.length) {
      return [current]
    }

    return [current, ...flattenOptions(item.children as OptionItem[], path)]
  })
}

const resolvedOptions = computed(() => {
  const rawOptions = props.config?.loadOptions ? remoteOptions.value : props.options
  return mergeOptions(
    flattenOptions(normalizeOptions(selectedOptions.value)),
    flattenOptions(normalizeOptions(rawOptions)),
  )
})

const displayOptions = computed(() => {
  const searchText = keyword.value.trim().toLowerCase()

  if (!searchText || props.config?.loadOptions) {
    return resolvedOptions.value
  }

  return resolvedOptions.value.filter((item) => {
    return `${item.label ?? ''}${item.value ?? ''}`.toLowerCase().includes(searchText)
  })
})

const currentValues = computed(() => {
  if (Array.isArray(props.value)) {
    return props.value
  }

  return props.value === undefined || props.value === null || props.value === '' ? [] : [props.value]
})

const currentValueMap = computed(() => {
  return currentValues.value.reduce((acc, item) => {
    acc.set(String(item), item)
    return acc
  }, new Map<string, any>())
})

const checkedValueSet = computed(() => new Set(currentValues.value.map(item => String(item))))

const visibleEnabledOptions = computed(() => displayOptions.value.filter(item => !item.disabled))

const checkAllStatus = computed(() => {
  const total = visibleEnabledOptions.value.length
  const checkedCount = visibleEnabledOptions.value.filter(item => checkedValueSet.value.has(String(item.value))).length

  return {
    checked: total > 0 && checkedCount === total,
    indeterminate: checkedCount > 0 && checkedCount < total,
  }
})

const emitSubmit = (close = true) => {
  emit('submit', { close, allowEmpty: true })
}

const updateValue = (value: any, close = true) => {
  emit('update:value', value)
  emitSubmit(close)
}

const toggleOption = (option: OptionItem) => {
  if (option.disabled) {
    return
  }

  const optionValue = option.value
  const optionKey = String(optionValue)

  if (!multiple.value) {
    const nextValue = checkedValueSet.value.has(optionKey) ? undefined : optionValue
    updateValue(nextValue, true)
    return
  }

  const nextMap = new Map(currentValueMap.value)

  if (nextMap.has(optionKey)) {
    nextMap.delete(optionKey)
  } else {
    nextMap.set(optionKey, optionValue)
  }

  updateValue(Array.from(nextMap.values()), false)
}

const onToggleAll = (event: any) => {
  const checked = !!event?.target?.checked
  const nextMap = new Map(currentValueMap.value)

  visibleEnabledOptions.value.forEach((option) => {
    const optionKey = String(option.value)

    if (checked) {
      nextMap.set(optionKey, option.value)
    } else {
      nextMap.delete(optionKey)
    }
  })

  updateValue(Array.from(nextMap.values()), false)
}

const loadRemoteOptions = async () => {
  if (!props.config?.loadOptions) {
    return
  }

  const version = ++requestVersion
  innerLoading.value = true

  try {
    const list = await props.config.loadOptions(keyword.value.trim())

    if (version !== requestVersion) {
      return
    }

    remoteOptions.value = normalizeOptions(list)
  } finally {
    if (version === requestVersion) {
      innerLoading.value = false
    }
  }
}

const loadSelectedRemoteOptions = async () => {
  if (!props.config?.loadSelectedOptions) {
    selectedOptions.value = []
    return
  }

  if (!currentValues.value.length) {
    selectedOptions.value = []
    return
  }

  const version = ++selectedRequestVersion

  try {
    const list = await props.config.loadSelectedOptions(currentValues.value)
    if (version !== selectedRequestVersion) {
      return
    }
    selectedOptions.value = normalizeOptions(list)
  } catch {
    if (version === selectedRequestVersion) {
      selectedOptions.value = []
    }
  }
}

watch(
  () => props.config?.loadOptions,
  (loader) => {
    if (!loader) {
      remoteOptions.value = []
      innerLoading.value = false
      return
    }

    loadRemoteOptions()
  },
  { immediate: true },
)

watch(
  () => [props.config?.loadSelectedOptions, currentValues.value],
  () => {
    loadSelectedRemoteOptions()
  },
  { immediate: true, deep: true },
)

watch(keyword, () => {
  if (!props.config?.loadOptions) {
    return
  }

  if (searchTimer) {
    window.clearTimeout(searchTimer)
  }

  searchTimer = window.setTimeout(() => {
    loadRemoteOptions()
  }, 260)
})

onUnmounted(() => {
  if (searchTimer) {
    window.clearTimeout(searchTimer)
  }
})
</script>

<template>
  <div class="condition-option-panel">
    <div v-if="showSearch" class="condition-option-panel__search">
      <a-input
        v-model:value="keyword"
        allow-clear
        :placeholder="keywordPlaceholder"
      >
        <template #prefix>
          <AIcon type="SearchOutlined" />
        </template>
      </a-input>
    </div>

    <div
      v-if="showCheckAll && visibleEnabledOptions.length"
      class="condition-option-panel__toolbar"
    >
      <a-checkbox
        :checked="checkAllStatus.checked"
        :indeterminate="checkAllStatus.indeterminate"
        @change="onToggleAll"
      >
        全选
      </a-checkbox>
    </div>

    <a-spin :spinning="innerLoading">
      <div class="condition-option-panel__list">
        <button
          v-for="option in displayOptions"
          :key="String(option.value)"
          class="condition-option-panel__item"
          :class="{ 'condition-option-panel__item--checked': checkedValueSet.has(String(option.value)) }"
          type="button"
          :disabled="option.disabled"
          @mousedown.prevent
          @click="toggleOption(option)"
        >
          <a-checkbox
            :checked="checkedValueSet.has(String(option.value))"
            :disabled="option.disabled"
          />
          <span class="condition-option-panel__label">{{ option.label }}</span>
        </button>

        <div v-if="!displayOptions.length && !innerLoading" class="condition-option-panel__empty">
          {{ emptyText }}
        </div>
      </div>
    </a-spin>

    <div v-if="hintText" class="condition-option-panel__hint">
      {{ hintText }}
    </div>
  </div>
</template>

<style scoped lang="less">
.condition-option-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &__search {
    :deep(.ant-input-affix-wrapper) {
      border-radius: 8px;
    }
  }

  &__toolbar {
    padding: 0 2px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    max-height: 260px;
    overflow-y: auto;
    margin: 0 -4px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 38px;
    padding: 8px 12px;
    color: #1f2329;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;

    &:hover:not(:disabled) {
      background: #f2f6ff;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.56;
    }
  }

  &__item--checked {
    background: #edf5ff;
    box-shadow: inset 0 0 0 1px #91caff;
  }

  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__empty,
  &__hint {
    padding: 4px 8px 0;
    color: #86909c;
    font-size: 12px;
    line-height: 18px;
  }

  &__hint {
    padding-top: 0;
  }
}
</style>
