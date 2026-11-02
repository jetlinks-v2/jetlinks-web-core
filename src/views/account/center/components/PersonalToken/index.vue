<script setup lang="ts">
import { computed } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import TokenDialog from './components/TokenDialog.vue'
import TokenDetails from './components/TokenDetails.vue'
import { tokenStatus, tokenDate, permissionCount } from './tokenPresentation'
import { permissionModeLabel, resolvePermissionMode } from './permissionMode'
import { usePersonalToken } from './usePersonalToken'
const { t } = useI18n()
const {
  tokenList, dialogVisible, dialogMode, selectedToken, loading, loadError, reload,
  handleAdd, handleView, handleEdit, handleDelete, handleDialogOk,
} = usePersonalToken()
const [DefineCreateButton, CreateTokenButton] = createReusableTemplate()
const columns = computed(() => [
  { key: 'name', title: t('PersonalCenter.tokenName'), width: 200 },
  { key: 'source', title: t('PersonalToken.TokenCard.515931-0'), width: 150 },
  { key: 'permissions', title: t('PersonalCenter.permissions'), width: 140 },
  { key: 'expires', title: t('PersonalToken.TokenCard.515931-3'), width: 170 },
  { key: 'created', title: t('PersonalCenter.createdAt'), width: 170 },
  { key: 'state', title: t('PersonalCenter.state'), width: 120 },
  { key: 'action', title: t('PersonalCenter.action'), width: 170, fixed: 'right' as const },
])
</script>

<template>
  <DefineCreateButton><a-button type="primary" @click="handleAdd"><template #icon><AIcon type="PlusOutlined" /></template>{{ $t('PersonalToken.empty.create') }}</a-button></DefineCreateButton>
  <div class="personal-token">
    <div class="personal-token__toolbar">
      <span>{{ $t('PersonalCenter.tokenCount', { count: tokenList.length }) }}</span>
      <CreateTokenButton />
    </div>
    <a-alert v-if="loadError" type="error" show-icon :message="$t('PersonalToken.index.loadFailed')">
      <template #action><a-button type="link" @click="reload">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <CloudEmpty v-if="!loading && !loadError && !tokenList.length" class="personal-token__empty" :image-style="{ height: '4rem' }">
      <template #description>
        <strong>{{ $t('PersonalToken.empty.title') }}</strong>
        <p>{{ $t('PersonalToken.empty.description') }}</p>
      </template>
      <CreateTokenButton />
    </CloudEmpty>
    <a-table v-else :columns="columns" :data-source="tokenList" :loading="loading" :pagination="false" row-key="id" :scroll="{ x: 1090 }">
      <template #emptyText><span v-if="loadError">—</span></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div class="personal-token__name">{{ record.name }}</div>
          <div v-if="record.description" class="personal-token__description" :title="record.description">{{ record.description }}</div>
        </template>
        <template v-else-if="column.key === 'source'">{{ record.sourceTypeName || record.sourceType }}</template>
        <template v-else-if="column.key === 'permissions'">
          <div>{{ $t(permissionModeLabel(record.scope)) }}</div>
          <div v-if="resolvePermissionMode(record.scope) !== 'follow'" class="personal-token__description">{{ $t('PersonalCenter.permissionCount', { count: permissionCount(record) }) }}</div>
        </template>
        <template v-else-if="column.key === 'expires'">{{ Number(record.expires) === -1 ? $t('PersonalToken.TokenCard.515931-4') : tokenDate(record.expires) }}</template>
        <template v-else-if="column.key === 'created'">{{ tokenDate(record.createTime) }}</template>
        <template v-else-if="column.key === 'state'"><a-tag :color="tokenStatus(record).color">{{ $t(tokenStatus(record).key) }}</a-tag></template>
        <template v-else-if="column.key === 'action'">
          <a-space :size="0">
            <a-button type="link" size="small" @click="handleView(record)">{{ $t('PersonalCenter.details') }}</a-button>
            <a-button type="link" size="small" @click="handleEdit(record)">{{ $t('PersonalCenter.edit') }}</a-button>
            <a-popconfirm :title="$t('PersonalToken.TokenCard.515931-8')" @confirm="handleDelete(record)">
              <a-button type="link" danger size="small">{{ $t('PersonalToken.TokenCard.515931-9') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
    <TokenDetails v-if="dialogVisible && dialogMode === 'view' && selectedToken" :token="selectedToken" @close="dialogVisible = false" @edit="handleEdit" />
    <TokenDialog v-else-if="dialogVisible" :visible="dialogVisible" :mode="dialogMode" :token="selectedToken" @save="handleDialogOk" @close="dialogVisible = false" />
  </div>
</template>

<style scoped>
.personal-token { display: flex; flex-direction: column; min-width: 0; gap: var(--space-4); }
.personal-token__toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); color: var(--text-color-secondary); }
.personal-token__empty { padding: var(--space-6) 0; }
.personal-token__empty strong { display: block; color: var(--text-color); font-size: var(--fs-14); }
.personal-token__empty p { max-width: 34rem; margin: var(--space-2) auto var(--space-4); color: var(--text-color-secondary); font-size: var(--fs-13); line-height: 1.7; }
.personal-token__name { font-weight: 500; overflow-wrap: anywhere; }
.personal-token__description { color: var(--text-color-secondary); font-size: var(--fs-12); margin-top: var(--space-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 12rem; }
</style>
