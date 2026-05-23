<script setup name="ColumnSelect">
import { useTermsEvent, useTermsParse, useTermsValue } from './hooks'
import { computed } from 'vue'
import { initValueByTermType } from './utils'

const props = defineProps({
  options: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  valueOptions: {
    type: Array,
    default: () => [],
  },
  fieldNames: {
    type: Object,
    default: () => ({ column: 'column' }),
  }
})

const defaultFieldNames = { title: 'name', key: 'column', children: 'children' };

const termsValue = useTermsValue()
const termsParse = useTermsParse()
const events = useTermsEvent()
const open = ref(false)
const oleValueCache = ref()
const expendsKeys = ref([])

const getColumnDetail = (code) => {
  const map = unref(termsParse.map)
  const item = map.get(code)
  expendsKeys.value = item?.__sourcePath__ || []
  return item
}

// 计算当前选中的显示文本
const selectedLabel = computed(() => {
  const column = unref(termsValue).column
  return getColumnDetail(column)?.fullName || '请选择参数'
})

// 查找当前选中项的完整路径
const getSelectedKeys = computed({
  get() {
    const column = unref(termsValue).column
    return column ? [column] : []
  },
  set(selectedKeys) {
    unref(termsValue).column = selectedKeys?.[0] || undefined
  }
})

const setColumnData = (keys) => {
  open.value = false
  getSelectedKeys.value = keys
  events.onChange?.()
}

// 处理选择
const handleSelectResult = (keys, oldKey) => {
  const key = keys[0]
  const columnItem = getColumnDetail(key)
  const oldColumnItem = getColumnDetail(oldKey)
  const isDataTypeChange = columnItem.dataType !== oldColumnItem?.dataType

  // 如果column数据类型发生变化，修改termType和value值
  if (isDataTypeChange) {
    const value = {}
    const termsType = columnItem.termTypes[0]?.id || 'eq'
    termsValue.value.termType = termsType
    if (columnItem.dataType === 'array') {
      value.value = {}
    } else {
      value.value = initValueByTermType(termsType)
    }
    value.source = props.valueOptions[0]?.value || 'fixed'
    events.updateValue(value.value)
  }
}

const handleSelect = ( keys ) => {
  handleSelectResult(keys, oleValueCache.value)
  setColumnData(keys)
}

const visibleChange = (v) => {
  open.value = v;
};

const showOpen = () => {
  if (!props.disabled) {
    open.value = true
  }
}

watch(() => termsValue.value.column, (newValue, oldValue) => {
    oleValueCache.value = oldValue
    if (newValue) {
      handleSelectResult([newValue], oldValue)
    }
})

</script>

<template>
<a-dropdown :trigger="['click']" :open="open" @openChange="visibleChange">
  <div class="column-select-popup border-box" @click="showOpen">
    <span>{{ selectedLabel }}</span>
  </div>

  <template #overlay>
    <div class="column-tree-dropdown">
      <a-tree
        v-if="props.options.length"
        :selectedKeys="getSelectedKeys"
        :treeData="options"
        :height="360"
        :field-names="{...defaultFieldNames, key: props.column}"
        v-model:expandedKeys="expendsKeys"
        tree-default-expand-all
        @select="handleSelect"
      >
        <template #title="{ name, description, fullName }">
          <a-space>
            {{ name || fullName }}
            <span v-if="description" style="color: grey">
              {{description }}
            </span>
          </a-space>
        </template>
      </a-tree>
      <CloudEmpty v-else />
    </div>
  </template>
</a-dropdown>
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
}
.column-select-popup {
  max-width: 13.75rem;
  height: 2rem;
  padding: 0.25rem 0.6875rem;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--info);
  background-color: color-mix(in srgb, var(--accent) 30%, transparent);
  display: flex;
  align-items: center;
  cursor: pointer;
}
.column-select-popup:hover {
  border-color: color-mix(in srgb, var(--accent) 50%, transparent);
  background-color: color-mix(in srgb, var(--accent) 40%, transparent);
}
.column-select-popup:focus {
  border-color: var(--info);
  outline: none;
}
.column-select-popup span {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.column-tree-dropdown {
  padding: var(--space-2);
  border-radius: var(--r-3);
  box-shadow: var(--shadow-1);
  background-color: var(--bg);
  min-width: 25rem;
}
.column-tree-dropdown :deep(.ant-tree) .ant-tree-node-content-wrapper {
  border-radius: var(--r-1);
}
.column-tree-dropdown :deep(.ant-tree) .ant-tree-node-content-wrapper:hover {
  background-color: color-mix(in srgb, var(--accent) 20%, transparent);
}
.column-tree-dropdown :deep(.ant-tree) .ant-tree-node-selected .ant-tree-node-content-wrapper {
  background-color: color-mix(in srgb, var(--accent) 30%, transparent);
}</style>
