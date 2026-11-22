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
    <a-select v-model:value="type" :aria-label="t('objectType')" :placeholder="t('objectType')" :options="types.map(item => ({value:item.id,label:item.name}))" />
    <a-input-search v-model:value="keyword" :placeholder="t('search')" :aria-label="t('search')" @search="load" />
    <a-spin :spinning="loading"><a-alert v-if="error" type="error" :message="t('loadFailed')" :description="error"><template #action><a-button @click="load">{{ t('retry') }}</a-button></template></a-alert>
      <a-empty v-else-if="!objects.length" :description="t('empty')" />
      <div v-else class="process-object-navigation__list"><a-button v-for="object in objects" :key="object.id" :type="selected?.id === object.id ? 'primary' : 'text'" :aria-pressed="selected?.id === object.id" :title="object.name || object.id" @click="choose(object)">{{ object.name || object.id }}</a-button></div>
    </a-spin>
    <a-space><a-button size="small" :disabled="loading || page === 0" @click="page--">{{ t('previous') }}</a-button><a-button size="small" :disabled="loading || objects.length < 20" @click="page++">{{ t('next') }}</a-button></a-space>
  </nav>
</template>
<style scoped>.process-object-navigation { display:grid; gap:12px; align-content:start; min-width:0 }.process-object-navigation__list { display:flex; flex-direction:column; gap:4px }.process-object-navigation__list :deep(.ant-btn) { text-align:start; overflow:hidden; text-overflow:ellipsis }</style>
