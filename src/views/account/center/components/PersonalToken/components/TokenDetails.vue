<script setup lang="ts">
import { computed, type PropType } from 'vue'
import JlDrawerShell from '@jetlinks-web-core/components/JlDrawerShell/index.vue'
import PermissionList from './PermissionList.vue'
import { tokenDate, tokenStatus } from '../tokenPresentation'
import { copyTokenScope, permissionModeLabel } from '../permissionMode'
import type { PersonalToken } from '../types'
const props = defineProps({ token: { type: Object as PropType<PersonalToken>, required: true } })
defineEmits<{ (event: 'close'): void; (event: 'edit', token: PersonalToken): void }>()
const status = computed(() => tokenStatus(props.token))
const scope = computed(() => copyTokenScope(props.token.scope))
</script>

<template>
  <JlDrawerShell open :title="token.name" :width="640" @update:open="!$event && $emit('close')">
    <template #head>
      <div class="token-details-heading">
        <b class="token-details-name" :title="token.name">{{ token.name }}</b>
        <a-badge :status="status.color" :text="$t(status.key)" />
      </div>
    </template>
    <a-descriptions :column="1" size="small" class="token-details-metadata">
      <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-5')">{{ token.description || $t('PersonalToken.details.emptyDescription') }}</a-descriptions-item>
      <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-0')">{{ token.sourceTypeName || token.sourceType }}</a-descriptions-item>
      <a-descriptions-item :label="$t('PersonalToken.TokenCard.515931-3')">{{ Number(token.expires) === -1 ? $t('PersonalToken.TokenCard.515931-4') : tokenDate(token.expires) }}</a-descriptions-item>
      <a-descriptions-item :label="$t('PersonalCenter.createdAt')">{{ tokenDate(token.createTime) }}</a-descriptions-item>
      <a-descriptions-item :label="$t('PersonalToken.permissionMode.label')">{{ $t(permissionModeLabel(token.scope)) }}</a-descriptions-item>
    </a-descriptions>
    <section class="token-details-permissions">
      <h3>{{ $t('PersonalToken.dialog.permissionScope') }}</h3>
      <PermissionList :value="scope.permissions" disabled presentation="list" />
    </section>
    <template #foot>
      <a-button class="token-details-edit" type="default" @click="$emit('edit', token)">
        <template #icon><AIcon type="EditOutlined" /></template>
        {{ $t('PersonalToken.TokenCard.515931-7') }}
      </a-button>
    </template>
  </JlDrawerShell>
</template>

<style scoped>
.token-details-heading { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
.token-details-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.token-details-heading > .ant-badge { flex: none; white-space: nowrap; }
.token-details-metadata { flex: none; }
.token-details-permissions { display: flex; flex-direction: column; flex: 1; min-height: 15rem; min-width: 0; }
.token-details-permissions h3 { flex: none; margin: 0 0 var(--space-3); color: var(--text-color); font-size: var(--fs-14); font-weight: 600; }
.token-details-edit { min-width: 5rem; }
</style>
