<template>
  <div class="slanted-tabs" :aria-busy="state.loading || undefined">
    <div v-if="options.length" class="slanted-tabs__nav" role="tablist" aria-orientation="horizontal">
      <button
        v-for="(option, index) in options"
        :id="tabId(option.key)"
        :key="option.key"
        type="button"
        role="tab"
        class="slanted-tabs__tab"
        :class="{ 'is-active': option.key === selectedKey }"
        :style="{ '--tab-layer': option.key === selectedKey ? options.length + 1 : options.length - index }"
        :aria-selected="option.key === selectedKey"
        :aria-controls="$slots.default ? panelId(option.key) : undefined"
        :tabindex="option.key === selectedKey ? 0 : -1"
        :disabled="option.disabled || state.loading"
        @click="select(option.key)"
        @keydown="onKeydown($event, option.key)"
      >
        <span class="slanted-tabs__label">
          <slot name="tab" :option="option" :active="option.key === selectedKey">
            <span>{{ option.label }}</span>
            <span v-if="option.count != null" class="slanted-tabs__count">{{ option.count }}</span>
          </slot>
        </span>
      </button>
    </div>
    <template v-if="$slots.default && !state.loading && !state.error">
      <template v-for="option in options" :key="option.key">
        <div
          v-if="visitedKeys.has(option.key)"
          v-show="option.key === selectedKey"
          :id="panelId(option.key)"
          class="slanted-tabs__panel"
          role="tabpanel"
          :aria-labelledby="tabId(option.key)"
          tabindex="0"
        >
          <slot :option="option" :active-key="selectedKey" />
        </div>
      </template>
    </template>
    <div v-if="state.loading" class="slanted-tabs__feedback">
      <slot name="loading"><Spin /></slot>
    </div>
    <div v-else-if="state.error" class="slanted-tabs__feedback" role="alert">
      <slot name="error" :error="state.error">
        <Alert type="error" :message="state.error" show-icon />
      </slot>
    </div>
    <div v-else-if="!options.length" class="slanted-tabs__feedback">
      <slot name="empty"><Empty :description="state.emptyText" /></slot>
    </div>
  </div>
</template>

<script setup lang="ts" name="SlantedTabs">
import type { PropType } from 'vue'
import { Alert, Empty, Spin } from 'ant-design-vue'
import type { SlantedTabKey, SlantedTabOption, SlantedTabsState } from './types'
import { useSlantedTabs } from './useSlantedTabs'

interface SlantedTabsEmits {
  (event: 'update:activeKey', key: SlantedTabKey): void
  (event: 'change', key: SlantedTabKey): void
}

const props = defineProps({
  options: {
    type: Array as PropType<SlantedTabOption[]>,
    default: () => [],
  },
  activeKey: {
    type: [String, Number] as PropType<SlantedTabKey>,
    default: undefined,
  },
  state: {
    type: Object as PropType<SlantedTabsState>,
    default: () => ({}),
  },
})

const emit = defineEmits<SlantedTabsEmits>()
const { selectedKey, visitedKeys, select, onKeydown, tabId, panelId } = useSlantedTabs(props, emit)
</script>

<style scoped>
.slanted-tabs {
  min-width: 0;
  /* color 专用于页签轮廓，文字单独设色；em 尺寸跟随组件字号。 */
  color: #fff;
  font-size: var(--slanted-tabs-font-size, 1rem);
  --slanted-tabs-height: 2.5em;
  --slanted-tabs-min-width: 8em;
  --slanted-tabs-overlap: 0.5em;
}

.slanted-tabs__nav {
  display: flex;
  padding: var(--slanted-tabs-nav-padding, 0);
  overflow-x: auto;
  isolation: isolate;
  background: var(--slanted-tabs-background, linear-gradient(105deg, #dfe6f6, #edf0f5 65%, #f3f5f8));
}

.slanted-tabs__tab {
  position: relative;
  z-index: var(--tab-layer);
  display: flex;
  flex: 0 0 auto;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  height: var(--slanted-tabs-height);
  min-width: var(--slanted-tabs-min-width);
  padding: 0 1.5em;
  border: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  font-family: var(--slanted-tabs-font-family, 'Microsoft YaHei', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
  font-size: inherit;
  font-weight: 400;
  line-height: 1.5;
  cursor: pointer;
  appearance: none;
}

.slanted-tabs__tab + .slanted-tabs__tab {
  margin-left: calc(-1 * var(--slanted-tabs-overlap));
}

/* 单层渐变经 SVG 遮罩裁切，避免拼接接缝；128 × 40 为参考轮廓基准。 */
.slanted-tabs__tab::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--slanted-tabs-inactive-bg, linear-gradient(90deg, color-mix(in srgb, currentColor 20%, transparent) 11.72%, color-mix(in srgb, currentColor 60%, transparent) 75%));
  -webkit-mask: url('./shape.svg') 0 0 / 100% 100% no-repeat;
  mask: url('./shape.svg') 0 0 / 100% 100% no-repeat;
  pointer-events: none;
}

.slanted-tabs__tab.is-active .slanted-tabs__label {
  color: var(--ink-1, #20242d);
  font-weight: 500;
}

.slanted-tabs__tab.is-active::before {
  background: var(--slanted-tabs-active-bg, currentColor);
}

.slanted-tabs__tab:focus-visible {
  outline: none;
}

.slanted-tabs__tab:focus-visible .slanted-tabs__label {
  outline: calc(2em / 14) solid var(--accent, #1677ff);
  outline-offset: calc(5em / 14);
  border-radius: calc(2em / 14);
}

.slanted-tabs__tab:not(:disabled):hover .slanted-tabs__label {
  color: var(--ink-1, #20242d);
}

.slanted-tabs__tab:disabled {
  cursor: not-allowed;
}

.slanted-tabs__tab:disabled .slanted-tabs__label {
  opacity: 0.45;
}

.slanted-tabs__label {
  position: relative;
  display: inline-flex;
  align-items: baseline;
  gap: 0.5em;
  color: var(--ink-3, #8793a3);
  white-space: nowrap;
}

.slanted-tabs__count {
  font-variant-numeric: tabular-nums;
}

.slanted-tabs__panel,
.slanted-tabs__feedback {
  color: var(--ink-1, #20242d);
  background: var(--slanted-tabs-panel-bg, var(--slanted-tabs-active-bg, #fff));
}

.slanted-tabs__feedback {
  padding: var(--space-6, 24px);
  text-align: center;
}
</style>
