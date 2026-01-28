<script setup name="FilterValue">
import { buildIdToTitle } from './utils'
import { useColumnItemOptions, useColumnsMap } from './hooks/useSearchEngine'
import ValueItem from './ValueItem.vue'

const props = defineProps({
  column: {
    type: String,
    default: undefined,
  },
  value: {
    type: String,
    default: undefined,
  },
  termType: {
    type: String,
    default: undefined,
  }
})

const emit = defineEmits(['close', 'change'])

const optionsContent = useColumnItemOptions()
const columnsMap = useColumnsMap()
const optionsTitleMap = shallowRef(new Map())
const currentValue = ref('')
const open = ref(false)

const _column = computed(() => {
  if (!props.column) {
    return null
  }
  return columnsMap[props.column]
})

const options = computed(() => {
  if (!props.column) {
    return []
  }
  const data = optionsContent[props.column] || []
  const optionsData = ['tree', 'treeSelect'].includes(_column.value.search?.type) ? data : data.map(item => ({ ...item,name: item.label, id: item.value}))
  optionsTitleMap.value = buildIdToTitle(optionsData)

  return optionsData
})

const onChange = (v) => {
  open.value = false
  emit('change', v)
}

const onClose = () => {
  emit('close')
}

const openChange = (status) => {
  open.value = status
}

watch([() => props.value, options], ([newValue]) => {
  if(!newValue){
    return
  }
  currentValue.value = optionsTitleMap.value.get(newValue) || newValue

}, { immediate: true})

</script>

<template>
  <a-dropdown :open="open" trigger="click" @openChange="openChange">
    <a-tag color="processing" style="margin: 0" >
      <a-space>
        {{ currentValue }}
        <AIcon type="CloseOutlined" style="font-size: 12px" @click="onClose"/>
      </a-space>
    </a-tag>
    <template #overlay>
      <ValueItem :column="column" :value="value" @change="onChange" />
    </template>
  </a-dropdown>
</template>

<style scoped lang="less">

</style>