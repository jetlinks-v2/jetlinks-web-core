import { computed, type CSSProperties } from 'vue'

export const cardAppearanceProps = {
  bordered: {
    type: Boolean,
    default: true,
  },
  backgroundOpacity: {
    type: Number,
    default: 100,
    validator: (value: number) => Number.isFinite(value) && value >= 0 && value <= 100,
  },
}

/** 将百分比配置转换为主题背景，避免使用元素 opacity 影响卡片内容。 */
export const useCardAppearanceStyle = (backgroundOpacity: () => number) => computed<CSSProperties>(() => {
  const opacity = Math.min(100, Math.max(0, backgroundOpacity()))
  const background = `color-mix(in srgb, var(--bg) ${opacity}%, transparent)`

  return {
    '--card-box-background': background,
    '--card-box-background-active': `color-mix(in srgb, var(--accent) 4%, ${background})`,
  } as CSSProperties
})
