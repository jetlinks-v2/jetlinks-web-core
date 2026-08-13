<template>
  <section class="permission-pane">
    <header class="pane-header">
      <strong>{{ $t('components.MenuAssetPermissionEditor.dataPermission') }}</strong>
      <div v-if="showBatch || $slots['header-extra']" class="batch-control">
        <slot name="header-extra" />
        <template v-if="showBatch">
          <span>{{ $t('components.MenuAssetPermissionEditor.batchSetting') }}</span>
          <a-select
            allow-clear
            :value="context.batchAssetValue.value"
            :options="context.batchAssetOptions.value"
            :disabled="readonly || !context.batchAssetOptions.value.length"
            :placeholder="$t('components.MenuAssetPermissionEditor.selectPermission')"
            @change="applyBatch"
          />
        </template>
      </div>
    </header>
    <div v-if="context.visibleAssets.value.length" class="asset-list">
      <div v-for="asset in context.visibleAssets.value" :key="asset.assetType" class="asset-row">
        <div class="asset-title">
          <div class="asset-name">{{ asset.name || asset.assetType }}</div>
          <slot name="asset-title-extra" :asset="asset" :context="context" />
        </div>
        <slot name="asset-control" :asset="asset" :context="context">
          <a-radio-group
            :value="asset.selectedSupportId"
            :disabled="readonly"
            @update:value="context.setAssetAccess(asset.assetType, $event)"
          >
            <a-radio
              v-for="access in asset.accesses"
              :key="access.supportId"
              :value="access.supportId"
              :disabled="readonly || access.disabled"
            >{{ access.i18nName || access.name || access.supportId }}</a-radio>
          </a-radio-group>
          <span v-if="!asset.accesses.length">--</span>
        </slot>
      </div>
    </div>
    <CloudEmpty v-else class="empty" :description="$t('components.MenuAssetPermissionEditor.noAssets')" />
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { MenuAssetPermissionEditorContext } from '../../hooks/menuAssetPermissionEditor.types'

const { t: $t } = useI18n()
const props = withDefaults(defineProps<{
  context: MenuAssetPermissionEditorContext
  readonly?: boolean
  showBatch?: boolean
}>(), {
  readonly: false,
  showBatch: true,
})
const applyBatch = (value: any) => props.context.applyAssetBatch(value == null ? undefined : String(value))
</script>

<style scoped>
.permission-pane { height: 100%; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r-3); background: var(--bg); overflow: hidden; }
.pane-header { min-height: 3rem; padding: 0 var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); border-bottom: 1px solid var(--line); }
.batch-control { display: flex; align-items: center; gap: var(--space-2); }
.batch-control :deep(.ant-select) { width: 10rem; }
.asset-list { flex: 1; min-height: 0; overflow-y: auto; padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3); }
.asset-row { padding: var(--space-3); border: 1px solid var(--line); border-radius: var(--r-3); background: var(--bg-sunken); }
.asset-title { margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.asset-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-1); font-weight: 600; }
.asset-row :deep(.ant-radio-group) { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }
.asset-row :deep(.ant-radio-wrapper) { margin-inline-end: 0; }
.empty { flex: 1; }
</style>
