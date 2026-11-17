<template>
  <a-button class="page-back" type="text" @click="emit('back')">
    <template #icon><AIcon type="LeftOutlined" /></template>
    {{ label }}
  </a-button>
</template>

<script setup lang="ts">
defineOptions({ name: 'PageBack' })

/** 面板外返回入口；由页面提供文案与返回逻辑。 */
defineProps<{ label: string }>()
const emit = defineEmits<{ back: [] }>()
</script>

<style scoped>
.page-back.ant-btn {
  height: auto;
  padding: 0;
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-14);
}

.page-back.ant-btn:hover,
.page-back.ant-btn:focus {
  color: var(--jet-theme-primary);
  background: transparent;
}
</style>
