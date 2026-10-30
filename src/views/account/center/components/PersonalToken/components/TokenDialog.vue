<template>
  <a-modal
    :open="visible" :title="dialogTitle" :width="720" centered
    :body-style="{ maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }"
    :mask-closable="!loading"
    :footer="mode === 'view' ? null : undefined"
    @cancel="handleCancel" @ok="handleOk()"
  >
    <template v-if="mode !== 'view'" #footer>
      <div class="token-dialog-actions">
        <a-button :disabled="loading" @click="handleCancel">{{ $t('PersonalToken.TokenDialog.168178-0') }}</a-button>
        <a-tooltip v-if="mode === 'edit'" :title="$t('PersonalToken.TokenDialog.keepDescription')">
          <a-button :disabled="!canSubmit || loading" :loading="loading && !savingWithRefresh" @click="handleOk(false)">
            {{ $t('PersonalToken.dialog.saveOnly') }}
          </a-button>
        </a-tooltip>
        <a-tooltip :title="mode === 'edit' ? $t('PersonalToken.TokenDialog.refreshDescription') : undefined">
          <a-button type="primary" :disabled="!canSubmit || loading" :loading="loading && savingWithRefresh" @click="handleOk(true)">
            {{ $t(mode === 'add' ? 'PersonalToken.dialog.create' : 'PersonalToken.dialog.saveAndRefresh') }}
          </a-button>
        </a-tooltip>
      </div>
    </template>
    <a-form ref="formRef" :model="formData" :rules="rules" layout="vertical" class="token-dialog-form">
      <a-descriptions v-if="mode === 'view' && token" :column="1" size="small">
        <a-descriptions-item :label="$t('PersonalToken.TokenDialog.168178-7')">{{ token.name }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-0')">{{ token.sourceTypeName || token.sourceType }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-1')">{{ token.creatorName }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalCenter.createdAt')">{{ tokenDate(token.createTime) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-3')">{{ Number(token.expires) === -1 ? $t('PersonalToken.TokenCard.515931-4') : tokenDate(token.expires) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-5')">{{ token.description || $t('PersonalToken.details.emptyDescription') }}</a-descriptions-item>
      </a-descriptions>
      <template v-else>
        <a-form-item :label="$t('PersonalToken.TokenDialog.168178-7')" name="name">
          <a-input v-model:value="formData.name" :placeholder="$t('PersonalToken.TokenDialog.168178-8')" :maxlength="64" show-count :disabled="loading" />
        </a-form-item>
        <a-form-item :label="$t('PersonalToken.TokenDialog.168178-18')" name="description">
          <a-textarea v-model:value="formData.description" :placeholder="$t('PersonalToken.TokenDialog.168178-19')" :maxlength="200" :auto-size="{ minRows: 2, maxRows: 4 }" show-count :disabled="loading" />
        </a-form-item>
        <a-form-item :label="$t('PersonalToken.dialog.validity')">
          <a-select v-model:value="expireType" :placeholder="$t('PersonalToken.TokenDialog.168178-10')" :disabled="loading" @change="handleExpireTypeChange">
            <a-select-option :value="7">{{ $t('PersonalToken.TokenDialog.168178-11') }}</a-select-option>
            <a-select-option :value="30">{{ $t('PersonalToken.TokenDialog.168178-12') }}</a-select-option>
            <a-select-option :value="60">{{ $t('PersonalToken.TokenDialog.168178-13') }}</a-select-option>
            <a-select-option :value="90">{{ $t('PersonalToken.TokenDialog.168178-14') }}</a-select-option>
            <a-select-option value="custom">{{ $t('PersonalToken.TokenDialog.168178-15') }}</a-select-option>
            <a-select-option :value="-1">{{ $t('PersonalToken.TokenDialog.168178-16') }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item v-if="expireType === 'custom'" :label="$t('PersonalToken.TokenDialog.168178-15')" name="expires">
          <a-date-picker
            :value="customExpires" @change="handleCustomExpireChange" show-time value-format="x"
            :placeholder="$t('PersonalToken.TokenDialog.168178-17')" class="token-dialog-date"
            :disabled-date="disabledDate" :disabled-time="disabledTime" :disabled="loading"
          />
        </a-form-item>
      </template>
      <section class="token-dialog-permissions">
        <h3>{{ $t('PersonalToken.dialog.permissionScope') }}</h3>
        <PermissionSelector v-model:value="formData.scope" :disabled="mode === 'view'" :busy="loading" @ready-change="permissionsReady = $event" />
      </section>
    </a-form>
    <Success v-if="showSuccessModal" :token="generatedToken" @close="handleSuccessClose" />
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import PermissionSelector from './PermissionSelector.vue'
import Success from './Success.vue'
import { useTokenDialog } from './useTokenDialog'
import { tokenDate } from '../tokenPresentation'
import type { TokenDialogProps, PersonalToken } from '../types'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String as PropType<TokenDialogProps['mode']>, default: 'add', validator: (value: string) => ['add', 'edit', 'view'].includes(value) },
  token: { type: Object as PropType<PersonalToken | null>, default: () => null },
})
const emit = defineEmits(['close', 'save'])
const {
  canSubmit, permissionsReady, customExpires, dialogTitle, disabledDate, disabledTime, expireType,
  formData, formRef, generatedToken, handleCancel, handleCustomExpireChange,
  handleExpireTypeChange, handleOk, handleSuccessClose, loading, rules,
  savingWithRefresh, showSuccessModal, visible,
} = useTokenDialog(props, emit)
</script>

<style lang="less" scoped>
.token-dialog-form { min-width: 0; }
.token-dialog-form :deep(.ant-form-item) { margin-bottom: var(--space-4); }
.token-dialog-date { width: 100%; }
.token-dialog-permissions { border-top: 1px solid var(--line); padding-top: var(--space-4); margin-top: var(--space-2); }
.token-dialog-permissions h3 { margin: 0 0 var(--space-3); color: var(--text-color); font-size: var(--fs-14); font-weight: 600; }
.token-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); width: 100%; }
.token-dialog-actions :deep(.ant-btn) { min-width: 5rem; }
.token-dialog-actions :deep(.ant-btn + .ant-btn) { margin-inline-start: 0; }
</style>
