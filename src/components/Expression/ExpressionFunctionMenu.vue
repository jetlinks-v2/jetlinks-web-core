<template>
  <div class="expression-functions">
    <div class="expression-functions__search"><a-input v-model:value="query" autofocus allow-clear :placeholder="t('search')" :aria-label="t('search')" @keydown.enter.prevent="first && emit('choose',{key:first.id})" @keydown.esc.prevent="emit('close')" @keydown.stop><template #prefix><AIcon type="SearchOutlined" /></template></a-input></div>
    <a-menu class="expression-functions__list" :selected-keys="selectedId ? [selectedId] : []" @click="emit('choose',{key:$event.key})">
      <a-menu-item-group v-for="group in groups" :key="group.id" :title="group.label">
        <a-menu-item v-for="item in group.items" :key="item.id" :disabled="item.disabled"><SelectOption :icon="group.icon" :label="item.name" :description="item.description" /></a-menu-item>
      </a-menu-item-group>
      <a-menu-item v-if="error" key="retry" @click.stop="emit('retry')"><slot name="error" /></a-menu-item>
    </a-menu>
    <p v-if="!groups.length" class="expression-functions__empty">{{ t('empty') }}</p>
  </div>
</template>
<script setup lang="ts">
import SelectOption from '../SelectOption/index.vue'
import { useExpressionFunctionMenu, type FunctionOption } from './useExpressionFunctionMenu'
const props=defineProps<{functions:FunctionOption[];selectedId?:string;error?:boolean}>()
const emit=defineEmits<{(event:'choose',value:{key:string|number}):void;(event:'retry'):void;(event:'close'):void}>()
const {t,query,groups,first}=useExpressionFunctionMenu(props)
</script>
<style scoped>
.expression-functions { width:min(360px,calc(100vw - 32px)); padding:6px; border:1px solid var(--line); border-radius:8px; background:var(--bg,#fff); box-shadow:0 6px 20px rgb(0 0 0 / 10%) }
.expression-functions__search { padding:2px 4px 6px }
.expression-functions__list { max-height:320px; overflow:auto; border:0; box-shadow:none; background:transparent }
.expression-functions__list :deep(.ant-menu-item-group-title) { padding:6px 10px 2px; font-size:11px; color:var(--ink-3) }
.expression-functions__list :deep(.ant-menu-item) { height:auto; min-height:40px; padding:6px 10px; line-height:20px; white-space:normal }
.expression-functions__list :deep(.select-option) { min-width:0 }
.expression-functions__empty { margin:14px 8px; font-size:13px; color:var(--ink-3) }
</style>
