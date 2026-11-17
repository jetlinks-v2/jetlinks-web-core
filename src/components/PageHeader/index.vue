<template>
  <header class="cloud-page-header" :class="{ 'cloud-page-header--plain': variant === 'plain' }">
    <div class="cloud-page-header__content">
      <div class="cloud-page-header__left">
        <AButton
          v-if="showBack"
          type="text"
          class="cloud-page-header__back"
          @click="handleBack"
        >
          <template #icon>
            <AIcon type="LeftOutlined" />
          </template>
        </AButton>

        <h1 class="cloud-page-header__title">{{ title }}</h1>

        <div
          v-if="$slots.description || description"
          class="cloud-page-header__divider"
        />

        <div
          v-if="$slots.description || description"
          class="cloud-page-header__description"
        >
          <slot name="description">{{ description }}</slot>
        </div>
      </div>

      <div v-if="$slots.actions || $slots.default" class="cloud-page-header__actions">
        <slot name="actions">
            <a-space>
                <slot />
            </a-space>
        </slot>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
/**
 * 跨模块页面标题栏：保留返回事件优先、路由回退兜底的既有交互契约。
 */
defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  showBack: {
    type: Boolean,
    default: false
  },
  /** 内容区内的轻量标题，不额外套一层背景卡片。 */
  variant: { type: String as PropType<'default' | 'plain'>, default: 'default' },
})

const emit = defineEmits(['back'])

defineOptions({
  name: 'CloudPageHeader',
  inheritAttrs: true
})

const router = useRouter()

const handleBack = () => {
    const instance = getCurrentInstance()
    // 事件名转成 on + 首字母大写的形式
    // my-event → onMyEvent
    // customEvent → onCustomEvent
    const hasListener = !!instance?.vnode?.props?.onBack
  if (hasListener) {
      emit('back')
  } else {
    router.back()
  }
}
</script>

<style scoped lang="less">
.cloud-page-header {
  background: var(--bg-trans-8);
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--r-3);
}

.cloud-page-header__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.cloud-page-header__left {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  gap: var(--space-2);
}

.cloud-page-header__back {
  flex-shrink: 0;
  padding: 0;
  width: 16px;
  min-width: 16px;

  :deep(.anticon) {
    font-size: 16px;
    color: var(--jet-theme-text);
  }
}

.cloud-page-header__title {
  margin: 0;
  color: var(--text-color);
  font-size: var(--fs-20);
  font-weight: 600;
  line-height: normal;
  white-space: nowrap;
  flex-shrink: 0;
}

.cloud-page-header__divider {
  flex-shrink: 0;
  width: 1px;
  height: 16px;
  background: #cbd5e1;
  margin: 0 8px;
}

.cloud-page-header__description {
  overflow: hidden;
  color: var(--text-color-disabled);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.cloud-page-header__actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 9px;
}

@media (max-width: 73.75rem) {
  .cloud-page-header__content {
    flex-direction: column;
    align-items: flex-start;
  }

  .cloud-page-header__description {
    white-space: normal;
  }
}

.cloud-page-header--plain {
  padding: 0 0 var(--space-3);
  margin-bottom: var(--space-6);
  border-bottom: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
}
.cloud-page-header--plain .cloud-page-header__content {
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}
.cloud-page-header--plain .cloud-page-header__title {
  font-size: var(--fs-18);
  line-height: 26px;
}
</style>
