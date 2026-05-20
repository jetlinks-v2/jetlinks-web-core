<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConditionOptionPanelConfig } from './types'
import {
  getOptionDescriptionByFields,
  getOptionIconByFields,
  getOptionLabelByFields,
  normalizeOptionItemsByFields,
} from './option-display'

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
  keyword: {
    type: String,
    default: '',
  },
  options: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  config: {
    type: Object as PropType<ConditionOptionPanelConfig | undefined>,
    default: undefined,
  },
})

const emit = defineEmits<{
  (e: 'update:value', value: any): void
  (e: 'submit', options?: { close?: boolean; allowEmpty?: boolean }): void
}>()

const { t: $t } = useI18n()
const rootRef = ref<HTMLElement>()
const keyword = ref(String(props.keyword || ''))
const remoteOptions = ref<OptionItem[]>([])
const selectedOptions = ref<OptionItem[]>([])
const initialSelectedValues = ref<any[]>([])
const innerLoading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(false)
const pageIndex = ref(0)

let searchTimer: number | undefined
let requestVersion = 0
let selectedRequestVersion = 0
let scrollGate = false
let focusTimer: number | undefined

const multiple = computed(() => props.config?.multiple !== false)
const showSearch = computed(() => props.config?.showSearch !== false)
const showCheckAll = computed(() => multiple.value && props.config?.showCheckAll !== false)
const remotePageSize = computed(() => {
  const pageSize = Number(props.config?.pageSize)
  return Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 12
})
const queryDebounce = computed(() => {
  const debounce = Number(props.config?.queryDebounce)
  return Number.isFinite(debounce) && debounce >= 0 ? debounce : 260
})
const optionFields = computed(() => props.config?.optionFields)
const keywordPlaceholder = computed(() => props.config?.keywordPlaceholder || $t('components.ConditionFilter.optionPanel.keywordPlaceholder'))
const emptyText = computed(() => props.config?.emptyText || $t('components.ConditionFilter.optionPanel.empty'))
const hintText = computed(() => props.config?.hintText || (props.config?.loadOptions ? $t('components.ConditionFilter.optionPanel.hint') : ''))

const normalizeOptions = (items: any[] = []) => normalizeOptionItemsByFields(items || [], optionFields.value) as OptionItem[]

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

const mergeDisplayOptions = (baseOptions: OptionItem[] = [], extraOptions: OptionItem[] = []) => {
  const baseKeys = new Set(baseOptions.map(item => String(item.value)))
  const missingOptions = extraOptions.filter(item => !baseKeys.has(String(item.value)))
  return [...baseOptions, ...missingOptions]
}

const sortOptionsBySelectedValues = (items: OptionItem[] = [], values: any[] = []) => {
  if (!values.length) {
    return items
  }

  const orderMap = values.reduce((map, value, index) => {
    map.set(String(value), index)
    return map
  }, new Map<string, number>())

  return [...items].sort((left, right) => {
    const leftIndex = orderMap.get(String(left.value))
    const rightIndex = orderMap.get(String(right.value))

    if (leftIndex === undefined && rightIndex === undefined) {
      return 0
    }

    if (leftIndex === undefined) {
      return 1
    }

    if (rightIndex === undefined) {
      return -1
    }

    return leftIndex - rightIndex
  })
}

const prioritizeOptionsByValues = (items: OptionItem[] = [], values: any[] = []) => {
  if (!values.length) {
    return items
  }

  const itemMap = items.reduce((map, item) => {
    map.set(String(item.value), item)
    return map
  }, new Map<string, OptionItem>())

  const prioritized: OptionItem[] = []
  const prioritizedKeys = new Set<string>()

  values.forEach((value) => {
    const key = String(value)
    const item = itemMap.get(key)

    if (!item || prioritizedKeys.has(key)) {
      return
    }

    prioritized.push(item)
    prioritizedKeys.add(key)
  })

  if (!prioritized.length) {
    return items
  }

  return [
    ...prioritized,
    ...items.filter(item => !prioritizedKeys.has(String(item.value))),
  ]
}

const getCurrentValueKeys = (values: any[] = []) => new Set(values.map(value => String(value)))

const getLocalSelectedOptions = (values: any[] = []) => {
  if (!values.length) {
    return []
  }

  const selectedKeys = getCurrentValueKeys(values)

  return sortOptionsBySelectedValues(
    mergeOptions(
      flattenOptions(normalizeOptions(selectedOptions.value)),
      flattenOptions(normalizeOptions(remoteOptions.value)),
      flattenOptions(normalizeOptions(props.options)),
    ).filter(item => selectedKeys.has(String(item.value))),
    values,
  )
}

const currentValues = computed(() => {
  if (Array.isArray(props.value)) {
    return props.value
  }

  return props.value === undefined || props.value === null || props.value === '' ? [] : [props.value]
})

