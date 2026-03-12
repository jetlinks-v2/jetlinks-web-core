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
  const lastItem = formModel.value[formModel.value.length - 1]

  if (lastItem && (lastItem.value === undefined || lastItem.value === null)) {
    status.value = 'value'
  } else {
    status.value = 'column'
  }

  open.value = true
}

const onBlankAreaClick = (e) => {
  const target = e.target
  const currentTarget = e.currentTarget

  if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement)) {
    return
  }

  const isBlankArea = target === currentTarget
  const isPlaceholder = target.classList.contains('property-filter-placeholder')

  if (!isBlankArea && !isPlaceholder) {
    return
  }

  onShow()
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
  }, 350)
}

const cloneTermValue = (value) => {
  return Array.isArray(value) ? [...value] : value
}

const getUIParams = () => {
  return formModel.value.map((item) => ({
    ...item,
    value: cloneTermValue(item.value)
  }))
}

const onSearch = () => {
  const uiParams = getUIParams()
  const searchParams = submit()
  emit('search', searchParams)
  emit('update:params', uiParams)
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
    <div class="property-filter-input" :class="{ 'is-active': open }">
      <div class="property-filter-content">
        <div class="property-filter-prefix" @click="onBlankAreaClick">
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
          <span v-if="!formModel.length" class="property-filter-placeholder">请输入搜索内容</span>
        </div>
      </div>
      <div class="property-filter-action" @click.stop="onSearch">
        <AIcon type="SearchOutlined" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.property-filter {
  .property-filter-input {
    width: 100%;
    min-height: 32px;
    border: 1px solid #d9d9d9;
    border-radius: 2px;
    display: flex;
    align-items: stretch;
    background: #fff;
    transition: all 0.2s;
    cursor: text;

    &:hover {
      border-color: #4096ff;
    }

    &.is-active {
      border-color: #4096ff;
      box-shadow: 0 0 0 2px rgba(5, 145, 255, 0.1);
    }
  }

  .property-filter-content {
    flex: 1;
    min-width: 0;
    min-height: 30px;
    padding: 2px 6px;
    display: flex;
    align-items: center;
  }

  .property-filter-prefix {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }

  .property-filter-placeholder {
    color: rgba(0, 0, 0, 0.25);
    font-size: 14px;
    line-height: 22px;
    white-space: nowrap;
  }

  .property-filter-action {
    width: 36px;
    background: #fafafa;
    border-left: 1px solid #d9d9d9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.45);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: #1677ff;
      background: #f0f0f0;
    }
  }
}
</style>
