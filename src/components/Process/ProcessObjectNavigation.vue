<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProcessObject } from './types'
import { useProcessObjects } from './useProcessObjects'
import { processMessages } from './messages'
const props = defineProps<{ selection?: ProcessObject }>()
const emit = defineEmits<{ select: [object?: ProcessObject] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const { types, type, keyword, page, objects, selected, loading, error, load, choose } = useProcessObjects(toRef(props,'selection'), object => emit('select',object))
</script>
<template>
  <nav class="process-object-navigation" :aria-label="t('selectObject')">
    <div class="process-object-navigation__heading"><AIcon type="AppstoreOutlined" /><a-select v-model:value="type" :aria-label="t('objectType')" :placeholder="t('objectType')" :bordered="false" :dropdown-match-select-width="false" :options="types.map(item => ({value:item.id,label:item.name}))" /></div>
    <a-input-search v-model:value="keyword" :placeholder="t('search')" :aria-label="t('search')" @search="load" />
    <a-spin class="process-object-navigation__objects" :spinning="loading"><a-alert v-if="error" type="error" :message="t('loadFailed')" :description="error"><template #action><a-button @click="load">{{ t('retry') }}</a-button></template></a-alert>
      <a-empty v-else-if="!objects.length" :description="t('empty')" />
      <div v-else class="process-object-navigation__list"><button v-for="object in objects" :key="object.id" type="button" :aria-pressed="selected?.id === object.id" :title="object.name || object.id" @click="choose(object)">{{ object.name || object.id }}</button></div>
    </a-spin>
    <a-space v-if="page > 0 || objects.length >= 20"><a-button size="small" :disabled="loading || page === 0" @click="page--">{{ t('previous') }}</a-button><a-button size="small" :disabled="loading || objects.length < 20" @click="page++">{{ t('next') }}</a-button></a-space>
  </nav>
</template>
<style scoped>
.process-object-navigation { display:flex; flex-direction:column; gap:var(--space-3,12px); height:100%; min-height:0; min-width:0 }
.process-object-navigation__heading { display:flex; align-items:center; gap:var(--space-2,8px); padding-inline:8px; color:var(--accent,#1677ff) }
.process-object-navigation__heading :deep(.ant-select) { flex:1; min-width:0; font-weight:600 }
.process-object-navigation__objects { flex:1; min-height:0; overflow:auto; scrollbar-gutter:stable }
.process-object-navigation__list { display:flex; flex-direction:column; gap:4px }
.process-object-navigation__list button { min-height:36px; padding:6px 12px; border:0; border-radius:var(--r-2,6px); background:transparent; color:var(--ink-2,#595959); font:inherit; text-align:start; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:pointer }
.process-object-navigation__list button:hover { background:var(--bg-hover,#fafafa) }
.process-object-navigation__list button[aria-pressed="true"] { color:var(--accent,#1677ff); background:var(--accent-soft,#e6f4ff); font-weight:500 }
.process-object-navigation__list button:focus-visible { outline:2px solid var(--accent,#1677ff); outline-offset:-2px }
</style>
