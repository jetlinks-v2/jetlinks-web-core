<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSecuritySettings } from './useSecuritySettings'
const { t } = useI18n()
const { records, passwordChangedAt, loading, recordsFailed, passwordFailed, load, formatTime, resultOf } = useSecuritySettings()
defineEmits<{ (event: 'password'): void }>()
const columns = computed(() => [
  { key: 'time', title: t('PersonalCenter.loginTime'), width: 200 },
  { key: 'method', title: t('PersonalCenter.loginMethod'), width: 140 },
  { key: 'ip', title: 'IP', dataIndex: 'ip', width: 180 },
  { key: 'region', title: t('PersonalCenter.loginRegion'), dataIndex: 'ipRegion', width: 180 },
  { key: 'result', title: t('PersonalCenter.loginResult'), width: 140 },
])
</script>

<template>
  <div class="account-security">
    <section class="account-security__password">
      <div>
        <h3>{{ $t('PersonalCenter.loginPassword') }}</h3>
        <p>
          <span v-if="passwordChangedAt">{{ $t('PersonalCenter.passwordChangedAt', { time: passwordChangedAt }) }} · </span>
          {{ $t('PersonalCenter.passwordHint') }}
        </p>
      </div>
      <a-button type="default" aria-haspopup="dialog" @click="$emit('password')">
        <template #icon><AIcon type="EditOutlined" /></template>
        {{ $t('AccountInfo.editPassword') }}
      </a-button>
    </section>
    <section class="account-security__history">
      <div class="account-security__history-header">
        <div class="account-security__history-title">
          <h3>{{ $t('PersonalCenter.loginRecords') }}</h3>
          <span>{{ $t('PersonalCenter.loginRecordsScope') }}</span>
        </div>
        <span class="account-security__notice">{{ $t('PersonalCenter.unrecognizedLogin') }}</span>
      </div>
      <a-alert v-if="recordsFailed || passwordFailed" type="warning" show-icon :message="$t('PersonalCenter.securityLoadFailed')">
        <template #action><a-button type="link" :disabled="loading" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
      </a-alert>
      <a-table :columns="columns" :data-source="records" :loading="loading" :pagination="false" row-key="id" :scroll="{ x: 840 }">
        <template #emptyText><CloudEmpty v-if="!recordsFailed" /><span v-else>—</span></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'time'">{{ formatTime(record.createTime) }}</template>
          <template v-else-if="column.key === 'method'">{{ $t('PersonalCenter.accountLoginMethod') }}</template>
          <template v-else-if="column.key === 'ip'">{{ record.ip || '—' }}</template>
          <template v-else-if="column.key === 'region'">{{ record.ipRegion || '—' }}</template>
          <template v-else-if="column.key === 'result'">
            <a-badge v-if="resultOf(record) !== 'unknown'" :status="resultOf(record) === 'success' ? 'success' : 'error'" :text="$t(resultOf(record) === 'success' ? 'PersonalCenter.loginSucceeded' : 'PersonalCenter.loginFailed')" />
            <span v-else>—</span>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<style scoped>
.account-security { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.account-security__password { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--line); }
h3 { margin: 0; color: var(--text-color); font-size: var(--fs-14); font-weight: 600; }
p { margin: var(--space-2) 0 0; color: var(--text-color-secondary); font-size: var(--fs-12); }
.account-security__history { min-width: 0; display: flex; flex-direction: column; gap: var(--space-4); }
.account-security__history-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-2); }
.account-security__history-title { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.account-security__history-title > span, .account-security__notice { color: var(--text-color-secondary); font-size: var(--fs-12); }
</style>
