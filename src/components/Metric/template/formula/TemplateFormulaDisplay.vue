<template>
  <span class="template-formula" role="math" :aria-label="label" :title="label">
    <span v-if="markup" class="template-formula__math" aria-hidden="true" v-html="markup" />
    <span v-else class="template-formula__source">{{ label }}</span>
  </span>
</template>
<script setup lang="ts">
import { useFormulaDisplay } from './useFormulaDisplay'
import type { TemplateRule } from '../designer'
import type { MetricTemplate } from '../../types'

const props = defineProps<{ template: MetricTemplate; rule: TemplateRule; expression: string }>()
const { label, markup } = useFormulaDisplay(props)
</script>
<style scoped>
.template-formula { display:inline-block; max-width:100%; min-width:0; overflow-x:auto; vertical-align:middle; padding:4px 0; color:inherit }
.template-formula__math { display:block; width:max-content; padding:2px }
.template-formula__source { overflow-wrap:anywhere; white-space:pre-wrap }
</style>
