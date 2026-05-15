<template>
  <div class="page-route-skeleton" aria-hidden="true">
    <div class="page-route-skeleton__header">
      <span class="page-route-skeleton__block page-route-skeleton__title"></span>
      <span class="page-route-skeleton__block page-route-skeleton__action"></span>
    </div>
    <div class="page-route-skeleton__filter">
      <span
        v-for="item in 3"
        :key="item"
        class="page-route-skeleton__block page-route-skeleton__field"
      ></span>
    </div>
    <div class="page-route-skeleton__toolbar">
      <span class="page-route-skeleton__block page-route-skeleton__button"></span>
      <span class="page-route-skeleton__block page-route-skeleton__button page-route-skeleton__button--short"></span>
    </div>
    <div class="page-route-skeleton__content">
      <div
        v-for="row in 7"
        :key="row"
        class="page-route-skeleton__row"
      >
        <span
          v-for="cell in 4"
          :key="cell"
          class="page-route-skeleton__block page-route-skeleton__cell"
        ></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="PageRouteSkeleton">
</script>

<style scoped lang="less">
.page-route-skeleton {
  width: 100%;
  min-height: min(560px, calc(100vh - 120px));
  padding: var(--space-5);
  background: var(--jet-theme-bg-layout, #f5f5f5);
}

.page-route-skeleton__header,
.page-route-skeleton__filter,
.page-route-skeleton__toolbar,
.page-route-skeleton__content {
  border-radius: var(--r-3, 8px);
  background: var(--jet-theme-bg-container, #fff);
  box-shadow: var(--shadow-1, 0 1px 0 rgba(0, 0, 0, 0.03));
}

.page-route-skeleton__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 var(--space-4);
}

.page-route-skeleton__filter {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding: var(--space-4);
}

.page-route-skeleton__toolbar {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
}

.page-route-skeleton__content {
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-4);
}

.page-route-skeleton__row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 80px;
  gap: var(--space-4);
  align-items: center;
  min-height: 44px;
  border-bottom: var(--jet-theme-stroke-width, 1px) solid var(--jet-theme-border-secondary, #f0f0f0);

  &:last-child {
    border-bottom: 0;
  }
}

.page-route-skeleton__block {
  position: relative;
  display: inline-block;
  overflow: hidden;
  height: 14px;
  border-radius: var(--r-1, 4px);
  background: color-mix(in srgb, var(--jet-theme-text, #1a1a1a) 7%, var(--jet-theme-bg-container, #fff));

  &::after {
    position: absolute;
    inset: 0 -150%;
    background: linear-gradient(
      90deg,
      transparent 25%,
      color-mix(in srgb, var(--jet-theme-text, #1a1a1a) 10%, transparent) 37%,
      transparent 63%
    );
    animation: page-route-skeleton-loading 1.4s ease infinite;
    content: '';
  }
}

.page-route-skeleton__title {
  width: 180px;
  height: 20px;
}

.page-route-skeleton__action {
  width: 96px;
  height: 32px;
}

.page-route-skeleton__field {
  width: 100%;
  height: 32px;
}

.page-route-skeleton__button {
  width: 88px;
  height: 28px;
}

.page-route-skeleton__button--short {
  width: 64px;
}

.page-route-skeleton__cell {
  width: 100%;
}

@keyframes page-route-skeleton-loading {
  0% {
    transform: translateX(-37.5%);
  }

  100% {
    transform: translateX(37.5%);
  }
}

@media (max-width: 768px) {
  .page-route-skeleton {
    padding: var(--space-3);
  }

  .page-route-skeleton__filter,
  .page-route-skeleton__row {
    grid-template-columns: 1fr;
  }
}
</style>
