<template>
  <PermissionList
    :value="value.permissions"
    :permission-mode="permissionMode"
    :disabled="disabled"
    :busy="busy"
    @update:value="updatePermissions"
    @mode-change="updateMode"
    @ready-change="emit('ready-change', $event)"
  />
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import PermissionList from './PermissionList.vue'
import { resolvePermissionMode, withPermissionMode } from '../permissionMode'
import type { PermissionScope } from './data'
import type { TokenGrantScope, TokenPermissionSelection } from '../types'

const props = defineProps({
  value: { type: Object as PropType<TokenGrantScope>, required: true },
  disabled: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits<{
  (event: 'update:value', value: TokenGrantScope): void
  (event: 'ready-change', ready: boolean): void
}>()
const permissionMode = computed(() => resolvePermissionMode(props.value))
const updatePermissions = (permissions: PermissionScope[]) =>
  emit('update:value', withPermissionMode(props.value, 'custom', permissions))
const updateMode = (selection: TokenPermissionSelection) =>
  emit('update:value', withPermissionMode(props.value, selection.mode, selection.permissions))
</script>
