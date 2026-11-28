<template>
  <div class="slanted-tabs" :class="{ 'slanted-tabs--small': size === 'small', 'slanted-tabs--flush': flush, 'slanted-tabs--fill': fill }" :aria-busy="state.loading || undefined">
    <DefineTabLabel v-slot="{ option }">
      <slot name="tab" :option="option" :active="option.key === selectedKey">
        <AIcon v-if="option.icon" class="slanted-tabs__icon" :type="option.icon" aria-hidden="true" />
        <span>{{ option.label }}</span>
        <SkeletonText v-if="option.countLoading" :width="20" :height="16" />
        <span v-else-if="option.count != null" class="slanted-tabs__count">{{ option.count }}</span>
      </slot>
    </DefineTabLabel>
    <div v-if="options.length" ref="containerRef" class="slanted-tabs__nav" @wheel="onWheel">
      <div
        class="slanted-tabs__viewport"
        :class="{ 'has-hidden-left': canScrollLeft, 'has-hidden-right': canScrollRight }"
      >
        <div
          ref="scrollRef"
          class="slanted-tabs__scroller"
          role="tablist"
          aria-orientation="horizontal"
          @scroll="onScroll"
        >
          <div ref="listRef" class="slanted-tabs__list">
            <div v-for="(option, index) in options" :key="option.key" class="slanted-tabs__item"
              :style="{ '--tab-layer': option.key === selectedKey ? options.length + 1 : options.length - index }">
              <button
                :id="tabId(option.key)"
                type="button"
                role="tab"
                class="slanted-tabs__tab"
                :class="{ 'is-active': option.key === selectedKey }"
                :aria-selected="option.key === selectedKey"
                :aria-controls="$slots.default ? panelId(option.key) : undefined"
                :tabindex="option.key === selectedKey ? 0 : -1"
                :disabled="option.disabled || state.loading"
                @click="select(option.key)"
                @keydown="onKeydown($event, option.key)"
              >
                <svg v-if="option.key === selectedKey" class="slanted-tabs__outline" viewBox="0 0 128 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path :d="outlinePath(index === 0)" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke" />
                </svg>
                <span class="slanted-tabs__label"><TabLabel :option="option" /></span>
              </button>
            <span v-if="$slots['tab-extra']" class="slanted-tabs__extra"><slot name="tab-extra" :option="option" /></span>
            </div>
          </div>
        </div>
      </div>
      <Dropdown
        v-if="hasOverflow"
        v-model:open="moreOpen"
        :trigger="['hover']"
        :disabled="state.loading"
        :destroy-popup-on-hide="true"
        placement="bottomRight"
      >
        <Button
          :id="moreTriggerId"
          type="text"
          class="slanted-tabs__more"
          :disabled="state.loading"
          :aria-label="t('components.SlantedTabs.more')"
          :aria-expanded="moreOpen"
          :aria-controls="moreMenuId"
          aria-haspopup="menu"
          @keydown="onMoreKeydown"
        >
          <template #icon><EllipsisOutlined aria-hidden="true" /></template>
        </Button>
        <template #overlay>
          <div ref="menuRef" tabindex="-1" @keydown.capture="onMenuKeydown">
            <Menu
              :id="moreMenuId"
              class="slanted-tabs__menu"
              :aria-label="t('components.SlantedTabs.more')"
              :selected-keys="selectedKey === undefined ? [] : [tabId(selectedKey)]"
            >
              <MenuItem
                v-for="option in hiddenOptions"
                :key="tabId(option.key)"
                :disabled="option.disabled || state.loading"
                @click="selectOverflow(option.key)"
              >
                <span class="slanted-tabs__menu-label"><TabLabel :option="option" /><slot name="tab-extra" :option="option" /></span>
              </MenuItem>
            </Menu>
          </div>
        </template>
      </Dropdown>
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

<script setup lang="ts">
import type { PropType } from 'vue'
import { Alert, Button, Dropdown, Empty, Menu, MenuItem, Spin } from 'ant-design-vue'
import SkeletonText from '../SkeletonText'
import { EllipsisOutlined } from '@ant-design/icons-vue'
import { createReusableTemplate } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { SlantedTabKey, SlantedTabOption, SlantedTabsState } from './types'
import { useSlantedTabs } from './useSlantedTabs'
import { useSlantedTabsOverflow } from './useSlantedTabsOverflow'

defineOptions({ name: 'SlantedTabs' })

interface SlantedTabsEmits {
  (event: 'update:activeKey', key: SlantedTabKey): void
  (event: 'change', key: SlantedTabKey): void
}

const props = defineProps({
  fill: { type: Boolean, default: false },
  flush: { type: Boolean, default: false },
  size: { type: String as PropType<'default' | 'small'>, default: 'default' },
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
  preserveDisabledActive: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<SlantedTabsEmits>()
const outlinePaths = {
  first: 'M0 40V8A8 8 0 0 1 8 0H113.44A8 8 0 0 1 121.28 6.43L128 40',
  joined: 'M0 40L6.72 6.43A8 8 0 0 1 14.56 0H113.44A8 8 0 0 1 121.28 6.43L128 40',
  flushFirst: 'M113.44 0A8 8 0 0 1 121.28 6.43L128 40',
  flushJoined: 'M0 40L6.72 6.43A8 8 0 0 1 14.56 0M113.44 0A8 8 0 0 1 121.28 6.43L128 40',
}
function outlinePath(first: boolean) {
  if (props.flush) return first ? outlinePaths.flushFirst : outlinePaths.flushJoined
  return first ? outlinePaths.first : outlinePaths.joined
}
const { t } = useI18n()
const [DefineTabLabel, TabLabel] = createReusableTemplate<{ option: SlantedTabOption }>()
const { selectedKey, visitedKeys, select, onKeydown, tabId, panelId } = useSlantedTabs(props, emit)
const {
  containerRef, scrollRef, listRef, menuRef, hasOverflow, canScrollLeft, canScrollRight,
  hiddenOptions, moreOpen, moreTriggerId, moreMenuId, selectOverflow,
  onMoreKeydown, onMenuKeydown, onWheel, onScroll,
} = useSlantedTabsOverflow(props, selectedKey, select, tabId)
</script>

<style scoped src="./style.css"></style>
