<template>
  <div
    v-bind="rootAttrs"
    class="equal-height-columns"
    :class="attrs.class"
    :style="[attrs.style, rootStyle]"
  >
    <div class="equal-height-columns__pane" :style="leftStyle">
      <slot name="left" />
    </div>
    <div class="equal-height-columns__pane" :style="rightStyle">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts" name="EqualHeightColumns">
import type { CSSProperties } from 'vue'

type SizeValue = number | string

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const props = withDefaults(
  defineProps<{
    height?: SizeValue
    gap?: SizeValue
    leftWidth?: SizeValue
    rightWidth?: SizeValue
    align?: CSSProperties['alignItems']
  }>(),
  {
    height: '100%',
    gap: 'var(--space-4)',
    leftWidth: '1fr',
    rightWidth: '1fr',
    align: 'stretch',
  }
)

const toCssValue = (value: SizeValue) => typeof value === 'number' ? `${value}px` : value

const toGridTrack = (value: SizeValue) => {
  if (typeof value === 'number') {
    return `${value}px`
  }

  return value
}

const rootStyle = computed<Record<string, string>>(() => ({
  '--equal-height-columns-height': toCssValue(props.height),
  '--equal-height-columns-gap': toCssValue(props.gap),
  '--equal-height-columns-align': props.align,
  '--equal-height-columns-left-width': toGridTrack(props.leftWidth),
  '--equal-height-columns-right-width': toGridTrack(props.rightWidth),
}))

const paneStyle = computed<CSSProperties>(() => ({
  minHeight: 'var(--equal-height-columns-height)',
}))

const rootAttrs = computed(() => {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => !['class', 'style'].includes(key))
  )
})

const leftStyle = paneStyle
const rightStyle = paneStyle
</script>

<style scoped>
.equal-height-columns {
  display: grid;
  width: 100%;
  height: var(--equal-height-columns-height);
  min-height: 0;
  gap: var(--equal-height-columns-gap);
  align-items: var(--equal-height-columns-align);
  grid-template-columns: minmax(0, var(--equal-height-columns-left-width)) minmax(0, var(--equal-height-columns-right-width));
}

.equal-height-columns__pane {
  min-width: 0;
  height: 100%;
}
</style>
