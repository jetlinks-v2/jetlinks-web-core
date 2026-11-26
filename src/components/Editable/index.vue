<template>
  <span ref="rootRef" class="editable-field" :class="{ 'editable-field--number': type === 'number', 'editable-field--picker': picker, 'editable-field--range': rangePicker, 'editable-field--empty': __value == null || __value === '', 'editable-field--multiple': multiple, 'editable-field--adorned': type === 'select' || picker }" @keydown.capture="capturePopupKey" @keydown="onKeydown" @focusout="onFocusout">
    <span v-if="isEdit" ref="inputRef" class="editable-field__control inline-edit-surface" :aria-disabled="disabled || undefined" :aria-invalid="componentProps.status === 'error' || undefined">
      <label v-if="componentProps['aria-label']" class="editable-field__label" :for="controlId">{{ componentProps['aria-label'] }}</label>
      <component
        ref="componentRef"
        :is="componentObj[type]"
        v-model:value="_value"
        style="width: 100%; height:100%"
        :bordered="false"
        :open="type === 'select' ? popupOpen : undefined"
        :show-arrow="type === 'select' ? true : undefined"
        :max-tag-count="multiple ? 0 : undefined"
        :max-tag-placeholder="multiple ? () => draftLabel : undefined"
        :separator="rangePicker ? ' — ' : undefined"
        :dropdown-match-select-width="type === 'select' && richOptions ? false : undefined"
        :dropdown-style="type === 'select' ? { minWidth: 'min(160px, calc(100vw - 24px))', maxWidth: 'calc(100vw - 24px)' } : undefined"
        :dropdown-align="type === 'select' ? { overflow: { adjustX: 1, adjustY: 1 } } : undefined"
        :get-popup-container="selectTypes.includes(type) ? popupContainer : undefined"
        v-bind="componentProps"
        :id="controlId"
        v-on="getEventHandlers()"
      >
        <template v-if="type === 'select' && ($slots.option || richOptions)" #option="option">
          <slot name="option" v-bind="option"><SelectOption :label="option.label" :icon="option.icon" :description="option.description" /></slot>
        </template>
        <template v-if="multiple" #dropdownRender="{ menuNode }">
          <component :is="menuNode" />
          <div class="editable-field__actions" @mousedown.prevent>
            <a-button size="small" @click="cancel()">{{ $t('Editable.cancel') }}</a-button>
            <a-button type="primary" size="small" :disabled="disabled" @click="onValueChange()">{{ $t('Editable.save') }}</a-button>
          </div>
        </template>
      </component>
    </span>
    <span ref="triggerRef" :class="['text', 'inline-edit-trigger', { disabled, editing: isEdit }]" :aria-disabled="disabled || undefined" :role="disabled || isEdit ? undefined : 'button'" :tabindex="disabled || isEdit ? undefined : 0" :aria-hidden="isEdit || undefined" :aria-label="componentProps['aria-label'] as string | undefined" @click="enterEdit">
      <slot :value="isEdit ? value : _value">
        <AIcon v-if="selectedOption?.icon" :type="selectedOption.icon" />
        {{ __value ?? componentProps.placeholder ?? $t('comm.table.empty') }}
      </slot>
      <component :is="type === 'select' ? DownOutlined : type.startsWith('time') ? ClockCircleOutlined : CalendarOutlined" v-if="type === 'select' || picker" class="editable-field__arrow" aria-hidden="true" />
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch, type Component } from 'vue'
import { DatePicker, Input, InputNumber, Select, TimePicker, TimeRangePicker } from 'ant-design-vue'
import { CalendarOutlined, ClockCircleOutlined, DownOutlined } from '@ant-design/icons-vue'
import SelectOption from '../SelectOption/index.vue'

type EditorType = 'string' | 'number' | 'select' | 'date' | 'time' | 'dateRange' | 'timeRange'
const props = withDefaults(defineProps<{ value?: unknown; type?: EditorType; componentProps?: Record<string, unknown> }>(), { type: 'string', componentProps: () => ({}) })
const emit = defineEmits<{ (event: 'update:value' | 'change', value: unknown): void }>()

const componentObj: Record<EditorType, Component> = {
  'string': Input,
  'number': InputNumber,
  'select': Select,
  'date': DatePicker,
  'time': TimePicker,
  'dateRange': DatePicker.RangePicker,
  'timeRange': TimeRangePicker,
}

const isEdit = ref(false)
const _value = ref(props.value)
const rootRef = ref<HTMLElement>()
const triggerRef = ref<HTMLElement>()
const inputRef = ref<HTMLElement>()
const componentRef = ref<{ focus?: () => void }>()
const popupOpen = ref(false)
const instanceId = useId()
const controlId = computed(() => typeof props.componentProps.id === 'string' ? props.componentProps.id : `editable-${instanceId}`)
let generation = 0
let popupKey: KeyboardEvent | undefined
function capturePopupKey(event: KeyboardEvent) {
  popupKey = popupOpen.value && (event.key === 'Escape' || event.key === 'Enter' && !event.ctrlKey && !event.metaKey) ? event : undefined
}

