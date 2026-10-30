<template>
  <div class="layout-sidebar-user" :class="{ 'layout-sidebar-user--collapsed': collapsed }">
    <a-dropdown
      v-model:open="open"
      placement="bottomRight"
      :trigger="['click']"
      overlay-class-name="layout-sidebar-user-overlay"
    >
      <a-button
        class="layout-sidebar-user__card"
        :aria-expanded="open ? 'true' : 'false'"
        :aria-label="$t('components.LayoutSidebarUser.accountCenter')"
      >
        <a-avatar :size="30" :src="avatar" class="layout-sidebar-user__avatar">
          <template #icon><span>{{ avatarText }}</span></template>
        </a-avatar>
      </a-button>

      <template #overlay>
        <div class="layout-sidebar-user__menu">
          <div class="layout-sidebar-user__summary">
            <a-avatar :size="40" :src="avatar" class="layout-sidebar-user__avatar layout-sidebar-user__summary-avatar">
              <template #icon><span>{{ avatarText }}</span></template>
            </a-avatar>
            <div class="layout-sidebar-user__summary-content">
              <div class="layout-sidebar-user__title-row">
                <span class="layout-sidebar-user__name" :title="displayName">{{ displayName }}</span>
              </div>
              <dl class="layout-sidebar-user__details">
                <dt class="layout-sidebar-user__detail-label">{{ $t('AccountInfo.basicUsername') }}：</dt>
                <dd class="layout-sidebar-user__detail-value" :title="account">{{ account }}</dd>
                <template v-if="roleSummary">
                  <dt class="layout-sidebar-user__detail-label">{{ $t('AccountInfo.roles') }}：</dt>
                  <dd class="layout-sidebar-user__detail-value" :title="roleSummary">{{ roleSummary }}</dd>
                </template>
              </dl>
            </div>
          </div>
          <div class="layout-sidebar-user__divider" />
          <div class="layout-sidebar-user__menu-content">
            <a-button
              v-for="entry in menuEntries"
              :key="entry.key"
              class="layout-sidebar-user__menu-item"
              type="text"
              @click="goAccountCenter(entry.key)"
            >
              <span>{{ entry.label }}</span>
              <a-badge v-if="entry.count" size="small" :count="entry.count" :overflow-count="BADGE_OVERFLOW_COUNT" />
            </a-button>
          </div>
          <div class="layout-sidebar-user__extensions">
            <RegistryComponent pageCode="layout" code="sidebarUserMenu" @click="open = false" />
          </div>
          <div class="layout-sidebar-user__divider" />
          <div class="layout-sidebar-user__footer">
            <a-button
              class="layout-sidebar-user__menu-item"
              type="text"
              :loading="logoutLoading"
              :disabled="logoutLoading"
              :aria-busy="logoutLoading"
              @click="handleLogout"
            >
              <span>{{ $t('components.LayoutSidebarUser.logout') }}</span>
            </a-button>
          </div>
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts" name="LayoutSidebarUser">
import { useI18n } from 'vue-i18n'
import { BADGE_OVERFLOW_COUNT } from './noticeUtils'
import { useLayoutSidebarUser } from './useLayoutSidebarUser'

defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const { t: $t } = useI18n()
const {
  open, logoutLoading, displayName, account, roleSummary, avatar, avatarText,
  menuEntries, goAccountCenter, handleLogout,
} = useLayoutSidebarUser()
</script>

<style scoped>
.layout-sidebar-user__details {
  display: grid;
  min-width: 0;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-1);
  margin: var(--space-1) 0 0;
  color: var(--text-color-secondary);
  font-size: var(--fs-12);
  line-height: 1.5;
}
.layout-sidebar-user__detail-label {
  margin: 0;
  font-weight: 400;
  white-space: nowrap;
}
.layout-sidebar-user__detail-value {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
