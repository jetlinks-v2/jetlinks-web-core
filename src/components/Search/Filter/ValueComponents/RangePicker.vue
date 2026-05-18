<script setup lang="ts" name="RangePicker">
import { computed, useAttrs, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDateShortcutOptions, getDateShortcutRange, toDayjsRangeValue, toTimestampRangeValue, type ConditionDateShortcutKey } from './utils'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  value: {
    type: Array,
    default: () => [],
  },
  format: {
    type: String,
    default: undefined,
  },
  shortcutMode: {
    type: String,
    default: undefined,
  },
})

const emit = defineEmits(['update:value', 'change'])
const attrs = useAttrs()
const { t: $t } = useI18n()

const myValue = ref([])

const pickerAttrs = computed(() => {
  const next = {
    ...attrs,
  } as Record<string, any>

  if (next.showTime === undefined && next['show-time'] === undefined) {
    next.showTime = true
  }

  if (typeof next.placeholder === 'string') {
    next.placeholder = [next.placeholder, next.placeholder]
  }

  if (next.format === undefined && props.format) {
    next.format = props.format
  }

  if (next.format === undefined) {
    next.format = 'YYYY-MM-DD HH:mm:ss'
  }

  return next
})

const shortcutOptions = computed(() => {
  if (!props.shortcutMode) {
    return []
  }

  return getDateShortcutOptions($t)
})

const change = (dates) => {
  myValue.value = toDayjsRangeValue(dates)
  const timestamps = toTimestampRangeValue(dates)
  emit('update:value', timestamps)
  emit('change', timestamps)
}

const onShortcutSelect = (key: ConditionDateShortcutKey) => {
  change(getDateShortcutRange(key))
}

watch(() => props.value, (val) => {
  myValue.value = toDayjsRangeValue(val)
}, { immediate: true })

</script>

<template>
  <div class="dropdown-range-picker">
    <a-range-picker
      :value="myValue"
      class="dropdown-range-picker__input"
      v-bind="pickerAttrs"
      @change="change"
      @ok="change"
    />
    <div class="dropdown-range-picker__shortcuts">
      <button
        v-for="item in shortcutOptions"
        :key="item.key"
        class="dropdown-range-picker__shortcut"
        type="button"
        @mousedown.prevent
        @click="onShortcutSelect(item.key)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dropdown-range-picker {
  width: 100%;
}
.dropdown-range-picker__input {
  width: 100%;
}
.dropdown-range-picker__shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: var(--space-2);
}
.dropdown-range-picker__shortcut {
  height: 1.5rem;
  padding: 0 0.625rem;
  color: var(--ink-2);
  font-size: var(--fs-12);
  line-height: 1.375rem;
  background: var(--bg-hover);
  border: 1px solid var(--line);
  border-radius: 62.4375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dropdown-range-picker__shortcut:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--bg));
}</style>
