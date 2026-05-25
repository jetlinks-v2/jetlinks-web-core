<!--
可编辑表单项:
鼠标移入背景颜色:#f5f6f8
点击后变成可编辑的状态, 点击其他地方则变回不可编辑状态,
对于复杂的组件可编辑的状态需要留插槽,把相应的原始值传入,然后得到值之后emits出去
根据情况把现有的需要的组件添加进来
考虑不可编辑状态的展示
 -->

<template>
  <div v-if="isEdit" ref="inputRef">
    <component
        ref="componentRef"
        :is="componentObj[type]"
        v-model:value="_value"
        style="width: 100%"
        v-bind="componentProps"
        v-on="getEventHandlers()"
    />
  </div>
  <div v-else :class="['text', { disabled }]" @click="enterEdit">
    <slot :value="_value">
      {{ __value ?? '未设置' }}
    </slot>
  </div>
</template>

<script setup>
import {DatePicker, Input, InputNumber, Select, TimePicker} from 'ant-design-vue'

const props = defineProps({
  value: {
    type: String,
  },
  type: {
    type: String,
    default: 'string'
  },
  componentProps: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:value', 'change'])

const componentObj = {
  'string': Input,
  'number': InputNumber,
  'select': Select,
  'date': DatePicker,
  'time': TimePicker,
  'dateRange': DatePicker.RangePicker,
  'timeRange': TimePicker.RangePicker,
}

const isEdit = ref(false)
const _value = ref(props.value)
const inputRef = ref()
const componentRef = ref()

// 定义选择框类型
const selectTypes = ['select', 'date', 'time', 'dateRange', 'timeRange']

const disabled = computed(() => !!props.componentProps?.disabled)

const __value = computed(() => {
  if (props.type === 'select') {
    return (props.componentProps?.options || []).find(item => item.value === _value.value)?.label ?? undefined
  }
  return _value.value ?? undefined
})

const onChange = () => {
  emit('update:value', _value.value)
  emit('change', _value.value)
}

const focusInput = () => {
  const component = componentRef.value
  if (component?.focus) {
    component.focus()
    return
  }
  inputRef.value?.querySelector?.('input, textarea, [tabindex]:not([tabindex="-1"])')?.focus?.()
}

const enterEdit = async () => {
  if (disabled.value) {
    isEdit.value = false
    return
  }
  isEdit.value = true
  await nextTick()
  focusInput()
}

const onValueChange = () => {
  isEdit.value = false
  if (props.value !== _value.value) {
    onChange()
  }
}

const onBlur = () => {
  isEdit.value = false
}

// 根据组件类型返回对应的事件处理器
const getEventHandlers = () => {
  if (selectTypes.includes(props.type)) {
    // 选择框类型 change 时提交，未变更时 blur 也需要退出编辑态
    return {
      change: onValueChange,
      blur: onBlur
    }
  } else {
    return {
      blur: onValueChange
    }
  }
}

watch(() => props.value, (newValue) => {
  _value.value = newValue ?? undefined
}, {
  immediate: true
})

watch(disabled, (value) => {
  if (value) {
    isEdit.value = false
  }
})

</script>

<style lang="less" scoped>
.text {
  cursor: pointer;
  padding: 5px 8px;

  &:hover {
    background-color: #f5f6f8;
  }

  &.disabled {
    cursor: not-allowed;
    color: rgba(0, 0, 0, 0.25);

    &:hover {
      background-color: transparent;
    }
  }
}
</style>
