<template>
  <div class="fixed-asset-scope">
    <span v-if="asset.selectedSupportId">{{ t(`${prefix}.fixedScope`, { scope }) }}</span>
    <a-alert v-else type="warning" show-icon :message="t(`${prefix}.fixedScopeUnavailable`, { scope })" />
    <span v-if="asset.previousScopeLabels?.length">
      {{ t(`${prefix}.${asset.selectedSupportId ? 'previousScope' : 'unmodifiedScope'}`, { scope: asset.previousScopeLabels.join(', ') }) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { VisibleAssetPermission } from '../../hooks/menuAssetPermissionEditor.types'

const props = defineProps<{ asset: VisibleAssetPermission }>()
const { t } = useI18n()
const prefix = 'components.MenuAssetPermissionEditor'
const scope = computed(() => t(`${prefix}.${props.asset.fixedScope === 'all' ? 'fixedAll' : 'fixedTenant'}`))
</script>

<style scoped>
.fixed-asset-scope { display: flex; flex-direction: column; gap: var(--space-2); }
</style>
