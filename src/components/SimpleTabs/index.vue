<template>
  <div class="simple-tabs">
    <div class="simple-tabs__nav" role="tablist" aria-orientation="horizontal">
      <div
        v-for="item in options"
        :key="item.value"
        class="simple-tabs__tab"
        :class="{
          'simple-tabs__tab--active': item.value === currentValue,
          'simple-tabs__tab--disabled': item.disabled,
        }"
        :aria-selected="item.value === currentValue"
        :tabindex="item.disabled ? -1 : item.value === currentValue ? 0 : -1"
        role="tab"
        @click="handleClick(item)"
        @keydown.enter.prevent="handleClick(item)"
        @keydown.space.prevent="handleClick(item)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.count !== undefined" class="simple-tabs__count">{{ item.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'

type TabsValue = string | number

interface SimpleTabsOption {
  label: string
  value: TabsValue
  disabled?: boolean
  count?: string | number
}

const props = defineProps({
  options: {
    type: Array as PropType<SimpleTabsOption[]>,
    default: () => [],
  },
  modelValue: {
    type: [String, Number] as PropType<TabsValue | undefined>,
    default: undefined,
  },
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: TabsValue): void
  (e: 'change', value: TabsValue, item: SimpleTabsOption): void
}>()

const getFirstAvailableValue = (options: SimpleTabsOption[]) => options.find(item => !item.disabled)?.value ?? options[0]?.value

// 未绑定 v-model 时，组件自己维护当前 tab，方便在纯展示页里直接使用。
const innerValue = ref<TabsValue | undefined>(props.modelValue ?? getFirstAvailableValue(props.options))

const currentValue = computed(() => (props.modelValue !== undefined ? props.modelValue : innerValue.value))

watch(
  () => props.modelValue,
  value => {
    if (value !== undefined) {
      innerValue.value = value
    }
  },
  { immediate: true },
)

watch(
  () => props.options,
  options => {
    const nextValue = getFirstAvailableValue(options)

    if (!options.length) {
      innerValue.value = undefined
      return
    }

    if (!options.some(item => item.value === currentValue.value)) {
      innerValue.value = nextValue
    }
  },
  { deep: true, immediate: true },
)

const handleClick = (item: SimpleTabsOption) => {
  if (item.disabled || item.value === currentValue.value) {
    return
  }

  if (props.modelValue === undefined) {
    innerValue.value = item.value
  }

  emit('update:modelValue', item.value)
  emit('change', item.value, item)
}
</script>

<style scoped lang="less">
.simple-tabs {
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.simple-tabs__nav {
  display: flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
}

.simple-tabs__tab {
  flex: 0 0 auto;
  display: flex;
  padding: 6px 16px;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  border: 1px solid #ECEFF3;
  background: rgba(255, 255, 255, 0.20);
  cursor: pointer;
  color: #4E5969;
}

.simple-tabs__count {
  min-width: 20px;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--bg-sunken, #f5f5f5);
  color: var(--ink-3, #86909c);
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}

.simple-tabs__tab:hover {
  color: var(--primary-color-active);
}

.simple-tabs__tab--active {
  color: #fff;
  background-color: var(--primary-color-active);

  &:hover {
    color: #fff;
  }
}

.simple-tabs__tab--active .simple-tabs__count {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.simple-tabs__tab--disabled {
  color: var(--ink-4);
  cursor: not-allowed;
}

.simple-tabs__tab--disabled:hover {
  color: var(--ink-4);
}

.simple-tabs__tab:focus-visible {
  outline: 0;
  box-shadow: var(--ring-focus);
}

</style>
