<template>
  <a-drawer :open="open" :placement="placement" :width="550" :mask="false" :closable="false"
    :header-style="{ display: 'none' }" :body-style="{ padding: 0, height: '100%', overflow: 'hidden' }"
    :get-container="false" :root-style="{ position: 'absolute' }" :content-wrapper-style="draggingStyle"
    :destroy-on-close="true" @update:open="!$event && $emit('close')">
    <div class="unified-drawer" @click.stop>
      <div class="header">
        <span class="title-text">{{ title }}</span>
        <div class="header-actions">
          <a-button type="text" :aria-label="t('dashboardCanvas.swapPlacement')" @click="togglePlacement"><SwapOutlined /></a-button>
          <a-button type="text" :aria-label="t('dashboardCanvas.close')" @click="$emit('close')"><CloseOutlined /></a-button>
        </div>
      </div>
      <div class="drawer-content"><slot /></div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { Button as AButton, Drawer as ADrawer } from 'ant-design-vue'
import { CloseOutlined, SwapOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
const props = defineProps<{ open: boolean; title: string; dragging: boolean }>()
defineEmits<{ close: [] }>()
const { t } = useI18n()
const placement = ref<'left' | 'right'>('right')
function togglePlacement() { placement.value = placement.value === 'right' ? 'left' : 'right' }
// Preserve LoadingBoard's local, maskless drawer and hide only its content during a canvas drag.
const draggingStyle = computed<CSSProperties>(() => ({ opacity: props.dragging ? 0 : 1, pointerEvents: props.dragging ? 'none' : 'auto' }))
</script>

<style scoped lang="less">
.unified-drawer { height: 100%; display: flex; flex-direction: column; overflow: hidden;
  background: var(--bg); color: var(--ink-1); }
.header { min-height: 48px; padding: 0 var(--space-4); display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid var(--line); }
.title-text { font-size: var(--fs-14); font-weight: 500; }
.header-actions { display: flex; gap: var(--space-2); }
.drawer-content { flex: 1; min-height: 0; padding: var(--space-4); overflow-y: auto; scrollbar-gutter: stable; }
</style>
