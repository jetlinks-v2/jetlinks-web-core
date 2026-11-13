import { Tree } from 'ant-design-vue'
import type { App as VueApp } from 'vue'
import AutoTreeComponent from './index.vue'

const AutoTree = Object.assign(AutoTreeComponent, {
  TreeNode: Tree.TreeNode,
  DirectoryTree: Tree.DirectoryTree,
  install(app: VueApp) {
    app.component('AutoTree', AutoTree)
    return app
  },
}) as typeof Tree

export default AutoTree
export type { TreeProps as AutoTreeProps } from 'ant-design-vue'
export type AutoTreeInstance = InstanceType<typeof Tree>

declare module 'vue' {
  interface GlobalComponents {
    AutoTree: typeof AutoTreeComponent
  }
}
