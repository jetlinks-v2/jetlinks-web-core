<template><slot v-if="!failed" /><slot v-else name="fallback" /></template>
<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
const failed = ref(false)
// 专用渲染失败不应使整个监控页失效。
onErrorCaptured(() => { failed.value = true; return false })
</script>
