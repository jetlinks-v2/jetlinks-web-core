<template>
  <div v-if="inline" ref="root" class="fw-editor" :class="{ 'fw-number-editor': field.type === 'number', 'fw-textarea-editor': field.type === 'textarea' }" @keydown="onKeydown" @focusout="onBlur">
    <Input.TextArea v-if="field.type === 'textarea'" :value="text" :aria-label="label(field, item)" :auto-size="{ minRows: 1 }" :style="{ minHeight: `${minHeight}px` }" @update:value="emit('update', $event)" />
    <template v-else>
      <span class="fw-input-size"><span aria-hidden="true" class="fw-measure">{{ text || ' ' }}</span><Input :value="text" :aria-label="label(field, item)" :inputmode="field.type === 'number' ? 'decimal' : undefined" autocomplete="off" @update:value="emit('update', $event)" /></span>
      <span v-if="localText(field, 'unit') && !item.hideUnit" class="fw-unit">{{ localText(field, 'unit') }}</span>
    </template>
  </div>
  <span v-else-if="field.type === 'date' || field.type === 'datetime'" class="fw-date-editor">
    <label class="fw-control-label" :for="radioName">{{ label(field, item) }}</label>
    <span aria-hidden="true" class="fw-date-size">{{ date?.format(dateFormat) || label(field, item) }}</span>
    <DatePicker :id="radioName" :value="date" :open="true" :autofocus="true" :bordered="false" :format="dateFormat" :placeholder="label(field, item)" :show-time="field.type === 'datetime'" :allow-clear="!field.required" :input-read-only="mobile" popup-class-name="fw-date-popup" @change="setDate" @open-change="!$event && emit('cancel')" />
  </span>
  <template v-else>
    <span v-if="mobile" class="fw-picker-anchor" :style="{ minHeight: `${minHeight}px` }"><FormValue :field="field" :item="item" :value="originalValue" /></span>
    <component :is="mobile ? Drawer : Popover" :open="true" v-bind="overlayProps" @close="emit('cancel')" @open-change="!$event && emit('cancel')">
      <template #[mobile?'default':'content']>
        <div ref="root" class="fw-picker" @keydown.esc.prevent.stop="emit('cancel')">
          <div v-if="!mobile" class="fw-picker-heading"><strong>{{ label(field, item) }}</strong><Button type="text" :aria-label="t('close')" @click="emit('cancel')"><CloseOutlined /></Button></div>
          <div class="fw-picker-body">
            <template v-if="field.type === 'enum' || field.type === 'boolean'">
              <Input.Search v-if="options.length > 8" v-model:value="query" class="fw-option-search" :placeholder="t('searchOptions')" :aria-label="t('searchOptions')" allow-clear />
              <Checkbox.Group v-if="field.multiple" class="fw-option-list" :class="{ 'fw-option-tags': editorStyle === 'tags' }" :value="Array.isArray(selection) ? selection : []" :aria-label="label(field, item)" @change="selectValue($event.map(String))">
                <Checkbox v-for="option in visibleOptions" :key="option.value" :value="option.value"><FormValue :field="{ ...field, type: 'enum', multiple: false, options: [option.option] }" :item="{ ...item, display: 'tags' }" :value="option.option.value" /></Checkbox>
              </Checkbox.Group>
              <Radio.Group v-else class="fw-option-list" :class="{ 'fw-option-tags': editorStyle === 'tags' }" :value="selection" :name="radioName" :aria-label="label(field, item)" @change="selectValue($event.target.value)">
                <Radio v-for="option in visibleOptions" :key="option.value" :value="option.value"><FormValue :field="field.type === 'boolean' ? field : { ...field, multiple: false, options: [option.option] }" :item="{ ...item, display: 'tags' }" :value="option.option.value" /></Radio>
              </Radio.Group>
              <span v-if="!visibleOptions.length" class="fw-no-options">{{ t('noOptions') }}</span>
            </template>
          </div>
          <div class="fw-picker-actions"><Button v-if="!field.required" type="text" danger class="fw-picker-clear" @click="emit('update', field.multiple ? [] : null)">{{ t('clear') }}</Button><Button @click="emit('cancel')">{{ t('cancel') }}</Button><Button type="primary" @click="emit('confirm')">{{ t('confirm') }}</Button></div>
        </div>
      </template>
      <template v-if="!mobile" #default><span class="fw-picker-anchor" :style="{ minHeight: `${minHeight}px` }"><FormValue :field="field" :item="item" :value="originalValue" /></span></template>
    </component>
  </template>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, type PropType } from 'vue'
