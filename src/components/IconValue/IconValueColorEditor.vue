<template>
  <div class="ive__pane">
    <div v-if="swatches.length" class="ive__swatches-title">{{ texts.colorSwatches }}</div>
    <div v-if="swatches.length" class="ive__swatches">
      <button
        v-for="c in swatches"
        :key="c"
        type="button"
        class="ive__swatch"
        :style="{ background: c }"
        :aria-label="c"
        :title="c"
        @click="pickPreset(c)"
      />
    </div>
    <div class="ive__row">
      <span class="ive__label">{{ texts.colorPicker }}</span>
      <input v-model="colorHex" class="ive__native-color" type="color" @input="onNativeColorInput" />
    </div>
    <a-input v-model:value="colorText" :placeholder="texts.colorPlaceholder" @change="onColorTextSyncHex" />
    <a-input
      v-model:value="colorLabel"
      :placeholder="texts.colorBlockLabel"
      allow-clear
    />
    <a-button type="primary" block class="ive__apply" @click="applyColorFromInputs">
      {{ texts.applyColor }}
    </a-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, type PropType } from 'vue'
import { formatIconValueColor, parseIconValue } from './iconValue'

const props = defineProps({
  value: { type: String, default: '' },
  swatches: { type: Array as PropType<string[]>, required: true },
  texts: { type: Object as PropType<Record<string, string>>, required: true },
})
const emit = defineEmits<{ 'update:value': [value: string] }>()
const colorHex = ref('#1677ff')
const colorText = ref('#1677ff')
const colorLabel = ref('')

// 颜色草稿独立于字体与图片；切回颜色页签时保留标签和输入。
watch(() => props.value, value => {
  const parsed = parseIconValue(value)
  if (parsed.kind !== 'color') return
  colorText.value = parsed.color
  colorHex.value = toHexOrFallback(parsed.color, colorHex.value)
  colorLabel.value = parsed.label ?? ''
}, { immediate: true })

function toHexOrFallback(css: string, fb: string): string {
  const s = String(css || '').trim()
  const m = /^#([0-9A-Fa-f]{6})$/.exec(s)
  if (m) return `#${m[1]}`
  return fb
}

function pickPreset(c: string) {
  colorHex.value = c
  colorText.value = c
  emit('update:value', formatIconValueColor(c, colorLabel.value.trim() || undefined))
}

function onNativeColorInput() {
  colorText.value = colorHex.value
  emit('update:value', formatIconValueColor(colorHex.value, colorLabel.value.trim() || undefined))
}

function applyColorFromInputs() {
  const raw = String(colorText.value || colorHex.value || '').trim()
  if (!raw) return
  emit('update:value', formatIconValueColor(raw, colorLabel.value.trim() || undefined))
}

function onColorTextSyncHex() {
  const raw = String(colorText.value || '').trim()
  if (/^#([0-9A-Fa-f]{6})$/.test(raw)) colorHex.value = raw
}

</script>

<style scoped>
.ive__pane { display: flex; flex-direction: column; gap: var(--space-2); }
.ive__swatches-title {
  font-size: var(--fs-12);
  color: var(--ink-4);
}
.ive__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}
.ive__swatch {
  width: 1.625rem;
  height: 1.625rem;
  border-radius: var(--r-2);
  border: 1px solid color-mix(in srgb, var(--ink-1) 12%, transparent);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.ive__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ive__label {
  font-size: var(--fs-14);
  color: var(--ink-2);
  white-space: nowrap;
}
.ive__native-color {
  width: 2.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ink-1) 15%, transparent);
  border-radius: var(--r-1);
  cursor: pointer;
  background: transparent;
}
.ive__apply {
  margin-top: var(--space-1);
}
</style>
