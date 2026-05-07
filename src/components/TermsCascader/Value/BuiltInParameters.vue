<script setup lang="ts">
import { ref, computed } from 'vue'

// 参数节点接口定义
interface ParameterNode {
  id: string
  name: string
  fullName: string
  column: string
  description?: string
  type: string
  children?: ParameterNode[]
  termTypes?: Array<{ id: string; name: string }>
  metadata?: boolean
  options?: Record<string, any>
}

// 组件 props
const props = defineProps<{
  data?: ParameterNode[]
  modelValue?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'select', node: ParameterNode): void
}>()

// 树形数据转换
interface TreeNode {
  key: string
  title: string
  children?: TreeNode[]
  isLeaf?: boolean
  raw: ParameterNode
}

// 选中的节点
const selectedKeys = ref<string[]>([])
// 展开的节点
const expandedKeys = ref<string[]>([])

// 节点选择事件
const onSelect = (keys: string[], info: any) => {
  selectedKeys.value = keys
  if (info.node) {
    const node = info.node.raw as ParameterNode
    emit('update:modelValue', node.column)
    emit('select', node)
  }
}

// 节点展开事件
const onExpand = (keys: string[]) => {
  expandedKeys.value = keys
}

</script>

<template>
  <div class="built-in-parameters">
    <a-tree
      v-if="data.length > 0"
      :tree-data="data"
      :selected-keys="selectedKeys"
      :expanded-keys="expandedKeys"
      :field-names="{ key: 'id', title: 'name', children: 'children' }"
      :height="360"
      @select="onSelect"
      @expand="onExpand"
    >
      <template #title="{ name, fullName }">
        <div class="tree-node-title">
          <span class="node-name">{{ name }}</span>
          <span v-if="fullName" class="node-desc">{{ fullName }}</span>
        </div>
      </template>
    </a-tree>
    <j-empty v-else/>
  </div>
</template>

<style scoped>
.built-in-parameters {
  min-width: 420px;
  max-width: 90vw;
  background: #fff;
  border-radius: 4px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-nav {
  margin-bottom: 12px;
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-nav .ant-tabs-tab {
  padding: 8px 16px;
  font-size: 14px;
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
  color: #1890ff;
  font-weight: 500;
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-content-holder {
  overflow: hidden;
}
.built-in-parameters .manual-input {
  padding: 8px 0;
}
.built-in-parameters .manual-input :deep(.ant-input) {
  border-radius: 4px;
}
.built-in-parameters .manual-input :deep(.ant-input):focus,
.built-in-parameters .manual-input :deep(.ant-input):hover {
  border-color: #1890ff;
}
.built-in-parameters .parameter-tree {
  min-height: 200px;
  max-height: 400px;
  overflow: hidden;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) {
  background: transparent;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-treenode {
  padding: 2px 0;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-treenode:hover .ant-tree-node-content-wrapper {
  background-color: rgba(0, 164, 254, 0.08);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper {
  border-radius: 4px;
  transition: all 0.2s;
  padding: 4px 8px;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper:hover {
  background-color: rgba(0, 164, 254, 0.1);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper.ant-tree-node-selected {
  background-color: rgba(0, 164, 254, 0.2);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper.ant-tree-node-selected .tree-node-title .node-name {
  color: #1890ff;
  font-weight: 500;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .tree-node-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .tree-node-title .node-name {
  font-size: 14px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.85);
  line-height: 1.5;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .tree-node-title .node-desc {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.4;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-indent-unit {
  width: 20px;
}
.built-in-parameters .parameter-tree :deep(.ant-empty) {
  padding: 40px 0;
}
.built-in-parameters .parameter-tree :deep(.ant-empty) .ant-empty-description {
  color: rgba(0, 0, 0, 0.45);
}
</style>
