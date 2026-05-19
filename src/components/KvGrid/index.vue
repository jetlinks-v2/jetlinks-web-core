<template>
  <dl :class="['kv-grid', layoutClass, cellLayoutClass]" :style="layoutStyle">
    <div v-for="entry in items" :key="entry.label" class="kv-cell">
      <dt>{{ entry.label }}</dt>
      <dd :class="{ mono: entry.mono }">{{ entry.value }}</dd>
    </div>
    <slot />
  </dl>
</template>

<script setup lang="ts">
/**
 * KvGrid —— 平台级"键值字段表"（v2.9 · C 阶段抽出）
 *
 * 收口此前 vision/[id].vue / AgentIdentityPanel / CapVisionPanel 等多处
 * 手写的 .kv / .kv-cell / .kv-grid 字段栅格。
 *
 * 用法（数组 mode · 80% 场景）：
 *   <KvGrid :items="[
 *     { label: '输入', value: 'frameUrl' },
 *     { label: '输出', value: 'JSON', mono: true },
 *   ]" />
 *
 * 用法（slot mode · 自定义内容）：
 *   <KvGrid>
 *     <div class="kv-cell">
 *       <dt>负责人</dt>
 *       <dd><Avatar :user="owner" /></dd>
 *     </div>
 *   </KvGrid>
 *
 * cols 控制列数，默认 2；'stacked' = 单列堆叠（详情段用）。
 */

interface KvEntry {
  label: string
  value: string | number
  /** 等宽字体（API 端点 / id / schema 类）*/
  mono?: boolean
}

const props = withDefaults(
  defineProps<{
    items?: KvEntry[]
    /** 列数；'stacked' = 单列堆叠 */
    cols?: 1 | 2 | 3 | 'stacked'
    cellLayout?: 'stack' | 'inline'
    gap?: number
    labelWidth?: string
  }>(),
  { items: () => [], cols: 2, cellLayout: 'stack', gap: 10, labelWidth: '4.75rem' },
)

const layoutClass = computed(() => `cols-${props.cols}`)
const cellLayoutClass = computed(() => `cell-${props.cellLayout}`)

const layoutStyle = computed(() => ({
  gap: `${props.gap}px`,
  '--kv-label-w': props.labelWidth,
}))
</script>

<style scoped>
.kv-grid {
  display: grid;
  margin: 0;
  min-width: 0;
}
.cols-1     { grid-template-columns: 1fr; }
.cols-2     { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cols-3     { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cols-stacked { grid-template-columns: 1fr; }

.kv-cell {
  min-width: 0;
}
.cell-stack .kv-cell dt {
  font-size: var(--fs-12);
  color: var(--ink-4);
  margin-bottom: var(--space-1);
}
.cell-stack .kv-cell dd {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--ink-1);
  font-weight: 500;
  overflow-wrap: anywhere;
}
.cell-stack .kv-cell dd.mono { font-size: var(--fs-12);
}

.cell-inline .kv-cell {
  display: grid;
  grid-template-columns: var(--kv-label-w) minmax(0, 1fr);
  gap: var(--space-2);
  align-items: baseline;
  font-size: var(--fs-12);
  line-height: 1.65;
}

.cell-inline .kv-cell dt {
  color: var(--ink-4);
  font-size: var(--fs-12);
  font-weight: 500;
}

.cell-inline .kv-cell dd {
  margin: 0;
  color: var(--ink-1);
  overflow-wrap: anywhere;
}

.cell-inline .kv-cell dd.mono { font-size: var(--fs-12);
  color: var(--ink-2);
}

/* stacked 模式下 cell 间分隔线（详情段视觉） */
.cols-stacked .kv-cell {
  padding-bottom: var(--kv-stacked-gap, 0.5rem);
  border-bottom: 1px dashed var(--line);
}
.cols-stacked .kv-cell:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}</style>
