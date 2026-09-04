<template>
  <div
      class="card a-table-card-box"
      :class="{ 'card--active': active, 'card--borderless': !bordered, 'card--disabled': disabled }"
      :style="[
        appearanceStyle,
        {
          '--card-status-color': getHexColor(statusNames[status]),
          '--card-status-color-solid': getHexColor(statusNames[status], 1),
        },
      ]"
  >
    <div
        class="card-warp"
        @click="handleClick"
    >
      <div class="card-type" v-if="slots.type">
        <div class="card-type-text">
          <slot name="type"></slot>
        </div>
      </div>
      <div v-if="!slots.type" class="card-top-line"></div>
      <div v-if="showStatus" class="card-state-row">
        <div class="card-state">
          <div class="card-state-content">
            <j-badge-status
                :status="status"
                :text="statusText"
                :statusNames="statusNames"
            ></j-badge-status>
          </div>
        </div>
      </div>
      <div
          :class="{'card-content': true, 'card-content-no-state': !showStatus}"
      >
        <div class="card-content-main">
          <!-- 图片 -->
          <div class="card-item-avatar">
            <slot name="img">
              <img
                  :width="80"
                  :height="80"
                  v-if="imgUrl"
                  :src="imgUrl"
              />
            </slot>
          </div>
          <!-- 内容 -->
          <div class="card-item-body">
            <slot name="content">
              <j-ellipsis style="width: calc(100% - 6.25rem);">
                <span class="card-item-heard-name">
                  {{ value.name }}
                </span>
              </j-ellipsis>
              <a-row :gutter="24">
                <a-col v-for="(_item, index) in contentList" :key="index" :span="24 / contentList.length">
                  <div class="card-item-content-text">{{ _item?.text }}</div>
                  <j-ellipsis>{{ _item?.value ?? "--" }}</j-ellipsis>
                </a-col>
              </a-row>
            </slot>
          </div>
        </div>
        <!-- 勾选 -->
        <div v-if="active" class="checked-icon">
          <div>
            <AIcon type="CheckOutlined"/>
          </div>
        </div>
      </div>
      <div class="card-mask" v-if="props.hasMark">
        <div class="mask-content">
          <slot name="mark"/>
        </div>
      </div>
    </div>
    <!-- 按钮 -->
    <slot name="bottom-tool">
      <div
          v-if="showTool && actions && actions.length"
          class="card-tools"
      >
        <div
            v-for="item in _actions"
            :key="item.key"
            class="card-button"
            :class="{
                delete: item.key === 'delete',
            }"
            @click.stop
        >
          <slot name="actions" v-bind="item">
            <j-permission-button
                :disabled="handleFuncValue(item.disabled, value)"
                :popConfirm="item.popConfirm ? {
                  title: handleFuncValue(item.popConfirm.title, value),
                  onConfirm: (e) => {
                    item.popConfirm.onConfirm?.(value, e)
                  }
                } : null"
                :tooltip="item.tooltip ? {
                  title: handleFuncValue(item.tooltip.title, value)
                } : null"
                @click="(e) => item.onClick?.(value, e)"
                type="link"
                style="padding: 0;width: 100%"
                :danger="item.key === 'delete'"
                :hasPermission="item.hasPermission"
            >
              <AIcon type="DeleteOutlined" v-if="item.key === 'delete'"/>
              <template v-else>
                <AIcon :type="handleFuncValue(item.icon, value)"/>
                <span>{{ handleFuncValue(item?.text, value) }}</span>
              </template>
            </j-permission-button>
          </slot>
        </div>
      </div>
    </slot>
  </div>
</template>

<script setup lang="ts" name='CardBox'>
import {getHexColor} from '@jetlinks-web/components/es/BadgeStatus/color';
import {PropType} from 'vue';
import i18n from '@jetlinks-web-core/locales';
import {handleFuncValue} from "@jetlinks-web-core/components/CrudTable/utils";
import { cardAppearanceProps, useCardAppearanceStyle } from './appearance';

type EmitProps = {
  // (e: 'update:modelValue', data: Record<string, any>): void;
  (e: 'click', data: Record<string, any>): void;
};

type TableActionsType = any;

