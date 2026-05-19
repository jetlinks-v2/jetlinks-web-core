<template>
  <div class="chip-group" :class="`style-${styleVariant}`">
    <span v-if="label" class="label">{{ label }}</span>
    <button
      v-for="opt in options"
      :key="String(opt.key)"
      class="chip"
      :class="[
        { active: opt.key === modelValue, interactive: !disabled },
        opt.variantClass,
      ]"
      :disabled="disabled"
      @click="onClick(opt.key)"
    >
      <span v-if="opt.dot" class="dot" :style="{ background: opt.dot }" />
      {{ opt.label }}
      <span v-if="opt.count !== undefined" class="count">{{ opt.count }}</span>
    </button>

    <slot name="after" />
  </div>
</template>

<script setup lang="ts">
/**
 * ChipGroup —— "label + 横向 chip 按钮 + 选中高亮"的通用骨架
 *
 * 两种视觉 style：
 *   wrapped  带 0.0625rem border + 白底容器（FormBar / SrcBar / studio-cats）
 *   inline   无容器（ProjectToolbar.pj-tabs / hero-meta 风格）
 *
 * options[].variantClass：可选，调用方可传入 'f-event' / 's-official' 等 class
 *   让某条 chip 在非激活态也显示自己的色（如 FormBar 里"事件识别型"粉色）
 */

interface ChipOption<K extends string> {
  key: K
  label: string
  count?: number | string
  dot?: string
  variantClass?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: ChipOption<string>[]
    label?: string
    disabled?: boolean
    styleVariant?: 'wrapped' | 'inline'
  }>(),
  {
    styleVariant: 'wrapped',
  }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function onClick(key: string) {
  if (props.disabled) return
  emit('update:modelValue', key)
}
</script>

<style scoped>
.chip-group {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.style-wrapped {
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--r-2);
}

.label {
  color: var(--ink-3);
  font-size: var(--fs-12);
  margin-right: 0.125rem;
}

.chip {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.1875rem 0.625rem;
  border-radius: 62.4375rem;
  font-size: var(--fs-12);
  color: var(--ink-2);
  transition: all 0.15s;
}
.chip.interactive:hover {
  background: var(--bg-sunken);
}

.chip .dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  flex-shrink: 0;
}
.chip .count {
  color: var(--ink-4);
  font-size: var(--fs-12);
  margin-left: 0.125rem;
}

/* 激活态 —— 主色填充 */
.chip.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 500;
}
.chip.active .count { color: var(--accent); }

/* variantClass 色彩（非激活态也保持自己的色，全走 token） */
.chip.f-event    { color: var(--ink-1); }
.chip.f-patrol   { color: var(--ink-1); }
.chip.f-behavior { color: var(--ink-1); }
.chip.f-skill    { color: var(--ok); }
.chip.s-official { color: var(--ink-1); }
.chip.s-self     { color: var(--ink-1); }
.chip.s-market   { color: var(--ink-1); }

/* 激活态覆盖，不让 variant 色盖过主色 */
.chip.active.f-event,
.chip.active.f-patrol,
.chip.active.f-behavior,
.chip.active.f-skill,
.chip.active.s-official,
.chip.active.s-self,
.chip.active.s-market {
  color: var(--accent);
}</style>
