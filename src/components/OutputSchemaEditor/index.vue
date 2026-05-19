<template>
  <section class="output-editor" :class="{ 'is-readonly': readonly }">
    <header class="editor-head">
      <div>
        <h3>输出字段</h3>
        <p>场景包对项目装配层承诺的字段。</p>
      </div>
      <button class="add-btn" type="button" :disabled="readonly" @click="addField">新增字段</button>
    </header>

    <div class="field-table" role="table" aria-label="输出字段">
      <div class="field-row field-row--head" role="row">
        <span>字段</span>
        <span>名称</span>
        <span>类型</span>
        <span>枚举</span>
        <span>范围</span>
        <span>说明</span>
        <span />
      </div>

      <div
        v-for="(field, index) in fields"
        :key="`${field.key}-${index}`"
        class="field-row"
        role="row"
      >
        <input
          class="cell-input cell-input--mono"
          :value="field.key"
          :readonly="readonly"
          placeholder="field_key"
          @input="updateField(index, { key: inputValue($event) })"
        >
        <input
          class="cell-input"
          :value="field.label"
          :readonly="readonly"
          placeholder="字段名称"
          @input="updateField(index, { label: inputValue($event) })"
        >
        <select
          class="cell-input"
          :value="field.type"
          :disabled="readonly"
          @change="updateType(index, inputValue($event) as OutputSchemaFieldType)"
        >
          <option v-for="type in FIELD_TYPES" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
        <input
          class="cell-input cell-input--mono"
          :value="enumText(field)"
          :disabled="readonly || field.type !== 'enum'"
          placeholder="a,b,c"
          @input="updateEnum(index, inputValue($event))"
        >
        <div class="range-cell">
          <input
            class="cell-input cell-input--mono"
            :value="field.min ?? ''"
            :disabled="readonly || field.type !== 'number'"
            placeholder="min"
            @input="updateNumber(index, 'min', inputValue($event))"
          >
          <input
            class="cell-input cell-input--mono"
            :value="field.max ?? ''"
            :disabled="readonly || field.type !== 'number'"
            placeholder="max"
            @input="updateNumber(index, 'max', inputValue($event))"
          >
        </div>
        <input
          class="cell-input"
          :value="field.description ?? ''"
          :readonly="readonly"
          placeholder="字段说明"
          @input="updateField(index, { description: inputValue($event) })"
        >
        <button
          class="delete-btn"
          type="button"
          :disabled="readonly || fields.length <= 1"
          title="删除字段"
          @click="deleteField(index)"
        >
          删除
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OutputSchemaField, OutputSchemaFieldType } from './types'

const FIELD_TYPES: OutputSchemaFieldType[] = ['boolean', 'number', 'string', 'enum', 'bbox', 'array', 'object']

const props = withDefaults(
  defineProps<{
    modelValue?: OutputSchemaField[]
    readonly?: boolean
  }>(),
  {
    modelValue: () => [],
    readonly: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: OutputSchemaField[]): void
}>()

const fields = computed(() => props.modelValue)

function cloneFields(): OutputSchemaField[] {
  return props.modelValue.map((field) => ({
    ...field,
    enumValues: field.enumValues ? [...field.enumValues] : undefined,
  }))
}

function updateField(index: number, patch: Partial<OutputSchemaField>) {
  if (props.readonly) return
  const next = cloneFields()
  next[index] = normalizeField({ ...next[index], ...patch })
  emit('update:modelValue', next)
}

function updateType(index: number, type: OutputSchemaFieldType) {
  if (props.readonly) return
  const patch: Partial<OutputSchemaField> = { type }
  if (type !== 'enum') patch.enumValues = undefined
  if (type !== 'number') {
    patch.min = undefined
    patch.max = undefined
  }
  updateField(index, patch)
}

function updateEnum(index: number, text: string) {
  if (props.readonly) return
  updateField(index, {
    enumValues: text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  })
}

function updateNumber(index: number, key: 'min' | 'max', value: string) {
  if (props.readonly) return
  const n = Number(value)
  updateField(index, { [key]: value.trim() === '' || Number.isNaN(n) ? undefined : n })
}

function addField() {
  if (props.readonly) return
  const next = cloneFields()
  const count = next.length + 1
  next.push({
    key: `field_${count}`,
    label: `字段 ${count}`,
    type: 'string',
  })
  emit('update:modelValue', next)
}

function deleteField(index: number) {
  if (props.readonly || props.modelValue.length <= 1) return
  const next = cloneFields()
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function normalizeField(field: OutputSchemaField): OutputSchemaField {
  return {
    ...field,
    key: field.key.trim(),
    label: field.label.trim(),
    description: field.description?.trim() || undefined,
  }
}

function enumText(field: OutputSchemaField): string {
  return field.enumValues?.join(', ') ?? ''
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLSelectElement).value
}
</script>

<style scoped>
.output-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 0.03125rem solid var(--line);
  border-radius: var(--r-2);
  background: var(--bg);
  padding: 0.75rem;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.editor-head h3 {
  margin: 0;
  font-size: var(--fs-14);
  font-weight: 500;
  color: var(--ink-1);
}

.editor-head p {
  margin: 0.25rem 0 0;
  font-size: var(--fs-12);
  color: var(--ink-3);
}

.add-btn,
.delete-btn {
  border: 0.03125rem solid var(--line);
  border-radius: var(--r-1);
  background: var(--bg);
  color: var(--ink-2);
  font-size: var(--fs-12);
  cursor: pointer;
  white-space: nowrap;
}

.add-btn {
  padding: 0.25rem 0.75rem;
}

.delete-btn {
  padding: 0.25rem 0.5rem;
}

.add-btn:hover:not(:disabled),
.delete-btn:hover:not(:disabled) {
  border-color: var(--line-strong);
  color: var(--ink-1);
}

.add-btn:disabled,
.delete-btn:disabled {
  cursor: not-allowed;
  color: var(--ink-4);
  border-color: var(--line);
}

.field-table {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-x: auto;
}

.field-row {
  display: grid;
  grid-template-columns: minmax(12ch, 1fr) minmax(10ch, 0.9fr) minmax(9ch, 0.7fr) minmax(12ch, 1fr) minmax(14ch, 0.9fr) minmax(16ch, 1.2fr) max-content;
  gap: 0.5rem;
  min-width: 78rem;
  align-items: center;
}

.field-row--head {
  font-size: var(--fs-12);
  color: var(--ink-4); }

.cell-input {
  min-width: 0;
  width: 100%;
  border: 0.03125rem solid var(--line);
  border-radius: var(--r-1);
  background: var(--bg);
  color: var(--ink-1);
  font-size: var(--fs-12);
  padding: 0.25rem 0.5rem;
  outline: none;
}

.cell-input:focus {
  border-color: var(--line-strong);
}

.cell-input:disabled {
  color: var(--ink-4);
  background: var(--bg-elev);
}

.cell-input[readonly] {
  color: var(--ink-2);
  background: var(--bg-elev);
}

.cell-input--mono { }

.range-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.25rem;
}</style>
