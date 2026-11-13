<template>
  <aside class="fw-settings" :aria-label="t('settings')">
    <header><div><Button type="text" class="fw-rename" :aria-label="t('rename')" @click="emit('rename')">{{ label(field, item) }} <EditOutlined /></Button><small>{{ t(field.multiple && field.type === 'enum' ? 'type_multiple' : `type_${field.type}`) }}</small></div><Button type="text" :aria-label="t('close')" @click="emit('close')"><CloseOutlined /></Button></header>
    <div class="fw-settings-body">
      <section v-if="displays.length" class="fw-setting">
        <h4>{{ t('appearance') }}</h4>
        <div class="fw-visual-options">
          <Button v-for="display in displays" :key="display" :class="{ active: activeDisplay === display }" :aria-label="t(display)" :aria-pressed="activeDisplay === display" @click="emit('update', { display })">
            <span class="fw-visual-heading">{{ t(display) }}<CheckOutlined v-if="activeDisplay === display" /></span>
            <span class="fw-visual-sample"><FormValue :field="field" :item="{ ...item, display }" :value="value" /></span>
          </Button>
        </div>
      </section>
      <section v-if="field.type === 'enum' && !field.readonly" class="fw-setting">
        <h4>{{ t('editor') }}</h4>
        <Segmented :value="item.editor || 'auto'" :aria-label="t('editor')" :options="[{ value: 'auto', label: t('auto') }, { value: 'list', label: t(field.multiple ? 'checkList' : 'optionList') }, { value: 'tags', label: t(field.multiple ? 'tagSelection' : 'segmentedOptions') }]" @change="emit('update', { editor: $event as FormLayoutItem['editor'] })" />
      </section>
      <details v-if="field.type === 'enum' || field.type === 'boolean'" class="fw-setting">
        <summary>{{ t('options') }}</summary>
        <div v-for="(option, index) in colorOptions" :key="index" class="fw-option-color">
          <Button type="text" class="fw-option-color-row" :aria-expanded="colorIndex === index" :aria-label="t('configureColor', { label: text(option) })" @click="colorIndex = colorIndex === index ? undefined : index">
            <FormValue :field="{ ...field, type: 'enum', multiple: false, options: [option] }" :item="{ ...item, display: 'tags' }" :value="option.value" /><span class="fw-color-dot" :style="{ background: optionColor(option, item) }" />
          </Button>
          <div v-if="colorIndex === index" class="fw-swatches">
            <Button type="text" class="fw-inherit" :aria-pressed="!overrideColor(option.value)" @click="setColor(option.value)">{{ t('inherit') }}</Button>
            <Button v-for="color in colors" :key="color.value" type="text" :class="{ active: overrideColor(option.value) === color.value }" :aria-label="t(color.label)" :aria-pressed="overrideColor(option.value) === color.value" @click="setColor(option.value, color.value)"><span class="fw-color-dot" :style="{ background: color.value }"><CheckOutlined v-if="overrideColor(option.value) === color.value" /></span></Button>
          </div>
        </div>
      </details>
      <details v-if="field.type === 'number'" class="fw-setting">
        <summary>{{ t('numberFormat') }}</summary>
        <div class="fw-detail-body">
          <div class="fw-setting-row"><label>{{ t('digits') }}</label><Select class="fw-setting-select" popup-class-name="fw-select-popup" placement="bottomRight" :dropdown-match-select-width="210" :value="item.digits ?? -1" :aria-label="t('digits')" :options="digitOptions" @change="emit('update', { digits: Number($event) < 0 ? undefined : Number($event) })"><template #option="option"><span class="fw-select-option"><span>{{ option.label }}</span><small>{{ option.preview }}</small></span></template></Select></div>
          <div class="fw-setting-row"><label>{{ t('thousands') }}</label><Switch :checked="item.thousands" @change="emit('update', { thousands: !!$event })" /></div>
          <div v-if="text(field, 'unit')" class="fw-setting-row"><label>{{ t('showUnit') }} · {{ text(field, 'unit') }}</label><Switch :checked="!item.hideUnit" @change="emit('update', { hideUnit: !$event })" /></div>
        </div>
      </details>
      <section v-if="field.type === 'date' || field.type === 'datetime'" class="fw-setting">
        <h4>{{ t('dateFormat') }}</h4><Select class="fw-setting-select" popup-class-name="fw-select-popup" placement="bottomRight" :value="item.dateFormat || (field.type === 'date' ? 'YYYY.MM.DD' : 'YYYY.MM.DD HH:mm')" :aria-label="t('dateFormat')" :options="dateFormats" @change="emit('update', { dateFormat: String($event) })" />
      </section>
      <section class="fw-setting"><h4>{{ t('width') }}</h4><Segmented :value="item.span === 2 ? 2 : 1" :aria-label="t('width')" :options="[{ value: 1, label: t('half') }, { value: 2, label: t('full') }]" @change="emit('update', { span: $event as 1 | 2 })" /></section>
      <details class="fw-setting"><summary>{{ t('more') }}</summary><div class="fw-detail-body"><div class="fw-setting-row"><label>{{ t('readonly') }}</label><Switch :checked="!!field.readonly || !!item.readonly" :disabled="field.readonly" @change="emit('update', { readonly: !!$event })" /></div></div></details>
      <details class="fw-setting fw-mobile-move"><summary>{{ t('move') }}</summary><div class="fw-detail-body"><Select class="fw-setting-select" popup-class-name="fw-select-popup" placement="bottomRight" show-search option-filter-prop="label" :value="sectionId" :aria-label="t('section')" :options="sections.map(section => ({ label: text(section), value: section.id }))" @change="emit('move', String($event))" /><div class="fw-move-actions"><Button @click="emit('shift', -1)"><ArrowUpOutlined />{{ t('previous') }}</Button><Button @click="emit('shift', 1)"><ArrowDownOutlined />{{ t('next') }}</Button></div></div></details>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { Button, Segmented, Select, Switch } from 'ant-design-vue'
