<template>
  <div class="mbean-operations">
    <a-empty v-if="!bean.operations.length" :description="t('runtimeDiagnostics.noOperations')" />
    <template v-else>
      <a-select v-model:value="operationKey" :options="options" :placeholder="t('runtimeDiagnostics.selectOperation')" class="operation-select" @change="resetArguments" />
      <a-form v-if="operation" layout="vertical" @finish="prepare">
        <p v-if="operation.description" class="operation-description">{{ operation.description }}</p>
        <a-form-item v-for="(parameter, index) in operation.parameters" :key="index" :label="`${parameter.name || `arg${index}`} · ${parameter.type}`" :required="true" :extra="parameter.description">
          <a-select v-if="/^(boolean|java\.lang\.Boolean)$/.test(parameter.type)" v-model:value="values[index]" :options="[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]" />
          <a-textarea v-else-if="/^(java\.util\.|\[)/.test(parameter.type) || parameter.type.endsWith('[]')" v-model:value="values[index]" :auto-size="{ minRows: 2, maxRows: 5 }" :placeholder="t('runtimeDiagnostics.jsonParameter')" />
          <a-input v-else v-model:value="values[index]" />
        </a-form-item>
        <a-alert v-if="validationError" type="error" :message="validationError" show-icon />
        <a-button html-type="submit" type="primary" :disabled="!invokeAccess.allowed || busy || !target" :loading="busy" :title="invokeAccess.reason">{{ t('runtimeDiagnostics.invoke') }}</a-button>
      </a-form>
      <DiagnosticsState v-if="lastInvocationKey === operationKey && lastInvocationKey !== undefined" :state="resultState">
        <div v-if="result !== undefined" class="operation-result"><strong>{{ t('runtimeDiagnostics.executionResult') }}</strong><CodeBlock :content="formatValue(result)" variant="light" /></div>
      </DiagnosticsState>
    </template>
    <a-modal :open="!!pending" :title="t('runtimeDiagnostics.invoke')" :confirm-loading="busy" :ok-button-props="{ disabled: !invokeAccess.allowed || busy }" @ok="confirm" @cancel="pending = undefined">
      <p>{{ t('runtimeDiagnostics.invokeReview') }}</p>
      <a-descriptions :column="1" size="small">
        <a-descriptions-item :label="t('runtimeDiagnostics.node')">{{ pending?.target }}</a-descriptions-item>
        <a-descriptions-item label="ObjectName">{{ pending?.invocation.bean.objectName }}</a-descriptions-item>
        <a-descriptions-item :label="t('runtimeDiagnostics.methods')">{{ pending && operationId(pending.invocation.operation) }}</a-descriptions-item>
      </a-descriptions>
      <CodeBlock :content="formatValue(pending?.invocation.args)" variant="light" />
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import DiagnosticsState from '../DiagnosticsState.vue'
import type { ActionAccess, MBeanDescriptor, MBeanInvocation, ViewState } from '../types'
import { formatValue, operationId } from '../utils'
import { mbeanInvocationArguments } from './arguments'
const props = defineProps({
  bean: { type: Object as PropType<MBeanDescriptor>, required: true }, target: { type: String, default: '' },
  invokeAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) },
  busy: { type: Boolean, default: false }, result: { type: null, default: undefined },
  resultState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
})
const emit = defineEmits<{ (event: 'invoke', invocation: MBeanInvocation): void }>()
const { t } = useI18n()
const operationKey = ref<string>(), values = ref<Array<string | undefined>>([]), validationError = ref('')
const lastInvocationKey = ref<string>()
const pending = ref<{ target: string; invocation: MBeanInvocation }>()
const operation = computed(() => props.bean.operations.find(item => operationId(item) === operationKey.value))
const options = computed(() => props.bean.operations.map(item => ({ value: operationId(item), label: `${operationId(item)} → ${item.returnType}` })))
function resetArguments() { values.value = []; validationError.value = ''; pending.value = undefined }
watch([() => props.bean.objectName, () => props.target], () => { operationKey.value = undefined; lastInvocationKey.value = undefined; resetArguments() })
watch(() => props.invokeAccess.allowed, allowed => { if (!allowed) pending.value = undefined })
/** 确认冻结目标、签名与参数；切换对象或撤权会清除此待执行动作。 */
function prepare() {
  if (!operation.value || !props.invokeAccess.allowed || props.busy || !props.target) return
  try {
    pending.value = { target: props.target, invocation: { bean: props.bean, operation: operation.value, args: mbeanInvocationArguments(operation.value, values.value) } }
    validationError.value = ''
  } catch (error) { validationError.value = t(error instanceof Error && error.message === 'required' ? 'runtimeDiagnostics.required' : 'runtimeDiagnostics.invalid') }
}
function confirm() {
  const action = pending.value
  if (!action || !props.invokeAccess.allowed || props.busy || action.target !== props.target || action.invocation.bean.objectName !== props.bean.objectName) return
  pending.value = undefined; lastInvocationKey.value = operationId(action.invocation.operation); emit('invoke', action.invocation)
}
</script>
<style scoped>
.operation-select { width:100%; }
.operation-description { color:var(--ink-3); }
.mbean-operations :deep(.ant-form) { max-width:640px; margin-block:16px; }
.mbean-operations :deep(.ant-alert) { margin-bottom:12px; }
.operation-result { margin-block:16px; }
.mbean-operations :deep(.ant-descriptions-item-content) { overflow-wrap:anywhere; }
</style>
