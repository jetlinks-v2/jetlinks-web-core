<script setup lang="ts">
import Unsubscribe from './components/Unsubscribe.vue'
import { useNotificationSettings } from './useNotificationSettings'
import type { AccountEditTarget } from '../../types'

defineProps<{ canEditProfile?: boolean }>()
const emit = defineEmits<{ (event: 'edit-contact', target: AccountEditTarget): void }>()
const channelTooltipStyle = { maxWidth: 'min(360px, calc(100vw - 24px))' }
const {
  providers, loading, failed, saving, pendingBinding, recipientsFailed, recipientsLoading,
  load, loadRecipients, bindingComplete, receiverSummary, receiverStatus, unavailableType,
  beginReceiverBinding, channelHeaderAction, openChannelSettings, displayedTypes, tableColumns, matrixRowNames, channelLabel, channelIcon, matrixCells, toggleMatrixChannel,
} = useNotificationSettings()
</script>

<template>
  <div class="notification-settings">
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.notificationFailed')">
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
          row-key="provider"
          :columns="tableColumns"
          :data-source="providers"
          :no-pagination="true"
          :body-style="{ padding: 0 }"
          :scroll="{ x: 220 + displayedTypes.length * 130, y: false }"
          class="notification-settings__table"
        >
          <template #headerCell="{ column }">
            <span v-if="column.key === 'topic'" class="notification-settings__topic-title">{{ $t('PersonalCenter.messageType') }}</span>
            <a-tooltip v-else :title="column.key === 'inside-mail' ? undefined : receiverSummary(column.key)" :overlay-style="channelTooltipStyle">
              <div class="notification-settings__column-name">
                <span class="notification-settings__channel-title">
                  <span class="notification-settings__channel-icon" aria-hidden="true"><AIcon :type="channelIcon(column.key)" /></span>
                  <span>{{ channelLabel(column.key) }}</span>
                </span>
                <div class="notification-settings__channel-meta">
                  <a-button
                    v-if="channelHeaderAction(column.key) === 'configure'"
                    type="link"
                    size="small"
                    class="notification-settings__channel-action"
                    @click.stop="openChannelSettings(column.key)"
                  >{{ $t('PersonalCenter.goConfigure') }}</a-button>
                  <a-button
                    v-else-if="canEditProfile && channelHeaderAction(column.key) === 'email'"
                    type="link"
                    size="small"
                    class="notification-settings__channel-action"
                    @click.stop="emit('edit-contact', 'email-section')"
                  >{{ $t('PersonalCenter.notificationFillContact') }}</a-button>
                  <a-button
                    v-else-if="canEditProfile && channelHeaderAction(column.key) === 'phone'"
                    type="link"
                    size="small"
                    class="notification-settings__channel-action"
                    @click.stop="emit('edit-contact', 'phone-section')"
                  >{{ $t('PersonalCenter.notificationFillContact') }}</a-button>
                  <a-button
                    v-else-if="channelHeaderAction(column.key) === 'bind'"
                    type="link"
                    size="small"
                    class="notification-settings__channel-action"
                    :disabled="!!saving || recipientsLoading"
                    @click.stop="beginReceiverBinding(column.key)"
                  >{{ $t('PersonalCenter.notificationBindReceiver') }}</a-button>
                  <span v-else class="notification-settings__status-ready">
                    <span class="notification-settings__status-dot" />
                    {{ receiverStatus(column.key) }}
                  </span>
                </div>
              </div>
            </a-tooltip>
          </template>
          <template #topic="record">
            <span class="notification-settings__topic-name">{{ matrixRowNames[record.provider] }}</span>
          </template>
          <template v-for="type in displayedTypes" :key="type" #[type]="record">
            <div class="notification-settings__cell">
              <div v-for="cell in matrixCells(record.provider, type)" :key="cell.channel.id" class="notification-settings__checkbox-wrapper">
                <a-tooltip :title="cell.unavailable || cell.channel.name" :overlay-style="channelTooltipStyle">
                  <span>
                    <a-spin size="small" :spinning="cell.saving">
                      <a-checkbox
                        :checked="cell.checked"
                        :disabled="!!saving || !!cell.unavailable"
                        :aria-label="matrixRowNames[record.provider] + ' · ' + channelLabel(type)"
                        @change="toggleMatrixChannel(record.provider, cell.channel, !!$event.target.checked)"
                      />
                    </a-spin>
                  </span>
                </a-tooltip>
              </div>
              <a-tooltip v-if="!matrixCells(record.provider, type).length" :title="unavailableType(type)" :overlay-style="channelTooltipStyle">
                <span class="notification-settings__checkbox-wrapper">
                  <a-checkbox
                    disabled
                    :checked="false"
                    :aria-label="matrixRowNames[record.provider] + ' · ' + channelLabel(type)"
                  />
                </span>
              </a-tooltip>
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
