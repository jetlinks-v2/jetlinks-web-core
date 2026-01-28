<script setup name="PropertyFilter">
import Item from './FilterItem.vue'
import ValueItem from './ValueItem.vue'
import { useEnginesContext, useSearchEngine } from './hooks/useSearchEngine'

const props = defineProps({
  target: {
    type: String,
    default: ''
  },
  columns: {
    type: Array,
    default: () => []
  },
  initParams: {
    type: Array,
    default: () => []
  }
})

const status = ref('column')
const open = ref(false)
const currentColumn = ref(undefined)
const emit = defineEmits(['search', 'update:params'])

const { formModel, columnsOptions, updateTermValue, submit, addValue, removeItem } = useSearchEngine(props)

useEnginesContext({
  updateTermValue,
  submit,
  removeItem
})

const onShow = () => {
  // 获取当前状态
  const lastItem = formModel.value[formModel.value.length - 1]

  if (lastItem && (lastItem.value === undefined || lastItem.value === null)) {
    status.value = 'value'
  } else {
    status.value = 'column'
  }

  open.value = true
}

const openChange = (status) => {
  open.value = status
}

const menuClick = (key) => {
  if (status.value === 'column') {
    addValue(key)
    currentColumn.value = key
    status.value = 'value'
  }
}

const onValueChange = (e) => {
  updateTermValue(e)
  open.value = false
  setTimeout(() => {
    status.value = 'column'
  }, 350         )
}

const onSearch = () => {
  const p = submit()
  emit('search', p)
  emit('update:params', p)
}

onMounted(() => {
  formModel.value = props.initParams || []
})

defineExpose({
  setValues: (v) => {
    formModel.value = v || []
  }
})
</script>

<template>
  <div class="property-filter" style="width: 100%;padding: 24px;background: #fff; margin-bottom: 24px">
    <a-input
      placeholder="请输入搜索内容"
      allowClear
      style="width: 100%"
      @click="onShow"
    >
      <template #prefix>
        <Item
          v-for="(termItem, index) in formModel"
          v-bind="termItem"
          :key="termItem.key"
          :index="index"
          @select="submit"
        />
        <a-dropdown :open="open" trigger="click" @openChange="openChange">
          <div>
            <a-tag v-if="status === 'column'" color="processing">
              <AIcon type="PlusOutlined" />
            </a-tag>
          </div>

          <template #overlay>
            <a-menu v-if="status === 'column'">
              <a-menu-item
                v-for="column in columnsOptions"
                :key="column.value"
                @click.stop="() => menuClick(column.value)"
              >
                {{ column.label }}
              </a-menu-item>
            </a-menu>
            <ValueItem :column="currentColumn" v-else @change="onValueChange"/>
          </template>
        </a-dropdown>
      </template>
      <template #addonAfter>
        <AIcon type="SearchOutlined" @click="onSearch" />
      </template>
    </a-input>
  </div>
</template>

<style scoped lang="less">

</style>