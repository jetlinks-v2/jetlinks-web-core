<template>
  <div v-bind="{ class: attrs.class, style: attrs.style }" class="navigation-tree" :style="viewportStyle" @dragstart.capture="onDragStartCapture" @dragend.capture="dragging = false">
    <Input v-if="searchable" v-model:value="searchValue" allow-clear class="navigation-tree__search" :placeholder="searchPlaceholder || t('NavigationTree.search')" :aria-label="searchLabel || t('NavigationTree.searchLabel')" @keydown="onSearchKeydown">
      <template #prefix><SearchOutlined aria-hidden="true" /></template>
    </Input>
    <ContextMenu :enabled="Boolean($slots['root-menu'])">
      <div class="navigation-tree__viewport">
        <Tree v-bind="treeBindings()" ref="treeRef" @expand="onExpand" @drop="onDrop" @dragenter="onDragEnter" @dragstart="onDragStart">
          <template v-for="name in forwardedSlotNames()" #[name]="slotProps"><slot :name="name" v-bind="slotProps || {}" /></template>
          <template #title="node">
            <ContextMenu :enabled="Boolean($slots['node-menu'])">
              <span class="navigation-tree__row" :data-node-draggable="nodeDraggable?.(node)" @contextmenu="onNodeContextMenu">
                <span class="navigation-tree__main">
                  <NavigationTreeLabel :suppressed="dragging || openMenus.size > 0"><TitleContent :node="node" /></NavigationTreeLabel>
                  <span v-if="$slots['node-meta']" class="navigation-tree__meta" @click.stop @keydown="onSuffixKeydown"><slot name="node-meta" v-bind="node" /></span>
                </span>
                <span v-if="$slots['node-suffix']" class="navigation-tree__suffix" @click.stop @keydown="onSuffixKeydown"><slot name="node-suffix" v-bind="node" /></span>
              </span>
              <template #overlay><slot name="node-menu" v-bind="node" /></template>
            </ContextMenu>
          </template>
        </Tree>
        <div v-if="!treeData?.length || (searching && !filtered.matched)" class="navigation-tree__empty">
          <slot name="empty"><Empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t(searching ? 'NavigationTree.noMatches' : 'NavigationTree.empty')" /></slot>
        </div>
      </div>
      <template #overlay><slot name="root-menu" /></template>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, reactive, ref, useAttrs, useSlots } from 'vue'
import { Dropdown, Empty, Input, Tree } from 'ant-design-vue'
import type { TreeProps } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { omit } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { navigationTreeProps } from './props'
import { useNavigationTree } from './useNavigationTree'
import NavigationTreeLabel from './NavigationTreeLabel.vue'
import type { NavigationTreeExpandInfo, NavigationTreeKey, NavigationTreeNode } from './types'

defineOptions({ name: 'NavigationTree', inheritAttrs: false })
const props = defineProps(navigationTreeProps)
const emit = defineEmits<{
  (event: 'update:searchValue', value: string): void
  (event: 'update:expandedKeys', keys: NavigationTreeKey[]): void
  (event: 'expand', keys: NavigationTreeKey[], info: NavigationTreeExpandInfo): void
}>()
const { t } = useI18n()
const attrs = useAttrs(), slots = useSlots()
const treeRef = ref<InstanceType<typeof Tree>>()
const dragging = ref(false)
const openMenus = reactive(new Set<symbol>())
const { model, filtered, expandedKeys, setExpandedKeys, searchValue, searching, onSearchKeydown } =
  useNavigationTree(props, keys => emit('update:expandedKeys', keys), value => emit('update:searchValue', value))