const emit = defineEmits<EmitProps>();
const slots = useSlots();

const props = defineProps({
  ...cardAppearanceProps,
  value: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
  showStatus: {
    type: Boolean,
    default: true,
  },
  showTool: {
    type: Boolean,
    default: true,
  },
  statusText: {
    type: String,
    default: () => i18n.global.t('DeviceAccess.accessModal.551011-8'),
  },
  status: {
    type: [String, Number] as PropType<string | number>,
    default: 'default',
  },
  statusNames: {
    type: Object as PropType<Record<any, any>>,
    default: () => ({'default': 'default'})
  },
  actions: {
    type: Array as PropType<TableActionsType[]>,
    default: () => [],
  },
  active: {
    type: Boolean,
    default: false,
  },
  hasMark: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  imgUrl: {
    type: String
  },
  contentList: {
    type: Array,
    default: []
  }
});

const appearanceStyle = useCardAppearanceStyle(() => props.backgroundOpacity);

const getBackgroundColor = (code: string) => {
  const _color1 = getHexColor(code, 0.03);
  const _color2 = getHexColor(code, 0);
  return `linear-gradient(
                188.4deg,
                ${_color1} 30%,
                ${_color2} 80%
            )`;
};

const _actions = computed(() => {
  return props.actions.filter(i => handleFuncValue(i.show === undefined ? true : i.show, props.value))
})

const handleClick = () => {
  emit('click', props.value);
};
</script>

<style scoped>
.card {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  overflow: hidden;
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-color-1);
  border-radius: var(--r-6);
  background: var(--card-box-background);
  transition: var(--card-shell-transition);
}
.card.card--active {
  border-color: var(--jet-theme-primary, var(--accent));
  box-shadow: var(--ring-active);
}
.card.card--borderless,
.card.card--borderless.card--active {
  border-color: transparent;
}
.card.card--disabled {
  filter: grayscale(100%);
}
.card.card--disabled .card-warp {
  cursor: not-allowed;
}
.card .checked-icon {
  position: absolute;
  right: -1.375rem;
  bottom: -1.375rem;
  z-index: 2;
  width: 2.75rem;
  height: 2.75rem;
  color: var(--accent-ink);
  background-color: var(--jet-theme-primary, var(--accent));
  transform: rotate(-45deg);
}
.card .checked-icon > div {
  position: relative;
  height: 100%;
  transform: rotate(45deg);
}
.card .checked-icon > div > span {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  font-size: var(--fs-12);
}
.card .card-warp {
  position: relative;
  cursor: pointer;
}
.card .card-warp:hover {
  box-shadow: none;
}
.card .card-warp:hover .card-mask {
  visibility: visible;
}
.card .card-warp .card-type {
  position: absolute;
  top: 0;
  left: -0.9375rem;
  height: 2rem;
  padding: 0 1.875rem;
  color: var(--ink-2);
  line-height: 2rem;
  background-color: color-mix(in srgb, var(--ink-1) 6%, transparent);
  transform: skewX(-45deg);
}
.card .card-warp .card-type .card-type-text {
  display: flex;
  align-items: center;
  justify-content: center;
  transform: skewX(45deg);
}
.card .card-warp .card-content {
  position: relative;
  padding: 0 var(--space-4) var(--space-5) var(--space-4);
  overflow: hidden;
}
.card-content.card-content-no-state {
  padding-top: var(--space-5) !important;
}
.card .card-warp .card-state-row {
  display: flex;
  min-height: 2rem;
  align-items: center;
  justify-content: flex-end;
}

