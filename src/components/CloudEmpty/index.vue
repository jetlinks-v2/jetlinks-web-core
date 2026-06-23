<template>
  <div
    class="cloud-empty"
    :class="`cloud-empty--${type}`"
    :style="style"
  >
    <a-empty
      :description="$slots.description ? undefined : description || defaultDescription"
      :image="emptyImage"
      :image-style="mergedImageStyle"
    >
      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <slot />
    </a-empty>
  </div>
</template>

<script setup lang="ts" name="CloudEmpty">
import type { PropType, StyleValue } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import emptyImg from '@jetlinks-web-core/assets/components/empty.svg'
import bigEmptyImg from '@jetlinks-web-core/assets/components/big-empty.svg'

type CloudEmptyType = 'default' | 'page'

const props = defineProps({
  type: {
    type: String as PropType<CloudEmptyType>,
    default: 'default'
  },
  description: {
    type: String,
    default: ''
  },
  style: {
    type: [String, Object, Array] as PropType<StyleValue>,
    default: undefined
  },
  imageStyle: {
    type: Object as PropType<Record<string, string | number>>,
    default: undefined
  }
})

const { t } = useI18n()

const defaultDescription = computed(() => t('components.CloudEmpty.description'))

const emptyImage = computed(() => props.type === 'page' ? bigEmptyImg : emptyImg)

const defaultImageStyle = computed(() => ({
  height: props.type === 'page' ? '180px' : '60px'
}))

const mergedImageStyle = computed(() => ({
  ...defaultImageStyle.value,
  ...props.imageStyle
}))
</script>

<style lang="less" scoped>
.cloud-empty {
  width: 100%;
  text-align: center;
}

.cloud-empty--page {
  padding: var(--space-10) 0;
}

:deep(.ant-empty-image img) {
  max-width: 100%;
  pointer-events: none;
}

:deep(.ant-empty-description) {
  color: var(--jet-theme-text-description);
}
</style>
