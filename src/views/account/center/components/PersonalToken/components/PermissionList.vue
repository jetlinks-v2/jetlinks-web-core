<template>
  <div class="permission-choose-container">
    <div class="detail-controls">
      <a-input-search
          v-model:value="searchKeyword"
          allowClear
          :disabled="loading"
          :placeholder="$t('PersonalToken.PermissionList.061384-2')"
          @search="onSearch"
          style="width: 100%"
      />
    </div>
    <a-alert v-if="loadError" type="error" show-icon :message="$t('PersonalToken.PermissionList.loadFailed')">
      <template #action>
        <a-button type="link" :disabled="loading" @click="onSearch(searchKeyword)">{{ $t('AccountCenter.retry') }}</a-button>
      </template>
    </a-alert>
    <a-table
        :columns="columns"
        :data-source="list"
        :pagination="false"
        :loading="loading"
        row-key="id"
        :scroll="{y: 300}"
    >
      <template #headerCell="{ column }">
        <template v-if="column.key === 'actions'">
          <div class="permission-actions-header">
            <div>{{ $t('PersonalToken.PermissionList.061384-4') }}</div>
            <a-space>
              <span style="font-weight: normal">{{ $t('PersonalToken.PermissionList.061384-5', [selectedCount]) }}</span>
            </a-space>
          </div>
        </template>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span>{{ record.name }}</span>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-space
              wrap
          >
            <a-tag
                v-for="item in record.checkedOptions"
                :key="item.value"
            >
              {{ item.label }}
            </a-tag>
            <span
                v-if="!record.checkedOptions.length"
                class="empty-text"
            >
              --
            </span>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PermissionScope } from './data'
import { useTokenPermissions } from './useTokenPermissions'

const { t: $t } = useI18n()

const props = defineProps({
  value: { type: Array as PropType<PermissionScope[]>, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits<{ (event: 'update:value', value: PermissionScope[]): void }>()
const { searchKeyword, list, loading, loadError, selectedCount, columns, onSearch } = useTokenPermissions(props, emit)
</script>

<style lang="less" scoped>
.permission-choose-container {
  .permission-actions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .detail-controls {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }

  .empty-text {
    color: rgba(0, 0, 0, 0.45);
  }
}
</style>
