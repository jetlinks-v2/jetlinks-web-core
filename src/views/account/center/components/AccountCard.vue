<script setup lang="ts">
import type { PropType } from 'vue'
import { EditOutlined, UserOutlined } from '@ant-design/icons-vue'
import type { AccountCardProfile, AccountEditTarget } from '../types'

defineProps({
  profile: { type: Object as PropType<AccountCardProfile>, required: true },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (event: 'edit', target?: AccountEditTarget): void
  (event: 'password'): void
  (event: 'retry'): void
}>()
</script>

<template>
  <section class="account-card">
    <header class="account-card__header">
      <h2 class="account-card__title">{{ $t('center.data.accountInfo') }}</h2>
      <a-button v-if="profile.canEdit" type="link" size="small" @click="emit('edit')">
        {{ $t('EditInfo.index.557023-0') }}
      </a-button>
    </header>
    <div class="account-card__body">
      <a-spin :spinning="loading">
        <div class="account-card__profile">
          <a-avatar :src="profile.avatar" :size="56">
            <template #icon><UserOutlined /></template>
          </a-avatar>
          <div class="account-card__name">
            <h2 :title="profile.name">{{ profile.name }}</h2>
            <span :title="profile.username">{{ profile.username }}</span>
          </div>
        </div>
        <a-alert v-if="error" type="warning" show-icon :message="$t('AccountCenter.loadError')">
          <template #action>
            <a-button type="link" size="small" @click="emit('retry')">{{ $t('AccountCenter.retry') }}</a-button>
          </template>
        </a-alert>
        <dl class="account-card__list">
          <div v-for="item in profile.items" :key="item.key" class="account-card__item">
            <dt>{{ item.label }}</dt>
            <dd>
              <span :title="item.value">{{ item.value }}</span>
              <a-tooltip v-if="item.editTarget && profile.canEdit" :title="$t('EditInfo.index.557023-0')">
                <a-button
                  type="link"
                  size="small"
                  class="account-card__edit"
                  :aria-label="$t('AccountCenter.editField', { field: item.label })"
                  @click="emit('edit', item.editTarget)"
                ><EditOutlined /></a-button>
              </a-tooltip>
            </dd>
          </div>
        </dl>
        <template v-if="profile.thirdAccounts.length">
          <div class="account-card__section-title">
            <span>{{ $t('AccountInfo.thirdSection') }}</span>
            <a-button type="link" size="small" @click="emit('edit')">{{ $t('AccountCenter.manageBindings') }}</a-button>
          </div>
          <dl class="account-card__list">
            <div v-for="item in profile.thirdAccounts" :key="item.key" class="account-card__item">
              <dt :title="item.label">{{ item.label }}</dt>
              <dd><span>{{ item.value }}</span></dd>
            </div>
          </dl>
        </template>
      </a-spin>
    </div>
    <footer class="account-card__actions">
      <a-button block @click="emit('password')">{{ $t('AccountInfo.editPassword') }}</a-button>
    </footer>
  </section>
</template>

<style scoped lang="less">
.account-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    flex-shrink: 0;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  &__title {
    margin: 0;
    color: var(--ink-1);
    font-size: var(--fs-18);
    font-weight: 600;
    line-height: var(--lh-snug);
  }

  &__body {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  &__profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0 var(--space-6);
    border-bottom: 1px solid var(--line);
  }

  &__name {
    min-width: 0;
    max-width: 100%;
    text-align: center;

    h2, span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    h2 {
      margin: 0;
      color: var(--ink-1);
      font-size: var(--fs-18);
      font-weight: 600;
    }

    span {
      margin-top: var(--space-1);
      color: var(--ink-3);
      font-size: var(--fs-14);
    }
  }

  &__list { margin: 0 0 var(--space-4); }

  &__item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--line);
    font-size: var(--fs-14);

    dt {
      flex: 0 1 auto;
      min-width: 0;
      max-width: 45%;
      color: var(--ink-2);
      overflow-wrap: anywhere;
    }

    dd {
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      gap: var(--space-1);
      min-width: 0;
      margin: 0;
      color: var(--ink-1);
      text-align: right;
      overflow-wrap: anywhere;
    }

    dd > span { min-width: 0; }
  }

  &__edit {
    flex-shrink: 0;
    padding: 0;
    height: auto;
  }

  &__section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--fs-16);
    color: var(--ink-1);
  }

  &__actions {
    flex-shrink: 0;
    padding-top: var(--space-4);
  }
}
</style>
