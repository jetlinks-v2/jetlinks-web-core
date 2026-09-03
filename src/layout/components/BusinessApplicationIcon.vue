<template>
  <span class="application-icon">
    <img
      v-if="isImage && !imageFailed"
      :src="application.icon"
      alt=""
      @error="imageFailed = true"
    >
    <span v-else-if="isImage || !application.icon" class="application-icon__fallback">
      {{ fallback }}
    </span>
    <AIcon v-else :type="application.icon" />
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { AIcon } from '@jetlinks-web/components'
import type { BusinessApplicationEntity } from '@jetlinks-web-core/api/application'

const props = defineProps({
  application: {
    type: Object as PropType<BusinessApplicationEntity>,
    required: true,
  },
})

const imageFailed = ref(false)
const fallback = computed(() => props.application.name.trim().charAt(0).toUpperCase())
const isImage = computed(() => Boolean(props.application.icon && (
  /^https?:\/\//i.test(props.application.icon)
  || props.application.icon.startsWith('/')
  || props.application.icon.startsWith('data:image/')
)))

watch(() => props.application.icon, () => {
  imageFailed.value = false
})
</script>

<style scoped lang="less">
.application-icon {
  position: relative;
  display: inline-flex;
  flex: 0 0 1.75rem;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  overflow: hidden;
  border-radius: var(--r-2);
  background: var(--jet-theme-primary);
  color: var(--jet-theme-bg-container);
  font-size: var(--fs-14);

  &__fallback {
    line-height: 1;
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
</style>
