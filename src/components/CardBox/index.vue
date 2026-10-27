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
                  <j-ellipsis>{{ _item?.value ?? $t('comm.table.empty') }}</j-ellipsis>
                </a-col>
              </a-row>
            </slot>
          </div>
        </div>
      </div>
      <div class="card-mask" v-if="props.hasMark">
        <div class="mask-content">
          <slot name="mark"/>
        </div>
      </div>
    </div>
    <!-- 自定义底栏保留原契约，默认底栏统一主次按钮布局。 -->
    <slot name="bottom-tool">
      <CardBoxActions
        v-if="showTool && actions && actions.length"
        :actions="actions"
        :value="value"
        :layout="actionLayout"
        :primary-action-key="primaryActionKey"
        :active="active"
      >
        <template v-if="slots.actions" #actions="item">
          <slot name="actions" v-bind="item" />
        </template>
      </CardBoxActions>
    </slot>
    <!-- 选中态角标需要贴合整张卡片，而不是内容区。 -->
    <div v-if="active" class="checked-icon">
      <div>
        <AIcon type="CheckOutlined"/>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name='CardBox'>
import {getHexColor} from '@jetlinks-web/components/es/BadgeStatus/color';
import {useSlots, type PropType} from 'vue';
import i18n from '@jetlinks-web-core/locales';
import { cardAppearanceProps, useCardAppearanceStyle } from './appearance';
import CardBoxActions from './CardBoxActions.vue';
import type { CardBoxAction, CardBoxActionKey, CardBoxActionLayout } from './types';

type EmitProps = {
  // (e: 'update:modelValue', data: Record<string, any>): void;
  (e: 'click', data: Record<string, any>): void;
};

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
    type: Array as PropType<CardBoxAction[]>,
    default: () => [],
  },
  actionLayout: {
    type: String as PropType<CardBoxActionLayout>,
    default: 'equal',
  },
  primaryActionKey: {
    type: [String, Number] as PropType<CardBoxActionKey>,
    default: undefined,
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

const handleClick = () => {
  emit('click', props.value);
};
</script>

<style scoped src="./style.css"></style>
