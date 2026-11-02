<template>
  <a-alert v-if="sourceError" type="error" show-icon :message="t('sourcePickerUnavailable')" :description="sourceError" />
  <MetricPanel :context="panelContext" :pick-source="binding?.pickSource" :initial-reference="initialReference" :detail-link-label="detailLinkLabel" @create-alarm="reference => emit('createAlarm', reference)" @open-detail-link="reference => emit('openDetailLink', reference)" />
  <component :is="binding.host" v-if="binding?.host" />
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricPanel from '../MetricPanel.vue'
import { errorText } from '../service'
import { metricMessages } from '../messages'
import type { MetricAlarmReference, MetricContext, MetricDimensionProvider, MetricReference, MetricSourcePickerBinding } from '../types'
const props = defineProps<{ provider: MetricDimensionProvider; context: MetricContext; initialReference?: MetricReference; detailLinkLabel?: string }>()
const emit = defineEmits<{ (event: 'createAlarm', reference: MetricAlarmReference): void; (event: 'openDetailLink', reference: MetricAlarmReference): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
let binding: MetricSourcePickerBinding | undefined
let sourceError = ''
// This keyed scope owns picker state and its host; switching owner destroys pending source drafts.
try { binding = props.provider.useSourcePicker(toRef(props, 'context')) } catch (cause) { sourceError = errorText(cause) }
const panelContext = computed(() => ({ ...props.context, editable: props.context.editable && !sourceError }))
</script>