.card .card-warp .card-content-main {
  display: flex;
  align-items: center;
  min-height: 5rem;
  gap: var(--space-4);
}
.card .card-warp .card-content .card-item-avatar {
  margin-right: var(--space-4);
  display: flex;
  align-items: center;
}
.card .card-warp .card-content .card-item-body {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: 0;
}
.card .card-warp .card-content .card-item-body .ant-row {
  margin-top: var(--space-3);
}
.card .card-warp .card-state {
  display: flex;
  align-items: center;
  min-width: 5rem;
  height: 2rem;
  justify-content: center;
  padding: 0 var(--space-3) 0 var(--space-5);
  background: var(--card-status-color);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 20% 100%);
  transform: none;
}
.card .card-warp .card-state.success {
  --card-status-color: var(--jet-theme-success, var(--ok));
}
.card .card-warp .card-state.warning {
  --card-status-color: var(--warn);
}
.card .card-warp .card-state.error {
  --card-status-color: var(--err);
}
.card .card-warp .card-state .card-state-content {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  transform: none;
}
.card .card-warp .card-state :deep(.ant-badge-status) {
  display: inline-flex;
  align-items: center;
  margin: 0;
}
.card .card-warp .card-state :deep(.ant-badge-status-dot) {
  margin-inline-end: var(--space-1);
}
.card .card-warp .card-content :deep(.card-item-content-title) {
  cursor: pointer;
  font-size: var(--fs-16);
  font-weight: 700;
  color: var(--jet-theme-primary, var(--accent));
  width: calc(100% - 6.25rem);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.card .card-warp .card-content :deep(.card-item-heard-name) {
  font-weight: 700;
  font-size: var(--fs-16);
  margin-bottom: var(--space-2);
}
.card .card-warp .card-content :deep(.card-item-content-text) {
  color: var(--ink-2);
  font-size: var(--fs-12);
}
.card .card-warp .card-top-line {
  position: absolute;
  top: 0;
  left: var(--space-5);
  display: block;
  width: 8%;
  min-width: 3rem;
  height: 0.125rem;
  background-image: linear-gradient(90deg, var(--card-status-color-solid), var(--card-status-color));
  clip-path: polygon(0 0, 100% 0, 98% 100%, 2% 100%);
  background-repeat: no-repeat;
  background-size: 100% 100%;
}
.card .card-warp .card-mask {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--accent-ink);
  background-color: color-mix(in srgb, var(--ink-1) 50%, transparent);
  visibility: hidden;
  cursor: pointer;
  transition: all 0.3s;
}
.card .card-warp .card-mask .mask-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 !important;
}
.card.item-active {
  position: relative;
  color: var(--jet-theme-primary, var(--accent));
  border-color: var(--jet-theme-primary, var(--accent));
}
.card.item-active .checked-icon {
  display: block;
}
.card .card-tools {
  display: flex;
  padding: 0 var(--space-4) var(--space-5) var(--space-5);
  gap: var(--space-3);
}
.card .card-tools .card-button {
  display: flex;
  flex-grow: 1;
}
.card .card-tools .card-button > :deep(span, button) {
  width: 100%;
}
.card .card-tools .card-button :deep(button) {
  width: 100%;
  background: var(--card-box-background);
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-color-1);
  color: var(--jet-theme-primary, var(--accent));
}
.card .card-tools .card-button :deep(button):hover {
  background-color: var(--jet-theme-primary-hover);
  border-color: var(--jet-theme-primary-hover);
}
.card .card-tools .card-button :deep(button):hover span {
  color: var(--accent-ink) !important;
}
.card .card-tools .card-button :deep(button):active {
  background-color: var(--jet-theme-primary-active);
  border-color: var(--jet-theme-primary-active);
}
.card .card-tools .card-button :deep(button):active span {
  color: var(--accent-ink) !important;
}
.card .card-tools .card-button.delete {
  flex: 1;
}
.card .card-tools .card-button :deep(button[disabled]) {
  background: color-mix(in srgb, var(--jet-theme-text, var(--ink-1)) 4%, var(--jet-theme-bg-container, var(--bg)));
  border-color: var(--jet-theme-border, var(--ink-4));
}
.card .card-tools .card-button :deep(button[disabled]) span {
  color: var(--jet-theme-text-secondary, var(--ink-4)) !important;
}
.card .card-tools .card-button :deep(button[disabled]):hover {
  background-color: color-mix(in srgb, var(--jet-theme-text, var(--ink-1)) 8%, var(--jet-theme-bg-container, var(--bg)));
}
.card .card-tools .card-button :deep(button[disabled]):active {
  background-color: color-mix(in srgb, var(--jet-theme-text, var(--ink-1)) 8%, var(--jet-theme-bg-container, var(--bg)));
}</style>
