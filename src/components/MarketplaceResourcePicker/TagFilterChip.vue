<template>
  <span
    role="button"
    tabindex="0"
    class="mp-res-layout__tag-chip"
    :class="{
      'mp-res-layout__tag-chip--selected': selected,
      'mp-res-layout__tag-chip--color': meta.isColor,
      'mp-res-layout__tag-chip--image': meta.isImage,
      'mp-res-layout__tag-chip--font': meta.isFont,
    }"
    :style="meta.wrapStyle"
    @click="$emit('toggle')"
    @keydown.enter.prevent="$emit('toggle')"
  >
    <span v-if="meta.isFont" class="mp-res-layout__tag-chip-font" aria-hidden="true">
      <AIcon :type="meta.iconType" />
    </span>
    <img v-else-if="meta.showImg" class="mp-res-layout__tag-chip-img" :src="meta.imgSrc" alt="" />
    <span class="mp-res-layout__tag-chip-label" :style="meta.labelStyle">{{ tag.name }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TagChipItem } from './sidebar'
import { parseIconValue } from '../IconValue/iconValue'

const props = defineProps<{
  tag: TagChipItem
  selected: boolean
}>()

defineEmits<{ toggle: [] }>()

function textColorOnHex(hex: string): string {
  const m = hex.replace(/^#/, '')
  if (m.length !== 3 && m.length !== 6) return 'rgba(0,0,0,0.85)'
  const h = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? 'rgba(0,0,0,0.88)' : '#fff'
}

const meta = computed(() => {
  const p = parseIconValue(props.tag.icon)
  if (p.kind === 'color') {
    const bg = p.color
    const labelStyle: Record<string, string> = {}
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(bg)) labelStyle.color = textColorOnHex(bg)
    return {
      isColor: true,
      isImage: false,
      isFont: false,
      iconType: '',
      showImg: false,
      imgSrc: '',
      wrapStyle: { backgroundColor: bg } as Record<string, string>,
      labelStyle,
    }
  }
  if (p.kind === 'image') {
    return {
      isColor: false,
      isImage: true,
      isFont: false,
      iconType: '',
      showImg: true,
      imgSrc: p.url,
      wrapStyle: {} as Record<string, string>,
      labelStyle: {} as Record<string, string>,
    }
  }
  if (p.kind === 'font') {
    return {
      isColor: false,
      isImage: false,
      isFont: true,
      iconType: p.iconType,
      showImg: false,
      imgSrc: '',
      wrapStyle: {} as Record<string, string>,
      labelStyle: {} as Record<string, string>,
    }
  }
  return {
    isColor: false,
    isImage: false,
    isFont: false,
    iconType: '',
    showImg: false,
    imgSrc: '',
    wrapStyle: {} as Record<string, string>,
    labelStyle: {} as Record<string, string>,
  }
})
</script>

<style scoped lang="less">
.mp-res-layout__tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #fff;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.85);
  cursor: pointer;
  line-height: 1.35;
  max-width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  outline: none;
}
.mp-res-layout__tag-chip:focus-visible {
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.35);
}
.mp-res-layout__tag-chip--color {
  border-color: rgba(0, 0, 0, 0.06);
}
.mp-res-layout__tag-chip--image {
  border-color: rgba(0, 0, 0, 0.08);
}
.mp-res-layout__tag-chip--font {
  border-color: rgba(99, 102, 241, 0.22);
  background: linear-gradient(135deg, rgba(238, 242, 255, 0.95), rgba(224, 242, 254, 0.9));
}
.mp-res-layout__tag-chip--selected {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.28);
}
.mp-res-layout__tag-chip-font {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mp-res-layout__tag-chip-font :deep(.anticon) {
  font-size: 14px;
  color: #312e81;
}
.mp-res-layout__tag-chip-img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}
.mp-res-layout__tag-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
</style>
