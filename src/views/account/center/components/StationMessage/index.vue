<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageChrome from '@jetlinks-web-core/components/PageChrome/index.vue'
import SlantedTabs from '@jetlinks-web-core/components/SlantedTabs'
import NotificationRecord from './components/NotificationRecord/index.vue'
import { useStationMessage } from './useStationMessage'

const {
  tabs, activeKey, activeGroup, hasProviders, loading, failed, operationFailed, markingAll,
  countFor, load, selectCategory, markAllRead, requestedType, clearRequestedType,
} = useStationMessage()
const records = ref<{ refresh: () => void }>()
const { t } = useI18n()
const tabOptions = computed(() => tabs.value.map(item => {
  const count = countFor(item.key)
  return { key: item.key, label: t(item.nameKey), count: count ? count > 99 ? '99+' : count : undefined }
}))

async function readAll() {
  if (await markAllRead()) records.value?.refresh()
}
</script>

<template>
  <PageChrome v-if="tabs.length" flush>
    <div class="station-message__toolbar">
      <SlantedTabs class="station-message__tabs" :active-key="activeKey" :options="tabOptions" @change="selectCategory" />
      <a-popconfirm :title="$t('PersonalCenter.messageAllReadConfirm')" @confirm="readAll">
        <a-button type="primary" class="station-message__read-all" :loading="markingAll" :disabled="!hasProviders">{{ $t('PersonalCenter.messageAllRead') }}</a-button>
      </a-popconfirm>
    </div>
  </PageChrome>
  <div class="station-message">
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.messagesFailed')">
      <template #action><a-button type="link" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="operationFailed" type="error" show-icon :message="$t('PersonalCenter.messageOperationFailed')" />
    <a-spin v-if="loading && !tabs.length" />
    <template v-else-if="tabs.length">
      <NotificationRecord
        v-if="activeGroup"
        :key="activeGroup.key"
        ref="records"
        :category="activeGroup.key"
        :children="activeGroup.children"
        :requested-type="requestedType?.category === activeGroup.key ? requestedType : undefined"
        @type-filter-applied="clearRequestedType"
      />
    </template>
    <CloudEmpty v-else-if="!failed" />
  </div>
</template>

<style scoped>
.station-message { min-width: 0; display: flex; flex-direction: column; gap: var(--space-4); }
.station-message__toolbar { min-width: 0; display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
.station-message__tabs { flex: 1; min-width: 15rem; --slanted-tabs-background: transparent; }
.station-message__read-all { flex: none; margin-inline-start: auto; }
</style>
