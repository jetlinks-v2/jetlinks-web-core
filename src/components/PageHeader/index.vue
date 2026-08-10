<template>
  <header class="cloud-page-header">
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

<script setup lang="ts" name="CloudPageHeader">
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
  }
})

const emit = defineEmits(['back'])

defineOptions({
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
  background: rgba(255, 255, 255, 0.6);
    margin-bottom: var(--space-4);
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
  height: 16px;
  min-width: 16px;

  :deep(.anticon) {
    font-size: 16px;
    color: var(--jet-theme-text);
  }
}

.cloud-page-header__title {
  margin: 0;
  color: #1d2129;
  font-size: 20px;
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
  color: #64748b;
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
</style>
