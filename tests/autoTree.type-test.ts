import type { Tree, TreeProps } from 'ant-design-vue'
import AutoTreeSfc from '../src/components/AutoTree/index.vue'
import AutoTree from '../src/components/AutoTree'

type AutoProps = InstanceType<typeof AutoTreeSfc>['$props']
type NativeProps = InstanceType<typeof Tree>['$props']
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Changed = {
  [K in keyof TreeProps]-?: Equal<AutoProps[K], NativeProps[K]> extends true ? never : K
}[keyof TreeProps]
const unchanged: Record<Changed, never> = {}
type Complete = Exclude<keyof TreeProps, keyof AutoProps> extends never ? true : false
const complete: Complete = true

declare const original: TreeProps
const compatible: AutoProps = original
declare const wrapped: AutoProps
const originalCompatible: TreeProps = wrapped

const configured: AutoProps = {
  height: 320, virtual: true, checkable: true, checkStrictly: true, draggable: true, multiple: true,
  fieldNames: { title: 'label', key: 'id', children: 'nodes' },
  treeData: [{ key: 'root', id: 'root', label: 'Root' }],
  selectedKeys: ['root'], expandedKeys: ['root'], checkedKeys: { checked: ['root'], halfChecked: [] },
  onSelect: keys => { keys.map(String) },
  onExpand: (keys, info) => { keys.map(String); info.expanded.valueOf() },
  onCheck: (keys, info) => { void keys; info.checked.valueOf() },
  'onUpdate:selectedKeys': keys => { keys.map(String) },
  loadData: async node => { void node.key },
}

const wrongHeight: AutoProps = {
  // @ts-expect-error 与 Tree 一致，height 必须为数值
  height: '300px',
}
const wrongSelection: AutoProps = {
  // @ts-expect-error 不能把单个字符串当作选中 key 数组
  selectedKeys: 'root',
}
const wrongEvent: AutoProps = {
  // @ts-expect-error 保留 Tree 的事件参数约束
  onSelect: (value: string) => { void value },
}
const samePublicComponent: typeof Tree = AutoTree

void [unchanged, complete, compatible, originalCompatible, configured, wrongHeight, wrongSelection, wrongEvent, samePublicComponent]
