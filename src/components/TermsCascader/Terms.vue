<script setup lang="ts" name="Terms">
import ColumnSelect from './ColumnSelect.vue'
import TermTypeSelect from './TermTypeSelect.vue'
import ValueItem from './Value/index.vue'
import { useTermsValueContext, useTermsParse, useValueOptionsContext } from './hooks'
import { doubleParamsKey, nullKeys } from './utils'
import { ValueProps } from './Value/utils'

const emit = defineEmits(['change'])
const props = defineProps({
  value: {
    type: Object,
    default: () => ({})
  },
  ...ValueProps()
})

const termsParse = useTermsParse()

const termsData = ref({
  column: undefined,
  termType: undefined,
  value: {
    source: 'fixed',
    value: undefined
  }
})

const valueParse = ref({
  options: [],
  map: new Map()
})

const columnDetail = computed(() => {
  const map = unref(termsParse.map)
  const detail = termsData.value.column ? map.get(termsData.value.column) : {}
  cleanValueParse()

  if (detail?.others) {
    const others = detail.others
    let options = []
    let map = new Map()
    if ('bool' in others) {
      const bool = others.bool
      options = [
        { label: bool.trueText, value: bool.trueValue },
        { label: bool.falseText, value: bool.falseValue },
      ]
      map.set(options[0].value, options[0])
      map.set(options[1].value, options[1])
    } else if ('elements' in others) {
      const elements = others.elements
      options = elements.map(item => {
        const result = {
          label: item.text,
          value: item.value,
        }
        map.set(result.value, result)
        return result
      })
    }
    valueParse.value.options = options;
    valueParse.value.map = map
  }

  return detail
})

const showValue = computed(() => {
  return nullKeys.includes(termsData.value.termType)
})

const showDouble = computed(() => {
  return doubleParamsKey.includes(termsData.value.termType)
})

const cleanValueParse = () => {
  valueParse.value.options = []
  valueParse.value.map = new Map()
}

useTermsValueContext(termsData)
useValueOptionsContext(valueParse)

watch(() => props.value, (newValue) => {
  if (newValue) {
    termsData.value = newValue
  }
}, { immediate: true, deep: true})

</script>

<template>
  <a-space :size="4">
    <ColumnSelect :options="termsParse.options.value" />
    <TermTypeSelect />
    <template v-if="!showValue">
      <ValueItem
        :columnDetail="columnDetail"
        :builtinOptions="builtinOptions"
        :builtinOptionsMap="builtinOptionsMap"
        :showValueType="showValueType"
        :fieldNames="fieldNames"
      />
      <ValueItem
        v-if="showDouble"
        :columnDetail="columnDetail"
        :builtinOptions="builtinOptions"
        :builtinOptionsMap="builtinOptionsMap"
        :showValueType="showValueType"
        :fieldNames="fieldNames"
        :index="1"
      />
    </template>
  </a-space>
</template>

<style scoped lang="less">

</style>
