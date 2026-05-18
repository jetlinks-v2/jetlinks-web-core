<template>
  <div
    class="rg"
    :style="gridStyle"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * ResponsiveGrid —— CLAUDE.md §8.2 响应式栅格规范的实体化
 *
 * 解决两个通用问题：
 *   1. 单项（或少数几项）时，auto-fit 会把仅有的那一列拉满整行宽度，
 *      视觉上卡片被异常撑大 —— 默认改用 auto-fill，保持占位空轨道
 *   2. grid item 必须 min-width:0，否则 1fr 遇到不肯缩的内容会撑破栅格
 *
 * Props：
 *   cols      固定列数(优先级最高)。指定后忽略 min/fill,直接 repeat(cols, ...)
 *             适合"一行 N 张卡"的明确设计需求(如工作台应用模板 6 张)。
 *             响应式由调用方在 scoped CSS 自行降级,组件内不内置断点。
 *   min       最小列宽（px 数字或 CSS 字符串），决定"几项挤一行"的阈值；
 *             cols 未指定时必填。
 *   max       每列最大宽度。指定后 grid track 上限收紧,children 不会被拉到
 *             超过此值；剩余空间由 justify-content 处理(默认 start 靠左)。
 *             用于"数据少时不让单卡过宽"的场景(如工作台应用模板 cols=3 时
 *             避免每卡 27.5rem 失真)。仅在 cols 模式下生效。
 *   gap       栅格间隔（默认 0.75rem）
 *   fill      'auto-fill'（默认，不撑开）| 'auto-fit'（老行为，单项拉满）;
 *             cols 指定时该 prop 被忽略。
 */
const props = withDefaults(
  defineProps<{
    cols?: number
    min?: number | string
    max?: number | string
    gap?: number | string
    fill?: 'auto-fill' | 'auto-fit'
  }>(),
  { gap: 12, fill: 'auto-fill' }
)

const toCss = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)

const gridStyle = computed(() => {
  if (props.cols && props.cols > 0) {
    const trackMax = props.max !== undefined ? toCss(props.max) : '1fr'
    return {
      gridTemplateColumns: `repeat(${props.cols}, minmax(0, ${trackMax}))`,
      gap: toCss(props.gap),
      ...(props.max !== undefined ? { justifyContent: 'start' } : {}),
    }
  }
  if (props.min === undefined) {
    // 防御:cols 和 min 都没传时,保持原有 12.5rem 默认值
    return {
      gridTemplateColumns: `repeat(${props.fill}, minmax(12.5rem, 1fr))`,
      gap: toCss(props.gap),
    }
  }
  return {
    gridTemplateColumns: `repeat(${props.fill}, minmax(${toCss(props.min)}, 1fr))`,
    gap: toCss(props.gap),
  }
})
</script>

<style scoped>
.rg {
  display: grid;
}
/* §8.2 硬规则：grid item 必须 min-width:0 */
.rg > :deep(*) {
  min-width: 0;
}</style>
