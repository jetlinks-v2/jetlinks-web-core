<template>
  <div class="mbean-operations">
    <a-empty v-if="!bean.operations.length" :description="t('runtimeDiagnostics.noOperations')" />
    <template v-else>
      <!-- 参数按 MBean 元数据独立校验；无 model 的 Form 不触发 finish。 -->
      <a-form class="operation-request" @submit="invoke">
        <div class="operation-expression">
          <span class="operation-start">
            <a-dropdown :trigger="['click']">
              <a-button class="operation-switch" type="text" size="small" :aria-label="t('runtimeDiagnostics.selectOperation')" :title="t('runtimeDiagnostics.selectOperation')"><template #icon><DownOutlined aria-hidden="true" /></template></a-button>
              <template #overlay>
                <a-menu :selected-keys="operationKey ? [operationKey] : []" @click="({ key }) => selectOperation(String(key))">
                  <a-menu-item v-for="item in bean.operations" :key="operationId(item)" :title="operationId(item)">{{ operationId(item) }}</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <template v-if="operation"><a-tooltip :title="[operation.description, t('runtimeDiagnostics.returnType') + ': ' + operation.returnType].filter(Boolean).join(' · ')"><span class="operation-name">{{ operation.name }}</span></a-tooltip><span class="operation-punctuation" aria-hidden="true">(</span></template>
            <span v-else class="operation-placeholder">{{ t('runtimeDiagnostics.selectOperation') }}</span>
          </span>
          <template v-if="operation">
            <span v-for="(parameter, index) in operation.parameters" :key="index" class="operation-argument">
              <label class="argument-token" :for="`${formId}-${index}`" :title="[parameterLabel(parameter, index), parameter.type, parameter.description].filter(Boolean).join(' · ')">
                <a-select v-if="/^(boolean|java\.lang\.Boolean)$/.test(parameter.type)" :id="`${formId}-${index}`" v-model:value="values[index]" :aria-label="parameterLabel(parameter, index)" aria-required="true" :placeholder="parameterLabel(parameter, index)" size="small" :bordered="false" :style="{ width: argumentWidth(index, parameterLabel(parameter, index), 6) }" :options="[{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }]" />
                <a-textarea v-else-if="structured(parameter.type)" :id="`${formId}-${index}`" v-model:value="values[index]" :aria-label="parameterLabel(parameter, index)" aria-required="true" :auto-size="{ minRows: 1, maxRows: 4 }" :placeholder="parameterLabel(parameter, index)" :bordered="false" :style="{ width: argumentWidth(index, parameterLabel(parameter, index)) }" />
                <a-input v-else :id="`${formId}-${index}`" v-model:value="values[index]" :aria-label="parameterLabel(parameter, index)" aria-required="true" :placeholder="parameterLabel(parameter, index)" size="small" :bordered="false" :style="{ width: argumentWidth(index, parameterLabel(parameter, index)) }" />
              </label>
              <span v-if="index < operation.parameters.length - 1" class="operation-punctuation" aria-hidden="true">,</span>
            </span>
            <span class="operation-end"><span class="operation-punctuation" aria-hidden="true">)</span><a-button html-type="submit" type="primary" size="small" :disabled="!invokeAccess.allowed || busy || !target" :loading="busy" :title="invokeAccess.reason"><template #icon><CaretRightOutlined aria-hidden="true" /></template>{{ t('runtimeDiagnostics.invoke') }}</a-button></span>
          </template>
        </div>
        <a-alert v-if="validationError" type="error" :message="validationError" show-icon />
      </a-form>
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
import { CaretRightOutlined, DownOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import DiagnosticsState from '../DiagnosticsState.vue'
import type { ActionAccess, MBeanDescriptor, MBeanInvocation, MBeanParameter, ViewState } from '../types'
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
const parameterLabel = (parameter: MBeanParameter, index: number) => `${parameter.name || `arg${index}`}: ${parameter.type.split('.').pop()}`
const argumentWidth = (index: number, placeholder: string, padding = 3) => `${Math.min(28, Math.max(9, (values.value[index] ?? placeholder).length + padding))}ch`
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
.mbean-operations { min-width:0; }
.operation-request { padding-block:8px; }
.operation-expression { display:flex; flex-wrap:wrap; align-items:center; gap:8px 4px; min-width:0; font-family:var(--font-mono,monospace); font-size:13px; }
.operation-start,.operation-argument,.operation-end { display:inline-flex; align-items:center; gap:4px; min-width:0; max-width:100%; }
.operation-start { flex-wrap:wrap; }.operation-name { overflow-wrap:anywhere; }
.operation-switch { flex:none; color:var(--ink-3); }.operation-placeholder { color:var(--ink-3); font-family:var(--font-sans,inherit); font-size:12px; }
.operation-punctuation { color:var(--ink-3); }.operation-end { gap:12px; }
.argument-token { display:inline-flex; min-width:0; max-width:100%; margin:0; border:1px solid var(--line); border-radius:var(--radius-sm,4px); background:var(--ant-color-fill-quaternary,rgba(0,0,0,.02)); }
.argument-token:focus-within { border-color:var(--ant-color-primary,#1677ff); background:var(--ant-color-primary-bg,#e6f4ff); }
.argument-token :deep(.ant-input),.argument-token :deep(.ant-select) { max-width:100%; font-family:inherit; font-size:12px; }
.argument-token :deep(.ant-input) { padding:3px 6px; line-height:20px; }.argument-token :deep(.ant-select-selector) { font-family:inherit; }
.operation-request :deep(.ant-alert) { margin-top:12px; }
.operation-output { min-width:0; min-height:56px; margin-top:16px; }
.operation-output :deep(.cb-body) { max-height:380px; overflow:auto; }
</style>
