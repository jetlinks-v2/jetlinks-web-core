<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ThunderboltOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import ObjectDataView from './ObjectDataView.vue'
import ObjectMemberValue from './ObjectMemberValue.vue'
import ObjectReferenceDisplay from './ObjectReferenceDisplay.vue'
import { objectOverviewMessages } from './messages'
import { objectMemberContentGroup } from '../../object-capability/content'
import type { ObjectContentEntry } from './ObjectContentGroup.vue'
import type { ObjectCapabilityValue, ObjectReference } from '../../object-capability/types'

const props = defineProps<{ entry: ObjectContentEntry; preview?: boolean; compact?: boolean }>()
defineEmits<{ action: []; retry: []; open: [object: ObjectReference] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const values = () => (props.entry.state.value as ObjectCapabilityValue | undefined)?.values || []
</script>
<template>
  <div class="object-content-value">
    <a-button v-if="entry.member?.ref.kind === 'action'" :disabled="preview || entry.state.status === 'failed'" @click="$emit('action')"><ThunderboltOutlined />{{ entry.member.name }}</a-button>
    <ObjectReferenceDisplay v-else-if="entry.state.status === 'ready' && entry.state.references" :value="entry.state.references" :disabled="preview" @open="$emit('open', $event)" />
    <div v-else-if="entry.related && entry.state.status === 'ready'" class="object-content-value__related">
      <span v-if="!values().length" class="object-content-value__muted">{{ t('unknown') }}</span>
      <div v-for="(item, row) in values()" :key="row">
        <small>{{ item.object.name || item.object.id }}</small>
        <ObjectMemberValue :value="item.value" :metadata="item.metadata" :member="entry.member" :presentation="entry.presentation" compact />
      </div>
      <small v-if="(entry.state.value as ObjectCapabilityValue)?.limited">{{ t('limited') }}</small>
    </div>
    <ObjectMemberValue v-else-if="entry.state.status === 'ready'" :value="entry.state.value" :member="entry.member" :presentation="entry.presentation" :compact="compact" :empty-text="objectMemberContentGroup(entry.member) === 'observations' ? t('noReading') : undefined" />
    <ObjectDataView v-else :state="entry.state.status" @retry="$emit('retry')" />
    <a-tooltip v-if="entry.state.refreshError" :title="t('updateFailed')"><a-button type="text" size="small" :aria-label="t('retry')" @click="$emit('retry')"><ReloadOutlined /></a-button></a-tooltip>
  </div>
</template>
<style scoped>
.object-content-value { min-width: 0; }
.object-content-value__related { display: grid; gap: 10px; }
.object-content-value__related small, .object-content-value__muted { color: var(--ant-color-text-tertiary, inherit); }
</style>
