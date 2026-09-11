<template>
  <div class="dashboard-config-panel dashboard-config-scope">
    <a-alert v-if="failed" type="error" :message="t('dashboardCanvas.configFailed')" />
    <a-tabs v-else v-model:active-key="activeTab">
      <a-tab-pane key="appearance" :tab="t('dashboardCanvas.appearance')">
        <template v-for="entry in entries" :key="entry.name">
          <component v-if="entry.direct" :is="entry.component" :active-component="draft"
            @change="(value: unknown, key: string) => change(entry, value, key)" />
          <a-collapse v-else ghost>
            <a-collapse-panel :key="entry.name" :header="entry.name === 'theme' ? t('dashboardCanvas.theme') : title">
              <component :is="entry.component" :active-component="draft"
                @change="(value: unknown, key: string) => change(entry, value, key)" />
            </a-collapse-panel>
          </a-collapse>
        </template>
        <span v-if="!entries.length">{{ t('dashboardCanvas.noConfiguration') }}</span>
      </a-tab-pane>
      <a-tab-pane v-if="dataEntries.length" key="data" :tab="t('dashboardCanvas.data')">
        <component v-for="entry in dataEntries" :key="entry.name" :is="entry.inspector!.dataComponent"
          :model-value="getConfigData(draft, entry)"
          @update:model-value="(value: Record<string, unknown>) => changeData(entry, value)" />
      </a-tab-pane>
    </a-tabs>
    <div class="config-actions">
      <a-button @click="$emit('close')">{{ t('dashboardCanvas.cancel') }}</a-button>
      <a-button type="primary" :disabled="failed" @click="$emit('apply', initial, cloneDeep(draft))">
        {{ t('dashboardCanvas.apply') }}
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onErrorCaptured, shallowRef, ref } from 'vue'
import { cloneDeep } from 'lodash-es'
import { Alert as AAlert, Button as AButton, Collapse as ACollapse, CollapsePanel as ACollapsePanel,
  Tabs as ATabs, TabPane as ATabPane } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { getVisibleConfigEntries, getConfigData, updateConfigData, updateConfigField } from '../utils/config'
import type { DashboardComponentDefinition, DashboardConfigEntry, DashboardWidget } from '../types'
import '../styles/config.less'

const props = defineProps<{ widget: DashboardWidget; definition: DashboardComponentDefinition }>()
defineEmits<{ close: []; apply: [initial: DashboardWidget, draft: DashboardWidget] }>()
const { t } = useI18n()
// The host mounts one drawer per selection. Draft edits never mutate live runtime configuration.
const initial = cloneDeep(props.widget)
const draft = shallowRef(cloneDeep(initial))
const failed = ref(false)
const activeTab = ref('appearance')
const title = computed(() => props.widget.name || props.definition.defaultConfig.name || t('dashboardCanvas.component'))
const entries = computed(() => getVisibleConfigEntries(props.definition.configs))
const dataEntries = computed(() => entries.value.filter(entry => entry.inspector?.dataComponent))
function change(entry: DashboardConfigEntry, value: unknown, key: string) {
  draft.value = updateConfigField(draft.value, entry, value, key)
}
function changeData(entry: DashboardConfigEntry, data: Record<string, unknown>) {
  draft.value = updateConfigData(draft.value, entry, data)
}
onErrorCaptured(error => {
  failed.value = true
  console.error('[DashBoardCanvas] Widget configuration failed:', props.widget.id, error)
  return false
})
</script>

<style scoped lang="less">
.dashboard-config-panel { display: flex; flex-direction: column; min-height: 0; gap: var(--space-3); }
.config-actions { display: flex; justify-content: flex-end; gap: var(--space-2); position: sticky;
  bottom: 0; padding: var(--space-3) 0; background: var(--bg); }
</style>
