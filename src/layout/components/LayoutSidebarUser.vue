<template>
  <div class="layout-sidebar-user" :class="{ 'layout-sidebar-user--collapsed': collapsed }">
    <a-dropdown
      v-model:open="open"
      placement="bottomRight"
      trigger="click"
      overlay-class-name="layout-sidebar-user-overlay"
    >
      <a-button class="layout-sidebar-user__card" :aria-expanded="open ? 'true' : 'false'">
        <a-avatar :size="30" :src="avatar" class="layout-sidebar-user__avatar">
          <template #icon>
            <span>{{ avatarText }}</span>
          </template>
        </a-avatar>
      </a-button>

      <template #overlay>
        <div class="layout-sidebar-user__menu">
          <div class="layout-sidebar-user__summary">
            <div class="layout-sidebar-user__title-row">
              <span class="layout-sidebar-user__name">{{ displayName }}</span>
            </div>
            <div class="layout-sidebar-user__account-row">
              <span class="layout-sidebar-user__account-label">
                {{ $t('components.LayoutSidebarUser.accountId') }}
              </span>
              <span class="layout-sidebar-user__account">{{ account }}</span>
            </div>
          </div>
          <div class="layout-sidebar-user__divider" />
          <div class="layout-sidebar-user__menu-content">
            <a-button class="layout-sidebar-user__menu-item" type="text" block @click="goAccountCenter">
              {{ $t('components.LayoutSidebarUser.accountCenter') }}
            </a-button>
            <RegistryComponent
              class="layout-sidebar-user__menu-item"
              pageCode="layout"
              code="sidebarUserMenu"
              @click="open = false"
            />
          </div>
          <div class="layout-sidebar-user__divider" />
          <a-button class="layout-sidebar-user__logout" type="text" block :loading="logoutLoading" @click="handleLogout">
            {{ $t('components.LayoutSidebarUser.logout') }}
          </a-button>
        </div>
      </template>
    </a-dropdown>
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

const router = useRouter()
const { t: $t } = useI18n()
const userStore = useUserStore()
const open = ref(false)
const logoutLoading = ref(false)

const displayName = computed(() => userStore.userInfo?.name || userStore.userInfo?.username || '-')
const account = computed(() => userStore.userInfo?.username || userStore.userInfo?.id || '-')

const avatar = computed(() => (userStore.userInfo as { avatar?: string })?.avatar || '')
const avatarText = computed(() => displayName.value.trim().slice(0, 1) || '用')

const goAccountCenter = () => {
  open.value = false
  userStore.tabKey = 'BindThirdAccount'
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
      jumpLogin({ reason: 'logout' })
    }
  } finally {
    logoutLoading.value = false
  }
}
</script>
