<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { EyeOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons-vue'
const props = defineProps<{ attributes?: Record<string, unknown>; compact?: boolean }>()
const { t } = useI18n()
const names = computed(() =>
  Array.isArray(props.attributes?.permissionNames)
    ? props.attributes.permissionNames.filter((value): value is string => typeof value === 'string')
    : []
)
const text = computed(
  () =>
    [...names.value.slice(0, 2), ...(names.value.length > 2 ? [`+${names.value.length - 2}`] : [])].join(' · ') ||
    t(props.attributes?.relation === 'owner' ? 'assetRelation.owner' : 'assetRelation.noPermissions')
)
const label = computed(
  () =>
    [...(props.attributes?.relation === 'owner' ? [t('assetRelation.owner')] : []), ...names.value].join(' · ') ||
    text.value
)
</script>
<template>
  <span
    v-if="compact && (Array.isArray(attributes?.permissionNames) || attributes?.relation === 'owner')"
    class="asset-edge-summary"
    :title="label"
    :aria-label="label"
  >
    <LockOutlined
      v-if="attributes?.relation === 'owner'"
      aria-hidden="true"
    />
    <EyeOutlined
      v-else-if="Array.isArray(attributes?.permissions) && attributes.permissions.includes('read')"
      aria-hidden="true"
    />
    <KeyOutlined
      v-else
      aria-hidden="true"
    />
    <span>{{ text }}</span>
  </span>
  <a-space
    v-else-if="!compact"
    wrap
    :size="4"
  >
    <a-tag
      v-for="name in names"
      :key="name"
    >
      {{ name }}
    </a-tag>
  </a-space>
</template>
<style scoped>
.asset-edge-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  font-size: 10px;
  line-height: 15px;
  color: var(--ink-3);
}
.asset-edge-summary > span:last-child {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
