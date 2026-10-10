<template>
  <a-modal
    :open="visible"
    :title="dialogTitle"
    :width="1000"
    :footer="mode === 'view' ? null : undefined"
    @cancel="handleCancel"
    @ok="handleOk()"
  >
    <template
      v-if="mode !== 'view'"
      #footer
    >
      <a-space wrap class="token-dialog__actions">
        <a-button :disabled="loading" @click="handleCancel">{{ $t('PersonalToken.TokenDialog.168178-0') }}</a-button>
        <a-tooltip v-if="mode === 'edit'" :title="$t('PersonalToken.TokenDialog.keepDescription')">
          <a-button :disabled="!canSubmit || loading" :loading="loading && !savingWithRefresh" @click="handleOk(false)">
            {{ $t('PersonalToken.TokenDialog.saveWithoutRefresh') }}
          </a-button>
        </a-tooltip>
        <a-tooltip :title="mode === 'edit' ? $t('PersonalToken.TokenDialog.refreshDescription') : undefined">
          <a-button
            type="primary"
            :disabled="!canSubmit || loading"
            @click="handleOk(true)"
            :loading="loading && savingWithRefresh"
          >
            {{ mode === 'add' ? $t('PersonalToken.TokenDialog.168178-1') : $t('PersonalToken.TokenDialog.saveWithRefresh') }}
          </a-button>
        </a-tooltip>
      </a-space>
    </template>
    <a-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      layout="vertical"
    >
      <div class="form-layout">
        <div class="form-left">
          <a-descriptions
            v-if="mode === 'view' && token"
            :column="1"
          >
            <a-descriptions-item :label="$t('PersonalToken.TokenDialog.168178-7')">
              {{ token.name }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-0')">
              {{ token.sourceTypeName || token.sourceType }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-1')">
              {{ token.creatorName }}
            </a-descriptions-item>
            <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-2')">
              <span v-time-format="'YYYY-MM-DD HH:mm:ss'">{{ token.createTime }}</span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-3')">
              <span v-if="token.expires === -1">{{ $t('PersonalToken.TokenCard.515931-4') }}</span>
              <span
                v-else
                v-time-format="'YYYY-MM-DD HH:mm:ss'"
              >
                {{ token.expires }}
              </span>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-5')">
              {{ token.description || '--' }}
            </a-descriptions-item>
          </a-descriptions>
          <div
            v-else
            class="form-section"
          >
            <a-form-item
              :label="$t('PersonalToken.TokenDialog.168178-7')"
              name="name"
            >
              <a-input
                v-model:value="formData.name"
                :placeholder="$t('PersonalToken.TokenDialog.168178-8')"
                :maxlength="64"
                show-count
              />
            </a-form-item>

            <a-form-item :label="$t('PersonalToken.TokenDialog.168178-9')">
              <a-select
                v-model:value="expireType"
                :placeholder="$t('PersonalToken.TokenDialog.168178-10')"
                @change="handleExpireTypeChange"
              >
                <a-select-option :value="7">{{ $t('PersonalToken.TokenDialog.168178-11') }}</a-select-option>
                <a-select-option :value="30">{{ $t('PersonalToken.TokenDialog.168178-12') }}</a-select-option>
                <a-select-option :value="60">{{ $t('PersonalToken.TokenDialog.168178-13') }}</a-select-option>
                <a-select-option :value="90">{{ $t('PersonalToken.TokenDialog.168178-14') }}</a-select-option>
                <a-select-option value="custom">{{ $t('PersonalToken.TokenDialog.168178-15') }}</a-select-option>
                <a-select-option :value="-1">{{ $t('PersonalToken.TokenDialog.168178-16') }}</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item
              v-if="expireType === 'custom'"
              :label="$t('PersonalToken.TokenDialog.168178-15')"
              name="expires"
            >
              <a-date-picker
                :value="customExpires"
                @change="handleCustomExpireChange"
                show-time
                valueFormat="x"
                :placeholder="$t('PersonalToken.TokenDialog.168178-17')"
                style="width: 100%"
                :disabled-date="disabledDate"
                :disabled-time="disabledTime"
              />
            </a-form-item>

            <a-form-item
              :label="$t('PersonalToken.TokenDialog.168178-18')"
              name="description"
            >
              <a-textarea
                v-model:value="formData.description"
                :placeholder="$t('PersonalToken.TokenDialog.168178-19')"
                :maxlength="200"
                :rows="3"
                show-count
              />
            </a-form-item>
          </div>
        </div>

        <div class="form-right">
          <div class="form-section">
            <h5 class="section-title">{{ $t('PersonalToken.TokenDialog.168178-20') }}</h5>
            <PermissionSelector
              v-model:value="formData.scope.permissions"
              :disabled="mode === 'view'"
            />
          </div>
        </div>
      </div>
    </a-form>

    <!-- Success 弹窗 -->
    <Success
      v-if="showSuccessModal"
      :token="generatedToken"
      @close="handleSuccessClose"
    />
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import PermissionSelector from './PermissionSelector.vue'
import Success from './Success.vue'
import { useTokenDialog } from './useTokenDialog'
import type { TokenDialogProps, PersonalToken } from '../types'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  mode: {
    type: String as PropType<TokenDialogProps['mode']>,
    default: 'add',
    validator: (value: string) => ['add', 'edit', 'view'].includes(value),
  },
  token: {
    type: Object as PropType<PersonalToken | null>,
    default: () => null,
  },
})

const emit = defineEmits(['close', 'save'])

const {
  canSubmit,
  customExpires,
  dialogTitle,
  disabledDate,
  disabledTime,
  expireType,
  formData,
  formRef,
  generatedToken,
  handleCancel,
  handleCustomExpireChange,
  handleExpireTypeChange,
  handleOk,
  handleSuccessClose,
  loading,
  rules,
  savingWithRefresh,
  showSuccessModal,
  visible,
} = useTokenDialog(props, emit)

</script>

<style lang="less" scoped>
.token-dialog__actions {
  max-width: 100%;
  justify-content: flex-end;
}

.form-layout {
  display: flex;
  width: 100%;

  .form-left {
    width: 45%;
    padding-right: var(--space-3);
  }

  .form-right {
    width: 55%;
    padding-left: var(--space-3);
  }
}

.form-section {
  margin-bottom: var(--space-6);

  &:last-child { margin-bottom: 0; }

  .section-title {
    margin: 0 0 var(--space-4);
    padding-bottom: var(--space-2);
    color: var(--ink-1);
    font-size: var(--fs-16);
    font-weight: 500;
  }
}

@media (max-width: 48rem) {
  .form-layout {
    flex-direction: column;
    gap: var(--space-4);

    .form-left, .form-right {
      width: 100%;
      padding: 0;
    }
  }
}
</style>
