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
                <template v-if="primaryRole">
                  <a-tag class="layout-sidebar-user__role-tag" :bordered="false" :title="primaryRole">
                    {{ primaryRole }}
                  </a-tag>
                  <a-tooltip v-if="extraRoleCount > 0" placement="bottom">
                    <template #title>
                      <div class="layout-sidebar-user__roles-tooltip">
                        <div class="layout-sidebar-user__roles-tooltip-title">{{ $t('AccountInfo.roles') }}：</div>
                        <div v-for="role in roleList" :key="role" class="layout-sidebar-user__roles-tooltip-item">
                          {{ role }}
                        </div>
                      </div>
                    </template>
                    <a-tag class="layout-sidebar-user__role-tag layout-sidebar-user__role-tag--more" :bordered="false">
                      +{{ extraRoleCount }}
                    </a-tag>
                  </a-tooltip>
                </template>
              </div>
              <div class="layout-sidebar-user__account-row">
                <span class="layout-sidebar-user__account" :title="`${$t('AccountInfo.basicUsername')}：${account}`">
                  {{ account }}
                </span>
              </div>
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
              <AIcon v-if="entry.icon" class="layout-sidebar-user__menu-icon" :type="entry.icon" />
              <span class="layout-sidebar-user__menu-text">{{ entry.label }}</span>
              <a-badge v-if="entry.count" size="small" :count="entry.count" :overflow-count="BADGE_OVERFLOW_COUNT" />
            </a-button>
          </div>
          <div class="layout-sidebar-user__extensions">
            <RegistryComponent pageCode="layout" code="sidebarUserMenu" @click="open = false" />
          </div>
          <div class="layout-sidebar-user__divider" />
          <div class="layout-sidebar-user__footer">
            <a-button
              class="layout-sidebar-user__menu-item layout-sidebar-user__menu-item--logout"
              type="text"
              :loading="logoutLoading"
              :disabled="logoutLoading"
              :aria-busy="logoutLoading"
              @click="handleLogout"
            >
              <AIcon v-if="!logoutLoading" class="layout-sidebar-user__menu-icon" type="LogoutOutlined" />
              <span class="layout-sidebar-user__menu-text">{{ $t('components.LayoutSidebarUser.logout') }}</span>
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
  open, logoutLoading, displayName, account, roleSummary, roleList, primaryRole, extraRoleCount,
  avatar, avatarText, menuEntries, goAccountCenter, handleLogout,
} = useLayoutSidebarUser()
</script>

