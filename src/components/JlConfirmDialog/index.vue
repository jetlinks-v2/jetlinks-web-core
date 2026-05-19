<template>
  <a-modal
    :open="open"
    :title="null"
    :footer="null"
    :closable="false"
    :mask-closable="false"
    :keyboard="true"
    :width="440"
    :centered="true"
    :body-style="{ padding: '0' }"
    class="jlc-modal"
    @update:open="onUpdateOpen"
    @cancel="emit('cancel')"
  >
    <div class="jlc">
      <div class="jlc-body">
        <span class="jlc-icon" :class="`tone-${tone}`">
          <AIcon :type="iconName" />
        </span>
        <div class="jlc-text">
          <h3 v-if="title" class="jlc-title">{{ title }}</h3>
          <p class="jlc-msg" v-html="renderMessage(message)" />
        </div>
      </div>

      <footer class="jlc-foot">
        <button
          class="jlc-btn jlc-btn-cancel"
          type="button"
          @click="emit('cancel')"
        >
          {{ cancelText ?? '取消' }}
        </button>
        <button
          class="jlc-btn jlc-btn-confirm"
          :class="`tone-${tone}`"
          type="button"
          @click="emit('confirm')"
        >
          {{ confirmText ?? '确认' }}
        </button>
      </footer>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
/**
 * JlConfirmDialog —— JetLinks AI 通用确认弹窗
 *
 * 替代 window.confirm 的统一 UI。AntDV a-modal 承载（免写 backdrop / scroll lock / ESC），
 * 视觉风格对齐 PickerDialog 的设计语言（圆角 + token 色 + 单层 border）。
 *
 * 三种 tone 对应不同语义：
 *   - 'info'   蓝色：纯告知 / 一般确认
 *   - 'warn'   橙色（默认）：可逆但需要用户确认的动作（如丢弃草稿）
 *   - 'danger' 红色：不可逆 / 破坏性动作（如永久删除）
 *
 * 推荐通过 useConfirmDialog composable 使用（promise 风格 imperative API）。
 */

interface Props {
  open: boolean
  /** 简短标题（≤ 20 字符），不传则只显示 message */
  title?: string
  /** 主体说明文案。支持 \n 换行，会自动转 <br> */
  message: string
  /** 确认按钮文案，默认"确认" */
  confirmText?: string
  /** 取消按钮文案，默认"取消" */
  cancelText?: string
  /** 视觉语义，决定图标 / 颜色 */
  tone?: 'info' | 'warn' | 'danger'
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'warn',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:open': [v: boolean]
}>()

const iconName = computed(() => {
  if (props.tone === 'info') return 'InfoCircleOutlined'
  if (props.tone === 'danger') return 'CloseCircleOutlined'
  return 'ExclamationCircleOutlined'
})

function onUpdateOpen(v: boolean) {
  emit('update:open', v)
  // 用户按 ESC（mask-closable=false 不会触发 mask click，但 ESC 仍会关闭）
  if (!v) emit('cancel')
}

/** 把 \n 转 <br>，避免 v-html 注入：内容来自调用方受控传入 */
function renderMessage(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped.replace(/\n/g, '<br>')
}
</script>

<style scoped>
.jlc {
  display: flex;
  flex-direction: column;
  background: var(--bg-elev);
  border-radius: var(--r-3);
  overflow: hidden;
}

/* 主体 */
.jlc-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: 1.375rem 1.5rem 1.125rem;
}
.jlc-icon {
  width: 2.375rem;
  height: 2.375rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.jlc-icon :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}
.jlc-icon.tone-info {
  background: var(--accent-soft);
  color: var(--accent);
}
.jlc-icon.tone-warn {
  background: var(--warn-bg);
  color: var(--warn);
}
.jlc-icon.tone-danger {
  background: var(--err-bg);
  color: var(--err);
}

.jlc-text {
  flex: 1;
  min-width: 0;
  padding-top: var(--space-1);
}
.jlc-title {
  margin: 0 0 0.375rem;
  font-size: var(--fs-15);
  font-weight: 600;
  color: var(--ink-1);
  line-height: 1.4;
}
.jlc-msg {
  margin: 0;
  font-size: var(--fs-14);
  line-height: 1.6;
  color: var(--ink-2);
  word-break: break-word;
}

/* 底部按钮栏 */
.jlc-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: 0.75rem 1.25rem 1rem;
  background: transparent;
}
.jlc-btn {
  all: unset;
  cursor: pointer;
  height: 2.125rem;
  padding: 0 1.125rem;
  border-radius: var(--r-1);
  font-size: var(--fs-14);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.jlc-btn-cancel {
  background: var(--bg-elev);
  color: var(--ink-2);
  border: 1px solid var(--line);
}
.jlc-btn-cancel:hover {
  border-color: var(--line-strong);
  color: var(--ink-1);
}

.jlc-btn-confirm {
  color: var(--bg);
}
.jlc-btn-confirm.tone-info {
  background: var(--accent);
}
.jlc-btn-confirm.tone-info:hover {
  background: var(--ink-1);
}
.jlc-btn-confirm.tone-warn {
  background: var(--warn);
}
.jlc-btn-confirm.tone-warn:hover {
  filter: brightness(0.95);
}
.jlc-btn-confirm.tone-danger {
  background: var(--err);
}
.jlc-btn-confirm.tone-danger:hover {
  filter: brightness(0.95);
}</style>

<!-- AntDV a-modal 内容区无 padding，让我们的 .jlc 全权接管 -->
<style>
.jlc-modal .ant-modal-content {
  padding: 0 !important;
  border-radius: var(--r-3);
  overflow: hidden;
  box-shadow: var(--shadow-pop);
}
.jlc-modal .ant-modal-mask {
  background: color-mix(in srgb, var(--ink-2) 42%, transparent);
  backdrop-filter: blur(0.125rem);
}</style>
