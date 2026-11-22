<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ProcessObjectNavigation from './ProcessObjectNavigation.vue'
import { useProcessMembers } from './useProcessMembers'
import { processMessages } from './messages'
import { metricSourceMatchesSemantics, metricSourceMatchesType } from '../Metric/sourceSchema'
import type { ObjectPropertyMetadata, ObjectFunctionMetadata } from '../../object-capability/types'
import type { ProcessObject, ProcessInput, ProcessMember } from './types'
const props = defineProps<{ object?: ProcessObject; member?: { provider: string; id: string }; kind: 'input' | 'action'; declaration?: ProcessInput; subjectType: string; readonly?: boolean }>()
const emit = defineEmits<{ select: [value: { object: ProcessObject; member: ProcessMember }] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const model = ref<ProcessObject>(props.object || { type: props.subjectType, id: '$subject' }), relative = ref(!props.object || props.object.id === '$subject'), open = ref(false)
watch(() => props.object, value => { if (value && value.id !== '$subject') model.value = value }, { immediate: true })
const { members, loading, error, load, more, nextCursor, resolve } = useProcessMembers(model)
const options = computed(() => members.value.filter(member => props.kind === 'action' ? member.ref.kind === 'action' : member.ref.kind !== 'action'
  && metricSourceMatchesSemantics(props.declaration?.semantics, member.metadata.expands)
  && metricSourceMatchesType(props.declaration ? {type:props.declaration.type === 'number' ? 'double' : props.declaration.type} : undefined,
    member.ref.kind === 'property' ? (member.metadata as ObjectPropertyMetadata).valueType : (member.metadata as ObjectFunctionMetadata).output)))
const selection = computed(() => props.member ? JSON.stringify([props.member.provider, props.member.id]) : undefined)
async function choose(key: string) {
  const member = options.value.find(item => JSON.stringify([item.ref.providerId,item.ref.id]) === key)
  if (!member) return
  try {
    const selected = await resolve(member)
    if (selected) emit('select', { object: relative.value ? { type: props.subjectType, id: '$subject' } : model.value, member:selected })
  } catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
}
function chooseObject(object?: ProcessObject) { if (object) { model.value = object; open.value = false } }
function changeRelative(value: boolean) { relative.value = value; if (selection.value) choose(selection.value) }
</script>
<template>
  <div class="process-member-field">
    <a-space wrap><a-checkbox :checked="relative" :disabled="readonly" @change="event => changeRelative(!!event.target.checked)">{{ t('subject') }}</a-checkbox><a-button :disabled="readonly" @click="open = true">{{ model.id === '$subject' ? t('selectObject') : model.name || model.id }}</a-button></a-space>
    <a-select :value="selection" :loading="loading" :disabled="readonly" :placeholder="t(kind === 'action' ? 'action' : 'member')" :options="options.map(item => ({value:JSON.stringify([item.ref.providerId,item.ref.id]),label:`${item.name} · ${item.sourceName}`}))" @update:value="value => choose(String(value))" />
    <a-button v-if="kind === 'input' && nextCursor" type="link" :loading="loading" @click="more">{{ t('loadMore') }}</a-button>
    <span v-if="member && !options.some(item => item.ref.id === member?.id && item.ref.providerId === member?.provider)" class="process-member-field__unresolved">{{ member.id }}</span>
    <a-alert v-if="error" :message="t('loadFailed')" :description="error" type="error"><template #action><a-button @click="load">{{ t('retry') }}</a-button></template></a-alert>
    <a-drawer :open="open" :title="t('selectObject')" width="min(420px,100vw)" destroy-on-close @close="open = false"><ProcessObjectNavigation @select="chooseObject" /></a-drawer>
  </div>
</template>
<style scoped>.process-member-field { display:grid; gap:8px }.process-member-field__unresolved { font-size:12px; color:var(--ant-color-text-secondary) }</style>
