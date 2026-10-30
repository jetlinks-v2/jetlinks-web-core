<template>
  <div class="permission-choose-container" :class="{ 'permission-choose-container--list': presentation === 'list' }">
    <DefineActions v-slot="{ record }">
      <a-space wrap :size="[4, 4]">
        <a-tag v-for="item in record.checkedOptions" :key="item.value" class="permission-operation">{{ item.label }}</a-tag>
      </a-space>
    </DefineActions>
    <a-radio-group v-if="permissionMode && !disabled" :value="permissionMode" class="permission-modes" @change="selectMode($event.target.value)">
      <a-radio-button v-for="option in modeOptions" :key="option.value" :value="option.value" :disabled="option.disabled">
        <span class="permission-mode-label">{{ option.label }}</span>
        <span class="permission-mode-description">{{ option.description }}</span>
      </a-radio-button>
    </a-radio-group>
    <p v-if="custom && initialized && !selectedCount" class="permission-selection-hint">{{ $t('PersonalToken.permissionMode.selectActions') }}</p>
    <p v-if="!showPermissionRows && initialized" class="permission-count">{{ $t('PersonalToken.permissions.scopeCount', { count: selectedCount }) }}</p>
    <div v-if="showPermissionRows" class="permission-toolbar">
      <a-input-search
        v-model:value="searchKeyword" allow-clear :disabled="loading || busy"
        :placeholder="$t('PersonalToken.permissions.search')" @search="onSearch"
      />
      <span v-if="initialized" class="permission-count">{{ $t(disabled ? 'PersonalToken.permissions.authorizedCount' : 'PersonalToken.permissions.scopeCount', { count: selectedCount }) }}</span>
    </div>
    <a-alert v-if="loadError" type="error" show-icon :message="$t('PersonalToken.PermissionList.loadFailed')">
      <template #action><a-button type="link" :disabled="loading || busy" @click="onSearch(searchKeyword)">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <div v-if="showPermissionRows && presentation === 'list'" class="permission-detail-scroll">
      <a-spin v-if="loading && !displayRows.length" />
      <a-list v-else-if="displayRows.length" :data-source="displayRows" :loading="loading" class="permission-detail-list">
        <template #renderItem="{ item }">
          <a-list-item class="permission-detail-row">
            <span class="permission-name">{{ item.name }}</span>
            <PermissionActions :record="item" />
          </a-list-item>
        </template>
      </a-list>
      <CloudEmpty v-else-if="!loadError" />
    </div>
    <a-table v-else-if="showPermissionRows" :columns="columns" :data-source="displayRows" :pagination="false" :loading="loading" size="small" row-key="id" table-layout="fixed" :scroll="{ y: 'min(12rem, 28vh)' }">
      <template #emptyText><CloudEmpty /></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <a-checkbox
            v-if="custom"
            :checked="record.checkAll" :indeterminate="record.indeterminate" :disabled="controlsDisabled"
            @change="toggleGroup(record.id, !!$event.target.checked)"
          ><span class="permission-name">{{ record.name }}</span></a-checkbox>
          <span v-else class="permission-name">{{ record.name }}</span>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space v-if="custom" wrap :size="[8, 4]">
            <a-checkbox
              v-for="option in record.options" :key="option.value"
              :checked="record.checkedList.includes(option.value)" :disabled="controlsDisabled"
              :aria-label="record.name + ' · ' + option.label"
              @change="toggleAction(record.id, option.value, !!$event.target.checked)"
            >{{ option.label }}</a-checkbox>
          </a-space>
          <PermissionActions v-else :record="record" />
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { PermissionScope } from './data'
import type { TokenPermissionMode, TokenPermissionSelection } from '../types'
import { useTokenPermissions } from './useTokenPermissions'

const { t: $t } = useI18n()
const props = defineProps({
  value: { type: Array as PropType<PermissionScope[]>, default: () => [] },
  disabled: { type: Boolean, default: false },
  presentation: { type: String as PropType<'table' | 'list'>, default: 'table' },
  permissionMode: { type: String as PropType<TokenPermissionMode>, default: undefined },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (event: 'update:value', value: PermissionScope[]): void
  (event: 'mode-change', value: TokenPermissionSelection): void
  (event: 'ready-change', ready: boolean): void
}>()
const {
  searchKeyword, list, loading, loadError, initialized, selectedCount, columns,
  custom, controlsDisabled, modeOptions, onSearch, selectMode, toggleAction, toggleGroup,
} = useTokenPermissions(props, emit)
// 自定义展示全部可选操作；只读详情仍收起没有实际授权的行。
const showPermissionRows = computed(() => !props.permissionMode || props.disabled || custom.value)
const displayRows = computed(() => list.value.filter(item => custom.value ? item.options.length > 0 : item.checkedOptions.length > 0))
const [DefineActions, PermissionActions] = createReusableTemplate<{
  record: { checkedOptions: { label: string; value: string }[] }
}>()
</script>

<style lang="less" scoped>
.permission-choose-container { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.permission-choose-container--list { flex: 1; min-height: 0; }
.permission-detail-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.permission-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); }
.permission-modes > .ant-radio-button-wrapper { height: auto; min-height: 3.5rem; padding: var(--space-2); border: 1px solid var(--jet-theme-border); border-radius: var(--r-2); white-space: normal; line-height: 1.5; box-shadow: none; }
.permission-modes > .ant-radio-button-wrapper::before { display: none; }
.permission-modes > .ant-radio-button-wrapper-checked:not(.ant-radio-button-wrapper-disabled) { border-color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
.permission-mode-label, .permission-mode-description { display: block; overflow-wrap: anywhere; }
.permission-mode-label { font-weight: 500; font-size: var(--fs-13); }
.permission-mode-description { margin-top: var(--space-1); color: var(--text-color-secondary); font-size: var(--fs-12); }
.permission-selection-hint { margin: 0; color: var(--text-color-secondary); font-size: var(--fs-12); }
.permission-toolbar { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.permission-toolbar > .ant-input-group-wrapper { flex: 1 1 12rem; width: auto; min-width: 0; }
.permission-count { margin: 0; color: var(--text-color-secondary); font-size: var(--fs-12); white-space: nowrap; }
.permission-choose-container :deep(.ant-table-body) { overscroll-behavior: contain; scrollbar-gutter: stable; }
.permission-operation { margin: 0; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
.permission-name { color: var(--text-color); overflow-wrap: anywhere; min-width: 0; }
.permission-detail-row.ant-list-item { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr); align-items: start; gap: var(--space-4); padding: var(--space-3) 0; }
.permission-detail-row > .ant-space { min-width: 0; }
@media (max-width: 36rem) { .permission-modes { grid-template-columns: minmax(0, 1fr); } }
</style>
