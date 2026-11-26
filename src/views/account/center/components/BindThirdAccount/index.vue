<script setup lang="ts">
import { computed } from 'vue'
import SsoAuthorization from './SsoAuthorization.vue'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import { useSsoBindings } from './useSsoBindings'
import { useBasicLayoutVariant } from '@jetlinks-web-core/layout/hooks/useBasicLayoutVariant'
const { t } = useI18n()
const layoutVariant = useBasicLayoutVariant()
const isOperations = computed(() => layoutVariant.value === 'tenant')
const { bindings, loading, failed, unbinding, icons, load, canBindSso, bind, unbind, binding, authorizationUrl, bindingState, closeBinding } = useSsoBindings()
const columns = computed(() => [
  { key: 'entry', title: t('PersonalCenter.loginEntry'), width: '40%' },
  { key: 'binding', title: t('PersonalCenter.bindingState') },
  { key: 'action', title: t('PersonalCenter.action'), width: 100, align: 'right' as const },
])
</script>

<template>
  <div class="sso-bindings">
    <a-alert v-if="failed" type="error" show-icon :message="$t('PersonalCenter.bindingFailed')">
      <template #action><a-button type="link" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <p class="sso-bindings__hint">{{ $t(isOperations ? 'PersonalCenter.ssoHintOperations' : 'PersonalCenter.ssoHint') }}</p>
    <a-table :columns="columns" :data-source="bindings" :loading="loading" :pagination="false" :row-key="item => item.id + ':' + (item.applicationUserId || '')" :scroll="{ x: 600 }">
      <template #emptyText><CloudEmpty v-if="!failed" :description="$t(isOperations ? 'PersonalCenter.noSsoBindingsOperations' : 'PersonalCenter.noSsoBindings')" /><span v-else>—</span></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'entry'">
          <a-space>
            <a-avatar shape="square" :size="32" :src="record.logoUrl || icons[record.provider]">{{ record.name?.slice(0, 1) }}</a-avatar>
            <span>{{ record.name }}</span>
          </a-space>
        </template>
        <template v-else-if="column.key === 'binding'">
          <a-badge :status="record.bound ? 'success' : 'default'" :text="$t(record.bound ? 'BindThirdAccount.index.483756-0' : 'BindThirdAccount.index.483756-1')" />
          <div v-if="record.bound && (record.others?.name || record.bindTime)" class="sso-bindings__detail">
            <span v-if="record.others?.name">{{ record.others.name }} · </span>
            <span v-if="record.bindTime">{{ $t('PersonalCenter.boundAt', { time: dayjs(record.bindTime).format('YYYY-MM-DD') }) }}</span>
          </div>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-popconfirm v-if="record.bound" :title="$t('BindThirdAccount.index.483756-3')" @confirm="unbind(record.id)">
            <a-button size="small" :disabled="!!unbinding" :loading="unbinding === record.id">{{ $t('BindThirdAccount.index.483756-4') }}</a-button>
          </a-popconfirm>
          <a-tooltip v-else-if="!canBindSso(record)" :title="$t('PersonalCenter.bindingUnsupported')">
            <span><a-button type="link" disabled>{{ $t('BindThirdAccount.index.483756-5') }}</a-button></span>
          </a-tooltip>
          <a-button v-else type="link" @click="bind(record)">{{ $t('BindThirdAccount.index.483756-5') }}</a-button>
        </template>
      </template>
    </a-table>
    <SsoAuthorization :binding="binding" :state="bindingState" :url="authorizationUrl" @close="closeBinding" @retry="binding && bind(binding)" />
  </div>
</template>

<style scoped>
.sso-bindings { display: flex; flex-direction: column; gap: var(--space-4); }
.sso-bindings__hint { margin: 0; color: var(--text-color-secondary); font-size: var(--fs-12); line-height: 1.5; }
.sso-bindings__detail { margin-top: var(--space-1); color: var(--text-color-secondary); font-size: var(--fs-12); }
</style>
