<template>
  <div class="entity-card" :class="{ interactive }">
    <div class="ec-top">
      <div v-if="$slots.icon" class="ec-icon">
        <slot name="icon" />
      </div>

      <div class="ec-title-wrap">
        <div v-if="$slots.title || title" class="ec-title">
          <slot name="title">{{ title }}</slot>
          <span v-if="$slots.badges" class="ec-badges">
            <slot name="badges" />
          </span>
        </div>

        <div v-if="$slots.subtitle || subtitle" class="ec-subtitle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </div>
      </div>

      <div v-if="$slots.action" class="ec-action" @click.prevent.stop>
        <slot name="action" />
      </div>
    </div>

    <div v-if="$slots.body" class="ec-body">
      <slot name="body" />
    </div>

    <div v-if="$slots.footer" class="ec-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * EntityCard —— "图标 + 标题 + 徽标 + 内容 + 底栏"的实体卡统一骨架。
 *
 * 约定：本组件只渲染 <div>，不承担跳转。如果卡片要点击跳转，请在调用处包 <RouterLink>，
 *      本组件内部用 :interactive 开启 hover 样式。这样避免链接嵌套和 resolve 组件的复杂度。
 *
 * Slot 分区：
 *   icon       左上角图标
 *   title      标题文字
 *   badges     标题右侧的徽标组（src-chip / form-pill / status-pill）
 *   subtitle   副标题（版本 / app 标签 / 位置）
 *   action     右上角的原位操作（自动 .stop）
 *   body       主体（summary / metrics / list）
 *   footer     底栏（协作者 + 时间）
 */
withDefaults(
  defineProps<{
    interactive?: boolean
    title?: string
    subtitle?: string
  }>(),
  { interactive: true }
)
</script>

<style scoped>
.entity-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  border-radius: var(--jet-theme-radius-sm);
  color: var(--ink-1);
  overflow: hidden;
  min-width: 0;
  transition: all 0.15s ease;
    padding: 1rem;
}
.entity-card.interactive {
  cursor: pointer;
}
.entity-card.interactive:hover {
  border-color: var(--line-strong);
  box-shadow: var(--shadow-lifted);
  transform: translateY(-0.125rem);
}

.ec-top {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding-bottom
  : 0.875rem;
}
.ec-icon { flex-shrink: 0; }

.ec-title-wrap {
  flex: 1;
  min-width: 0;
}
.ec-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--fs-16);
  font-weight: 600;
  color: var(--ink-1);
  flex-wrap: wrap;
}
.ec-badges {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  flex-wrap: wrap;
}
.ec-subtitle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--ink-3);
  font-size: var(--fs-12);
  margin-top: var(--space-1);
  flex-wrap: wrap;
}

.ec-action { flex-shrink: 0; }

.ec-body {
  flex: 1;
  padding-bottom: 0.875rem;
    border-top: 1px dashed var(--line);
}
.ec-footer {
  margin-top: auto;
  padding-top: 0.625rem;
  //background: var(--bg-sunken);
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
}</style>
