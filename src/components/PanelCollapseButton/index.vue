<template>
  <a-button type="text" class="panel-collapse-button" :title="actionLabel" :aria-label="actionLabel"
    :aria-expanded="!collapsed" @click="emit('toggle')">
    <svg class="panel-collapse-button__icon" :class="{ 'is-vertical': orientation === 'vertical' }"
      viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path :d="collapsed ? 'm14 9 3 3-3 3' : 'm17 9-3 3 3 3'" />
    </svg>
  </a-button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'PanelCollapseButton' })
const props = withDefaults(defineProps<{
  collapsed: boolean
  orientation?: 'horizontal' | 'vertical'
  /** 当前动作的已翻译名称；业务宿主可指定具体面板名称。 */
  label?: string
}>(), { orientation: 'horizontal' })
const emit = defineEmits<{ (event: 'toggle'): void }>()
const { t } = useI18n()
const actionLabel = computed(() => props.label || t(props.collapsed
  ? 'components.PanelCollapseButton.expand' : 'components.PanelCollapseButton.collapse'))
</script>

<style scoped>
.panel-collapse-button.ant-btn { display:inline-flex; flex:none; align-items:center; justify-content:center; width:2rem; height:2rem; padding:0; border-radius:var(--r-2); color:var(--ink-2); }
.panel-collapse-button.ant-btn:not(:disabled):hover { color:var(--ink); background:var(--bg-hover); }
.panel-collapse-button.ant-btn:not(:disabled):active { background:var(--bg-sunken); }
.panel-collapse-button__icon { width:20px; height:20px; flex:none; }
.panel-collapse-button__icon.is-vertical { transform:rotate(90deg); }
@media (pointer:coarse) { .panel-collapse-button.ant-btn { width:44px; height:44px; } }
</style>
