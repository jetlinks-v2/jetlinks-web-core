<template>
  <div class="time-select">
    <a-radio-group
      v-if="quickBtn"
      default-value="today"
      button-style="solid"
      v-model:value="radioValue"
      @change="(e) => handleBtnChange(e.target.value)"
    >
      <a-radio-button
        v-for="item in quickBtnListData"
        :key="item.value"
        :value="item.value"
      >
        {{ item.label }}
      </a-radio-button>
    </a-radio-group>
    <a-range-picker
      format="YYYY-MM-DD HH:mm:ss"
      valueFormat="YYYY-MM-DD HH:mm:ss"
      style="margin-left: 12px"
      :show-time="{ format: 'HH:mm:ss' }"
      @change="rangeChange"
      v-model:value="rangeVal"
      :allowClear="false"
    ></a-range-picker>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

const { t: $t } = useI18n()

// 定义快捷按钮项的类型
interface QuickBtnItem {
  label: string
  value: string
}

interface EmitProps {
  (e: 'change', data: Record<string, any>): void
}

const emit = defineEmits<EmitProps>()

const props = defineProps({
  // 显示快捷按钮
  quickBtn: {
    type: Boolean,
    default: true
  },
  type: {
    type: String,
    default: 'week'
  },
  quickBtnList: {
    type: Array as PropType<QuickBtnItem[]>,
    default: null
  }
})

const defaultQuickBtnList = computed<QuickBtnItem[]>(() => [
  { label: $t('TimeSelect.index.100001-0'), value: 'hour' },
  { label: $t('TimeSelect.index.100001-1'), value: 'day' },
  { label: $t('TimeSelect.index.100001-2'), value: 'week' }
])

const quickBtnListData = computed<QuickBtnItem[]>(() => props.quickBtnList || defaultQuickBtnList.value)

const radioValue = ref<any>(props.type || 'week')

const rangeVal = ref<[string, string]>()

const rangeChange = (val: any) => {
  radioValue.value = undefined
  emit('change', {
    start: dayjs(val[0]).valueOf(),
    end: dayjs(val[1]).valueOf(),
    type: undefined
  })
}

const getTimeByType = (type: string) => {
  switch (type) {
    case 'hour':
      return dayjs().subtract(1, 'hours').valueOf()
    case 'week':
      return dayjs().subtract(6, 'days').valueOf()
    case 'month':
      return dayjs().subtract(29, 'days').valueOf()
    case 'year':
      return dayjs().subtract(365, 'days').valueOf()
    case 'day':
      return dayjs().subtract(24, 'hours').valueOf()
    default:
      return dayjs().startOf('day').valueOf()
  }
}

const handleBtnChange = (val: string) => {
  radioValue.value = val
  let endTime = dayjs(new Date()).valueOf()
  let startTime = getTimeByType(val)
  if (val === 'today') {
    startTime = dayjs().subtract(0, 'days').startOf('day').valueOf()
    endTime = dayjs().subtract(0, 'days').endOf('day').valueOf()
  }
  rangeVal.value = [dayjs(startTime).format('YYYY-MM-DD HH:mm:ss'), dayjs(endTime).format('YYYY-MM-DD HH:mm:ss')]
  emit('change', {
    start: startTime,
    end: endTime,
    type: val
  })
}

watch(
  () => props.type,
  (val) => {
    radioValue.value = val
  }
)

defineExpose({
  handleBtnChange
})
</script>

<style scoped lang="less">
.view-designer .ant-picker {
  background-color: transparent;
  border: 1px solid #d9d9d9;
  box-shadow: none;
}
.time-select {
  white-space: nowrap;
}
</style>
