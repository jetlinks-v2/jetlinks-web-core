<template>
  <Editable v-if="inline && simple" class="metric-parameter-value" :value="editableValue" :type="editorType"
    :component-props="{ ...editorProps, disabled, bordered:false, placeholder:t('notConfigured'), 'aria-label':parameter.name || parameter.id }" @change="changeInline">{{ display }}</Editable>
  <details v-else-if="inline" class="metric-parameter-value metric-parameter-value--structured">
    <summary>{{ display }}</summary>
    <pre v-if="disabled">{{ display }}</pre>
    <MetadataValueItem v-else :item="metadataItem" :model-value="modelValue as MetadataEditorValue" @update:model-value="change" />
  </details>
  <a-switch v-else-if="parameter.valueType?.type === 'boolean'" :checked="modelValue === true" :disabled="disabled"
    @update:checked="change" />
  <a-input-number v-else-if="numeric" :value="modelValue as number | string | undefined" :precision="precision"
    :min="parameterNumber(parameter.valueType?.min)" :max="parameterNumber(parameter.valueType?.max)" :disabled="disabled"
    :formatter="formatNumber" :aria-label="parameter.name || parameter.id" style="width:100%"
    @update:value="change" />
  <MetadataValueItem v-else :item="metadataItem" :disabled="disabled"
    :model-value="modelValue as MetadataEditorValue" @update:model-value="change" />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Editable from '../Editable/index.vue'
import MetadataValueItem from '../MetadataValueItem/index.vue'
import type { MetricParameter } from './types'
import { numericParameter, parameterElements, parameterNumber, parameterPrecision, parameterValueText } from './parameterPresentation'
import { metricMessages } from './messages'
type MetadataEditorValue = string | number | unknown[] | Record<string, unknown> | undefined
const props = defineProps<{ parameter: MetricParameter; modelValue: unknown; inline?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: unknown): void }>()
const { t } = useI18n({ useScope:'local', messages:metricMessages })
const numeric = computed(() => numericParameter(props.parameter))
const precision = computed(() => parameterPrecision(props.parameter))
const type = computed(() => props.parameter.valueType?.type || 'string')
const simple = computed(() => numeric.value || ['string', 'boolean', 'enum'].includes(type.value))
const editorType = computed(() => ['boolean','enum'].includes(type.value) ? 'select' : numeric.value ? 'number' : 'string')
const editableValue = computed(() => type.value === 'boolean' && typeof props.modelValue === 'boolean' ? String(props.modelValue) : props.modelValue)
const editorProps = computed(() => {
  if (type.value === 'boolean') return { defaultOpen:true, dropdownMatchSelectWidth:false, options:[{ value:'true', label:t('parameterOn'), icon:'CheckCircleOutlined', description:'true' }, { value:'false', label:t('parameterOff'), icon:'CloseCircleOutlined', description:'false' }] }
  if (type.value === 'enum') return { defaultOpen:true, dropdownMatchSelectWidth:false, mode:props.parameter.valueType?.multi ? 'multiple' : undefined, options:parameterElements(props.parameter).map(item => ({ value:item.value, label:item.text ?? item.label ?? item.value, icon:'TagOutlined', description:String(item.value) })) }
  return numeric.value ? { controls:false, precision:precision.value, min:parameterNumber(props.parameter.valueType?.min), max:parameterNumber(props.parameter.valueType?.max), formatter:formatNumber } : {}
})
const display = computed(() => parameterValueText(props.parameter, props.modelValue, t))
function change(value:unknown) { if (!props.disabled) emit('update:modelValue', value) }
function changeInline(value:unknown) { change(type.value === 'boolean' && value != null ? value === 'true' : value) }
/** canonical 枚举使用 text，现有元数据控件的选项显示使用 label；只适配显示，不改配置。 */
const metadataItem = computed(() => {
  const valueType = props.parameter.valueType || { type: 'string' }
  return { ...props.parameter, valueType: valueType.type === 'enum' && Array.isArray(valueType.elements)
    ? { ...valueType, elements: valueType.elements.map(item => ({ ...item, label: item.text ?? item.label ?? String(item.value) })) } : valueType }
})
/** 只移除补齐的小数零；输入时保留小数点、负号等尚未完成的文本。 */
function formatNumber(value: string | number | undefined, info: { userTyping: boolean; input: string }) {
  if (info.userTyping) return info.input
  return String(value ?? '').replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
}
</script>
<style scoped>
.metric-parameter-value { min-width:64px; max-width:100%; vertical-align:middle }
.metric-parameter-value--structured { min-width:0; width:100%; overflow:hidden }
.metric-parameter-value--structured summary { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; line-height:32px }
.metric-parameter-value--structured pre { max-height:180px; overflow:auto; white-space:pre-wrap; font-size:12px }
</style>