initialSelectedValues.value = [...currentValues.value]

const getOptionDescription = (option: OptionItem) => {
  const description = getOptionDescriptionByFields(option, optionFields.value)
  const label = getOptionLabelByFields(option, optionFields.value)
  return description && description !== label ? description : ''
}

const getOptionIcon = (option: OptionItem) => getOptionIconByFields(option, optionFields.value)

const isImageIcon = (icon?: string) => {
  if (!icon) {
    return false
  }

  return /^(https?:\/\/|data:image\/|\/)/.test(icon) || /\.(png|jpe?g|gif|svg|webp)$/i.test(icon)
}

const resolvedOptions = computed(() => {
  const localOptions = flattenOptions(normalizeOptions(props.options))
  const remoteDisplayOptions = flattenOptions(normalizeOptions(remoteOptions.value))
  const baseOptions = props.config?.loadOptions
    ? remoteDisplayOptions
    : localOptions

  return prioritizeOptionsByValues(
    mergeDisplayOptions(
      baseOptions,
      flattenOptions(normalizeOptions(selectedOptions.value)),
    ),
    initialSelectedValues.value,
  )
})

const displayOptions = computed(() => {
  const searchText = keyword.value.trim().toLowerCase()

  if (!searchText || props.config?.loadOptions) {
    return resolvedOptions.value
  }

  return resolvedOptions.value.filter((item) => {
    return `${item.label ?? ''}${item.name ?? ''}${item.description ?? ''}${item.value ?? ''}`
      .toLowerCase()
      .includes(searchText)
  })
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

const clearSearchTimer = () => {
  if (searchTimer !== undefined) {
    window.clearTimeout(searchTimer)
    searchTimer = undefined
  }
}

const clearFocusTimer = () => {
  if (focusTimer !== undefined) {
    window.clearTimeout(focusTimer)
    focusTimer = undefined
  }
}

const getSearchInput = () => {
  return rootRef.value?.querySelector<HTMLInputElement>('.condition-option-panel__search .ant-input')
}

const focusSearchInput = () => {
  if (!showSearch.value) {
    return
  }

  clearFocusTimer()

  nextTick(() => {
    getSearchInput()?.focus?.()

    requestAnimationFrame(() => {
      getSearchInput()?.focus?.()
    })

    focusTimer = window.setTimeout(() => {
      focusTimer = undefined
      getSearchInput()?.focus?.()
    }, 48)
  })
}

const loadRemoteOptions = async (
  searchText = '',
  options: {
    reset?: boolean
  } = {},
) => {
  if (!props.config?.loadOptions) {
    return
  }

  const reset = options.reset !== false

  if (!reset && (innerLoading.value || loadingMore.value || !hasMore.value)) {
    return
  }

  const currentPageIndex = reset ? 0 : pageIndex.value
  const version = reset ? ++requestVersion : requestVersion

  if (reset) {
    pageIndex.value = 0
    hasMore.value = true
  }

  if (reset || !remoteOptions.value.length) {
    innerLoading.value = true
    loadingMore.value = false
  } else {
    loadingMore.value = true
  }

  try {
    const list = await props.config.loadOptions(searchText, {
      pageIndex: currentPageIndex,
      pageSize: remotePageSize.value,
    })

    if (version !== requestVersion) {
      return
    }

    const normalizedList = normalizeOptions(list)

    remoteOptions.value = reset
      ? normalizedList
      : mergeOptions(remoteOptions.value, normalizedList)
    pageIndex.value = currentPageIndex + 1
    hasMore.value = normalizedList.length >= remotePageSize.value
  } catch {
    if (version !== requestVersion) {
      return
    }

    if (reset) {
      remoteOptions.value = []
    }
    hasMore.value = false
  } finally {
    if (version === requestVersion) {
      innerLoading.value = false
      loadingMore.value = false
    }
  }
}

const scheduleLoadRemoteOptions = () => {
  if (!props.config?.loadOptions) {
    return
  }

  clearSearchTimer()

  const searchText = keyword.value.trim()
  const debounce = queryDebounce.value

  if (debounce <= 0) {
    loadRemoteOptions(searchText, { reset: true })
    return
  }

  searchTimer = window.setTimeout(() => {
    searchTimer = undefined
    loadRemoteOptions(searchText, { reset: true })
  }, debounce)
}

const onListScroll = (event: Event) => {
  if (!props.config?.loadOptions || innerLoading.value || loadingMore.value || !hasMore.value) {
    return
  }

  const target = event.target as HTMLElement
  const threshold = 72

  if (target.scrollHeight - target.scrollTop - target.clientHeight > threshold) {
    return
  }

  if (scrollGate) {
    return
  }

  scrollGate = true

  loadRemoteOptions(keyword.value.trim(), { reset: false }).finally(() => {
    requestAnimationFrame(() => {
      scrollGate = false
    })
  })
}

const loadSelectedRemoteOptions = async () => {
  const localSelected = getLocalSelectedOptions(currentValues.value)
  const version = ++selectedRequestVersion

  if (!props.config?.loadSelectedOptions) {
    selectedOptions.value = localSelected
    return
  }

  if (!currentValues.value.length) {
    selectedOptions.value = []
    return
  }

  selectedOptions.value = localSelected

  try {
    const list = await props.config.loadSelectedOptions(currentValues.value)
    if (version !== selectedRequestVersion) {
      return
    }
    selectedOptions.value = sortOptionsBySelectedValues(
      mergeOptions(
        flattenOptions(normalizeOptions(list)),
        flattenOptions(normalizeOptions(localSelected)),
      ),
      currentValues.value,
    )
  } catch {
    if (version === selectedRequestVersion) {
      selectedOptions.value = localSelected
    }
  }
}

watch(
  () => props.config?.loadOptions,
  (loader) => {
    clearSearchTimer()
    requestVersion += 1

    if (!loader) {
      remoteOptions.value = []
      innerLoading.value = false
      loadingMore.value = false
      hasMore.value = false
      pageIndex.value = 0
      return
    }

    scheduleLoadRemoteOptions()
  },
  { immediate: true },
)

watch(
  () => props.keyword,
  (value) => {
    const nextKeyword = String(value || '')

    if (keyword.value !== nextKeyword) {
      keyword.value = nextKeyword
    }

    focusSearchInput()
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

  scheduleLoadRemoteOptions()
})

onUnmounted(() => {
  clearSearchTimer()
  clearFocusTimer()
  requestVersion += 1
  selectedRequestVersion += 1
})

onMounted(() => {
  focusSearchInput()
})
</script>

<template>
  <div ref="rootRef" class="condition-option-panel">
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
        {{ $t('components.ConditionFilter.optionPanel.selectAll') }}
      </a-checkbox>
    </div>

    <a-spin :spinning="innerLoading">
      <div class="condition-option-panel__list" @scroll.passive="onListScroll">
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
          <span v-if="getOptionIcon(option)" class="condition-option-panel__icon">
            <img v-if="isImageIcon(getOptionIcon(option))" :src="getOptionIcon(option)" alt="" />
            <AIcon v-else :type="getOptionIcon(option)" />
          </span>
          <span class="condition-option-panel__content">
            <span class="condition-option-panel__label">{{ option.label }}</span>
            <span v-if="getOptionDescription(option)" class="condition-option-panel__description">
              {{ getOptionDescription(option) }}
            </span>
          </span>
        </button>

        <div v-if="!displayOptions.length && !innerLoading" class="condition-option-panel__empty">
          {{ emptyText }}
        </div>

        <div v-else-if="loadingMore" class="condition-option-panel__more">
          {{ $t('components.ConditionFilter.optionPanel.loadingMore') }}
        </div>
      </div>
    </a-spin>

    <div v-if="hintText" class="condition-option-panel__hint">
      {{ hintText }}
    </div>
  </div>
</template>

<style scoped>
.condition-option-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.condition-option-panel__search :deep(.ant-input-affix-wrapper) {
  border-radius: var(--radius-jet-lg);
}
.condition-option-panel__toolbar {
  padding: 0 0.125rem;
}
.condition-option-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 16.25rem;
  overflow-y: auto;
  margin: 0 -0.25rem;
}
.condition-option-panel__item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.375rem;
  padding: var(--space-2) var(--space-3);
  color: var(--color-jet-text);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--radius-jet-lg);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.condition-option-panel__item:hover:not(:disabled) {
  background: var(--color-jet-primary-soft);
}
.condition-option-panel__item:disabled {
  cursor: not-allowed;
  opacity: 0.56;
}
.condition-option-panel__item--checked {
  background: var(--color-jet-primary-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-jet-primary) 35%, var(--color-jet-bg-container));
}
.condition-option-panel__label {
  font-size: var(--fs-14);
  line-height: 1.25rem;
}
.condition-option-panel__content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 0.125rem;
}
.condition-option-panel__description {
  overflow: hidden;
  color: var(--color-jet-text-disabled);
  font-size: var(--fs-12);
  line-height: 1.125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.condition-option-panel__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-jet-primary);
  flex-shrink: 0;
}
.condition-option-panel__icon img {
  width: 1.125rem;
  height: 1.125rem;
  object-fit: cover;
  border-radius: 50%;
}
.condition-option-panel__empty,
.condition-option-panel__more,
.condition-option-panel__hint {
  padding: var(--space-1) var(--space-2) 0;
  color: var(--color-jet-text-disabled);
  font-size: var(--fs-12);
  line-height: 1.125rem;
}
.condition-option-panel__hint {
  padding-top: 0;
}</style>
