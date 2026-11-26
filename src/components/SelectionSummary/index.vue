<template>
  <span ref="viewport" class="selection-summary" :title="names.join('、')" :aria-label="names.length ? names.join('、') : placeholder">
    <span v-if="!names.length" class="selection-summary__placeholder">{{ placeholder }}</span>
    <template v-else>
      <span v-for="(name, index) in visibleNames" :key="index" class="selection-summary__name" aria-hidden="true">{{ name }}</span><span v-if="hiddenCount" class="selection-summary__more" :class="{ 'has-prefix': visibleCount > 0 }" aria-hidden="true">+{{ hiddenCount }}</span>
    </template>
    <span ref="measurements" class="selection-summary__measure" aria-hidden="true"><span v-for="(name, index) in names" :key="index" class="selection-summary__name" data-measured-name>{{ name }}</span><span ref="measureMore" class="selection-summary__more" /></span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ names: readonly string[], placeholder: string }>()
const viewport = ref<HTMLElement>()
const measurements = ref<HTMLElement>()
const measureMore = ref<HTMLElement>()
const visibleCount = ref(0)
const hiddenCount = computed(() => Math.max(0, props.names.length - visibleCount.value))
const visibleNames = computed(() => props.names.slice(0, visibleCount.value))
let observer: ResizeObserver | undefined
let disposed = false

// 按实际标签宽度保留完整姓名，剩余项显示数量；尺寸、字体和异步名称变化后重新测量。
function updateVisibleNames() {
  const container = viewport.value
  const measure = measurements.value
  const more = measureMore.value
  if (!container || !measure || !more) return
  const items = Array.from(measure.querySelectorAll<HTMLElement>('[data-measured-name]'))
  if (items.length !== props.names.length) return
  const available = container.clientWidth
  const widths = [0]
  items.forEach((item, index) => widths.push(widths[widths.length - 1] + item.getBoundingClientRect().width + (index ? 6 : 0)))
  if (widths[items.length] <= available) { visibleCount.value = items.length; return }
  for (let count = items.length - 1; count >= 0; count -= 1) {
    more.textContent = `+${items.length - count}`
    const suffixWidth = more.getBoundingClientRect().width + (count ? 6 : 0)
    if (widths[count] + suffixWidth <= available) { visibleCount.value = count; return }
  }
  visibleCount.value = 0
}
function scheduleUpdate() { void nextTick(() => { if (!disposed) updateVisibleNames() }) }
watch(() => props.names, scheduleUpdate, { deep: true })
onMounted(() => {
  scheduleUpdate()
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    observer = new ResizeObserver(scheduleUpdate)
    observer.observe(viewport.value)
  } else window.addEventListener('resize', scheduleUpdate)
  if (document.fonts) {
    void document.fonts.ready.then(scheduleUpdate)
    document.fonts.addEventListener('loadingdone', scheduleUpdate)
  }
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  window.removeEventListener('resize', scheduleUpdate)
  document.fonts?.removeEventListener('loadingdone', scheduleUpdate)
})
</script>

<style scoped>
.selection-summary { position: relative; display: block; min-width: 0; overflow: hidden; white-space: nowrap; }
.selection-summary__name, .selection-summary__more { display: inline-block; padding: 2px 8px; border-radius: var(--r-2, 6px); color: var(--ink-1, var(--ant-color-text)); background: var(--canvas, var(--ant-color-fill-quaternary)); font-size: 12px; font-weight: 400; line-height: 18px; white-space: pre; }
.selection-summary__name + .selection-summary__name, .selection-summary__more.has-prefix { margin-left: 6px; }
.selection-summary__placeholder { color: inherit; }
.selection-summary__measure { position: fixed; top: 0; left: -100000px; width: max-content; visibility: hidden; pointer-events: none; white-space: nowrap; }
</style>
