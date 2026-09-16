<template>
  <div class="switch-group" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      class="switch-group__item"
      :class="{ 'is-selected': option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      :disabled="isOptionDisabled(option)"
      @click="handleSelect(option)"
    >
      <slot name="option" :option="option" :selected="option.value === modelValue">
        <span class="switch-group__label">{{ option.label }}</span>
      </slot>
      <span v-if="option.count !== undefined" class="switch-group__count">{{ option.count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" name="SwitchGroup">
import type { PropType } from 'vue'
import type { SwitchGroupOption, SwitchGroupValue } from './types'

const props = defineProps({
  /** 当前选中值；无匹配项时全部选项均为未选中态 */
  modelValue: {
    type: [String, Number] as PropType<SwitchGroupValue | undefined>,
    default: undefined,
  },
  /** 选项列表，选中态与文案全部由调用方下发，组件不内置任何业务状态语义 */
  options: {
    type: Array as PropType<SwitchGroupOption[]>,
    default: () => [],
  },
  /** 分组语义标签，透传到容器 `aria-label` */
  ariaLabel: {
    type: String,
    default: '',
  },
  /** 整体禁用 */
  disabled: {
    type: Boolean,
    default: false,
  },
})

defineSlots<{
  /** 选项内容；默认渲染 option.label，需要状态点、图标等前缀时在插槽里自行组合 */
  option?: (props: { option: SwitchGroupOption; selected: boolean }) => unknown
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: SwitchGroupValue): void
  (event: 'change', value: SwitchGroupValue, option: SwitchGroupOption): void
}>()

const isOptionDisabled = (option: SwitchGroupOption) => props.disabled || Boolean(option.disabled)

/**
 * 选中项再次点击也会派发，是否按「取消选中」处理交由调用方决定；
 * 页面侧因此可以保留「再次点击已选中项回到全部」的既有交互。
 */
function handleSelect(option: SwitchGroupOption) {
  if (isOptionDisabled(option)) return
  emit('update:modelValue', option.value)
  emit('change', option.value, option)
}
</script>

<style scoped>
.switch-group {
  /* 设计给定的浅灰填充底；core 暂无等价语义 token，先收敛在组件局部变量内 */
  --switch-group-bg: #f7f8fa;
  display: inline-flex;
  box-sizing: border-box;
  align-items: center;
  gap: 2px;
  padding: 1px;
  border: 1px solid var(--line);
  border-radius: var(--r-1);
  background-color: var(--switch-group-bg);
  color: var(--ink-2);
}

.switch-group__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  font-family: inherit;
  font-size: var(--fs-14);
  line-height: 1;
  color: inherit;
  white-space: nowrap;
  background: transparent;
  border: 0;
  border-radius: var(--r-1);
  cursor: pointer;
  transition:
    color var(--motion-duration-fast) var(--motion-ease-standard),
    background-color var(--motion-duration-fast) var(--motion-ease-standard);
}

.switch-group__item:hover:not(:disabled) {
  color: var(--accent);
}

.switch-group__item.is-selected {
  color: var(--accent);
  background-color: var(--bg);
  border-radius: var(--r-2);
}

.switch-group__item:focus-visible {
  outline: none;
  box-shadow: var(--ring-active);
}

.switch-group__item:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.switch-group__count {
  font-size: var(--fs-12);
  font-variant-numeric: tabular-nums;
  color: inherit;
  opacity: 0.75;
}
</style>
