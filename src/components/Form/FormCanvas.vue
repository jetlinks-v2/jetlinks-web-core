<template>
  <div class="fw-canvas" :class="{ 'fw-design-canvas': design }">
    <section v-for="section in sections" :key="section.id" class="fw-section" :data-section-id="section.id">
      <header class="fw-section-head">
        <slot name="section-title" :section="section"><h3>{{ text(section) }}</h3></slot>
        <slot name="section-actions" :section="section" />
      </header>
      <div class="fw-grid">
        <div v-for="entry in section.entries" :key="entry.field.key" class="fw-field" :class="{ 'fw-full': entry.item.span === 2, 'fw-selected': design && selectedKey === entry.field.key }" :data-field-key="entry.field.key" @click="design && emit('select-field', entry.field.key)">
          <div class="fw-label"><slot name="label" v-bind="entry">{{ label(entry.field, entry.item) }}</slot></div>
          <div class="fw-value"><slot name="value" v-bind="entry" :value="Object.hasOwn(values, entry.field.key) ? values[entry.field.key] : undefined" /></div>
          <div v-if="$slots['field-actions']" class="fw-field-tools"><slot name="field-actions" v-bind="entry" /></div>
        </div>
      </div>
      <slot v-if="!section.entries.length" name="empty-section" :section="section" />
    </section>
    <slot v-if="!sections.length" name="empty" />
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { fieldAccess } from './model'
import { useFormLocale } from './locale'
import type { FormAccess, FormField, FormLayout, FormValues } from './types'

const props = defineProps({
  fields: { type: Array as PropType<FormField[]>, required: true },
  layout: { type: Object as PropType<FormLayout>, required: true },
  values: { type: Object as PropType<FormValues>, required: true },
  access: Object as PropType<FormAccess>,
  design: Boolean,
  selectedKey: String,
})
const emit = defineEmits<{ (event: 'select-field', key: string): void }>()
const { text, label } = useFormLocale()
const fieldMap = computed(() => new Map(props.fields.map(field => [field.key, field])))
const sections = computed(() => props.layout.sections.map(section => ({
  ...section,
  entries: section.items.flatMap(item => {
    const field = fieldMap.value.get(item.key)
    if (!field) return []
    const access = fieldAccess(field, item, props.access)
    return access === 'hidden' ? [] : [{ field, item, access }]
  }),
})).filter(section => props.design || section.entries.length))
</script>

<style scoped>
.fw-canvas { container: fw-canvas / inline-size; min-width: 0; color: var(--jet-theme-text, #1f2429); }
.fw-section { padding: 22px 0 26px; }
.fw-section:first-child { padding-top: 12px; }
.fw-section + .fw-section { border-top: 1px solid var(--line, #edf0f3); }
.fw-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 20px; }
.fw-section-head h3 { margin: 0; font-size: 14px; font-weight: 600; }
.fw-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 40px; }
.fw-field { min-width: 0; position: relative; border-radius: 6px; }
/* 留白与负外边距抵消，设计边界包住完整区块，内容仍与运行页对齐。 */
.fw-design-canvas .fw-field { padding: 10px; margin: -10px; border-radius: 5px; cursor: pointer; }
.fw-design-canvas .fw-selected { box-shadow: inset 0 0 0 1px var(--jet-theme-primary-border, #91bfff); background: color-mix(in srgb, var(--jet-theme-primary, #1677ff) 2%, var(--bg, #fff)); }
.fw-design-canvas .fw-label { padding-right: 72px; }
.fw-field-tools { position: absolute; right: 3px; top: 3px; display: flex; align-items: center; opacity: 0; pointer-events: none; }
.fw-field-tools :deep(.ant-btn) { padding: 0; width: 24px; height: 24px; color: var(--jet-theme-text-secondary, #697586); }
.fw-field:hover > .fw-field-tools, .fw-field:focus-within > .fw-field-tools, .fw-selected > .fw-field-tools { opacity: 1; pointer-events: auto; }
.fw-full { grid-column: 1 / -1; }
.fw-label { display: flex; align-items: center; min-height: 22px; margin-bottom: 5px; font-size: 12px; line-height: 22px; color: var(--jet-theme-text-secondary, #697586); }
.fw-value { min-width: 0; min-height: 26px; font-size: 14px; line-height: 26px; overflow-wrap: anywhere; }
@container fw-canvas (max-width: 520px) { .fw-grid { grid-template-columns: minmax(0, 1fr); gap: 26px; } }
@container fw-canvas (max-width: 600px) { .fw-design-canvas .fw-label { padding-right: 132px; } .fw-field-tools { top: 0; right: 0; opacity: 1; pointer-events: auto; } .fw-field-tools :deep(.ant-btn) { width: 44px; height: 44px; } }
</style>
