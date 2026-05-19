<template>
  <div
    class="icon-value-view"
    :class="{ 'icon-value-view--round': round }"
    :style="boxCss"
    aria-hidden="true"
  >
    <img v-if="parsed.kind === 'image'" class="icon-value-view__img" :src="parsed.url" alt="" />
    <div
      v-else-if="parsed.kind === 'color'"
      class="icon-value-view__solid"
      :style="{ background: parsed.color }"
    >
      <span :style="solidTextStyle">{{ solidText }}</span>
    </div>
    <div v-else-if="parsed.kind === 'font'" class="icon-value-view__font">
      <AIcon :type="parsed.iconType" />
    </div>
    <div v-else class="icon-value-view__fallback">
      <span class="icon-value-view__fallback-text">{{ solidText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { parseIconValue } from './iconValue'

const props = withDefaults(
  defineProps<{
    /** 存储值：color: / font: / URL */
    value?: string | null
    /** 边长（px） */
    size?: number
    /**
     * 当纯色未配置标签、或其它类型需要缩写时，用于生成色块/头像上的文字（如名称）。
     */
    fallbackText?: string
    round?: boolean
    borderRadius?: number
  }>(),
  {
    value: '',
    size: 48,
    fallbackText: '',
    round: false,
    borderRadius: undefined,
  },
)

const parsed = computed(() => parseIconValue(props.value))

/** 色块上文字：优先 color 内嵌标签，否则用 fallback 取前 2 个 Unicode 字符 */
const solidText = computed(() => {
  const p = parsed.value
  if (p.kind === 'text' && p.text) return p.text
  if (p.kind === 'color' && p.label) return sliceGlyph(p.label, 2)
  const fb = String(props.fallbackText || '').trim()
  if (fb) return sliceGlyph(fb, 2)
  return '?'
})

function sliceGlyph(s: string, max: number): string {
  const t = s.trim()
  if (!t) return ''
  return [...t].slice(0, max).join('').toUpperCase()
}

/** 根据背景亮度选择文字颜色（仅对 hex 背景可靠） */
const solidTextStyle = computed(() => {
  const p = parsed.value
  if (p.kind !== 'color') return {}
  const hex = parseHex(p.color)
  if (hex == null) return { color: '#fff' }
  const lum = relativeLuminance(hex)
  return { color: lum > 0.62 ? 'rgba(0,0,0,0.88)' : '#fff' }
})

function parseHex(css: string): string | null {
  const s = css.trim()
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s)
  if (!m) return null
  const h = m[1]
  if (h.length === 3) return h.split('').map((c) => c + c).join('')
  return h
}

function relativeLuminance(hex6: string): number {
  const r = parseInt(hex6.slice(0, 2), 16) / 255
  const g = parseInt(hex6.slice(2, 4), 16) / 255
  const b = parseInt(hex6.slice(4, 6), 16) / 255
  return (0.299 * r + 0.587 * g + 0.114 * b)
}

const radius = computed(() => {
  if (props.borderRadius != null && props.borderRadius >= 0) return props.borderRadius
  return props.round ? Math.ceil(props.size / 2) : Math.max(8, Math.floor(props.size / 5))
})

const boxCss = computed(() => ({
  width: `100%`,
  height: `100%`,
  borderRadius: `${radius.value}px`,
  '--ivv-size': `${props.size}px`,
}))
</script>

<style scoped>
.icon-value-view {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--ink-1) 4%, transparent);
  box-sizing: border-box;
}
.icon-value-view__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.icon-value-view__solid {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: calc(var(--ivv-size, var(--fs-48)) * 0.33);
}
.icon-value-view__font {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-soft), var(--info-bg));
  color: var(--jet-theme-primary-active);
}
/* 与色块文字一致：按容器边长比例，避免继承父级过小字号导致图标几乎看不见 */
.icon-value-view__font :deep(.anticon) {
  font-size: calc(var(--ivv-size, var(--fs-48)) * 0.58);
  line-height: 1;
}
.icon-value-view__fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: var(--accent-soft);
  color: var(--jet-theme-primary-active);
}
.icon-value-view__fallback-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 0 0.08em;
  font-size: calc(var(--ivv-size, var(--fs-48)) * 0.35);
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.02em; }</style>
