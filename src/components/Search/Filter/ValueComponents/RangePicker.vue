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

<style scoped lang="less">
.dropdown-range-picker {
  width: 100%;

  &__input {
    width: 100%;
  }

  &__shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }

  &__shortcut {
    height: 24px;
    padding: 0 10px;
    color: #475467;
    font-size: 12px;
    line-height: 22px;
    background: #f8fafc;
    border: 1px solid #d0d5dd;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      color: #1677ff;
      background: #eff6ff;
      border-color: #91caff;
    }
  }
}
</style>
