<script setup name="ValueFixed">
import { ValueItem } from '@jetlinks-web/components'
import { isObject } from 'lodash-es'

const asyncComponents = {
  time: defineAsyncComponent(() => import('./Time.vue')),
  valueItem: ValueItem
}
const emit = defineEmits(['update:value', 'change'])

const props = defineProps({
  dataType: {
    type: [String, undefined],
    default: undefined,
  },
  value: {
    type: [String, Number, undefined, Object],
    default: undefined,
  },
  options: {
    type: Array,
    default: () => [],
  }
})

const myValue = ref()

const contentRef = computed(() => {
  if (['date', 'time'].includes(props.dataType)) {
    return asyncComponents.time
  }

  return asyncComponents.valueItem
})

const onChange = (e) => {
  const value = isObject(e) ? e.value : e
  emit('update:value', value)
  emit('change', value)
}

watch(() => props.value, (newValue) => {
  myValue.value = newValue
}, { immediate: true })

</script>

<template>
  <div class="terms--value--fixed">
    <component
      v-if="contentRef && dataType"
      :is="contentRef"
      :itemType="dataType"
      :modelValue="myValue"
      :options="options"
      format="HH:mm:ss"
      @change="onChange"
    >

    </component>
    <j-empty v-else />
  </div>
</template>

<style scoped lang="less">
.terms--value--fixed {
  padding: 8px;
  min-width: 200px;
  min-height: 40px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>
