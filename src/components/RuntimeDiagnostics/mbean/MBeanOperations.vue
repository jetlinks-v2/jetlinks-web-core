<template>
  <div class="mbean-operations">
    <a-empty v-if="!bean.operations.length" :description="t('runtimeDiagnostics.noOperations')" />
    <template v-else>
      <div class="operation-picker" role="group" :aria-label="t('runtimeDiagnostics.selectOperation')">
        <a-button v-for="item in bean.operations" :key="operationId(item)" type="text" :class="{ 'is-selected': operationKey === operationId(item) }" :aria-pressed="operationKey === operationId(item)" :title="operationId(item)" @click="selectOperation(operationId(item))">{{ operationId(item) }}</a-button>
      </div>
      <!-- 参数按 MBean 元数据独立校验；无 model 的 Form 不触发 finish。 -->
      <a-form v-if="operation" class="operation-request" layout="vertical" @submit="invoke">
        <div v-if="operation.parameters.length" class="operation-parameters">
          <a-form-item v-for="(parameter, index) in operation.parameters" :key="index" :class="{ 'parameter-structured': structured(parameter.type) }" :for="`${formId}-${index}`" :required="true">
            <template #label><span>{{ parameter.name || `arg${index}` }}</span><code :title="parameter.type">{{ parameter.type }}</code><a-tooltip v-if="parameter.description" :title="parameter.description"><InfoCircleOutlined tabindex="0" :aria-label="parameter.description" /></a-tooltip></template>
            <a-select v-if="/^(boolean|java\.lang\.Boolean)$/.test(parameter.type)" :id="`${formId}-${index}`" v-model:value="values[index]" :options="[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]" />
            <a-textarea v-else-if="structured(parameter.type)" :id="`${formId}-${index}`" v-model:value="values[index]" :auto-size="{ minRows: 2, maxRows: 5 }" :placeholder="t('runtimeDiagnostics.jsonParameter')" />
            <a-input v-else :id="`${formId}-${index}`" v-model:value="values[index]" />
          </a-form-item>
        </div>
        <p v-else class="operation-no-parameters">{{ t('runtimeDiagnostics.noParameters') }}</p>
        <a-alert v-if="validationError" type="error" :message="validationError" show-icon />
        <footer class="operation-actions">
          <div class="operation-return"><span>{{ t('runtimeDiagnostics.returnType') }}</span><code :title="operation.returnType">{{ operation.returnType }}</code><a-tooltip v-if="operation.description" :title="operation.description"><InfoCircleOutlined tabindex="0" :aria-label="operation.description" /></a-tooltip></div>
          <a-button html-type="submit" type="primary" :disabled="!invokeAccess.allowed || busy || !target" :loading="busy" :title="invokeAccess.reason"><template #icon><CaretRightOutlined aria-hidden="true" /></template>{{ t('runtimeDiagnostics.invoke') }}</a-button>
        </footer>
      </a-form>
      <p v-else class="operation-placeholder">{{ t('runtimeDiagnostics.selectOperation') }}</p>
      <section v-if="lastInvocationKey === operationKey && lastInvocationKey !== undefined" class="operation-output" aria-live="polite" :aria-busy="resultState.status === 'loading'">
        <DiagnosticsState :state="resultState" @retry="invoke">
          <CodeBlock v-if="result !== undefined" :label="t('runtimeDiagnostics.executionResult')" :content="formatValue(result)" variant="light" copyable />
        </DiagnosticsState>
      </section>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch, type PropType } from 'vue'
import { CaretRightOutlined, InfoCircleOutlined } from '@ant-design/icons-vue'
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
const { t } = useI18n(), formId = `mbean-operation-${getCurrentInstance()?.uid}`
const operationKey = ref<string>(), values = ref<Array<string | undefined>>([]), validationError = ref('')
const lastInvocationKey = ref<string>()
const operation = computed(() => props.bean.operations.find(item => operationId(item) === operationKey.value))
const structured = (type: string) => /^(java\.util\.|\[)/.test(type) || type.endsWith('[]')
function resetArguments() { values.value = []; validationError.value = ''; lastInvocationKey.value = undefined }
function selectOperation(key: string) {
  if (operationKey.value === key) return
  resetArguments(); operationKey.value = key
}
watch([() => props.bean.objectName, () => props.target], () => { operationKey.value = undefined; resetArguments() })
watch(() => props.invokeAccess.allowed, allowed => { if (!allowed) lastInvocationKey.value = undefined })
/** 参数校验后立即提交当前对象与签名；请求权限、去重及迟到响应由宿主管理。 */
function invoke() {
  const selected = operation.value
  if (!selected || !props.invokeAccess.allowed || props.busy || !props.target) return
  let args: MBeanInvocation['args']
  try {
    args = mbeanInvocationArguments(selected, values.value)
    validationError.value = ''
  } catch (error) {
    validationError.value = t(error instanceof Error && error.message === 'required' ? 'runtimeDiagnostics.required' : 'runtimeDiagnostics.invalid')
    return
  }
  lastInvocationKey.value = operationId(selected)
  emit('invoke', { bean: props.bean, operation: selected, args })
}
</script>
<style scoped>
.mbean-operations { min-width:0; container:mbean-operations / inline-size; }
.operation-picker { display:flex; flex-wrap:wrap; align-items:flex-start; gap:4px; max-height:136px; overflow:auto; padding-bottom:10px; border-bottom:1px solid var(--line); }
.operation-picker :deep(.ant-btn) { height:auto; max-width:100%; padding:3px 8px; color:var(--ink-2); font-family:var(--font-mono,monospace); font-size:12px; line-height:20px; text-align:start; white-space:normal; overflow-wrap:anywhere; }
.operation-picker :deep(.is-selected) { color:var(--ant-color-primary,#1677ff); background:var(--ant-color-primary-bg,#e6f4ff); }
.operation-request { margin-top:12px; padding:12px; border-radius:var(--radius-sm,4px); background:var(--ant-color-fill-quaternary,rgba(0,0,0,.02)); }
.operation-parameters { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr)); gap:12px 16px; margin-bottom:12px; }
.operation-parameters :deep(.ant-form-item) { min-width:0; margin-bottom:0; }
.parameter-structured { grid-column:1 / -1; }
.operation-parameters :deep(.ant-form-item-label > label) { display:flex; gap:6px; width:100%; min-width:0; font-size:12px; }
.operation-parameters code { min-width:0; overflow:hidden; color:var(--ink-3); font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
.operation-parameters :deep(.anticon),.operation-return :deep(.anticon) { flex:none; color:var(--ink-3); }
.operation-actions { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.operation-return { display:flex; align-items:center; gap:6px; min-width:0; color:var(--ink-3); font-size:12px; }
.operation-return > span { flex:none; }.operation-return code { min-width:0; overflow-wrap:anywhere; }
.operation-actions > :deep(.ant-btn) { flex:none; min-width:88px; }
.operation-no-parameters,.operation-placeholder { margin:0 0 12px; color:var(--ink-3); font-size:12px; }.operation-placeholder { padding-top:12px; }
.operation-request :deep(.ant-alert) { margin-bottom:12px; }
.operation-output { min-width:0; min-height:56px; margin-top:16px; }
.operation-output :deep(.cb-body) { max-height:380px; overflow:auto; }
@container mbean-operations (width < 360px) { .operation-actions { flex-wrap:wrap; }.operation-return { width:100%; }.operation-actions > :deep(.ant-btn) { margin-inline-start:auto; } }
</style>
