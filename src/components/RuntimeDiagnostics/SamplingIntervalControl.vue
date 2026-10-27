<template>
  <a-popover :open="visible" trigger="click" placement="bottomRight" @open-change="setOpen">
    <template #content>
      <div ref="content" class="diagnostic-sampling" tabindex="-1" @keydown.esc.stop="close">
        <div v-if="showInterval" class="diagnostic-sampling-frequency" role="group" :aria-label="t('runtimeDiagnostics.sampling.interval')">
          <div class="diagnostic-sampling-caption"><ClockCircleOutlined /><span>{{ t('runtimeDiagnostics.sampling.interval') }}</span></div>
          <a-segmented size="small" :value="value" :options="options" @change="select" />
        </div>
        <div v-if="$slots.footer" class="diagnostic-sampling-footer"><slot name="footer" :close="close" /></div>
      </div>
    </template>
    <a-button ref="trigger" class="diagnostic-sampling-trigger" size="small" type="text" :disabled="disabled" :title="label || t('runtimeDiagnostics.sampling.interval')" :aria-label="label || t('runtimeDiagnostics.sampling.interval')" :aria-expanded="visible" @keydown.esc.stop="close"><template v-if="showInterval"><ClockCircleOutlined /><span>{{ t('runtimeDiagnostics.sampling.seconds', { seconds: value }) }}</span><DownOutlined class="diagnostic-sampling-chevron" /></template><SettingOutlined v-else /></a-button>
  </a-popover>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClockCircleOutlined, DownOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { diagnosticSamplingIntervals, isDiagnosticSamplingInterval, type DiagnosticSamplingInterval } from './samplingInterval'
import { createVisiblePopupFocus } from './popupFocus'

const props = withDefaults(defineProps<{ value: number; open?: boolean; disabled?: boolean; showInterval?: boolean; label?: string }>(), { open: undefined, showInterval: true })
const emit = defineEmits<{ (event: 'change', value: DiagnosticSamplingInterval): void; (event: 'update:open', value: boolean): void }>()
const { t } = useI18n()
const localOpen = ref(false), trigger = ref<{ focus: () => void }>(), content = ref<HTMLElement>()
const focus = createVisiblePopupFocus()
const visible = computed(() => !props.disabled && (props.open ?? localOpen.value))
const options = computed(() => diagnosticSamplingIntervals.map(value => ({ value, label: t('runtimeDiagnostics.sampling.seconds', { seconds: value }) })))
function setOpen(open: boolean) { localOpen.value = open && !props.disabled; emit('update:open', localOpen.value) }
function close() { setOpen(false); trigger.value?.focus() }
function select(value: unknown) { if (!props.disabled && isDiagnosticSamplingInterval(value)) { emit('change', value); close() } }
// 外部打开设置时同样接管焦点，Esc 与单次选择后返回触发按钮。
watch([visible, content], ([open]) => { if (open) focus.focus({ getPopup: () => content.value, getTarget: popup => popup.querySelector<HTMLInputElement>('input:checked') ?? popup, isActive: () => visible.value }); else focus.cancel() }, { flush: 'post' })
watch(() => props.disabled, disabled => { if (disabled) setOpen(false) })
onScopeDispose(focus.cancel)
</script>
<style scoped>
.diagnostic-sampling { width:max-content; max-width:calc(100vw - 48px); outline:none; }
.diagnostic-sampling-frequency { display:grid; gap:var(--space-2,8px); }
.diagnostic-sampling-caption { display:flex; align-items:center; gap:var(--space-2,8px); color:var(--ink-2); font-size:var(--fs-caption,12px); }
.diagnostic-sampling-footer { border-top:1px solid var(--jet-theme-border-color-1); margin-top:var(--space-3,12px); padding-top:var(--space-2,8px); }
.diagnostic-sampling-footer :deep(.ant-btn) { padding-inline:4px; color:var(--ink-3); }
.diagnostic-sampling-trigger { display:inline-flex; align-items:center; gap:4px; flex:0 0 auto; color:var(--ink-2); font-variant-numeric:tabular-nums; }
.diagnostic-sampling-trigger :deep(.anticon + span),.diagnostic-sampling-trigger :deep(span + .anticon) { margin-inline-start:0; }
.diagnostic-sampling-chevron { font-size:var(--fs-caption,12px); }
@media (max-width:480px) { .diagnostic-sampling :deep(.ant-segmented-item-label) { min-width:0; padding-inline:6px; } }
</style>
