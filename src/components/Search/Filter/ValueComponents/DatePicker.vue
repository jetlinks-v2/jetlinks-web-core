<script setup lang="ts" name="TimePicker">
import type { PropType } from 'vue'
import { computed, ref, useAttrs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getDateShortcutOptions, getDateShortcutRange, toDayjsValue, toTimestampValue, type ConditionDateShortcutKey } from './utils'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  value: {
    type: [String, Number],
    default: undefined,
  },
  format: {
    type: String,
    default: undefined,
  },
  pickerType: {
    type: String,
    default: 'date',
  },
  shortcutMode: {
    type: String as PropType<'start' | 'end' | undefined>,
    default: undefined,
  }
});

const emit = defineEmits(['update:value', 'change'])
const attrs = useAttrs()
const { t: $t } = useI18n()

const myValue = ref(toDayjsValue(props.value))

const pickerAttrs = computed(() => {
  const next = {
    ...attrs,
  } as Record<string, any>

  if (next.showTime === undefined && next['show-time'] === undefined) {
    next.showTime = true
  }

  if (next.format === undefined && props.format) {
    next.format = props.format
  }

  if (next.format === undefined) {
    next.format = props.pickerType === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD HH:mm:ss'
  }

  return next
})

const shortcutOptions = computed(() => {
  if (!props.shortcutMode) {
    return []
  }

  return getDateShortcutOptions($t)
})

const change = (e) => {
  myValue.value = toDayjsValue(e)
  const timestamp = toTimestampValue(e)
  emit('update:value', timestamp)
  emit('change', timestamp)
}

const onShortcutSelect = (key: ConditionDateShortcutKey) => {
  const [start, end] = getDateShortcutRange(key)
  change(props.shortcutMode === 'end' ? end : start)
}

watch(() => props.value, (val) => {
  myValue.value = toDayjsValue(val)
}, { immediate: true })

</script>

<template>
<div class="dropdown-time-picker">
  <a-date-picker
    :value="myValue"
    class="dropdown-time-picker__input"
    v-bind="pickerAttrs"
    @change='change'
    @ok='change'
  />
  <div v-if="shortcutOptions.length" class="dropdown-time-picker__shortcuts">
    <button
      v-for="item in shortcutOptions"
      :key="item.key"
      class="dropdown-time-picker__shortcut"
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
.dropdown-time-picker {
  width: 100%;
}
.dropdown-time-picker__input {
  width: 100%;
}
.dropdown-time-picker__shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: var(--space-2);
}
.dropdown-time-picker__shortcut {
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
.dropdown-time-picker__shortcut:hover {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 35%, var(--bg));
}</style>
