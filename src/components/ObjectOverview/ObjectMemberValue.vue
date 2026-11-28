<script setup lang="ts">
import { computed, onErrorCaptured, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ObjectDataView from './ObjectDataView.vue'
import { objectOverviewMessages } from './messages'
import type { ObjectFunctionMetadata, ObjectMember, ObjectMemberPresentation, ObjectPropertyMetadata } from '../../object-capability/types'

const props = defineProps<{ value: unknown; member?: ObjectMember; metadata?: ObjectPropertyMetadata | ObjectFunctionMetadata; presentation?: ObjectMemberPresentation; compact?: boolean; emptyText?: string; defaultExpanded?: boolean }>()
const { t } = useI18n({ useScope: 'local', messages: objectOverviewMessages })
const failed = ref(false)
// Query endpoints wrap emitted outputs in a stream array; property arrays are values themselves.
const values = computed(() => props.member?.ref.kind === 'query' && Array.isArray(props.value) ? props.value : [props.value])
onErrorCaptured(() => { failed.value = true; return false })
watch(() => [props.presentation?.component, props.value], () => { failed.value = false })
</script>
<template>
  <template v-for="(item, index) in values" :key="index">
    <component v-if="item != null && presentation?.component && !failed" :is="presentation.component" :member="member" :value="item" />
    <ObjectDataView v-else :value="item" :metadata="((metadata || member?.metadata) as ObjectPropertyMetadata)?.valueType || ((metadata || member?.metadata) as ObjectFunctionMetadata)?.output" :compact="compact" :empty-text="emptyText" :default-expanded="defaultExpanded" />
  </template>
  <ObjectDataView v-if="!values.length" :value="[]" :compact="compact" />
  <small v-if="failed" class="object-member-value__unavailable">{{ t('unavailable') }}</small>
</template>
<style scoped>
.object-member-value__unavailable { color: var(--ant-color-text-tertiary, inherit); }
</style>
