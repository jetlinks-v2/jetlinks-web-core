<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty } from 'ant-design-vue'
import ObjectTypeIcon from '../IconValue/ObjectTypeIcon.vue'
import VirtualScroll from '../VirtualScroll/index.vue'
import type { ObjectRelationContext } from '../../types/object-relation'
import type { AssetDimensionOption } from '../AssetOwnershipCondition/types'
import { useRelationObjectCandidates } from './useRelationObjectCandidates'

const props = defineProps<{
  context: ObjectRelationContext
  value: string[]
  options: AssetDimensionOption[]
  selectedOnly?: boolean
  reviewValues?: string[]
  focusValue?: string
}>()
const emit = defineEmits<{
  'update:value': [ids: string[]]
  'options-change': [options: AssetDimensionOption[]]
  'options-visible': [ids: string[]]
  'view-change': []
}>()
const { t } = useI18n()
const key = 'assetRelation.'
const candidates = useRelationObjectCandidates(
  () => props,
  (rows) => {
    emit(
      'options-change',
      rows.map((row) => ({ value: row.id, label: row.name || row.id }))
    )
    emit(
      'options-visible',
      rows.map((row) => row.id)
    )
  }
)
const { rows, keyword, loading, error, hasMore, revision } = candidates
const selected = computed(() => new Set(props.value))
const disabled = (id: string) => props.options.find((row) => row.value === id)?.disabled
function toggle(id: string) {
  const values = new Set(props.value)
  if (values.has(id)) values.delete(id)
  else values.add(id)
  emit('update:value', [...values])
}
function search(value: string) {
  emit('view-change')
  void candidates.search(value)
}
</script>
<template>
  <section
    class="relation-object-candidates"
    @scroll.capture="emit('view-change')"
  >
    <a-input-search
      :value="keyword"
      :placeholder="t(key + 'searchObjects')"
      allow-clear
      @update:value="keyword = $event || ''"
      @search="search"
    />
    <a-alert
      v-if="error"
      type="error"
      :message="error"
      show-icon
    />
    <VirtualScroll
      v-if="rows.length"
      :key="revision"
      :data="rows"
      :item-height="52"
      @reach-bottom="!error && candidates.load()"
    >
      <template #renderItem="row">
        <div
          class="relation-candidate-row"
          :class="{ selected: selected.has(row.id) }"
        >
          <a-checkbox
            :checked="selected.has(row.id)"
            :disabled="disabled(row.id)"
            @change="toggle(row.id)"
          >
            <ObjectTypeIcon
              :type-id="context.relation.targetType"
              :size="16"
            />
            <span class="relation-candidate-copy">
              <strong :title="row.name || row.id">{{ row.name || row.id }}</strong>
              <small v-if="candidates.subtitle(row)">{{ candidates.subtitle(row) }}</small>
            </span>
          </a-checkbox>
          <span class="relation-candidate-extra">
            <slot
              name="option-extra"
              :option="{ value: row.id, label: row.name || row.id }"
            />
          </span>
        </div>
      </template>
    </VirtualScroll>
    <a-empty
      v-else-if="!loading && !error"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
      :description="t(key + 'noObjects')"
    />
    <a-button
      v-if="loading || hasMore || error"
      type="text"
      :loading="loading"
      @click="candidates.load(!rows.length)"
    >
      {{ t(key + (error ? 'retry' : 'loadMore')) }}
    </a-button>
  </section>
</template>
<style scoped>
.relation-object-candidates {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}
.relation-object-candidates > .viewport {
  flex: 1;
  min-height: 0;
}
.relation-candidate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 52px;
  padding: 0 6px;
  border-radius: 6px;
  box-sizing: border-box;
}
.relation-candidate-row.selected {
  background: var(--bg-hover);
}
.relation-candidate-row > :deep(.ant-checkbox-wrapper) {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  margin: 0;
}
.relation-candidate-row :deep(.ant-checkbox + span) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.relation-candidate-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}
.relation-candidate-copy strong,
.relation-candidate-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 400;
}
.relation-candidate-copy small {
  font-size: 11px;
  color: var(--ink-3);
}
.relation-candidate-extra {
  flex: 0 0 112px;
  width: 112px;
  min-width: 0;
  display: flex;
  align-items: center;
}
</style>
