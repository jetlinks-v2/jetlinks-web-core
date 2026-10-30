<script setup lang="ts">
import ConditionFilter from '@jetlinks-web-core/components/ConditionFilter'
import ViewDialog from './components/ViewDialog.vue'
import { useNotificationRecords, type MessageFilterState, type MessageProvider } from './useNotificationRecords'
import type { MessageTypeRequest } from '../../useStationMessage'

const props = defineProps<{
  category: string
  children: MessageProvider[]
  savedFilter?: MessageFilterState
  requestedType?: MessageTypeRequest
}>()
const emit = defineEmits<{
  (event: 'filter-change', state: MessageFilterState): void
  (event: 'type-filter-applied', sequence: number): void
}>()
const {
  tableRef, filterTerms, queryParams, selectedIds, updating, failed, viewVisible, viewItem,
  filterFields, columns, defaultParams, rowSelection, onFilterChange, requestNotifications,
  titleOf, summaryOf, typeOf, stateOf, stateText, formatTime, refresh, markSelected, toggleRead, view,
  confirmDetail,
} = useNotificationRecords(props, state => emit('filter-change', state), sequence => emit('type-filter-applied', sequence))

defineExpose({ refresh })
</script>

<template>
  <div class="notification-record-container">
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.messageOperationFailed')" />
    <j-pro-table
      ref="tableRef"
      row-key="id"
      mode="TABLE"
      :columns="columns"
      :request="requestNotifications"
      :params="queryParams"
      :default-params="defaultParams"
      :row-selection="rowSelection"
      :alert-show="false"
      :body-style="{ padding: 0 }"
      :scroll="{ x: 820, y: false }"
    >
      <template #headerLeftRender>
        <ConditionFilter
          v-model="filterTerms"
          class="notification-record-container__filter"
          :fields="filterFields"
          :common-fields="['message', 'topicProvider', 'state', 'notifyTime']"
          @change="onFilterChange"
        />
      </template>
      <template #headerRightRender>
        <a-space v-if="selectedIds.length">
          <span class="notification-record-container__selected">{{ $t('PersonalCenter.messageSelected', { count: selectedIds.length }) }}</span>
          <a-button type="link" :loading="updating" @click="markSelected('_read')">{{ $t('NotificationRecord.index.803553-2') }}</a-button>
          <a-button type="link" :loading="updating" @click="markSelected('_unread')">{{ $t('NotificationRecord.index.803553-1') }}</a-button>
        </a-space>
      </template>
      <template #emptyText><CloudEmpty /></template>
      <template #state="record">
        <j-badge-status :status="stateOf(record)" :text="stateText(record)" :status-names="{ unread: 'processing', read: 'default' }" />
      </template>
      <template #topicProvider="record">
        <a-tag>{{ typeOf(record) || $t('comm.table.empty') }}</a-tag>
      </template>
      <template #message="record">
        <div class="notification-record-container__content">
          <a-button type="link" class="notification-record-container__title" @click="view(record)">
            <j-ellipsis>{{ titleOf(record) || $t('comm.table.empty') }}</j-ellipsis>
          </a-button>
          <j-ellipsis v-if="summaryOf(record)" class="notification-record-container__summary">{{ summaryOf(record) }}</j-ellipsis>
        </div>
      </template>
      <template #notifyTime="record">{{ formatTime(record.notifyTime) }}</template>
      <template #action="record">
        <a-space>
          <a-button type="link" @click="view(record)">{{ $t('NotificationRecord.index.803553-3') }}</a-button>
          <a-popconfirm v-if="stateOf(record) === 'read' || stateOf(record) === 'unread'" :title="$t('NotificationRecord.index.803553-0', [$t(stateOf(record) === 'read' ? 'NotificationRecord.index.803553-8' : 'NotificationRecord.index.803553-9')])" @confirm="toggleRead(record)">
            <a-button type="link" :loading="updating">
              {{ $t(stateOf(record) === 'read' ? 'NotificationRecord.index.803553-1' : 'NotificationRecord.index.803553-2') }}
            </a-button>
          </a-popconfirm>
        </a-space>
      </template>
    </j-pro-table>
    <ViewDialog
      v-if="viewVisible && viewItem"
      v-model:visible="viewVisible"
      :data="viewItem"
      :type="category"
      :confirm="confirmDetail"
    />
  </div>
</template>

<style scoped lang="less">
.notification-record-container {
  min-width: 0;
  &__filter { width: 100%; min-width: 0; }
  &__selected, &__summary { color: var(--text-color-secondary); font-size: var(--fs-12); }
  &__content { display: flex; flex-direction: column; min-width: 0; gap: var(--space-1); }
  &__title { padding: 0; height: auto; max-width: 100%; text-align: left; }
  :deep(.ant-btn-link) { padding-inline: 0; }
}
</style>
