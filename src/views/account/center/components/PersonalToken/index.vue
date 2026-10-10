<template>
  <div class="personal-token">
    <div class="personal-token-header">
      <div style="display: flex; gap: 1.5rem; align-items: center">
        <div>
          <img src="@jetlinks-web-core/assets/personal-token/add.png" alt="" />
        </div>
        <div style="color: #1A1A1A">{{ $t('PersonalToken.index.061384-0') }}</div>
      </div>
      <a-button type="primary" @click="handleAdd">
        {{ $t('PersonalToken.index.061384-1') }}
      </a-button>
    </div>

    <div v-if="loading" class="empty-state"><a-spin /></div>
    <a-alert v-else-if="loadError" type="error" show-icon :message="$t('PersonalToken.index.loadFailed')">
      <template #action>
        <a-button type="link" @click="reload">{{ $t('AccountCenter.retry') }}</a-button>
      </template>
    </a-alert>
    <div v-else-if="tokenList.length === 0" class="empty-state">
      <div class="empty-content">
        <CloudEmpty />
      </div>
    </div>

    <div v-else class="token-list">
      <TokenCard
        v-for="token in tokenList"
        :key="token.id"
        :token="token"
        @view="handleView"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>

    <TokenDialog
      v-if="dialogVisible"
      :visible="dialogVisible"
      :mode="dialogMode"
      :token="selectedToken"
      @save="handleDialogOk"
      @close="dialogVisible = false"
    />


  </div>
</template>

<script setup lang="ts">
import TokenCard from './components/TokenCard.vue'
import TokenDialog from './components/TokenDialog.vue'
import { usePersonalToken } from './usePersonalToken'

const {
  tokenList, dialogVisible, dialogMode, selectedToken, loading, loadError, reload,
  handleAdd, handleView, handleEdit, handleDelete, handleDialogOk,
} = usePersonalToken()
</script>

<style lang="less" scoped>
.personal-token {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
    background-color: #F7F8FA;
    padding: var(--space-3);
    border-radius: var(--r-2);
  }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.token-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  flex: 1;
  overflow-y: auto;
}</style>
