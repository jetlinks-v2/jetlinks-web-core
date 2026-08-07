<template>
  <div class="overview-card">
    <img
      class="overview-card__background"
      src="/overview/background.svg"
      alt=""
      aria-hidden="true"
    />

    <div class="overview-card__main">
      <div v-if="$slots.image || image" class="overview-card__image">
        <slot name="image">
          <img :src="image" :alt="imageAlt" />
        </slot>
      </div>

      <div class="overview-card__content">
        <div v-if="$slots.title || title" class="overview-card__title">
          <slot name="title">{{ title }}</slot>
        </div>
        <div v-if="$slots.description || description" class="overview-card__description">
          <j-ellipsis>
            <slot name="description">{{ description }}</slot>
          </j-ellipsis>
        </div>
      </div>
    </div>

    <div class="overview-card__value">
      <slot name="value">{{ value }}</slot>
      <span v-if="$slots.suffix || suffix" class="overview-card__suffix">
        <slot name="suffix">{{ suffix }}</slot>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts" name="OverviewCard">
/**
 * OverviewCard —— 用于概览、总览场景的轻量指标卡片。
 *
 * 左侧展示图片、标题和描述，右侧突出展示数量。
 * 图片、标题、描述、数量和后缀均可通过同名 slot 自定义。
 */
withDefaults(
  defineProps<{
    title?: string
    description?: string
    value?: string | number
    image?: string
    imageAlt?: string
    suffix?: string
  }>(),
  {
    title: '',
    description: '',
    value: 0,
    image: '',
    imageAlt: '',
    suffix: '',
  },
)
</script>

<style scoped>
.overview-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 1rem);
  min-width: 0;
  min-height: 5.5rem;
  overflow: hidden;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 2px 0 rgba(13, 13, 18, 0.06);
}

.overview-card__background {
  position: absolute;
  top: 50%;
  right: 0;
  width: 142px;
  height: 142px;
  -webkit-mask-image: radial-gradient(ellipse at right center, #000 0%, #000 45%, transparent 100%);
  mask-image: radial-gradient(ellipse at right center, #000 0%, #000 45%, transparent 100%);
  pointer-events: none;
  transform: translateY(-50%);
}

.overview-card__main {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  min-width: 0;
}

.overview-card__image {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: var(--r-2, 0.75rem);
  background: var(--bg-sunken, #f5f5f5);
  color: var(--accent, #1677ff);
  font-size: 40px;
}

.overview-card__image img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.overview-card__image :deep(.anticon) {
  font-size: inherit;
}

.overview-card__content {
  min-width: 0;
}

.overview-card__title {
  overflow: hidden;
  color: #4e5969;
  font-size: var(--fs-16, 1rem);
  font-weight: 500;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-card__description {
  margin-top: var(--space-1, 0.25rem);
  min-width: 0;
  max-width: 100%;
  color: #86909c;
  font-size: 13px;
  line-height: 1.5;
}

.overview-card__value {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: baseline;
  flex-shrink: 0;
  margin-right: 0.5rem;
  color: #1d2129;
  font-size: 24px;
  font-weight: 500;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.overview-card__suffix {
  margin-left: var(--space-1, 0.25rem);
  color: var(--ink-2, rgba(0, 0, 0, 0.65));
  font-size: var(--fs-14, 0.875rem);
  font-weight: 400;
}
</style>
