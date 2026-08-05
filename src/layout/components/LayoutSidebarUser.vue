<template>
  <div class="layout-sidebar-user" :class="{ 'layout-sidebar-user--collapsed': collapsed }">
    <a-dropdown
      v-model:open="open"
      placement="topLeft"
      trigger="click"
      overlay-class-name="layout-sidebar-user-overlay"
    >
      <a-button class="layout-sidebar-user__card" :aria-expanded="open ? 'true' : 'false'">
        <a-avatar :size="30" :src="avatar" class="layout-sidebar-user__avatar">
          <template #icon>
            <span>{{ avatarText }}</span>
          </template>
        </a-avatar>
        <div v-if="!collapsed" class="layout-sidebar-user__meta">
          <div class="layout-sidebar-user__name">{{ displayName }}</div>
          <div class="layout-sidebar-user__account">{{ account }}</div>
        </div>
        <AIcon v-if="!collapsed" type="UpOutlined" class="layout-sidebar-user__arrow" />
      </a-button>

      <template #overlay>
        <div class="layout-sidebar-user__menu">
          <RegistryComponent pageCode="layout" code="sidebarUserMenu" @click="open = false" />
          <a-button class="layout-sidebar-user__menu-item" type="text" block @click="goAccountCenter">
            <template #icon>
              <AIcon type="UserOutlined" />
            </template>
            {{ $t('components.LayoutSidebarUser.accountCenter') }}
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

<!--    <div v-if="!collapsed" class="layout-sidebar-user__actions">-->
<!--      <a-button-->
<!--        v-for="item in quickItems"-->
<!--        :key="item.key"-->
<!--        class="layout-sidebar-user__action"-->
<!--        type="text"-->
<!--        block-->
<!--        @click="item.onClick"-->
<!--      >-->
<!--        <template #icon>-->
<!--          <AIcon :type="item.icon" />-->
<!--        </template>-->
<!--        <span>{{ item.label }}</span>-->
<!--      </a-button>-->
<!--    </div>-->
  </div>
</template>

<script setup lang="ts" name="LayoutSidebarUser">
import { logout } from '@jetlinks-web-core/api/login'
import { clearVerifyCache } from '@jetlinks-web-core/package'
import { jumpLogin } from '@jetlinks-web-core/router'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useUserStore } from '@jetlinks-web-core/store/user'
import { useI18n } from 'vue-i18n'

defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()
const { t: $t } = useI18n()
const systemStore = useSystemStore()
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

const goStationMessage = () => {
  open.value = false
  userStore.tabKey = 'StationMessage'
  router.push('/account/center')
}

const toggleDarkMode = () => {
  systemStore.changeThemeStyle(systemStore.themeStyle === 'dark' ? 'light' : 'dark')
}

const goProjectConfig = () => {
  open.value = false
  router.push('/system-setting/project-config')
}

const goAccountCenter = () => {
  open.value = false
  userStore.tabKey = 'BindThirdAccount'
  router.push('/account/center')
}

const quickItems = computed(() => [
  { key: 'message', label: $t('components.LayoutSidebarUser.messageCenter'), icon: 'BellOutlined', onClick: goStationMessage },
  {
    key: 'theme',
    label: $t(systemStore.themeStyle === 'dark' ? 'components.LayoutSidebarUser.lightMode' : 'components.LayoutSidebarUser.darkMode'),
    icon: systemStore.themeStyle === 'dark' ? 'SunOutlined' : 'MoonOutlined',
    onClick: toggleDarkMode
  },
  { key: 'settings', label: $t('components.LayoutSidebarUser.systemConfig'), icon: 'SettingOutlined', onClick: goProjectConfig }
])

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