import { Button, Checkbox, DatePicker, Drawer, Input, Popover, Radio } from 'ant-design-vue'
import { CloseOutlined } from '@ant-design/icons-vue'
import { useFormValueEditor } from './useFormValueEditor'
import FormValue from './FormValue.vue'
import { useFormLocale } from './locale'
import type { FormField, FormLayoutItem } from './types'

const props = defineProps({
  field: { type: Object as PropType<FormField>, required: true },
  item: { type: Object as PropType<FormLayoutItem>, required: true },
  value: { required: false },
  originalValue: { required: false },
  minHeight: { type: Number, default: 26 },
})
const emit = defineEmits<{
  (event: 'update', value: unknown): void
  (event: 'confirm' | 'cancel'): void
  (event: 'navigate', reverse: boolean): void
}>()
const { t, locale, text: localText, label } = useFormLocale()
const radioName = `fw-choice-${getCurrentInstance()?.uid}`
const { root, inline, text, mobile, overlayProps, editorStyle, options, visibleOptions, query, selection, date, onKeydown, onBlur, selectValue, setDate } = useFormValueEditor(props, {
  update: value => emit('update', value), confirm: () => emit('confirm'), cancel: () => emit('cancel'), navigate: reverse => emit('navigate', reverse),
}, () => locale.value, () => [t('yes'), t('no')])
const dateFormat = computed(() => props.field.type === 'datetime' ? 'YYYY.MM.DD HH:mm:ss' : props.item.dateFormat || 'YYYY.MM.DD')
</script>

