<template>
  <div class="menu-asset-permission-editor" :style="{ height: resolvedHeight }">
    <EqualHeightColumns v-if="showAssetPermissions" height="100%" :left-width="leftWidth" :right-width="rightWidth">
      <template #left>
        <MenuPermissionPane :context="context" :columns="columns" :owner-labels="ownerLabels" :readonly="readonly">
          <template #header-extra><slot name="menu-header-extra" :context="context" /></template>
          <template #column="slotProps"><slot name="column" v-bind="slotProps" /></template>
        </MenuPermissionPane>
      </template>
      <template #right>
        <AssetPermissionPane :context="context" :readonly="readonly" :show-batch="showAssetBatch">
          <template #header-extra><slot name="asset-header-extra" :context="context" /></template>
          <template v-if="$slots['asset-title-extra']" #asset-title-extra="slotProps">
            <slot name="asset-title-extra" v-bind="slotProps" />
          </template>
          <template v-if="$slots['asset-control']" #asset-control="slotProps">
            <slot name="asset-control" v-bind="slotProps" />
          </template>
        </AssetPermissionPane>
      </template>
    </EqualHeightColumns>
    <MenuPermissionPane v-else :context="context" :columns="columns" :owner-labels="ownerLabels" :readonly="readonly">
      <template #header-extra><slot name="menu-header-extra" :context="context" /></template>
      <template #column="slotProps"><slot name="column" v-bind="slotProps" /></template>
    </MenuPermissionPane>
  </div>
</template>

<script setup lang="ts" name="MenuAssetPermissionEditor">
import EqualHeightColumns from '../EqualHeightColumns/index.vue'
import AssetPermissionPane from './AssetPermissionPane.vue'
import MenuPermissionPane from './MenuPermissionPane.vue'
import type { MenuAssetPermissionEditorContext } from '../../hooks/menuAssetPermissionEditor.types'

const props = withDefaults(defineProps<{
  context: MenuAssetPermissionEditorContext
  showAssetPermissions?: boolean
  height?: string | number
  leftWidth?: string | number
  rightWidth?: string | number
  columns?: any[]
  ownerLabels?: Record<string, string>
  /** 只禁用编辑动作，保留菜单和资产权限完整回显。 */
  readonly?: boolean
  /** 自定义资产控制区时可关闭默认 supportId 批量设置。 */
  showAssetBatch?: boolean
}>(), {
  showAssetPermissions: true,
  height: 'min(68vh, 720px)',
  leftWidth: '3fr',
  rightWidth: '2fr',
  columns: () => [],
  ownerLabels: () => ({}),
  readonly: false,
  showAssetBatch: true,
})

const resolvedHeight = computed(() => typeof props.height === 'number' ? `${props.height}px` : props.height)
</script>

<style scoped>
.menu-asset-permission-editor {
  min-height: 24rem;
  overflow: hidden;
}
</style>
