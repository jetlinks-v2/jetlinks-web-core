<template>
  <div
    v-if="actions.length"
    class="card-tools"
    :class="[`card-tools--${layout}`, { 'card-tools--active': active }]"
  >
    <div
      v-for="item in orderedActions"
      :key="item.key"
      class="card-button"
      :class="{ delete: item.key === 'delete', 'card-button--primary': item === primaryAction }"
      @click.stop
    >
      <slot
        name="actions"
        v-bind="item"
        :is-primary="item === primaryAction"
        :button-type="buttonType(item)"
      >
        <j-permission-button
          :disabled="handleFuncValue(item.disabled, value)"
          :popConfirm="item.popConfirm ? {
            title: handleFuncValue(item.popConfirm.title, value),
            onConfirm: (event: MouseEvent) => { item.popConfirm?.onConfirm?.(value, event) },
          } : null"
          :tooltip="item.tooltip ? { title: handleFuncValue(item.tooltip.title, value) } : null"
          :type="buttonType(item)"
          :style="layout === 'equal' ? { padding: 0, width: '100%' } : undefined"
          :danger="item.key === 'delete'"
          :hasPermission="item.hasPermission"
          @click="(event: MouseEvent) => item.onClick?.(value, event)"
        >
          <AIcon v-if="item.key === 'delete'" type="DeleteOutlined" />
          <AIcon v-else-if="item !== primaryAction" :type="handleFuncValue(item.icon, value)" />
          <span v-if="layout === 'split' || item.key !== 'delete'">
            {{ handleFuncValue(item.text, value) }}
          </span>
        </j-permission-button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { handleFuncValue } from '@jetlinks-web-core/components/CrudTable/utils'
import type { CardBoxAction, CardBoxActionButtonType, CardBoxActionKey, CardBoxActionLayout } from './types'

const props = defineProps({
  actions: { type: Array as PropType<CardBoxAction[]>, default: () => [] },
  value: { type: Object as PropType<Record<string, unknown>>, required: true },
  layout: { type: String as PropType<CardBoxActionLayout>, default: 'equal' },
  primaryActionKey: { type: [String, Number] as PropType<CardBoxActionKey>, default: undefined },
  active: { type: Boolean, default: false },
})

const visibleActions = computed(() => props.actions.filter(item => handleFuncValue(item.show === undefined ? true : item.show, props.value)))
// 主操作必须由调用方指定；被隐藏或未指定时，不把删除等其他动作提升为主按钮。
const primaryAction = computed(() => props.layout === 'split'
  ? visibleActions.value.find(item => item.key === props.primaryActionKey)
  : undefined)
// DOM 顺序与视觉顺序一致，键盘导航先经过左侧次级操作，再到右侧主操作。
const orderedActions = computed(() => primaryAction.value
  ? [...visibleActions.value.filter(item => item !== primaryAction.value), primaryAction.value]
  : visibleActions.value)

const buttonType = (item: CardBoxAction): CardBoxActionButtonType => props.layout === 'equal'
  ? 'link'
  : item === primaryAction.value ? 'primary' : 'text'
</script>

<style scoped>
.card-tools {
  display: flex;
  padding: 0 var(--panel-padding, var(--space-4)) var(--panel-padding, var(--space-4));
  gap: var(--panel-gap, var(--space-4));
}
.card-tools--active {
  padding-right: calc(var(--space-5) + 2.75rem);
}
.card-tools--equal .card-button {
  display: flex;
  flex-grow: 1;
}
.card-tools--equal .card-button > :deep(span, button) {
  width: 100%;
}
.card-tools--equal .card-button :deep(button) {
  width: 100%;
  background: var(--card-box-background);
  border: var(--jet-theme-stroke-width) solid var(--jet-theme-border-color-1);
  color: var(--jet-theme-primary, var(--accent));
}
.card-tools--equal .card-button :deep(button):hover {
  background-color: var(--jet-theme-primary-hover);
  border-color: var(--jet-theme-primary-hover);
}
.card-tools--equal .card-button :deep(button):hover span {
  color: var(--accent-ink) !important;
}
.card-tools--equal .card-button :deep(button):active {
  background-color: var(--jet-theme-primary-active);
  border-color: var(--jet-theme-primary-active);
}
.card-tools--equal .card-button :deep(button):active span {
  color: var(--accent-ink) !important;
}
.card-tools--equal .card-button.delete {
  flex: 1;
}
.card-tools--equal .card-button :deep(button[disabled]) {
  background: color-mix(in srgb, var(--jet-theme-text, var(--ink-1)) 4%, var(--jet-theme-bg-container, var(--bg)));
  border-color: var(--jet-theme-border, var(--ink-4));
}
.card-tools--equal .card-button :deep(button[disabled]) span {
  color: var(--jet-theme-text-secondary, var(--ink-4)) !important;
}
.card-tools--equal .card-button :deep(button[disabled]):hover,
.card-tools--equal .card-button :deep(button[disabled]):active {
  background-color: color-mix(in srgb, var(--jet-theme-text, var(--ink-1)) 8%, var(--jet-theme-bg-container, var(--bg)));
}
.card-tools--split {
  container-type: inline-size;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-1);
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
  border-top: var(--jet-theme-stroke-width) solid var(--jet-theme-border-color-1);
}
.card-tools--split .card-button {
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex: 0 0 auto;
}
.card-tools--split .card-button--primary {
  margin-inline-start: auto;
}
.card-tools--split .card-button :deep(.ant-btn) {
  max-width: 100%;
  height: 2.5rem;
  overflow: hidden;
  font-size: var(--fs-14);
  text-overflow: ellipsis;
}
.card-tools--split .card-button :deep(.ant-btn-text) {
  padding-inline: var(--space-2);
}
.card-tools--split .card-button :deep(.ant-btn-text:not(.ant-btn-dangerous):not(:disabled)) {
  color: var(--jet-theme-text-secondary);
}
.card-tools--split .card-button :deep(.ant-btn-primary) {
  padding-inline: var(--space-5);
}
/* 极窄卡片优先保留操作文字，按钮仍在卡片范围内换行。 */
@container (max-width: 7.5rem) {
  .card-tools--split .card-button :deep(.ant-btn) {
    padding-inline: var(--space-1);
  }
  .card-tools--split .card-button :deep(.ant-btn .anticon) {
    display: none;
  }
  .card-tools--split .card-button :deep(.ant-btn > span) {
    margin-inline-start: 0;
  }
}
</style>
