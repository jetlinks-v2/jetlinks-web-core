<script setup lang="ts">
import PageChrome from '@jetlinks-web-core/components/PageChrome/index.vue'
import SlantedTabs from '@jetlinks-web-core/components/SlantedTabs'
import NotificationRecord from './components/NotificationRecord/index.vue'
import { useStationMessage } from './useStationMessage'

const emit = defineEmits<{ (event: 'notification-settings'): void }>()
const {
  tabs, tabOptions, activeKey, activeGroup, hasProviders, loading, failed, operationFailed, markingAll,
  load, selectCategory, requestedType, clearRequestedType, records, readAll,
} = useStationMessage()
</script>

<template>
  <PageChrome v-if="tabs.length" flush>
    <SlantedTabs
      class="station-message__tabs"
      :active-key="activeKey"
      :options="tabOptions"
      @change="selectCategory"
    />
  </PageChrome>
  <div class="station-message">
    <div class="station-message__body">
      <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.messagesFailed')">
        <template #action><a-button type="link" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
      </a-alert>
      <a-alert v-if="operationFailed" type="error" show-icon :message="$t('PersonalCenter.messageOperationFailed')" />
      <a-spin v-if="loading && !tabs.length" />
      <NotificationRecord
        v-else-if="activeGroup"
        :key="activeGroup.key"
        ref="records"
        :category="activeGroup.key"
        :children="activeGroup.children"
        :requested-type="requestedType?.category === activeGroup.key ? requestedType : undefined"
        @type-filter-applied="clearRequestedType"
        @notification-settings="emit('notification-settings')"
      >
        <template #actions>
          <j-permission-button
            type="primary"
            :has-permission="true"
            :loading="markingAll"
            :disabled="!hasProviders"
            :pop-confirm="{ title: $t('PersonalCenter.messageAllReadConfirm'), onConfirm: readAll }"
          >
            <AIcon type="CheckOutlined" />{{ $t('PersonalCenter.messageAllRead') }}
          </j-permission-button>
        </template>
      </NotificationRecord>
      <CloudEmpty v-else-if="!failed" />
    </div>
  </div>
</template>

<style scoped>
.station-message { width: 100%; min-width: 0; }
.station-message__body { display: flex; flex-direction: column; gap: var(--space-3); min-width: 0; }
.station-message__tabs {
  --slanted-tabs-background: transparent;
}
</style>
