<script setup name="FilterItem">
import Column from './Column.vue';
import TermType from './TermType.vue';
import Value from './Value.vue';
import { useEngines } from './hooks/useSearchEngine'

const props = defineProps({
  column: {
    type: String,
    default: undefined,
  },
  type: {
    type: String,
    default: undefined,
  },
  termType: {
    type: String,
    default: undefined,
  },
  value: {
    type: String,
    default: undefined,
  },
  index: {
    type: Number,
    default: 0,
  }
})

const typeOptions = [
  { label: '并且', value: 'and'},
  { label: '或者', value: 'or'}
]

const { updateTermValue, removeItem } = useEngines()
const typeOptionsMap = ref({})

const onTypeChange = ({ key }) => {
  updateTermValue(key, props.index, 'type')
}

const onTermTypeChange = (value) => {
  updateTermValue(value, props.index, 'termType')
}

const onValueChange = (value) => {
  updateTermValue(value, props.index, 'value')
}

const onCloseTermItem = () => {
  removeItem(props.index)
}

const init = () => {
  typeOptions.forEach((item) => {
    typeOptionsMap.value[item.value] = item.label
  })
}

init()

</script>

<template>
  <div style="display: flex; align-items: center; gap: 2px;margin-right: 4px">
    <a-dropdown trigger="click">
      <a-tag v-if="type && index !== 0" color="processing" style="margin: 0">
        {{ typeOptionsMap[type] }}
      </a-tag>
      <template #overlay>
        <a-menu style="width: 120px" @click="onTypeChange">
          <a-menu-item v-for="option in typeOptions" :key="option.value">
            {{ option.label }}
          </a-menu-item>
        </a-menu>

      </template>
    </a-dropdown>
    <Column :value="column" />
    <TermType :column="column" :value="termType" @change="onTermTypeChange"/>
    <Value v-if="!!value" :column="column" :termType="termType" :value="value" @change="onValueChange" @close="onCloseTermItem" />
  </div>
</template>

<style scoped lang="less">

</style>