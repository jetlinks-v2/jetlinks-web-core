<template>
  <div class="layout-sidebar-user" :class="{ 'layout-sidebar-user--collapsed': collapsed }">
    <a-dropdown
      v-model:open="open"
      placement="topLeft"
      trigger="click"
      overlay-class-name="layout-sidebar-user-overlay"
      getPopupContainer=''
    >
      <a-button class="layout-sidebar-user__card" :aria-expanded="open ? 'true' : 'false'">
        <a-avatar :size="26" :src="avatar" class="layout-sidebar-user__avatar">
          <template #icon>
            <span>{{ avatarText }}</span>
          </template>
        </a-avatar>
        <span v-if="!collapsed" class="layout-sidebar-user__meta">
          <span class="layout-sidebar-user__name">{{ displayName }}</span>
          <span class="layout-sidebar-user__account">{{ account }}</span>
        </span>
        <AIcon v-if="!collapsed" type="UpOutlined" class="layout-sidebar-user__arrow" />
      </a-button>

      <template #overlay>
        <div class="layout-sidebar-user__menu">
          <a-button
            v-for="item in menuItems"
            :key="item.key"
            class="layout-sidebar-user__menu-item"
            @click="jumpMenu(item)"
          >
            <AIcon :type="item.icon" />
            <span>{{ item.label }}</span>
          </a-button>
          <RegistryComponent pageCode="layout" code="sidebarUserMenu" @click="open = false" />
          <a-button class="layout-sidebar-user__menu-item" type="text" block @click="goAccountCenter">
            <template #icon>
              <AIcon type="SettingOutlined" />
            </template>
            {{ $t('components.LayoutSidebarUser.settings') }}
          </a-button>
          <div class="layout-sidebar-user__divider" />
          <a-button class="layout-sidebar-user__menu-item layout-sidebar-user__menu-item--muted" type="text" block :loading="logoutLoading" @click="handleLogout">
            <template #icon>
              <AIcon type="LogoutOutlined" />
            </template>
            {{ $t('components.LayoutSidebarUser.logout') }}
          </a-button>
        </div>
      </template>
    </a-dropdown>

    <a-button class="layout-sidebar-user__collapse" type="text" :aria-label="$t(collapsed ? 'components.LayoutSidebarUser.expand' : 'components.LayoutSidebarUser.collapse')" @click="emit('toggleCollapse')">
      <template #icon>
        <AIcon :type="collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
      </template>
    </a-button>
  </div>
</template>

<script setup lang="ts" name="LayoutSidebarUser">
import { logout } from '@jetlinks-web-core/api/login'
import { clearVerifyCache } from '@jetlinks-web-core/package'
import { jumpLogin } from '@jetlinks-web-core/router'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useI18n } from 'vue-i18n'

defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (e: 'toggleCollapse'): void
}>()

const router = useRouter()
const { t: $t } = useI18n()
const userStore = useUserStore()
const open = ref(false)
const logoutLoading = ref(false)

const displayName = computed(() => userStore.userInfo?.name || userStore.userInfo?.username || '-')
const account = computed(() => {
  const info = userStore.userInfo as Record<string, any>
  return info.email || info.username || ''
})
const avatar = computed(() => (userStore.userInfo as Record<string, any>)?.avatar || '')
const avatarText = computed(() => displayName.value.trim().slice(0, 1) || '用')
const menuItems = computed(() => [
  { key: 'ticket', label: $t('components.LayoutSidebarUser.ticket'), path: '/support/center', icon: 'ContainerOutlined' },
  { key: 'expense', label: $t('components.LayoutSidebarUser.expense'), icon: 'CreditCardOutlined' },
  { key: 'platform', label: $t('components.LayoutSidebarUser.platform'), icon: 'SafetyOutlined' }
])

const jumpMenu = (item: { path?: string }) => {
  open.value = false
  if (!item.path) return
  router.push(item.path)
}

const goAccountCenter = () => {
  open.value = false
  router.push('/account/center')
}

const handleLogout = async () => {
  if (logoutLoading.value) return
  logoutLoading.value = true
  try {
    const resp = await logout()
    if (resp.success) {
      open.value = false
      clearVerifyCache()
      jumpLogin()
    }
  } finally {
    logoutLoading.value = false
  }
}
</script>

<style scoped lang="less">
.layout-sidebar-user {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1.75rem;
  align-items: center;
  gap: var(--space-1);
  padding: 0.5rem 0.625rem;
  border-top: 1px solid var(--jet-theme-border-secondary);
  background: var(--layout-menu-bg, var(--jet-theme-bg-container));

  &__card {
    min-width: 0;
    height: 2.625rem;
    display: flex;
    align-items: center;
    gap: 0.5625rem;
    padding: 0.375rem 0.5rem;
    border: 0;
    border-radius: var(--r-2);
    background: transparent;
    color: var(--jet-theme-text);
    text-align: left;
    cursor: pointer;
    transition: background 0.16s ease;

    &:hover,
    &[aria-expanded='true'] {
      background: var(--layout-menu-item-active-bg, var(--jet-theme-border-secondary));
    }
  }

  &__avatar {
    flex: none;
      background: var(--chrome-active-line, var(--jet-theme-text));
    color: var(--brand-mark-ink, var(--jet-theme-bg-container));
    font-size: var(--fs-13);
    font-weight: 600;
  }

  &__meta {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  &__name,
  &__account {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__name {
    font-size: var(--fs-13);
    line-height: 1.125rem;
    font-weight: 600;
  }

  &__account {
    color: var(--jet-theme-text-disabled);
    font-size: var(--fs-12);
  }

  &__arrow {
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
  }

  &__collapse {
    width: 1.75rem;
    height: 1.75rem;
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
  }

  &__menu {
    width: 12rem;
    padding: var(--space-1);
    background: var(--chrome-elev, var(--jet-theme-bg-container));
    border: 1px solid var(--chrome-line, var(--jet-theme-border));
    border-radius: var(--chrome-popover-radius, var(--r-3));
    box-shadow: var(--shadow-pop);
  }

  &__menu-item {
    width: 100%;
    height: 2.125rem;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0 0.75rem;
    border: 0;
    border-radius: var(--r-2);
    background: transparent;
    color: var(--jet-theme-text);
    font-size: var(--fs-14);
    text-align: left;
    cursor: pointer;

    &:hover {
      background: var(--layout-menu-item-active-bg, var(--jet-theme-border-secondary));
    }

    :deep(.ant-btn-icon),
    > .anticon {
      color: var(--jet-theme-text-secondary);
    }

    &--muted {
      color: var(--jet-theme-text-secondary);
    }

  }

  &__divider {
    height: 0.0625rem;
    margin: 0.25rem 0;
    background: var(--jet-theme-border-secondary);
  }

  &--collapsed {
    grid-template-columns: 1fr;
    padding: 0.5rem 0.375rem;

    .layout-sidebar-user__card {
      justify-content: center;
      padding: 0.375rem;
    }

    .layout-sidebar-user__collapse {
      margin-top: var(--space-1);
      justify-self: center;
    }
  }
}
</style>

<style lang="less">
.layout-sidebar-user-overlay {
  .ant-dropdown-menu {
    padding: 0;
  }

  .ant-btn {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    text-align: left;
  }

  .ant-btn > span:not(.ant-btn-icon) {
    padding-right: var(--space-1);
    text-align: left;
  }
}
</style>
