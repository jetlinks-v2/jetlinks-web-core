<template>
  <span class="editable-field" @keydown="onKeydown">
    <span v-if="isEdit" ref="inputRef" class="editable-field__control">
      <component
        ref="componentRef"
        :is="componentObj[type]"
        v-model:value="_value"
        style="width: 100%; height:100%"
        :dropdown-match-select-width="type === 'select' && richOptions ? false : undefined"
        v-bind="componentProps"
        v-on="getEventHandlers()"
      >
        <template v-if="type === 'select' && ($slots.option || richOptions)" #option="option">
          <slot name="option" v-bind="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></slot>
        </template>
      </component>
    </span>
    <span :class="['text', { disabled, editing: isEdit }]" :role="disabled || isEdit ? undefined : 'button'" :tabindex="disabled || isEdit ? undefined : 0" :aria-hidden="isEdit || undefined" :aria-label="componentProps['aria-label'] as string | undefined" @click="enterEdit">
      <slot :value="isEdit ? value : _value">
        <AIcon v-if="selectedOption?.icon" :type="selectedOption.icon" />
        {{ __value ?? componentProps.placeholder ?? $t('comm.table.empty') }}
      </slot>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { DatePicker, Input, InputNumber, Select, TimePicker } from 'ant-design-vue'
import SelectOption from '../SelectOption/index.vue'

type EditorType = 'string' | 'number' | 'select' | 'date' | 'time' | 'dateRange' | 'timeRange'
const props = withDefaults(defineProps<{ value?: unknown; type?: EditorType; componentProps?: Record<string, unknown> }>(), { type: 'string', componentProps: () => ({}) })
const emit = defineEmits<{ (event: 'update:value' | 'change', value: unknown): void }>()

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
const inputRef = ref<HTMLElement>()
const componentRef = ref<{ focus?: () => void }>()

// 定义选择框类型
const selectTypes = ['select', 'date', 'time', 'dateRange', 'timeRange']

const disabled = computed(() => !!props.componentProps?.disabled)
// 仅声明展示元数据的选项启用图文布局，保持其他原位编辑的默认行为。
const richOptions = computed(() => Array.isArray(props.componentProps.options) && props.componentProps.options.some(item => item.icon || item.description))
const selectedOption = computed(() => props.type === 'select' && Array.isArray(props.componentProps.options)
  ? props.componentProps.options.find(item => item.value === (isEdit.value ? props.value : _value.value)) : undefined)

const __value = computed(() => {
  const value = isEdit.value ? props.value : _value.value
  if (props.type === 'select') {
    return selectedOption.value?.label
  }
  return value ?? undefined
})

const onChange = () => {
  emit('update:value', _value.value)
  emit('change', _value.value)
}

const focusInput = () => {
  // 原位编辑只切换焦点，不让浏览器将属性面板滚到输入框中线。
  const input = inputRef.value?.querySelector<HTMLElement>('input, textarea, [tabindex]:not([tabindex="-1"])')
  if (input) {
    input.focus({ preventScroll: true })
    return
  }
  componentRef.value?.focus?.()
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
  if (!isEdit.value || disabled.value) return
  isEdit.value = false
  if (props.value !== _value.value) {
    onChange()
  }
}

const onBlur = () => {
  isEdit.value = false
}
const cancel = () => { _value.value = props.value; isEdit.value = false }
// 输入类沿用失焦提交，补齐键盘提交与取消；选择类保留控件自身的Enter语义。
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isEdit.value) {
    event.stopPropagation()
    cancel()
  } else if (event.key === 'Enter' && !isEdit.value) {
    event.preventDefault()
    enterEdit()
  } else if (event.key === 'Enter' && !selectTypes.includes(props.type)) {
    onValueChange()
  }
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
    cancel()
  }
})

// 新增字段等显式操作可直接进入编辑，沿用禁用判断与防滚动聚焦。
defineExpose({ edit: enterEdit })

</script>

<style lang="less" scoped>
.editable-field { position:relative; display:inline-block; vertical-align:middle; height:32px; min-width:0; max-width:100%; font:inherit }
// 展示文本继续占位，编辑控件只覆盖同一槽位，避免句子重新换行。
.editable-field__control { position:absolute; inset:0; display:block; width:100%; height:100%; min-width:0 }
.editable-field__control :deep(.ant-input),.editable-field__control :deep(.ant-input-number-input) { padding-inline:6px }
.editable-field__control :deep(.ant-select-single .ant-select-selector) { padding-inline:6px }
.text {
  display:block;
  cursor: pointer;
  padding: 0 6px;
  height:32px;
  line-height:32px;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  border-radius:var(--r-2,6px);

  &.editing { visibility:hidden }

  &:hover {
    background-color:var(--bg-sunken,#f5f6f8);
  }

  &:focus-visible {
    outline: 2px solid var(--accent, #1677ff);
    outline-offset: -2px;
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
