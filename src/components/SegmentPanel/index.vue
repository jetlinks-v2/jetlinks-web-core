<template>
  <ContentPanel class="segment-panel">
    <div v-if="$slots.title || title" class="segment-panel__title">
      <slot name="title">{{ title }}</slot>
    </div>
    <div v-if="$slots.segmented || options.length" class="segment-panel__segmented">
      <slot
        name="segmented"
        :value="modelValue"
        :options="options"
        :change="handleValueChange"
      >
        <a-segmented
          :value="modelValue"
          :options="options"
          block
          @update:value="handleValueChange"
        />
      </slot>
    </div>
    <div class="segment-panel__content">
      <slot />
    </div>
  </ContentPanel>
</template>

<script setup lang="ts" name="SegmentPanel">
import type { PropType } from 'vue'
import ContentPanel from '../ContentPanel/index.vue'
import type { SegmentPanelOption, SegmentPanelValue } from './types'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  options: {
    type: Array as PropType<SegmentPanelOption[]>,
    default: () => [],
  },
  modelValue: {
    type: [String, Number] as PropType<SegmentPanelValue | undefined>,
    default: undefined,
  },
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: SegmentPanelValue): void
  (event: 'change', value: SegmentPanelValue): void
}>()

const handleValueChange = (value: string | number) => {
  const nextValue = value as SegmentPanelValue
  emit('update:modelValue', nextValue)
  emit('change', nextValue)
}
</script>

<style scoped>
.segment-panel {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: var(--panel-gap, var(--space-4));
}

.segment-panel__title {
  color: var(--ink-1);
  font-size: var(--fs-h4);
  font-weight: 600;
  line-height: var(--lh-snug);
}

.segment-panel__segmented {
  flex: none;
}

.segment-panel__segmented :deep(.ant-segmented) {
  width: 100%;
}

.segment-panel__content {
  min-height: 0;
  flex: 1 1 0;
}
</style>
