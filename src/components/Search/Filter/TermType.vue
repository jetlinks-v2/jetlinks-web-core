<script setup name="TermType">
import { TermTypeOptions } from './setting'
import { useColumnsMap, useEngines } from './hooks/useSearchEngine'

const props = defineProps({
  column: {
    type: String,
    default: undefined,
  },
  value: {
    type: String,
    default: undefined,
  }
})

const emit = defineEmits(['change'])
const optionsMap = ref({})

const onClick = ({ key }) => {
  emit('change', key)
}

const columnsMap = useColumnsMap()

const getOptionsByType = (type, filterKeys) => {
  let keys = ['like', 'nlike', 'eq', 'not']

  switch (type) {
    case 'select':
    case 'treeSelect':
      keys = ['not', 'eq', 'in', 'nin'];
      break;
    case 'time':
    case 'date':
      keys = ['gt', 'lt', 'gte', 'lte', 'btw'];
      break;
    case 'timeRange':
    case 'rangePicker':
      keys = ['btw', 'nbtw'];
      break;
    case 'number':
      keys = ['eq', 'not', 'gt', 'lt', 'gte', 'lte'];
      break;
  }

  keys = keys.filter(key => !filterKeys.includes(key))

  return TermTypeOptions.filter(item => keys.includes(item.value))
}

const options = computed(() => {
  const item = columnsMap[props.column]
  const search = item.search

  if (search.termOptions) {
    return search.termOptions
  }

  const filterKeys = search.termFilter || []

  return getOptionsByType(search.type, filterKeys)
})

const init = () => {
  TermTypeOptions.forEach((item) => {
    optionsMap.value[item.value] = item.label
  })
}

init()

</script>

<template>
  <a-dropdown trigger="click">
    <a-tag color="processing" style="margin: 0">
      {{ optionsMap[value] }}
    </a-tag>
    <template #overlay>
      <a-menu style="width: 120px" @click="onClick">
        <a-menu-item v-for="option in options" :key="option.value">
          {{ option.label }}
        </a-menu-item>
      </a-menu>

    </template>
  </a-dropdown>
</template>

<style scoped lang="less">

</style>