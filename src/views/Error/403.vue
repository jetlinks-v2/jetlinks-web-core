<template>
  <a-result status="403" title="403" :sub-title="noMenu ? t('Error403.noMenus') : undefined">
    <template v-if="noMenu" #extra>
      <dl class="account-info">
        <div><dt>{{ t('PersonalCenter.nameLabel') }}</dt><dd>{{ userInfo.name || '—' }}</dd></div>
        <div><dt>{{ t('EditInfo.index.557023-5') }}</dt><dd>{{ userInfo.username || '—' }}</dd></div>
        <div>
          <dt>{{ t('EditInfo.index.557023-7') }}</dt>
          <dd v-if="roles.length" class="role-list">
            <a-tag v-for="role in roles" :key="role">{{ role }}</a-tag>
          </dd>
          <dd v-else>{{ Array.isArray(userInfo.roleList) && !userInfo.roleList.length ? t('PersonalCenter.unassignedRole') : '—' }}</dd>
        </div>
      </dl>
    </template>
  </a-result>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { NO_MENU_REASON } from '@jetlinks-web-core/router/forbidden'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { dimensionNames } from '@jetlinks-web-core/utils/user-dimensions'

const { t } = useI18n()
const route = useRoute()
const menu = useMenuStore()
const { userInfo } = storeToRefs(useUserStore())
const noMenu = computed(() => route.query.reason === NO_MENU_REASON && menu.hasNoAccessibleMenu)
const roles = computed(() => [...new Set(dimensionNames(userInfo.value.roleList))])
</script>

<style scoped lang="less">
.account-info {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3) var(--space-6);
  max-width: 100%;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--jet-theme-bg-layout);
  border-radius: var(--r-2);
  text-align: start;

  > div, .role-list { display: flex; align-items: baseline; gap: var(--space-2); min-width: 0; }
  dt { flex: none; color: var(--text-color-secondary); }
  dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .role-list { flex-wrap: wrap; }
  .ant-tag { max-width: 100%; margin: 0; white-space: normal; }
}
@media (max-width: 576px) {
  .account-info { flex-direction: column; }
}
</style>
