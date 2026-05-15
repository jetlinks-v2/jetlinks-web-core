<template>
  <div class="sticky-action-bar" :class="positionClass">
    <div v-if="hint || $slots.hint" class="sab-hint">
      <slot name="hint">{{ hint }}</slot>
    </div>
    <div class="sab-actions">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * StickyActionBar —— 平台级 sticky 底栏 / 操作栏（v2.9 · C 阶段抽出）
 *
 * 收口此前 7 处手写的"页面 / 抽屉底部固定操作条"：
 *   - 智能体详情 ActionBar（保存草稿 / 安装到项目 等）
 *   - Showcase 加入项目 sticky CTA
 *   - 训练助手底部 hint + 删除 / 提交按钮
 *
 * 用法：
 *   <StickyActionBar hint="左侧提示文字">
 *     <button>取消</button>
 *     <button class="primary">提交</button>
 *   </StickyActionBar>
 *
 * 默认 position='bottom'（sticky 在容器底）；'inline' = 普通 flex 不 sticky，
 * 用于在已经是底部的容器内（比如 JlDrawerShell 的 #foot slot）。
 *
 * 不包含：按钮样式（用 design system 的 button class 或 a-button）。
 */

const props = withDefaults(
  defineProps<{
    /** 左侧提示文字（可被 #hint slot 覆盖） */
    hint?: string
    /** 'bottom' = sticky 底（默认），'inline' = 普通 flex 不 sticky */
    position?: 'bottom' | 'inline'
  }>(),
  { hint: '', position: 'bottom' },
)

const positionClass = computed(() => `sab-${props.position}`)
</script>

<style scoped>
.sticky-action-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg);
  border-top: 1px solid var(--line);
  z-index: 5;
}
.sab-bottom {
  position: sticky;
  bottom: 0;
  /* 微弱阴影，提示用户底栏存在 */
  box-shadow: var(--shadow-sticky-top);
}

.sab-inline {
  width: 100%;
  padding: 0;
  border-top: 0;
  background: transparent;
}

.sab-hint {
  flex: 1;
  min-width: 0;
  font-size: var(--fs-12);
  color: var(--ink-4);
  line-height: 1.5;
}
.sab-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}</style>
