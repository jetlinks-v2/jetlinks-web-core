<script setup lang="ts">
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
  (event: 'notification-settings'): void
}>()
const {
  tableRef, batchActions, rowClassName,
  filterTerms, filterFields, typeFilterKey, onFilterChange, queryParams, updating, failed, listFailed, viewVisible, viewItem,
  columns, defaultParams, rowSelection, requestNotifications,
  titleOf, summaryOf, typeOf, stateOf, stateText, formatTime, refresh, toggleRead, view, confirmDetail,
} = useNotificationRecords(props, state => emit('filter-change', state), sequence => emit('type-filter-applied', sequence))
defineExpose({ refresh })
</script>

<template>
  <div class="notification-record-container">
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.messageOperationFailed')" />
    <a-alert v-if="listFailed" type="error" show-icon :message="$t('PersonalCenter.messageListFailed')"><template #action><a-button type="link" @click="refresh">{{ $t('AccountCenter.retry') }}</a-button></template></a-alert>
    <j-pro-table ref="tableRef" row-key="id" mode="TABLE" :columns="columns" :request="requestNotifications"
      :params="queryParams" :default-params="defaultParams" :row-selection="rowSelection" :row-class-name="rowClassName"
      :alert-show="false" :body-style="{ padding: 0 }" :scroll="{ x: 820, y: false }"
      :pagination="{ defaultPageSize: 7, pageSizeOptions: ['7', '14', '28'], isShowContent: true }">
      <template #headerLeftRender>
        <ConditionFilter v-model="filterTerms" class="notification-record-container__filter" :placeholder="$t('PersonalCenter.messageFilterPlaceholder')" :fields="filterFields" :common-fields="['message', typeFilterKey, 'state', 'notifyTime']" @change="onFilterChange" />
      </template>
      <template #headerRightRender>
        <a-space wrap>
          <slot name="actions" />
          <BatchDropdown :actions="batchActions" />
        </a-space>
      </template>
      <template #emptyText>
        <CloudEmpty v-if="!listFailed" :image-style="{ height: '64px' }">
          <template #description>
            <template v-if="queryParams.terms.length">{{ $t(category === 'announcement' ? 'PersonalCenter.announcementNoResults' : 'PersonalCenter.notificationNoResults') }}</template>
            <template v-else>
              <strong>{{ $t(category === 'announcement' ? 'PersonalCenter.announcementEmptyTitle' : 'PersonalCenter.notificationEmptyTitle') }}</strong>
              <div>{{ $t(category === 'announcement' ? 'PersonalCenter.announcementEmpty' : 'PersonalCenter.notificationEmpty') }}</div>
            </template>
          </template>
          <a-button v-if="category === 'notification' && !queryParams.terms.length" @click="emit('notification-settings')">{{ $t('PersonalCenter.notifications') }}</a-button>
        </CloudEmpty>
      </template>
      <template #state="record"><j-badge-status :status="stateOf(record)" :text="stateText(record)" :status-names="{ unread: 'processing', read: 'default' }" /></template>
      <template #topicProvider="record">{{ typeOf(record) || $t('comm.table.empty') }}</template>
      <template #message="record">
        <div class="notification-record-container__content">
          <a-button type="link" class="notification-record-container__title" @click="view(record)"><j-ellipsis>{{ titleOf(record) || $t('comm.table.empty') }}</j-ellipsis></a-button>
          <j-ellipsis v-if="summaryOf(record)" class="notification-record-container__summary">{{ summaryOf(record) }}</j-ellipsis>
        </div>
      </template>
      <template #notifyTime="record">{{ formatTime(record.notifyTime) }}</template>
      <template #action="record">
        <TableActions>
          <TableActionsItem><a-button type="link" @click="view(record)">{{ $t('NotificationRecord.index.803553-3') }}</a-button></TableActionsItem>
          <TableActionsItem v-if="stateOf(record) === 'read' || stateOf(record) === 'unread'">
            <a-button type="link" :disabled="updating" @click="toggleRead(record)">{{ $t(stateOf(record) === 'read' ? 'NotificationRecord.index.803553-1' : 'NotificationRecord.index.803553-2') }}</a-button>
          </TableActionsItem>
        </TableActions>
      </template>
    </j-pro-table>
    <ViewDialog v-if="viewVisible && viewItem" v-model:visible="viewVisible" :data="viewItem" :type="category" :confirm="confirmDetail" />
  </div>
</template>

<style scoped>
.notification-record-container { min-width: 0; }
.notification-record-container__filter { min-width: 0; width: 26.25rem; max-width: 100%; }

.notification-record-container__content { display: flex; flex-direction: column; min-width: 0; gap: var(--space-1); }
.notification-record-container__title { padding: 0; height: auto; max-width: 100%; text-align: left; }
.notification-record-container__summary { color: var(--text-color-secondary); font-size: var(--fs-12); }
</style>
