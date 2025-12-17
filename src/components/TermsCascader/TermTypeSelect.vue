<script setup name="TermTypeSelect">
import { useTermsParse, useTermsValue } from './hooks'
import { complexKey, doubleParamsKey } from '@jetlinks-web-core/components/TermsCascader/utils'

const props = defineProps({
  value: String,
  detail: Object
})

const termsValue = useTermsValue()
const termsParseData = useTermsParse()

const handleTermValue = (termType) => {

}


const onChange = () => {

}

const onSelect = (key) => {
  //  区间值，旧数据保留第一位, 如果是数组，则value不变化，否则反之
  if (doubleParamsKey.includes(key) && !Array.isArray(termsValue.value.value.value)) { //
    const oldValue = termsValue.value.value.value
    termsValue.value.value.value = [oldValue, undefined]
  } else if (Array.isArray(termsValue.value.value.value)) { // 从数组值变为单个值，获取数组第一个值
    termsValue.value.value.value = termsValue.value.value.value[0]
  } else if (key === complexKey) { // 满足时，设置为1，便于过校验
    termsValue.value.value.value = 1
  } else {
    termsValue.value.value.value = undefined
  }
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

<style scoped lang="less">
@import "./style/comm.less";
</style>