// 定义选择框类型
const selectTypes = ['select', 'date', 'time', 'dateRange', 'timeRange']
const multiple = computed(() => props.type === 'select' && ['multiple', 'tags'].includes(String(props.componentProps.mode)))
const picker = computed(() => ['date', 'time', 'dateRange', 'timeRange'].includes(props.type))
const rangePicker = computed(() => props.type === 'dateRange' || props.type === 'timeRange')
const popupContainer = (element: HTMLElement) => rootRef.value ?? element.parentElement ?? element
const copy = (value: unknown) => Array.isArray(value) ? [...value] : value
const equal = (left: unknown, right: unknown) => Array.isArray(left) && Array.isArray(right)
  ? left.length === right.length && left.every((value, index) => value === right[index]) : left === right

const disabled = computed(() => !!props.componentProps?.disabled)
// 仅声明展示元数据的选项启用图文布局，保持其他原位编辑的默认行为。
const richOptions = computed(() => Array.isArray(props.componentProps.options) && props.componentProps.options.some(item => item.icon || item.description))
const selectedOption = computed(() => props.type === 'select' && Array.isArray(props.componentProps.options)
  ? props.componentProps.options.find(item => item.value === (isEdit.value ? props.value : _value.value)) : undefined)
const optionLabel = (value: unknown) => Array.isArray(props.componentProps.options)
  ? props.componentProps.options.find(option => option.value === value)?.label ?? value : value
const draftLabel = computed(() => Array.isArray(_value.value) ? _value.value.map(optionLabel).join(', ') : '')

