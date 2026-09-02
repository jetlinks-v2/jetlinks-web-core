<template>
  <div class="menu-panel">
    <div class="menu-style">
      <div class="menu-img">
        <img :src="Menu" />
      </div>
      <div class="menu-info">
        <b>{{ $t("Menu.index.459633-0", [menusData.count]) }}</b>
        <div>{{ $t("Menu.index.459633-2") }}</div>
      </div>
    </div>

    <div v-if="menusData.current.length" class="menu-tree-panel">
      <div class="menu-tree-panel__header">
        {{ $t("Menu.index.459633-3") }}
      </div>
      <a-tree
        v-model:expandedKeys="expandedKeys"
        :tree-data="menusData.current"
        :selectedKeys="[]"
        :show-line="{ showLeafIcon: false }"
        :fieldNames="{key: 'id'}"
        blockNode
      >
        <template #title="{ name }">
          <span class="menu-tree-node-title">{{ name }}</span>
        </template>
      </a-tree>
    </div>
    <CloudEmpty
      v-else
      class="menu-tree-empty"
      :description="$t('Menu.index.459633-4')"
    />
  </div>
</template>

<script lang="ts" setup>
import {ACCESS_AI_AGENT_CODE_DATA, USER_CENTER_MENU_DATA} from "../data/baseMenu";
import BaseMenuData, { mergeTrees, handleMenuOptions } from '../data'
import {
  updateMenus,
  systemVersion,
  queryModule,
  getSystemPermission,
} from "@jetlinks-web-core/api/initHome";
import { OpenMicroApp, OWNER_KEY } from '@jetlinks-web-core/utils/consts'
import { BASE_API } from '@jetlinks-web/constants'
import { useApplication } from '@jetlinks-web-core/store'
import {saveAgentList} from "@jetlinks-web-core/api/comm";
import {agentData} from "../data/aiData";
import { Menu } from '@jetlinks-web-core/assets/init-home'
import { useI18n } from 'vue-i18n';
import { collectExpandedKeys, type MenuFilter, type MenuItem } from './utils'

const props = defineProps<{
  filterMenu?: MenuFilter
  queryProtocol?: boolean
}>()

const { t: $t, locale } = useI18n();

const app = useApplication()
/**
 * 获取菜单数据
 */
const menusData = reactive({
  count: 0,
  current: [] as MenuItem[],
});
const hasAgentPermission = ref(false)
const expandedKeys = ref<string[]>([])

/**
 * 查询支持的协议
 */
const getProvidersFn = async () => {
  let version = "";
  const req: any = await systemVersion();
  if (req.success && req.result) {
    version = req.result.edition;
  }

  if (version === "community") {
    return false;
  }

  try {
    const res = await queryModule();
    return res.success && res.result.length
  } catch (error) {
    return false;
  }
};

/**
 * 获取当前系统权限信息
 */
const getSystemPermissionData = async ( BaseMenu: MenuItem[] ) => {
  const hasProtocol = props.queryProtocol === false ? true : await getProvidersFn();
  const resp = await getSystemPermission();
  if (resp.success) {
    const _permission = resp.result.map((item: any) => JSON.parse(item).id)
    const permissionTree = filterMenuByPermission(_permission,
      BaseMenu,
      hasProtocol,
    );

    const newTree = props.filterMenu ? await props.filterMenu(permissionTree) : permissionTree
    const _count = menuCount(newTree);
    debugger
    menusData.current = newTree;
    menusData.count = _count;
    expandedKeys.value = collectExpandedKeys(newTree)
    hasAgentPermission.value = _permission.includes('ai-agent-deploy')
  }
};

/**
 * 过滤菜单
 */
