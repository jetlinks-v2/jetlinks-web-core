<template>
  <section class="permission-pane">
    <header class="pane-header">
      <strong>{{ $t('components.MenuAssetPermissionEditor.menuPermission') }}</strong>
      <slot name="header-extra" />
    </header>
    <a-tabs v-if="groups.length > 1" v-model:activeKey="activeOwner" class="owner-tabs">
      <a-tab-pane v-for="group in groups" :key="group.key" :tab="ownerLabel(group)" />
    </a-tabs>
    <div class="table-holder">
      <a-table
        v-if="activeMenus.length"
        :columns="resolvedColumns"
        :data-source="activeMenus"
        :pagination="false"
        row-key="id"
        :scroll="{ y: 'calc(100% - 3rem)' }"
      >
        <template #headerCell="{ column }">
          <div v-if="column.key === 'menu'" class="header-cell">
            <a-checkbox
              :checked="selection.checked"
              :indeterminate="selection.indeterminate"
              :disabled="readonly"
              @change="context.setMenusChecked(activeMenus, $event.target.checked)"
            >{{ $t('components.MenuAssetPermissionEditor.menu') }}</a-checkbox>
          </div>
          <div v-else-if="column.key === 'action'" class="action-header">
            <span>{{ $t('components.MenuAssetPermissionEditor.operationPermission') }}</span>
<!--            <div class="action-batch-control">-->
<!--              <span>{{ $t('components.MenuAssetPermissionEditor.batchSetting') }}</span>-->
<!--              <a-select-->
<!--                mode="multiple"-->
<!--                allow-clear-->
<!--                :value="context.buttonBatchValues.value"-->
<!--                :options="activeActionOptions"-->
<!--                :max-tag-count="1"-->
<!--                :placeholder="$t('components.MenuAssetPermissionEditor.selectOperationPermission')"-->
<!--                @change="applyButtonBatch"-->
<!--              />-->
<!--            </div>-->
          </div>
          <span v-else>{{ column.title }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <a-checkbox
            v-if="column.key === 'menu'"
            :checked="record._granted"
            :indeterminate="record.indeterminate"
            :disabled="readonly || isProtectedMenu(record)"
            @change="toggleMenu(record, $event.target.checked)"
          >{{ record.i18nName || record.name || record.code || record.id }}</a-checkbox>
          <div v-else-if="column.key === 'action'" class="button-list">
            <a-checkbox
              v-for="button in record.buttons || []"
              :key="button.id"
              :checked="button.granted"
              :disabled="readonly || isProtectedButton(record, button)"
              @change="toggleButton(record, button, $event.target.checked)"
            >{{ button.i18nName || button.name || button.id }}</a-checkbox>
            <span v-if="!record.buttons?.length">--</span>
          </div>
          <slot v-else name="column" :column="column" :record="record" />
        </template>
      </a-table>
      <CloudEmpty v-else :description="$t('components.MenuAssetPermissionEditor.noMenus')" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type {
  MenuAssetPermissionEditorContext,
  MenuOwnerGroup,
  MenuPermissionButton,
  MenuPermissionNode,
} from '../../hooks/menuAssetPermissionEditor.types'

const props = withDefaults(defineProps<{
  context: MenuAssetPermissionEditorContext
  columns?: any[]
  ownerLabels?: Record<string, string>
  readonly?: boolean
}>(), {
  columns: () => [],
  ownerLabels: () => ({}),
  readonly: false,
})

const { t: $t } = useI18n()
const activeOwner = ref<string>()
const groups = computed(() => props.context.ownerGroups.value)
const activeGroup = computed(() => groups.value.find(group => group.key === activeOwner.value) || groups.value[0])
const activeMenus = computed(() => activeGroup.value?.menus || [])
const selection = computed(() => props.context.getSelectionState(activeMenus.value))
const activeActionOptions = computed(() => props.context.getActionOptions(activeMenus.value))
const resolvedColumns = computed(() => props.columns.length ? props.columns : [
  { title: $t('components.MenuAssetPermissionEditor.menu'), dataIndex: 'menu', key: 'menu', width: '40%' },
  { title: $t('components.MenuAssetPermissionEditor.operationPermission'), dataIndex: 'action', key: 'action' },
])

const ownerLabel = (group: MenuOwnerGroup) => props.ownerLabels[group.key] || group.label
const asMenu = (record: Record<string, any>) => record as MenuPermissionNode
const applyButtonBatch = (value: any) => props.context.applyButtonBatch(
  Array.isArray(value) ? value.map(String) : [],
  activeMenus.value,
)
const isProtectedMenu = (record: Record<string, any>) => props.context.isProtectedMenu(asMenu(record))
const isProtectedButton = (record: Record<string, any>, button: MenuPermissionButton) => props.context.isProtectedButton(asMenu(record), button)
const toggleMenu = (record: Record<string, any>, checked: boolean) => props.context.toggleMenu(asMenu(record), checked)
const toggleButton = (record: Record<string, any>, button: MenuPermissionButton, checked: boolean) => props.context.toggleButton(asMenu(record), button, checked)

watch(groups, value => {
  if (!value.some(group => group.key === activeOwner.value)) activeOwner.value = value[0]?.key
}, { immediate: true })
watch(activeOwner, () => { props.context.buttonBatchValues.value = [] })
</script>

<style scoped>
.permission-pane { height: 100%; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: var(--r-3); background: var(--bg); overflow: hidden; }
.pane-header { min-height: 3rem; padding: 0 var(--space-4); display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.owner-tabs { padding: 0 var(--space-3); flex-shrink: 0; }
.table-holder { flex: 1; min-height: 0; overflow: hidden; }
.table-holder :deep(.ant-table-wrapper), .table-holder :deep(.ant-spin-nested-loading), .table-holder :deep(.ant-spin-container) { height: 100%; min-height: 0; }
.table-holder :deep(.ant-spin-container), .table-holder :deep(.ant-table), .table-holder :deep(.ant-table-container) { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.table-holder :deep(.ant-table-header) { flex: none; }
.table-holder :deep(.ant-table-body) { flex: 1; min-height: 0; max-height: none !important; overflow-y: auto !important; }
.action-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }
.action-batch-control { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-2); min-width: 0; }
.action-batch-control :deep(.ant-select) { width: min(13rem, 65%); }
.button-list { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }
.button-list :deep(.ant-checkbox-wrapper) { margin-inline-start: 0; }
</style>
