<template>
  <div
    class="metric-cards"
    :class="[
      `metric-cards--${layout}`,
      { 'metric-cards--empty': !items.length },
    ]"
  >
    <div
      v-for="(item, index) in items"
      :key="item.key ?? item.label ?? index"
      class="metric-cards__item"
      :class="{
        'metric-cards__item--active': activeKey !== undefined && item.key === activeKey,
        'metric-cards__item--interactive': interactive,
      }"
      :role="interactive ? 'button' : undefined"
      :tabindex="interactive ? 0 : undefined"
      @click="handleItemClick(item)"
      @keydown.enter.prevent="handleItemClick(item)"
      @keydown.space.prevent="handleItemClick(item)"
    >
      <div
        v-if="item.icon || $slots.icon"
        class="metric-cards__icon"
        :style="getIconStyle(item)"
      >
        <AIcon :type="item.icon" />
      </div>

      <div class="metric-cards__content">
        <div class="metric-cards__label">
          {{ item.label }}
        </div>
        <div class="metric-cards__value">
          {{ item.value }}
        </div>
<!--        <div v-if="item.hint" class="metric-cards__hint">-->
<!--          {{ item.hint }}-->
<!--        </div>-->
<!--        <div v-if="item.desc" class="metric-cards__desc">-->
<!--          {{ item.desc }}-->
<!--        </div>-->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MetricCards">
import type { CSSProperties } from 'vue'
import type { MetricCardItem } from './types'

/** 统一承载跨模块指标项的展示、选中态与键盘触发契约。 */

withDefaults(
  defineProps<{
    items?: MetricCardItem[]
    activeKey?: string | number
    interactive?: boolean
    layout?: 'strip' | 'auto'
  }>(),
  {
    items: () => [],
    interactive: false,
    layout: 'strip',
  },
)

const emit = defineEmits<{
  (event: 'itemClick', item: MetricCardItem): void
}>()

const handleItemClick = (item: MetricCardItem) => {
  emit('itemClick', item)
}

const getIconStyle = (item: MetricCardItem): CSSProperties => {
  const iconColor = item.iconColor || 'var(--jet-theme-primary)'

  return {
    '--metric-card-icon-color': iconColor,
    '--metric-card-icon-bg': `color-mix(in srgb, ${iconColor} 10%, transparent)`,
  }
}
</script>

<style scoped lang="less">
.metric-cards {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  width: 100%;
  gap: var(--space-5);
}

.metric-cards--empty {
  display: none;
}

.metric-cards--auto {
  grid-auto-flow: row;
  grid-auto-columns: auto;
  grid-template-columns: repeat(auto-fill, minmax(13.75rem, 1fr));
  gap: var(--space-3);
}

.metric-cards__item {
  display: flex;
  align-items: center;
  min-width: 0;
  padding: var(--space-4);
  border: 0.0625rem solid var(--jet-theme-border-soft, transparent);
  border-radius: var(--jet-theme-radius-lg);
  background: var(--jet-theme-bg-container);
  box-shadow: var(--jet-theme-shadow-card, 0 0.5rem 1.5rem rgb(15 23 42 / 4%));
  gap: var(--space-4);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.metric-cards__item--interactive {
  cursor: pointer;
}

.metric-cards__item--interactive:hover,
.metric-cards__item--active {
  border-color: var(--jet-theme-primary);
  box-shadow: var(--jet-theme-shadow-secondary);
  transform: translateY(-0.0625rem);
}

.metric-cards__icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: var(--metric-card-icon-bg, color-mix(in srgb, var(--jet-theme-primary) 10%, transparent));
  color: var(--metric-card-icon-color, var(--jet-theme-primary));
  font-size: 1.375rem;
}

.metric-cards__icon :deep(svg) {
  width: 1.375rem;
  height: 1.375rem;
}

.metric-cards__content {
  min-width: 0;
}

.metric-cards__label {
  overflow: hidden;
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-cards__value {
  margin-top: var(--space-2);
  color: var(--jet-theme-text);
  font-size: var(--fs-24);
  font-weight: 700;
  line-height: 1.5rem;
}

.metric-cards__hint {
  overflow: hidden;
  margin-top: var(--space-1);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-cards__desc {
  margin-top: var(--space-2);
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-12);
  line-height: 1.375rem;
}

@media (max-width: 60rem) {
  .metric-cards {
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
}

@media (max-width: 36rem) {
  .metric-cards {
    grid-template-columns: 1fr;
  }
}
</style>
