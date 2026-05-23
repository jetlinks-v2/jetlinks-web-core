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
    <CloudEmpty v-else/>
  </div>
</template>

<style scoped>
.built-in-parameters {
  min-width: 26.25rem;
  max-width: 90vw;
  background: var(--bg);
  border-radius: var(--r-1);
  padding: var(--space-3);
  box-shadow: var(--shadow-1);
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-nav {
  margin-bottom: var(--space-3);
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-nav .ant-tabs-tab {
  padding: 0.5rem 1rem;
  font-size: var(--fs-14);
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-nav .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
  color: var(--accent);
  font-weight: 500;
}
.built-in-parameters :deep(.ant-tabs) .ant-tabs-content-holder {
  overflow: hidden;
}
.built-in-parameters .manual-input {
  padding: 0.5rem 0;
}
.built-in-parameters .manual-input :deep(.ant-input) {
  border-radius: var(--r-1);
}
.built-in-parameters .manual-input :deep(.ant-input):focus,
.built-in-parameters .manual-input :deep(.ant-input):hover {
  border-color: var(--accent);
}
.built-in-parameters .parameter-tree {
  min-height: 12.5rem;
  max-height: 25rem;
  overflow: hidden;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) {
  background: transparent;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-treenode {
  padding: 0.125rem 0;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-treenode:hover .ant-tree-node-content-wrapper {
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper {
  border-radius: var(--r-1);
  transition: all 0.2s;
  padding: var(--space-1) var(--space-2);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper:hover {
  background-color: color-mix(in srgb, var(--accent) 10%, transparent);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper.ant-tree-node-selected {
  background-color: color-mix(in srgb, var(--accent) 20%, transparent);
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-node-content-wrapper.ant-tree-node-selected .tree-node-title .node-name {
  color: var(--accent);
  font-weight: 500;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .tree-node-title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  width: 100%;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .tree-node-title .node-name {
  font-size: var(--fs-14);
  font-weight: 400;
  color: var(--ink-1);
  line-height: 1.5;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .tree-node-title .node-desc {
  font-size: var(--fs-12);
  color: var(--ink-4);
  line-height: 1.4;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
}
.built-in-parameters .parameter-tree :deep(.ant-tree) .ant-tree-indent-unit {
  width: 1.25rem;
}
.built-in-parameters .parameter-tree :deep(.ant-empty) {
  padding: 2.5rem 0;
}
.built-in-parameters .parameter-tree :deep(.ant-empty) .ant-empty-description {
  color: var(--ink-4);
}</style>