const filterMenuByPermission = (
  permissions: string[],
  menus: MenuItem[],
  hasProtocol: boolean,
): MenuItem[] => {
  return menus.filter((item) => {
    let isShow = false;
    if (item.showPage && item.showPage.length) {
      isShow = item.showPage.some((pItem) => {
        return permissions.includes(pItem);
      });
    }
    if (item.buttons?.length) {
      item.buttons = item.buttons.filter((bItem) => {
        return bItem.permissions?.some((permission) => {
          return permissions.includes(permission.permission)
        })
      })
    }
    if (item.children) {
      item.children = filterMenuByPermission(permissions, item.children, hasProtocol);
    }
    if (!hasProtocol && item.options?.hasProtocol) {
      return false;
    }
    return isShow || !!item.children?.length;
  });
};

/**
 * 计算菜单数量
 */
const menuCount = (menus: MenuItem[]) => {
  return menus.reduce((pre, next) => {
    let _count = 1;

    if (next.children?.length) {
      _count = menuCount(next.children);
    }
    return pre + _count;
  }, 0);
};
/**
 * 添加options show用于控制菜单是否显示函数
 */
const dealMenu = (data: MenuItem[]) => {
  data.forEach((item) => {
    item.options = Object.assign(
      {
        show: true,
      },
      item?.options || {},
    );

    item.owner = item.owner || OWNER_KEY
    if (item.children) {
      dealMenu(item.children);
    }
  });
};
/**
 * 初始化菜单
 */
const initMenu = async (): Promise<boolean> => {
  // 菜单接口按顶层 owner 分批写入，保留每个 owner 下的完整子树。
  dealMenu(menusData.current);
  if(hasAgentPermission.value){
    USER_CENTER_MENU_DATA.buttons.push(ACCESS_AI_AGENT_CODE_DATA)
  }

  const menusByOwner = menusData.current.reduce<Map<string, MenuItem[]>>((groups, menu) => {
    const owner = menu.owner || OWNER_KEY
    const ownerMenus = groups.get(owner) || []

    ownerMenus.push(menu)
    groups.set(owner, ownerMenus)
    return groups
  }, new Map())

  const userCenterOwner = USER_CENTER_MENU_DATA.owner || OWNER_KEY
  const userCenterMenus = menusByOwner.get(userCenterOwner) || []
  menusByOwner.set(userCenterOwner, [...userCenterMenus, USER_CENTER_MENU_DATA])

  try {
    // 并行提交所有 owner 分组，必须全部成功后才能继续保存后续初始化数据。
    const responses = await Promise.all(
      [...menusByOwner.entries()].map(([owner, menus]) => updateMenus(menus, owner)),
    )
    if (!responses.every((response) => response.success)) {
      return false
    }

    if(hasAgentPermission.value){
      const resp = await saveAgentList(agentData)
      return resp.success
    }

    return true
  } catch {
    return false
  }
};

const getCloudMenu = async () => {
  let bseMenus = await BaseMenuData();

  if (app.appList.length > 0 && OpenMicroApp) {
    const appItems = app.appList.filter(item => !item.path.startsWith('http'))

    for (const item of appItems) {
      let _path = item.path.startsWith('/') ? item.path : '/' + item.path
      const url = `${window.location.protocol}//${document.location.host}${BASE_API}${_path}/baseMenu.json`
      const resp = await fetch(url)
      if (resp.ok) {
        const res = await resp.json()
        bseMenus = mergeTrees(bseMenus, handleMenuOptions(res, item))
      }
    }
  }
  getSystemPermissionData(bseMenus)
}

getCloudMenu()


defineExpose({
  updateMenu: initMenu,
});
</script>
<style lang="less" scoped>
.menu-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.menu-style {
  display: flex;
  align-items: center;
  .menu-img {
    margin-right: var(--space-4);
  }
}

.menu-tree-panel {
  max-height: 22.5rem;
  overflow: auto;
  padding: var(--space-3) var(--space-4);
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-1);
}

.menu-tree-panel__header {
  margin-bottom: var(--space-2);
  color: var(--ink-1);
  font-weight: 500;
  font-size: var(--fs-14);
}

.menu-tree-node-title {
  color: var(--ink-1);
  cursor: default;
}

.menu-tree-empty {
  padding: var(--space-6) 0;
}
</style>
