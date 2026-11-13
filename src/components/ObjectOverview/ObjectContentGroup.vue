<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
import ObjectDataView from './ObjectDataView.vue'
import ObjectReferenceDisplay from './ObjectReferenceDisplay.vue'
import ObjectOperationPanel from './ObjectOperationPanel.vue'
import { objectOverviewMessages } from './messages'
import { selectionKey } from '../../object-capability/dashboard'
import type { DataCapabilityRuntime, PersistedOperationBinding } from '../../data-capability/types'
import type { ObjectMemberState } from '../../object-capability/useObjectCapabilities'
import type { ObjectCapabilityValue, ObjectFunctionMetadata, ObjectMember, ObjectMemberPresentation, ObjectMemberSelection, ObjectPropertyMetadata, ObjectReference } from '../../object-capability/types'

export interface ObjectContentEntry {
  selection: ObjectMemberSelection
  member?: ObjectMember
  presentation?: ObjectMemberPresentation
  state: ObjectMemberState
  related?: boolean
}
const props = defineProps<{ title?: string; entries: ObjectContentEntry[]; preview?: boolean; runtime: () => DataCapabilityRuntime | undefined }>()
defineEmits<{ retry: []; add: []; open: [object: ObjectReference] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const active = ref<string>()
const renderFailed = ref(false)
onErrorCaptured(() => { renderFailed.value = true; return false })
watch(() => props.entries.map(entry => selectionKey(entry.selection)).join('|'), () => { renderFailed.value = false })
const activeEntry = computed(() => active.value ? props.entries.find(entry => selectionKey(entry.selection) === active.value) : undefined)
watch(() => props.preview, preview => { if (preview) active.value = undefined })
const values = (entry: ObjectContentEntry) => (entry.state.value as ObjectCapabilityValue | undefined)?.values || []
</script>
<template>
  <section class="object-content-group">
    <header><strong>{{ title }}</strong><a-tag v-if="preview" :bordered="false">{{ t('preview') }}</a-tag></header>
    <a-alert v-if="renderFailed" type="warning" :message="t('unavailable')"><template #action><a-button @click="renderFailed = false">{{ t('retry') }}</a-button></template></a-alert>
    <a-empty v-else-if="!entries.length" :description="t('empty')" :image="undefined"><a-button v-if="preview" type="link" @click="$emit('add')">{{ t('add') }}</a-button></a-empty>
    <div v-else class="object-content-group__items">
      <article v-for="entry in entries" :key="selectionKey(entry.selection)" class="object-content-group__item">
        <div class="object-content-group__label">
          <span>{{ entry.member?.name || entry.selection.member.id }}</span>
          <a-tooltip v-if="entry.member" :title="entry.member.description || t('source', { name: entry.member.sourceName })"><InfoCircleOutlined /></a-tooltip>
        </div>
        <a-button v-if="entry.member?.ref.kind === 'action'" :disabled="preview || entry.state.status === 'failed'" @click="active = selectionKey(entry.selection)"><ThunderboltOutlined />{{ entry.member.name }}</a-button>
        <ObjectReferenceDisplay v-else-if="entry.state.status === 'ready' && entry.state.references" :value="entry.state.references" :disabled="preview" @open="$emit('open', $event)" />
        <component v-else-if="entry.presentation?.component" :is="entry.presentation.component" :member="entry.member" :value="entry.state.value" :state="entry.state.status" />
        <div v-else-if="entry.related && entry.state.status === 'ready'" class="object-content-group__related">
          <span v-if="!values(entry).length" class="object-content-group__muted">{{ t('unknown') }}</span>
          <div v-for="(item, row) in values(entry)" :key="row">
            <small>{{ item.object.name || item.object.id }}</small>
            <ObjectDataView :value="item.value" :metadata="((item.metadata || entry.member?.metadata) as ObjectPropertyMetadata)?.valueType || ((item.metadata || entry.member?.metadata) as ObjectFunctionMetadata)?.output" compact />
          </div>
          <small v-if="(entry.state.value as ObjectCapabilityValue)?.limited">{{ t('limited') }}</small>
        </div>
        <ObjectDataView v-else :value="entry.state.value" :state="entry.state.status" :metadata="(entry.member?.metadata as ObjectPropertyMetadata)?.valueType" @retry="$emit('retry')" />
      </article>
    </div>
    <a-modal :open="Boolean(activeEntry) && !preview && !renderFailed" :title="activeEntry?.member?.name" :footer="null" destroy-on-close @cancel="active = undefined">
      <component v-if="activeEntry?.member" :is="activeEntry.presentation?.editor || ObjectOperationPanel" :member="activeEntry.member" :binding="activeEntry.selection.binding as PersistedOperationBinding" :runtime="runtime" />
    </a-modal>
  </section>
</template>
<style scoped>
.object-content-group { box-sizing: border-box; height: 100%; overflow: auto; padding: 20px; border: 1px solid var(--ant-color-border-secondary, var(--line)); border-radius: 8px; background: var(--ant-color-bg-container, var(--bg-panel)); }
.object-content-group > header { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; }
.object-content-group__items { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 20px; }
.object-content-group__label { display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px; color: var(--ant-color-text-secondary, inherit); font-size: 12px; overflow-wrap: anywhere; }
.object-content-group__label .anticon { color: var(--ant-color-text-tertiary, inherit); }
.object-content-group__related { display: grid; gap: 10px; }.object-content-group__related small, .object-content-group__muted { color: var(--ant-color-text-tertiary, inherit); }
</style>
