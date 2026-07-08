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
        {{ item.label }}
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

<style scoped>
.simple-tabs {
  display: grid;
  gap: var(--space-3);
  //padding: 1rem;
  //border-radius: 8px;
  //border: 1px solid #FFF;
  //background: rgba(255, 255, 255, 0.80);
  margin-bottom: var(--space-4);
}

.simple-tabs__nav {
  display: inline-flex;
  align-items: center;
  //gap: var(--space-2);
  padding: var(--space-1);
  //border-radius: var(--r-2);
  width: fit-content;
  max-width: 100%;
  overflow-x: auto;
}

.simple-tabs__tab {
  flex: 0 0 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 8px;
  color: var(--ink-2);
  font-size: var(--fs-14);
  font-weight: 500;
  line-height: 1.5;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
  white-space: nowrap;
}

.simple-tabs__tab:hover {
  color: var(--accent);
}

.simple-tabs__tab--active {
  color: var(--accent);
  background-color: #fff;
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
