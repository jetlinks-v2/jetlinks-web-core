<template>
  <span
    class="icon-badge"
    :style="badgeStyle"
  >
    <span
      class="icon-badge__content"
      :class="{ 'icon-badge__content--image': hasImage }"
    >
      <img
        v-if="hasImage"
        class="icon-badge__image"
        :src="props.image || undefined"
        :alt="props.alt"
        @error="handleImageError"
      >
      <AIcon
        v-else-if="props.icon"
        :type="props.icon"
      />
      <span v-else class="icon-badge__text">{{ props.text }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 图片地址，加载失败后回退到 icon 或 text。 */
    image?: string | null
    /** 图片不可用时展示的文本。 */
    text?: string | null
    /** 图片不可用时展示的 Ant Design Vue 图标名。 */
    icon?: string | null
    alt?: string
    /** 外圈边长，单位 px。 */
    size?: number
    /** 内层内容边长，单位 px，默认比外圈小 16px。 */
    innerSize?: number
  }>(),
  {
    alt: '',
    size: 48,
    innerSize: undefined
  }
)

const imageFailed = ref(false)
const hasImage = computed(() => Boolean(props.image?.trim()) && !imageFailed.value)
const contentSize = computed(() => props.innerSize ?? Math.max(1, props.size - 16))
const badgeStyle = computed<Record<string, string>>(() => ({
  '--icon-badge-size': `${props.size}px`,
  '--icon-badge-content-size': `${contentSize.value}px`
}))

watch(() => props.image, () => {
  imageFailed.value = false
})

function handleImageError() {
  imageFailed.value = true
}
</script>

<style scoped lang="less">
.icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-badge-size);
  height: var(--icon-badge-size);
  padding: calc((var(--icon-badge-size) - var(--icon-badge-content-size) - 0.125rem) / 2);
  overflow: hidden;
  border: 1px solid #f3f7fc;
  border-radius: 50%;
  background: linear-gradient(180deg, #f6fafe 0%, #fefefe 100%);
  box-sizing: border-box;
  color: var(--jet-theme-primary);
  flex: none;
}

.icon-badge__content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-badge-content-size);
  height: var(--icon-badge-content-size);
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(180deg, var(--jet-theme-primary) 0%, var(--jet-theme-primary-3) 100%);
  color: var(--jet-theme-primary);
  font-size: calc(var(--icon-badge-content-size) * 0.5);
  font-weight: 600;
}

.icon-badge__content--image { background: transparent; }

.icon-badge__image {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.icon-badge__content :deep(.anticon) {
  font-size: calc(var(--icon-badge-content-size) * 0.5);
  line-height: 1;
}

.icon-badge__text {
  max-width: 100%;
  overflow: hidden;
  color: #fff;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
