<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BarChartOutlined } from '@ant-design/icons-vue'
import { SamplingIntervalControl, defaultDiagnosticSamplingInterval } from '../RuntimeDiagnostics'
import ObjectDataExplorer from './ObjectDataExplorer.vue'
import { objectDataAnalyses } from '../../object-capability/dataAccess'
import { useObjectPresentationRegistry } from '../../object-capability/useObjectPresentationRegistry'
import { objectMemberPresentation } from '../../object-capability/presentations'
import { currentObjectSelection } from '../../object-capability/dashboard'
import { objectCapabilityId } from '../../object-capability/metadata'
import type { ObjectMember } from '../../object-capability/types'
import type { DataCapabilityRuntime } from '../../data-capability/types'
import { objectOverviewMessages } from './messages'
const props = defineProps<{ interval: number; members: ObjectMember[]; disabled?: boolean; compact?: boolean; runtime: () => DataCapabilityRuntime | undefined }>()
const emit = defineEmits<{ 'update:interval': [value: number] }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const sampling = ref<number>(defaultDiagnosticSamplingInterval), selected = ref<ObjectMember>()
const analyses = computed(() => objectDataAnalyses(props.members))
const presentations = useObjectPresentationRegistry()
const entry = computed(() => selected.value ? { member: selected.value, selection: currentObjectSelection(selected.value), state: { status: 'ready' as const },
  presentation: objectMemberPresentation(selected.value.ref, presentations.value) } : undefined)
function changeSampling(value: number) { sampling.value = value; if (props.interval) emit('update:interval', value) }
watch(() => props.interval, value => { if (value > 0) sampling.value = value }, { immediate: true })
watch(() => props.members, () => { selected.value = undefined })
</script>
<template>
  <span class="object-data-tools" :class="{ 'object-data-tools--compact': compact }">
    <a-switch :checked="interval > 0" :disabled="disabled" size="small" :aria-label="t('autoUpdate')" @change="emit('update:interval', $event ? sampling : 0)" />
    <span>{{ t('autoUpdate') }}</span>
    <SamplingIntervalControl v-if="interval > 0" :value="sampling" :disabled="disabled" :label="t('updateInterval')" @change="changeSampling" />
    <a-dropdown v-if="analyses.length" :trigger="['click']" :disabled="disabled">
      <a-button type="text" size="small" :aria-label="t('objectAnalysis')" :title="compact ? t('objectAnalysis') : undefined"><BarChartOutlined v-if="compact" /><template v-else>{{ t('objectAnalysis') }}</template></a-button>
      <template #overlay>
        <a-menu @click="selected = analyses.find(item => objectCapabilityId(item.ref) === $event.key)">
          <a-menu-item v-for="member in analyses" :key="objectCapabilityId(member.ref)">{{ member.name }}</a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </span>
  <ObjectDataExplorer :entry="disabled ? undefined : entry" :runtime="runtime" @close="selected = undefined" />
</template>
<style scoped>
.object-data-tools { display:inline-flex; align-items:center; flex-wrap:wrap; gap:8px; font-size:var(--ant-font-size-sm,12px); }
.object-data-tools--compact { gap:var(--space-1,4px); }
</style>
