<template>
  <div class="token-card">
    <div class="token-card-left">
      <div class="token-icon">
        <img src="@jetlinks-web-core/assets/personal-token/img.png" alt=""/>
      </div>
      <div class="token-card-info">
        <div class="token-card-header">
          <div class="token-name">{{ token.name }}</div>
          <div :class="['status-tag', getStatusConfig(token).className]">
            {{ getStatusConfig(token).text }}
          </div>
        </div>
        <div class="token-card-content">
          <div class="token-field">
            <div class="field-label">{{ $t('PersonalToken.TokenCard.515931-0') }}</div>
            <div class="field-value">{{ token.sourceTypeName || token.sourceType }}</div>
          </div>

          <div class="token-field">
            <div class="field-label">{{ $t('PersonalToken.TokenCard.515931-1') }}</div>
            <div class="field-value">{{ token.creatorName }}</div>
          </div>

          <div class="token-field">
            <div class="field-label">{{ $t('PersonalToken.TokenCard.515931-2') }}</div>
            <div class="field-value"><j-ellipsis>{{ formatDate(token.createTime) }}</j-ellipsis></div>
          </div>

          <div class="token-field">
            <div class="field-label">{{ $t('PersonalToken.TokenCard.515931-3') }}</div>
            <div class="field-value">
              <j-ellipsis>{{ token.expires !== -1 ? formatDate(token.expires) : $t('PersonalToken.TokenCard.515931-4') }}</j-ellipsis>
            </div>
          </div>

          <div class="token-field">
            <div class="field-label">{{ $t('PersonalToken.TokenCard.515931-5') }}</div>
            <div class="field-value">
              <j-ellipsis>
                {{ token.description || '--' }}
              </j-ellipsis>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="token-card-actions">
      <a-space>
        <a-button @click="emit('view', token)" type="link">
          <template #icon>
            <AIcon type="EyeOutlined"/>
          </template>
          {{ $t('PersonalToken.TokenCard.515931-6') }}
        </a-button>

        <a-button
            @click="emit('edit', token)"
            type="link"
        >
          <template #icon>
            <AIcon type="EditOutlined"/>
          </template>
          {{ $t('PersonalToken.TokenCard.515931-7') }}
        </a-button>

        <j-permission-button
            danger
            :popConfirm="{
              title: $t('PersonalToken.TokenCard.515931-8'),
              onConfirm: () => {
                emit('delete', token)
              }
            }"
        >
          <template #icon>
            <AIcon type="DeleteOutlined"/>
          </template>
          {{ $t('PersonalToken.TokenCard.515931-9') }}
        </j-permission-button>
      </a-space>
    </div>
  </div>
</template>

<script setup>
import dayjs from 'dayjs'
import {useI18n} from 'vue-i18n'

const {t: $t} = useI18n()
const props = defineProps({
  token: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['view', 'edit', 'delete'])

const getStatusConfig = (token) => {
  if (token.status === 'disabled') {
    return {
      className: 'status-tag--error',
      text: $t('PersonalToken.TokenCard.515931-10'),
      icon: 'StopOutlined'
    }
  }
  if (token.expires === -1) {
    return {
      className: 'status-tag--success',
      text: $t('PersonalToken.TokenCard.515931-4'),
      icon: 'CheckCircleOutlined'
    }
  }

  const now = dayjs()
  const expireTime = token.expires ? dayjs(token.expires) : null

  if (expireTime.isBefore(now)) {
    return {
      className: 'status-tag--error',
      text: $t('PersonalToken.TokenCard.515931-15'),
      icon: 'ExclamationCircleOutlined'
    }
  }

  const diffDays = expireTime.diff(now, 'day')
  const diffHours = expireTime.diff(now, 'hour', true)

  if (diffDays >= 1) {
    return {
      className: 'status-tag--secondary',
      text: $t('PersonalToken.TokenCard.515931-13', [diffDays]),
      icon: 'ClockCircleOutlined'
    }
  } else {
    const _diffHours = diffHours > 1 ? diffHours.toFixed(0) : diffHours.toFixed(2)
    return {
      className: 'status-tag--primary',
      text: $t('PersonalToken.TokenCard.515931-14', [_diffHours]),
      icon: 'ClockCircleOutlined'
    }
  }
}

const formatDate = (dateStr) => {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
}
</script>

<style lang="less" scoped>
.token-card {
  border: 1px solid var(--jet-theme-border-secondary);
  padding: var(--space-4);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-6);

  &-left {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: var(--space-4);
    align-items: center;

    .token-icon {
      width: 3rem;
      height: 3rem;
      border-radius: var(--r-2);
      background: var(--jet-theme-primary-soft);
      display: flex;
      font-size: var(--fs-20);
      align-items: center;
      justify-content: center;
      color: var(--jet-theme-primary);
      flex-shrink: 0;
    }

    .token-card-info {
      flex: 1;
      min-width: 0;

      .token-card-header {
        display: flex;
        gap: var(--space-4);
        margin-bottom: var(--space-4);

        .token-name {
          font-size: var(--fs-16);
          font-weight: 500;
        }
      }
    }

    .token-card-content {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: var(--space-4);

      .token-field {
        .field-label {
          color: var(--jet-theme-text-secondary);
          margin-bottom: var(--space-2);
        }

        .field-value {
          color: var(--ink-1);
        }
      }
    }
  }
}

.status-tag {
  &--primary {
    color: var(--jet-theme-primary);
  }

  &--success {
    color: var(--jet-theme-success);
  }

  &--error {
    color: var(--jet-theme-error);
  }

  &--secondary {
    color: var(--jet-theme-text-secondary);
  }
}

.token-card-actions {
  .ant-btn {
    background-color: var(--line-strong) !important;
    border: none;
  }
}</style>
