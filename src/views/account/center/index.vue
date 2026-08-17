<template>
  <div class="person">
    <div class="person-inner">
      <div class="person-sider">
        <full-page>
          <a-menu
              class="person-menu"
              mode="inline"
              :selectedKeys="[user.tabKey]"
              @click="onMenuClick"
          >
            <a-menu-item
                v-for="item in _tabList"
                :key="item.key"
            >
              {{ item.title }}
            </a-menu-item>
          </a-menu>
        </full-page>
      </div>
      <div class="person-main">
        <full-page>
          <div class="person-main-content">
            <component
                :is="tabs[user.tabKey]"
                @open-edit-password="editPasswordVisible = true"
            />
          </div>
        </full-page>
      </div>
    </div>
  </div>
  <EditPassword
    v-if="editPasswordVisible"
    @close="editPasswordVisible = false"
  />
</template>

<script setup lang="ts" name="Center">
import AccountInfo from './components/AccountInfo/index.vue'
import BindThirdAccount from './components/BindThirdAccount/index.vue'
import EditPassword from './components/EditPassword/index.vue'
import { useUserStore } from '@jetlinks-web-core/store'
import { useRouterParams } from '@jetlinks-web/hooks'
import { tabList } from '@jetlinks-web-core/views/account/center/data'
import { isNoCommunity } from '@jetlinks-web-core/utils'
import FullPage from "@/layout/FullPage.vue";

const user = useUserStore()

const tabs = {
  AccountInfo,
  BindThirdAccount,
}

const router = useRouterParams()

const editPasswordVisible = ref<boolean>(false)

const onMenuClick = (info: any) => {
  if (info?.key) {
    user.tabKey = info.key
  }
}

const _tabList = computed(() => {
  return tabList.filter(i => i.key !== 'BindThirdAccount' || isNoCommunity)
})

const getTabKey = () => {
  const routeTabKey = router.params.value?.tabKey
  if (routeTabKey && routeTabKey in tabs) {
    user.tabKey = routeTabKey
    return
  }
  user.tabKey = _tabList.value[0]?.key ?? 'AccountInfo'
}

watchEffect(() => {
  const routeTabKey = router.params.value?.tabKey
  if (routeTabKey && routeTabKey in tabs) {
    user.tabKey = routeTabKey
  }
})

onMounted(async () => {
  await user.getUserInfo()
  getTabKey()
})

onUnmounted(() => {
  user.tabKey = tabList?.[0]?.key || 'AccountInfo'
  user.other.tabKey = ''
})
</script>

<style lang="less" scoped>
.person {
  width: 100%;
  //padding: 1.5rem 1rem;
  box-sizing: border-box;
  overflow-x: hidden;

  .person-inner {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: var(--space-4);
    align-items: flex-start;
    min-width: 0;
  }

  .person-sider {
    flex: 0 0 13.75rem;
    background-color: #fff;
    border-radius: var(--r-3);
    box-shadow: 0 1px 0.1875rem rgba(0, 0, 0, 0.06);

    :deep(.full-page-warp) {
      padding: 0.5rem 0;
      background: #fff;
    }

    :deep(.person-menu) {
      border-inline-end: 0;
      background: transparent !important;
    }

    :deep(.person-menu.ant-menu-inline .ant-menu-item) {
      width: auto;
      height: 2.5rem;
      margin: 0.125rem 0.5rem;
      padding-inline: 1rem !important;
      border-radius: var(--jet-theme-button-r);
      color: var(--jet-theme-text-secondary);
      line-height: 2.5rem;
      background: transparent !important;
    }

    :deep(.person-menu.ant-menu-inline .ant-menu-item::after),
    :deep(.person-menu.ant-menu-inline .ant-menu-item::before) {
      display: none !important;
    }

    :deep(.person-menu.ant-menu-inline .ant-menu-item:hover) {
      color: var(--jet-theme-text) !important;
      background: transparent !important;
    }

    :deep(.person-menu.ant-menu-inline .ant-menu-item-selected) {
      color: var(--jet-theme-text) !important;
      background: transparent !important;
      font-weight: 500;
    }

    :deep(.person-menu .ant-menu-title-content) {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .person-main {
    flex: 1;
    min-width: 0;
  }

  .person-main-content {
    background-color: #fff;
    border-radius: var(--r-3);
    padding: 1rem 1.25rem;
    box-shadow: 0 1px 0.1875rem rgba(0, 0, 0, 0.06);
    height: 100%;
  }
}

@media (max-width: 768px) {
  .person {
    padding: 1rem 0.75rem;

    .person-inner {
      flex-direction: column;
    }

    .person-sider {
      flex: none;
      width: 100%;

      :deep(.full-page-warp) {
        height: auto !important;
      }
    }

    .person-main {
      width: 100%;
    }
  }
}
</style>
