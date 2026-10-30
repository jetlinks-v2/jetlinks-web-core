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
              <div class="layout-sidebar-user__account-row">
                <span class="layout-sidebar-user__account" :title="account">{{ account }}</span>
              </div>
              <div class="layout-sidebar-user__metadata">
                <AppTag
                  v-for="tag in identityTags"
                  :key="tag.key"
                  class="layout-sidebar-user__meta-tag"
                  :class="tag.key === 'account' ? 'layout-sidebar-user__account-type' : 'layout-sidebar-user__user-type'"
                  :name="tag.label"
                />
              </div>
              <div v-if="roleSummary" class="layout-sidebar-user__roles" :title="roleSummary">{{ roleSummary }}</div>
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
  open, logoutLoading, displayName, account, roleSummary, identityTags, avatar, avatarText,
  menuEntries, goAccountCenter, handleLogout,
} = useLayoutSidebarUser()
</script>
