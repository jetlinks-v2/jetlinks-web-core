<template>
  <div class="code-block" :class="variant">
    <header v-if="$slots.label || label || copyable" class="cb-head">
      <div class="cb-label">
        <slot name="label">{{ label }}</slot>
      </div>
      <button v-if="copyable" class="cb-copy" :title="copyTitle" @click="onCopy">
        <AIcon :type="copied ? 'CheckOutlined' : 'CopyOutlined'" />
        <span v-if="showCopyLabel">{{ copied ? '已复制' : '复制' }}</span>
      </button>
    </header>
    <pre class="cb-body" :class="{ inline }"><slot>{{ content }}</slot></pre>
  </div>
</template>

<script setup lang="ts">
/**
 * CodeBlock —— 通用代码块（变体）
 *
 * variant:
 *   dark    深色背景（var(--code-dark-bg) 板岩 + var(--code-dark-fg-1) 文字）—— 用于 JSON 示例 / API 端点展示
 *   light   浅色背景（var(--bg-sunken)）—— 用于 schema / 记忆字段 / 纯配置展示
 *
 * copyable: 右上角 "复制" 按钮（点击后 1.5s 反馈）
 *
 * content prop 或 default slot 均可
 */
const props = withDefaults(
  defineProps<{
    variant?: 'dark' | 'light'
    label?: string
    content?: string
    copyable?: boolean
    copyTitle?: string
    showCopyLabel?: boolean
    inline?: boolean
  }>(),
  {
    variant: 'dark',
    copyable: false,
    copyTitle: '复制',
    showCopyLabel: false,
    inline: false,
  }
)

const copied = ref(false)

async function onCopy() {
  const text = props.content ?? getSlotText()
  if (!text || typeof navigator === 'undefined') return
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // 原型阶段：失败静默，真正场景可弹 toast
  }
}

function getSlotText(): string {
  // 简化：原型阶段靠 content prop；slot 文本获取成本不值得
  return ''
}
</script>

<style scoped>
.code-block {
  border-radius: var(--r-2);
  overflow: hidden;
  border: 1px solid var(--line);
}

.cb-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-12);
  border-bottom: 1px solid var(--line);
}

.cb-label {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.cb-copy {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.1875rem 0.5rem;
  border-radius: var(--r-1);
  font-size: var(--fs-12);
  transition: all 0.15s;
}
.cb-copy :deep(svg) { width: 0.75rem; height: 0.75rem; }

/* dark 变体 */
.dark .cb-head {
  background: var(--code-dark-bg);
  border-bottom-color: var(--code-dark-line);
  color: var(--code-dark-fg-2);
}
.dark .cb-copy {
  color: var(--code-dark-fg-3);
}
.dark .cb-copy:hover {
  background: var(--code-dark-hover);
  color: var(--bg);
}
.dark .cb-body {
  background: var(--code-dark-bg);
  color: var(--code-dark-fg-1);
}

/* light 变体 */
.light .cb-head {
  background: var(--bg-sunken);
  color: var(--ink-2);
  font-weight: 500;
}
.light .cb-copy {
  color: var(--ink-4);
}
.light .cb-copy:hover {
  background: var(--bg);
  color: var(--accent);
}
.light .cb-body {
  background: var(--bg);
  color: var(--ink-2);
}

.cb-body {
  margin: 0;
  padding: 0.75rem 0.875rem; font-size: var(--fs-12);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: auto;
}
.cb-body.inline {
  padding: var(--space-2) var(--space-3);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}</style>
