<script setup lang="ts">
import { ref } from 'vue'
import ProcessTemplateManager from '../src/components/Process/ProcessTemplateManager.vue'
import ProcessWorkspace from '../src/components/Process/ProcessWorkspace.vue'
import { processApi } from '../../modules/rule-engine-manager-ui/api/process'
import type { ProcessObject } from '../src/components/Process/types'
const tab = ref('templates'), selected = ref<ProcessObject>(), initial = ref<{id:string;version:string}>()
function apply(template: {id:string;version:string}) { initial.value = template; tab.value = 'processes' }
async function feedback(value: boolean) { await fetch('/fixture/devices/D1/pressure',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}) }
</script>
<template>
  <a-config-provider><div class="preview"><a-space><span>测试设备 · 一号送风机</span><a-button @click="feedback(true)">上报风压到位</a-button><a-button @click="feedback(false)">上报风压未到位</a-button></a-space><a-tabs v-model:active-key="tab" destroy-inactive-tab-pane>
    <a-tab-pane key="templates" tab="过程模板"><ProcessTemplateManager :api="processApi" editable @apply="apply" /></a-tab-pane>
    <a-tab-pane key="processes" tab="过程管理"><ProcessWorkspace v-model:selection="selected" :initial-template="initial" :api="processApi" :permissions="{configure:true,remove:true,start:true,stop:true,reconcile:true}" @applied="initial = undefined" /></a-tab-pane>
  </a-tabs></div></a-config-provider>
</template>
<style>body{margin:0;background:#f5f5f5}.preview{margin:24px;padding:24px;background:white;min-height:calc(100vh - 48px)}.preview>.ant-tabs>.ant-tabs-content-holder{min-height:760px}</style>
