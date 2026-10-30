<script setup lang="ts">
import { computed } from 'vue'
import { QRCode } from 'ant-design-vue'
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
    <a-modal :open="!!binding" :title="binding?.name" :width="440" :footer="null" destroy-on-close @cancel="closeBinding">
      <div v-if="binding" class="sso-bindings__authorization">
        <a-spin v-if="bindingState === 'loading' || bindingState === 'checking'" />
        <template v-else-if="bindingState === 'active'">
          <QRCode v-if="binding.provider === 'wechat-official-account'" :value="authorizationUrl" :size="240" />
          <iframe v-else :src="authorizationUrl" :title="binding.name" />
        </template>
        <template v-else>
          <a-alert type="warning" show-icon :message="$t('PersonalCenter.bindingRetry')" />
          <a-button @click="bind(binding)">{{ $t('AccountCenter.retry') }}</a-button>
        </template>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.sso-bindings { display: flex; flex-direction: column; gap: var(--space-4); }
.sso-bindings__hint { margin: 0; color: var(--text-color-secondary); font-size: var(--fs-12); line-height: 1.5; }
.sso-bindings__detail { margin-top: var(--space-1); color: var(--text-color-secondary); font-size: var(--fs-12); }
.sso-bindings__authorization { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 16rem; gap: var(--space-4); }
.sso-bindings__authorization iframe { width: 100%; height: 26rem; border: 0; }
</style>