const __value = computed(() => {
  const value = isEdit.value ? props.value : _value.value
  if (props.type === 'select') {
    if (Array.isArray(value)) return value.map(optionLabel).join(', ')
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
  if (isEdit.value) return
  if (disabled.value) {
    isEdit.value = false
    return
  }
  const version = ++generation
  _value.value = copy(props.value)
  popupOpen.value = !!(props.componentProps.open ?? (multiple.value || props.componentProps.defaultOpen))
  isEdit.value = true
  await nextTick()
  if (version === generation) focusInput()
}

function restoreFocus() {
  void nextTick(() => {
    const target = triggerRef.value
    const document = target?.ownerDocument
    if (target && (!document || document.activeElement === document.body || rootRef.value?.contains(document.activeElement))) target.focus({ preventScroll: true })
  })
}
const onValueChange = (returnFocus = true) => {
  if (!isEdit.value || disabled.value) return
  ++generation
  isEdit.value = false
  popupOpen.value = false
  if (!equal(props.value, _value.value)) {
    onChange()
  }
  if (returnFocus) restoreFocus()
}

const cancel = (returnFocus = true) => {
  ++generation
  _value.value = copy(props.value)
  isEdit.value = false
  popupOpen.value = false
  if (returnFocus) restoreFocus()
}
async function onFocusout(event: FocusEvent) {
  if (multiple.value) return
  const scope = event.currentTarget as HTMLElement
  if (scope.contains(event.relatedTarget as Node | null)) return
  const version = generation
  await nextTick()
  if (version !== generation || popupOpen.value || scope.contains(scope.ownerDocument.activeElement)) return
  if (selectTypes.includes(props.type)) cancel(false)
  else onValueChange(false)
}
// 输入类沿用失焦提交，补齐键盘提交与取消；选择类保留控件自身的Enter语义。
const onKeydown = (event: KeyboardEvent) => {
  if (event.isComposing || event.defaultPrevented || popupKey === event) return
  if (event.key === 'Enter' && (event.target as HTMLElement | null)?.closest?.('button')) return
  if (event.key === 'Escape' && isEdit.value) {
    if (popupOpen.value) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
  } else if (['Enter', ' '].includes(event.key) && !isEdit.value) {
    event.preventDefault()
    enterEdit()
  } else if (event.key === 'Enter' && multiple.value && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    onValueChange()
  } else if (event.key === 'Enter' && !selectTypes.includes(props.type)) {
    event.preventDefault()
    onValueChange()
  }
}

// 根据组件类型返回对应的事件处理器
const getEventHandlers = () => {
  if (selectTypes.includes(props.type)) {
    return {
      change: (value: unknown) => { _value.value = copy(value); if (!multiple.value) onValueChange() },
      [props.type === 'select' ? 'dropdownVisibleChange' : 'openChange']: (open: boolean) => { popupOpen.value = open },
    }
  } else {
    return {}
  }
}

watch(() => props.value, (newValue) => {
  _value.value = copy(newValue ?? undefined)
}, {
  immediate: true
})

watch(disabled, (value) => {
  if (value) {
    cancel(false)
  }
})

// 新增字段等显式操作可直接进入编辑，沿用禁用判断与防滚动聚焦。
defineExpose({ edit: enterEdit })
onBeforeUnmount(() => { ++generation })

</script>

<style lang="less" scoped>
.editable-field { --editable-field-height:32px; position:relative; display:inline-block; vertical-align:middle; height:var(--editable-field-height); min-width:0; max-width:min(100%,var(--inline-edit-max-width,100%)); font:inherit }
// 阅读与编辑共用可用数字槽位，避免步进按钮挤掉数值或控件遮住相邻语句。
.editable-field--number,.editable-field--empty { min-width:min(4.5rem,100%); }
.editable-field--number .text { padding-inline-end:28px; }
// 范围控件平分两端输入宽度；阅读态同步使用等宽数字，避免一端被压缩。
.editable-field--picker { font-variant-numeric:tabular-nums; }
.editable-field--picker.editable-field--empty { min-width:min(100%,calc(12ch + 34px)); }
.editable-field--range.editable-field--empty { min-width:min(100%,calc(24ch + 34px)); }
.editable-field--adorned .text { position:relative; padding-inline-end:28px; }
.editable-field__arrow { position:absolute; inset-inline-end:6px; top:50%; transform:translateY(-50%); color:var(--ink-2); font-size:14px; pointer-events:none; }
// 展示文本继续占位，编辑控件只覆盖同一槽位，避免句子重新换行。
.editable-field__control { position:absolute; inset:0; display:block; width:100%; height:100%; min-width:0; line-height:var(--editable-field-height); }
.editable-field__control :deep(.ant-input),.editable-field__control :deep(.ant-input-number-input) { padding-inline:6px; font:inherit; color:inherit; }
.editable-field__control :deep(.ant-input) { padding-block:0; border:0; box-shadow:none; }
.editable-field__control :deep(.ant-select),.editable-field__control :deep(.ant-picker),.editable-field__control :deep(.ant-input-number) { font:inherit; color:inherit; }
.editable-field__control :deep(.ant-input-number) { border:0; border-radius:0; box-shadow:none; }
.editable-field__control :deep(.ant-input-number-input-wrap),.editable-field__control :deep(.ant-input-number-input) { height:100%; }
.editable-field__control :deep(.ant-input-number-input) { padding-inline-end:28px; }
.editable-field__control :deep(.ant-select .ant-select-selector) { height:100%; padding:0 6px; border:0; border-radius:0; font:inherit; box-shadow:none; overflow:hidden; }
.editable-field__control :deep(.ant-select-single .ant-select-selection-item) { padding-inline-end:22px; line-height:var(--editable-field-height); color:inherit; }
.editable-field__control :deep(.ant-select-arrow) { inset-inline-end:6px; width:14px; font-size:14px; color:var(--ink-2); }
.editable-field__control :deep(.ant-picker) { padding:0 6px; border:0; border-radius:0; box-shadow:none; }
.editable-field__control :deep(.ant-picker-input > input) { padding:0; font:inherit; color:inherit; }
.editable-field__control :deep(.ant-picker-suffix) { margin-inline-start:8px; color:var(--ink-2); }
.editable-field__control :deep(.ant-picker-range-separator) { padding:0; font:inherit; white-space:pre; }
.editable-field__control :deep(.ant-picker-separator) { width:auto; color:inherit; white-space:pre; }
.editable-field__control :deep(.ant-select-selection-overflow) { flex-wrap:nowrap; width:100%; height:100%; }
.editable-field__control :deep(.ant-select-selection-overflow-item-rest),.editable-field__control :deep(.ant-select-selection-overflow-item-suffix) { flex:0 1 auto; min-width:0; max-width:100%; }
.editable-field__control :deep(.ant-select-multiple .ant-select-selector) { padding-inline-end:28px; }
.editable-field__control :deep(.ant-select-multiple .ant-select-selection-search),.editable-field__control :deep(.ant-select-multiple .ant-select-selection-search-input) { max-width:100%; }
.editable-field__control :deep(.ant-select-multiple .ant-select-selection-item) { height:var(--editable-field-height); margin:0; padding:0; border:0; border-radius:0; background:transparent; font:inherit; }
.editable-field__control :deep(.ant-select-multiple .ant-select-selection-item-content) { margin:0; }
.editable-field__label { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.editable-field--multiple { min-width:min(10rem,100%); }
.editable-field__actions { display:flex; justify-content:flex-end; gap:var(--space-2); padding:var(--space-2); }
.text {
  display:block;
  cursor: pointer;
  padding: 0 6px;
  height:var(--editable-field-height);
  line-height:var(--editable-field-height);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;

  &.editing { visibility:hidden }

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
@media (pointer:coarse) {
  .editable-field { --editable-field-height:44px; }
  .editable-field__actions :deep(.ant-btn) { min-width:44px; min-height:44px; }
}
</style>
<style src="./inline-edit.css" />
