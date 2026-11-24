<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import EqualHeightColumns from '../EqualHeightColumns/index.vue'
import ProcessObjectNavigation from './ProcessObjectNavigation.vue'
import ProcessObjectPanel from './ProcessObjectPanel.vue'
import type { ProcessApi, ProcessObject } from './types'
import { processMessages } from './messages'
const props = defineProps<{ api: ProcessApi; selection?: ProcessObject; initialTemplate?:{id:string;version:string}; permissions?: {configure:boolean;remove:boolean;start:boolean;stop:boolean;reconcile:boolean;resume?:boolean;resolve?:boolean} }>()
const emit = defineEmits<{ 'update:selection': [value?: ProcessObject]; applied:[] }>()
const confirmed = ref<ProcessObject>()
const { t } = useI18n({ useScope:'local', messages:processMessages })
const root = ref<HTMLElement>(), navigationOpen = ref(false), objectTrigger = ref<{ $el?: HTMLButtonElement }>()
const { width } = useElementSize(root)
const compact = computed(() => width.value > 0 && width.value < 960)
function select(object?: ProcessObject) { confirmed.value = object; if (object) { emit('update:selection',object); navigationOpen.value = false } }
async function restoreObjectFocus(open: boolean) { if (!open) { await nextTick(); objectTrigger.value?.$el?.focus({preventScroll:true}) } }
watch(compact, () => { navigationOpen.value = false })
</script>
<template>
  <div ref="root" class="process-workspace">
    <EqualHeightColumns height="100%" left-width="14rem" gap="24px" :show-left="!compact">
      <template #left><ProcessObjectNavigation v-if="!compact" :selection="selection" @select="select" /></template>
      <template #right>
        <main class="process-workspace__results"><ProcessObjectPanel :key="JSON.stringify([confirmed?.type,confirmed?.id])" :object="confirmed" :api="api" :permissions="permissions" :initial-template="initialTemplate" @applied="emit('applied')">
          <template #object-heading><div class="process-workspace__heading"><a-button v-if="compact" ref="objectTrigger" type="text" size="small" :aria-label="t('selectObject')" :title="t('selectObject')" :aria-expanded="navigationOpen" @click="navigationOpen = true"><AIcon type="MenuUnfoldOutlined" /></a-button><AIcon v-else type="AppstoreOutlined" /><h3 :title="confirmed?.name || confirmed?.id">{{ confirmed?.name || confirmed?.id || t('processes') }}</h3></div></template>
        </ProcessObjectPanel></main>
      </template>
    </EqualHeightColumns>
    <a-drawer v-if="compact" :open="navigationOpen" :title="t('selectObject')" placement="left" width="min(320px,calc(100vw - 32px))" :force-render="true" :body-style="{display:'flex',flexDirection:'column',minHeight:0}" @close="navigationOpen = false" @after-open-change="restoreObjectFocus"><ProcessObjectNavigation :selection="selection" @select="select" /></a-drawer>
  </div>
</template>
<style scoped>
.process-workspace { display:flex; flex:1; flex-direction:column; height:100%; min-height:0; min-width:0 }
.process-workspace__results { height:100%; min-height:0; min-width:0; overflow:auto; scrollbar-gutter:stable; padding-inline:2px }
.process-workspace__heading { display:flex; align-items:center; gap:8px; min-width:0; max-width:100% }
.process-workspace__heading h3 { margin:0; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--fs-16,16px); font-weight:600; color:var(--ink-1,#262626) }
.process-workspace__heading > :first-child { flex:none; color:var(--ink-3,#595959) }
</style>
