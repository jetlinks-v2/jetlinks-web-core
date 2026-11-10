import type { InjectionKey, Ref } from 'vue'

/** 缩放容器提供最终绘制像素密度；未提供时图表沿用 ECharts 默认值。 */
export const ECHARTS_PIXEL_RATIO_KEY: InjectionKey<Readonly<Ref<number>>> = Symbol('echarts-pixel-ratio')
