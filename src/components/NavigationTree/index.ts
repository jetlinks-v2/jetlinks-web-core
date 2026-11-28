import type { App } from 'vue'
import NavigationTree from './index.vue'

export default Object.assign(NavigationTree, {
  install(app: App) { app.component('NavigationTree', NavigationTree) },
})
export type { NavigationTreeProps, NavigationTreeOptions, NavigationTreeKey, NavigationTreeNode } from './types'
