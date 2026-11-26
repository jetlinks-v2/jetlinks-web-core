<template>
  <a-modal
    :open="visible" :title="dialogTitle" :width="mode === 'regenerate' ? 520 : 720" centered
    :body-style="{ maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }"
    :mask-closable="!loading"
    :footer="mode === 'view' ? null : undefined"
    @cancel="handleCancel" @ok="handleOk(mode !== 'edit')"
  >
    <template v-if="mode !== 'view'" #footer>
      <div class="token-dialog-actions">
        <a-button :disabled="loading" @click="handleCancel">{{ $t('PersonalToken.TokenDialog.168178-0') }}</a-button>
          <a-button type="primary" :disabled="!canSubmit || loading" :loading="loading" @click="handleOk(mode !== 'edit')">
            {{ $t(mode === 'add' ? 'PersonalToken.dialog.create' : mode === 'regenerate' ? 'PersonalToken.prototype.regenerate' : 'PersonalToken.TokenDialog.168178-2') }}
          </a-button>
      </div>
    </template>
    <a-alert v-if="mode === 'regenerate'" type="warning" show-icon :message="$t('PersonalToken.prototype.regenerateWarning')" class="token-dialog-warning" />
    <a-form ref="formRef" :model="formData" :rules="rules" layout="vertical" class="token-dialog-form">
      <a-descriptions v-if="mode === 'view' && token" :column="1" size="small">
        <a-descriptions-item :label="$t('PersonalToken.TokenDialog.168178-7')">{{ token.name }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-0')">{{ token.sourceTypeName || token.sourceType }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-1')">{{ token.creatorName }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalCenter.createdAt')">{{ tokenDate(token.createTime) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-3')">{{ isUnlimitedExpiry(token.expires) ? $t('PersonalToken.TokenCard.515931-4') : tokenDate(token.expires) }}</a-descriptions-item>
        <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-5')">{{ token.description || $t('PersonalToken.details.emptyDescription') }}</a-descriptions-item>
      </a-descriptions>
      <template v-else>
        <a-form-item v-if="mode !== 'regenerate'" :label="$t('PersonalToken.TokenDialog.168178-7')" name="name" :extra="$t('PersonalToken.prototype.nameHelp')" :validate-status="nameDuplicate ? 'error' : undefined" :help="nameDuplicate ? $t('PersonalToken.prototype.nameDuplicate', { name: formData.name.trim() }) : undefined">
          <a-input v-model:value="formData.name" :placeholder="$t('PersonalToken.prototype.namePlaceholder')" :maxlength="32" :disabled="loading" />
        </a-form-item>
        <a-form-item v-if="mode !== 'regenerate'" :label="$t('PersonalToken.TokenDialog.168178-18')" name="description" :extra="$t('PersonalToken.prototype.descriptionHelp')">
          <a-input v-model:value="formData.description" :placeholder="$t('PersonalToken.prototype.descriptionPlaceholder')" :maxlength="100" :disabled="loading" />
        </a-form-item>
        <a-form-item v-if="mode === 'add' || mode === 'regenerate'" :label="$t('PersonalToken.dialog.validity')">
          <a-select v-model:value="expireType" :placeholder="$t('PersonalToken.TokenDialog.168178-10')" :disabled="loading" @change="handleExpireTypeChange">
            <a-select-option :value="30">{{ $t('PersonalToken.TokenDialog.168178-12') }}</a-select-option>
            <a-select-option :value="90">{{ $t('PersonalToken.TokenDialog.168178-14') }}</a-select-option>
            <a-select-option :value="180">{{ $t('PersonalToken.prototype.days180') }}</a-select-option>
            <a-select-option value="custom">{{ $t('PersonalToken.TokenDialog.168178-15') }}</a-select-option>
            <a-select-option :value="-1">{{ $t('PersonalToken.TokenDialog.168178-16') }}</a-select-option>
          </a-select>
          <template #extra>
            <a-typography-text v-if="expireType === -1" type="warning">{{ $t('PersonalToken.prototype.neverHelp') }}</a-typography-text>
            <span v-else-if="expireType === 'custom' && !customExpires">{{ $t('PersonalToken.TokenDialog.customExpiryHelp') }}</span>
            <span v-else>{{ $t('PersonalToken.prototype.expiryHelp', { date: tokenDate(formData.expires, expireType === 'custom' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD') }) }}</span>
          </template>
        </a-form-item>
        <a-form-item v-if="(mode === 'add' || mode === 'regenerate') && expireType === 'custom'" :label="$t('PersonalToken.TokenDialog.168178-15')" name="expires">
          <a-date-picker
            :value="customExpires" @change="handleCustomExpireChange" show-time value-format="x"
            :placeholder="$t('PersonalToken.TokenDialog.168178-17')" class="token-dialog-date"
            :disabled-date="disabledDate" :disabled-time="disabledTime" :disabled="loading"
          />
        </a-form-item>
        <a-form-item v-if="mode === 'edit'" :label="$t('PersonalToken.TokenCard.515931-3')" :extra="$t('PersonalToken.prototype.editExpiryHelp')">
          {{ isUnlimitedExpiry(formData.expires) ? $t('PersonalToken.TokenCard.515931-4') : tokenDate(formData.expires, 'YYYY-MM-DD') }}
        </a-form-item>
      </template>
      <section v-if="mode !== 'regenerate'" class="token-dialog-permissions">
        <h3>{{ $t('PersonalCenter.permissions') }}</h3>
        <PermissionSelector v-model:value="formData.scope" :disabled="mode === 'view'" :busy="loading" @ready-change="permissionsReady = $event" />
      </section>
    </a-form>
    <Success v-if="showSuccessModal" :token="generatedToken" :name="formData.name" :regenerated="mode === 'regenerate'" @close="handleSuccessClose" />
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import PermissionSelector from './PermissionSelector.vue'
import Success from './Success.vue'
import { useTokenDialog } from './useTokenDialog'
import { tokenDate, isUnlimitedExpiry } from '../tokenPresentation'
import type { TokenDialogProps, PersonalToken } from '../types'

const props = defineProps({
  visible: { type: Boolean, default: false },
  mode: { type: String as PropType<TokenDialogProps['mode']>, default: 'add', validator: (value: string) => ['add', 'edit', 'view', 'regenerate'].includes(value) },
  token: { type: Object as PropType<PersonalToken | null>, default: () => null },
  existingNames: { type: Array as PropType<string[]>, default: () => [] },
})
const emit = defineEmits(['close', 'save'])
const {
  canSubmit, nameDuplicate, permissionsReady, customExpires, dialogTitle, disabledDate, disabledTime, expireType,
  formData, formRef, generatedToken, handleCancel, handleCustomExpireChange,
  handleExpireTypeChange, handleOk, handleSuccessClose, loading, rules,
  showSuccessModal, visible,
} = useTokenDialog(props, emit)
</script>

<style lang="less" scoped>
.token-dialog-form { min-width: 0; }
.token-dialog-warning { margin-bottom: var(--space-4); }
.token-dialog-form :deep(.ant-form-item) { margin-bottom: var(--space-4); }
.token-dialog-date { width: 100%; }
.token-dialog-permissions { border-top: 1px solid var(--line); padding-top: var(--space-4); margin-top: var(--space-2); }
.token-dialog-permissions h3 { margin: 0 0 var(--space-3); color: var(--text-color); font-size: var(--fs-14); font-weight: 600; }
.token-dialog-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); width: 100%; }
.token-dialog-actions :deep(.ant-btn) { min-width: 5rem; }
.token-dialog-actions :deep(.ant-btn + .ant-btn) { margin-inline-start: 0; }
</style>