<style scoped>
.fw-editor { display: inline-flex; vertical-align: top; align-items: baseline; max-width: 100%; min-height: 26px; font: inherit; line-height: inherit; }
.fw-textarea-editor { display: flex; width: 100%; }
.fw-number-editor { font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; }
.fw-input-size { display: inline-block; position: relative; min-width: 1ch; max-width: 100%; }
.fw-measure { display: block; visibility: hidden; white-space: pre; padding-right: 3px; overflow: hidden; }
.fw-input-size :deep(.ant-input) { position: absolute; inset: 0; width: 100%; min-width: 0; height: 100%; }
.fw-editor :deep(.ant-input) { padding: 0; border: 0; border-radius: 2px; outline: 0; box-shadow: 0 1px var(--jet-theme-primary, #1677ff); color: inherit; background: var(--bg-sunken, #f5f7fa); font: inherit; line-height: inherit; resize: none; }
.fw-unit { flex-shrink: 0; margin-left: 5px; color: var(--jet-theme-text-secondary, #697586); font-size: 12px; line-height: normal; }
.fw-picker { display: flex; flex-direction: column; width: 320px; max-width: calc(100vw - 24px); max-height: calc(100dvh - 32px); color: var(--jet-theme-text, #1f2429); }
.fw-picker-heading { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px 4px 16px; }
.fw-picker-heading strong { font-size: 13px; font-weight: 600; }
.fw-picker-heading .ant-btn { width: 32px; height: 32px; padding: 0; }
.fw-picker-body { padding: 8px 12px 12px; overflow: auto; min-height: 0; overscroll-behavior: contain; }
.fw-picker-actions { display: flex; justify-content: flex-end; align-items: center; gap: 7px; padding: 10px 12px; border-top: 1px solid var(--line, #edf0f3); flex-shrink: 0; }
.fw-picker-clear.ant-btn { margin-right: auto; padding-inline: 8px; }
.fw-option-search { margin-bottom: 10px; }
.fw-option-list { display: flex; flex-direction: column; gap: 4px; }
.fw-option-list :deep(.ant-checkbox-wrapper), .fw-option-list :deep(.ant-radio-wrapper) { display: flex; align-items: center; flex-direction: row-reverse; justify-content: space-between; gap: 12px; margin: 0; min-height: 42px; padding: 8px 10px; border: 1px solid transparent; border-radius: 6px; font-size: 13px; color: var(--jet-theme-text, #1f2429); }
.fw-option-list :deep(.ant-checkbox-wrapper:hover), .fw-option-list :deep(.ant-radio-wrapper:hover) { background: var(--bg-sunken, #f7f9fc); }
.fw-option-list :deep(.ant-checkbox-wrapper-checked), .fw-option-list :deep(.ant-radio-wrapper-checked) { background: var(--jet-theme-primary-bg, #f0f6ff); border-color: var(--jet-theme-primary-border, #91bfff); }
.fw-option-list :deep(.ant-checkbox), .fw-option-list :deep(.ant-radio) { top: 0; flex-shrink: 0; }
.fw-option-list :deep(.ant-radio-checked .ant-radio-inner::after) { top: 48%; left: 50%; width: 5px; height: 9px; margin: 0; border: solid white; border-width: 0 1.5px 1.5px 0; border-radius: 0; background: transparent; transform: translate(-50%, -60%) rotate(45deg); }
.fw-option-list :deep(.ant-checkbox + span), .fw-option-list :deep(.ant-radio + span) { padding: 0; min-width: 0; overflow-wrap: anywhere; }
.fw-option-tags { flex-direction: row; flex-wrap: wrap; gap: 8px; }
.fw-option-tags :deep(.ant-checkbox-wrapper), .fw-option-tags :deep(.ant-radio-wrapper) { max-width: 100%; border-color: var(--line, #e5e9ef); gap: 10px; }
.fw-option-tags :deep(.ant-checkbox-wrapper-checked), .fw-option-tags :deep(.ant-radio-wrapper-checked) { border-color: var(--jet-theme-primary-border, #91bfff); }
.fw-no-options { display: block; padding: 16px; color: var(--jet-theme-text-secondary, #697586); text-align: center; font-size: 12px; }
.fw-date-editor { display: inline-block; position: relative; vertical-align: top; max-width: 100%; }
.fw-date-size { display: block; visibility: hidden; overflow: hidden; white-space: pre; padding-inline-end: 36px; line-height: 26px; }
.fw-date-editor :deep(.ant-picker) { position: absolute; inset: 0; padding: 0; height: 26px; width: 100%; background: transparent; border-radius: 0; box-shadow: inset 0 -1px var(--jet-theme-primary, #1677ff); }
.fw-control-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.fw-date-editor :deep(.ant-picker-input > input) { font: inherit; line-height: 26px; }
.fw-date-editor :deep(.ant-picker-suffix) { color: var(--jet-theme-text-secondary, #697586); }
.fw-picker-anchor { display: inline-block; box-shadow: 0 1px var(--jet-theme-primary, #1677ff); }
@media (max-width: 600px) {
  .fw-picker { width: 100%; max-width: none; max-height: 65dvh; }
  .fw-picker-actions .ant-btn, .fw-option-list :deep(.ant-checkbox-wrapper), .fw-option-list :deep(.ant-radio-wrapper) { min-height: 44px; }
  .fw-picker-actions .ant-btn { min-width: 44px; }
  .fw-picker-body { padding: 8px 16px 16px; }
  .fw-picker-actions { padding: 10px 16px max(10px, env(safe-area-inset-bottom)); }
}
@media (pointer: coarse) { .fw-picker-actions .ant-btn { min-height: 44px; } }
</style>
