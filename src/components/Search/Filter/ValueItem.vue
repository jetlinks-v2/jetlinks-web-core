<script setup>
import { Input, InputNumber } from 'ant-design-vue'
import Tree from './ValueComponents/Tree.vue'
import DatePicker from './ValueComponents/DatePicker.vue'
import { useColumnItemOptions, useColumnsMap } from './hooks/useSearchEngine'

const props = defineProps({
  value: {
    type: [String, Number],
    default: undefined,
  },
  column: {
    type: String,
    default: undefined,
  },
})

const optionsContent = useColumnItemOptions()
const columnsMap = useColumnsMap()
const myValue = ref()

const emit = defineEmits(['change'])

const columnItem = computed(() => {
  if (!props.column) {
    return null
  }
  return columnsMap[props.column]
})

const type = computed(() => {
  return columnItem.value?.search?.type || 'string'
})

const options = computed(() => {
  if (!props.column) {
    return []
  }
  const column = columnsMap[props.column]
  const data = optionsContent[props.column] || []

  return ['tree', 'treeSelect'].includes(column.search?.type) ? data : data.map(item => ({ ...item,name: item.label, value: item.value, id: item.id || item.value}))
})

const onSubmit = () => {
  emit('change', myValue.value)
}

const onInputChange = (e) => {
  myValue.value = e.target.value
}

const onNumberChange = (e) => {
  myValue.value = e
}

const onValueChange = (e) => {
  myValue.value = e
}

watch(() => props.value, () => {
  myValue.value = props.value
}, { immediate: true })
</script>

<template>
  <div class="filter-terms-value-item" style="min-width: 120px">

    <a-input-number
      v-if="type === 'number'"
      v-model:value="myValue"
      style="width:100%"
      v-bind="columnItem.search.componentProps"
      @change="onNumberChange"
    />
    <Tree
      v-else-if="type === 'tree' || type === 'select' || type === 'treeSelect'"
      v-bind="columnItem.search.componentProps"
      :options="options"
      v-model:value="myValue"
      @change="onValueChange"
    />
    <DatePicker
      v-else-if="type === 'date'"
      v-model:value="myValue"
      v-bind="columnItem.search.componentProps"
      @change="onValueChange"
    />
    <component
      v-else-if="type === 'component'"
      :is="columnItem.search.components"
      v-model:value="myValue"
      v-bind="columnItem.search.componentProps"
      @change="onValueChange"
    />
    <a-input v-else v-model:value="myValue" style="width:100%" @change="onInputChange" />
    <div>
      <a-button @click="onSubmit">
        确定
      </a-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.filter-terms-value-item {
  padding: 6px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
</style>