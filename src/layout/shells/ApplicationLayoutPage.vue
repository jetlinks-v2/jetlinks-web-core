<template>
  <BasicLayoutShell variant="application" layout="side" />
</template>

<script setup name="ApplicationLayoutPage" lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBusinessApplicationStore } from '@jetlinks-web-core/store/businessApplication'
import { normalizeBasicLayoutVariant } from '../runtime/layoutVariant'
import BasicLayoutShell from './BasicLayoutShell.vue'

const { currentApplication } = storeToRefs(useBusinessApplicationStore())
const layoutVariant = computed(() => {
  // 兼容未记录布局配置的历史应用，应用端始终保留可用的默认壳层。
  return normalizeBasicLayoutVariant(currentApplication.value?.configuration?.layoutVariant)
    || 'application'
})
</script>
