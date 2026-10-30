<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Unsubscribe from './components/Unsubscribe.vue'
import { useNotificationSettings, type NotificationProvider } from './useNotificationSettings'
import type { AccountEditTarget } from '../../types'

defineProps<{ canEditProfile?: boolean }>()
const emit = defineEmits<{ (event: 'edit-contact', target: AccountEditTarget): void }>()
const { t } = useI18n()
const {
  providers, channelTypes, loading, failed, saving, pendingBinding, recipientsFailed, recipientsLoading,
  profile, load, loadRecipients, toggle, bindingComplete, receiverSummary, channelUnavailable, unavailableType, channelChecked,
  canBindReceiver, beginReceiverBinding,
} = useNotificationSettings()
const channelsFor = (row: NotificationProvider, type: string) => row.channels.filter(channel => channel.channelProvider === type)
const channelNames: Record<string, string> = {
  'notifier-dingTalk': 'PersonalCenter.dingtalk', 'notifier-weixin': 'PersonalCenter.notificationWechat',
  'notifier-email': 'PersonalCenter.notificationEmail', 'notifier-voice': 'PersonalCenter.voice',
  'notifier-sms': 'PersonalCenter.sms', 'notifier-webhook': 'PersonalCenter.notificationWebhook',
}
const columns = computed(() => [
  { key: 'topic', title: t('NotificationRecord.index.803553-4'), width: 240 },
  ...channelTypes.value.map(type => ({ key: type, title: t(channelNames[type]), width: 160 })),
])
</script>

<template>
  <div class="notification-settings">
    <p>{{ $t('PersonalCenter.deliveryHint') }}</p>
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.notificationFailed')">
      <template #action><a-button type="link" :disabled="!!saving" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="recipientsFailed" type="warning" show-icon :message="$t('PersonalCenter.notificationRecipientsFailed')">
      <template #action><a-button type="link" :loading="recipientsLoading" @click="loadRecipients">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-table :columns="columns" :data-source="providers" :loading="loading" :pagination="false" size="middle" row-key="provider" table-layout="fixed" :scroll="{ x: 240 + channelTypes.length * 160 }">
      <template #emptyText>
        <CloudEmpty :description="$t('PersonalCenter.notificationNoEnabledTypes')">
          <a-button :loading="loading" @click="load">{{ $t('AccountCenter.retry') }}</a-button>
        </CloudEmpty>
      </template>
      <template #headerCell="{ column }">
        <span>{{ column.title }}</span>
        <div v-if="column.key !== 'topic' && receiverSummary(column.key)" class="notification-settings__receiver">
          <j-ellipsis>{{ receiverSummary(column.key) }}</j-ellipsis>
        </div>
        <a-button
          v-if="canEditProfile && column.key === 'notifier-email' && !profile.email"
          type="link" size="small" class="notification-settings__link"
          @click="emit('edit-contact', 'email-section')"
        >{{ $t('PersonalCenter.notificationFillContact') }}</a-button>
        <a-button
          v-else-if="canEditProfile && ['notifier-sms', 'notifier-voice'].includes(column.key) && !profile.telephone"
          type="link" size="small" class="notification-settings__link"
          @click="emit('edit-contact', 'phone-section')"
        >{{ $t('PersonalCenter.notificationFillContact') }}</a-button>
        <a-button
          v-else-if="canBindReceiver(column.key) && !recipientsFailed"
          type="link" size="small" class="notification-settings__link"
          :disabled="!!saving || recipientsLoading"
          @click="beginReceiverBinding(column.key)"
        >{{ $t('PersonalCenter.notificationBindReceiver') }}</a-button>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'topic'">
          <span class="notification-settings__name">{{ record.displayName }}</span>
          <div v-if="record.description" class="notification-settings__description">{{ record.description }}</div>
        </template>
        <template v-else>
          <div v-if="channelsFor(record, column.key).length" class="notification-settings__channels">
            <div v-for="channel in channelsFor(record, column.key)" :key="channel.id">
              <a-tooltip :title="channelUnavailable(channel) || channel.name">
                <span>
                  <a-switch
                    size="small"
                    :checked="channelChecked(record, channel)"
                    :loading="saving === record.provider + ':' + channel.id"
                    :disabled="!!saving || !!channelUnavailable(channel)"
                    :aria-label="record.displayName + ' · ' + column.title"
                    @change="toggle(record, channel, !!$event)"
                  />
                </span>
              </a-tooltip>
              <div v-if="channelsFor(record, column.key).length > 1" class="notification-settings__description">{{ channel.name }}</div>
            </div>
          </div>
          <a-tooltip v-else :title="unavailableType(column.key)">
            <span><a-switch size="small" disabled :checked="false" :aria-label="record.displayName + ' · ' + column.title" /></span>
          </a-tooltip>
        </template>
      </template>
    </a-table>
    <Unsubscribe v-if="pendingBinding" :data="pendingBinding.provider" :current="pendingBinding.channel" @close="pendingBinding = undefined" @save="bindingComplete" />
  </div>
</template>

<style scoped>
.notification-settings { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.notification-settings > p { color: var(--text-color-secondary); margin: 0; font-size: var(--fs-13); }
.notification-settings__name { font-weight: 500; }
.notification-settings__description, .notification-settings__receiver { margin-top: var(--space-1); color: var(--text-color-secondary); font-size: var(--fs-12); font-weight: 400; }
.notification-settings__receiver { max-width: 9rem; }
.notification-settings__channels { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.notification-settings__link { height: auto; padding: 0; }
</style>
