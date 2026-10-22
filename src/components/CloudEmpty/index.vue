<template>
  <div
    class="cloud-empty"
    :class="`cloud-empty--${type}`"
    :style="style"
  >
    <a-empty
      :description="!hasSearch && $slots.description ? undefined : resolvedDescription"
      :image="bigEmptyImg"
      :image-style="mergedImageStyle"
    >
      <template v-if="!hasSearch && $slots.description" #description>
        <slot name="description" />
      </template>
      <slot v-if="showEmptyCreate" />
    </a-empty>
  </div>
</template>

<script setup lang="ts" name="CloudEmpty">
import type { PropType, StyleValue } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmptyCreateState } from '../../hooks/useEmptyCreateState'
import type { EmptyCreateSearch } from '../../hooks/useEmptyCreateState'
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
  // 仅传当前集合已生效的用户搜索；接口固定条件由调用方排除。
  search: {
    // String 先于 Boolean，避免 Vue 将空关键词 '' 转换为 true。
    type: [String, Boolean, Array] as PropType<EmptyCreateSearch>,
    default: false
  },
  searchName: {
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
const { hasSearch, showEmptyCreate } = useEmptyCreateState(() => props.search)
const resolvedDescription = computed(() => hasSearch.value
  ? t('components.CloudEmpty.searchEmpty', { name: props.searchName })
  : props.description || defaultDescription.value)

const emptyImage = computed(() => props.type === 'page' ? bigEmptyImg : emptyImg)

const defaultImageStyle = computed(() => ({
  height: props.type === 'page' ? '180px' : '60px'
}))

const mergedImageStyle = computed(() => ({
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
