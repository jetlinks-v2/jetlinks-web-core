<template>
  <section :id="id" class="section">
    <header class="section-head">
      <div class="left">
        <div class="section-title">
          <span class="ic" :style="{ background: iconBg, color: iconColor }">
            <AIcon :type="icon" />
          </span>
          <slot name="title">{{ title }}</slot>
        </div>
        <div class="section-sub">
          <slot name="sub">{{ sub }}</slot>
        </div>
      </div>
      <div v-if="$slots.actions" class="right">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
/**
 * SectionCard —— 白底大卡 + 顶部 header(icon + title + sub + actions) + 内容 slot
 *
 * 使用场景：
 *   - Agent 详情页 7 段（身份 / 提示词 / 入参 / 能力 / 运行时 / 响应 / 项目追加）
 *   - ChartPanel 外壳 adapter
 *   - 任何"白底卡 + 统一 header + 分组内容"的面板
 *
 * icon + title + sub 在左侧 / 右上角可选 #actions slot / #default slot 为内容
 */
withDefaults(
  defineProps<{
    id?: string
    title?: string
    sub?: string
    icon: string
    iconBg?: string
    iconColor?: string
  }>(),
  {
    iconBg: 'var(--jet-theme-primary-soft)',
    iconColor: 'var(--jet-theme-primary)',
  }
)
</script>

<style scoped>
.section {
  background: var(--jet-theme-bg-container);
  border: 0.0625rem solid var(--jet-theme-border);
  border-radius: var(--jet-theme-radius-lg);
  padding: 1.375rem 1.625rem;
  margin-bottom: 0.875rem;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding-bottom: 0.875rem;
  border-bottom: 0.0625rem solid var(--jet-theme-border);
}

.left { flex: 1; min-width: 0; }

.section-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-16);
  font-weight: 600;
  color: var(--jet-theme-text);
  line-height: 1.3;
  margin-bottom: var(--space-1);
}

.ic {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--jet-theme-radius);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.ic :deep(svg) { width: 0.75rem; height: 0.75rem; }

.section-sub {
  font-size: var(--fs-12);
  color: var(--jet-theme-text-disabled);
  line-height: 1.7;
}
.section-sub :deep(code) { font-size: var(--fs-12);
  background: var(--jet-theme-primary-soft);
  padding: 0.0625rem 0.3125rem;
  border-radius: var(--jet-theme-radius-sm);
  color: var(--jet-theme-text-secondary);
}

.right { flex-shrink: 0; }</style>
