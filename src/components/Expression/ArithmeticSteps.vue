<template>
  <div class="expression-arithmetic">
    <span class="expression-arithmetic__value" :title="labels.valueHint">{{ grouped ? '(' : '' }}{{ labels.value }}</span>
    <span v-for="(step,index) in steps" :key="index" class="expression-arithmetic__step">
      <a-select :value="step.operator" :disabled="disabled" class="expression-arithmetic__operator" size="small" :bordered="false" :dropdown-match-select-width="false" option-label-prop="label" :aria-label="labels.operator + ' ' + (index+1)" @change="changeOperator(index,$event)">
        <a-select-option v-for="option in labels.operators" :key="option.value" :value="option.value" :label="option.symbol"><SelectOption :icon="option.icon" :label="option.label" :description="option.description" /></a-select-option>
      </a-select>
      <a-input-number :value="step.value ?? undefined" string-mode :disabled="disabled" size="small" :controls="false" :aria-label="labels.constant + ' ' + (index+1)" @update:value="change(index,{value:$event == null ? null : String($event)})" />
      <span v-if="grouped && index === 0">)</span>
    </span>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import SelectOption from '../SelectOption/index.vue'
import type { ArithmeticStep,ArithmeticSteps } from './arithmetic'
const props=defineProps<{steps:ArithmeticSteps;labels:{value:string;valueHint?:string;operator:string;constant:string;operators:Array<{value:ArithmeticStep['operator'];symbol:string;icon:string;label:string;description:string}>};disabled?:boolean}>()
const emit=defineEmits<{(event:'change',steps:ArithmeticSteps):void}>()
const grouped=computed(()=>['add','subtract'].includes(props.steps[0].operator) && ['multiply','divide'].includes(props.steps[1].operator))
function change(index:number,value:Partial<ArithmeticStep>){emit('change',props.steps.map((step,i)=>i === index ? {...step,...value} : {...step}) as ArithmeticSteps)}
function changeOperator(index:number,value:unknown){const option=props.labels.operators.find(item=>item.value === value);if(option)change(index,{operator:option.value})}
</script>
<style scoped>
.expression-arithmetic { display:flex; align-items:center; flex-wrap:wrap; gap:4px 6px; min-width:0 }
.expression-arithmetic__value { color:var(--jet-theme-text-secondary); font-size:12px }
.expression-arithmetic__step { display:inline-flex; align-items:center; gap:4px; white-space:nowrap }
.expression-arithmetic :deep(.expression-arithmetic__operator.ant-select-single) { width:36px; min-width:36px }
.expression-arithmetic__operator :deep(.ant-select-selector) { padding-inline:4px !important }
.expression-arithmetic__operator :deep(.ant-select-selection-item) { font-size:15px; padding-inline-end:9px !important }
.expression-arithmetic__operator :deep(.ant-select-arrow) { right:2px; font-size:8px }
.expression-arithmetic :deep(.ant-input-number) { width:64px }
</style>
