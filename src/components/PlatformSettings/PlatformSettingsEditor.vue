<template>
  <PlatformSettingsLayout :model="model" :saved="saved" :mode="mode" :assets="assets" :hidden="hidden" :loading="loading" :busy="busy" :error="error" :warning="warning" :errors="errors" :disabled="disabled" :submit="persist" @change="change" @reload="reload" @uploading="uploading" />
</template>
<script setup lang="ts">
import PlatformSettingsLayout from './PlatformSettingsLayout.vue'
import { useSystemPlatformSettings } from '../../hooks/useSystemPlatformSettings'
import type { PlatformSettingsMode, PlatformSettingsSource } from './types'
const props = withDefaults(defineProps<{ mode?: PlatformSettingsMode; save?: PlatformSettingsSource['save'] }>(), { mode: 'detail' })
const { model, saved, assets, hidden, loading, busy, error, warning, errors, disabled, persist, change, reload, uploading, submit } = useSystemPlatformSettings(props.mode, props.save)
defineExpose({ submit })
</script>
