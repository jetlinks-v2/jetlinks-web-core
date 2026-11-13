import { defineAsyncComponent } from 'vue'

export { default as FormRenderer } from './FormRenderer.vue'
/** 渲染页不会主动下载编排界面；也可由宿主按路由懒加载整个入口。 */
export const FormDesigner = /* @__PURE__ */ defineAsyncComponent(() => import('./FormDesigner.vue'))
export type * from './types'
