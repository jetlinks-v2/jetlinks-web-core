<template>
  <div ref="barRef" class="sticky-action-bar" :class="[positionClass, toneClass]">
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
 * 用于在已经是底部的容器内（比如 JlDrawerShell 的 #foot slot）；
 * 'floating' = 容器内水平居中的浮动操作条。
 *
 * default/info 语气不改变按钮；inverse 语气统一提示文字与 Ant Design 主次按钮样式。
 */

const props = withDefaults(
  defineProps<{
    /** 左侧提示文字（可被 #hint slot 覆盖） */
    hint?: string
    /** 'bottom' = sticky 底（默认），'inline' = 普通 flex，'floating' = 容器底部浮动 */
    position?: 'bottom' | 'inline' | 'floating'
    /** 可选视觉语气；默认值保持历史底栏样式 */
    tone?: 'default' | 'info' | 'inverse'
  }>(),
  { hint: '', position: 'bottom', tone: 'default' },
)

const barRef = ref<HTMLElement>()
const positionClass = computed(() => `sab-${props.position}`)
const toneClass = computed(() => `sab-${props.tone}`)

/** 供元素动效等外部交互取得实际根节点，不暴露组件内部布局结构。 */
function getElement() {
  return barRef.value
}

defineExpose({ getElement })
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

.sab-floating {
  position: absolute;
  right: 50%;
  bottom: var(--space-6);
  z-index: var(--z-modal);
  gap: var(--space-2);
  max-width: calc(100% - 3rem);
  min-height: 3rem;
  padding: var(--space-2);
  border-radius: var(--r-3);
  transform: translateX(50%);
}

.sab-info {
  flex-shrink: 0;
  padding: var(--space-3);
  border-top: 0;
  border-radius: var(--r-3);
  background: var(--info-bg);
}

.sab-info .sab-hint {
  color: inherit;
  font-size: inherit;
}

.sab-inverse {
  border: 0.0625rem solid color-mix(in srgb, var(--accent) 60%, transparent);
  background: color-mix(in srgb, var(--ink-1) 92%, var(--accent) 8%);
  box-shadow:
    0 0 0 0.0625rem color-mix(in srgb, var(--accent) 36%, transparent),
    0 1rem 2.5rem color-mix(in srgb, var(--ink-1) 22%, transparent);
}

.sab-inverse .sab-hint {
  overflow: hidden;
  padding: 0 var(--space-3);
  color: #fff;
  font-size: var(--fs-13);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sab-inverse :deep(.ant-btn:not(.ant-btn-primary)) {
  border-color: color-mix(in srgb, #fff 24%, transparent);
  color: #fff;
  background: transparent;
}

.sab-inverse :deep(.ant-btn:not(.ant-btn-primary):hover),
.sab-inverse :deep(.ant-btn:not(.ant-btn-primary):focus) {
  border-color: color-mix(in srgb, #fff 72%, transparent);
  color: #fff;
  background: color-mix(in srgb, #fff 10%, transparent);
}

.sab-inverse :deep(.ant-btn-primary) {
  min-width: 6rem;
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
}

@container (max-width: 56rem) {
  .sab-floating {
    right: var(--space-3);
    left: var(--space-3);
    bottom: var(--space-3);
    max-width: none;
    transform: none;
  }
}
</style>
