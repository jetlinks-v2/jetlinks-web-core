<template>
  <div class="dashboard-canvas-config dashboard-config-scope">
    <a-form layout="vertical">
      <a-form-item :label="t('dashboardCanvas.backgroundColor')">
        <a-input v-model:value="draft.backgroundColor" allow-clear />
      </a-form-item>
      <a-form-item :label="t('dashboardCanvas.backgroundImage')">
        <a-input :value="draft.backgroundImage?.url" allow-clear @change="changeImage($event.target.value || '')" />
      </a-form-item>
      <a-form-item :label="t('dashboardCanvas.horizontalGap')">
        <a-input-number :value="draft.gridLayout?.marginHorizontal ?? 8" :min="0" :max="36"
          @update:value="updateMargin('marginHorizontal', $event)" />
      </a-form-item>
      <a-form-item :label="t('dashboardCanvas.verticalGap')">
        <a-input-number :value="draft.gridLayout?.marginVertical ?? 8" :min="0" :max="36"
          @update:value="updateMargin('marginVertical', $event)" />
      </a-form-item>
    </a-form>
    <div class="config-actions">
      <a-button @click="$emit('close')">{{ t('dashboardCanvas.cancel') }}</a-button>
      <a-button type="primary" @click="$emit('apply', cloneDeep(draft))">{{ t('dashboardCanvas.apply') }}</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { cloneDeep } from 'lodash-es'
import { Button as AButton, Form as AForm, FormItem as AFormItem, Input as AInput, InputNumber as AInputNumber } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import type { DashboardCanvasConfig } from '../types'
import '../styles/config.less'
const props = defineProps<{ canvas: DashboardCanvasConfig }>()
defineEmits<{ close: []; apply: [canvas: DashboardCanvasConfig] }>()
const { t } = useI18n()
const draft = ref(cloneDeep(props.canvas))
function changeImage(url: string) {
  // A manually supplied URL replaces the old resource reference; file resolution belongs to the host.
  draft.value.backgroundImage = { url }
}
function updateMargin(key: 'marginHorizontal' | 'marginVertical', value: string | number | null) {
  if (typeof value !== 'number') return
  draft.value.gridLayout = { ...draft.value.gridLayout, [key]: value }
}
</script>

<style scoped lang="less">
.config-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
</style>
