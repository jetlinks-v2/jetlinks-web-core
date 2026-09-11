<template>
  <div class="dashboard-widget-renderer">
    <div v-if="failed" class="widget-state" role="alert">
      <span>{{ t('dashboardCanvas.componentFailed', { name }) }}</span>
      <a-button size="small" @click="retry">{{ t('dashboardCanvas.retry') }}</a-button>
    </div>
    <component v-else-if="definition" :is="definition.component" :key="version"
      :info="widget" :is-edit="previewMode" />
    <div v-else class="widget-state" role="status">
      {{ t('dashboardCanvas.componentMissing', { name }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { Button as AButton } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DashboardComponentDefinition, DashboardWidget } from '../types'

const props = defineProps<{
  widget: DashboardWidget
  definition?: DashboardComponentDefinition
  previewMode: boolean
}>()
const { t } = useI18n()
const failed = ref(false)
const version = ref(0)
const name = computed(() => props.widget.name || props.definition?.defaultConfig.name || t('dashboardCanvas.component'))
function retry() { failed.value = false; version.value += 1 }
watch(() => [props.widget.id, props.widget.type, props.definition?.component], retry)
// A failed injected widget must not take down its neighboring widgets or erase its configuration.
onErrorCaptured(error => {
  failed.value = true
  console.error('[DashBoardCanvas] Widget render failed:', props.widget.id, error)
  return false
})
</script>

<style scoped lang="less">
.dashboard-widget-renderer { width: 100%; height: 100%; min-width: 0; min-height: 0; }
.widget-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-2); height: 100%; padding: var(--space-3); box-sizing: border-box;
  text-align: center; overflow: auto; color: var(--ink-3); background: var(--bg-sunken);
}
</style>
