<template>
  <a-form layout="vertical">
    <a-form-item v-for="parameter in definitions" :key="parameter.id" :label="parameter.name || parameter.id">
      <MetricParameterValue :parameter="parameter"
        :model-value="values[parameter.id] ?? defaults[parameter.id]"
        @update:model-value="emit('change', parameter.id, $event)" />
    </a-form-item>
    <a-empty v-if="!definitions.length" :description="t('noParameters')" :image-style="{ height: '44px' }" />
  </a-form>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MetricParameterValue from './MetricParameterValue.vue'
import { metricMessages } from './messages'
import type { MetricParameter } from './types'
defineProps<{ definitions: MetricParameter[]; values: Record<string, unknown>; defaults: Record<string, unknown> }>()
const emit = defineEmits<{ (event: 'change', id: string, value: unknown): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
</script>

