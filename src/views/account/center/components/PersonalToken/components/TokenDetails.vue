<script setup lang="ts">
import { computed, type PropType } from 'vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import PermissionList from './PermissionList.vue'
import { tokenDate, tokenStatus, tokenExpiryDays, isUnlimitedExpiry } from '../tokenPresentation'
import { copyTokenScope, permissionModeLabel, resolvePermissionMode } from '../permissionMode'
import type { PersonalToken } from '../types'
const props = defineProps({ token: { type: Object as PropType<PersonalToken>, required: true } })
defineEmits<{ (event: 'close'): void; (event: 'edit', token: PersonalToken): void; (event: 'regenerate', token: PersonalToken): void }>()
const status = computed(() => tokenStatus(props.token))
const scope = computed(() => copyTokenScope(props.token.scope))
const remainingDays = computed(() => tokenExpiryDays(props.token.expires))
const permissionMode = computed(() => resolvePermissionMode(props.token.scope))
</script>

<template>
  <JlDrawerShell open :title="token.name" :width="640" @update:open="!$event && $emit('close')">
    <template #head>
      <div class="token-details-heading">
        <b class="token-details-name" :title="token.name">{{ token.name }}</b>
        <a-badge :status="status.color" :text="$t(status.key)" />
      </div>
    </template>
    <a-descriptions layout="vertical" :column="2" :colon="false" size="small" class="token-details-metadata">
      <a-descriptions-item v-if="token.accessTokenHint" :span="2" :label="$t('PersonalToken.accessTokenHintLabel')">
        <div class="token-details-credential">
          <a-typography-text class="token-details-key">{{ token.accessTokenHint }}</a-typography-text>
          <a-typography-text type="secondary" class="token-details-hint">{{ $t('PersonalToken.details.secretHint') }}</a-typography-text>
        </div>
      </a-descriptions-item>
      <a-descriptions-item :span="2" :label="$t('PersonalToken.TokenCard.515931-5')">{{ token.description?.trim() || $t('PersonalToken.descriptionNotConfigured') }}</a-descriptions-item>
      <a-descriptions-item :label="$t('PersonalCenter.createdAt')">{{ tokenDate(token.createTime) }}</a-descriptions-item>
      <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-3')">
        <a-space :size="8" wrap>
          <span>{{ isUnlimitedExpiry(token.expires) ? $t('PersonalToken.TokenCard.515931-4') : tokenDate(token.expires) }}</span>
          <a-typography-text v-if="status.key === 'PersonalCenter.expiring' && remainingDays !== null" type="warning" class="token-details-expiry-hint">{{ remainingDays === 0 ? $t('PersonalToken.details.expiresToday') : $t('PersonalToken.details.remainingDays', { count: remainingDays }, remainingDays) }}</a-typography-text>
        </a-space>
      </a-descriptions-item>
    </a-descriptions>
    <section class="token-details-permissions">
      <div class="token-details-section-heading">
        <h3>{{ $t('PersonalCenter.permissions') }}</h3>
        <a-typography-text type="secondary" class="token-details-permission-mode">{{ $t(permissionModeLabel(token.scope)) }}<template v-if="permissionMode === 'readonly'"> · {{ $t('PersonalToken.permissionMode.readonlyHint') }}</template></a-typography-text>
      </div>
      <PermissionList :value="scope.permissions" disabled presentation="list" />
    </section>
    <template #foot>
      <a-button class="token-details-edit" type="primary" @click="$emit('edit', token)">
        <template #icon><AIcon type="EditOutlined" /></template>
        {{ $t('PersonalToken.TokenCard.515931-7') }}
      </a-button>
      <a-button @click="$emit('regenerate', token)">{{ $t('PersonalToken.prototype.regenerate') }}</a-button>
    </template>
  </JlDrawerShell>
</template>

<style scoped>
.token-details-heading { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.token-details-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.token-details-heading > .ant-badge { flex: none; white-space: nowrap; }
.token-details-metadata { flex: none; }
.token-details-metadata :deep(.ant-descriptions-view table) { table-layout: fixed; }
.token-details-metadata :deep(.ant-descriptions-item-label) { color: var(--text-color-secondary); font-size: var(--fs-12); }
.token-details-metadata :deep(.ant-descriptions-item-content) { color: var(--text-color); font-size: var(--fs-14); line-height: var(--lh-relaxed); overflow-wrap: anywhere; }
.token-details-credential { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.token-details-key { min-width: 0; font-family: var(--font-mono); font-size: var(--fs-13); overflow-wrap: anywhere; }
.token-details-hint, .token-details-expiry-hint { font-size: var(--fs-12); }
.token-details-permissions { display: flex; flex-direction: column; flex: 1; min-height: 15rem; min-width: 0; }
.token-details-section-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-1) var(--space-3); margin-bottom: var(--space-3); }
.token-details-section-heading h3 { margin: 0; color: var(--text-color); font-size: var(--fs-14); font-weight: 600; }
.token-details-permission-mode { font-size: var(--fs-12); font-weight: 400; }
.token-details-edit { min-width: 5rem; }
</style>
