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
      v-model:openKeys="state.openKeys"
      v-model:collapsed="state.collapsed"
      :selectedKeys="layoutSelectedKeys"
      :breadcrumb="{ routes: [] }"
      :pure="state.pure"
      :layoutType="layoutType"
      :collapsedButtonRender="false"
      :menuExtraRender="showMenuSearch ? undefined : false"
      :subMenuItemRender="layout.layout === 'top'
        ? subMenuItemRender
        : layout.layout === 'side' && !state.collapsed
          ? renderPrimaryMenuGroup
          : undefined"
      @menuClick="handlePrimaryMenuClick"
      @backClick="goBack"
    >
      <template #menuHeaderRender>
        <div class="project-layout__brand" :style="layout.layout === 'top' ? undefined : logoWidth">
          <BusinessApplicationSwitcher
            v-if="variant !== 'project' && businessApplicationRuntime && !state.collapsed"
            :fallback-logo="layout.logo"
            :fallback-title="layout.title"
            mode="brand"
          />
          <div v-else-if="!state.collapsed" class="project-layout__brand-main">
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
            <BusinessApplicationSwitcher
              v-if="variant === 'project' && businessApplicationRuntime"
              mode="header"
            />
            <template v-if="!hideHeaderRight">
              <Resource v-if="systemInfo?.front?.resources" key="resource" />
              <Language key="Language" />
              <Notice key="notice" />
            </template>
            <a-tooltip
              v-if="variant === 'project' && settingsVisible"
              :title="$t('layout.project.settings')"
            >
              <a-button
                class="project-layout__header-action"
                :class="{ 'project-layout__header-action--active': settingsActive }"
                type="text"
                :aria-label="$t('layout.project.settings')"
                @click="enterSettings"
              >
                <template #icon><AIcon type="SettingOutlined" /></template>
              </a-button>
            </a-tooltip>
            <LayoutSidebarUser key="user" :collapsed="state.collapsed" />
          </RegistryComponent>
        </div>
      </template>
      <div
        class="project-layout__content"
        :class="{ 'project-layout__content--settings': settingsActive }"
      >
        <ProjectSecondaryMenu
          v-if="visibleSecondaryItems.length"
          :items="visibleSecondaryItems"
          :selectedKey="visibleSecondarySelectedKey"
          :tabPosition="secondaryTabPosition"
          @select="selectVisibleSecondaryItem"
        />
        <div class="project-layout__route-content">
          <PageRouteView />
        </div>
      </div>
    </j-pro-layout>
    <AiChat />
  </div>
</template>

<script setup name="BasicLayoutShell" lang="ts">
import type { PropType, VNode } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import {
  AiChat,
  BusinessApplicationSwitcher,
  Language,
  LayoutSidebarUser,
  Notice,
  Resource,
} from '../components'
import ProjectSecondaryMenu from '../components/ProjectSecondaryMenu.vue'
import { useBasicLayoutControllerContext } from '../hooks/basicLayoutContext'
import type { BasicLayoutVariant } from '../runtime/layoutVariant'

type LayoutMenuRouteRecord = RouteRecordRaw & {
  key?: string
}

type SubMenuItemRender = (context: {
  item: LayoutMenuRouteRecord
  children: VNode[]
}) => VNode

defineProps({
  variant: {
    type: String as PropType<BasicLayoutVariant>,
    required: true,
  },
  subMenuItemRender: {
    type: Function as PropType<SubMenuItemRender>,
    default: undefined,
  },
})

const {
  businessApplicationRuntime,
  config,
  enterSettings,
  goBack,
  handlePrimaryMenuClick,
  headerScrolled,
  hideHeaderRight,
  layout,
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
} = useBasicLayoutControllerContext()
</script>

<style scoped lang="less" src="./BasicLayoutShell.less"></style>
