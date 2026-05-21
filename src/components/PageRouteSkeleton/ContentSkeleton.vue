<template>
  <div class="page-route-skeleton__content-view">
    <div class="page-route-skeleton__page-title">
      <span class="page-route-skeleton__block page-route-skeleton__title"></span>
    </div>
    <div class="page-route-skeleton__stats">
      <div
        v-for="item in 4"
        :key="item"
        class="page-route-skeleton__card"
      >
        <span class="page-route-skeleton__block page-route-skeleton__label"></span>
        <span class="page-route-skeleton__block page-route-skeleton__value"></span>
        <span class="page-route-skeleton__block page-route-skeleton__caption"></span>
      </div>
    </div>
    <div class="page-route-skeleton__workbench">
      <section class="page-route-skeleton__panel page-route-skeleton__panel--modules">
        <div class="page-route-skeleton__panel-header">
          <span class="page-route-skeleton__block page-route-skeleton__panel-title"></span>
        </div>
        <div
          v-for="row in 3"
          :key="row"
          class="page-route-skeleton__module-row"
        >
          <span class="page-route-skeleton__block page-route-skeleton__module-icon"></span>
          <div class="page-route-skeleton__module-info">
            <span class="page-route-skeleton__block page-route-skeleton__module-name"></span>
            <span class="page-route-skeleton__block page-route-skeleton__module-meta"></span>
          </div>
        </div>
      </section>
      <section class="page-route-skeleton__panel page-route-skeleton__panel--actions">
        <div class="page-route-skeleton__panel-header">
          <span class="page-route-skeleton__block page-route-skeleton__panel-title page-route-skeleton__panel-title--short"></span>
        </div>
        <div
          v-for="row in 2"
          :key="row"
          class="page-route-skeleton__action-row"
        >
          <span class="page-route-skeleton__block page-route-skeleton__action-icon"></span>
          <div class="page-route-skeleton__action-info">
            <span class="page-route-skeleton__block page-route-skeleton__action-title"></span>
            <span class="page-route-skeleton__block page-route-skeleton__action-desc"></span>
          </div>
          <span class="page-route-skeleton__block page-route-skeleton__action-arrow"></span>
        </div>
      </section>
    </div>
    <section class="page-route-skeleton__panel page-route-skeleton__timeline">
      <div class="page-route-skeleton__panel-header">
        <span class="page-route-skeleton__block page-route-skeleton__panel-title page-route-skeleton__panel-title--short"></span>
      </div>
      <div
        v-for="row in 3"
        :key="row"
        class="page-route-skeleton__timeline-row"
      >
        <div class="page-route-skeleton__timeline-info">
          <span class="page-route-skeleton__block page-route-skeleton__timeline-title"></span>
          <span class="page-route-skeleton__block page-route-skeleton__timeline-desc"></span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts" name="PageRouteSkeletonContent">
</script>
