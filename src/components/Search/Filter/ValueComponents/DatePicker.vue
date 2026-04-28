<script setup lang="ts" name="TimePicker">
import type { PropType } from 'vue'
import dayjs from 'dayjs'
import { computed, ref, useAttrs, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toDayjsValue, toTimestampValue } from './utils'

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

  return [
    { key: 'today', label: $t('components.ConditionFilter.date.today') },
    { key: 'yesterday', label: $t('components.ConditionFilter.date.yesterday') },
    { key: 'thisWeek', label: $t('components.ConditionFilter.date.thisWeek') },
    { key: 'lastWeek', label: $t('components.ConditionFilter.date.lastWeek') },
    { key: 'last7Days', label: $t('components.ConditionFilter.date.last7Days') },
    { key: 'thisMonth', label: $t('components.ConditionFilter.date.thisMonth') },
    { key: 'lastMonth', label: $t('components.ConditionFilter.date.lastMonth') },
    { key: 'last30Days', label: $t('components.ConditionFilter.date.last30Days') },
    { key: 'thisYear', label: $t('components.ConditionFilter.date.thisYear') },
  ]
})

const getShortcutRange = (key: string) => {
  const now = dayjs()

  switch (key) {
    case 'today':
      return [now.startOf('day'), now.endOf('day')]
    case 'yesterday': {
      const target = now.subtract(1, 'day')
      return [target.startOf('day'), target.endOf('day')]
    }
    case 'thisWeek':
      return [now.startOf('week'), now.endOf('week')]
    case 'lastWeek': {
      const target = now.subtract(1, 'week')
      return [target.startOf('week'), target.endOf('week')]
    }
    case 'last7Days':
      return [now.subtract(6, 'day').startOf('day'), now.endOf('day')]
    case 'thisMonth':
      return [now.startOf('month'), now.endOf('month')]
    case 'lastMonth': {
      const target = now.subtract(1, 'month')
      return [target.startOf('month'), target.endOf('month')]
    }
    case 'last30Days':
      return [now.subtract(29, 'day').startOf('day'), now.endOf('day')]
    case 'thisYear':
      return [now.startOf('year'), now.endOf('year')]
    default:
      return [now.startOf('day'), now.endOf('day')]
  }
}

const change = (e) => {
  myValue.value = toDayjsValue(e)
  const timestamp = toTimestampValue(e)
  emit('update:value', timestamp)
  emit('change', timestamp)
}

const onShortcutSelect = (key: string) => {
  const [start, end] = getShortcutRange(key)
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

<style scoped lang="less">
.dropdown-time-picker {
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