// 原生 Dropdown 负责定位和关闭，缺少菜单时不增加 DOM 或接管右键。
const ContextMenu = defineComponent({
  props: { enabled: Boolean },
  setup(props, { slots }) {
    const token = Symbol()
    onBeforeUnmount(() => openMenus.delete(token))
    return () => props.enabled
      ? h(Dropdown, { trigger: ['contextmenu'], onOpenChange: (open: boolean) => { if (open) openMenus.add(token); else openMenus.delete(token) } }, { default: slots.default, overlay: slots.overlay })
      : slots.default?.()
  },
})
const treeBindings = () => ({
  ...omit(attrs, ['class', 'style']),
  ...omit(props, ['height', 'treeData', 'expandedKeys', 'onExpand', 'onDrop', 'onDragenter', 'onDragstart', 'onUpdate:expandedKeys', 'defaultExpandDepth', 'searchable', 'nodeDraggable', 'searchNodeKey', 'searchValue', 'searchLabel', 'searchPlaceholder', 'getSearchText', 'class', 'style']),
  prefixCls: 'navigation-tree-native',
  treeData: filtered.value.nodes,
  expandedKeys: expandedKeys.value,
  virtual: false,
  blockNode: true,
  showLine: props.showLine ?? { showLeafIcon: false },
  autoExpandParent: searching.value,
  draggable: !searching.value && !props.disabled ? props.draggable : false,
})
const viewportStyle = computed(() => props.height == null ? {} : { height: `${props.height}px`, flex: 'none' })
const TitleContent = ({ node }: { node: NavigationTreeNode }) => {
  const title = model.value.title(node)
  return slots.title?.(node) ?? slots.titleRender?.(node) ?? (typeof title === 'function' ? title(node) : title)
}
function onExpand(keys: NavigationTreeKey[], info: NavigationTreeExpandInfo) {
  if (searching.value) return
  setExpandedKeys(keys)
  emit('expand', keys, info)
}
function onDrop(info: Parameters<NonNullable<TreeProps['onDrop']>>[0]) {
  dragging.value = false
  if (!searching.value && !props.disabled) props.onDrop?.(info)
}
function dragRow(event: DragEvent) {
  return event.target instanceof Element ? event.target.closest('.navigation-tree-native-treenode')?.querySelector<HTMLElement>('.navigation-tree__row') : undefined
}
function onDragStartCapture(event: DragEvent) {
  if (dragRow(event)?.dataset.nodeDraggable === 'false') { event.preventDefault(); event.stopPropagation() }
}
function onDragStart(info: Parameters<NonNullable<TreeProps['onDragstart']>>[0]) {
  props.onDragstart?.(info)
  if (info.event.defaultPrevented) return
  dragging.value = true
  const row = dragRow(info.event)
  if (row && info.event.dataTransfer) {
    const bounds = row.getBoundingClientRect()
    // 排除祖先缩进和原生整行描边，拖影只呈现节点内容。
    info.event.dataTransfer.setDragImage(row, Math.max(0, Math.min(bounds.width, info.event.clientX - bounds.left)), Math.max(0, Math.min(bounds.height, info.event.clientY - bounds.top)))
  }
}
function onDragEnter(info: Parameters<NonNullable<TreeProps['onDragenter']>>[0]) {
  if (searching.value || props.disabled) return
  setExpandedKeys(info.expandedKeys)
  props.onDragenter?.(info)
}
function onNodeContextMenu(event: MouseEvent) { if (slots['node-menu']) event.stopPropagation() }
function onSuffixKeydown(event: KeyboardEvent) { if (event.key !== 'Escape') event.stopPropagation() }
function forwardedSlotNames() { return Object.keys(slots).filter(name => !['title', 'titleRender', 'node-meta', 'node-suffix', 'node-menu', 'root-menu', 'empty'].includes(name)) }
defineExpose({ treeRef })
</script>

<style scoped>
.navigation-tree { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; min-height: 0; flex: 1; overflow: hidden; }
.navigation-tree__search { flex: none; }
.navigation-tree__viewport { position: relative; flex: 1; min-width: 0; min-height: 0; overflow: auto; }
.navigation-tree :deep(.navigation-tree-native), .navigation-tree :deep(.navigation-tree-native-list-holder-inner) { width: 100%; }
.navigation-tree :deep(.navigation-tree-native-node-content-wrapper) { min-width: 6rem; }
.navigation-tree :deep(.navigation-tree-native-treenode.dragging::after) { display: none; }
.navigation-tree :deep(.navigation-tree-native-title) { display: block; width: 100%; min-width: 0; }
.navigation-tree__row { display: flex; align-items: center; gap: var(--space-1); min-width: 0; white-space: nowrap; }
.navigation-tree__main { display: flex; align-items: center; gap: var(--space-1); flex: 1; min-width: 0; }
.navigation-tree__meta, .navigation-tree__suffix { display: inline-flex; align-items: center; gap: var(--space-1); flex-shrink: 0; }
.navigation-tree__empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
@media (pointer: coarse) { .navigation-tree__search :deep(input) { font-size: 16px; } }
</style>
