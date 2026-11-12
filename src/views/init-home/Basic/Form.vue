<template>
  <PlatformSettingsEditor ref="editor" mode="form" />
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { PlatformSettingsEditor } from '@jetlinks-web-core/components/PlatformSettings'
defineProps({ hideSubmitBtn: { type: Boolean, default: false } })
const editor = ref<InstanceType<typeof PlatformSettingsEditor>>()
defineExpose({ submit: () => editor.value?.submit() })
</script>
