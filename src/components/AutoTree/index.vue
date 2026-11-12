<template>
  <Tree ref="treeRef" v-bind="{ ...$attrs, ...props }" :height="treeHeight">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </Tree>
</template>

<script setup lang="ts">
import { Tree } from 'ant-design-vue'
import { useAutoTree } from './useAutoTree'

defineOptions({ name: 'AutoTree', inheritAttrs: false })

// 与当前 Ant Tree 共用属性定义和默认值，事件属性与 v-model 也直接传给原组件。
const props = defineProps(Tree.props)
const { treeRef, treeHeight, treeApi } = useAutoTree(() => props.height)

defineExpose(treeApi)
</script>
