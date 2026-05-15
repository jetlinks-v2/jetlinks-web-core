<script setup name="TermTypeSelect">
import { useTermsEvent, useTermsParse, useTermsValue } from './hooks'
import { complexKey, doubleParamsKey } from '@jetlinks-web-core/components/TermsCascader/utils'

const props = defineProps({
  value: String,
  detail: Object
})

const termsValue = useTermsValue()
const termsParseData = useTermsParse()
const events = useTermsEvent()

const onChange = () => {

}

const onSelect = (key) => {
  let value = events.getValue?.()
  //  区间值，旧数据保留第一位, 如果是数组，则value不变化，否则反之
  if (doubleParamsKey.includes(key) && !Array.isArray(value)) { //
    const oldValue = value
    value = [oldValue, undefined]
  } else if (Array.isArray(value)) { // 从数组值变为单个值，获取数组第一个值
    value = value[0]
  } else if (key === complexKey) { // 满足时，设置为1，便于过校验
    value = 1
  } else {
    value = undefined
  }
  events.updateValue(value)
  events.onChange?.()
}

const options = computed(() => {
  const column = unref(termsValue)?.column
  const map = unref(termsParseData.map)
  return ((column && map.get(column)) || {}).termTypes || []
})

</script>

<template>
  <a-select
    v-model:value="termsValue.termType"
    placeholder="操作符"
    class="border-box terms-type"
    :dropdownMatchSelectWidth="false"
    :options="options"
    :fieldNames="{label: 'name', value: 'id'}"
    @change="onChange"
    @select="onSelect"
  >
    <template #suffixIcon> </template>
  </a-select>
</template>

<style scoped>
.border-box {
  border-radius: var(--r-3);
}
.border-box :deep(.ant-select-selector) {
  border-radius: var(--r-3);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--info);
  background-color: color-mix(in srgb, var(--accent) 30%, transparent);
}
.border-box :deep(.ant-select-selector) .ant-select-selection-placeholder {
  color: var(--info);
  padding-inline-end: 0;
}
.border-box.terms-type :deep(.ant-select-selector) {
  color: var(--info);
  background: color-mix(in srgb, var(--accent) 30%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.border-box.terms-type :deep(.ant-select-selector) .ant-select-selection-placeholder {
  color: var(--info);
}
.border-box.terms-value {
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  background-color: color-mix(in srgb, var(--accent) 10%, transparent);
}
.border-box :deep(.ant-select-selection-item) {
  padding-inline-end: 0;
}</style>
