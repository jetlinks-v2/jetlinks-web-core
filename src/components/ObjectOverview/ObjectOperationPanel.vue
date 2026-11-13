<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import ObjectInputValue from './ObjectInputValue.vue'
import ObjectDataView from './ObjectDataView.vue'
import type { ObjectFunctionMetadata, ObjectMember } from '../../object-capability/types'
import type { DataCapabilityRuntime, PersistedOperationBinding } from '../../data-capability/types'
import { useObjectOperation } from '../../object-capability/useObjectOperation'
import { objectOverviewMessages } from './messages'

const props = defineProps<{ member: ObjectMember; binding?: PersistedOperationBinding; runtime: () => DataCapabilityRuntime | undefined }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const { input, prepared, target, busy, failed, warning, result, completed, prepare, execute, reset } = useObjectOperation(toRef(props, 'binding'), () => props.runtime())
const fields = computed(() => (props.member.metadata as ObjectFunctionMetadata).inputs || [])
function setInput(id: string, value: unknown) { input.value = { ...input.value, [id]: value } }
</script>
<template>
  <section class="object-operation">
    <p v-if="member.description" class="object-operation__description">{{ member.description }}</p>
    <a-form v-if="!prepared" layout="vertical">
      <a-form-item v-for="field in fields" :key="field.id" :label="field.name || field.id">
        <ObjectInputValue :field="field" :model-value="input[field.id]" @update:model-value="setInput(field.id, $event)" />
      </a-form-item>
    </a-form>
    <div v-else class="object-operation__confirmation">
      <strong>{{ prepared.summary || member.name }}</strong>
      <span v-if="target">{{ t('target') }}：{{ target.name || target.id }}</span>
      <ObjectDataView :value="prepared.request.input" compact />
    </div>
    <a-alert v-if="failed" :message="t('actionFailed')" type="error" show-icon />
    <a-alert v-if="warning" :message="t('actionWarning')" type="warning" show-icon />
    <a-alert v-else-if="completed" :message="t('accepted')" type="info" show-icon />
    <ObjectDataView v-if="result !== undefined" :value="result" compact />
    <a-space>
      <a-button v-if="!prepared" type="primary" :loading="busy" @click="prepare">{{ t('run') }}</a-button>
      <a-button v-else type="primary" :loading="busy" @click="execute">{{ t('confirm') }}</a-button>
      <a-button :disabled="busy" @click="reset">{{ t('cancel') }}</a-button>
    </a-space>
  </section>
</template>
<style scoped>
.object-operation { display: grid; gap: 12px; }.object-operation__description { color: var(--ant-color-text-secondary, inherit); margin: 0; }
.object-operation__confirmation { display: grid; gap: 12px; padding: 12px; border-radius: 6px; background: var(--ant-color-fill-quaternary, transparent); }
</style>
