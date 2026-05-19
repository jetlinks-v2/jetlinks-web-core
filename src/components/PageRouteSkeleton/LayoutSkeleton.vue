<template>
  <div class="page-route-skeleton__shell">
    <div class="page-route-skeleton__shell-header">
      <div class="page-route-skeleton__brand">
        <span class="page-route-skeleton__block page-route-skeleton__logo"></span>
        <span class="page-route-skeleton__block page-route-skeleton__brand-name"></span>
      </div>
      <div class="page-route-skeleton__header-actions">
        <span
          v-for="item in 3"
          :key="item"
          class="page-route-skeleton__block page-route-skeleton__icon"
        ></span>
      </div>
    </div>
    <div class="page-route-skeleton__layout-body">
      <aside class="page-route-skeleton__sider">
        <span class="page-route-skeleton__block page-route-skeleton__search"></span>
        <div class="page-route-skeleton__menu">
          <span
            v-for="item in 7"
            :key="item"
            :class="[
              'page-route-skeleton__block',
              'page-route-skeleton__menu-item',
              { 'page-route-skeleton__menu-item--active': item === 1 }
            ]"
          ></span>
        </div>
        <div class="page-route-skeleton__user">
          <span class="page-route-skeleton__block page-route-skeleton__avatar"></span>
          <div class="page-route-skeleton__user-lines">
            <span class="page-route-skeleton__block page-route-skeleton__user-name"></span>
            <span class="page-route-skeleton__block page-route-skeleton__user-desc"></span>
          </div>
        </div>
      </aside>
      <main class="page-route-skeleton__main">
        <ContentSkeleton />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts" name="PageRouteSkeletonLayout">
import ContentSkeleton from './ContentSkeleton.vue'
</script>
