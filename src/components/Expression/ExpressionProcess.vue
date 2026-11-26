<template><a-tree :tree-data="process" :selectable="false" default-expand-all /></template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionExplanation } from './types'
import type { ExpressionEditorContext } from './editor'
import { expressionSigns } from './document'
import { trialMessages } from './trialMessages'
const props=defineProps<{explanation:ExpressionExplanation;context:ExpressionEditorContext}>()
const {t}=useI18n({useScope:'local',messages:trialMessages})
const process=computed(()=>{
  function visit(node:ExpressionExplanation,key:string):{key:string;title:string;children:ReturnType<typeof visit>[]} {
    const reference=node.kind === 'read' ? props.context.references.find(item=>JSON.stringify([item.id,...item.path]) === JSON.stringify(node.path)) : undefined
    const operation=node.kind === 'call' ? props.context.functions.find(item=>item.id === node.operation)?.name : expressionSigns[node.operation || '']
    const value=node.value == null ? 'null' : typeof node.value === 'object' ? JSON.stringify(node.value) : String(node.value)
    return {key,title:[reference?.label || operation || t(node.kind),t(node.state),node.state === 'available' ? value : ''].filter(Boolean).join(' · '),children:node.children.map((child,index)=>visit(child,key+'.'+index))}
  }
  return [visit(props.explanation,'0')]
})
</script>
