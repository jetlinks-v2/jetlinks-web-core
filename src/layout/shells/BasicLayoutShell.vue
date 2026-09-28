<template>
  <div
    :class="[
      'basic-layout-page',
      `basic-layout-page--${variant}`,
      routeLayoutClassName,
      { 'basic-layout-page--header-scrolled': headerScrolled },
    ]"
  >
    <j-pro-layout
      v-bind="config"
      :openKeys="layoutOpenKeys"
      v-model:collapsed="state.collapsed"
      :selectedKeys="layoutSelectedKeys"
      :breadcrumb="{ routes: [] }"
      :pure="state.pure"
      :layoutType="layoutType"
      :collapsedButtonRender="false"
      :menuExtraRender="showMenuSearch ? undefined : false"
      :menuItemRender="renderMenuItem"
      :subMenuItemRender="layoutMode === 'top'
        ? subMenuItemRender
        : layoutMode === 'side' && variant !== 'project' && !state.collapsed
          ? renderPrimaryMenuGroup
          : undefined"
      @update:openKeys="handleOpenKeysChange"
      @backClick="goBack"
    >
      <template #menuHeaderRender>
        <div class="project-layout__brand" :style="layoutMode === 'top' ? undefined : logoWidth">
          <div v-if="!state.collapsed" class="project-layout__brand-main">
            <img class="project-layout__brand-logo" :src="layout.logo" alt="" />
            <span class="project-layout__brand-title">{{ layout.title }}</span>
          </div>
          <a-button
            v-if="variant !== 'project'"
            class="project-layout__brand-collapse"
            type="text"
            :aria-label="$t(state.collapsed ? 'components.LayoutSidebarUser.expand' : 'components.LayoutSidebarUser.collapse')"
            @click.stop="state.collapsed = !state.collapsed"
          >
            <template #icon>
              <AIcon :type="state.collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
            </template>
          </a-button>
        </div>
      </template>
      <template #leftContentRender>
        <RegistryComponent pageCode="layout" code="layout" @click="onClick" />
      </template>
      <template #rightContentRender>
        <div class="right-content">
          <RegistryComponent pageCode="layout" code="headerRight">
            <MenuSource />
            <template v-if="!hideHeaderRight">
              <Resource v-if="systemInfo?.front?.resources" key="resource" />
              <Language key="Language" />
              <Notice key="notice" />
            </template>
<!--            <a-tooltip-->
<!--              v-if="variant === 'project' && settingsVisible"-->
<!--              :title="$t('layout.project.settings')"-->
<!--            >-->
<!--              <a-button-->
<!--                class="project-layout__header-action"-->
<!--                :class="{ 'project-layout__header-action&#45;&#45;active': settingsActive }"-->
<!--                type="text"-->
<!--                :aria-label="$t('layout.project.settings')"-->
<!--                @click="enterSettings"-->
<!--              >-->
<!--                <template #icon><AIcon type="SettingOutlined" /></template>-->
<!--              </a-button>-->
<!--            </a-tooltip>-->
            <LayoutSidebarUser key="user" :collapsed="state.collapsed" />
          </RegistryComponent>
        </div>
      </template>
      <div
        class="project-layout__content"
        :class="{
          'project-layout__content--settings': settingsActive,
          'project-layout__content--panel': routeContentPanel.enabled,
        }"
      >
        <ProjectSecondaryMenu
          v-if="visibleSecondaryItems.length"
          :items="visibleSecondaryItems"
          :selectedKey="visibleSecondarySelectedKey"
          :tabPosition="secondaryTabPosition"
          @select="selectVisibleSecondaryItem"
        />
        <div
          class="project-layout__route-content"
          :class="{ 'project-layout__route-content--panel': routeContentPanel.enabled }"
        >
          <RouteContentSurface />
        </div>
      </div>
    </j-pro-layout>
    <AiChat />
  </div>
</template>

<script setup name="BasicLayoutShell" lang="ts">
import { watchEffect, type PropType, type VNode } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { LayoutMode } from '@jetlinks-web-core/store/system'
import {
  AiChat,
  BusinessApplicationSwitcher,
  Language,
  LayoutSidebarUser,
  Notice,
  Resource,
} from '../components'
import ProjectSecondaryMenu from '../components/ProjectSecondaryMenu.vue'
import RouteContentSurface from '../components/RouteContentSurface/index.vue'
import { useBasicLayoutControllerContext } from '../hooks/basicLayoutContext'
import { useRouteContentPanel } from '../hooks/useRouteContentPanel'
import { createLayoutMenuItemRenderer } from '../utils/projectMenuRender'
import type { BasicLayoutVariant } from '../runtime/layoutVariant'
import MenuSource from '../components/MenuSearch.vue'

type LayoutMenuRouteRecord = RouteRecordRaw & {
  key?: string
}

type SubMenuItemRender = (context: {
  item: LayoutMenuRouteRecord
  children: VNode[]
}) => VNode

const props = defineProps({
  variant: {
    type: String as PropType<BasicLayoutVariant>,
    required: true,
  },
  layout: {
    type: String as PropType<LayoutMode>,
  },
  expandSecondaryMenu: {
    type: Boolean,
    default: false,
  },
  subMenuItemRender: {
    type: Function as PropType<SubMenuItemRender>,
    default: undefined,
  },
})

const controller = useBasicLayoutControllerContext(props.layout)

// 面板只在项目布局生效（见 `isContentPanelLayout`），项目布局内再由模块的
// `getContentPanelOverrides()` 声明决定；租户端复用本壳层但拿到 `enabled: false`，
// 内容区保持引入面板前的结构。
const routeContentPanel = useRouteContentPanel()

watchEffect(() => {
  controller.expandSecondaryMenu.value = props.expandSecondaryMenu
})

const renderMenuItem = createLayoutMenuItemRenderer(path => controller.handlePrimaryMenuClick({ key: path }))

const {
  businessApplicationRuntime,
  config,
  enterSettings,
  goBack,
  handleOpenKeysChange,
  headerScrolled,
  hideHeaderRight,
  layout,
  layoutMode,
  layoutOpenKeys,
  layoutSelectedKeys,
  layoutType,
  logoWidth,
  onClick,
  renderPrimaryMenuGroup,
  routeLayoutClassName,
  secondaryTabPosition,
  selectVisibleSecondaryItem,
  showMenuSearch,
  state,
  settingsActive,
  settingsVisible,
  systemInfo,
  visibleSecondaryItems,
  visibleSecondarySelectedKey,
} = controller
</script>

<style scoped lang="less" src="./BasicLayoutShell.less"></style>
