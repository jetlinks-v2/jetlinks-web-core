<template>
  <div class="ambient-card" :class="[`v-${variant}`, { padded }]">
    <slot />
  </div>
</template>

<script setup lang="ts">
/**
 * 通用"气氛卡"容器 —— 冷色三阶淡渐变 + 柔阴影 + 圆角，
 * 对应 CLAUDE.md §5.2 美学基线。
 *
 * 使用场景：Hero / 渐变大 banner / 精选大卡。
 * 卡片内容的布局（flex / grid）留给调用方写在 slot 里，
 * 本组件只负责外壳视觉。
 *
 * variant：
 *   hero      全三阶（冷→紫→粉），最常用，给 hero / AI 新建卡
 *   cool      冷色两阶（蓝→紫），featured primary
 *   warm      暖色两阶（紫→粉），featured secondary / studio hero
 *   flat      纯白 + 柔边 + 柔阴影（用于把样式统一到非渐变场景）
 */
withDefaults(
  defineProps<{
    variant?: 'hero' | 'cool' | 'warm' | 'flat'
    padded?: boolean
  }>(),
  {
    variant: 'hero',
    padded: true,
  }
)
</script>

<style scoped>
.ambient-card {
  border: 1px solid var(--line);
  border-radius: var(--r-3);
  box-shadow: var(--shadow-lifted);
}
.ambient-card.padded {
  padding: var(--space-6) var(--space-7);
}

.v-hero {
  background: var(--ambient-hero);
}
.v-cool {
  background: var(--ambient-cool);
}
.v-warm {
  background: var(--ambient-warm);
}
.v-flat {
  background: var(--bg);
  box-shadow: var(--shadow-1);
}</style>