import { ArrowDownOutlined, ArrowUpOutlined, CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons-vue'
import { useFormLocale } from './locale'
import { displayValue, optionColor } from './model'
import FormValue from './FormValue.vue'
import type { FormField, FormLayoutItem, FormOption, FormSection } from './types'
const props = defineProps({
  field: { type: Object as PropType<FormField>, required: true },
  item: { type: Object as PropType<FormLayoutItem>, required: true },
  sectionId: String,
  sections: { type: Array as PropType<FormSection[]>, required: true },
  value: { required: false },
})
const emit = defineEmits<{
  (event: 'update', patch: Partial<FormLayoutItem>): void
  (event: 'close' | 'rename'): void
  (event: 'shift', direction: -1 | 1): void
  (event: 'move', sectionId: string): void
}>()
const { t, locale, text, label } = useFormLocale()
const colorIndex = ref<number>()
const colors = [{ value: '#1677ff', label: 'blue' }, { value: '#389e70', label: 'green' }, { value: '#d48806', label: 'orange' }, { value: '#cf4457', label: 'red' }, { value: '#805ad5', label: 'purple' }, { value: '#697586', label: 'neutral' }]
const displays = computed<NonNullable<FormLayoutItem['display']>[]>(() => props.field.type === 'enum' ? ['tags', 'text'] : ['text', 'textarea'].includes(props.field.type) ? ['text', 'paragraph'] : [])
const activeDisplay = computed(() => props.item.display && props.item.display !== 'auto' ? props.item.display : props.field.type === 'enum' ? 'tags' : props.field.type === 'textarea' ? 'paragraph' : 'text')
// 配置候选和画布复用同一格式化规则，只改变展示，不改业务值。
const digitOptions = computed(() => [-1, 0, 1, 2, 3, 4, 5, 6].map(digits => ({ value: digits, label: digits < 0 ? t('sourcePrecision') : t('precisionDigits', { count: digits }), preview: displayValue(props.field, { ...props.item, digits: digits < 0 ? undefined : digits }, props.value, locale.value) })))
const dateFormats = computed(() => (props.field.type === 'date' ? ['YYYY.MM.DD', 'YYYY-MM-DD', locale.value.startsWith('zh') ? 'YYYY年M月D日' : 'DD/MM/YYYY'] : ['YYYY.MM.DD HH:mm', 'YYYY-MM-DD HH:mm:ss', 'YYYY.MM.DD']).map(dateFormat => ({ value: dateFormat, label: displayValue(props.field, { ...props.item, dateFormat }, props.value || '2026-09-16T14:30:00', locale.value) })))
const colorOptions = computed(() => props.field.type === 'boolean' ? [{ value: true, label: t('yes'), color: '#389e70' }, { value: false, label: t('no'), color: '#697586' }] : props.field.options)
function overrideColor(value: FormOption['value']) { return props.item.optionColors?.find(entry => Object.is(entry.value, value))?.color }
function setColor(value: FormOption['value'], color?: string) {
  const colors = props.item.optionColors?.filter(entry => !Object.is(entry.value, value)) ?? []
  emit('update', { optionColors: color ? [...colors, { value, color }] : colors })
}
</script>

<style scoped>
.fw-settings { display: flex; flex-direction: column; position: absolute; right: 12px; top: 60px; width: 292px; max-height: calc(100% - 76px); border: 1px solid var(--line, #e5e9ef); border-radius: 10px; background: var(--bg, #fff); box-shadow: var(--shadow-2, 0 10px 32px #1a25301a); z-index: 5; color: var(--jet-theme-text, #1f2429); }
header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line, #edf0f3); }
.fw-rename.ant-btn { display: block; max-width: 215px; height: auto; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px; font-weight: 600; }
.fw-rename .anticon { color: var(--jet-theme-text-secondary, #697586); margin-left: 4px; }
small { color: var(--jet-theme-text-secondary, #697586); font-size: 11px; }
.fw-settings-body { padding: 18px 16px 2px; overflow: auto; overscroll-behavior: contain; }
.fw-setting { margin: 0 0 20px; }
h4 { font-size: 12px; font-weight: 500; margin: 0 0 10px; color: var(--jet-theme-text-secondary, #697586); }
.fw-setting :deep(.ant-select), .fw-setting :deep(.ant-segmented) { width: 100%; }
.fw-setting :deep(.ant-segmented-group) { display: flex; }
.fw-setting :deep(.ant-segmented-item) { flex: 1; min-width: 0; }
.fw-setting :deep(.ant-segmented-item-label) { padding: 5px 6px; font-size: 12px; min-height: 32px; white-space: normal; line-height: 22px; }
.fw-setting-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.fw-setting-row label { font-size: 12px; color: var(--jet-theme-text-secondary, #697586); flex-shrink: 0; }
.fw-setting-row :deep(.ant-select) { width: 148px; }
.fw-visual-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.fw-visual-options :deep(.ant-btn) { display: flex; flex-direction: column; align-items: stretch; gap: 10px; height: 94px; padding: 11px 10px; font-size: 12px; color: var(--jet-theme-text-secondary, #697586); background: var(--bg, #fff); border-color: var(--line, #e5e9ef); white-space: normal; text-align: left; overflow: hidden; }
.fw-visual-options :deep(.ant-btn.active) { border-color: var(--jet-theme-primary-border, #91bfff); background: var(--jet-theme-primary-bg, #f0f6ff); }
.fw-visual-heading { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.fw-visual-heading .anticon { color: var(--jet-theme-primary, #1677ff); }
.fw-visual-sample { display: block; min-width: 0; overflow: hidden; color: var(--jet-theme-text, #1f2429); font-size: 12px; line-height: 19px; }
.fw-visual-sample :deep(.fw-text:not(.fw-paragraph)) { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fw-visual-sample :deep(.fw-paragraph) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.fw-visual-sample :deep(.fw-tag) { font-size: 11px; padding: 0 5px; line-height: 19px; }
.fw-option-color-row.ant-btn { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; height: auto; min-height: 38px; padding: 5px 8px; text-align: left; }
.fw-color-dot { display: inline-grid; place-items: center; width: 12px; height: 12px; border-radius: 50%; background: var(--jet-theme-text-secondary, #697586); flex-shrink: 0; }
.fw-swatches { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; padding: 4px 0 10px; }
.fw-swatches :deep(.ant-btn) { padding: 5px; height: 32px; }
.fw-swatches .fw-inherit { grid-column: 1 / -1; justify-self: start; }
.fw-swatches .fw-color-dot { width: 18px; height: 18px; color: white; font-size: 12px; }
.fw-swatches .active { background: var(--jet-theme-primary-bg, #f0f6ff); }
summary { cursor: pointer; font-size: 12px; color: var(--jet-theme-text-secondary, #697586); min-height: 30px; line-height: 30px; }
.fw-detail-body { display: grid; gap: 14px; padding-top: 12px; }
.fw-mobile-move { display: none; }
.fw-move-actions { display: flex; gap: 8px; }
.fw-move-actions .ant-btn { flex: 1; }
@container fw-designer (min-width: 601px) { .fw-settings-left { left: 12px; right: auto; } }
@container fw-designer (max-width: 600px) {
  .fw-settings { top: auto; bottom: 0; right: 0; width: 100%; max-height: 48%; border-radius: 12px 12px 0 0; }
  .fw-settings-body { padding: 12px 16px 0; }
  .fw-setting { margin-bottom: 16px; }
  .fw-mobile-move { display: block; }
  summary, .fw-setting :deep(.ant-segmented-item-label) { min-height: 44px; }
  summary { line-height: 44px; }
  header :deep(.ant-btn), .fw-mobile-move :deep(.ant-btn), .fw-option-color-row.ant-btn, .fw-swatches :deep(.ant-btn) { min-height: 44px; }
}
</style>
