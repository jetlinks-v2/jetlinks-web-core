<template>
  <a-drawer
    :open="open"
    :width="drawerWidth"
    placement="right"
    :body-style="{ padding: 0, background: 'var(--bg)' }"
    :header-style="{ display: 'none' }"
    @update:open="$emit('update:open', $event)"
  >
    <component
      :is="formMode ? 'form' : 'div'"
      class="drawer-shell"
      v-bind="formMode ? { onSubmit: onFormSubmit } : {}"
    >
      <!-- 头部：icon + 标题 + 副标题 + 关闭按钮 -->
      <header v-if="!hideHead" class="drawer-head">
        <div v-if="icon || $slots.icon" class="head-icon" :style="iconColorStyle">
          <slot name="icon">
            <AIcon v-if="icon" :type="icon" />
          </slot>
        </div>
        <div class="head-copy">
          <slot name="head">
            <b>{{ title }}</b>
            <p v-if="sub">{{ sub }}</p>
          </slot>
        </div>
        <slot name="head-extra" />
        <button class="close" type="button" @click="$emit('update:open', false)">
          <AIcon type="CloseOutlined" />
        </button>
      </header>

      <!-- 主体：默认 padding + scroll；调用方可自己覆盖 .drawer-body -->
      <div class="drawer-body">
        <slot />
      </div>

      <!-- 底栏：actions slot，无 actions 不渲染 -->
      <footer v-if="$slots.foot" class="drawer-foot">
        <slot name="foot" />
      </footer>
    </component>
  </a-drawer>
</template>

<script setup lang="ts">
/**
 * JlDrawerShell —— 平台级抽屉骨架（v2.9 · 大 vision 需求开工前 C 阶段抽出）
 *
 * 收口此前 4 个 drawer 各写一遍的：
 *   - a-drawer 配置（width 响应式 / body-style / header-style 关）
 *   - drawer-shell flex column 容器
 *   - head：icon 框 + 标题 + 副标题 + 右上 × 关闭
 *   - body：滚动容器
 *   - foot：actions 槽
 *
 * 场景：单步 form / 详情 quick view / 帮助内容 / 试运行面板等。
 *
 * 不包含：tab 切换 / 步骤指示器（这些是面板内容职责，不属于壳）。
 *
 * 已有调用方未强制立刻迁移；新 drawer 直接用即可。
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    /** 抽屉宽度上限（默认 540） */
    width?: number
    /** 头部图标（Ant Design icon type）；slot=icon 也可直接覆盖 */
    icon?: string
    title?: string
    sub?: string
    /** icon 框背景 / 文字色（一般传 var(--xxx) 类型 token）*/
    iconColor?: string
    iconBg?: string
    /** 整个 head 不渲染（极少数完全自定义场景）*/
    hideHead?: boolean
    /** 是否把 .drawer-shell 渲染成 <form> 自动 prevent default + emit submit */
    formMode?: boolean
  }>(),
  { width: 540, hideHead: false, formMode: false },
)

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'submit'): void
}>()

const viewportWidth = ref<number>(typeof window === 'undefined' ? 0 : window.innerWidth)

const drawerWidth = computed(() => {
  const maxWidth = Math.max(props.width, 320)
  if (!viewportWidth.value) return maxWidth
  return Math.min(maxWidth, Math.max(viewportWidth.value - 32, 320))
})

function syncViewportWidth() {
  viewportWidth.value = window.innerWidth
}

onMounted(() => {
  syncViewportWidth()
  window.addEventListener('resize', syncViewportWidth)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewportWidth)
})

const iconColorStyle = computed(() => ({
  background: props.iconBg ?? 'var(--accent-soft)',
  color: props.iconColor ?? 'var(--accent)',
}))

function onFormSubmit(e: Event) {
  e.preventDefault()
  emit('submit')
}
</script>

<style scoped>
.drawer-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.drawer-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0.9375rem 1rem;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}
.head-icon {
  width: 2.625rem;
  height: 2.625rem;
  border-radius: 0.75rem;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.head-icon :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}
.head-copy {
  min-width: 0;
  flex: 1;
}
.head-copy b {
  display: block;
  color: var(--ink-1);
  font-size: var(--fs-14);
}
.head-copy p {
  margin: 0.25rem 0 0;
  color: var(--ink-4);
  font-size: var(--fs-12);
}
.close {
  all: unset;
  cursor: pointer;
  width: 1.875rem;
  height: 1.875rem;
  display: grid;
  place-items: center;
  border-radius: var(--r-3);
  color: var(--ink-3);
  flex-shrink: 0;
}
.close:hover {
  background: var(--bg-sunken);
  color: var(--ink-1);
}
.close :deep(svg) {
  width: 1rem;
  height: 1rem;
}
.drawer-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.drawer-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: 0.75rem 0.875rem;
  background: var(--bg);
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}</style>
