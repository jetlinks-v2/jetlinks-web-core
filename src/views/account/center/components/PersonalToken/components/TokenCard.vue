<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PersonalToken } from '../types'
import { tokenStatus, tokenDate, tokenExpiryDays, permissionCount, isUnlimitedExpiry } from '../tokenPresentation'
import { permissionModeLabel, resolvePermissionMode } from '../permissionMode'

const props = defineProps({
  token: { type: Object as PropType<PersonalToken>, required: true },
  busy: { type: Boolean, default: false },
})
defineEmits<{ (event: 'view', token: PersonalToken): void; (event: 'delete', token: PersonalToken): void }>()
const { t } = useI18n()
const status = computed(() => tokenStatus(props.token))
const active = computed(() => ['PersonalCenter.valid', 'PersonalCenter.expiring'].includes(status.value.key))
const permissionSummary = computed(() => t(permissionModeLabel(props.token.scope))
  + (resolvePermissionMode(props.token.scope) === 'follow' ? '' : ' · ' + t('PersonalCenter.permissionCount', { count: permissionCount(props.token) })))
const description = computed(() => props.token.description?.trim() || t('PersonalToken.descriptionNotConfigured'))
const expiry = computed(() => {
  if (status.value.key === 'PersonalCenter.disabled') return t('PersonalCenter.disabled')
  if (status.value.key === 'PersonalCenter.expired') return t('PersonalCenter.expired') + ' ' + tokenDate(props.token.expires, 'YYYY-MM-DD')
  if (isUnlimitedExpiry(props.token.expires)) return t('PersonalToken.TokenCard.515931-4')
  const date = tokenDate(props.token.expires, 'YYYY-MM-DD')
  if (status.value.key === 'PersonalCenter.expiring') {
    const days = tokenExpiryDays(props.token.expires)
    if (days === 0) return t('PersonalToken.prototype.expireToday', { date })
    if (days !== null && days > 0) return t('PersonalToken.prototype.expireInDays', { date, count: days })
  }
  return date === '—' ? date : t('PersonalToken.prototype.expireOn', { date })
})
</script>

<template>
  <a-list-item class="personal-token-row" :class="{ 'personal-token-row--inactive': !active }">
    <a-list-item-meta class="personal-token-row__meta">
      <template #avatar>
        <a-avatar :size="38" shape="square" class="personal-token-row__icon">
          <template #icon><AIcon type="KeyOutlined" /></template>
        </a-avatar>
      </template>
      <template #title>
        <div class="personal-token-row__heading">
          <a-button type="link" class="personal-token-row__name" :title="token.name" @click="$emit('view', token)">{{ token.name || $t('comm.table.empty') }}</a-button>
          <a-tag :bordered="false" class="personal-token-row__permissions">{{ permissionSummary }}</a-tag>
        </div>
      </template>
      <template #description>
        <div class="personal-token-row__expiry" :class="{ 'personal-token-row__expiry--soon': status.key === 'PersonalCenter.expiring' }">{{ expiry }}</div>
        <div class="personal-token-row__description">
          <j-ellipsis :title="description">{{ description }}</j-ellipsis>
        </div>
      </template>
    </a-list-item-meta>
    <template v-if="active" #actions>
      <j-permission-button
        danger :has-permission="true" :loading="busy"
        :pop-confirm="{ title: $t('PersonalToken.prototype.revokeTitle', { name: token.name || '' }), content: $t('PersonalToken.prototype.revokeDescription'), okText: $t('PersonalCenter.tokenRevoke'), cancelText: $t('PersonalToken.TokenDialog.168178-0'), onConfirm: () => $emit('delete', token) }"
      >{{ $t('PersonalCenter.tokenRevoke') }}</j-permission-button>
    </template>
  </a-list-item>
</template>

<style scoped>
.personal-token-row.ant-list-item { align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-5); transition: background 0.15s; }
.personal-token-row.ant-list-item:hover { background: color-mix(in srgb, var(--accent-soft) 20%, var(--bg-elev)); }
.personal-token-row .personal-token-row__meta { align-items: center; min-width: 0; }
.personal-token-row :deep(.ant-list-item-meta-content) { min-width: 0; }
.personal-token-row :deep(.ant-list-item-action) { flex: none; margin-inline-start: var(--space-4); }
.personal-token-row :deep(.ant-list-item-action > li) { padding: 0; }
.personal-token-row :deep(.ant-list-item-action .ant-btn) { min-width: 4rem; }
.personal-token-row__icon { border-radius: var(--r-3); background: var(--accent-soft); color: var(--accent); }
.personal-token-row__heading { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1) var(--space-3); min-width: 0; line-height: var(--lh-normal); }
.personal-token-row__name { min-width: 0; max-width: 100%; height: auto; padding: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text-color); font-size: var(--fs-16); font-weight: 600; text-align: start; }
.personal-token-row__name:hover, .personal-token-row__name:focus-visible { color: var(--accent); }
.personal-token-row__permissions { margin: 0; color: var(--text-color-secondary); font-size: var(--fs-12); font-weight: 400; border-radius: var(--r-1); }
.personal-token-row__expiry { color: var(--text-color-secondary); font-size: var(--fs-13); line-height: var(--lh-relaxed); }
.personal-token-row__expiry--soon { color: var(--jet-theme-warning, #b25900); }
.personal-token-row__description { display: flex; align-items: center; min-width: 0; min-height: 1.25rem; margin-top: var(--space-1); color: color-mix(in srgb, var(--text-color-secondary) 80%, var(--bg-elev)); font-size: var(--fs-13); line-height: var(--lh-relaxed); }
.personal-token-row__description :deep(.j-ellipsis) { font-size: inherit; line-height: inherit; }
.personal-token-row--inactive .personal-token-row__icon { background: var(--bg-2); color: var(--text-color-secondary); }
.personal-token-row--inactive .personal-token-row__name { color: var(--text-color-secondary); }
.personal-token-row--inactive .personal-token-row__name:hover { color: var(--accent); }
@container personal-token (max-width: 38rem) {
  .personal-token-row.ant-list-item { padding: var(--space-3) var(--space-4); flex-wrap: wrap; gap: var(--space-3); }
  .personal-token-row .personal-token-row__meta { flex-basis: 100%; }
  .personal-token-row :deep(.ant-list-item-action) { margin: 0 0 0 auto; }
}
@media (prefers-reduced-motion: reduce) {
  .personal-token-row.ant-list-item { transition: none; }
}
</style>
