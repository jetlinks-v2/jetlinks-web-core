<template>
  <header class='cloud-detail-header' :class="{ 'cloud-detail-header--summary': variant === 'summary' }">
    <div v-if="variant === 'summary' && slots.leading" class="cloud-detail-header__leading">
      <slot name="leading" />
    </div>
    <div v-if="variant === 'summary' && slots.icon" class="cloud-detail-header__icon">
      <slot name="icon" />
    </div>
    <div class='cloud-detail-header__main'>
      <div class='cloud-detail-header__title-row'>
        <a-button
          v-if='showBack'
          type='text'
          class='cloud-detail-header__back'
          :title='displayBackTitle'
          @click='handleBack'
        >
          <AIcon type='LeftOutlined' />
        </a-button>

        <div class='cloud-detail-header__title-wrap'>
          <div class='cloud-detail-header__title-main'>
            <h1 class='cloud-detail-header__title' :title="variant === 'summary' ? title : undefined">
              <slot name='title'>
                {{ title }}
              </slot>
            </h1>
            <div v-if='slots.titleExtra' class='cloud-detail-header__title-extra'>
              <slot name='titleExtra' />
            </div>
          </div>
          <div v-if="slots.description && variant !== 'summary'" class='cloud-detail-header__description'>
            <slot name='description' />
          </div>
        </div>
      </div>

      <div v-if="variant === 'summary' && slots.meta" class="cloud-detail-header__meta">
        <slot name="meta" />
      </div>
      <div v-if="variant === 'summary' && slots.description" class="cloud-detail-header__description">
        <slot name="description" />
      </div>
      <div v-if="variant === 'summary' && slots.extra" class="cloud-detail-header__extra">
        <slot name="extra" />
      </div>

      <div v-if='slots.info || slots.default' class='cloud-detail-header__info'>
        <slot name='info'>
          <slot />
        </slot>
      </div>

      <div v-if="variant === 'summary' && slots.actions" class="cloud-detail-header__actions">
        <slot name="actions" />
      </div>
    </div>

    <div v-if="variant !== 'summary' && slots.actions" class='cloud-detail-header__actions'>
      <slot name='actions' />
    </div>
  </header>
</template>

<script setup lang='ts'>
import { computed, getCurrentInstance, useSlots } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'CloudDetailHeader' })

const { t: $t } = useI18n()

const props = withDefaults(
  defineProps<{
    title: string
    showBack?: boolean
    backTitle?: string
    /** 摘要模式只负责布局，由外层 ContentPanel 提供卡片边界。 */
    variant?: 'default' | 'summary'
  }>(),
  {
    showBack: false,
    backTitle: undefined,
    variant: 'default'
  }
)

const displayBackTitle = computed(() => props.backTitle || $t('components.DetailHeader.back'))

const emit = defineEmits<{
  (event: 'back'): void
}>()

const slots = useSlots()
const router = useRouter()
const instance = getCurrentInstance()

const handleBack = () => {
  // 已声明的 emits 监听器不会进入 attrs，需从当前 vnode 判断是否由父组件接管返回。
  if (instance?.vnode.props?.onBack) {
    emit('back')
  } else {
    router.back()
  }
}
</script>

<style scoped lang='less'>
.cloud-detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 0.0625rem solid var(--bg);
  border-radius: var(--r-6);
  background: var(--bg-trans-8);
  margin-bottom: 1rem;
}

.cloud-detail-header__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: var(--space-3);
}

.cloud-detail-header__title-row {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: var(--space-2);
}

.cloud-detail-header__back {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--jet-theme-text);
}

.cloud-detail-header__title-wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: var(--space-1);
}

.cloud-detail-header__title-main {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--space-2);
}

.cloud-detail-header__title {
  flex-shrink: 1;
  margin: 0;
  overflow: hidden;
  color: var(--jet-theme-text);
  font-size: var(--fs-18);
  font-weight: 650;
  line-height: 2rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cloud-detail-header__title-extra {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
}

.cloud-detail-header__description {
  color: var(--jet-theme-text-disabled);
  font-size: var(--fs-14);
  line-height: 1.5;
}

.cloud-detail-header__info {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
  line-height: 1.5;
}

.cloud-detail-header__actions {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 73.75rem) {
  .cloud-detail-header {
    flex-direction: column;
  }

  .cloud-detail-header__title-main {
    flex-wrap: wrap;
  }

  .cloud-detail-header__actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>

<style scoped src="./summary.css"></style>
