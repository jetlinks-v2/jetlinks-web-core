<script setup lang="ts">
import { computed } from 'vue'
import Unsubscribe from './components/Unsubscribe.vue'
import { useNotificationSettings } from './useNotificationSettings'
import type { AccountEditTarget } from '../../types'

const props = defineProps<{ canEditProfile: boolean }>()
const emit = defineEmits<{ (event: 'edit-contact', target: AccountEditTarget): void }>()
const {
  providers, loading, failed, configsFailed, saving, pendingBinding, recipientsFailed, recipientsLoading,
  load, loadRecipients, bindingComplete, receiverStatus, insideMailEnabled,
  channelHeaderAction, openChannelSettings, displayedTypes, tableColumns, matrixRowNames,
  channelLabel, channelIcon, matrixCells, toggleMatrixChannel,
} = useNotificationSettings()

const headerActions = computed(() => Object.fromEntries(displayedTypes.value.map(type => {
  const action = channelHeaderAction(type)
  return [type, action === 'configure' || props.canEditProfile ? action : undefined]
})))

function handleHeaderAction(type: string) {
  const action = headerActions.value[type]
  if (action === 'configure') openChannelSettings(type)
  else if (action) emit('edit-contact', action)
}
</script>

<template>
  <div class="notification-settings">
    <a-alert v-if="failed || configsFailed" type="error" show-icon :message="$t('PersonalCenter.notificationFailed')">
      <template #action><a-button type="link" :disabled="!!saving" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="recipientsFailed" type="warning" show-icon :message="$t('PersonalCenter.notificationRecipientsFailed')">
      <template #action><a-button type="link" :loading="recipientsLoading" @click="loadRecipients">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>

    <p class="notification-settings__intro-text">{{ $t('PersonalCenter.deliveryHint') }}</p>

    <div class="notification-settings__card">
      <a-spin :spinning="loading">
        <!-- 公共表格会缓存插槽名；异步渠道改变列结构时重新建立动态列插槽。 -->
        <j-pro-table
          :key="displayedTypes.join('|')"
          mode="TABLE"
          row-key="matrixKey"
          :columns="tableColumns"
          :data-source="providers"
          :no-pagination="true"
          :body-style="{ padding: 0 }"
          :scroll="{ x: 220 + displayedTypes.length * 130, y: false }"
          class="notification-settings__table"
        >
          <template #headerCell="{ column }">
            <span v-if="column.key === 'topic'" class="notification-settings__topic-title">{{ $t('PersonalCenter.messageType') }}</span>
            <div v-else class="notification-settings__column-name">
              <span class="notification-settings__channel-title">
                <span class="notification-settings__channel-icon" aria-hidden="true"><AIcon :type="channelIcon(column.key)" /></span>
                <span>{{ channelLabel(column.key) }}</span>
              </span>
              <div class="notification-settings__channel-meta">
                <span
                  class="notification-settings__status"
                  :class="{ 'notification-settings__status--enabled': column.key === 'inside-mail' && insideMailEnabled }"
                >
                  <span v-if="column.key === 'inside-mail' && insideMailEnabled" class="notification-settings__status-dot" aria-hidden="true" />
                  {{ receiverStatus(column.key) }}
                </span>
                <a-button
                  v-if="headerActions[column.key]"
                  type="link"
                  size="small"
                  class="notification-settings__channel-action"
                  @click.stop="handleHeaderAction(column.key)"
                >{{ $t(headerActions[column.key] === 'configure' ? 'PersonalCenter.goConfigure' : 'PersonalCenter.notificationFillContact') }}</a-button>
              </div>
            </div>
          </template>
          <template #topic="record">
            <span class="notification-settings__topic-name">{{ matrixRowNames[record.matrixKey] }}</span>
          </template>
          <template v-for="type in displayedTypes" :key="type" #[type]="record">
            <div class="notification-settings__cell">
              <div v-for="cell in matrixCells(record.matrixKey, type)" :key="cell.channel.id" class="notification-settings__checkbox-wrapper">
                <a-spin size="small" :spinning="cell.saving">
                  <a-checkbox
                    :checked="cell.checked"
                    :disabled="!!saving || !!cell.unavailable"
                    :aria-label="matrixRowNames[record.matrixKey] + ' · ' + channelLabel(type)"
                    @change="toggleMatrixChannel(record.matrixKey, cell.channel, !!$event.target.checked)"
                  />
                </a-spin>
              </div>
              <a-checkbox
                v-if="!matrixCells(record.matrixKey, type).length"
                disabled
                :checked="false"
                :aria-label="matrixRowNames[record.matrixKey] + ' · ' + channelLabel(type)"
              />
            </div>
          </template>
          <template #emptyText><CloudEmpty v-if="!failed" :image-style="{ height: '64px' }" :description="$t('PersonalCenter.notificationNoEnabledTypes')"><a-button :loading="loading" @click="load">{{ $t('AccountCenter.retry') }}</a-button></CloudEmpty></template>
        </j-pro-table>
      </a-spin>

      <div class="notification-settings__card-footer">
        <AIcon type="InfoCircleOutlined" class="notification-settings__footer-icon" />
        <span class="notification-settings__footer-text">{{ $t('PersonalCenter.channelUnavailableNote') }}</span>
      </div>
    </div>

    <Unsubscribe v-if="pendingBinding" :data="pendingBinding.provider" :current="pendingBinding.channel" @close="pendingBinding = undefined" @save="bindingComplete" />
  </div>
</template>

<style scoped lang="less" src="./subscribeMatrix.less"></style>
