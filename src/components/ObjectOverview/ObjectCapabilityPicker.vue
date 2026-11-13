<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SearchOutlined, FieldNumberOutlined, ThunderboltOutlined, DatabaseOutlined } from '@ant-design/icons-vue'
import RelationSelector from '../RelationSelector/index.vue'
import MetadataValueItem from '../MetadataValueItem/index.vue'
import type { RelationSelectorOptions, VariableObjectSpec } from '../RelationSelector/types'
import { useObjectCapabilityPicker } from '../../object-capability/useObjectCapabilityPicker'
import type { ObjectMember, ObjectFunctionMetadata, ObjectMemberSelection, ObjectReference } from '../../object-capability/types'
import { objectCapabilityId } from '../../object-capability/metadata'
import { objectOverviewMessages } from './messages'

const props = defineProps<{ object?: VariableObjectSpec; contextObject?: ObjectReference; options: RelationSelectorOptions }>()
const emit = defineEmits<{ 'update:object': [value?: VariableObjectSpec]; select: [selection: ObjectMemberSelection] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const keyword = ref('')
const pending = ref<ObjectMember>(), input = ref<Record<string, unknown>>({})
watch(() => JSON.stringify(props.object), () => { pending.value = undefined; input.value = {} })
const { members, loading, failed, load, selection } = useObjectCapabilityPicker(toRef(props, 'object'), toRef(props, 'contextObject'))
const visible = computed(() => members.value.filter(member => `${member.name} ${member.sourceName}`.toLocaleLowerCase().includes(keyword.value.toLocaleLowerCase())))
const fields = computed(() => (pending.value?.metadata as ObjectFunctionMetadata | undefined)?.inputs || [])
type InputValue = string | number | boolean | Record<string, unknown> | unknown[] | undefined
const fieldValue = (id: string) => input.value[id] as InputValue
function choose(member: ObjectMember) {
  if (member.ref.kind === 'query' && (member.metadata as ObjectFunctionMetadata).inputs?.length) {
    pending.value = member; input.value = {}; return
  }
  emit('select', selection(member))
}
function confirmQuery() {
  if (!pending.value) return
  const selected = selection(pending.value)
  if ('source' in selected.binding) selected.binding.query = { ...input.value }
  emit('select', selected); pending.value = undefined
}
</script>
<template>
  <section class="object-picker">
    <RelationSelector :value="object" :options="options" @update:value="emit('update:object', $event)" />
    <a-input v-model:value="keyword" :placeholder="t('search')" allow-clear><template #prefix><SearchOutlined /></template></a-input>
    <a-spin :spinning="loading">
      <a-alert v-if="failed" type="warning" :message="t('loadFailed')"><template #action><a-button size="small" @click="load">{{ t('retry') }}</a-button></template></a-alert>
      <a-empty v-else-if="!visible.length" :description="t('empty')" :image="undefined" />
      <div v-else class="object-picker__items">
        <a-button v-for="member in visible" :key="objectCapabilityId(member.ref)" type="text" class="object-picker__item" @click="choose(member)">
          <FieldNumberOutlined v-if="member.ref.kind === 'property'" /><DatabaseOutlined v-else-if="member.ref.kind === 'query'" /><ThunderboltOutlined v-else />
          <span>{{ member.name }}<small>{{ member.description || t('source', { name: member.sourceName }) }}</small></span>
        </a-button>
      </div>
    </a-spin>
    <a-form v-if="pending" layout="vertical">
      <strong>{{ pending.name }}</strong>
      <a-form-item v-for="field in fields" :key="field.id" :label="field.name || field.id"><MetadataValueItem :item="field" :model-value="fieldValue(field.id)" @update:model-value="input[field.id] = $event" /></a-form-item>
      <a-space><a-button type="primary" @click="confirmQuery">{{ t('selected') }}</a-button><a-button @click="pending = undefined">{{ t('cancel') }}</a-button></a-space>
    </a-form>
  </section>
</template>
<style scoped>
.object-picker { display: grid; gap: 12px; }.object-picker__items { max-height: 340px; overflow: auto; }
.object-picker__item { display: flex; align-items: center; gap: 10px; text-align: start; height: auto; min-height: 48px; width: 100%; white-space: normal; }
.object-picker__item span { min-width: 0; overflow-wrap: anywhere; }.object-picker__item small { display: block; font-size: 12px; color: var(--ant-color-text-tertiary, inherit); }
</style>
