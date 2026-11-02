<template>
  <MetricValueView v-if="value || configuration.state === 'disabled' || runtime?.state === 'loaded'" compact :value="value" :unit="output.unit" :disabled="configuration.state === 'disabled'" :settings="settings">
    <template v-if="provider?.card" #default="{ text }">
      <MetricExtension :content="provider.card" :content-props="{ context, configuration, template, output, value, settings }" @failed="failed = true">
        <template #fallback><strong :title="text">{{ text }}</strong></template>
      </MetricExtension>
    </template>
  </MetricValueView>
  <strong v-else class="metric-card-empty">—</strong>
  <MetricRuntimeFeedback :runtime="runtime" :has-value="!!value" :disabled="configuration.state === 'disabled'" compact />
  <a-alert v-if="missing || failed" type="warning" show-icon :message="t(missing ? 'presentationMissing' : 'presentationFailed')" />
</template>
<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricValueView from '../MetricValue.vue'
import MetricRuntimeFeedback from '../MetricRuntimeFeedback.vue'
import MetricExtension from './MetricExtension.vue'
import { useMetricPresentation } from './useMetricPresentation'
import { metricMessages } from '../messages'
import type { MetricConfig, MetricContext, MetricRuntime, MetricTemplate, MetricTemplateOutput, MetricValue } from '../types'
// 与现有 SFC 一样内联宏结构，兼容 setup-name-support 的匿名预编译；领域类型仍复用共享契约。
const props = defineProps<{ context: MetricContext; configuration: MetricConfig; template: MetricTemplate; output: MetricTemplateOutput; value?: MetricValue; runtime?: MetricRuntime }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { provider, missing, settings } = useMetricPresentation(toRef(props, 'template'), toRef(props, 'configuration'))
const failed = ref(false)
watch(provider, () => { failed.value = false })
</script>
<style scoped>
.metric-card-empty { font-size:var(--fs-24,24px) }
</style>
